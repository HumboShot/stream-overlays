// PlexAmp Now Playing configuration.
//
// This is the only file you should need to edit day to day. The actual
// behavior lives in plexamp-overlay.js, which loads before this file.

initPlexampOverlay({
    // The local player API of the PlexAmp desktop app.
    playerUrl: 'http://localhost:32500',

    // Only needed for the album cover.
    token: typeof PLEX_TOKEN !== 'undefined' ? PLEX_TOKEN : '',

    showWhenPaused: false,

    // The Spotify widget shows neither of these. Set to true to add them.
    showAlbum: false,
    showProgress: false,

    pollInterval: 1000,
});
