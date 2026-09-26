// Stream screen. Reads the mode from the URL query (?mode=afk), fills in the
// text from SCREEN_MODES in screen.config.js, and starts the shared overlay
// behavior from ../shared/overlay-common.js.
const requestedMode = new URLSearchParams(location.search).get('mode');
const modeName = requestedMode in SCREEN_MODES ? requestedMode : DEFAULT_SCREEN_MODE;
const { pageTitle, status, title, ...overlayOptions } = SCREEN_MODES[modeName];

document.body.dataset.mode = modeName;
document.title = pageTitle;
document.querySelector('.status').textContent = status;

const titleElement = document.querySelector('.starting-text');
titleElement.textContent = title;
titleElement.dataset.text = title;

initOverlay(overlayOptions);
