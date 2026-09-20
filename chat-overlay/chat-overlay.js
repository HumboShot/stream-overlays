// Chat Overlay: merges chat-stack, chat-popup, and chat-latest into one
// page and OBS Browser Source. All three layouts run at the same time. Each one keeps
// receiving every chat message and event in the background, but only one layout is
// visible at a time (see setActiveLayout() and the CSS .is-active class). The current OBS scene name
// drives which layout is active, through obs-websocket (see
// shared/obs-websocket-client.js). If obs-websocket is not
// reachable or configured, the overlay falls back to `defaultLayout`.
//
// On top of chat (through shared/twitch-chat.js, same as before), this file also
// connects to Twitch EventSub (shared/twitch-eventsub.js) to show channel
// point redeems and watch-streak notifications inline. These show as distinct
// "system" rows (see .row.is-event in chat-overlay.css).
//
// To change the channel, timings, or scene-name mapping, edit the config passed
// to initChatOverlay() in chat-overlay.config.js.

function initChatOverlay({
    channel,
    twitchUserId,             // Numeric Twitch user ID. Also used as the EventSub broadcaster_user_id.
    twitchClientId,
    twitchClientSecret,
    twitchUserAccessToken,    // Seed user access token (scopes: channel:read:redemptions, user:read:chat).
    twitchUserRefreshToken,   // Seed user refresh token.
    hideCommands = true,

    stack = {},               // { displayDuration = 0, maxVisible = 25 }
    popup = {},               // { displayDuration = 6000, maxVisible = 12 }
    latest = {},              // { displayDuration = 10000 }

    defaultLayout = 'stack',  // Used until obs-websocket reports the current scene.
    enableSceneSwitching = true,
    obsWebSocketUrl = 'ws://localhost:4455',
    obsWebSocketPassword = '',
    // Maps a layout name to the list of exact OBS scene names (case-insensitive)
    // that activate it.
    sceneLayoutNames = { stack: [], popup: [], latest: [] },
    // Shown whenever obs-websocket reports a scene that is not listed in
    // sceneLayoutNames above.
    unrecognizedSceneLayout = 'latest',
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

    // Small badge shown only while the obs-websocket connection is down. Scene-based
    // layout switching may be stale or stuck until the connection reconnects.
    const obsStatusEl = document.getElementById('obs-status');

    function setObsStatus(status) {
        if (!obsStatusEl) return;
        obsStatusEl.classList.toggle('is-visible', status === 'disconnected');
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
            void box.offsetWidth; // Force a reflow, so the transition retriggers on back-to-back messages.
            box.classList.add('is-visible');

            expireTimer = setTimeout(() => {
                box.classList.remove('is-visible');
            }, latestConfig.displayDuration);
        }

        // Runs whenever this layout becomes the active one. The fade-out
        // timer above keeps running in real time, even while the layout is hidden. So by
        // the time a scene switch activates this layout, the last message may have
        // already faded. This function re-shows the message and restarts the timer, so switching
        // scenes always shows the most recent message instead of a
        // stale, blank box.
        function activate() {
            if (!box.hasChildNodes()) return;
            clearTimeout(expireTimer);
            box.classList.remove('is-visible');
            void box.offsetWidth;
            box.classList.add('is-visible');

            expireTimer = setTimeout(() => {
                box.classList.remove('is-visible');
            }, latestConfig.displayDuration);
        }

        return { spawn, activate };
    }

    const stackLayout = initStackLayout();
    const popupLayout = initPopupLayout();
    const latestLayout = initLatestLayout();

    function broadcast(rowHtml, extraClass, isChatRow) {
        stackLayout.spawn(rowHtml, extraClass, isChatRow);
        popupLayout.spawn(rowHtml, extraClass, isChatRow);
        latestLayout.spawn(rowHtml, extraClass, isChatRow);
    }

    if (enableSceneSwitching) {
        connectObsWebSocket({
            url: obsWebSocketUrl,
            password: obsWebSocketPassword,
            onSceneChanged: (sceneName) => {
                const lower = sceneName.toLowerCase();
                const match = Object.keys(sceneLayoutNames)
                    .find((layout) => sceneLayoutNames[layout].some((name) => name.toLowerCase() === lower));
                const layoutName = match || unrecognizedSceneLayout;
                setActiveLayout(layoutName);
                if (layoutName === 'latest') latestLayout.activate();
            },
            onStatusChange: setObsStatus,
        });
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
