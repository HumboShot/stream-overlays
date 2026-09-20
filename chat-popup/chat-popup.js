// Chat Popup overlay. Uses the shared Twitch chat engine (../shared/twitch-chat.js)
// to connect read-only to Twitch chat and resolve emotes. It then renders each
// new message as its own terminal-style "toast" that pops up at a random
// spot on the canvas, holds for a bit, then fades away.
//
// Edit the config passed to initChatPopup() at the bottom of this file to
// change the channel, timings, or command behavior.

function initChatPopup({
    channel,
    twitchUserId,           // Numeric Twitch user ID, needed to query 7TV/BTTV for this channel's
    // emotes, because their APIs key channel lookups by ID, not login. This ID is
    // public info, not a secret. It is safe to hardcode, like the channel name.
    twitchClientId,         // Twitch API Client ID, used with the secret to fetch badges.
    twitchClientSecret,     // Twitch API Client Secret, used to mint a badge-fetch token.
    displayDuration = 60000, // How long a toast stays fully visible before it starts to fade out.
    maxVisible = 25,        // Hard cap on toasts shown at once, so a busy chat does not pile up forever.
    hideCommands = true,    // Drop messages that start with "!" (bot commands) to reduce noise.
} = {}) {
    const layer = document.getElementById('popup-layer');
    const activeToasts = [];

    function randomPercent(min, max) {
        return Math.random() * (max - min) + min;
    }

    // ---------------------------------------------------------------------
    // TOAST LIFECYCLE
    // Each message becomes its own absolutely positioned box at a random
    // spot on the canvas (see .chat-toast in chat-popup.css). It fades in,
    // holds for `displayDuration`, then fades out and is removed from the
    // DOM. `maxVisible` force-expires the oldest toast if chat is too busy.
    // ---------------------------------------------------------------------
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

    function spawnToast(displayName, color, messageHtml, badgesHtml) {
        const toast = document.createElement('div');
        toast.className = 'chat-toast is-entering';
        toast.style.left = `${randomPercent(10, 90)}%`;
        toast.style.top = `${randomPercent(10, 90)}%`;

        const row = document.createElement('div');
        row.className = 'row';
        row.innerHTML = `${badgesHtml}<span class="user" style="color: ${color};">${escapeHtml(displayName)}:</span> <span class="message">${messageHtml}</span>`;
        markSoloEmote(row);
        toast.appendChild(row);

        layer.appendChild(toast);
        activeToasts.push(toast);

        if (activeToasts.length > maxVisible) {
            removeToast(activeToasts[0]);
        }

        toast._expireTimer = setTimeout(() => removeToast(toast), displayDuration);
    }

    connectTwitchChat({
        channel,
        twitchUserId,
        twitchClientId,
        twitchClientSecret,
        hideCommands,
        onMessage: spawnToast,
    });
}

initChatPopup({
    channel: 'humboshot',
    twitchUserId: '40262155',
    twitchClientId: typeof TWITCH_CLIENT_ID !== 'undefined' ? TWITCH_CLIENT_ID : '',
    twitchClientSecret: typeof TWITCH_CLIENT_SECRET !== 'undefined' ? TWITCH_CLIENT_SECRET : '',
});
