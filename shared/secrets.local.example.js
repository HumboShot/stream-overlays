// Placeholder for shared/secrets.local.js — commit this file only.
//
// Copy this file to `secrets.local.js` in the same folder and fill in your
// real Twitch app credentials so they are never committed to git.
var TWITCH_CLIENT_ID = 'YOUR_CLIENT_ID';
var TWITCH_CLIENT_SECRET = 'YOUR_CLIENT_SECRET';

// Used by chat-overlay for Twitch EventSub (channel point redeems, watch
// streaks). Generate via https://twitchtokengenerator.com with scopes
// `channel:read:redemptions` and `user:read:chat`. See the longer comment in
// secrets.local.js for how these are refreshed/rotated at runtime.
var TWITCH_USER_ACCESS_TOKEN = 'YOUR_USER_ACCESS_TOKEN';
var TWITCH_USER_REFRESH_TOKEN = 'YOUR_USER_REFRESH_TOKEN';

// Used by chat-overlay for OBS scene-based layout switching via obs-websocket
// (Tools > WebSocket Server Settings in OBS 28+). Leave as '' if you've
// disabled authentication in obs-websocket's settings.
var OBS_WEBSOCKET_PASSWORD = 'YOUR_OBS_WEBSOCKET_PASSWORD';
