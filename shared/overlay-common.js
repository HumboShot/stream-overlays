// This is shared behavior for the AFK, Ending, and Starting terminal-style overlays:
// a title glitch effect and a typewriter-style rotating broadcast message.
//
// Each screen's own script calls initOverlay() with its own messages
// array and any timing overrides. For example:
//
//   initOverlay({
//       messages: ["First message", "Second message"],
//       pauseTime: 5000,
//   });

// Shuffles an array in place using the Fisher-Yates algorithm.
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function initOverlay({
    messages,
    typingSpeed = 50,       // Delay between typing each character.
    deletingSpeed = 20,     // Delay between erasing each character. This is faster than typing.
    pauseTime = 8000,       // How long to hold the fully typed message before deleting it.
    glitchStartDelay = 2000,     // Wait before the first glitch, so the page can load first.
    broadcastStartDelay = 3000,  // Wait before starting the typewriter, so the glitch runs first.
    commandPattern = /(!\w+)/g,  // Matches !command tokens to highlight in the broadcast text.
} = {}) {
    // --- TITLE GLITCH EFFECT ---
    // Adds the 'is-glitching' class for a short, random duration, then removes it.
    // After the glitch ends, this code waits a random interval before triggering again.
    const textElement = document.querySelector('.starting-text');

    function triggerGlitch() {
        textElement.classList.add('is-glitching');
        const glitchDuration = Math.random() * 250 + 100; // Between 100 and 350 ms.

        setTimeout(() => {
            textElement.classList.remove('is-glitching');
            const nextGlitchTime = Math.random() * 4500 + 1500; // Next glitch in 1.5 to 6 seconds.
            setTimeout(triggerGlitch, nextGlitchTime);
        }, glitchDuration);
    }
    setTimeout(triggerGlitch, glitchStartDelay);

    // --- BROADCAST TYPEWRITER EFFECT ---
    // Rotates through `messages`, typing and deleting each one in turn.
    const shuffledMessages = shuffleArray([...messages]);
    const broadcastText = document.querySelector('.broadcast-text');
    let msgIndex = 0;   // Tracks which message in the array is showing now.
    let charIndex = 0;  // Tracks how many characters have typed or deleted.
    let isDeleting = false; // True while the effect is erasing the message.

    function typeBroadcast() {
        const currentMsg = shuffledMessages[msgIndex];

        // Grow or shrink the visible string by one character.
        charIndex = isDeleting ? charIndex - 1 : charIndex + 1;
        const currentString = currentMsg.substring(0, charIndex);

        // Wrap any !command tokens in a span, so CSS can color them.
        broadcastText.innerHTML = currentString.replace(commandPattern, '<span class="command-highlight">$1</span>');

        let currentSpeed = isDeleting ? deletingSpeed : typingSpeed;

        if (!isDeleting && charIndex === currentMsg.length) {
            // Typing finished. Pause before starting to delete.
            currentSpeed = pauseTime;
            isDeleting = true;
        } else if (isDeleting && charIndex === 0) {
            // Deleting finished. Move to the next message after a short pause.
            isDeleting = false;
            msgIndex = (msgIndex + 1) % shuffledMessages.length;
            currentSpeed = 1000;
        }

        setTimeout(typeBroadcast, currentSpeed);
    }

    setTimeout(typeBroadcast, broadcastStartDelay);
}
