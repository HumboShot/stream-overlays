// Chat Latest overlay — uses the shared Twitch chat engine (../shared/twitch-chat.js)
// to connect read-only to Twitch chat and resolve emotes, then shows only the
// single most recent message in the top-right corner, auto-hiding it again
// after `displayDuration`.
//
// Edit the config passed to initChatLatest() at the bottom of this file to
// change the channel, timing, or command behavior.

function initChatLatest({
    channel,
    twitchUserId,            // Numeric Twitch user ID, needed to query 7TV/BTTV for this channel's
                              // emotes (their APIs key channel lookups by ID, not login). This is
                              // public info, not a secret — safe to hardcode like the channel name.
    twitchClientId,          // Twitch API Client ID, used with the secret to fetch badges.
    twitchClientSecret,      // Twitch API Client Secret, used to mint a badge-fetch token.
    displayDuration = 10000, // <-- How long (ms) the message stays on screen before it disappears.
                              //     Change this one value to make it disappear sooner/later.
    hideCommands = true,     // Drop messages that start with "!" (bot commands) to reduce noise.
} = {}) {
    const box = document.getElementById('latest-message');
    let expireTimer = null;

    function showMessage(displayName, color, messageHtml, badgesHtml) {
        clearTimeout(expireTimer);

        const row = document.createElement('div');
        row.className = 'row';
        row.innerHTML = `${badgesHtml}<span class="user" style="color: ${color};">${escapeHtml(displayName)}:</span> <span class="message">${messageHtml}</span>`;
        markSoloEmote(row);
        box.replaceChildren(row);

        // Remove both state classes and force a reflow before re-adding
        // .is-visible, so the fade/slide-in transition retriggers even when
        // a new message arrives back-to-back while the previous one is
        // still showing (or mid fade-out).
        box.classList.remove('is-visible');
        void box.offsetWidth;
        box.classList.add('is-visible');

        expireTimer = setTimeout(() => {
            box.classList.remove('is-visible');
        }, displayDuration);
    }

    connectTwitchChat({
        channel,
        twitchUserId,
        twitchClientId,
        twitchClientSecret,
        hideCommands,
        onMessage: showMessage,
    });
}

initChatLatest({
    channel: 'humboshot',
    twitchUserId: '40262155',
    twitchClientId: typeof TWITCH_CLIENT_ID !== 'undefined' ? TWITCH_CLIENT_ID : '',
    twitchClientSecret: typeof TWITCH_CLIENT_SECRET !== 'undefined' ? TWITCH_CLIENT_SECRET : '',
    displayDuration: 10000,
});
