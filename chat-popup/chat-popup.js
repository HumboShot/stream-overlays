// Chat Popup overlay — connects read-only to Twitch chat via a raw WebSocket
// to Twitch's IRC gateway (anonymous "justinfan" login, no OAuth/secrets
// needed) and renders each new message as its own terminal-style "toast"
// that pops up at a random spot on the canvas, holds for a bit, then fades
// away. Twitch native emotes plus 7TV / BTTV / FFZ emotes are all resolved
// to inline images.
//
// A vanilla WebSocket is used instead of a library (e.g. tmi.js) because
// tmi.js's npm package doesn't ship a browser-ready bundle (only raw
// CommonJS source meant to be run through a bundler), and this repo's pages
// are opened directly as local files in OBS/Chrome (no server, no build
// step) — ES module scripts are also blocked entirely under file:// by
// Chromium's CORS rules, so even a CDN-hosted ESM build wouldn't work here.
//
// Edit the config passed to initChatPopup() at the bottom of this file to
// change the channel, timings, or emote/command behavior.

function initChatPopup({
    channel,
    twitchUserId,           // Numeric Twitch user ID, needed to query 7TV/BTTV for this channel's
                             // emotes (their APIs key channel lookups by ID, not login). This is
                             // public info, not a secret — safe to hardcode like the channel name.
    displayDuration = 6000, // How long a toast stays fully visible before it starts fading out.
    maxVisible = 12,        // Hard cap on simultaneous toasts so a busy chat doesn't pile up forever.
    hideCommands = true,    // Drop messages that start with "!" (bot commands) to reduce noise.
} = {}) {
    const layer = document.getElementById('popup-layer');
    const activeToasts = [];

    // ---------------------------------------------------------------------
    // THIRD-PARTY EMOTES (7TV / BTTV / FFZ)
    // Built once at startup into a single Map<name, imageUrl>. Twitch chat
    // doesn't tag these in IRC — they're just plain words we match against
    // each provider's emote list for this channel (+ their global sets).
    // Priority on name collisions: 7TV channel > 7TV global > BTTV channel >
    // BTTV global > FFZ channel — channel-specific emotes win over global,
    // and 7TV wins over BTTV/FFZ.
    // ---------------------------------------------------------------------
    const thirdPartyEmotes = new Map();

    async function fetchJson(url) {
        try {
            const res = await fetch(url);
            if (!res.ok) return null;
            return await res.json();
        } catch (err) {
            console.warn(`Chat Popup: failed to load ${url}`, err);
            return null;
        }
    }

    function addEmotes(list) {
        for (const { name, url } of list) {
            if (name && url && !thirdPartyEmotes.has(name)) {
                thirdPartyEmotes.set(name, url);
            }
        }
    }

    function normalizeSeventv(emotes) {
        return (emotes || []).map((e) => ({
            name: e.name,
            url: `https:${e.data.host.url}/2x.webp`,
        }));
    }

    function normalizeBttv(emotes) {
        return (emotes || []).map((e) => ({
            name: e.code,
            url: `https://cdn.betterttv.net/emote/${e.id}/2x.${e.imageType}`,
        }));
    }

    function normalizeFfz(room) {
        if (!room || !room.sets || !room.room) return [];
        const set = room.sets[room.room.set];
        if (!set || !set.emoticons) return [];
        return set.emoticons.map((e) => {
            const url = e.urls['2'] || e.urls['1'] || e.urls['4'];
            return { name: e.name, url: url.startsWith('//') ? `https:${url}` : url };
        });
    }

    async function loadThirdPartyEmotes() {
        const [sevenChannel, sevenGlobal, bttvChannel, bttvGlobal, ffzRoom] = await Promise.all([
            twitchUserId ? fetchJson(`https://7tv.io/v3/users/twitch/${twitchUserId}`) : null,
            fetchJson('https://7tv.io/v3/emote-sets/global'),
            twitchUserId ? fetchJson(`https://api.betterttv.net/3/cached/users/twitch/${twitchUserId}`) : null,
            fetchJson('https://api.betterttv.net/3/cached/emotes/global'),
            fetchJson(`https://api.frankerfacez.com/v1/room/${channel}`),
        ]);

        addEmotes(normalizeSeventv(sevenChannel && sevenChannel.emote_set && sevenChannel.emote_set.emotes));
        addEmotes(normalizeSeventv(sevenGlobal && sevenGlobal.emotes));
        addEmotes(normalizeBttv(bttvChannel && [...(bttvChannel.channelEmotes || []), ...(bttvChannel.sharedEmotes || [])]));
        addEmotes(normalizeBttv(bttvGlobal));
        addEmotes(normalizeFfz(ffzRoom));
    }

    // ---------------------------------------------------------------------
    // MESSAGE RENDERING
    // Two passes: first swap out native Twitch emotes using the exact
    // character ranges Twitch gives us in the message's "emotes" IRCv3 tag,
    // then scan whatever plain text is left word-by-word against the
    // 7TV/BTTV/FFZ map built above. Everything else gets HTML-escaped so raw
    // chat text can never inject markup into the page.
    // ---------------------------------------------------------------------
    function escapeHtml(str) {
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // Twitch's "emotes" tag looks like "25:0-4,7-11/1902:15-19" — one or more
    // "emoteId:range,range" groups separated by "/". Converts that into a
    // flat, sorted list of { start, end, id } ranges into the raw message.
    function buildEmoteRanges(emotesTagValue) {
        const ranges = [];
        if (emotesTagValue) {
            for (const emotePart of emotesTagValue.split('/')) {
                const [id, rangesStr] = emotePart.split(':');
                if (!id || !rangesStr) continue;
                for (const range of rangesStr.split(',')) {
                    const [start, end] = range.split('-').map(Number);
                    ranges.push({ start, end, id });
                }
            }
        }
        ranges.sort((a, b) => a.start - b.start);
        return ranges;
    }

    function renderPlainSegment(segment) {
        // Splits on whitespace (keeping the whitespace itself via the
        // capturing group) so multi-word messages stay readable, and checks
        // each whole word against the merged 7TV/BTTV/FFZ emote map.
        return segment
            .split(/(\s+)/)
            .map((token) => {
                if (token === '' || /^\s+$/.test(token)) return escapeHtml(token);
                const url = thirdPartyEmotes.get(token);
                if (url) {
                    return `<img class="emote" src="${url}" alt="${escapeHtml(token)}" title="${escapeHtml(token)}">`;
                }
                return escapeHtml(token);
            })
            .join('');
    }

    function renderMessage(text, emotesTagValue) {
        const ranges = buildEmoteRanges(emotesTagValue);
        let html = '';
        let cursor = 0;

        for (const range of ranges) {
            if (range.start < cursor) continue; // Skip overlapping/duplicate ranges defensively.
            html += renderPlainSegment(text.slice(cursor, range.start));
            const code = text.slice(range.start, range.end + 1);
            html += `<img class="emote" src="https://static-cdn.jtvnw.net/emoticons/v2/${range.id}/default/dark/2.0" alt="${escapeHtml(code)}" title="${escapeHtml(code)}">`;
            cursor = range.end + 1;
        }
        html += renderPlainSegment(text.slice(cursor));
        return html;
    }

    // Deterministically hashes a username to an HSL hue so users without a
    // set chat color still get a consistent, distinguishable color.
    function hashColor(username) {
        let hash = 0;
        for (let i = 0; i < username.length; i++) {
            hash = username.charCodeAt(i) + ((hash << 5) - hash);
        }
        const hue = Math.abs(hash) % 360;
        return `hsl(${hue}, 70%, 65%)`;
    }

    function randomPercent(min, max) {
        return Math.random() * (max - min) + min;
    }

    // Explicitly forces the "Share Tech Mono" web font to load and waits for
    // it (rather than relying on document.fonts.ready, which can resolve
    // immediately if the font hasn't been used to render anything yet). This
    // matters because .chat-toast has no fixed width — it's sized to fit its
    // text — so if a toast were created before this font finishes loading,
    // the browser would measure it with a fallback font, then silently
    // reflow to a different width once the real font swaps in. Since the
    // toast is centered via translate(-50%, -50%) (recalculated from its
    // current size on every frame), that reflow visibly shifts the whole
    // toast a moment after it spawns. Waiting here means every toast is only
    // ever created after the final font metrics are already known.
    async function waitForFont() {
        try {
            await document.fonts.load("22px 'Share Tech Mono'");
            await document.fonts.ready;
        } catch (err) {
            console.warn('Chat Popup: font loading check failed, continuing anyway', err);
        }
    }

    // ---------------------------------------------------------------------
    // TOAST LIFECYCLE
    // Each message becomes its own absolutely-positioned box at a random
    // spot on the canvas (see .chat-toast in chat-popup.css), fades in,
    // holds for `displayDuration`, then fades out and is removed from the
    // DOM. `maxVisible` force-expires the oldest toast if chat is too busy.
    // ---------------------------------------------------------------------
    function removeToast(toast) {
        if (!toast || !toast.isConnected || toast.classList.contains('is-leaving')) return;
        clearTimeout(toast._expireTimer);
        toast.classList.remove('is-entering');
        toast.classList.add('is-leaving');
        toast.addEventListener('animationend', () => {
            toast.remove();
            const idx = activeToasts.indexOf(toast);
            if (idx !== -1) activeToasts.splice(idx, 1);
        }, { once: true });
    }

    function spawnToast(displayName, color, messageHtml) {
        const toast = document.createElement('div');
        toast.className = 'chat-toast is-entering';
        toast.style.left = `${randomPercent(10, 90)}%`;
        toast.style.top = `${randomPercent(10, 90)}%`;

        const row = document.createElement('div');
        row.className = 'row';
        row.innerHTML = `<span class="user" style="color: ${color};">${escapeHtml(displayName)}:</span> <span class="message">${messageHtml}</span>`;
        toast.appendChild(row);

        layer.appendChild(toast);
        activeToasts.push(toast);

        if (activeToasts.length > maxVisible) {
            removeToast(activeToasts[0]);
        }

        toast._expireTimer = setTimeout(() => removeToast(toast), displayDuration);
    }

    // ---------------------------------------------------------------------
    // TWITCH IRC (raw WebSocket, anonymous/read-only — no OAuth token needed)
    // Twitch's IRC gateway accepts a random "justinfan#####" nick with any
    // password for anonymous, read-only access to a channel's chat.
    // ---------------------------------------------------------------------
    function unescapeTagValue(value) {
        // Per IRCv3 tag-value escaping: \s -> space, \: -> ;, \\ -> \, plus
        // \r and \n. Twitch only really uses \s in practice, but handling
        // the rest costs nothing.
        return value
            .replace(/\\s/g, ' ')
            .replace(/\\:/g, ';')
            .replace(/\\r/g, '\r')
            .replace(/\\n/g, '\n')
            .replace(/\\\\/g, '\\');
    }

    // Parses a single raw IRC(v3) line into { tags, prefix, command, params }.
    function parseIrcLine(line) {
        let rest = line;
        const tags = {};

        if (rest.startsWith('@')) {
            const spaceIdx = rest.indexOf(' ');
            for (const pair of rest.slice(1, spaceIdx).split(';')) {
                const eqIdx = pair.indexOf('=');
                const key = eqIdx === -1 ? pair : pair.slice(0, eqIdx);
                tags[key] = eqIdx === -1 ? '' : unescapeTagValue(pair.slice(eqIdx + 1));
            }
            rest = rest.slice(spaceIdx + 1);
        }

        let prefix = '';
        if (rest.startsWith(':')) {
            const spaceIdx = rest.indexOf(' ');
            prefix = rest.slice(1, spaceIdx);
            rest = rest.slice(spaceIdx + 1);
        }

        let params;
        const trailingIdx = rest.indexOf(' :');
        if (trailingIdx === -1) {
            params = rest.split(' ').filter(Boolean);
        } else {
            params = rest.slice(0, trailingIdx).split(' ').filter(Boolean);
            params.push(rest.slice(trailingIdx + 2));
        }

        const command = params.shift();
        return { tags, prefix, command, params };
    }

    // Strips the CTCP wrapper around /me messages, e.g. "\u0001ACTION foo\u0001" -> "foo".
    function stripActionWrapper(message) {
        const match = message.match(/^\u0001ACTION (.*)\u0001$/);
        return match ? match[1] : message;
    }

    function handleIrcLine(ws, line) {
        const { tags, prefix, command, params } = parseIrcLine(line);

        if (command === 'PING') {
            ws.send(`PONG :${params[0] || 'tmi.twitch.tv'}`);
            return;
        }

        if (command === 'PRIVMSG') {
            const username = prefix.split('!')[0] || 'anonymous';
            const message = stripActionWrapper(params[1] || '');
            if (hideCommands && message.trim().startsWith('!')) return;

            const displayName = tags['display-name'] || username;
            const color = tags.color || hashColor(username);
            const html = renderMessage(message, tags.emotes);

            spawnToast(displayName, color, html);
        }
    }

    function connectToChat() {
        const ws = new WebSocket('wss://irc-ws.chat.twitch.tv:443');
        let buffer = '';

        ws.addEventListener('open', () => {
            ws.send('CAP REQ :twitch.tv/tags twitch.tv/commands');
            ws.send('PASS SCHMOOPIIE'); // Ignored for anonymous justinfan logins; any value works.
            ws.send(`NICK justinfan${Math.floor(Math.random() * 100000)}`);
            ws.send(`JOIN #${channel}`);
        });

        ws.addEventListener('message', (event) => {
            buffer += event.data;
            const lines = buffer.split('\r\n');
            buffer = lines.pop(); // Keep any trailing partial line for the next message.
            for (const line of lines) {
                if (line) handleIrcLine(ws, line);
            }
        });

        ws.addEventListener('close', () => {
            console.warn('Chat Popup: disconnected from Twitch chat, reconnecting in 3s...');
            setTimeout(connectToChat, 3000);
        });

        ws.addEventListener('error', (err) => {
            console.error('Chat Popup: Twitch chat connection error', err);
        });
    }

    // Load third-party emotes and make sure the custom font is ready before
    // connecting so the very first toast is never mismeasured; if either of
    // these fail for any reason we still connect to chat (a plain-text/
    // fallback-font toast beats no chat at all).
    Promise.all([loadThirdPartyEmotes(), waitForFont()]).finally(connectToChat);
}

initChatPopup({
    channel: 'humboshot',
    twitchUserId: '40262155',
});
