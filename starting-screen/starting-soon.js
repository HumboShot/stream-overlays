// Starting screen — configures the shared overlay behavior (glitch effect +
// typewriter broadcast) defined in ../shared/overlay-common.js
//
// Edit the messages array to change what gets shown while waiting for the
// stream to start.
initOverlay({
    messages: [
        "You can type !vods to get a link to my vod channel if you want to watch a stream you missed",
        "You can also do !socials to find all the links to my socials",
        "Remember to follow if you want to be notified when I go live!",
        "The stream will be starting shortly. Grab a snack and get comfortable!",
        "Subscribing gives you access to exclusive emotes and helps support the stream. Every bit of support helps keep the stream running!",
    ],
    pauseTime: 8000,
});
