# Stream Overlays

This repo has OBS browser-source overlays for use on stream. It includes the AFK, Ending, and Starting screens, the shared footer, a panel template, and the now-playing and clock components they embed.

This repo came from the original `twitch-webpages` monorepo. It keeps the full file history.

## Structure

- `screen/` — Starting, AFK, and Ending screens in one page (see below)
- `chat-overlay/` — combined chat overlay. It has the stack, popup, and latest layouts in one page, plus channel point redeem and watch streak alerts (see below)
- `shared/` — CSS and JS shared across overlays (Twitch chat and EventSub engines, OBS WebSocket client, token refresh, glitch title effect, typewriter broadcast message, common layout)
- `footer/` — shared footer. The stream screens embed it through an `<iframe>`
- `panel-template/` — panel template generator for channel panels ([you must run it via a local server; do not open it directly](panel-template/README.md))
- `clock/current-time.html` — clock component embedded by the footer
- `plexamp-overlay/` — now-playing overlay for PlexAmp, read from the local PlexAmp app (see below)
- `tuna-overlay-music.html` — now-playing overlay for the Tuna OBS plugin
- `nowplaying-site.css` — custom CSS override for the NowPlaying.Site component

## Stream Screens

`screen/screen.html` shows the Starting, AFK, or Ending screen. The `mode` URL query selects the screen:

- `screen.html?mode=starting` — starting soon screen (also the default)
- `screen.html?mode=afk` — AFK/BRB screen
- `screen.html?mode=ending` — stream ending screen

Edit the status text, title, messages, and timings for each mode in `screen/screen.config.js`. The status LED color for each mode is in `screen/screen.css`.

In OBS, add one Browser Source for each mode. Clear the "Local file" checkbox, because a local file source cannot have a query. Then put a `file:///` URL in the URL field, for example `file:///D:/git/stream-overlays/screen/screen.html?mode=afk`.

The page links `../shared/overlay-common.css` and `../shared/overlay-common.js`. It embeds `../footer/footer.html` through an `<iframe>`, and that footer embeds `../clock/current-time.html`.

## Chat Overlay

`chat-overlay/` is a single OBS Browser Source. It replaces the three separate `chat-stack`, `chat-popup`, and `chat-latest` sources. All three layouts run in the same page. Only one layout shows at a time. Your current OBS scene controls which layout shows, through obs-websocket. The overlay also shows channel point redeems and watch-streak alerts inline, as highlighted "system" rows. Twitch polls show in a separate panel in the top-left corner. This panel is visible in every layout while the poll runs, and for a short time after it ends.

### Setup

1. **Twitch chat** works with no setup. It connects anonymously and read-only, the same as the old overlays. Just set `channel` and `twitchUserId` in `chat-overlay/chat-overlay.config.js`.
2. **Channel point redeems, watch streaks, and polls** need a Twitch user access token. This is separate from the Client ID and Secret used for badges.
   - Generate a token with the scopes `channel:read:redemptions`, `user:read:chat`, and `channel:read:polls`. Use a tool such as [twitchtokengenerator.com](https://twitchtokengenerator.com).
   - Copy the access token and refresh token into `TWITCH_USER_ACCESS_TOKEN` and `TWITCH_USER_REFRESH_TOKEN` in `shared/secrets.local.js`.
   - The overlay refreshes and rotates this token automatically at runtime (see the comments in `shared/twitch-token-manager.js`). You should need to do this setup only once, unless the stored token is lost, for example when the browser cache is cleared.
3. **OBS scene-based layout switching** uses the built-in obs-websocket server in OBS:
   - In OBS, open Tools > WebSocket Server Settings. Enable the server and note the password, or disable authentication.
   - Put the password in `OBS_WEBSOCKET_PASSWORD` in `shared/secrets.local.js`.
   - List your exact OBS scene names (case-insensitive) under `sceneLayoutNames` in `chat-overlay/chat-overlay.config.js`. Use one array per layout (`stack`, `popup`, `latest`). If a scene is not listed anywhere, the overlay falls back to `unrecognizedSceneLayout` (default `latest`).
   - If you do not want to use obs-websocket, set `enableSceneSwitching: false` in the config. The overlay then always shows `defaultLayout`.
4. Add `chat-overlay/chat-overlay.html` as a single OBS Browser Source. This replaces the old three sources.

## PlexAmp Now Playing

`plexamp-overlay/plexamp-overlay.html` shows the track that PlexAmp plays now: cover, title, and artist. It copies the layout of the NowPlaying.Site widget with `nowplaying-site.css`, so the PlexAmp and Spotify overlays look the same. Long text scrolls. To also show the album and a progress bar, set `showAlbum` and `showProgress` in `plexamp-overlay/plexamp-overlay.config.js`. The overlay hides itself when nothing plays.

The overlay polls the local player API of the PlexAmp desktop app on port 32500. This API updates at once when the track changes. The `/status/sessions` API on the Plex Media Server can be up to 15 seconds late, so the overlay does not use it.

### Setup

1. Run the PlexAmp desktop app on the same PC as OBS.
2. For the album cover, add `PLEX_TOKEN` to `shared/secrets.local.js` (see `shared/secrets.local.example.js`). To find your token, see [Finding an authentication token](https://support.plex.tv/articles/204059436-finding-an-authentication-token-x-plex-token/). Without a token, the overlay shows no cover.
3. Add `plexamp-overlay/plexamp-overlay.html` as an OBS Browser Source. A size of about 800x230 fits the layout.

## Tuna Overlay Music

This setup uses Tuna to show music from a local machine. It works with both Foobar2000 and Plex, but not PlexAmp.

### Setup

Install Tuna and open OBS. In OBS click on the tools menu and Tuna settings.
Make sure Tuna is running. For Foobar2000 support, install the foo_mediacontrol component.

## NowPlaying.Site CSS

To style the NowPlaying.Site component, add the NowPlaying.Site URL from their website. Then, in OBS, override the CSS with the CSS in this repo.
