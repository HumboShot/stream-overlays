// Starting screen. Configures the shared overlay behavior (glitch effect and
// typewriter broadcast) defined in ../shared/overlay-common.js.
//
// Edit the messages array to change what shows while waiting for the
// stream to start.
initOverlay({
    messages: [
        "You can type !vods to get a link to my vod channel if you want to watch a stream you missed",
        "You can also do !socials to find all the links to my socials",
        "Remember to follow if you want to be notified when I go live!",
        "The stream will be starting shortly. Grab a snack and get comfortable!",
        "Subscribing gives you access to exclusive emotes and helps support the stream. Every bit of support helps keep the stream running!",
        "Consider joining the discord server to chat with the community !dojo (It's very work in progress, so bear with us!)",
    ],
    pauseTime: 8000,
});
