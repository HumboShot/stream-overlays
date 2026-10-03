// PlexAmp Now Playing overlay.
//
// This overlay polls the local player API of the PlexAmp desktop app (port 32500).
// It does not use /status/sessions on the Plex Media Server, because the server
// can report a track change up to 15 seconds late. The local API changes at once.
//
// The local API returns XML, not JSON, and it sends CORS headers, so a
// browser source can read it. The track info needs no token. The cover image
// comes from the Plex Media Server, so the cover needs a Plex token.
//
// The layout copies the NowPlaying.Site widget that shows Spotify. Thus the
// album line and the progress bar are off by default, and long text scrolls.
//
// Between polls, the progress bar moves forward on a local clock.
//
// To change the timings, edit plexamp-overlay.config.js.

function initPlexampOverlay({
    playerUrl = 'http://localhost:32500',
    token = '',          // X-Plex-Token. Only used for the cover. '' = no cover.
    serverUrl = '',      // Optional. Overrides the server address that PlexAmp reports, for the cover.
    showWhenPaused = false,
    showAlbum = false,
    showProgress = false,
    pollInterval = 1000,
    coverSize = 300,
}) {
    const player = document.getElementById('player');
    const titleEl = document.getElementById('title');
    const artistEl = document.getElementById('artist');
    const albumEl = document.getElementById('album');
    const coverEl = document.getElementById('cover');
    const progressEl = document.getElementById('progress');
    const progressFillEl = document.getElementById('progress-fill');

    albumEl.classList.toggle('is-hidden', !showAlbum);
    progressEl.classList.toggle('is-hidden', !showProgress);

    let currentKey = '';
    let progress = null; // { offset, duration, at, playing }
    let commandId = 0;

    function coverUrl(timeline, track) {
        const thumb = track.getAttribute('parentThumb') || track.getAttribute('thumb') || track.getAttribute('grandparentThumb');
        if (!token || !thumb) {
            return '';
        }
        const base = serverUrl || `${timeline.getAttribute('protocol')}://${timeline.getAttribute('address')}:${timeline.getAttribute('port')}`;
        const url = new URL('/photo/:/transcode', base);
        url.searchParams.set('url', thumb);
        url.searchParams.set('width', coverSize);
        url.searchParams.set('height', coverSize);
        url.searchParams.set('minSize', 1);
        url.searchParams.set('X-Plex-Token', token);
        return url.toString();
    }

    // The text scrolls at about 50 px per second. The keyframes in the CSS hold
    // the text still for the first and last 10% of each pass.
    function updateScroll(textEl) {
        const viewport = textEl.parentElement;
        viewport.classList.remove('is-scrolling');
        const distance = textEl.scrollWidth - viewport.clientWidth;
        if (distance > 0) {
            viewport.style.setProperty('--scroll-distance', `${distance + 40}px`);
            viewport.style.setProperty('--scroll-duration', `${(distance + 40) / 50 / 0.8}s`);
            viewport.classList.add('is-scrolling');
        }
    }

    function updateAllScroll() {
        updateScroll(titleEl);
        updateScroll(artistEl);
    }

    document.fonts.ready.then(updateAllScroll);

    function hide() {
        player.classList.add('closed');
        progress = null;
    }

    function show(timeline, track) {
        const state = timeline.getAttribute('state');
        if (state !== 'playing' && !(showWhenPaused && state === 'paused')) {
            hide();
            return;
        }

        // originalTitle is the track artist when it differs from the album artist,
        // for example on compilations.
        const artist = track.getAttribute('originalTitle') || track.getAttribute('grandparentTitle') || 'Unknown Artist';
        const key = track.getAttribute('ratingKey');

        if (currentKey !== key) {
            currentKey = key;
            titleEl.textContent = track.getAttribute('title') || 'Unknown Title';
            artistEl.textContent = artist;
            albumEl.textContent = track.getAttribute('parentTitle') || '';
            coverEl.src = coverUrl(timeline, track);
            updateAllScroll();
        }

        progress = {
            offset: Number(timeline.getAttribute('time')) || 0,
            duration: Number(timeline.getAttribute('duration')) || 0,
            at: performance.now(),
            playing: state === 'playing',
        };

        player.classList.remove('closed');
    }

    async function poll() {
        try {
            const url = new URL('/player/timeline/poll', playerUrl);
            url.searchParams.set('wait', 0);
            url.searchParams.set('includeMetadata', 1);
            url.searchParams.set('type', 'music');
            url.searchParams.set('commandID', ++commandId);

            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            const xml = new DOMParser().parseFromString(await response.text(), 'text/xml');
            const timeline = xml.querySelector('Timeline[type="music"]');
            const track = timeline?.querySelector('Track');
            if (track) {
                show(timeline, track);
            } else {
                hide();
            }
        } catch (error) {
            console.warn('PlexAmp overlay: poll failed. Is PlexAmp running?', error);
            hide();
        }
    }

    function drawProgress() {
        if (progress && progress.duration > 0) {
            const elapsed = progress.playing ? performance.now() - progress.at : 0;
            const ratio = Math.min(1, (progress.offset + elapsed) / progress.duration);
            progressFillEl.style.width = `${ratio * 100}%`;
        }
        requestAnimationFrame(drawProgress);
    }

    poll();
    setInterval(poll, pollInterval);
    if (showProgress) {
        requestAnimationFrame(drawProgress);
    }
}
