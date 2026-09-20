// Chat Stack overlay. Uses the shared Twitch chat engine (../shared/twitch-chat.js)
// to connect read-only to Twitch chat and resolve emotes. It then renders each
// new message as a bubble stacked at the bottom of the canvas. The newest bubble
// sits at the bottom and pushes older ones upward, like a normal chat log.
//
// This file only defines the behavior. Edit chat-stack.config.js, which loads
// after this file, to change the channel, timings, or command behavior.

function initChatStack({
    channel,
    twitchUserId,            // Numeric Twitch user ID, needed to query 7TV/BTTV for this channel's
                              // emotes, because their APIs key channel lookups by ID, not login. This ID is
                              // public info, not a secret. It is safe to hardcode, like the channel name.
    twitchClientId,          // Twitch API Client ID, used with the secret to fetch badges.
    twitchClientSecret,      // Twitch API Client Secret, used to mint a badge-fetch token.
    displayDuration = 10000, // How long, in ms, each message stays on screen before it fades away.
                              // Set this to 0 to disable auto-disappear completely. Messages then only
                              // get removed once newer messages push the count past `maxVisible`.
    maxVisible = 10,         // Hard cap on stacked messages, so the feed does not grow forever.
    hideCommands = true,     // Drop messages that start with "!" (bot commands) to reduce noise.
} = {}) {
    const feed = document.getElementById('chat-feed');
    const activeMessages = []; // Index 0 is the newest; the last index is the oldest (see spawnMessage below).

    // ---------------------------------------------------------------------
    // MESSAGE LIFECYCLE
    // Each message becomes its own bubble, inserted at the front of
    // #chat-feed. Combined with `flex-direction: column-reverse` in
    // chat-stack.css, this places the newest message at the bottom of the
    // stack, and pushes older ones upward. Each bubble fades in, holds for
    // `displayDuration` (unless it is 0, see below), then fades out and
    // is removed from the DOM. `maxVisible` force-expires the oldest message if
    // chat is too busy, or if displayDuration is 0 and the feed would
    // otherwise grow forever.
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

    function spawnMessage(displayName, color, messageHtml, badgesHtml) {
        const message = document.createElement('div');
        message.className = 'chat-message is-entering';

        const row = document.createElement('div');
        row.className = 'row';
        row.innerHTML = `${badgesHtml}<span class="user" style="color: ${color};">${escapeHtml(displayName)}:</span> <span class="message">${messageHtml}</span>`;
        markSoloEmote(row);
        message.appendChild(row);

        // The newest message always goes in as the first child. With
        // flex-direction: column-reverse (chat-stack.css), this renders it at
        // the bottom of the feed, and pushes existing messages upward.
        feed.prepend(message);
        activeMessages.unshift(message);

        if (activeMessages.length > maxVisible) {
            removeMessage(activeMessages[activeMessages.length - 1]);
        }

        // displayDuration === 0 means "never auto-disappear". The message
        // then leaves only once newer ones push the count past maxVisible.
        if (displayDuration > 0) {
            message._expireTimer = setTimeout(() => removeMessage(message), displayDuration);
        }
    }

    connectTwitchChat({
        channel,
        twitchUserId,
        twitchClientId,
        twitchClientSecret,
        hideCommands,
        onMessage: spawnMessage,
    });
}

