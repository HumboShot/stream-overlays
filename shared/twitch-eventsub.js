// This is the shared Twitch EventSub engine. It connects to the Twitch EventSub WebSocket
// gateway with a real user access token (see shared/twitch-token-manager.js)
// and subscribes to:
//   - channel.channel_points_custom_reward_redemption.add (needs channel:read:redemptions)
//   - channel.chat.notification, filtered to notice_type "watch_streak" (needs user:read:chat)
//   - channel.poll.begin / .progress / .end (needs channel:read:polls)
//
// Unlike shared/twitch-chat.js, which uses anonymous IRC with no auth, these events are
// available only through EventSub, which needs an authenticated
// user token. See shared/twitch-token-manager.js for how this code
// gets and refreshes that token without a backend server.
//
// Call connectTwitchEvents({...}) once per page. It calls back into
// onRedeem(...), onWatchStreak(...), and onPoll(...) for each qualifying event.

function connectTwitchEvents({
    broadcasterUserId,      // Numeric Twitch user ID of the channel to watch (same value as twitchUserId elsewhere).
    twitchClientId,         // Twitch API Client ID (shared/secrets.local.js).
    twitchClientSecret,     // Twitch API Client Secret, used only for refreshing the user token.
    userAccessToken,        // Seed user access token (shared/secrets.local.js), scopes: channel:read:redemptions, user:read:chat, channel:read:polls.
    userRefreshToken,       // Seed user refresh token (shared/secrets.local.js).
    onRedeem,               // ({ displayName, rewardTitle, userInput, cost }) => void
    onWatchStreak,          // ({ displayName, streakCount }) => void
    onPoll,                 // ({ phase: 'begin'|'progress'|'end', id, title, choices: [{ id, title, votes }], endsAt, status }) => void
    onStatusChange,         // ('connected' | 'disconnected') => void. Called once all subscriptions succeed, and again if the connection drops or a subscription fails.
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
            return false;
        }
        return true;
    }

    // The socket can be open while the subscriptions fail (for example, a bad
    // token). Then no alerts arrive, so report that as disconnected too.
    async function subscribeAll() {
        const results = await Promise.all([
            createSubscription('channel.channel_points_custom_reward_redemption.add', '1', {
                broadcaster_user_id: broadcasterUserId,
            }),
            createSubscription('channel.chat.notification', '1', {
                broadcaster_user_id: broadcasterUserId,
                user_id: broadcasterUserId, // Read chat as the broadcaster, since this code holds their token.
            }),
            ...['begin', 'progress', 'end'].map((phase) =>
                createSubscription(`channel.poll.${phase}`, '1', { broadcaster_user_id: broadcasterUserId })),
        ].map((p) => p.catch((err) => {
            console.error('Twitch EventSub: subscription error', err);
            return false;
        })));
        onStatusChange && onStatusChange(results.every(Boolean) ? 'connected' : 'disconnected');
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

    function handlePoll(phase, event) {
        onPoll && onPoll({
            phase,
            id: event.id,
            title: event.title,
            // channel.poll.begin sends choices without vote counts.
            choices: (event.choices || []).map((c) => ({ id: c.id, title: c.title, votes: c.votes || 0 })),
            endsAt: event.ends_at ? Date.parse(event.ends_at) : null,
            status: event.status || null, // Only on "end": completed, terminated, or archived.
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
        } else if (type && type.startsWith('channel.poll.')) {
            handlePoll(type.slice('channel.poll.'.length), event);
        }
    }

    function connect(url = EVENTSUB_WS_URL) {
        const socket = new WebSocket(url);
        // A session_reconnect URL keeps the existing subscriptions.
        const isReconnect = url !== EVENTSUB_WS_URL;
        let keepaliveSeconds = 10;
        let abandoned = false;

        // Twitch sends a keepalive when no other message was sent for
        // keepalive_timeout_seconds. If nothing arrives for longer than that, the
        // connection is dead, even if the socket has not closed. Then start a new one.
        function resetKeepalive() {
            clearTimeout(keepaliveTimer);
            keepaliveTimer = setTimeout(() => {
                if (ws !== socket) return;
                console.warn('Twitch EventSub: no keepalive, reconnecting...');
                onStatusChange && onStatusChange('disconnected');
                abandoned = true;
                ws = null;
                socket.close();
                connect();
            }, (keepaliveSeconds + 5) * 1000);
        }

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
                keepaliveSeconds = payload.payload.session.keepalive_timeout_seconds || keepaliveSeconds;
                ws = socket;
                if (!isReconnect) subscribeAll();
            } else if (metadata.message_type === 'session_keepalive') {
                // Does nothing here. resetKeepalive() below handles it.
            } else if (metadata.message_type === 'notification') {
                handleNotification(payload.payload);
            } else if (metadata.message_type === 'session_reconnect') {
                const reconnectUrl = payload.payload.session.reconnect_url;
                connect(reconnectUrl);
            } else if (metadata.message_type === 'revocation') {
                console.warn('Twitch EventSub: subscription revoked', payload.payload);
            }

            if (ws === socket) resetKeepalive();
        });

        socket.addEventListener('close', () => {
            if (abandoned) return;
            // Also reconnect if the first connection closes before its welcome message.
            if (ws === socket || (ws === null && !isReconnect)) {
                ws = null;
                clearTimeout(keepaliveTimer);
                console.warn('Twitch EventSub: disconnected, reconnecting in 3s...');
                onStatusChange && onStatusChange('disconnected');
                setTimeout(() => connect(), 3000);
            }
        });

        socket.addEventListener('error', (err) => {
            console.error('Twitch EventSub: connection error', err);
        });
    }

    connect();
}
