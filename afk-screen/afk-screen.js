// AFK screen — configures the shared overlay behavior (glitch effect +
// typewriter broadcast) defined in ../shared/overlay-common.js
//
// Edit the messages array to change what gets shown while the stream is in
// AFK mode.
initOverlay({
    messages: [
        "Operator is currently away from the terminal. Initiating standby protocols.",
        "Stretch your legs, grab a snack. We will resume shortly.",
        "Type !lurk in chat if you are stepping away as well. We'll be here when you get back.",
        "Check out !socials while you wait to stay connected to the network.",
        "Want to support the stream? Feel free to follow or subscribe! Every bit of support helps keep the stream running.",
        "Ads might play while you wait, but don't worry, we won't let them interrupt the stream. Just sit back and relax.",
        "Consider joining the discord server to chat with the community !dojo (It's very work in progress, so bear with us!)",
    ],
    pauseTime: 5000,
});
