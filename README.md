# Stream Overlays

This repo has OBS browser-source overlays for use on stream. It includes the AFK, Ending, and Starting screens, the shared footer, a panel template, and the now-playing and clock components they embed.

This repo came from the original `twitch-webpages` monorepo. It keeps the full file history.

## Structure

- `afk-screen/` — AFK/BRB screen
- `ending-screen/` — stream ending screen
- `starting-screen/` — starting soon screen
- `chat-overlay/` — combined chat overlay. It has the stack, popup, and latest layouts in one page, plus channel point redeem and watch streak alerts (see below)
- `chat-stack/`, `chat-popup/`, `chat-latest/` — original standalone single-layout chat overlays. Kept for reference and rollback. The `chat-overlay/` overlay replaces these
- `shared/` — CSS and JS shared across overlays (Twitch chat and EventSub engines, OBS WebSocket client, token refresh, glitch title effect, typewriter broadcast message, common layout)
- `footer/` — shared footer. The AFK, Ending, and Starting screens embed it through an `<iframe>`
- `panel-template/` — panel template generator for channel panels ([you must run it via a local server; do not open it directly](panel-template/README.md))
- `clock/current-time.html` — clock component embedded by the footer
- `tuna-overlay-music.html` — now-playing overlay for the Tuna OBS plugin
- `nowplaying-site.css` — custom CSS override for the NowPlaying.Site component

The AFK, Ending, and Starting screens each link `../shared/overlay-common.css` and `../shared/overlay-common.js`. They also link their own screen-specific stylesheet and script for the status LED color, messages, and timings. Each screen embeds `../footer/footer.html` through an `<iframe>`, and that footer embeds `../clock/current-time.html`.

## Chat Overlay

`chat-overlay/` is a single OBS Browser Source. It replaces the three separate `chat-stack`, `chat-popup`, and `chat-latest` sources. All three layouts run in the same page. Only one layout shows at a time. Your current OBS scene controls which layout shows, through obs-websocket. The overlay also shows channel point redeems and watch-streak alerts inline, as highlighted "system" rows.

### Setup

1. **Twitch chat** works with no setup. It connects anonymously and read-only, the same as the old overlays. Just set `channel` and `twitchUserId` in `chat-overlay/chat-overlay.config.js`.
2. **Channel point redeems and watch streaks** need a Twitch user access token. This is separate from the Client ID and Secret used for badges.
   - Generate a token with the scopes `channel:read:redemptions` and `user:read:chat`. Use a tool such as [twitchtokengenerator.com](https://twitchtokengenerator.com).
   - Copy the access token and refresh token into `TWITCH_USER_ACCESS_TOKEN` and `TWITCH_USER_REFRESH_TOKEN` in `shared/secrets.local.js`.
   - The overlay refreshes and rotates this token automatically at runtime (see the comments in `shared/twitch-token-manager.js`). You should need to do this setup only once, unless the stored token is lost, for example when the browser cache is cleared.
3. **OBS scene-based layout switching** uses the built-in obs-websocket server in OBS:
   - In OBS, open Tools > WebSocket Server Settings. Enable the server and note the password, or disable authentication.
   - Put the password in `OBS_WEBSOCKET_PASSWORD` in `shared/secrets.local.js`.
   - List your exact OBS scene names (case-insensitive) under `sceneLayoutNames` in `chat-overlay/chat-overlay.config.js`. Use one array per layout (`stack`, `popup`, `latest`). If a scene is not listed anywhere, the overlay falls back to `unrecognizedSceneLayout` (default `latest`).
   - If you do not want to use obs-websocket, set `enableSceneSwitching: false` in the config. The overlay then always shows `defaultLayout`.
4. Add `chat-overlay/chat-overlay.html` as a single OBS Browser Source. This replaces the old three sources.

## Tuna Overlay Music

This setup uses Tuna to show music from a local machine. It works with both Foobar2000 and Plex, but not PlexAmp.

### Setup

Install Tuna and open OBS. In OBS click on the tools menu and Tuna settings.
Make sure Tuna is running. For Foobar2000 support, install the foo_mediacontrol component.

## NowPlaying.Site CSS

To style the NowPlaying.Site component, add the NowPlaying.Site URL from their website. Then, in OBS, override the CSS with the CSS in this repo.
