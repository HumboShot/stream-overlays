// Chat Overlay configuration.
//
// This is the only file you should need to edit day to day. The actual
// behavior lives in chat-overlay.js, which loads before this file.

initChatOverlay({
    channel: 'humboshot',
    twitchUserId: '40262155',
    twitchClientId: typeof TWITCH_CLIENT_ID !== 'undefined' ? TWITCH_CLIENT_ID : '',
    twitchClientSecret: typeof TWITCH_CLIENT_SECRET !== 'undefined' ? TWITCH_CLIENT_SECRET : '',
    twitchUserAccessToken: typeof TWITCH_USER_ACCESS_TOKEN !== 'undefined' ? TWITCH_USER_ACCESS_TOKEN : '',
    twitchUserRefreshToken: typeof TWITCH_USER_REFRESH_TOKEN !== 'undefined' ? TWITCH_USER_REFRESH_TOKEN : '',

    // Drop messages that start with "!" (bot commands) to reduce noise.
    hideCommands: false,

    // Per-layout settings.
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

    // The poll panel shows in every layout while a Twitch poll runs.
    // resultDuration is how long the final result stays visible after the poll ends.
    poll: {
        resultDuration: 15000,
    },

    // This layout shows before obs-websocket reports a scene, or if
    // scene switching is disabled or unreachable.
    defaultLayout: 'stack',

    // Set this to false if you do not have obs-websocket enabled, and want to
    // pick a layout manually with defaultLayout above. This also avoids console spam
    // from failed reconnect attempts.
    enableSceneSwitching: true,
    obsWebSocketUrl: 'ws://localhost:4455',
    obsWebSocketPassword: typeof OBS_WEBSOCKET_PASSWORD !== 'undefined' ? OBS_WEBSOCKET_PASSWORD : '',

    // Maps a layout name to the exact OBS scene names (case-insensitive) that
    // activate it. Replace these placeholders with your actual scene names.
    sceneLayoutNames: {
        stack: ['Talking'],
        popup: ['Intro', 'AFK', "Ending"],
        latest: ['Gaming', '4:3 Gaming', 'Website Middle Showcase', 'Desktop', 'Display Capture Gaming'],
    },

    // Shown whenever obs-websocket reports a scene that is not listed above.
    unrecognizedSceneLayout: 'latest',
});
