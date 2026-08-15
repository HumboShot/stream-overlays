// Chat Popup overlay — uses the shared Twitch chat engine (../shared/twitch-chat.js)
// to connect read-only to Twitch chat and resolve emotes, then renders each
// new message as its own terminal-style "toast" that pops up at a random
// spot on the canvas, holds for a bit, then fades away.
//
// Edit the config passed to initChatPopup() at the bottom of this file to
// change the channel, timings, or command behavior.

function initChatPopup({
    channel,
    twitchUserId,           // Numeric Twitch user ID, needed to query 7TV/BTTV for this channel's
                             // emotes (their APIs key channel lookups by ID, not login). This is
                             // public info, not a secret — safe to hardcode like the channel name.
    displayDuration = 6000, // How long a toast stays fully visible before it starts fading out.
    maxVisible = 12,        // Hard cap on simultaneous toasts so a busy chat doesn't pile up forever.
    hideCommands = true,    // Drop messages that start with "!" (bot commands) to reduce noise.
} = {}) {
    const layer = document.getElementById('popup-layer');
    const activeToasts = [];

    function randomPercent(min, max) {
        return Math.random() * (max - min) + min;
    }

    // ---------------------------------------------------------------------
    // TOAST LIFECYCLE
    // Each message becomes its own absolutely-positioned box at a random
    // spot on the canvas (see .chat-toast in chat-popup.css), fades in,
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

    function spawnToast(displayName, color, messageHtml) {
        const toast = document.createElement('div');
        toast.className = 'chat-toast is-entering';
        toast.style.left = `${randomPercent(10, 90)}%`;
        toast.style.top = `${randomPercent(10, 90)}%`;

        const row = document.createElement('div');
        row.className = 'row';
        row.innerHTML = `<span class="user" style="color: ${color};">${escapeHtml(displayName)}:</span> <span class="message">${messageHtml}</span>`;
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
        hideCommands,
        onMessage: spawnToast,
    });
}

initChatPopup({
    channel: 'humboshot',
    twitchUserId: '40262155',
});
