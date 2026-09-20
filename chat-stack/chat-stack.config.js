// Chat Stack overlay configuration.
//
// This is the only file you should need to edit day to day. The actual
// behavior lives in chat-stack.js, which loads before this file.

initChatStack({
    channel: 'humboshot',
    twitchUserId: '40262155',
    twitchClientId: typeof TWITCH_CLIENT_ID !== 'undefined' ? TWITCH_CLIENT_ID : '',
    twitchClientSecret: typeof TWITCH_CLIENT_SECRET !== 'undefined' ? TWITCH_CLIENT_SECRET : '',

    // How long, in ms, each message stays on screen before it fades away.
    // Set this to 0 to disable auto-disappear completely. Messages then
    // stay on screen forever. They get pushed out only once more than
    // `maxVisible` (below) new messages arrive after them.
    displayDuration: 0,

    // This is a hard cap on how many messages can stack at once. Once the
    // count goes over this cap, the oldest message is removed to make room,
    // regardless of displayDuration.
    maxVisible: 25,

    // Drop messages that start with "!" (bot commands) to reduce noise.
    hideCommands: false,
});
