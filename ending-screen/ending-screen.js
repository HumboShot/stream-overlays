// Ending screen — configures the shared overlay behavior (glitch effect +
// typewriter broadcast) defined in ../shared/overlay-common.js
//
// Edit the messages array to change what gets shown on the ending screen.
initOverlay({
    messages: [
        "Initiating system shutdown sequence... Thank you for connecting.",
        "Network disconnect imminent. Please prepare for data stream termination.",
        "Catch the latest !vods if you missed any of today's transmissions.",
        "Access !socials to maintain connection to the community network offline.",
    ],
    pauseTime: 8000,
});
