// Chat Stack overlay — configuration.
//
// This is the only file you should need to edit day-to-day. The actual
// behavior lives in chat-stack.js (loaded before this file).

initChatStack({
    channel: 'humboshot',
    twitchUserId: '40262155',

    // How long (ms) each message stays on screen before it fades away.
    // Set this to 0 to disable auto-disappear entirely — messages will then
    // stay on screen forever, only getting pushed out once more than
    // `maxVisible` (below) new messages have arrived after them.
    displayDuration: 0,

    // Hard cap on how many messages can be stacked at once. Once exceeded,
    // the oldest message is removed to make room, regardless of
    // displayDuration.
    maxVisible: 25,

    // Drop messages that start with "!" (bot commands) to reduce noise.
    hideCommands: true,
});
