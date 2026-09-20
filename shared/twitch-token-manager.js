// This is the shared Twitch USER access token manager. shared/twitch-eventsub.js uses it.
//
// EventSub, for channel point redeems and watch streaks, needs a real user
// access token. This is not the anonymous IRC login, and not the app or client-credentials
// token that twitch-chat.js mints for badges. It needs these scopes:
//   - channel:read:redemptions  (channel.channel_points_custom_reward_redemption.add)
//   - user:read:chat            (channel.chat.notification / watch_streak)
//
// This repo has no backend server, so the browser itself is the only place to
// store a refreshed token. Twitch rotates the refresh
// token each time the code uses it, so the old token becomes invalid. This code cannot
// just keep re-reading the seed value from secrets.local.js after the first
// refresh. Instead, it works like this:
//   1. secrets.local.js provides the initial (seed) access and refresh token,
//      obtained once through a third-party OAuth helper, for example twitchtokengenerator.com.
//   2. On first use, this code copies those tokens into localStorage.
//   3. After that, localStorage is the source of truth. Each refresh
//      overwrites it with the newly rotated pair. This persists across
//      OBS restarts, on the same machine and profile, with no server needed.
//
// A simple localStorage-based lock stops two pages, for example this file
// opened in two OBS browser sources, or a preview tab plus OBS, from refreshing at
// the same moment and invalidating each other's rotated token.

const TwitchTokenManager = (() => {
    const STORAGE_KEY = 'twitchEventSub.tokens.v1';
    const LOCK_KEY = 'twitchEventSub.tokens.v1.lock';
    const LOCK_TTL_MS = 10000; // After this time, treat the lock as stale, from a crashed tab.
    const REFRESH_MARGIN_MS = 5 * 60 * 1000; // Refresh 5 minutes before expiry.

    function readStoredTokens() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch (err) {
            console.warn('TwitchTokenManager: failed to read stored tokens', err);
            return null;
        }
    }

    function writeStoredTokens(tokens) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
        } catch (err) {
            console.warn('TwitchTokenManager: failed to persist tokens', err);
        }
    }

    function acquireLock() {
        const now = Date.now();
        const existing = Number(localStorage.getItem(LOCK_KEY) || 0);
        if (existing && now - existing < LOCK_TTL_MS) return false;
        localStorage.setItem(LOCK_KEY, String(now));
        return true;
    }

    function releaseLock() {
        localStorage.removeItem(LOCK_KEY);
    }

    function sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    // Waits for another page's in-progress refresh (see acquireLock) to
    // finish, then returns what that refresh wrote to localStorage.
    async function waitForOtherRefresh() {
        for (let i = 0; i < 20; i++) {
            await sleep(500);
            const lockAge = Date.now() - Number(localStorage.getItem(LOCK_KEY) || 0);
            const tokens = readStoredTokens();
            if (!localStorage.getItem(LOCK_KEY) || lockAge > LOCK_TTL_MS) return tokens;
        }
        return readStoredTokens();
    }

    async function refreshAccessToken({ clientId, clientSecret, refreshToken, seededFrom }) {
        const body = new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
            client_id: clientId,
            client_secret: clientSecret,
        });

        const res = await fetch('https://id.twitch.tv/oauth2/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body,
        });

        if (!res.ok) {
            throw new Error(`TwitchTokenManager: refresh failed (${res.status})`);
        }

        const data = await res.json();
        const tokens = {
            access_token: data.access_token,
            refresh_token: data.refresh_token || refreshToken, // Twitch always rotates the token, but fall back just in case.
            expires_at: Date.now() + (data.expires_in || 0) * 1000,
            seeded_from: seededFrom, // Carried forward, to detect a new seed in secrets.local.js later.
        };
        writeStoredTokens(tokens);
        return tokens;
    }

    function seedTokens(seedAccessToken, seedRefreshToken) {
        if (!seedRefreshToken) {
            throw new Error('TwitchTokenManager: no stored tokens and no seed refresh token provided.');
        }
        // This code does not know the seed access token's remaining lifetime. So it treats
        // the token as already expired, and refreshes immediately to learn a real expiry.
        const tokens = { access_token: seedAccessToken || '', refresh_token: seedRefreshToken, expires_at: 0, seeded_from: seedRefreshToken };
        writeStoredTokens(tokens);
        return tokens;
    }

    // Returns a valid, non-expired access token. It seeds from
    // secrets.local.js on the first run, and refreshes the token
    // automatically, with cross-page locking, whenever the stored token nears expiry.
    async function getAccessToken({ clientId, clientSecret, seedAccessToken, seedRefreshToken, forceRefresh = false } = {}) {
        let tokens = readStoredTokens();

        // If secrets.local.js was updated with a new seed refresh token, for example
        // because the old one broke, the stored pair comes from a different,
        // stale lineage. This code adopts the new seed instead of continuing to refresh
        // an invalid token forever. This also covers a stored entry that
        // predates the seeded_from marker, where tokens.seeded_from is undefined.
        // Any mismatch against the current seed counts as stale.
        if (tokens && seedRefreshToken && tokens.seeded_from !== seedRefreshToken && tokens.refresh_token !== seedRefreshToken) {
            tokens = null;
        }

        if (!tokens) {
            tokens = seedTokens(seedAccessToken, seedRefreshToken);
        }

        const nearExpiry = !tokens.expires_at || Date.now() > tokens.expires_at - REFRESH_MARGIN_MS;
        if (!forceRefresh && !nearExpiry) return tokens.access_token;

        if (!acquireLock()) {
            // Another page is already refreshing. Wait for it instead of
            // racing to refresh with the same, soon-to-be-invalid token.
            const updated = await waitForOtherRefresh();
            if (updated && updated.access_token && (!forceRefresh || updated.access_token !== tokens.access_token)) {
                return updated.access_token;
            }
            // If waiting did not help, fall through and try the refresh here.
        }

        try {
            try {
                const refreshed = await refreshAccessToken({ clientId, clientSecret, refreshToken: tokens.refresh_token, seededFrom: tokens.seeded_from });
                return refreshed.access_token;
            } catch (err) {
                // Last resort: if the stored refresh token was not already the
                // current seed, the seed itself might still be unused and valid.
                // Try it once directly before giving up.
                if (seedRefreshToken && tokens.refresh_token !== seedRefreshToken) {
                    const reseeded = seedTokens(seedAccessToken, seedRefreshToken);
                    const refreshed = await refreshAccessToken({ clientId, clientSecret, refreshToken: reseeded.refresh_token, seededFrom: seedRefreshToken });
                    return refreshed.access_token;
                }
                throw err;
            }
        } finally {
            releaseLock();
        }
    }

    return { getAccessToken };
})();
