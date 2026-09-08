# Stream Overlays

OBS browser-source overlays used on stream: AFK/Ending/Starting screens, the shared footer, a panel template, and the now-playing/clock components they embed.

This repo was split out of the original `twitch-webpages` monorepo, keeping full file history.

## Structure

- `afk-screen/` — AFK/BRB screen
- `ending-screen/` — stream ending screen
- `starting-screen/` — starting soon screen
- `chat-overlay/` — combined chat overlay: stack/popup/latest layouts in one page, plus channel point redeem and watch streak alerts (see below)
- `chat-stack/`, `chat-popup/`, `chat-latest/` — original standalone single-layout chat overlays, kept for reference/rollback; superseded by `chat-overlay/`
- `shared/` — CSS/JS shared across overlays (Twitch chat/EventSub engines, OBS WebSocket client, token refresh, glitch title effect, typewriter broadcast message, common layout)
- `footer/` — shared footer, embedded via `<iframe>` by the AFK/Ending/Starting screens
- `panel-template/` — panel template generator for channel panels ([must be run via a local server, not opened directly](panel-template/README.md))
- `clock/current-time.html` — clock component embedded by the footer
- `tuna-overlay-music.html` — now-playing overlay for the Tuna OBS plugin
- `nowplaying-site.css` — custom CSS override for the NowPlaying.Site component

The AFK/Ending/Starting screens each link `../shared/overlay-common.css` and `../shared/overlay-common.js` in addition to their own screen-specific stylesheet/script (status LED color, messages, timings), and embed `../footer/footer.html` via `<iframe>`, which itself embeds `../clock/current-time.html`.

## Chat Overlay

`chat-overlay/` is a single OBS Browser Source that replaces the three separate `chat-stack`/`chat-popup`/`chat-latest` sources. All three layouts run in the same page; only one is visible at a time, controlled automatically by your current OBS scene (via obs-websocket), and it also shows channel point redeems and watch-streak alerts inline as highlighted "system" rows.

### Setup

1. **Twitch chat** works out of the box (anonymous, read-only, same as the old overlays) — just set `channel`/`twitchUserId` in `chat-overlay/chat-overlay.config.js`.
2. **Channel point redeems / watch streaks** require a Twitch user access token (not just the Client ID/Secret used for badges):
   - Generate one with scopes `channel:read:redemptions` and `user:read:chat` via a tool like [twitchtokengenerator.com](https://twitchtokengenerator.com).
   - Copy the access token and refresh token into `TWITCH_USER_ACCESS_TOKEN` / `TWITCH_USER_REFRESH_TOKEN` in `shared/secrets.local.js`.
   - The overlay automatically refreshes/rotates this token at runtime (see the comments in `shared/twitch-token-manager.js`) — you should only need to do this once, unless the stored token is somehow lost (e.g. browser cache cleared).
3. **OBS scene-based layout switching** uses OBS's built-in obs-websocket server:
   - In OBS: Tools > WebSocket Server Settings > enable the server, note the password (or disable authentication).
   - Put the password in `OBS_WEBSOCKET_PASSWORD` in `shared/secrets.local.js`.
   - Make sure your relevant OBS scenes contain the keywords `stack`, `popup`, or `latest` in their names (case-insensitive, e.g. "Just Chatting - Stack Chat"), or edit `sceneLayoutKeywords` in `chat-overlay/chat-overlay.config.js` to match your actual scene names.
   - If you don't want to use obs-websocket at all, set `enableSceneSwitching: false` in the config and it'll always show `defaultLayout`.
4. Add `chat-overlay/chat-overlay.html` as a single OBS Browser Source (replacing the old three sources).

## Tuna Overlay Music

Currently using Tuna for displaying music from a local machine; works with both Foobar2000 and Plex (not PlexAmp).

### Setup

Install Tuna and open OBS. In OBS click on the tools menu and Tuna settings.
Make sure Tuna is running. For Foobar2000 support, install the foo_mediacontrol component.

## NowPlaying.Site CSS

For styling the NowPlaying.Site component, add the NowPlaying.Site URL from their website, and in OBS override the CSS with what's in this repo.
