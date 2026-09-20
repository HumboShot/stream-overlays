// Minimal obs-websocket v5 client, used to switch which chat layout is
// active based on the currently-active OBS scene (see chat-overlay.js).
//
// OBS Studio 28+ ships obs-websocket built in (Tools > WebSocket Server
// Settings) — this connects to it directly (default ws://localhost:4455),
// so no extra server/process is needed beyond enabling it in OBS. Like
// shared/twitch-chat.js, this is a hand-rolled WebSocket client (no
// obs-websocket-js npm package) since this repo has no bundler and pages
// are opened directly as local files.
//
// Protocol summary (https://github.com/obsproject/obs-websocket):
//   1. Server sends "Hello" (op 0) with an auth challenge if a password is set.
//   2. Client sends "Identify" (op 1), with a computed auth string if needed.
//   3. Server sends "Identified" (op 2) once accepted.
//   4. Server sends "Event" (op 5) messages for things like scene changes.
//   5. Client can send "Request" (op 6) / gets "RequestResponse" (op 7).

async function sha256Base64(str) {
    const bytes = new TextEncoder().encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
    return btoa(String.fromCharCode(...new Uint8Array(hashBuffer)));
}

function connectObsWebSocket({
    url = 'ws://localhost:4455',
    password = '',
    onSceneChanged, // (sceneName) => void — called on connect (current scene) and on every scene change.
} = {}) {
    let requestCounter = 0;

    function connect() {
        const ws = new WebSocket(url);

        ws.addEventListener('message', async (evt) => {
            let msg;
            try {
                msg = JSON.parse(evt.data);
            } catch (err) {
                return;
            }

            if (msg.op === 0) {
                // Hello — reply with Identify, authenticating if required.
                const authData = msg.d.authentication;
                const identify = { rpcVersion: msg.d.rpcVersion };
                if (authData) {
                    const secret = await sha256Base64(password + authData.salt);
                    identify.authentication = await sha256Base64(secret + authData.challenge);
                }
                ws.send(JSON.stringify({ op: 1, d: identify }));
            } else if (msg.op === 2) {
                // Identified — now ask for the currently active scene.
                requestCounter += 1;
                ws.send(JSON.stringify({
                    op: 6,
                    d: { requestType: 'GetCurrentProgramScene', requestId: `get-scene-${requestCounter}` },
                }));
            } else if (msg.op === 7 && msg.d.requestType === 'GetCurrentProgramScene') {
                const data = msg.d.responseData || {};
                const sceneName = data.currentProgramSceneName || data.sceneName;
                if (sceneName) onSceneChanged && onSceneChanged(sceneName);
            } else if (msg.op === 5 && msg.d.eventType === 'CurrentProgramSceneChanged') {
                const data = msg.d.eventData || {};
                const sceneName = data.sceneName || data.currentProgramSceneName;
                if (sceneName) onSceneChanged && onSceneChanged(sceneName);
            }
        });

        ws.addEventListener('close', () => {
            console.warn('OBS WebSocket: disconnected, reconnecting in 3s...');
            setTimeout(connect, 3000);
        });

        ws.addEventListener('error', (err) => {
            console.error('OBS WebSocket: connection error', err);
        });
    }

    connect();
}
