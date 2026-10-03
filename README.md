# Stream Overlays

This repo has OBS browser-source overlays for use on stream. It includes the Starting, AFK, and Ending screens, a chat overlay, now-playing overlays, a shared footer with a clock, and a panel template.

This repo came from the original `twitch-webpages` monorepo. It keeps the full file history.

## Structure

- `screen/` — Starting, AFK, and Ending screens in one page (see below)
- `chat-overlay/` — combined chat overlay. It has the stack, popup, and latest layouts in one page, plus channel point redeem and watch streak alerts (see below)
- `shared/` — CSS and JS shared across overlays (Twitch chat and EventSub engines, OBS WebSocket client, token refresh, glitch title effect, typewriter broadcast message, common layout)
- `footer/` — shared footer. The stream screens embed it through an `<iframe>`
- `panel-template/` — panel template generator for channel panels ([you must run it via a local server; do not open it directly](panel-template/README.md))
- `clock/current-time.html` — clock component embedded by the footer
- `plexamp-overlay/` — now-playing overlay for PlexAmp, read from the local PlexAmp app (see below)
- `now-playing/` — now-playing overlay for the Tuna OBS plugin, and the CSS override for the NowPlaying.Site widget (see below)

## Stream Screens

`screen/screen.html` shows the Starting, AFK, or Ending screen. The `mode` URL query selects the screen:

- `screen.html?mode=starting` — starting soon screen (also the default)
- `screen.html?mode=afk` — AFK/BRB screen
- `screen.html?mode=ending` — stream ending screen

Edit the status text, title, messages, and timings for each mode in `screen/screen.config.js`. The status LED color for each mode is in `screen/screen.css`.

In OBS, add one Browser Source for each mode. Clear the "Local file" checkbox, because a local file source cannot have a query. Then put a `file:///` URL in the URL field, for example `file:///D:/git/stream-overlays/screen/screen.html?mode=afk`.

The page links `../shared/overlay-common.css` and `../shared/overlay-common.js`. It embeds `../footer/footer.html` through an `<iframe>`, and that footer embeds `../clock/current-time.html`.

## Chat Overlay

`chat-overlay/` is a single OBS Browser Source. The stack, popup, and latest layouts run in the same page. Only one layout shows at a time. Your current OBS scene controls which layout shows, through obs-websocket. The overlay also shows channel point redeems and watch-streak alerts inline, as highlighted "system" rows. Twitch polls show in a separate panel in the top-left corner. This panel is visible in every layout while the poll runs, and for a short time after it ends.

### Setup

1. **Twitch chat** works with no setup. It connects anonymously and read-only. Just set `channel` and `twitchUserId` in `chat-overlay/chat-overlay.config.js`.
2. **Channel point redeems, watch streaks, and polls** need a Twitch user access token. This is separate from the Client ID and Secret used for badges.
   - Generate a token with the scopes `channel:read:redemptions`, `user:read:chat`, and `channel:read:polls`. Use a tool such as [twitchtokengenerator.com](https://twitchtokengenerator.com).
   - Copy the access token and refresh token into `TWITCH_USER_ACCESS_TOKEN` and `TWITCH_USER_REFRESH_TOKEN` in `shared/secrets.local.js`.
   - The overlay refreshes and rotates this token automatically at runtime (see the comments in `shared/twitch-token-manager.js`). You should need to do this setup only once, unless the stored token is lost, for example when the browser cache is cleared.
3. **OBS scene-based layout switching** uses the built-in obs-websocket server in OBS:
   - In OBS, open Tools > WebSocket Server Settings. Enable the server and note the password, or disable authentication.
   - Put the password in `OBS_WEBSOCKET_PASSWORD` in `shared/secrets.local.js`.
   - List your exact OBS scene names (case-insensitive) under `sceneLayoutNames` in `chat-overlay/chat-overlay.config.js`. Use one array per layout (`stack`, `popup`, `latest`). If a scene is not listed anywhere, the overlay falls back to `unrecognizedSceneLayout` (default `latest`).
   - If you do not want to use obs-websocket, set `enableSceneSwitching: false` in the config. The overlay then always shows `defaultLayout`.
4. Add `chat-overlay/chat-overlay.html` as an OBS Browser Source.

## PlexAmp Now Playing

`plexamp-overlay/plexamp-overlay.html` shows the track that PlexAmp plays now: cover, title, and artist. It copies the layout of the NowPlaying.Site widget with `now-playing/nowplaying-site.css`, so the PlexAmp and Spotify overlays look the same. Long text scrolls. To also show the album and a progress bar, set `showAlbum` and `showProgress` in `plexamp-overlay/plexamp-overlay.config.js`. The overlay hides itself when nothing plays.

The overlay polls the local player API of the PlexAmp desktop app on port 32500. This API updates at once when the track changes. The `/status/sessions` API on the Plex Media Server can be up to 15 seconds late, so the overlay does not use it.

### Setup

1. Run the PlexAmp desktop app on the same PC as OBS.
2. For the album cover, add `PLEX_TOKEN` to `shared/secrets.local.js` (see `shared/secrets.local.example.js`). To find your token, see [Finding an authentication token](https://support.plex.tv/articles/204059436-finding-an-authentication-token-x-plex-token/). Without a token, the overlay shows no cover.
3. Add `plexamp-overlay/plexamp-overlay.html` as an OBS Browser Source. A size of about 800x230 fits the layout.

## Tuna Overlay Music

`now-playing/tuna-overlay-music.html` shows the track that the Tuna OBS plugin reports. It works with Foobar2000 and Plex, but not PlexAmp. For PlexAmp, use `plexamp-overlay/`. The overlay uses the same style as the NowPlaying.Site widget.

### Setup

1. Install the Tuna plugin for OBS.
2. For Foobar2000, install the `foo_mediacontrol` component.
3. In OBS, open Tools > Tuna settings. Enable the web server on port 1608 and start Tuna.
4. Add `now-playing/tuna-overlay-music.html` as an OBS Browser Source.

## NowPlaying.Site CSS

`now-playing/nowplaying-site.css` restyles the NowPlaying.Site widget to match the other overlays.

1. Get your widget URL from the NowPlaying.Site website.
2. Add the URL as an OBS Browser Source.
3. In the source properties, paste the contents of `now-playing/nowplaying-site.css` into the Custom CSS field.
