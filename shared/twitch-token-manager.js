// Shared Twitch USER access token manager, used by shared/twitch-eventsub.js.
//
// EventSub (channel point redeems, watch streaks) requires a real user
// access token (not the anonymous IRC login, and not the app/client-credentials
// token twitch-chat.js mints for badges) with scopes:
//   - channel:read:redemptions  (channel.channel_points_custom_reward_redemption.add)
//   - user:read:chat            (channel.chat.notification / watch_streak)
//
// This repo has no backend/server, so there is nowhere to durably store a
// refreshed token except the browser itself. Twitch ROTATES the refresh
// token every time it's used (the old one becomes invalid), so we can't just
// keep re-reading the seed value from secrets.local.js after the first
// refresh — instead:
//   1. secrets.local.js provides the initial (seed) access + refresh token,
//      obtained once via a third-party OAuth helper (e.g. twitchtokengenerator.com).
//   2. On first use, we copy those into localStorage.
//   3. From then on, localStorage is the source of truth; every refresh
//      overwrites it with the newly-rotated pair. This persists across
//      OBS restarts (same machine/profile) without needing a server.
//
// A simple localStorage-based lock guards against two pages (e.g. this file
// opened in two OBS browser sources, or a preview tab + OBS) refreshing at
// the same moment and invalidating each other's rotated token.

const TwitchTokenManager = (() => {
    const STORAGE_KEY = 'twitchEventSub.tokens.v1';
    const LOCK_KEY = 'twitchEventSub.tokens.v1.lock';
    const LOCK_TTL_MS = 10000; // Assume a stale lock (crashed tab) after this long.
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
    // finish, then returns whatever it wrote to localStorage.
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
            refresh_token: data.refresh_token || refreshToken, // Twitch always rotates, but fall back just in case.
            expires_at: Date.now() + (data.expires_in || 0) * 1000,
            seeded_from: seededFrom, // Carried forward so we can detect a new seed in secrets.local.js later.
        };
        writeStoredTokens(tokens);
        return tokens;
    }

    function seedTokens(seedAccessToken, seedRefreshToken) {
        if (!seedRefreshToken) {
            throw new Error('TwitchTokenManager: no stored tokens and no seed refresh token provided.');
        }
        // We don't know the seed access token's remaining lifetime, so treat
        // it as already-expired and refresh immediately to learn a real expiry.
        const tokens = { access_token: seedAccessToken || '', refresh_token: seedRefreshToken, expires_at: 0, seeded_from: seedRefreshToken };
        writeStoredTokens(tokens);
        return tokens;
    }

    // Returns a valid (non-expired) access token, seeding from
    // secrets.local.js on first run and transparently refreshing (with
    // cross-page locking) whenever the stored token is near expiry.
    async function getAccessToken({ clientId, clientSecret, seedAccessToken, seedRefreshToken, forceRefresh = false } = {}) {
        let tokens = readStoredTokens();

        // If secrets.local.js was updated with a new seed refresh token (e.g.
        // because the old one broke), the stored pair is from a different,
        // stale lineage — adopt the new seed instead of continuing to refresh
        // an invalid token forever. This also covers a stored entry that
        // predates the seeded_from marker (tokens.seeded_from is undefined):
        // any mismatch against the current seed is treated as stale.
        if (tokens && seedRefreshToken && tokens.seeded_from !== seedRefreshToken && tokens.refresh_token !== seedRefreshToken) {
            tokens = null;
        }

        if (!tokens) {
            tokens = seedTokens(seedAccessToken, seedRefreshToken);
        }

        const nearExpiry = !tokens.expires_at || Date.now() > tokens.expires_at - REFRESH_MARGIN_MS;
        if (!forceRefresh && !nearExpiry) return tokens.access_token;

        if (!acquireLock()) {
            // Someone else is already refreshing — wait for them instead of
            // racing to refresh with the same (about to be invalidated) token.
            const updated = await waitForOtherRefresh();
            if (updated && updated.access_token && (!forceRefresh || updated.access_token !== tokens.access_token)) {
                return updated.access_token;
            }
            // Fall through and try ourselves if waiting didn't help.
        }

        try {
            try {
                const refreshed = await refreshAccessToken({ clientId, clientSecret, refreshToken: tokens.refresh_token, seededFrom: tokens.seeded_from });
                return refreshed.access_token;
            } catch (err) {
                // Last resort: if the stored refresh token wasn't already the
                // current seed, the seed itself might still be unused/valid —
                // try it once directly before giving up.
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
