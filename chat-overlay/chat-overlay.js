// Chat Overlay — merges chat-stack, chat-popup, and chat-latest into one
// page/OBS Browser Source. All three layouts run simultaneously (each keeps
// receiving every chat message + event in the background), but only one is
// visible at a time — see setActiveLayout()/CSS .is-active. Which layout is
// active is driven by the current OBS scene name via obs-websocket (see
// shared/obs-websocket-client.js), falling back to `defaultLayout` if
// obs-websocket isn't reachable/configured.
//
// On top of chat (via shared/twitch-chat.js, same as before), this also
// connects to Twitch EventSub (shared/twitch-eventsub.js) to show channel
// point redeems and watch-streak notifications inline, styled as distinct
// "system" rows (see .row.is-event in chat-overlay.css).
//
// Edit the config passed to initChatOverlay() in chat-overlay.config.js to
// change the channel, timings, scene-name mapping, etc.

function initChatOverlay({
    channel,
    twitchUserId,             // Numeric Twitch user ID (also used as EventSub broadcaster_user_id).
    twitchClientId,
    twitchClientSecret,
    twitchUserAccessToken,    // Seed user access token (scopes: channel:read:redemptions, user:read:chat).
    twitchUserRefreshToken,   // Seed user refresh token.
    hideCommands = true,

    stack = {},               // { displayDuration = 0, maxVisible = 25 }
    popup = {},               // { displayDuration = 6000, maxVisible = 12 }
    latest = {},              // { displayDuration = 10000 }

    defaultLayout = 'stack',  // Used until/unless obs-websocket tells us the current scene.
    enableSceneSwitching = true,
    obsWebSocketUrl = 'ws://localhost:4455',
    obsWebSocketPassword = '',
    // Maps a layout name to a lowercase keyword matched against the current
    // OBS scene name (substring match) to decide which layout to show.
    sceneLayoutKeywords = { stack: 'stack', popup: 'popup', latest: 'latest' },
} = {}) {
    const stackConfig = { displayDuration: 0, maxVisible: 25, ...stack };
    const popupConfig = { displayDuration: 6000, maxVisible: 12, ...popup };
    const latestConfig = { displayDuration: 10000, ...latest };

    // -----------------------------------------------------------------
    // LAYOUT VISIBILITY
    // -----------------------------------------------------------------
    const layoutEls = {
        stack: document.getElementById('layout-stack'),
        popup: document.getElementById('layout-popup'),
        latest: document.getElementById('layout-latest'),
    };

    function setActiveLayout(name) {
        if (!layoutEls[name]) return;
        for (const key of Object.keys(layoutEls)) {
            layoutEls[key].classList.toggle('is-active', key === name);
        }
    }

    setActiveLayout(defaultLayout);

    if (enableSceneSwitching) {
        connectObsWebSocket({
            url: obsWebSocketUrl,
            password: obsWebSocketPassword,
            onSceneChanged: (sceneName) => {
                const lower = sceneName.toLowerCase();
                const match = Object.keys(sceneLayoutKeywords)
                    .find((layout) => lower.includes(sceneLayoutKeywords[layout].toLowerCase()));
                if (match) setActiveLayout(match);
            },
        });
    }

    // -----------------------------------------------------------------
    // ROW MARKUP BUILDERS
    // -----------------------------------------------------------------
    function buildChatRowHtml(displayName, color, messageHtml, badgesHtml) {
        return `${badgesHtml}<span class="user" style="color: ${color};">${escapeHtml(displayName)}:</span> <span class="message">${messageHtml}</span>`;
    }

    function buildEventRowHtml(icon, title, detail) {
        const detailHtml = detail ? `<span class="event-detail">${escapeHtml(detail)}</span>` : '';
        return `<span class="event-icon">${icon}</span><span class="event-title">${escapeHtml(title)}</span>${detailHtml}`;
    }

    // -----------------------------------------------------------------
    // LAYOUT: STACK
    // -----------------------------------------------------------------
    function initStackLayout() {
        const feed = document.getElementById('chat-feed');
        const activeMessages = [];

        function removeMessage(message) {
            if (!message || !message.isConnected || message.classList.contains('is-leaving')) return;
            clearTimeout(message._expireTimer);
            message.classList.remove('is-entering');
            message.classList.add('is-leaving');
            message.addEventListener('animationend', () => {
                message.remove();
                const idx = activeMessages.indexOf(message);
                if (idx !== -1) activeMessages.splice(idx, 1);
            }, { once: true });
        }

        function spawn(rowHtml, extraClass, isChatRow) {
            const message = document.createElement('div');
            message.className = `chat-message is-entering${extraClass ? ` ${extraClass}` : ''}`;

            const row = document.createElement('div');
            row.className = `row${extraClass ? ` ${extraClass}` : ''}`;
            row.innerHTML = rowHtml;
            if (isChatRow) markSoloEmote(row);
            message.appendChild(row);

            feed.prepend(message);
            activeMessages.unshift(message);

            if (activeMessages.length > stackConfig.maxVisible) {
                removeMessage(activeMessages[activeMessages.length - 1]);
            }

            if (stackConfig.displayDuration > 0) {
                message._expireTimer = setTimeout(() => removeMessage(message), stackConfig.displayDuration);
            }
        }

        return { spawn };
    }

    // -----------------------------------------------------------------
    // LAYOUT: POPUP
    // -----------------------------------------------------------------
    function initPopupLayout() {
        const layer = document.getElementById('popup-layer');
        const activeToasts = [];

        function randomPercent(min, max) {
            return Math.random() * (max - min) + min;
        }

        function removeToast(toast) {
            if (!toast || !toast.isConnected || toast.classList.contains('is-leaving')) return;
            clearTimeout(toast._expireTimer);
            toast.classList.remove('is-entering');
            toast.classList.add('is-leaving');
            toast.addEventListener('animationend', () => {
                toast.remove();
                const idx = activeToasts.indexOf(toast);
                if (idx !== -1) activeToasts.splice(idx, 1);
            }, { once: true });
        }

        function spawn(rowHtml, extraClass, isChatRow) {
            const toast = document.createElement('div');
            toast.className = `chat-toast is-entering${extraClass ? ` ${extraClass}` : ''}`;
            toast.style.left = `${randomPercent(10, 90)}%`;
            toast.style.top = `${randomPercent(10, 90)}%`;

            const row = document.createElement('div');
            row.className = `row${extraClass ? ` ${extraClass}` : ''}`;
            row.innerHTML = rowHtml;
            if (isChatRow) markSoloEmote(row);
            toast.appendChild(row);

            layer.appendChild(toast);
            activeToasts.push(toast);

            if (activeToasts.length > popupConfig.maxVisible) {
                removeToast(activeToasts[0]);
            }

            toast._expireTimer = setTimeout(() => removeToast(toast), popupConfig.displayDuration);
        }

        return { spawn };
    }

    // -----------------------------------------------------------------
    // LAYOUT: LATEST
    // -----------------------------------------------------------------
    function initLatestLayout() {
        const box = document.getElementById('latest-message');
        let expireTimer = null;

        function spawn(rowHtml, extraClass, isChatRow) {
            clearTimeout(expireTimer);

            const row = document.createElement('div');
            row.className = `row${extraClass ? ` ${extraClass}` : ''}`;
            row.innerHTML = rowHtml;
            if (isChatRow) markSoloEmote(row);
            box.replaceChildren(row);

            box.className = extraClass ? extraClass : '';
            box.classList.remove('is-visible');
            void box.offsetWidth; // Force reflow so the transition retriggers on back-to-back messages.
            box.classList.add('is-visible');

            expireTimer = setTimeout(() => {
                box.classList.remove('is-visible');
            }, latestConfig.displayDuration);
        }

        return { spawn };
    }

    const stackLayout = initStackLayout();
    const popupLayout = initPopupLayout();
    const latestLayout = initLatestLayout();

    function broadcast(rowHtml, extraClass, isChatRow) {
        stackLayout.spawn(rowHtml, extraClass, isChatRow);
        popupLayout.spawn(rowHtml, extraClass, isChatRow);
        latestLayout.spawn(rowHtml, extraClass, isChatRow);
    }

    // -----------------------------------------------------------------
    // TWITCH CHAT (anonymous IRC — same as before)
    // -----------------------------------------------------------------
    connectTwitchChat({
        channel,
        twitchUserId,
        twitchClientId,
        twitchClientSecret,
        hideCommands,
        onMessage: (displayName, color, html, badgesHtml) => {
            broadcast(buildChatRowHtml(displayName, color, html, badgesHtml), '', true);
        },
    });

    // -----------------------------------------------------------------
    // TWITCH EVENTSUB (channel point redeems + watch streaks)
    // -----------------------------------------------------------------
    connectTwitchEvents({
        broadcasterUserId: twitchUserId,
        twitchClientId,
        twitchClientSecret,
        userAccessToken: twitchUserAccessToken,
        userRefreshToken: twitchUserRefreshToken,
        onRedeem: ({ displayName, rewardTitle }) => {
            broadcast(buildEventRowHtml('🔔', `${displayName} redeemed ${rewardTitle}`), 'is-event is-event-redeem', false);
        },
        onWatchStreak: ({ displayName, streakCount }) => {
            broadcast(buildEventRowHtml('🔥', `${displayName} is on a ${streakCount}-stream watch streak!`), 'is-event is-event-streak', false);
        },
    });
}
