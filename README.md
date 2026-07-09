# Stream Overlays

OBS browser-source overlays used on stream: AFK/Ending/Starting screens, the shared footer, a panel template, and the now-playing/clock components they embed.

This repo was split out of the original `twitch-webpages` monorepo, keeping full file history.

## Structure

- `AFK Screen/` — AFK/BRB screen
- `Ending Screen/` — stream ending screen
- `Starting Screen/` — starting soon screen
- `Footer/` — shared footer, embedded via `<iframe>` by the AFK/Ending/Starting screens
- `Panel Template/` — panel template generator for channel panels
- `Current.Time.html` — clock component embedded by the footer
- `Tuna.Overlay.Music.html` — now-playing overlay for the Tuna OBS plugin
- `NowPlaying.Site.CSS` — custom CSS override for the NowPlaying.Site component

These files reference each other with relative paths (e.g. the AFK/Ending/Starting screens `iframe` in `Footer/footer.html`, which itself `iframe`s `Current.Time.html`), so they're kept together in one repo.

## Tuna.Overlay.Music

Currently using Tuna for displaying music from a local machine; works with both Foobar2000 and Plex (not PlexAmp).

### Setup

Install Tuna and open OBS. In OBS click on the tools menu and Tuna settings.
Make sure Tuna is running. For Foobar2000 support, install the foo_mediacontrol component.

## NowPlaying.Site

For styling the NowPlaying.Site component, add the NowPlaying.Site URL from their website, and in OBS override the CSS with what's in this repo.
