// Grabs the main title text element to apply glitch CSS classes to it.
const textElement = document.querySelector('.starting-text');

// Adds the 'is-glitching' class for a short random duration, then removes it.
// After the glitch ends, waits a random interval before triggering again.
function triggerGlitch() {
    textElement.classList.add('is-glitching');
    const glitchDuration = Math.random() * 250 + 100; // Between 100–350ms

    setTimeout(() => {
        textElement.classList.remove('is-glitching');
        const nextGlitchTime = Math.random() * 4500 + 1500; // Next glitch in 1.5–6s
        setTimeout(triggerGlitch, nextGlitchTime);
    }, glitchDuration);
}
// Wait 2 seconds before starting the first glitch so the page can load first.
setTimeout(triggerGlitch, 2000);

// Rotating messages displayed one character at a time in the broadcast bar at the bottom.
// Edit this array to change what gets shown while waiting for the stream to start.
// Shuffle messages array using Fisher-Yates algorithm
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

const messages = shuffleArray([
    "You can type !vods to get a link to my vod channel if you want to watch a stream you missed",
    "You can also do !socials to find all the links to my socials",
    "Remember to follow if you want to be notified when I go live!",
    "The stream will be starting shortly. Grab a snack and get comfortable!",
    "Subscribing gives you access to exclusive emotes and helps support the stream. Every bit of support helps keep the stream running!",
]);

const broadcastText = document.querySelector('.broadcast-text');
let msgIndex = 0;   // Tracks which message in the array is currently being shown.
let charIndex = 0;  // Tracks how many characters have been typed or deleted.
let isDeleting = false; // Whether the effect is currently erasing the message.

// Timing settings (in milliseconds)
const typingSpeed = 50;    // Delay between each character being typed.
const deletingSpeed = 20;  // Delay between each character being erased (faster than typing).
const pauseTime = 8000;    // How long to hold the fully typed message before deleting.

function typeBroadcast() {
    const currentMsg = messages[msgIndex];
    let currentString = "";

    // Build the visible string: shrink if deleting, grow if typing.
    if (isDeleting) {
        currentString = currentMsg.substring(0, charIndex - 1);
        charIndex--;
    } else {
        currentString = currentMsg.substring(0, charIndex + 1);
        charIndex++;
    }

    // Wrap any !command tokens in a span so CSS can colour them yellow.
    const highlightedString = currentString.replace(/(!\w+)/g, '<span class="command-highlight">$1</span>');
    broadcastText.innerHTML = highlightedString;

    let currentSpeed = isDeleting ? deletingSpeed : typingSpeed;

    if (!isDeleting && charIndex === currentMsg.length) {
        // Finished typing — pause before starting to delete.
        currentSpeed = pauseTime;
        isDeleting = true;
    } else if (isDeleting && charIndex === 0) {
        // Finished deleting — move to the next message.
        isDeleting = false;
        msgIndex = (msgIndex + 1) % messages.length;
        currentSpeed = 1000; // Short pause before starting the next message.
    }

    setTimeout(typeBroadcast, currentSpeed);
}

// Wait 3 seconds before starting so the glitch effect has time to kick in first.
setTimeout(typeBroadcast, 3000);
