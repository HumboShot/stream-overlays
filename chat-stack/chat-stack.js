// Chat Stack overlay — uses the shared Twitch chat engine (../shared/twitch-chat.js)
// to connect read-only to Twitch chat and resolve emotes, then renders each
// new message as a bubble stacked at the bottom of the canvas, newest at the
// bottom pushing older ones upward, like a normal chat log.
//
// This file only defines the behavior. Edit chat-stack.config.js (loaded
// after this file) to change the channel, timings, or command behavior.

function initChatStack({
    channel,
    twitchUserId,            // Numeric Twitch user ID, needed to query 7TV/BTTV for this channel's
                              // emotes (their APIs key channel lookups by ID, not login). This is
                              // public info, not a secret — safe to hardcode like the channel name.
    displayDuration = 10000, // How long (ms) each message stays on screen before it fades away.
                              // Set to 0 to disable auto-disappear entirely — messages then only
                              // get removed once `maxVisible` is exceeded by newer messages.
    maxVisible = 10,         // Hard cap on stacked messages so the feed doesn't grow forever.
    hideCommands = true,     // Drop messages that start with "!" (bot commands) to reduce noise.
} = {}) {
    const feed = document.getElementById('chat-feed');
    const activeMessages = []; // Index 0 = newest, last index = oldest (see spawnMessage below).

    // ---------------------------------------------------------------------
    // MESSAGE LIFECYCLE
    // Each message becomes its own bubble, inserted at the front of
    // #chat-feed. Combined with `flex-direction: column-reverse` in
    // chat-stack.css, that places the newest message at the BOTTOM of the
    // stack and pushes older ones upward. Fades in, holds for
    // `displayDuration` (unless it's 0, see below), then fades out and is
    // removed from the DOM. `maxVisible` force-expires the oldest message if
    // chat is too busy (or if displayDuration is 0 and the feed would
    // otherwise grow forever).
    // ---------------------------------------------------------------------
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

    function spawnMessage(displayName, color, messageHtml) {
        const message = document.createElement('div');
        message.className = 'chat-message is-entering';

        const row = document.createElement('div');
        row.className = 'row';
        row.innerHTML = `<span class="user" style="color: ${color};">${escapeHtml(displayName)}:</span> <span class="message">${messageHtml}</span>`;
        markSoloEmote(row);
        message.appendChild(row);

        // Newest message always goes in as the first child; with
        // flex-direction: column-reverse (chat-stack.css) that renders it at
        // the bottom of the feed, pushing existing messages upward.
        feed.prepend(message);
        activeMessages.unshift(message);

        if (activeMessages.length > maxVisible) {
            removeMessage(activeMessages[activeMessages.length - 1]);
        }

        // displayDuration === 0 means "never auto-disappear" — the message
        // then only ever leaves once maxVisible is exceeded by newer ones.
        if (displayDuration > 0) {
            message._expireTimer = setTimeout(() => removeMessage(message), displayDuration);
        }
    }

    connectTwitchChat({
        channel,
        twitchUserId,
        hideCommands,
        onMessage: spawnMessage,
    });
}

