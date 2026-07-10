# Stream Overlays

OBS browser-source overlays used on stream: AFK/Ending/Starting screens, the shared footer, a panel template, and the now-playing/clock components they embed.

This repo was split out of the original `twitch-webpages` monorepo, keeping full file history.

## Structure

- `afk-screen/` — AFK/BRB screen
- `ending-screen/` — stream ending screen
- `starting-screen/` — starting soon screen
- `shared/` — CSS/JS shared by the AFK/Ending/Starting screens (glitch title effect, typewriter broadcast message, common layout)
- `footer/` — shared footer, embedded via `<iframe>` by the AFK/Ending/Starting screens
- `panel-template/` — panel template generator for channel panels ([must be run via a local server, not opened directly](panel-template/README.md))
- `clock/current-time.html` — clock component embedded by the footer
- `tuna-overlay-music.html` — now-playing overlay for the Tuna OBS plugin
- `nowplaying-site.css` — custom CSS override for the NowPlaying.Site component

The AFK/Ending/Starting screens each link `../shared/overlay-common.css` and `../shared/overlay-common.js` in addition to their own screen-specific stylesheet/script (status LED color, messages, timings), and embed `../footer/footer.html` via `<iframe>`, which itself embeds `../clock/current-time.html`.

## Tuna Overlay Music

Currently using Tuna for displaying music from a local machine; works with both Foobar2000 and Plex (not PlexAmp).

### Setup

Install Tuna and open OBS. In OBS click on the tools menu and Tuna settings.
Make sure Tuna is running. For Foobar2000 support, install the foo_mediacontrol component.

## NowPlaying.Site CSS

For styling the NowPlaying.Site component, add the NowPlaying.Site URL from their website, and in OBS override the CSS with what's in this repo.
