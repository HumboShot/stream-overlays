// Stream screen modes. Select a mode with the URL query, for example
// screen.html?mode=afk. Edit the messages array of a mode to change what
// shows on that screen.
const SCREEN_MODES = {
    starting: {
        pageTitle: 'Starting Soon Terminal',
        status: 'SYSTEM_ONLINE // CONNECTING...',
        title: 'STARTING_SOON',
        pauseTime: 8000,
        messages: [
            "You can type !vods to get a link to my vod channel if you want to watch a stream you missed",
            "You can also do !socials to find all the links to my socials",
            "Remember to follow if you want to be notified when I go live!",
            "The stream will be starting shortly. Grab a snack and get comfortable!",
            "Subscribing gives you access to exclusive emotes and helps support the stream. Every bit of support helps keep the stream running!",
            "Consider joining the discord server to chat with the community !dojo (It's very work in progress, so bear with us!)",
        ],
    },
    afk: {
        pageTitle: 'AFK Terminal',
        status: 'SYSTEM_IDLE // AWAITING_INPUT...',
        title: 'BE_RIGHT_BACK',
        pauseTime: 5000,
        messages: [
            "Operator is currently away from the terminal. Initiating standby protocols.",
            "Stretch your legs, grab a snack. We will resume shortly.",
            "Type !lurk in chat if you are stepping away as well. We'll be here when you get back.",
            "Check out !socials while you wait to stay connected to the network.",
            "Want to support the stream? Feel free to follow or subscribe! Every bit of support helps keep the stream running.",
            "Ads might play while you wait, but don't worry, we won't let them interrupt the stream. Just sit back and relax.",
            "Consider joining the discord server to chat with the community !dojo (It's very work in progress, so bear with us!)",
        ],
    },
    ending: {
        pageTitle: 'Ending Stream Terminal',
        status: 'SYSTEM_SHUTDOWN // DISCONNECTING...',
        title: 'STREAM_ENDING',
        pauseTime: 8000,
        messages: [
            "Initiating system shutdown sequence... Thank you for connecting.",
            "Network disconnect imminent. Please prepare for data stream termination.",
            "Catch the latest !vods if you missed any of today's transmissions.",
            "Access !socials to maintain connection to the community network offline.",
            "Off platform channels are up and running, check out the !dojo for more information",
        ],
    },
};

// Used when the URL has no mode, or an unknown mode.
const DEFAULT_SCREEN_MODE = 'starting';

// The sun and night cycle in the background follows the real sun at this
// location. It uses the clock of the PC that runs OBS.
const SKY_LATITUDE = 57.048663659757054;   // Degrees. North is positive, south is negative.
const SKY_LONGITUDE = 9.925509449727342;   // Degrees. East is positive, west is negative.

// 0 = follow the real time. Set a number of seconds to play one full day in
// that time instead, for example 120 to test the cycle.
const SKY_CYCLE_SECONDS = 0;

// Number of stars that show in the night sky.
const SKY_STAR_COUNT = 120;
