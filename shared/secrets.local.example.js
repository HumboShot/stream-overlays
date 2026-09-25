// This is a placeholder for shared/secrets.local.js. Commit only this file.
//
// Copy this file to `secrets.local.js` in the same folder, and fill in your
// real Twitch app credentials there. Then git never commits your credentials.
var TWITCH_CLIENT_ID = 'YOUR_CLIENT_ID';
var TWITCH_CLIENT_SECRET = 'YOUR_CLIENT_SECRET';

// chat-overlay uses this for Twitch EventSub (channel point redeems, watch
// streaks, and polls). Generate it at https://twitchtokengenerator.com with the scopes
// `channel:read:redemptions`, `user:read:chat`, and `channel:read:polls`. See the longer comment in
// secrets.local.js for how this code refreshes and rotates these tokens at runtime.
var TWITCH_USER_ACCESS_TOKEN = 'YOUR_USER_ACCESS_TOKEN';
var TWITCH_USER_REFRESH_TOKEN = 'YOUR_USER_REFRESH_TOKEN';

// chat-overlay uses this for OBS scene-based layout switching, through obs-websocket
// (Tools > WebSocket Server Settings in OBS 28 and later). Leave this as '' if you have
// disabled authentication in the obs-websocket settings.
var OBS_WEBSOCKET_PASSWORD = 'YOUR_OBS_WEBSOCKET_PASSWORD';
