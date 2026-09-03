// Shared Twitch chat engine used by every chat-based overlay in this repo
// (chat-popup, chat-stack, and any future ones). Connects read-only to
// Twitch chat via a raw WebSocket to Twitch's IRC gateway (anonymous
// "justinfan" login, no OAuth/secrets needed), resolves both native Twitch
// emotes and 7TV / BTTV / FFZ emotes to inline images, and calls back into
// the overlay's own onMessage(displayName, color, html, badgesHtml) for every qualifying
// chat message. Each overlay is responsible for its own visual
// presentation/lifecycle (see chat-popup.js and chat-stack.js).
//
// A vanilla WebSocket is used instead of a library (e.g. tmi.js) because
// tmi.js's npm package doesn't ship a browser-ready bundle (only raw
// CommonJS source meant to be run through a bundler), and this repo's pages
// are opened directly as local files in OBS/Chrome (no server, no build
// step) — ES module scripts are also blocked entirely under file:// by
// Chromium's CORS rules, so even a CDN-hosted ESM build wouldn't work here.

// Escapes HTML special characters so raw chat text/usernames can never
// inject markup into the page. Exposed globally (not nested inside
// connectTwitchChat) since every consuming overlay needs it when building
// its own message markup around the html connectTwitchChat hands back.
function escapeHtml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Adds the 'is-emote-only' class to a message row when it contains exactly
// one emote and no other visible text (e.g. a chat that is just "PogChamp").
// Lets each overlay's CSS render solo emotes extra large. Call right after
// the overlay builds its own row markup; the row is expected to contain a
// ".message" span holding the html from connectTwitchChat's onMessage.
function markSoloEmote(row) {
    const message = row.querySelector('.message');
    if (message && message.querySelectorAll('.emote').length === 1 && message.textContent.trim() === '') {
        row.classList.add('is-emote-only');
    }
}

function connectTwitchChat({
    channel,
    twitchUserId,           // Numeric Twitch user ID, needed to query 7TV/BTTV for this channel's
                             // emotes (their APIs key channel lookups by ID, not login). This is
                             // public info, not a secret — safe to hardcode like the channel name.
    hideCommands = true,    // Drop messages that start with "!" (bot commands) to reduce noise.
    twitchClientId,         // Optional. Twitch API Client ID — used with twitchClientSecret to mint
                             // an app access token for fetching chat badges. Public info.
    twitchClientSecret,     // Optional. Twitch API Client Secret — used to mint a short-lived app
                             // access token (client-credentials flow) that lets us list global and
                             // channel-specific badge image URLs from Helix. Treat as a secret.
    onMessage,              // (displayName, color, html, badgesHtml) => void — called for each qualifying message.
} = {}) {
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
            console.warn(`Twitch Chat: failed to load ${url}`, err);
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
    // TWITCH BADGES
    // Badge image URLs come from the Twitch Helix API. Listing them (even the
    // global set) requires an app access token, which we mint at startup via
    // the OAuth client-credentials flow using twitchClientId + twitchClientSecret.
    // The result is a Map<"set_id/version", imageUrl> used to render small
    // inline badge images next to each user's name.
    // ---------------------------------------------------------------------
    const twitchBadges = new Map();

    // Mint a short-lived app access token (client_credentials grant). Returns
    // the token string, or null if we have no credentials or the request fails
    // (e.g. invalid client id/secret) — badges then simply don't render and
    // chat keeps working.
    async function getAppAccessToken() {
        if (!twitchClientId || !twitchClientSecret) return null;
        try {
            const res = await fetch('https://id.twitch.tv/oauth2/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    client_id: twitchClientId,
                    client_secret: twitchClientSecret,
                    grant_type: 'client_credentials',
                }),
            });
            if (!res.ok) {
                console.warn('Twitch Chat: failed to obtain app access token (HTTP', res.status, ')', await res.text().catch(() => ''));
                return null;
            }
            const json = await res.json();
            return json.access_token || null;
        } catch (err) {
            console.warn('Twitch Chat: failed to obtain app access token', err);
            return null;
        }
    }

    async function fetchBadgeSet(url, headers) {
        try {
            const res = await fetch(url, { headers });
            if (!res.ok) return;
            const json = await res.json();
            for (const badge of (json.data || [])) {
                // Use the highest version available per badge set.
                const versions = (badge.versions || []).slice().sort((a, b) => Number(b.id) - Number(a.id));
                if (versions.length > 0) {
                    const imgUrl = versions[0].image_url_2x || versions[0].image_url_1x;
                    if (imgUrl) twitchBadges.set(badge.set_id, imgUrl);
                }
            }
        } catch (err) {
            console.warn('Twitch Chat: failed to load badges from', url, err);
        }
    }

    async function loadTwitchBadges() {
        const token = await getAppAccessToken();
        if (!token || !twitchClientId) return; // No creds → no badges, chat still works.

        const headers = {
            'Authorization': `Bearer ${token}`,
            'Client-Id': twitchClientId,
        };

        // Global badges.
        await fetchBadgeSet('https://api.twitch.tv/helix/chat/badges/global', headers);

        // Channel-specific badges (e.g. custom subscriber tiers) for this broadcaster.
        // Written after the global set so channel custom badges override global ones.
        if (twitchUserId) {
            await fetchBadgeSet(
                `https://api.twitch.tv/helix/chat/badges?broadcaster_id=${twitchUserId}`,
                headers
            );
        }
    }

    // Renders the badge HTML for a message. The tags.badges string from Twitch
    // looks like "subscriber/2,broadcaster/1" — comma-separated name/version
    // pairs. Each badge is looked up in the twitchBadges map (which may contain
    // either channel-specific or global URLs for that set). Channel-specific
    // entries override global ones since loadTwitchBadges writes global first.
    function renderBadges(badgesTagValue) {
        if (!badgesTagValue) return '';
        const parts = badgesTagValue.split(',').filter(Boolean);
        const imgs = [];
        for (const part of parts) {
            const slashIdx = part.indexOf('/');
            const set_id = slashIdx === -1 ? part : part.slice(0, slashIdx);
            const version = slashIdx === -1 ? '' : part.slice(slashIdx + 1);
            // Check for channel-specific badge first (set_id includes version),
            // then fall back to just the set_id (global badge).
            const url = twitchBadges.get(`${set_id}/${version}`) || twitchBadges.get(set_id);
            if (url) {
                imgs.push(`<img class="badge" src="${url}" alt="${escapeHtml(set_id)}" title="${escapeHtml(set_id)}">`);
            }
        }
        if (imgs.length === 0) return '';
        return `<span class="badges">${imgs.join('')}</span>`;
    }

    // ---------------------------------------------------------------------
    // MESSAGE RENDERING
    // Two passes: first swap out native Twitch emotes using the exact
    // character ranges Twitch gives us in the message's "emotes" IRCv3 tag,
    // then scan whatever plain text is left word-by-word against the
    // 7TV/BTTV/FFZ map built above. Everything else gets HTML-escaped so raw
    // chat text can never inject markup into the page.
    // ---------------------------------------------------------------------

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

    // Explicitly forces the "Share Tech Mono" web font to load and waits for
    // it (rather than relying on document.fonts.ready, which can resolve
    // immediately if the font hasn't been used to render anything yet).
    // Overlays whose message boxes are sized to fit their text (e.g.
    // chat-popup's randomly-positioned toasts) depend on final font metrics
    // being known before the very first message is measured/positioned, so
    // no message is ever delivered until this settles.
    async function waitForFont() {
        try {
            await document.fonts.load("22px 'Share Tech Mono'");
            await document.fonts.ready;
        } catch (err) {
            console.warn('Twitch Chat: font loading check failed, continuing anyway', err);
        }
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
            const badgesHtml = renderBadges(tags.badges);

            onMessage(displayName, color, html, badgesHtml);
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
            console.warn('Twitch Chat: disconnected from Twitch chat, reconnecting in 3s...');
            setTimeout(connectToChat, 3000);
        });

        ws.addEventListener('error', (err) => {
            console.error('Twitch Chat: connection error', err);
        });
    }

    // Load third-party emotes, Twitch badges, and make sure the custom font
    // is ready before connecting so the very first message is never
    // mismeasured/mispositioned by a consuming overlay; if any of these fail
    // for any reason we still connect to chat (plain text/fallback font beats
    // no chat at all).
    Promise.all([loadThirdPartyEmotes(), loadTwitchBadges(), waitForFont()]).finally(connectToChat);
}
