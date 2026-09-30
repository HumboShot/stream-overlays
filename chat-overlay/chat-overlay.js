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
// "system" rows (see .row.is-event in chat-overlay.css). Twitch polls show
// in a separate #poll-panel, which is visible in every layout (see initPollPanel()).
//
// To change the channel, timings, or scene-name mapping, edit the config passed
// to initChatOverlay() in chat-overlay.config.js.

function initChatOverlay({
    channel,
    twitchUserId,             // Numeric Twitch user ID. Also used as the EventSub broadcaster_user_id.
    twitchClientId,
    twitchClientSecret,
    twitchUserAccessToken,    // Seed user access token (scopes: channel:read:redemptions, user:read:chat, channel:read:polls).
    twitchUserRefreshToken,   // Seed user refresh token.
    hideCommands = true,

    stack = {},               // { displayDuration = 0, maxVisible = 25 }
    popup = {},               // { displayDuration = 6000, maxVisible = 12 }
    latest = {},              // { displayDuration = 10000 }
    poll = {},                // { resultDuration = 15000 }

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
    const pollConfig = { resultDuration: 15000, ...poll };

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

    // Pixel-art event icons on the same 10x10 grid as the poll icon in
    // chat-overlay.html. The shapes use currentColor, so CSS sets the color per event type.
    const PIXEL_ICONS = {
        bell: '<svg viewBox="0 0 10 10" shape-rendering="crispEdges" aria-hidden="true">'
            + '<rect x="4" y="0" width="2" height="1" />'
            + '<rect x="3" y="1" width="4" height="1" />'
            + '<rect x="2" y="2" width="6" height="4" />'
            + '<rect x="1" y="6" width="8" height="1" />'
            + '<rect x="0" y="7" width="10" height="1" />'
            + '<rect x="4" y="9" width="2" height="1" />'
            + '</svg>',
        flame: '<svg viewBox="0 0 10 10" shape-rendering="crispEdges" aria-hidden="true">'
            + '<rect x="4" y="0" width="1" height="1" />'
            + '<rect x="4" y="1" width="2" height="1" />'
            + '<rect x="3" y="2" width="3" height="1" />'
            + '<rect x="3" y="3" width="4" height="1" />'
            + '<rect x="2" y="4" width="5" height="1" />'
            + '<rect x="2" y="5" width="6" height="1" />'
            + '<rect x="1" y="6" width="8" height="2" />'
            + '<rect x="2" y="8" width="6" height="1" />'
            + '<rect x="3" y="9" width="4" height="1" />'
            + '<g class="icon-core">'
            + '<rect x="4" y="5" width="1" height="1" />'
            + '<rect x="4" y="6" width="2" height="1" />'
            + '<rect x="3" y="7" width="4" height="1" />'
            + '<rect x="4" y="8" width="2" height="1" />'
            + '</g>'
            + '</svg>',
    };

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
        let expiresAt = 0;

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

            expiresAt = Date.now() + latestConfig.displayDuration;
            expireTimer = setTimeout(() => {
                box.classList.remove('is-visible');
            }, latestConfig.displayDuration);
        }

        // Runs whenever this layout becomes the active one. The fade-out timer keeps
        // running in real time while the layout is hidden. If the message is still inside
        // its display time, replay the fade-in but keep the original expiry. If the time
        // is over, the box stays empty, so an old message does not come back.
        function activate() {
            if (!box.hasChildNodes() || Date.now() >= expiresAt) return;
            box.classList.remove('is-visible');
            void box.offsetWidth;
            box.classList.add('is-visible');
        }

        return { spawn, activate };
    }

    // -----------------------------------------------------------------
    // POLL PANEL
    // This panel is not a layout. It stays visible in every scene while a
    // poll runs, and for resultDuration after it ends.
    // -----------------------------------------------------------------
    function initPollPanel() {
        const panel = document.getElementById('poll-panel');
        const titleEl = panel.querySelector('.poll-title');
        const choicesEl = panel.querySelector('.poll-choices');
        const statusEl = panel.querySelector('.poll-status');
        const totalEl = panel.querySelector('.poll-total');
        let currentId = null;
        let endsAt = null;
        let countdownTimer = null;
        let hideTimer = null;

        function formatRemaining(ms) {
            const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
            const minutes = Math.floor(totalSeconds / 60);
            const seconds = totalSeconds % 60;
            return `${minutes}:${String(seconds).padStart(2, '0')}`;
        }

        function tickCountdown() {
            statusEl.textContent = endsAt ? formatRemaining(endsAt - Date.now()) : '';
        }

        function stopCountdown() {
            clearInterval(countdownTimer);
            countdownTimer = null;
        }

        function hide() {
            stopCountdown();
            clearTimeout(hideTimer);
            panel.classList.remove('is-visible');
            currentId = null;
        }

        function render(choices, isEnded) {
            const total = choices.reduce((sum, c) => sum + c.votes, 0);
            const topVotes = Math.max(0, ...choices.map((c) => c.votes));

            // Reuse the existing rows while the same poll runs, so the bar width
            // animates between progress events instead of jumping.
            if (choicesEl.children.length !== choices.length) {
                choicesEl.innerHTML = choices.map(() => '<div class="poll-choice">'
                    + '<div class="poll-bar"></div>'
                    + '<span class="poll-choice-title"></span>'
                    + '<span class="poll-choice-percent"></span>'
                    + '</div>').join('');
            }

            choices.forEach((c, i) => {
                const row = choicesEl.children[i];
                const percent = total > 0 ? Math.round((c.votes / total) * 100) : 0;
                row.classList.toggle('is-winner', isEnded && topVotes > 0 && c.votes === topVotes);
                row.querySelector('.poll-bar').style.width = `${percent}%`;
                row.querySelector('.poll-choice-title').textContent = c.title;
                row.querySelector('.poll-choice-percent').textContent = `${percent}%`;
            });

            totalEl.textContent = `${total} vote${total === 1 ? '' : 's'}`;
        }

        function update({ phase, id, title, choices, endsAt: pollEndsAt, status }) {
            // "archived" means the broadcaster removed the poll, so there is nothing to show.
            if (phase === 'end' && status === 'archived') {
                if (id === currentId) hide();
                return;
            }

            clearTimeout(hideTimer);
            if (id !== currentId) choicesEl.replaceChildren();
            currentId = id;
            titleEl.textContent = title;
            render(choices, phase === 'end');
            panel.classList.toggle('is-ended', phase === 'end');
            panel.classList.add('is-visible');

            if (phase === 'end') {
                stopCountdown();
                statusEl.textContent = status === 'terminated' ? 'Poll ended early' : 'Poll ended';
                hideTimer = setTimeout(hide, pollConfig.resultDuration);
            } else if (endsAt !== pollEndsAt || !countdownTimer) {
                endsAt = pollEndsAt;
                stopCountdown();
                tickCountdown();
                countdownTimer = setInterval(tickCountdown, 1000);
            }
        }

        return { update };
    }

    const pollPanel = initPollPanel();
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
            broadcast(buildEventRowHtml(PIXEL_ICONS.bell, `${displayName} redeemed ${rewardTitle}`), 'is-event is-event-redeem', false);
        },
        onWatchStreak: ({ displayName, streakCount }) => {
            broadcast(buildEventRowHtml(PIXEL_ICONS.flame, `${displayName} is on a ${streakCount}-stream watch streak!`), 'is-event is-event-streak', false);
        },
        onPoll: pollPanel.update,
    });
}
