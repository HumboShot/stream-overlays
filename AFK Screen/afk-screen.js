// --- 1. GLITCH EFFECT ---
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

// --- 2. TYPEWRITER BROADCAST EFFECT ---
// Rotating messages displayed one character at a time in the broadcast bar at the bottom.
// Edit this array to change what gets shown while the stream is in AFK mode.
const messages = [
    "Operator is currently away from the terminal. Initiating standby protocols.",
    "Stretch your legs, grab a snack. We will resume shortly.",
    "Type !lurk in chat if you are stepping away as well.",
    "Check out !socials while you wait to stay connected to the network."
];

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
    const highlightedString = currentString.replace(/(!\.\w*)/g, '<span class="command-highlight">$1</span>');
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

function typeBroadcast() {
    const currentMsg = messages[msgIndex];
    let currentString = "";

    if (isDeleting) {
        currentString = currentMsg.substring(0, charIndex - 1);
        charIndex--;
    } else {
        currentString = currentMsg.substring(0, charIndex + 1);
        charIndex++;
    }


    const highlightedString = currentString.replace(/(!\w*)/g, '<span class="command-highlight">$1</span>');
    broadcastText.innerHTML = highlightedString;

    let currentSpeed = isDeleting ? deletingSpeed : typingSpeed;

    if (!isDeleting && charIndex === currentMsg.length) {
        currentSpeed = pauseTime;
        isDeleting = true;
    } else if (isDeleting && charIndex === 0) {
        isDeleting = false;
        msgIndex = (msgIndex + 1) % messages.length;
        currentSpeed = 1000;
    }

    setTimeout(typeBroadcast, currentSpeed);
}

setTimeout(typeBroadcast, 3000);
