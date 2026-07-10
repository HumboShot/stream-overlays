# Panel Template

A self-contained editor/exporter for generating 320x160 Twitch channel panel PNGs.

## ⚠️ Run this via a local web server — do not double-click the HTML file

`panel-template.html` **must** be opened over `http://` (e.g. `http://localhost:8080/panel-template.html`),
not opened directly as a `file://` URL.

Exporting the PNG relies on `html-to-image` reading the `@font-face` rule from
`panel-template.css` to embed the custom font into the exported image. Chrome
(and most browsers) block scripts from reading the raw CSS rules of an
externally-linked stylesheet when the page is loaded via `file://`. This
causes the export to silently fall back to a generic system font that looks
noticeably bolder/wider than the live preview, even though the on-screen
preview looks correct.

Serving the file over `http://` avoids this restriction entirely.

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
