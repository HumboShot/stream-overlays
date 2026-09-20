// Shared Twitch EventSub engine — connects to Twitch's EventSub WebSocket
// gateway with a real user access token (see shared/twitch-token-manager.js)
// and subscribes to:
//   - channel.channel_points_custom_reward_redemption.add (needs channel:read:redemptions)
//   - channel.chat.notification, filtered to notice_type "watch_streak"    (needs user:read:chat)
//
// Unlike shared/twitch-chat.js (anonymous IRC, no auth), these events are
// genuinely only available via EventSub, which requires an authenticated
// user token. See shared/twitch-token-manager.js for how that token is
// obtained/refreshed without a backend server.
//
// Call connectTwitchEvents({...}) once per page; it calls back into
// onRedeem(...) / onWatchStreak(...) for each qualifying event.

function connectTwitchEvents({
    broadcasterUserId,      // Numeric Twitch user ID of the channel to watch (same value as twitchUserId elsewhere).
    twitchClientId,         // Twitch API Client ID (shared/secrets.local.js).
    twitchClientSecret,     // Twitch API Client Secret, used only for refreshing the user token.
    userAccessToken,        // Seed user access token (shared/secrets.local.js), scopes: channel:read:redemptions, user:read:chat.
    userRefreshToken,       // Seed user refresh token (shared/secrets.local.js).
    onRedeem,               // ({ displayName, rewardTitle, userInput, cost }) => void
    onWatchStreak,          // ({ displayName, streakCount }) => void
} = {}) {
    const EVENTSUB_WS_URL = 'wss://eventsub.wss.twitch.tv/ws';
    let ws = null;
    let sessionId = null;
    let keepaliveTimer = null;

    async function getToken(forceRefresh = false) {
        return TwitchTokenManager.getAccessToken({
            clientId: twitchClientId,
            clientSecret: twitchClientSecret,
            seedAccessToken: userAccessToken,
            seedRefreshToken: userRefreshToken,
            forceRefresh,
        });
    }

    async function createSubscription(type, version, condition, attempt = 0) {
        const token = await getToken();
        const res = await fetch('https://api.twitch.tv/helix/eventsub/subscriptions', {
            method: 'POST',
            headers: {
                'Client-Id': twitchClientId,
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                type,
                version,
                condition,
                transport: { method: 'websocket', session_id: sessionId },
            }),
        });

        if (res.status === 401 && attempt === 0) {
            await getToken(/* forceRefresh */ true);
            return createSubscription(type, version, condition, attempt + 1);
        }

        if (!res.ok) {
            const body = await res.text().catch(() => '');
            console.error(`Twitch EventSub: failed to subscribe to ${type} (${res.status})`, body);
            return;
        }
    }

    function subscribeAll() {
        createSubscription('channel.channel_points_custom_reward_redemption.add', '1', {
            broadcaster_user_id: broadcasterUserId,
        });
        createSubscription('channel.chat.notification', '1', {
            broadcaster_user_id: broadcasterUserId,
            user_id: broadcasterUserId, // Read chat as the broadcaster (whose token we hold).
        });
    }

    function handleRedemption(event) {
        onRedeem && onRedeem({
            displayName: event.user_name,
            rewardTitle: event.reward && event.reward.title,
            userInput: event.user_input || '',
            cost: event.reward && event.reward.cost,
        });
    }

    function handleChatNotification(event) {
        if (event.notice_type !== 'watch_streak' || !event.watch_streak) return;
        onWatchStreak && onWatchStreak({
            displayName: event.chatter_user_name,
            streakCount: event.watch_streak.streak_count,
        });
    }

    function handleNotification(payload) {
        const type = payload.subscription && payload.subscription.type;
        const event = payload.event;
        if (!event) return;

        if (type === 'channel.channel_points_custom_reward_redemption.add') {
            handleRedemption(event);
        } else if (type === 'channel.chat.notification') {
            handleChatNotification(event);
        }
    }

    function connect(url = EVENTSUB_WS_URL) {
        const socket = new WebSocket(url);

        socket.addEventListener('message', (evt) => {
            let payload;
            try {
                payload = JSON.parse(evt.data);
            } catch (err) {
                return;
            }

            const metadata = payload.metadata || {};

            if (metadata.message_type === 'session_welcome') {
                sessionId = payload.payload.session.id;
                ws = socket;
                subscribeAll();
            } else if (metadata.message_type === 'session_keepalive') {
                // No-op — just confirms the connection is alive.
            } else if (metadata.message_type === 'notification') {
                handleNotification(payload.payload);
            } else if (metadata.message_type === 'session_reconnect') {
                const reconnectUrl = payload.payload.session.reconnect_url;
                connect(reconnectUrl);
            } else if (metadata.message_type === 'revocation') {
                console.warn('Twitch EventSub: subscription revoked', payload.payload);
            }
        });

        socket.addEventListener('close', () => {
            if (ws === socket) {
                ws = null;
                console.warn('Twitch EventSub: disconnected, reconnecting in 3s...');
                setTimeout(() => connect(), 3000);
            }
        });

        socket.addEventListener('error', (err) => {
            console.error('Twitch EventSub: connection error', err);
        });
    }

    connect();
}
