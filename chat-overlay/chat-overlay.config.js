// Chat Overlay — configuration.
//
// This is the only file you should need to edit day-to-day. The actual
// behavior lives in chat-overlay.js (loaded before this file).

initChatOverlay({
    channel: 'humboshot',
    twitchUserId: '40262155',
    twitchClientId: typeof TWITCH_CLIENT_ID !== 'undefined' ? TWITCH_CLIENT_ID : '',
    twitchClientSecret: typeof TWITCH_CLIENT_SECRET !== 'undefined' ? TWITCH_CLIENT_SECRET : '',
    twitchUserAccessToken: typeof TWITCH_USER_ACCESS_TOKEN !== 'undefined' ? TWITCH_USER_ACCESS_TOKEN : '',
    twitchUserRefreshToken: typeof TWITCH_USER_REFRESH_TOKEN !== 'undefined' ? TWITCH_USER_REFRESH_TOKEN : '',

    // Drop messages that start with "!" (bot commands) to reduce noise.
    hideCommands: false,

    // Per-layout settings — same options/defaults as the old
    // chat-stack.config.js / chat-popup.js / chat-latest.js.
    stack: {
        displayDuration: 0,   // 0 = never auto-disappear; only maxVisible expires messages.
        maxVisible: 25,
    },
    popup: {
        displayDuration: 6000,
        maxVisible: 12,
    },
    latest: {
        displayDuration: 10000,
    },

    // Which layout is shown before obs-websocket reports a scene (or if
    // scene switching is disabled/unreachable).
    defaultLayout: 'stack',

    // Set to false if you don't have obs-websocket enabled and just want to
    // pick a layout manually via defaultLayout above (avoids console spam
    // from failed reconnect attempts).
    enableSceneSwitching: true,
    obsWebSocketUrl: 'ws://localhost:4455',
    obsWebSocketPassword: typeof OBS_WEBSOCKET_PASSWORD !== 'undefined' ? OBS_WEBSOCKET_PASSWORD : '',

    // Maps a layout name to a keyword matched (case-insensitively, substring)
    // against your current OBS scene name. E.g. a scene named "Just Chatting
    // - Stack Chat" will match the "stack" layout. Update these to match
    // your actual scene names, or rename your scenes to contain these words.
    sceneLayoutKeywords: {
        stack: 'stack',
        popup: 'popup',
        latest: 'latest',
    },
});
