# Stream Overlays

OBS browser-source overlays for my Twitch stream.

The overlays are plain HTML, CSS, and JavaScript. They have no build step and no dependencies. Each overlay is a page that you add to OBS as a Browser Source.

This repo came from the original `twitch-webpages` monorepo. It keeps the full file history.

## Overlays

| Overlay | Path | What it shows |
| --- | --- | --- |
| [Stream screens](#stream-screens) | `screen/` | The Starting, AFK, and Ending screens, in one page. |
| [Chat overlay](#chat-overlay) | `chat-overlay/` | Twitch chat in three layouts, plus redeem, watch streak, and poll alerts. |
| [PlexAmp now playing](#plexamp-now-playing) | `plexamp-overlay/` | The track that the PlexAmp desktop app plays. |
| [Tuna now playing](#tuna-now-playing) | `now-playing/tuna-overlay-music.html` | The track that the Tuna OBS plugin reports. |
| [NowPlaying.Site CSS](#nowplayingsite-css) | `now-playing/nowplaying-site.css` | A restyle of the NowPlaying.Site widget. |
| [Twitch callout](#twitch-callout) | `twitch-callout/` | A bar with the Twitch logo and the channel name. |
| [Panel template](#panel-template) | `panel-template/` | An editor that exports Twitch channel panel images. |

Some folders hold parts that the overlays use:

- `footer/`: the shared footer. The stream screens embed it through an `<iframe>`.
- `clock/current-time.html`: the clock. The footer embeds it.
- `shared/`: CSS and JavaScript that the overlays share. This includes the Twitch chat and EventSub clients, the OBS WebSocket client, the token refresh, and the common layout.

## Requirements

- [OBS Studio](https://obsproject.com/) 28 or later. Version 28 and later include obs-websocket.
- For some overlays only:
  - The PlexAmp desktop app
  - The [Tuna](https://obsproject.com/forum/resources/tuna.843/) OBS plugin
  - A local web server, for the panel template

## General setup

1. Clone this repo to your streaming PC.
2. Copy `shared/secrets.local.example.js` to `shared/secrets.local.js`. Git ignores this file.
3. Fill in only the values that your overlays need. Each overlay section below tells you which values.
4. Add each overlay to OBS as a Browser Source. Use the "Local file" option, unless the section below tells you to use a URL.

## Stream screens

`screen/screen.html` shows the Starting, AFK, or Ending screen. The `mode` URL query selects the screen:

- `screen.html?mode=starting`: the starting soon screen. This is the default.
- `screen.html?mode=afk`: the AFK/BRB screen.
- `screen.html?mode=ending`: the stream ending screen.

Edit the status text, title, messages, and timings for each mode in `screen/screen.config.js`. The status LED color for each mode is in `screen/screen.css`.

### Setup

1. In OBS, add one Browser Source for each mode.
2. Clear the "Local file" checkbox, because a local file source cannot have a query.
3. Put a `file:///` URL in the URL field, for example `file:///D:/git/stream-overlays/screen/screen.html?mode=afk`.

The page embeds `../footer/footer.html`, and the footer embeds `../clock/current-time.html`. Keep the folders together.

## Chat overlay

`chat-overlay/` is a single OBS Browser Source. It has three layouts: stack, popup, and latest. Only one layout shows at a time. Your current OBS scene selects the layout, through obs-websocket.

The overlay also shows these Twitch events:

- Channel point redeems and watch streaks show inline, as highlighted "system" rows.
- Polls show in a separate panel in the top-left corner. The panel shows in every layout while the poll runs, and for a short time after it ends.

### Setup

1. **Twitch chat** needs no token. It connects anonymously and read-only. Set `channel` and `twitchUserId` in `chat-overlay/chat-overlay.config.js`.
2. **Chat badges** need a Twitch app. Put its Client ID and Secret in `TWITCH_CLIENT_ID` and `TWITCH_CLIENT_SECRET` in `shared/secrets.local.js`.
3. **Channel point redeems, watch streaks, and polls** need a Twitch user access token:
   - Generate a token with the scopes `channel:read:redemptions`, `user:read:chat`, and `channel:read:polls`. You can use a tool such as [twitchtokengenerator.com](https://twitchtokengenerator.com).
   - Put the access token and the refresh token in `TWITCH_USER_ACCESS_TOKEN` and `TWITCH_USER_REFRESH_TOKEN` in `shared/secrets.local.js`.
   - The overlay refreshes and rotates the token automatically (see the comments in `shared/twitch-token-manager.js`). You must do this step again only if the stored token is lost, for example when the browser cache is cleared.
4. **Scene-based layout switching** uses obs-websocket:
   - In OBS, open Tools > WebSocket Server Settings. Enable the server. Note the password, or disable authentication.
   - Put the password in `OBS_WEBSOCKET_PASSWORD` in `shared/secrets.local.js`.
   - In `chat-overlay/chat-overlay.config.js`, list your OBS scene names under `sceneLayoutNames`. Use one array for each layout (`stack`, `popup`, `latest`). The names are not case-sensitive.
   - A scene that is not in any list uses `unrecognizedSceneLayout`. The default is `latest`.
   - To turn off scene switching, set `enableSceneSwitching: false`. The overlay then always shows `defaultLayout`.
5. Add `chat-overlay/chat-overlay.html` as an OBS Browser Source.

## PlexAmp now playing

`plexamp-overlay/plexamp-overlay.html` shows the cover, title, and artist of the track that PlexAmp plays. It uses the same layout as the NowPlaying.Site widget, so the PlexAmp and Spotify overlays look the same. Long text scrolls. The overlay hides itself when nothing plays.

To also show the album and a progress bar, set `showAlbum` and `showProgress` in `plexamp-overlay/plexamp-overlay.config.js`.

The overlay polls the local player API of the PlexAmp desktop app on port 32500. This API updates at once when the track changes. The overlay does not use the `/status/sessions` API of the Plex Media Server, because it can be up to 15 seconds late.

### Setup

1. Run the PlexAmp desktop app on the same PC as OBS.
2. For the album cover, put your Plex token in `PLEX_TOKEN` in `shared/secrets.local.js`. To find your token, see [Finding an authentication token](https://support.plex.tv/articles/204059436-finding-an-authentication-token-x-plex-token/). Without a token, the overlay shows no cover.
3. Add `plexamp-overlay/plexamp-overlay.html` as an OBS Browser Source. A size of about 800x230 fits the layout.

## Tuna now playing

`now-playing/tuna-overlay-music.html` shows the track that the Tuna OBS plugin reports. It works with Foobar2000 and Plex, but not with PlexAmp. For PlexAmp, use the [PlexAmp overlay](#plexamp-now-playing). This overlay uses the same style as the NowPlaying.Site widget.

### Setup

1. Install the Tuna plugin for OBS.
2. For Foobar2000, install the `foo_mediacontrol` component.
3. In OBS, open Tools > Tuna settings. Enable the web server on port 1608, then start Tuna.
4. Add `now-playing/tuna-overlay-music.html` as an OBS Browser Source.

## NowPlaying.Site CSS

`now-playing/nowplaying-site.css` restyles the NowPlaying.Site widget to match the other overlays.

1. Get your widget URL from the NowPlaying.Site website.
2. Add the URL as an OBS Browser Source.
3. In the source properties, paste the contents of `now-playing/nowplaying-site.css` into the Custom CSS field.

## Twitch callout

`twitch-callout/twitch-callout.html` shows a bar with the Twitch logo and the text `HumboShot`. Use it in the gap between the facecam and the gameplay.

Add it as an OBS Browser Source. Set the width and height of the source to the size of the gap, for example 1080x110. The logo and the text scale to the height of the source.

`twitch-callout/twitch-callout.png` is a 1080x110 image of the bar, for video editing. To export it at a different size, change `--window-size` and run this command:

```bash
"/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" --headless=new --hide-scrollbars --force-device-scale-factor=1 --virtual-time-budget=5000 --window-size=1080,110 --screenshot="D:\git\stream-overlays\twitch-callout\twitch-callout.png" "file:///D:/git/stream-overlays/twitch-callout/twitch-callout.html"
```

## Panel template

`panel-template/` is an editor that exports 320x160 Twitch channel panel PNGs.

You must open it through a local web server, not as a local file. If you open it as a `file://` URL, the export uses the wrong font. See [panel-template/README.md](panel-template/README.md) for the steps.

## Contributions

This is a personal project for my own stream. I do not accept issues or pull requests. You are free to fork it and change it for your own stream.

## License

This project uses the MIT License. See [LICENSE](LICENSE).
