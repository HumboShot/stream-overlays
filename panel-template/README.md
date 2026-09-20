# Panel Template

This is a self-contained editor and exporter. It generates 320x160 Twitch channel panel PNGs.

## Warning: run this via a local web server. Do not double-click the HTML file.

You must open `panel-template.html` over `http://`, for example `http://localhost:8080/panel-template.html`.
Do not open it directly as a `file://` URL.

The PNG export uses `html-to-image` to read the `@font-face` rule from
`panel-template.css`. This embeds the custom font into the exported image. Chrome
and most other browsers block scripts from reading the raw CSS rules of an
externally-linked stylesheet when the page loads via `file://`. As a result,
the export silently falls back to a generic system font. This font looks
bolder and wider than the live preview, even though the on-screen
preview looks correct.

Serving the file over `http://` avoids this problem completely.

### Quickest way to run it

From this folder, start any simple local server, for example:

```powershell
python -m http.server 8080
```

Then open in your browser:

```
http://localhost:8080/panel-template.html
```

Other options that work just as well:
- VS Code's "Live Server" extension
- `npx serve .`
- Any other static file server

## Usage

1. Open `panel-template.html` via the local server (see above).
2. Edit the header/title/subtitle/command fields — the preview updates live.
3. Click **Export 320x160 PNG** to download the panel image.
