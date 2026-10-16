/* =========================================================
   ORBIT - app logic (no frameworks, no build step)
   You normally never need to edit this file.
   Content lives in: MUSIC/, COVERS/, LYR/, PLAYLISTS/, VAULT/, config.js
   ========================================================= */
(() => {
'use strict';

/* ---------------- basics ---------------- */
const SITE = Object.assign({ name: 'ORBIT', tagline: '', owner: '', contact: {}, about: '', terms: [], defaultPalette: 'evergreen', defaultMode: 'dark' }, window.SITE || {});
const LIB = window.LIBRARY || { songs: [], playlists: [], artists: {}, generated: null };
const VERSION = '1.2.0';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = (s) => String(s ?? '').toLowerCase().replace(/ı/g, 'i').replace(/ə/g, 'e')
  .normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
const enc = (p) => /^(blob:|data:)/.test(String(p || '')) ? p : String(p || '').split('/').map(encodeURIComponent).join('/');
const abs = (u) => new URL(u, location.href).href;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const shuffled = (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
const hash = (str) => { let h = 7; for (const ch of String(str)) h = (h * 31 + ch.codePointAt(0)) >>> 0; return h; };
const gIdx = (seed) => hash(seed) % 6;
const fmt = (sec) => { if (!isFinite(sec) || sec < 0) return '0:00'; sec = Math.floor(sec); const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s).padStart(2, '0'); };
const fmtLong = (sec) => { const m = Math.max(1, Math.round(sec / 60)); if (m < 60) return `${m} min`; return `${Math.floor(m / 60)} hr ${m % 60} min`; };
const enc64 = (s) => encodeURIComponent(s);

/* share codes: playlist snapshot packed into the link (no server needed) */
const packCode = (obj) => btoa(unescape(encodeURIComponent(JSON.stringify(obj)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unpackCode = (code) => { try { const b = String(code).replace(/-/g, '+').replace(/_/g, '/'); return JSON.parse(decodeURIComponent(escape(atob(b + '==='.slice((b.length + 3) % 4))))); } catch { return null; } };

const store = {
  get(k, d) { try { const v = localStorage.getItem('orbit.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('orbit.' + k, JSON.stringify(v)); } catch { /* storage full / private mode */ } },
  del(k) { try { localStorage.removeItem('orbit.' + k); } catch { } },
};

/* ---------------- palettes (CSS holds the full colour sets) ---------------- */
const PALETTES = {
  evergreen: { name: 'Evergreen',     sw: ['#121212', '#2A2A2A', '#1DB954', '#B3B3B3', '#FFFFFF'] },
  gold:      { name: 'Midnight Gold', sw: ['#000000', '#14213D', '#FCA311', '#E5E5E5', '#FFFFFF'] },
  ocean:     { name: 'Deep Ocean',    sw: ['#020B12', '#0E2838', '#2DD4BF', '#7DD3FC', '#F2F8FB'] },
  ember:     { name: 'Ember',         sw: ['#0A0605', '#261815', '#FF6B35', '#FFB347', '#FFF8F3'] },
  aurora:    { name: 'Aurora',        sw: ['#0A0A0F', '#1E1E29', '#A78BFA', '#22D3EE', '#F5F5F9'] },
  forest:    { name: 'Forest',        sw: ['#050A07', '#14261C', '#A3E635', '#34D399', '#F4F9F2'] },
  mono:      { name: 'Mono',          sw: ['#000000', '#1C1C1C', '#FFFFFF', '#9A9A9A', '#FAFAFA'] },
};

/* ---------------- icons (original line set) ---------------- */
const P_ = (d, extra = '') => `<path d="${d}" ${extra}/>`;
const ICONS = {
  logo: `<circle cx="12" cy="12" r="3.2" fill="currentColor" stroke="none"/><ellipse cx="12" cy="12" rx="10" ry="4.6" transform="rotate(-28 12 12)"/><circle cx="20.2" cy="7.6" r="1.4" fill="currentColor" stroke="none"/>`,
  home: P_('M3.5 10.2 12 3.5l8.5 6.7V20a.8.8 0 0 1-.8.8H15v-6.3H9v6.3H4.3a.8.8 0 0 1-.8-.8z'),
  homeFill: P_('M3.5 10.2 12 3.5l8.5 6.7V20a.8.8 0 0 1-.8.8H15v-6.3H9v6.3H4.3a.8.8 0 0 1-.8-.8z', 'fill="currentColor"'),
  search: `<circle cx="10.8" cy="10.8" r="6.8"/>${P_('m20.5 20.5-4.9-4.9')}`,
  searchBold: `<circle cx="10.8" cy="10.8" r="6.8" stroke-width="2.8"/>${P_('m20.5 20.5-4.9-4.9', 'stroke-width="2.8"')}`,
  library: P_('M4.5 3.5v17M9.5 3.5v17M14 4.2l5.8 16'),
  libraryFill: P_('M4.5 3.5v17M9.5 3.5v17M14 4.2l5.8 16', 'stroke-width="2.8"'),
  spark: P_('M12 2.5c.6 4.6 2.9 6.9 7.5 7.5v.1c-4.6.6-6.9 2.9-7.5 7.5h-.1C11.3 13 9 10.7 4.5 10.1V10C9 9.4 11.3 7.1 11.9 2.5z', 'fill="currentColor"') + P_('M19 15.5c.2 1.6 1 2.4 2.5 2.6-1.5.2-2.3 1-2.5 2.6-.2-1.6-1-2.4-2.6-2.6 1.6-.2 2.4-1 2.6-2.6z', 'fill="currentColor" stroke="none"'),
  play: P_('M7.2 4.6v14.8a1 1 0 0 0 1.5.86l12.3-7.4a1 1 0 0 0 0-1.72L8.7 3.74a1 1 0 0 0-1.5.86z', 'fill="currentColor" stroke="none"'),
  pause: `<rect x="6" y="4" width="4.2" height="16" rx="1.2" fill="currentColor" stroke="none"/><rect x="13.8" y="4" width="4.2" height="16" rx="1.2" fill="currentColor" stroke="none"/>`,
  next: P_('M5 5.3v13.4a.8.8 0 0 0 1.2.68l10.3-6.7a.8.8 0 0 0 0-1.36L6.2 4.62A.8.8 0 0 0 5 5.3z', 'fill="currentColor" stroke="none"') + `<rect x="17.4" y="4.5" width="2.4" height="15" rx="1" fill="currentColor" stroke="none"/>`,
  prev: P_('M19 5.3v13.4a.8.8 0 0 1-1.2.68L7.5 12.68a.8.8 0 0 1 0-1.36l10.3-6.7A.8.8 0 0 1 19 5.3z', 'fill="currentColor" stroke="none"') + `<rect x="4.2" y="4.5" width="2.4" height="15" rx="1" fill="currentColor" stroke="none"/>`,
  shuffle: P_('M16 3.5h4.5V8M3.5 19.5 20.5 3.5M20.5 16v4.5H16M14.5 14.5l6 6M3.5 4.5l5 5'),
  repeat: P_('M17 2.5l3.5 3.5-3.5 3.5M3.5 11V9.5A3.5 3.5 0 0 1 7 6h13.5M7 21.5 3.5 18 7 14.5M20.5 13v1.5A3.5 3.5 0 0 1 17 18H3.5'),
  repeat1: P_('M17 2.5l3.5 3.5-3.5 3.5M3.5 11V9.5A3.5 3.5 0 0 1 7 6h13.5M7 21.5 3.5 18 7 14.5M20.5 13v1.5A3.5 3.5 0 0 1 17 18H3.5') + `<text x="12" y="14.6" font-size="7.5" font-weight="800" text-anchor="middle" fill="currentColor" stroke="none" font-family="system-ui">1</text>`,
  heart: P_('M12 20.3s-7.6-4.5-9.4-9.1C1.3 7.9 3.5 4.4 7.1 4.4c2 0 3.6 1.1 4.9 2.8 1.3-1.7 2.9-2.8 4.9-2.8 3.6 0 5.8 3.5 4.5 6.8-1.8 4.6-9.4 9.1-9.4 9.1z'),
  heartFill: P_('M12 20.3s-7.6-4.5-9.4-9.1C1.3 7.9 3.5 4.4 7.1 4.4c2 0 3.6 1.1 4.9 2.8 1.3-1.7 2.9-2.8 4.9-2.8 3.6 0 5.8 3.5 4.5 6.8-1.8 4.6-9.4 9.1-9.4 9.1z', 'fill="currentColor"'),
  more: `<circle cx="5" cy="12" r="1.7" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.7" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.7" fill="currentColor" stroke="none"/>`,
  back: P_('M15 18.5 8.5 12 15 5.5'),
  down: P_('M5.5 9 12 15.5 18.5 9'),
  dl: `<circle cx="12" cy="12" r="9.3"/>${P_('M12 7.3v8.4M8.4 12.3l3.6 3.6 3.6-3.6')}`,
  dlFill: `<circle cx="12" cy="12" r="10" fill="currentColor" stroke="none"/>${P_('M12 7.3v8.4M8.4 12.3l3.6 3.6 3.6-3.6', 'stroke="var(--bg)" stroke-width="2.2"')}`,
  share: P_('M12 14.5V3.5M7.8 7.6 12 3.4l4.2 4.2M5.5 11.5V19a1.5 1.5 0 0 0 1.5 1.5h10a1.5 1.5 0 0 0 1.5-1.5v-7.5'),
  queue: P_('M3.5 6h13M3.5 11h13M3.5 16h7') + P_('M15.5 14v6.4l5-3.2z', 'fill="currentColor"'),
  mic: `<rect x="9" y="2.8" width="6" height="11" rx="3"/>${P_('M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5v3.5')}`,
  plus: P_('M12 5v14M5 12h14'),
  close: P_('M6 6l12 12M18 6 6 18'),
  sliders: P_('M4 6.5h9M17 6.5h3M4 12h3M11 12h9M4 17.5h11M19 17.5h1') + `<circle cx="15" cy="6.5" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="17.5" r="2"/>`,
  clock: `<circle cx="12" cy="12" r="9"/>${P_('M12 7v5.2l3.3 2')}`,
  info: `<circle cx="12" cy="12" r="9"/>${P_('M12 11v5.5M12 7.6v.4')}`,
  help: `<circle cx="12" cy="12" r="9"/>${P_('M9.6 9.3a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .9-1 1.6v.6M12 16.8v.4')}`,
  doc: P_('M6.5 2.8h8l4 4v14.4h-12zM14 2.8v4.5h4.5M9.5 12.5h6M9.5 16.5h4.5'),
  mail: `<rect x="3" y="5" width="18" height="14" rx="2"/>${P_('M3.5 6.5 12 13l8.5-6.5')}`,
  moon: P_('M20 14.6A8.2 8.2 0 0 1 9.4 4a8.2 8.2 0 1 0 10.6 10.6z'),
  palette: P_('M12 3a9 9 0 1 0 0 18c1.2 0 1.8-.9 1.4-1.9-.5-1.2.3-2.3 1.6-2.3H17a4 4 0 0 0 4-4C21 7 17 3 12 3z') + `<circle cx="7.5" cy="11" r="1.2" fill="currentColor"/><circle cx="10.5" cy="7" r="1.2" fill="currentColor"/><circle cx="15.5" cy="7.5" r="1.2" fill="currentColor"/>`,
  sort: P_('M7 4v16M3.5 16.5 7 20l3.5-3.5M13.5 6h7M13.5 12h5M13.5 18h3'),
  grid: `<rect x="4" y="4" width="6.5" height="6.5" rx="1.2"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.2"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.2"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.2"/>`,
  list: P_('M8.5 6h12M8.5 12h12M8.5 18h12M4 6h.5M4 12h.5M4 18h.5'),
  timer: `<circle cx="12" cy="13.3" r="7.7"/>${P_('M12 9.3v4.2l2.6 1.8M9.3 2.8h5.4')}`,
  check: P_('M5 12.5 9.5 17 19 7.2'),
  trash: P_('M4 6.5h16M9.5 6.5V4h5v2.5M6.5 6.5l1 13.5h9l1-13.5M10.3 10.5v6M13.7 10.5v6'),
  note: P_('M9 18V5.5l11-2V16') + `<circle cx="6.3" cy="18" r="2.8"/><circle cx="17.3" cy="16" r="2.8"/>`,
  user: `<circle cx="12" cy="8" r="4"/>${P_('M4.5 20.5c1.2-3.6 4-5.5 7.5-5.5s6.3 1.9 7.5 5.5')}`,
  vol: P_('M4 9.3v5.4h3.6L12.5 19V5L7.6 9.3z', 'fill="currentColor"') + P_('M16 8.8a4.6 4.6 0 0 1 0 6.4M18.6 6.2a8.3 8.3 0 0 1 0 11.6'),
  mute: P_('M4 9.3v5.4h3.6L12.5 19V5L7.6 9.3z', 'fill="currentColor"') + P_('M16.5 9.5l5 5M21.5 9.5l-5 5'),
  expand: P_('M14.5 3.5h6v6M9.5 20.5h-6v-6M20.5 3.5 14 10M3.5 20.5 10 14'),
  edit: P_('M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17v3zM14.5 7.5l3 3'),
  addList: P_('M3.5 6h12M3.5 11h12M3.5 16h7M18 13.5v7M14.5 17h7'),
  save: P_('M12 3.5v11M7.5 10 12 14.5 16.5 10M4.5 17.5v2.5h15v-2.5'),
  link: P_('M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1'),
  bolt: P_('M13 2.5 4.5 13.5H11l-1 8 8.5-11H12z'),
  pin: P_('M9 3.5h6l-1 6 3.5 3.5v1.5h-11V13L10 9.5zM12 14.5V21', 'fill="currentColor"'),
  libAdd: P_('M4.5 3.5v17M9.5 3.5v17M14 4.2l2.4 6.6') + P_('M18.5 13.5v7M15 17h7'),
  lock: `<rect x="4.5" y="10.5" width="15" height="10" rx="2"/>${P_('M8 10.5V7.5a4 4 0 0 1 8 0v3')}`,
  unlock: `<rect x="4.5" y="10.5" width="15" height="10" rx="2"/>${P_('M8 10.5V7.5a4 4 0 0 1 7.7-1.5')}`,
  crown: P_('M3.5 8l4.2 3.5L12 5l4.3 6.5L20.5 8l-1.8 10.5H5.3z', 'fill="currentColor"'),
};
const I = (name, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;

/* ---------------- library indexes ---------------- */
const SONGS = [];
const SONG = new Map();
const PLAYLISTS = [];
const PL = new Map();
const ARTISTS = new Map();   // name -> {name, songs:[], cover}
const GENRES = new Map();
const YEARS = new Map();
const durCache = store.get('dur', {});
const dur = (s) => (s && (s.duration || durCache[s.id])) || 0;

function indexSong(s) {
  if (!s || !s.id || !s.file || SONG.has(s.id)) return;
  s.artists = s.artists && s.artists.length ? s.artists : [s.artist || 'Unknown artist'];
  s.artist = s.artist || s.artists.join(', ');
  SONGS.push(s); SONG.set(s.id, s);
  for (const a of s.artists) { if (!ARTISTS.has(a)) ARTISTS.set(a, { name: a, songs: [], cover: null, vault: true }); const A = ARTISTS.get(a); A.songs.push(s.id); if (!s.vault) A.vault = false; }
  if (s.genre) { if (!GENRES.has(s.genre)) GENRES.set(s.genre, []); GENRES.get(s.genre).push(s.id); }
  if (s.year) { if (!YEARS.has(String(s.year))) YEARS.set(String(s.year), []); YEARS.get(String(s.year)).push(s.id); }
}
function indexPlaylist(p) {
  const pl = { ...p, songs: (p.songs || []).filter((id) => SONG.has(id)) };
  PLAYLISTS.push(pl); PL.set(pl.id, pl);
}
function setArtistCovers(map) { for (const [name, v] of Object.entries(map || {})) { const A = ARTISTS.get(name); if (A && v && v.cover) A.cover = v.cover; } }
function buildHaystacks() {
  for (const s of SONGS) {
    const inPl = PLAYLISTS.filter((p) => p.songs.includes(s.id)).map((p) => p.title).join(' ');
    s._t = norm(s.title); s._a = norm(s.artist); s._g = norm(s.genre);
    s._hay = norm([s.title, s.artist, s.genre, s.year, s.dateText, inPl].join(' '));
    s._words = s._hay.split(' ');
    s._ly = s.lyrics ? norm(s.lyrics) : '';
  }
}
(LIB.songs || []).forEach(indexSong);
(LIB.playlists || []).forEach(indexPlaylist);
setArtistCovers(LIB.artists);
buildHaystacks();

const byRelease = (a, b) => String(SONG.get(b).date || SONG.get(b).year || '').localeCompare(String(SONG.get(a).date || SONG.get(a).year || ''));
const latestIds = () => SONGS.slice().sort((a, b) => String(b.added || '').localeCompare(String(a.added || '')) || String(b.date || '').localeCompare(String(a.date || ''))).map((s) => s.id);

/* ---------------- user state (this device only) ---------------- */
const U = {
  liked: store.get('liked', []),
  local: store.get('local', []),
  history: store.get('history', []),
  recents: store.get('recents', []),
  searches: store.get('searches', []),
  dl: new Set(store.get('dl', [])),
  settings: Object.assign({ mode: SITE.defaultMode || 'dark', palette: SITE.defaultPalette || 'evergreen', showLyrics: true, resume: true, libView: 'list', libSort: 'recents' }, store.get('settings', {})),
};
if (!store.get('palV2', false)) { U.settings.palette = SITE.defaultPalette || 'evergreen'; store.set('palV2', true); store.set('settings', U.settings); }
if (!(U.settings.palette in PALETTES)) U.settings.palette = 'evergreen';
U.recents = U.recents.filter((x) => x.type !== 'album' && (x.type !== 'warp' || x.id === ''));
const isLiked = (id) => U.liked.some((x) => x.id === id);
const saveU = (k) => store.set(k, k === 'dl' ? [...U.dl] : U[k]);

function toggleLike(id) {
  if (!SONG.has(id)) return;
  if (isLiked(id)) { U.liked = U.liked.filter((x) => x.id !== id); toast('Removed from Liked Songs'); }
  else { U.liked.unshift({ id, t: Date.now() }); toast('Added to Liked Songs'); }
  saveU('liked'); refreshLikes(); renderSidebar();
  if (['liked', 'library', 'track'].includes(route().r)) render(true);
}
function pushHistory(id) {
  if (U.history[0]?.id === id && Date.now() - U.history[0].t < 30000) return;
  U.history = [{ id, t: Date.now() }, ...U.history].slice(0, 300);
  saveU('history');
}
function pushRecent(type, id) {
  if (['track', 'search', 'shared', 'queue'].includes(type)) return;
  if (type === 'warp') id = '';
  U.recents = [{ type, id, t: Date.now() }, ...U.recents.filter((x) => !(x.type === type && x.id === id))].slice(0, 40);
  saveU('recents');
}
function pushSearch(kind, id) {
  U.searches = [{ kind, id }, ...U.searches.filter((x) => !(x.kind === kind && x.id === id))].slice(0, 20);
  saveU('searches');
}

/* ---------------- collections ---------------- */
const realLiked = () => U.liked.map((x) => x.id).filter((id) => SONG.has(id));
function coll(type, id = '') {
  switch (type) {
    case 'playlist': { const p = PL.get(id); if (!p) return null;
      return { type, id, title: p.title, desc: p.description, cover: p.cover, songs: p.songs, kind: 'Playlist', created: p.created, section: p.section, vault: !!p.vault }; }
    case 'local': { const p = U.local.find((x) => x.id === id); if (!p) return null;
      return { type, id, title: p.title, desc: p.from ? 'Shared with you · saved on this device' : 'Your playlist · saved on this device', songs: p.songs.filter((x) => SONG.has(x)), kind: 'Playlist', created: p.created, local: true }; }
    case 'shared': { const d = unpackCode(id); if (!d || !Array.isArray(d.s)) return null;
      const songs = d.s.filter((x) => SONG.has(x));
      return { type, id, title: String(d.t || 'Shared playlist').slice(0, 80), desc: `Shared playlist${d.s.length > songs.length ? ` · ${d.s.length - songs.length} song(s) not available here` : ''}`, songs, kind: 'Playlist', shared: true }; }
    case 'liked': return { type, id: '', title: 'Liked Songs', songs: realLiked(), kind: 'Playlist', special: 'liked', desc: 'Saved on this device' };
    case 'downloads': return { type, id: '', title: 'Downloaded', songs: SONGS.filter((s) => U.dl.has(s.id)).map((s) => s.id), kind: 'Playlist', special: 'downloads', desc: 'Available offline on this device' };
    case 'artist': { const a = ARTISTS.get(id); if (!a) return null;
      return { type, id, title: a.name, songs: a.songs.slice().sort(byRelease), kind: 'Artist', round: true, cover: a.cover, vault: a.vault }; }
    case 'genre': { const g = GENRES.get(id); if (!g) return null; return { type, id, title: id, songs: g, kind: 'Genre mix', desc: `The best of ${id} in the library` }; }
    case 'year': { const y = YEARS.get(String(id)); if (!y) return null; return { type, id, title: `Released in ${id}`, songs: y, kind: 'Year mix' }; }
    case 'all': return { type, id: '', title: 'All songs', songs: SONGS.map((s) => s.id), kind: 'Everything' };
    case 'latest': return { type, id: '', title: 'Latest songs', songs: latestIds(), kind: 'Fresh uploads', desc: 'Newest additions first' };
    case 'search': { const r = searchAll(id); return { type, id, title: `Search: “${id}”`, songs: r.songs.map((x) => x.s.id), kind: 'Search results' }; }
    case 'track': { const s = SONG.get(id); if (!s) return null; return { type, id, title: s.title, songs: [id], kind: 'Song', song: s }; }
    case 'warp': {
      const [k, ...v] = String(id || '').split(':'); const val = v.join(':');
      let ids = SONGS.map((s) => s.id), label = '';
      if (k === 'genre') { ids = GENRES.get(val) || []; label = val; }
      else if (k === 'year') { ids = YEARS.get(val) || []; label = val; }
      else if (k === 'artist') { ids = (ARTISTS.get(val) || { songs: [] }).songs; label = val; }
      else if (k === 'unplayed') { const h = new Set(U.history.map((x) => x.id)); ids = ids.filter((x) => !h.has(x)); label = 'Never played'; }
      else if (k === 'liked') { ids = realLiked(); label = 'Liked'; }
      return { type, id: id || '', title: label ? `Warp · ${label}` : 'Warp', songs: ids, kind: 'Endless shuffle', special: 'warp' };
    }
    default: return null;
  }
}
const collHref = (c) => c.type === 'warp' ? '#/warp' : `#/${c.type}${c.id !== '' && c.id != null ? '/' + enc64(c.id) : ''}`;
const collSub = (c) => {
  if (c.type === 'artist') return c.vault ? 'Artist · Premium' : 'Artist';
  if (c.local) return 'Playlist · You';
  if (c.vault) return 'Playlist · Premium';
  if (c.type === 'liked' || c.type === 'downloads') return `Playlist · ${c.songs.length} song${c.songs.length === 1 ? '' : 's'}`;
  return `${c.kind} · ${SITE.name}`;
};
const totalDur = (ids) => { let t = 0, known = true; for (const id of ids) { const d = dur(SONG.get(id)); if (!d) known = false; t += d; } return { t, known }; };

/* ---------------- covers ---------------- */
const img = (src) => `<img src="${esc(enc(src))}" alt="" loading="lazy" decoding="async" draggable="false">`;
const ph = (seed, text, icon = 'note') => `<div class="ph g${gIdx(seed)}">${text ? esc(text) : I(icon)}</div>`;
const songCover = (s, cls = '') => `<div class="cover ${cls}">${s && s.cover ? img(s.cover) : ph((s && s.title) || 'x')}</div>`;
const initials = (s) => String(s).split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
function collCover(c, cls = '') {
  if (!c) return `<div class="cover ${cls}">${ph('x')}</div>`;
  if (c.special === 'liked') return `<div class="cover ${cls}"><div class="ph liked">${I('heartFill')}</div></div>`;
  if (c.special === 'downloads') return `<div class="cover ${cls}"><div class="ph dl">${I('dl')}</div></div>`;
  if (c.special === 'warp') return `<div class="cover ${cls}"><div class="ph warp">${I('spark')}</div></div>`;
  if (c.cover) return `<div class="cover ${cls}">${img(c.cover)}</div>`;
  if (c.type === 'track') return songCover(c.song, cls);
  if (c.type === 'artist') return `<div class="cover ${cls}">${ph(c.title, initials(c.title))}</div>`;
  const covers = [...new Set(c.songs.map((id) => SONG.get(id)?.cover).filter(Boolean))];
  if (covers.length >= 4) return `<div class="cover mosaic ${cls}">${covers.slice(0, 4).map(img).join('')}</div>`;
  if (covers.length) return `<div class="cover ${cls}">${img(covers[0])}</div>`;
  return `<div class="cover ${cls}">${ph(c.title, c.title)}</div>`;
}

/* dominant colour of artwork -> background tint (null = use palette default) */
const tintCache = new Map();
function tintFor(src) {
  if (!src) return Promise.resolve(null);
  if (tintCache.has(src)) return Promise.resolve(tintCache.get(src));
  return new Promise((res) => {
    const im = new Image();
    im.onload = () => {
      try {
        const c = document.createElement('canvas'); c.width = c.height = 24;
        const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(im, 0, 0, 24, 24);
        const d = x.getImageData(0, 0, 24, 24).data; let r = 0, g = 0, b = 0, w = 0;
        for (let i = 0; i < d.length; i += 4) {
          const mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]);
          const wt = 1 + (mx - mn) / 32; r += d[i] * wt; g += d[i + 1] * wt; b += d[i + 2] * wt; w += wt;
        }
        const [h, s, l] = rgb2hsl(r / w, g / w, b / w);
        const out = `hsl(${Math.round(h)} ${Math.round(clamp(s, .15, .55) * 100)}% ${Math.round(clamp(l, .2, .32) * 100)}%)`;
        tintCache.set(src, out); res(out);
      } catch { res(null); }
    };
    im.onerror = () => res(null);
    im.src = enc(src);
  });
}
function rgb2hsl(r, g, b) {
  r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let h = 0, s = 0; const l = (mx + mn) / 2;
  if (mx !== mn) { const d = mx - mn; s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn);
    h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; }
  return [h, s, l];
}
const setTint = (el, c) => { if (!el) return; if (c) el.style.setProperty('--tint', c); else el.style.removeProperty('--tint'); };
const collCoverSrc = (c) => c.cover || (c.type === 'track' ? c.song.cover : c.songs.map((id) => SONG.get(id)?.cover).find(Boolean)) || null;

/* ---------------- toast ---------------- */
let toastT;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2200);
}

/* =========================================================
   Premium vault (password-protected, encrypted content)
   The VAULT/ folder on GitHub only contains encrypted data.
   Nothing can be read without the password: no song names,
   no artists, no audio. The password itself is NOT stored on
   GitHub; after unlocking, only the derived key is remembered
   in this browser.
   ========================================================= */
const VAULT_URL = 'VAULT/vault.bin';
const V = { key: null, loaded: false, urls: new Map(), pending: new Map(), count: 0 };
const b64 = (bytes) => { let s = ''; for (const x of new Uint8Array(bytes)) s += String.fromCharCode(x); return btoa(s); };
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
async function fetchBin(path) {
  const r = await fetch(enc(path), { cache: 'no-cache' });
  if (!r.ok) throw new Error(r.status === 404 ? 'missing' : 'network');
  return new Uint8Array(await r.arrayBuffer());
}
function vaultHeader(b) {
  if (String.fromCharCode(...b.slice(0, 5)) !== 'ORBV1') throw new Error('format');
  const iter = new DataView(b.buffer, b.byteOffset + 5, 4).getUint32(0);
  return { iter, salt: b.slice(9, 25), iv: b.slice(25, 37), ct: b.slice(37) };
}
async function deriveKey(pw, salt, iter) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, true, ['decrypt']);
}
const aesOpen = async (key, iv, ct) => new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct));
async function decryptFile(path) { const b = await fetchBin(path); return aesOpen(V.key, b.slice(0, 12), b.slice(12)); }
async function decryptToURL(path, mime) { return URL.createObjectURL(new Blob([await decryptFile(path)], { type: mime || 'application/octet-stream' })); }

async function openVault(password) {
  if (!window.crypto || !crypto.subtle) throw new Error('insecure');
  const h = vaultHeader(await fetchBin(VAULT_URL));
  let key;
  if (password) key = await deriveKey(password, h.salt, h.iter);
  else { const st = store.get('vault', null); if (!st || !st.k) throw new Error('nokey'); key = await crypto.subtle.importKey('raw', unb64(st.k), 'AES-GCM', true, ['decrypt']); }
  let m;
  try { m = JSON.parse(new TextDecoder().decode(await aesOpen(key, h.iv, h.ct))); } catch { throw new Error('wrong'); }
  if (password) store.set('vault', { k: b64(await crypto.subtle.exportKey('raw', key)) });
  V.key = key;
  await mergeVault(m);
  return m;
}
async function mergeVault(m) {
  if (V.loaded) return;
  const cov = async (o) => { if (o && o.cover) { o.coverEnc = o.cover; try { o.cover = await decryptToURL(o.cover, o.coverMime); } catch { o.cover = null; } } };
  const songs = m.songs || [], pls = m.playlists || [], arts = Object.entries(m.artists || {});
  await Promise.allSettled([...songs.map(cov), ...pls.map(cov), ...arts.map(([, a]) => cov(a))]);
  songs.forEach((s) => { s.vault = true; indexSong(s); });
  pls.forEach((p) => indexPlaylist({ ...p, vault: true }));
  setArtistCovers(Object.fromEntries(arts));
  buildHaystacks();
  V.loaded = true; V.count = songs.length;
}
/* decrypted audio is kept in memory for a few songs only */
function vaultURL(s) {
  if (V.urls.has(s.id)) return Promise.resolve(V.urls.get(s.id));
  if (V.pending.has(s.id)) return V.pending.get(s.id);
  const p = decryptToURL(s.file, s.mime).then((u) => {
    V.urls.set(s.id, u); V.pending.delete(s.id);
    for (const [id, url] of V.urls) { if (V.urls.size <= 4) break; if (id !== PS.cur && id !== s.id) { URL.revokeObjectURL(url); V.urls.delete(id); } }
    return u;
  }, (e) => { V.pending.delete(s.id); throw e; });
  V.pending.set(s.id, p);
  return p;
}
async function unlockVault(pw) {
  try { await openVault(pw); toast('Premium unlocked'); render(true); renderSidebar(); }
  catch (e) {
    const msg = { wrong: 'Wrong password', missing: 'No premium content on this site yet', insecure: 'Open the https site to unlock', network: 'No connection, try again' }[e.message] || 'Could not unlock';
    toast(msg);
  }
}
function lockVault() { store.del('vault'); location.reload(); }

/* =========================================================
   Playback engine
   ========================================================= */
const audio = $('#audio');
const saved = store.get('player', null);
const PS = {
  ctx: null, base: [], queue: [], idx: -1, manual: [], cur: null,
  shuffle: store.get('shuffle', false),
  repeat: store.get('repeat', 'off'),
  want: false, errs: 0, sleep: null, pendingSeek: 0,
};
const songURL = (s) => enc(s.file);
const isPlaying = () => !audio.paused && !audio.ended && !isSilent();
const sameCtx = (type, id) => !!PS.ctx && PS.ctx.type === type && String(PS.ctx.id) === String(id ?? '');
/* tiny silent sound: lets iPhone start encrypted songs that need a moment to decrypt */
const SILENT = (() => { const n = 800, b = new Uint8Array(44 + n), v = new DataView(b.buffer); const w = (o, s) => [...s].forEach((c, i) => b[o + i] = c.charCodeAt(0));
  w(0, 'RIFF'); v.setUint32(4, 36 + n, true); w(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true); w(36, 'data'); v.setUint32(40, n, true); b.fill(128, 44);
  return 'data:audio/wav;base64,' + b64(b); })();
const isSilent = () => String(audio.getAttribute('src') || '').startsWith('data:');
let loadTok = 0, primed = false;

function playColl(c, startId = null, opts = {}) {
  if (!c || !c.songs.length) { toast('Nothing to play here yet'); return; }
  PS.ctx = { type: c.type, id: c.id, title: c.title };
  PS.base = c.songs.slice();
  PS.manual = [];
  const shuf = opts.forceShuffle || PS.shuffle;
  const start = startId && PS.base.includes(startId) ? startId : (shuf ? PS.base[(Math.random() * PS.base.length) | 0] : PS.base[0]);
  PS.queue = shuf ? [start, ...shuffled(PS.base.filter((x) => x !== start))] : PS.base.slice();
  PS.idx = PS.queue.indexOf(start);
  pushRecent(c.type, c.id);
  load(start, true);
}
function load(id, autoplay, at = 0) {
  const s = SONG.get(id); if (!s) return;
  PS.cur = id; PS.want = autoplay; PS.pendingSeek = at;
  const tok = ++loadTok;
  if (s.vault) {
    if (autoplay && !primed) { audio.src = SILENT; audio.play().catch(() => {}); }
    vaultURL(s).then((u) => {
      if (tok !== loadTok) return;
      audio.src = u; if (autoplay) audio.play().catch(() => {});
      prefetchNext();
    }).catch(() => {
      if (tok !== loadTok) return;
      toast(`Can't open “${s.title}”`);
      if (autoplay && ++PS.errs < 6) setTimeout(() => next(false), 900);
    });
  } else {
    audio.src = songURL(s);
    if (autoplay) audio.play().catch(() => {});
    prefetchNext();
  }
  if (autoplay) pushHistory(id);
  updateNowPlaying();
  saveState();
}
function prefetchNext() {
  const id = PS.manual[0] || PS.queue[PS.idx + 1]; const s = SONG.get(id);
  if (s && s.vault) vaultURL(s).catch(() => {});
}
function toggle() {
  if (!PS.cur) { playColl(coll('warp', ''), null, { forceShuffle: true }); return; }
  if (isPlaying()) { audio.pause(); PS.want = false; }
  else if (isSilent() || !audio.getAttribute('src')) { load(PS.cur, true, PS.pendingSeek); }
  else { PS.want = true; audio.play().catch(() => toast('Tap play again to start')); }
}
function next(auto = false) {
  if (!PS.cur) return;
  if (auto && PS.repeat === 'one') { audio.currentTime = 0; audio.play().catch(() => {}); return; }
  if (PS.manual.length) { load(PS.manual.shift(), true); return; }
  if (PS.idx + 1 < PS.queue.length) { PS.idx++; load(PS.queue[PS.idx], true); return; }
  if (PS.repeat !== 'off' || PS.ctx?.type === 'warp') {
    if (PS.shuffle || PS.ctx?.type === 'warp') PS.queue = shuffled(PS.base);
    PS.idx = 0; load(PS.queue[0], true); return;
  }
  PS.idx = 0; load(PS.queue[0], false);
  if (!auto) toast('Back to the start');
}
function prev() {
  if (!PS.cur) return;
  if (audio.currentTime > 3) { audio.currentTime = 0; return; }
  if (PS.idx >= 0 && PS.queue[PS.idx] !== PS.cur) { load(PS.queue[PS.idx], true); return; }
  if (PS.idx > 0) { PS.idx--; load(PS.queue[PS.idx], true); return; }
  audio.currentTime = 0;
}
function setShuffle(on, silent) {
  PS.shuffle = on; store.set('shuffle', on);
  if (PS.base.length) {
    if (on) {
      const inBase = PS.base.includes(PS.cur);
      PS.queue = inBase ? [PS.cur, ...shuffled(PS.base.filter((x) => x !== PS.cur))] : shuffled(PS.base);
      PS.idx = inBase ? 0 : -1;
    } else { PS.queue = PS.base.slice(); PS.idx = PS.queue.indexOf(PS.cur); }
  }
  if (!silent) toast(on ? 'Shuffle on' : 'Shuffle off');
  updateModes(); saveState();
}
function cycleRepeat() {
  PS.repeat = { off: 'all', all: 'one', one: 'off' }[PS.repeat] || 'off';
  store.set('repeat', PS.repeat);
  toast({ off: 'Repeat off', all: 'Repeat all', one: 'Repeat this song' }[PS.repeat]);
  updateModes();
}
function addToQueue(ids, front = false) {
  ids = ids.filter((x) => SONG.has(x)); if (!ids.length) return;
  if (!PS.cur) { PS.ctx = { type: 'queue', id: '', title: 'Your queue' }; PS.base = ids.slice(); PS.queue = ids.slice(); PS.idx = 0; load(ids[0], true); return; }
  PS.manual = front ? [...ids, ...PS.manual] : [...PS.manual, ...ids];
  toast(front ? 'Playing next' : ids.length > 1 ? `${ids.length} songs added to queue` : 'Added to queue');
  saveState();
}
function seek(t) { if (isFinite(t) && !isSilent()) audio.currentTime = clamp(t, 0, audio.duration || t); }

let lastSave = 0;
function saveState() {
  lastSave = Date.now();
  store.set('player', { ctx: PS.ctx, base: PS.base, queue: PS.queue, idx: PS.idx, manual: PS.manual, cur: PS.cur, t: (!isSilent() && audio.currentTime) || PS.pendingSeek || 0 });
}

audio.addEventListener('loadedmetadata', () => {
  if (isSilent()) return;
  if (PS.pendingSeek) { try { audio.currentTime = PS.pendingSeek; } catch { } PS.pendingSeek = 0; }
  if (PS.cur && isFinite(audio.duration) && !durCache[PS.cur]) { durCache[PS.cur] = Math.round(audio.duration); store.set('dur', durCache); }
  updateProgress(); updatePosition();
});
audio.addEventListener('timeupdate', () => {
  if (isSilent()) return;
  updateProgress();
  if (Date.now() - lastSave > 5000) { saveState(); updatePosition(); }
  if (PS.sleep?.until && Date.now() >= PS.sleep.until) { audio.pause(); PS.want = false; PS.sleep = null; toast('Sleep timer: paused'); updateSleep(); }
});
audio.addEventListener('ended', () => {
  if (isSilent()) return;
  if (PS.sleep?.eot) { PS.sleep = null; updateSleep(); toast('Sleep timer: paused'); PS.want = false; return; }
  next(true);
});
audio.addEventListener('play', updatePlayState);
audio.addEventListener('pause', updatePlayState);
audio.addEventListener('playing', () => { primed = true; if (!isSilent()) PS.errs = 0; updatePlayState(); });
audio.addEventListener('error', () => {
  if (!PS.cur || !audio.getAttribute('src') || isSilent()) return;
  const s = SONG.get(PS.cur);
  toast(`Can't play “${s ? s.title : 'this file'}”`);
  if (PS.want && ++PS.errs < Math.min(6, PS.queue.length + PS.manual.length)) setTimeout(() => next(false), 900);
});

/* lock screen / car / headphones controls */
const MS = 'mediaSession' in navigator ? navigator.mediaSession : null;
if (MS) {
  const h = (a, f) => { try { MS.setActionHandler(a, f); } catch { } };
  h('play', () => { PS.want = true; audio.play(); });
  h('pause', () => { PS.want = false; audio.pause(); });
  h('previoustrack', () => prev());
  h('nexttrack', () => next(false));
  h('seekto', (d) => { if (d.fastSeek && 'fastSeek' in audio) audio.fastSeek(d.seekTime); else seek(d.seekTime); updatePosition(); });
  h('stop', () => { audio.pause(); });
}
function updateMediaSession(s) {
  if (!MS || !s) return;
  const art = s.cover ? [{ src: /^blob:/.test(s.cover) ? s.cover : abs(enc(s.cover)), sizes: '512x512' }] : [{ src: abs('icons/icon-512.png'), sizes: '512x512', type: 'image/png' }];
  try { MS.metadata = new MediaMetadata({ title: s.title, artist: s.artist, album: SITE.name, artwork: art }); } catch { }
}
function updatePosition() {
  if (!MS || !MS.setPositionState || isSilent() || !isFinite(audio.duration) || !audio.duration) return;
  try { MS.setPositionState({ duration: audio.duration, playbackRate: audio.playbackRate || 1, position: Math.min(audio.currentTime, audio.duration) }); } catch { }
}

/* sleep timer */
function setSleep(min) {
  if (min === 0) PS.sleep = null;
  else if (min === 'eot') PS.sleep = { eot: true };
  else PS.sleep = { until: Date.now() + min * 60000 };
  toast(PS.sleep ? (PS.sleep.eot ? 'Pausing at end of this song' : `Sleep timer set: ${min} min`) : 'Sleep timer off');
  updateSleep();
}
setInterval(() => { if (PS.sleep?.until) updateSleep(); }, 30000);

/* restore last session (paused) */
function restore() {
  if (!U.settings.resume || !saved || !saved.cur || !SONG.has(saved.cur)) return;
  PS.ctx = saved.ctx;
  PS.base = (saved.base || []).filter((x) => SONG.has(x));
  PS.queue = (saved.queue || []).filter((x) => SONG.has(x));
  PS.manual = (saved.manual || []).filter((x) => SONG.has(x));
  const i = PS.queue.indexOf(saved.cur);
  PS.idx = i >= 0 ? i : 0;
  load(saved.cur, false, saved.t || 0);
}

/* =========================================================
   Offline downloads (Cache Storage + service worker)
   Premium songs are stored encrypted, exactly as on GitHub.
   ========================================================= */
const MEDIA_CACHE = 'orbit-media-v1';
const canCache = 'caches' in window && window.isSecureContext && location.protocol !== 'file:';
let dlBusy = false;
async function download(ids) {
  ids = ids.filter((id) => SONG.has(id) && !U.dl.has(id));
  if (!ids.length) { toast('Already downloaded'); return; }
  if (!canCache) { toast('Downloads work on the published https site'); return; }
  if (dlBusy) { toast('A download is already running'); return; }
  dlBusy = true;
  try { navigator.storage?.persist?.(); } catch { }
  const cache = await caches.open(MEDIA_CACHE);
  let ok = 0, fail = 0;
  for (const id of ids) {
    const s = SONG.get(id);
    try {
      await cache.add(songURL(s));
      const cv = s.coverEnc || s.cover;
      if (cv && !/^blob:/.test(cv)) await cache.add(enc(cv)).catch(() => {});
      U.dl.add(id); ok++;
      if (ids.length > 1) toast(`Downloading ${ok}/${ids.length}`);
      notifySW();
    } catch { fail++; }
  }
  dlBusy = false;
  saveU('dl');
  toast(fail ? `Downloaded ${ok}, failed ${fail}` : ids.length > 1 ? `${ok} songs downloaded` : 'Downloaded');
  refreshDownloads();
}
async function removeDownload(ids) {
  if (!canCache) return;
  const cache = await caches.open(MEDIA_CACHE);
  for (const id of ids) { const s = SONG.get(id); if (s) await cache.delete(songURL(s)); U.dl.delete(id); }
  saveU('dl'); notifySW(); toast('Removed from downloads'); refreshDownloads();
}
async function reconcileDownloads() {
  if (!canCache || !U.dl.size) return;
  const cache = await caches.open(MEDIA_CACHE); let changed = false;
  for (const id of [...U.dl]) { const s = SONG.get(id); if (!s) continue; if (!(await cache.match(songURL(s)))) { U.dl.delete(id); changed = true; } }
  if (changed) { saveU('dl'); refreshDownloads(); }
}
function notifySW() { navigator.serviceWorker?.controller?.postMessage({ type: 'refresh-media' }); }
function refreshDownloads() { render(true); }
async function saveToDevice(s) {
  const name = s.fileName || s.file.split('/').pop();
  const href = s.vault ? await vaultURL(s) : songURL(s);
  const a = document.createElement('a'); a.href = href; a.download = name; document.body.appendChild(a); a.click(); a.remove();
}

/* =========================================================
   Sharing
   ========================================================= */
const baseURL = () => location.href.split('#')[0].split('?')[0];
function shareHashFor(c) {
  if (c.local || c.special === 'liked' || c.special === 'downloads') {
    if (!c.songs.length) return null;
    return '#/shared/' + packCode({ t: c.special === 'liked' ? `${SITE.name} likes` : c.title, s: c.songs.slice(0, 300) });
  }
  if (c.shared) return '#/shared/' + c.id;
  return collHref(c);
}
function shareColl(c) {
  if (!c) return;
  const h = shareHashFor(c);
  if (!h) { toast('Add some songs first'); return; }
  share(c.title, h);
}
async function share(title, hashPart) {
  const url = baseURL() + hashPart;
  const data = { title: `${title} · ${SITE.name}`, url };
  if (navigator.share && (!navigator.canShare || navigator.canShare(data))) {
    try { await navigator.share(data); return; }
    catch (e) { if (e && e.name === 'AbortError') return; }
  }
  try { await navigator.clipboard.writeText(url); toast('Link copied'); }
  catch {
    const ta = document.createElement('textarea'); ta.value = url; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, url.length);
    let ok = false; try { ok = document.execCommand('copy'); } catch { }
    ta.remove();
    if (ok) toast('Link copied'); else window.prompt('Copy this link', url);
  }
}
function saveShared(code) {
  const c = coll('shared', code); if (!c || !c.songs.length) { toast('Nothing to save'); return; }
  const sig = c.songs.join(',');
  const dup = U.local.find((p) => p.title === c.title && p.songs.join(',') === sig);
  if (dup) { toast('Already in Your Library'); go(`#/local/${enc64(dup.id)}`); return; }
  const p = { id: 'local-' + Date.now().toString(36), title: c.title, created: new Date().toISOString().slice(0, 10), songs: c.songs.slice(), from: 'link' };
  U.local.unshift(p); saveU('local');
  toast('Saved to Your Library');
  go(`#/local/${enc64(p.id)}`);
}

/* =========================================================
   Player UI: mini player / desktop bar / full screen
   ========================================================= */
const elPlayer = $('#player'), elFull = $('#full'), elOv = $('#overlay');

function buildPlayerUI() {
  elPlayer.innerHTML = `
    <div class="m-swipe" data-act="open-full">
      <div class="cover m-cover" id="m-cover"></div>
      <div class="m-body"><div class="m-title ellipsis" id="m-title"></div><div class="m-sub ellipsis" id="m-sub"></div></div>
      <button class="icon-btn sm d-only" data-act="like-cur" data-likebtn aria-label="Like">${I('heart')}</button>
    </div>
    <button class="icon-btn m-only" data-act="like-cur" data-likebtn aria-label="Like">${I('heart')}</button>
    <button class="icon-btn m-only" data-act="toggle" data-playicon aria-label="Play">${I('play')}</button>
    <div class="m-bar m-only"><i id="m-bar"></i></div>
    <div class="p-center d-only">
      <div class="p-btns">
        <button class="icon-btn sm" data-act="shuffle" data-mode="shuffle" aria-label="Shuffle">${I('shuffle')}</button>
        <button class="icon-btn sm" data-act="prev" aria-label="Previous">${I('prev')}</button>
        <button class="icon-btn play-c" data-act="toggle" data-playicon aria-label="Play">${I('play')}</button>
        <button class="icon-btn sm" data-act="next" aria-label="Next">${I('next')}</button>
        <button class="icon-btn sm" data-act="repeat" data-mode="repeat" aria-label="Repeat">${I('repeat')}</button>
      </div>
      <div class="p-seek"><span data-cur>0:00</span><input class="range" type="range" min="0" max="1000" value="0" data-seek aria-label="Seek"><span data-dur>0:00</span></div>
    </div>
    <div class="p-right d-only">
      <button class="icon-btn sm" data-act="lyrics" aria-label="Lyrics">${I('mic')}</button>
      <button class="icon-btn sm" data-act="queue" aria-label="Queue">${I('queue')}</button>
      <button class="icon-btn sm" data-act="mute" id="vol-ico" aria-label="Mute">${I('vol')}</button>
      <input class="range" type="range" min="0" max="100" value="${Math.round(store.get('vol', 1) * 100)}" id="vol" aria-label="Volume">
      <button class="icon-btn sm" data-act="open-full" aria-label="Full screen">${I('expand')}</button>
    </div>`;

  elFull.innerHTML = `
    <div class="f-inner">
      <div class="f-top">
        <button class="icon-btn" data-act="close-full" aria-label="Close">${I('down')}</button>
        <div class="f-ctx" data-act="goto-ctx"><small id="f-ctx-kind">Playing from</small><b class="ellipsis" id="f-ctx"></b></div>
        <button class="icon-btn" data-act="cur-more" aria-label="More">${I('more')}</button>
      </div>
      <div class="f-left">
        <div class="f-art" id="f-art"><div class="cover" id="f-cover"></div></div>
        <div class="f-meta">
          <div class="f-text"><h2 class="ellipsis" id="f-title"></h2><div class="f-artist ellipsis" id="f-artist" data-act="goto-artist"></div></div>
          <button class="icon-btn" data-act="like-cur" data-likebtn aria-label="Like">${I('heart')}</button>
        </div>
        <div class="seek">
          <input class="range" type="range" min="0" max="1000" value="0" data-seek aria-label="Seek">
          <div class="times"><span data-cur>0:00</span><span data-dur>0:00</span></div>
        </div>
        <div class="f-ctrls">
          <button class="icon-btn mode" data-act="shuffle" data-mode="shuffle" aria-label="Shuffle">${I('shuffle')}</button>
          <button class="icon-btn" data-act="prev" aria-label="Previous">${I('prev')}</button>
          <button class="icon-btn f-play" data-act="toggle" data-playicon aria-label="Play">${I('play')}</button>
          <button class="icon-btn" data-act="next" aria-label="Next">${I('next')}</button>
          <button class="icon-btn mode" data-act="repeat" data-mode="repeat" aria-label="Repeat">${I('repeat')}</button>
        </div>
        <div class="f-tools">
          <button class="icon-btn" data-act="sleep" aria-label="Sleep timer">${I('timer')}</button>
          <span id="f-sleep"></span>
          <button class="icon-btn" data-act="share-cur" aria-label="Share">${I('share')}</button>
          <button class="icon-btn" data-act="queue" aria-label="Queue">${I('queue')}</button>
        </div>
      </div>
      <div class="f-right">
        <div class="f-card" id="f-lyrics" data-act="lyrics"></div>
        <div class="f-card" id="f-about"></div>
      </div>
    </div>`;

  $$('[data-seek]').forEach((r) => {
    r.addEventListener('input', () => { r.dragging = true; const t = (r.value / 1000) * (audio.duration || 0); setRange(r, r.value / 10); $$('[data-cur]').forEach((e) => e.textContent = fmt(t)); });
    r.addEventListener('change', () => { r.dragging = false; seek((r.value / 1000) * (audio.duration || 0)); updatePosition(); });
  });
  const vol = $('#vol');
  const applyVol = () => { audio.volume = vol.value / 100; store.set('vol', audio.volume); setRange(vol, vol.value); $('#vol-ico').innerHTML = I(audio.volume ? 'vol' : 'mute'); };
  vol.addEventListener('input', applyVol); applyVol();

  swipe($('.m-swipe', elPlayer), { left: () => next(false), right: () => prev() });
  swipe($('#f-art'), { left: () => next(false), right: () => prev() });
  swipe(elFull, { down: () => { if (elFull.scrollTop <= 0) closeFull(); } }, true);
}
const setRange = (r, pct) => r.style.setProperty('--p', pct + '%');

function swipe(el, h, verticalOnly = false) {
  let x0 = 0, y0 = 0, t0 = 0;
  el.addEventListener('touchstart', (e) => { const t = e.touches[0]; x0 = t.clientX; y0 = t.clientY; t0 = Date.now(); }, { passive: true });
  el.addEventListener('touchend', (e) => {
    if (e.target.closest && e.target.closest('input[type=range]')) return;
    const t = e.changedTouches[0], dx = t.clientX - x0, dy = t.clientY - y0;
    if (Date.now() - t0 > 700) return;
    if (!verticalOnly && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) { el._swiped = Date.now(); (dx < 0 ? h.left : h.right)?.(); }
    else if (h.down && dy > 110 && Math.abs(dy) > Math.abs(dx) * 1.5) { el._swiped = Date.now(); h.down(); }
  }, { passive: true });
}

function updateNowPlaying() {
  const s = SONG.get(PS.cur);
  elPlayer.classList.toggle('hidden', !s);
  if (!s) return;
  $('#m-cover').innerHTML = s.cover ? img(s.cover) : ph(s.title);
  $('#m-title').textContent = s.title;
  $('#m-sub').textContent = s.artist;
  $('#f-cover').innerHTML = s.cover ? img(s.cover) : ph(s.title);
  $('#f-title').textContent = s.title;
  $('#f-artist').textContent = s.artist;
  const kinds = { playlist: 'Playing from playlist', local: 'Playing from playlist', shared: 'Playing from playlist', liked: 'Playing from playlist', downloads: 'Playing from playlist', artist: 'Playing from artist', search: 'Playing from search', warp: 'Warp mode', track: 'Playing song', queue: 'Playing from queue', genre: 'Playing from mix', year: 'Playing from mix' };
  $('#f-ctx-kind').textContent = kinds[PS.ctx?.type] || 'Playing from';
  $('#f-ctx').textContent = PS.ctx?.title || SITE.name;
  const lc = $('#f-lyrics');
  lc.classList.toggle('hidden', !(U.settings.showLyrics && s.lyrics));
  lc.innerHTML = s.lyrics ? `<h4>Lyrics <span style="font-size:12px;font-weight:500;opacity:.7">Tap to expand</span></h4><div class="lyr-preview">${esc(s.lyrics)}</div>` : '';
  const rows = [['Artist', s.artist], ['Released', s.dateText || s.year], ['Genre', s.genre], ['Added', s.vault ? null : s.added], ['Length', dur(s) ? fmt(dur(s)) : null]].filter((r) => r[1]);
  $('#f-about').innerHTML = `<h4>About this song</h4><dl>${rows.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl>`;
  const want = s.cover;
  tintFor(s.cover).then((c) => { if (SONG.get(PS.cur)?.cover !== want) return; [elPlayer, elFull, elOv].forEach((e) => setTint(e, c)); });
  refreshLikes(); updateModes(); updatePlayState(); updateProgress(); updateSleep(); markNowPlaying();
  updateMediaSession(s);
  document.title = `${s.title} · ${s.artist}`;
  if (elOv.classList.contains('lyrics')) openLyrics(PS.cur);
  if (elOv.classList.contains('queue-o')) openQueue();
}
function updatePlayState() {
  const p = isPlaying() || (isSilent() && PS.want);
  $$('[data-playicon]').forEach((b) => { b.innerHTML = I(p ? 'pause' : 'play'); b.setAttribute('aria-label', p ? 'Pause' : 'Play'); });
  elFull.classList.toggle('paused', !p);
  document.body.classList.toggle('paused', !p);
  $$('[data-playbtn]').forEach((b) => { const on = sameCtx(b.dataset.type, b.dataset.id) && p; b.innerHTML = I(on ? 'pause' : 'play'); });
  const orb = $('.orb'); if (orb) { const live = p && PS.ctx?.type === 'warp'; orb.classList.toggle('live', live); orb.innerHTML = I(live ? 'pause' : 'spark'); }
  if (MS) MS.playbackState = p ? 'playing' : 'paused';
}
function updateProgress() {
  const d = (!isSilent() && audio.duration) || dur(SONG.get(PS.cur)) || 0, t = (!isSilent() && audio.currentTime) || PS.pendingSeek || 0;
  const pct = d ? clamp((t / d) * 100, 0, 100) : 0;
  const bar = $('#m-bar'); if (bar) bar.style.width = pct + '%';
  const dragging = $$('[data-seek]').some((r) => r.dragging);
  $$('[data-seek]').forEach((r) => { if (!r.dragging) { r.value = pct * 10; setRange(r, pct); } });
  if (!dragging) $$('[data-cur]').forEach((e) => e.textContent = fmt(t));
  $$('[data-dur]').forEach((e) => e.textContent = fmt(d));
}
function updateModes() {
  $$('[data-mode="shuffle"]').forEach((b) => b.classList.toggle('on', PS.shuffle));
  $$('[data-mode="repeat"]').forEach((b) => { b.classList.toggle('on', PS.repeat !== 'off'); b.innerHTML = I(PS.repeat === 'one' ? 'repeat1' : 'repeat'); });
  $$('[data-shufflebtn]').forEach((b) => b.classList.toggle('on', PS.shuffle));
}
function updateSleep() {
  const el = $('#f-sleep'); if (!el) return;
  if (!PS.sleep) { el.innerHTML = ''; return; }
  el.innerHTML = `<span class="sleep-pill">${PS.sleep.eot ? 'End of song' : Math.max(1, Math.ceil((PS.sleep.until - Date.now()) / 60000)) + ' min'}</span>`;
}
function refreshLikes() {
  const on = isLiked(PS.cur);
  $$('[data-likebtn]').forEach((b) => { b.innerHTML = I(on ? 'heartFill' : 'heart'); b.classList.toggle('on', on); });
}
function markNowPlaying() {
  $$('.track[data-song]').forEach((el) => el.classList.toggle('now', el.dataset.song === PS.cur));
  $$('.quick[data-type]').forEach((el) => el.classList.toggle('playing', sameCtx(el.dataset.type, el.dataset.id)));
}

function openFull() { if (!PS.cur) return; elFull.classList.add('open'); elFull.setAttribute('aria-hidden', 'false'); elFull.scrollTop = 0; document.body.classList.add('lock'); }
function closeFull() { elFull.classList.remove('open'); elFull.setAttribute('aria-hidden', 'true'); if (!elOv.classList.contains('open')) document.body.classList.remove('lock'); }

function openOverlay(cls, html) {
  elOv.className = 'overlay open ' + cls; elOv.innerHTML = `<div class="o-inner">${html}</div>`; elOv.setAttribute('aria-hidden', 'false');
  document.body.classList.add('lock');
}
function closeOverlay() { elOv.className = 'overlay'; elOv.setAttribute('aria-hidden', 'true'); if (!elFull.classList.contains('open')) document.body.classList.remove('lock'); }
function openLyrics(id) {
  const s = SONG.get(id || PS.cur); if (!s) return;
  const wasOpen = elOv.classList.contains('lyrics');
  openOverlay('lyrics', `
    <div class="o-top"><button class="icon-btn" data-act="close-ov" aria-label="Close">${I('down')}</button>
      <div class="o-title ellipsis">${esc(s.title)}<div style="font-weight:500;font-size:13px;opacity:.7">${esc(s.artist)}</div></div>
      <button class="icon-btn" data-act="share-song" data-song="${esc(s.id)}" aria-label="Share">${I('share')}</button></div>
    ${s.lyrics ? `<div class="lyr-full">${esc(s.lyrics)}</div>` : `<div class="empty">${I('mic')}<h3>No lyrics yet</h3><p>Lyrics for this song haven't been added.</p></div>`}`);
  if (!wasOpen) elOv.scrollTop = 0;
}
function openQueue() {
  const cur = SONG.get(PS.cur);
  const upNext = PS.queue.slice(PS.idx + 1);
  const row = (id, i, kind) => { const s = SONG.get(id); if (!s) return ''; return `
    <div class="track" role="button" data-act="queue-jump" data-kind="${kind}" data-i="${i}" data-song="${esc(id)}">
      ${songCover(s)}<div class="t-body"><div class="t-title ellipsis">${esc(s.title)}</div><div class="t-sub"><span class="ellipsis">${esc(s.artist)}</span></div></div>
      ${kind === 'm' ? `<button class="icon-btn sm" data-act="queue-remove" data-i="${i}" aria-label="Remove">${I('close')}</button>` : ''}
    </div>`; };
  openOverlay('queue-o', `
    <div class="o-top"><button class="icon-btn" data-act="close-ov" aria-label="Close">${I('down')}</button><div class="o-title">Queue</div><span style="width:40px"></span></div>
    ${cur ? `<div class="q-label">Now playing</div><div class="tracks">${trackRow(cur, {})}</div>` : '<p class="muted">Nothing playing.</p>'}
    ${PS.manual.length ? `<div class="q-label"><span>Next in queue</span><button class="muted" style="font-size:13px" data-act="queue-clear">Clear</button></div><div class="tracks">${PS.manual.map((id, i) => row(id, i, 'm')).join('')}</div>` : ''}
    ${cur ? `<div class="q-label"><span>Next from<small>${esc(PS.ctx?.title || '')}</small></span></div>
    <div class="tracks">${upNext.length ? upNext.slice(0, 150).map((id, i) => row(id, PS.idx + 1 + i, 'c')).join('') : '<p class="muted">Nothing else in this list.</p>'}</div>
    <div class="actions"><button class="btn-pill" data-act="shuffle" data-shufflebtn>${I('shuffle')} Shuffle</button><button class="btn-pill" data-act="repeat">${I('repeat')} Repeat</button></div>` : ''}`);
  updateModes(); markNowPlaying();
}

/* =========================================================
   Router + views
   ========================================================= */
function route() {
  const h = location.hash.replace(/^#\/?/, '');
  const [r, ...rest] = h.split('/');
  let arg = rest.join('/');
  try { arg = decodeURIComponent(arg); } catch { }
  return { r: r || 'home', arg };
}
const COLL_TYPES = ['playlist', 'local', 'shared', 'liked', 'downloads', 'artist', 'genre', 'year', 'all', 'latest', 'track'];
const TABS = [
  { id: 'home', label: 'Home', icon: 'home', on: 'homeFill' },
  { id: 'search', label: 'Search', icon: 'search', on: 'searchBold' },
  { id: 'warp', label: 'Warp', icon: 'spark', on: 'spark', cls: 'warp-tab' },
  { id: 'library', label: 'Library', icon: 'library', on: 'libraryFill' },
];
let lastTab = 'home', freshNav = false;
const scrollMem = {};
const view = $('#view');

function go(href) {
  freshNav = true;
  if (location.hash === href || (!location.hash && href === '#/home')) render();
  else location.hash = href;
}
function render(keep = false) {
  const { r, arg } = route();
  const y = window.scrollY;
  let html;
  if (['home', 'search', 'warp', 'library'].includes(r)) lastTab = r;
  if (r === 'search') html = viewSearch();
  else if (r === 'warp') html = viewWarp();
  else if (r === 'library') html = viewLibrary();
  else if (r === 'page') html = viewPage(arg);
  else if (COLL_TYPES.includes(r)) html = viewColl(r, arg);
  else { lastTab = 'home'; html = viewHome(); }
  view.innerHTML = html;
  if (!keep) { view.style.animation = 'none'; void view.offsetHeight; view.style.animation = ''; }
  afterRender(r, arg);
  renderTabbar(); renderSidebar();
  window.scrollTo(0, keep ? y : freshNav ? 0 : (scrollMem[location.hash] || 0));
  freshNav = false;
  onScroll(); markNowPlaying(); updatePlayState(); updateModes();
}
function afterRender(r, arg) {
  if (r === 'search') bindSearch();
  if (r === 'library') bindLibFind(false);
  const hero = $('#hero');
  if (hero) { const c = coll(r, arg); if (c) tintFor(collCoverSrc(c)).then((col) => setTint(hero, col)); }
  if (r === 'page' && arg === 'settings') estimateStorage();
  const c = COLL_TYPES.includes(r) ? coll(r, arg) : null;
  document.title = c ? `${c.title} · ${SITE.name}` : (PS.cur ? document.title : SITE.name);
}
function onScroll() {
  scrollMem[location.hash] = window.scrollY;
  const tb = $('.view .topbar'); if (!tb) return;
  tb.classList.toggle('solid', window.scrollY > ($('#hero') ? 230 : 8));
}
window.addEventListener('scroll', onScroll, { passive: true });

/* ---------- shared bits ---------- */
const logoBtn = () => `<button class="logo-btn mobile-only" data-act="drawer" aria-label="Menu">${I('logo')}</button>`;
const mainTop = (title, right = '') => `<header class="topbar">${logoBtn()}<h1 class="ellipsis">${esc(title)}</h1>${right}</header>`;
const section = (title, inner, opts = {}) => inner ? `<section class="section"><div class="section-head"><div style="min-width:0">${opts.kicker ? `<span class="kicker">${esc(opts.kicker)}</span>` : ''}<h2 class="ellipsis">${esc(title)}</h2></div>${opts.more ? `<button data-href="${opts.more}">Show all</button>` : ''}</div>${inner}</section>` : '';
const premiumBadge = (c) => c && c.vault ? `<span class="badge-p" title="Premium">${I('crown')}</span>` : '';
const cardColl = (c, pick = '') => `<button class="card${c.round ? ' round' : ''}" data-href="${collHref(c)}"${pick ? ` data-pick="${pick}"` : ''}>${collCover(c)}<div class="c-title ellipsis">${esc(c.title)}</div><div class="c-sub">${esc(c.round ? collSub(c) : c.desc || collSub(c))}</div></button>`;
const cardSong = (s, type, id = '') => `<button class="card" data-act="play-track" data-type="${type}" data-id="${esc(id)}" data-song="${esc(s.id)}">${songCover(s)}<div class="c-title ellipsis">${esc(s.title)}</div><div class="c-sub">${esc(s.artist)}${s.year ? ' · ' + s.year : ''}</div></button>`;
const row = (items) => items.length ? `<div class="row">${items.join('')}</div>` : '';
function trackRow(s, o = {}) {
  const d = dur(s);
  return `<div class="track${s.id === PS.cur ? ' now' : ''}" role="button" tabindex="0" data-act="play-track" data-type="${o.type || 'track'}" data-id="${esc(o.id ?? s.id)}" data-song="${esc(s.id)}"${o.pick ? ` data-pick="song:${esc(s.id)}"` : ''}>
    ${songCover(s)}
    <div class="t-body"><div class="t-title ellipsis">${o.hlTitle || esc(s.title)}</div>
      <div class="t-sub"><span class="eq"><i></i><i></i><i></i></span>${U.dl.has(s.id) ? I('dlFill') : ''}<span class="ellipsis">${o.sub || esc(s.artist)}</span></div>${o.snippet || ''}</div>
    <span class="t-dur">${d ? fmt(d) : ''}</span>
    <button class="icon-btn sm" data-act="track-more" data-song="${esc(s.id)}" data-type="${o.type || ''}" data-id="${esc(o.id ?? '')}" aria-label="More options">${I('more')}</button>
  </div>`;
}
const emptyState = (icon, title, text, extra = '') => `<div class="empty">${I(icon)}<h3>${esc(title)}</h3><p>${text}</p>${extra}</div>`;

/* ---------- HOME ---------- */
function viewHome() {
  const h = new Date().getHours();
  const greet = h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  let out = `<div class="page"><header class="topbar">${logoBtn()}<div class="chips"><button class="chip on" data-href="#/home">All</button><button class="chip" data-href="#/library">Playlists</button><button class="chip" data-href="#/latest">New</button><button class="chip" data-href="#/warp">${I('spark')} Warp</button></div></header>`;
  out += `<div class="greet">${greet}</div>`;
  if (!SONGS.length) return out + emptyState('note', 'No music yet', 'Upload song files to the <b>MUSIC</b> folder of the project. The library builds itself automatically after upload.') + '</div>';

  const seen = new Set(), quick = [];
  const addQ = (c) => { if (!c || !c.songs.length) return; const k = c.type + ':' + c.id; if (seen.has(k)) return; seen.add(k); quick.push(c); };
  if (realLiked().length) addQ(coll('liked'));
  U.recents.forEach((x) => addQ(coll(x.type, x.id)));
  PLAYLISTS.forEach((p) => addQ(coll('playlist', p.id)));
  addQ(coll('latest')); addQ(coll('warp', ''));
  out += `<div class="quick-grid">${quick.slice(0, 8).map((c) => `<button class="quick" data-href="${collHref(c)}" data-type="${c.type}" data-id="${esc(c.id)}">${collCover(c)}<span>${esc(c.title)}</span></button>`).join('')}</div>`;

  const recentColls = U.recents.map((x) => coll(x.type, x.id)).filter((c) => c && c.songs.length).slice(0, 10);
  out += section('Jump back in', row(recentColls.map((c) => cardColl(c))));
  out += section('Latest songs', row(latestIds().slice(0, 12).map((id) => cardSong(SONG.get(id), 'latest'))), { kicker: 'Fresh uploads', more: '#/latest' });
  const groups = new Map();
  PLAYLISTS.forEach((p) => { const k = p.section || 'Playlists'; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(coll('playlist', p.id)); });
  for (const [title, cs] of groups) out += section(title, row(cs.map((c) => cardColl(c))), { kicker: /^fans of/i.test(title) ? 'Picked for you' : cs.some((c) => c.vault) ? 'Unlocked' : '' });
  const artists = [...ARTISTS.values()].sort((a, b) => b.songs.length - a.songs.length).slice(0, 12).map((a) => coll('artist', a.name));
  out += section('Artists', row(artists.map((c) => cardColl(c))));
  const recentSongs = [...new Set(U.history.map((x) => x.id))].filter((id) => SONG.has(id)).slice(0, 12);
  out += section('Recently played', row(recentSongs.map((id) => cardSong(SONG.get(id), 'track', id))), { more: '#/page/history' });
  out += section('Mixes by genre', row([...GENRES.keys()].map((g) => cardColl(coll('genre', g)))));
  out += section('Time machine', row([...YEARS.keys()].sort().reverse().map((y) => cardColl(coll('year', y)))), { kicker: 'By release year' });
  return out + '</div>';
}

/* ---------- SEARCH ---------- */
const SQ = { q: '', filter: 'all' };
function lev1(a, b) {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, e = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++e > 1) return false;
    if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; }
  }
  return e + (a.length - i) + (b.length - j) <= 1;
}
function searchAll(q) {
  const nq = norm(q), toks = nq.split(' ').filter(Boolean);
  const res = { songs: [], artists: [], playlists: [], lyrics: [], mixes: [] };
  if (!nq) return res;
  const isYear = /^(19|20)\d{2}$/.test(nq);
  for (const s of SONGS) {
    let sc = 0;
    if (isYear && String(s.year) === nq) sc += 90;
    if (s._t === nq) sc += 100; else if (s._t.startsWith(nq)) sc += 80; else if (s._t.includes(nq)) sc += 60;
    if (s._a === nq) sc += 70; else if (s._a.startsWith(nq)) sc += 55; else if (s._a.includes(nq)) sc += 40;
    if (s._g && s._g.includes(nq)) sc += 25;
    if (!sc && !isYear && toks.every((t) => s._hay.includes(t))) sc = 30;
    if (!sc && !isYear && toks.every((t) => t.length >= 4 && s._words.some((w) => lev1(t, w)))) sc = 18;
    let lyr = false;
    if (s._ly && (s._ly.includes(nq) || (toks.length > 1 && toks.every((t) => s._ly.includes(t))))) { lyr = true; res.lyrics.push(s); if (!sc) sc = 12; }
    if (sc) res.songs.push({ s, sc, lyr });
  }
  res.songs.sort((a, b) => b.sc - a.sc);
  for (const a of ARTISTS.values()) { const n = norm(a.name); const sc = n === nq ? 100 : n.startsWith(nq) ? 80 : n.includes(nq) ? 50 : toks.every((t) => n.includes(t)) ? 35 : 0; if (sc) res.artists.push({ c: coll('artist', a.name), sc }); }
  for (const p of PLAYLISTS) { const n = norm(p.title), d = norm([p.description, p.section].join(' ')); const sc = n === nq ? 95 : n.startsWith(nq) ? 75 : n.includes(nq) ? 55 : toks.every((t) => (n + ' ' + d).includes(t)) ? 30 : 0; if (sc) res.playlists.push({ c: coll('playlist', p.id), sc }); }
  for (const p of U.local) { const n = norm(p.title); if (n.includes(nq)) res.playlists.push({ c: coll('local', p.id), sc: n === nq ? 95 : 55 }); }
  for (const g of GENRES.keys()) if (norm(g).includes(nq)) res.mixes.push(coll('genre', g));
  if (isYear && YEARS.has(nq)) res.mixes.unshift(coll('year', nq));
  ['artists', 'playlists'].forEach((k) => res[k].sort((a, b) => b.sc - a.sc));
  return res;
}
function highlight(text, q) {
  const t = esc(text); const toks = norm(q).split(' ').filter((x) => x.length > 1);
  if (!toks.length) return t;
  try { return t.replace(new RegExp(`(${toks.map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi'), '<span class="hl">$1</span>'); } catch { return t; }
}
function lyricSnippet(s, q) {
  const toks = norm(q).split(' ').filter(Boolean);
  const lines = s.lyrics.split('\n');
  const line = lines.find((l) => toks.every((t) => norm(l).includes(t))) || lines.find((l) => toks.some((t) => norm(l).includes(t))) || '';
  return line ? `<div class="snippet ellipsis">“${highlight(line.trim(), q)}”</div>` : '';
}
function viewSearch() {
  return `<div class="page"><div class="sticky-search">${mainTop('Search')}
    <label class="search-field">${I('searchBold')}<input id="q" type="search" placeholder="What do you want to listen to?" value="${esc(SQ.q)}" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="search">
    <button class="icon-btn sm${SQ.q ? '' : ' hidden'}" data-act="clear-q" aria-label="Clear">${I('close')}</button></label>
    <div id="schips"></div></div><div id="sres"></div></div>`;
}
function bindSearch() {
  const q = $('#q');
  q.addEventListener('input', () => { SQ.q = q.value; SQ.filter = 'all'; $('[data-act="clear-q"]').classList.toggle('hidden', !q.value); renderResults(); window.scrollTo(0, 0); });
  q.addEventListener('keydown', (e) => { if (e.key === 'Enter') q.blur(); });
  renderResults();
}
function renderResults() {
  const box = $('#sres'), chipsBox = $('#schips'); if (!box) return;
  const q = SQ.q.trim();
  if (!q) {
    chipsBox.innerHTML = '';
    const recent = U.searches.map((x, i) => {
      const s = x.kind === 'song' ? SONG.get(x.id) : null, c = x.kind !== 'song' ? coll(x.kind, x.id) : null;
      if (!s && !c) return '';
      const href = s ? `data-act="play-track" data-type="track" data-id="${esc(s.id)}" data-song="${esc(s.id)}"` : `data-href="${collHref(c)}"`;
      return `<div class="recent-row track${c && c.round ? ' round' : ''}" role="button" ${href}>${s ? songCover(s) : collCover(c)}<div class="t-body"><div class="t-title ellipsis">${esc(s ? s.title : c.title)}</div><div class="t-sub"><span class="ellipsis">${esc(s ? 'Song · ' + s.artist : collSub(c))}</span></div></div><button class="icon-btn sm" data-act="search-forget" data-i="${i}" aria-label="Remove">${I('close')}</button></div>`;
    }).join('');
    const tiles = [
      ['All songs', '#/all'], ['Latest', '#/latest'], ['Liked Songs', '#/liked'],
      ...[...GENRES.keys()].map((g) => [g, `#/genre/${enc64(g)}`]),
      ...[...YEARS.keys()].sort().reverse().map((y) => [y, `#/year/${y}`]),
      ...PLAYLISTS.map((p) => [p.title, `#/playlist/${enc64(p.id)}`]),
    ];
    box.innerHTML = (recent ? section('Recent searches', `<div class="tracks">${recent}</div><button class="btn-pill" style="margin-top:10px" data-act="search-clear">Clear recent searches</button>`) : '')
      + section('Browse all', `<div class="tiles">${tiles.map(([t, h], i) => `<button class="tile t${i % 6}" data-href="${h}">${esc(t)}</button>`).join('')}</div>`);
    return;
  }
  const R = searchAll(q);
  const counts = { songs: R.songs.length, artists: R.artists.length, playlists: R.playlists.length, lyrics: R.lyrics.length };
  const chips = [['all', 'All'], ['songs', 'Songs'], ['artists', 'Artists'], ['playlists', 'Playlists'], ['lyrics', 'Lyrics']].filter(([k]) => k === 'all' || counts[k]);
  chipsBox.innerHTML = `<div class="chips">${chips.map(([k, l]) => `<button class="chip${SQ.filter === k ? ' on' : ''}" data-act="schip" data-v="${k}">${l}</button>`).join('')}</div>`;
  if (!R.songs.length && !R.artists.length && !R.playlists.length && !R.mixes.length) {
    box.innerHTML = emptyState('search', `No results for “${q}”`, 'Check the spelling, or try fewer words, an artist, a lyric line or a year.');
    return;
  }
  const songRow = (x) => trackRow(x.s, { type: 'search', id: q, pick: true, hlTitle: highlight(x.s.title, q), sub: `Song · ${highlight(x.s.artist, q)}${x.s.year ? ' · ' + x.s.year : ''}`, snippet: x.lyr && !x.s._hay.includes(norm(q)) ? lyricSnippet(x.s, q) : '' });
  const collList = (arr) => `<div class="tracks lib-list">${arr.map((x) => `<button class="track${x.c.round ? ' round' : ''}" data-href="${collHref(x.c)}" data-pick="${x.c.type}:${esc(x.c.id)}">${collCover(x.c)}<div class="t-body"><div class="t-title ellipsis">${highlight(x.c.title, q)}</div><div class="t-sub">${premiumBadge(x.c)}<span class="ellipsis">${esc(collSub(x.c))}</span></div></div></button>`).join('')}</div>`;
  const f = SQ.filter;
  if (f === 'songs') { box.innerHTML = `<div class="tracks">${R.songs.map(songRow).join('')}</div>`; markNowPlaying(); return; }
  if (f === 'artists') { box.innerHTML = collList(R.artists); return; }
  if (f === 'playlists') { box.innerHTML = collList(R.playlists); return; }
  if (f === 'lyrics') { box.innerHTML = `<div class="tracks">${R.lyrics.map((s) => trackRow(s, { type: 'search', id: q, pick: true, snippet: lyricSnippet(s, q) })).join('')}</div>`; markNowPlaying(); return; }
  const cands = [];
  if (R.songs[0]) cands.push({ sc: R.songs[0].sc, kind: 'song', s: R.songs[0].s });
  if (R.artists[0]) cands.push({ sc: R.artists[0].sc + 5, kind: 'artist', c: R.artists[0].c });
  if (R.playlists[0]) cands.push({ sc: R.playlists[0].sc, kind: R.playlists[0].c.type, c: R.playlists[0].c });
  cands.sort((a, b) => b.sc - a.sc);
  const top = cands[0];
  let out = '';
  if (top) {
    out += section('Top result', top.kind === 'song'
      ? `<div class="top-result" role="button" data-act="play-track" data-type="search" data-id="${esc(q)}" data-song="${esc(top.s.id)}" data-pick="song:${esc(top.s.id)}">${songCover(top.s)}<h3 class="ellipsis">${esc(top.s.title)}</h3><div class="muted">Song · <b style="color:var(--text)">${esc(top.s.artist)}</b></div><span class="btn-play">${I('play')}</span></div>`
      : `<div class="top-result${top.c.round ? ' round' : ''}" role="button" data-href="${collHref(top.c)}" data-pick="${top.kind}:${esc(top.c.id)}">${collCover(top.c)}<h3 class="ellipsis">${esc(top.c.title)}</h3><div class="muted">${esc(collSub(top.c))}</div><span class="btn-play" data-act="play-coll" data-type="${top.c.type}" data-id="${esc(top.c.id)}" data-playbtn>${I('play')}</span></div>`);
  }
  out += section('Songs', `<div class="tracks">${R.songs.slice(0, 6).map(songRow).join('')}</div>${R.songs.length > 6 ? `<button class="btn-pill" style="margin-top:8px" data-act="schip" data-v="songs">See all ${R.songs.length} songs</button>` : ''}`);
  out += section('Artists', row(R.artists.slice(0, 10).map((x) => cardColl(x.c, `artist:${esc(x.c.id)}`))));
  out += section('Playlists', row(R.playlists.slice(0, 10).map((x) => cardColl(x.c, `${x.c.type}:${esc(x.c.id)}`))));
  out += section('Mixes', row(R.mixes.map((c) => cardColl(c))));
  if (R.lyrics.length) out += section('Found in lyrics', `<div class="tracks">${R.lyrics.slice(0, 5).map((s) => trackRow(s, { type: 'search', id: q, pick: true, snippet: lyricSnippet(s, q) })).join('')}</div>`);
  box.innerHTML = out;
  markNowPlaying(); updatePlayState();
}

/* ---------- WARP ---------- */
function viewWarp() {
  const { t, known } = totalDur(SONGS.map((s) => s.id));
  const chip = (id, label) => `<button class="chip" data-act="warp-go" data-id="${esc(id)}">${I('spark')} ${esc(label)}</button>`;
  const artists = [...ARTISTS.values()].sort((a, b) => b.songs.length - a.songs.length).slice(0, 16);
  return `<div class="page">${mainTop('Warp')}
    <div class="warp">
      <button class="orb" data-act="warp-go" data-id="" aria-label="Start Warp">${I('spark')}</button>
      <h1>Endless shuffle</h1>
      <p>Every song in the library, in a new order every ride.</p>
      <button class="btn-pill solid" data-act="warp-surprise">${I('bolt')} Surprise me</button>
      <div class="stats"><div><b>${SONGS.length}</b>songs</div><div><b>${ARTISTS.size}</b>artists</div><div><b>${known && t ? fmtLong(t) : PLAYLISTS.length}</b>${known && t ? 'of music' : 'playlists'}</div></div>
      ${section('Warp by genre', GENRES.size ? `<div class="chips wrap">${[...GENRES.keys()].map((g) => chip('genre:' + g, g)).join('')}</div>` : '')}
      ${section('Warp through time', YEARS.size ? `<div class="chips wrap">${[...YEARS.keys()].sort().reverse().map((y) => chip('year:' + y, y)).join('')}</div>` : '')}
      ${section('Warp an artist', artists.length ? `<div class="chips wrap">${artists.map((a) => chip('artist:' + a.name, a.name)).join('')}</div>` : '')}
      ${section('Special', `<div class="chips wrap">${chip('unplayed', 'Never played')}${realLiked().length ? chip('liked', 'Liked only') : ''}</div>`)}
    </div></div>`;
}

/* ---------- LIBRARY ---------- */
const LS = { filter: '', q: '', find: false };
function libItems() {
  const items = [];
  const rec = new Map(U.recents.map((x, i) => [x.type + ':' + x.id, i]));
  const push = (c, kind, added, pinned = false) => { if (c) items.push({ c, kind, added: added || '', pinned, rec: rec.has(c.type + ':' + c.id) ? rec.get(c.type + ':' + c.id) : 999 }); };
  push(coll('liked'), 'playlist', '9999', true);
  if (U.dl.size) push(coll('downloads'), 'playlist', '9998', true);
  U.local.forEach((p) => push(coll('local', p.id), 'playlist', p.created));
  PLAYLISTS.forEach((p) => push(coll('playlist', p.id), 'playlist', p.created));
  [...ARTISTS.values()].forEach((a) => push(coll('artist', a.name), 'artist', a.songs.map((id) => SONG.get(id).added || '').sort().pop()));
  const srt = U.settings.libSort;
  items.sort((a, b) => (b.pinned - a.pinned) || (srt === 'alpha' ? a.c.title.localeCompare(b.c.title) : srt === 'added' ? String(b.added).localeCompare(String(a.added)) : (a.rec - b.rec) || String(b.added).localeCompare(String(a.added))));
  return items;
}
function viewLibrary() {
  let items = libItems();
  if (LS.filter === 'downloaded') items = items.filter((x) => x.c.songs.length && (x.c.special === 'downloads' || x.c.songs.every((id) => U.dl.has(id))));
  else if (LS.filter) items = items.filter((x) => x.kind === LS.filter);
  if (LS.q) items = items.filter((x) => norm(x.c.title).includes(norm(LS.q)));
  const grid = U.settings.libView === 'grid';
  const sortLabel = { recents: 'Recents', added: 'Recently added', alpha: 'Alphabetical' }[U.settings.libSort] || 'Recents';
  const chips = [['playlist', 'Playlists'], ['artist', 'Artists'], ['downloaded', 'Downloaded']]
    .map(([k, l]) => `<button class="chip${LS.filter === k ? ' on' : ''}" data-act="lib-chip" data-v="${k}">${l}</button>`).join('');
  const list = items.map((x) => grid
    ? `<button class="card${x.c.round ? ' round' : ''}" data-href="${collHref(x.c)}">${collCover(x.c)}<div class="c-title ellipsis">${esc(x.c.title)}</div><div class="c-sub">${esc(collSub(x.c))}</div></button>`
    : `<button class="track${x.c.round ? ' round' : ''}" data-href="${collHref(x.c)}">${collCover(x.c)}<div class="t-body"><div class="t-title ellipsis">${esc(x.c.title)}</div><div class="t-sub">${x.pinned ? I('pin', 'pin') : ''}${premiumBadge(x.c)}<span class="ellipsis">${esc(collSub(x.c))}</span></div></div></button>`).join('');
  return `<div class="page">${mainTop('Your Library', `<button class="icon-btn" data-act="lib-find" aria-label="Find">${I('search')}</button><button class="icon-btn" data-act="new-pl" aria-label="Create playlist">${I('plus')}</button>`)}
    ${LS.find ? `<div class="findbar"><label class="field">${I('search')}<input id="libq" placeholder="Find in Your Library" value="${esc(LS.q)}"></label><button class="btn-ghost" data-act="lib-find">Cancel</button></div>` : ''}
    <div class="chips">${LS.filter ? `<button class="chip" data-act="lib-chip" data-v="${LS.filter}" aria-label="Clear filter">${I('close')}</button>` : ''}${chips}</div>
    <div class="lib-tools"><button class="btn-sort" data-act="lib-sort">${I('sort')} ${sortLabel}</button><button class="icon-btn sm" data-act="lib-view" aria-label="Toggle view">${I(grid ? 'list' : 'grid')}</button></div>
    ${items.length ? `<div class="${grid ? 'lib-grid' : 'tracks lib-list'}">${list}</div>` : emptyState('library', 'Nothing here', 'Try another filter.')}
  </div>`;
}
function bindLibFind(focus) {
  const i = $('#libq'); if (!i) return;
  if (focus) i.focus();
  i.addEventListener('input', () => { LS.q = i.value; const pos = i.selectionStart; render(true); const j = $('#libq'); if (j) { j.focus(); j.setSelectionRange(pos, pos); } });
}

/* ---------- COLLECTION (playlist / artist / mix / song / shared) ---------- */
const CS = {};
const SORTS = [['custom', 'Custom order'], ['title', 'Title'], ['artist', 'Artist'], ['release', 'Release date'], ['added', 'Recently added']];
function viewColl(type, id) {
  const c = coll(type, id);
  if (!c) return `<div class="page">${backTop('')}${emptyState(type === 'track' || type === 'playlist' || type === 'artist' ? 'lock' : 'help', 'Not found', type === 'shared' ? 'This share link looks broken or incomplete. Ask your friend to send it again.' : type === 'local' ? 'This playlist only exists on the phone where it was made.' : 'This item is not in the library, or it needs Premium (Settings → Premium).')}</div>`;
  const key = type + ':' + id, st = CS[key] || (CS[key] = { sort: 'custom', q: '' });
  let ids = c.songs.slice();
  if (st.q) { const nq = norm(st.q); ids = ids.filter((x) => SONG.get(x)._hay.includes(nq)); }
  const S = (x) => SONG.get(x);
  if (st.sort === 'title') ids.sort((a, b) => S(a).title.localeCompare(S(b).title));
  else if (st.sort === 'artist') ids.sort((a, b) => S(a).artist.localeCompare(S(b).artist));
  else if (st.sort === 'added') ids.sort((a, b) => String(S(b).added).localeCompare(String(S(a).added)));
  else if (st.sort === 'release') ids.sort(byRelease);
  const { t, known } = totalDur(c.songs);
  const allDl = c.songs.length && c.songs.every((x) => U.dl.has(x));
  const n = c.songs.length, songsTxt = `${n} song${n === 1 ? '' : 's'}`;
  let meta;
  if (c.type === 'artist') meta = `${premiumBadge(c)}${songsTxt}${known && t ? ' · ' + fmtLong(t) : ''}`;
  else if (c.type === 'track') meta = `<b>${esc(c.song.artist)}</b>${c.song.dateText ? ' · ' + esc(c.song.dateText) : ''}${c.song.genre ? ' · ' + esc(c.song.genre) : ''}${dur(c.song) ? ' · ' + fmt(dur(c.song)) : ''}`;
  else meta = `${c.vault ? premiumBadge(c) : `<span class="mini-logo">${I('logo')}</span>`}<b>${c.local || c.special === 'liked' ? 'You' : c.shared ? 'A friend' : esc(SITE.name)}</b> · ${songsTxt}${known && t ? ', ' + fmtLong(t) : ''}`;

  let out = `<div class="page">${backTop(c.title, type, id)}
    <div class="hero${c.round ? ' round' : ''}" id="hero">${collCover(c)}
      <div><h1>${esc(c.title)}</h1>${c.desc ? `<div class="desc">${esc(c.desc)}</div>` : ''}<div class="meta">${meta}</div></div></div>
    <div class="actions">
      ${c.shared ? `<button class="btn-pill accent" data-act="save-shared" data-id="${esc(id)}">${I('libAdd')} Save</button>` : ''}
      ${c.type === 'track' ? `<button class="icon-btn${isLiked(id) ? ' on' : ''}" data-act="like" data-song="${esc(id)}" aria-label="Like">${I(isLiked(id) ? 'heartFill' : 'heart')}</button>` : ''}
      <button class="icon-btn${allDl ? ' dl-on' : ''}" data-act="coll-dl" data-type="${type}" data-id="${esc(id)}" aria-label="Download">${I(allDl ? 'dlFill' : 'dl')}</button>
      <button class="icon-btn" data-act="share-coll" data-type="${type}" data-id="${esc(id)}" aria-label="Share">${I('share')}</button>
      <button class="icon-btn" data-act="coll-more" data-type="${type}" data-id="${esc(id)}" aria-label="More">${I('more')}</button>
      <span class="spacer"></span>
      ${n > 1 ? `<button class="icon-btn big" data-act="shuffle" data-shufflebtn aria-label="Shuffle">${I('shuffle')}</button>` : ''}
      <button class="btn-play" data-act="play-coll" data-type="${type}" data-id="${esc(id)}" data-playbtn aria-label="Play">${I('play')}</button>
    </div>`;
  if (c.shared) out += `<div class="shared-note">${I('link')}<span>A friend shared this playlist. Tap <b>Save</b> to keep it in Your Library.</span></div>`;
  if (n > 5 && c.type !== 'track') {
    out += `<div class="findbar"><label class="field">${I('search')}<input id="cq" placeholder="Find in ${esc(c.kind.toLowerCase())}" value="${esc(st.q)}" data-key="${esc(key)}"></label>
      <button class="btn-ghost" data-act="coll-sort" data-key="${esc(key)}">${I('sort')} ${(SORTS.find((x) => x[0] === st.sort) || SORTS[0])[1].replace('Custom order', 'Order')}</button></div>`;
  }
  if (!n) {
    out += c.special === 'liked' ? emptyState('heart', 'Songs you like will appear here', 'Tap the heart on any song to save it.') :
      c.special === 'downloads' ? emptyState('dl', 'No downloads yet', 'Tap the download button on any playlist to keep it for offline listening.') :
      emptyState('note', 'This playlist is empty', c.local ? 'Add songs with ··· → Add to playlist.' : 'Songs will appear here soon.');
  } else {
    out += `<div class="tracks">${ids.map((x) => trackRow(SONG.get(x), { type, id })).join('')}</div>`;
    if (st.q && !ids.length) out += `<p class="muted">No matches in this list.</p>`;
  }
  if (c.type === 'track') {
    const s = c.song;
    if (s.lyrics) out += `<div class="lyrics-block">${esc(s.lyrics)}</div>`;
    const more = s.artists.flatMap((a) => ARTISTS.get(a)?.songs || []).filter((x, i, a) => x !== s.id && a.indexOf(x) === i);
    out += '<div style="height:24px"></div>' + section(`More by ${s.artists[0]}`, row(more.slice(0, 12).map((x) => cardSong(SONG.get(x), 'artist', s.artists[0]))));
  }
  if (c.type === 'artist') {
    const feats = PLAYLISTS.filter((p) => p.songs.some((x) => SONG.get(x).artists.includes(c.title))).map((p) => coll('playlist', p.id));
    out += '<div style="height:24px"></div>' + section('Featured in', row(feats.map((x) => cardColl(x))));
  }
  return out + '</div>';
}
const backTop = (title, type = '', id = '') => `<header class="topbar"><button class="icon-btn" data-act="back" aria-label="Back">${I('back')}</button><div class="t-title ellipsis">${esc(title)}</div>${type ? `<button class="icon-btn" data-act="coll-more" data-type="${type}" data-id="${esc(id)}" aria-label="More">${I('more')}</button>` : '<span style="width:40px;flex:none"></span>'}</header>`;
document.addEventListener('input', (e) => {
  if (e.target.id === 'cq') {
    const key = e.target.dataset.key; CS[key].q = e.target.value; const pos = e.target.selectionStart;
    render(true); const j = $('#cq'); if (j) { j.focus(); j.setSelectionRange(pos, pos); }
  }
});

/* ---------- PAGES: settings, history, about, help, terms, contact ---------- */
const palCard = (k) => { const p = PALETTES[k]; const on = U.settings.palette === k;
  return `<button class="pal${on ? ' on' : ''}" data-act="set" data-k="palette" data-v="${k}" aria-label="${esc(p.name)}"><div class="sw">${p.sw.map((c) => `<i style="background:${c}"></i>`).join('')}</div><b>${esc(p.name)}${on ? I('check') : ''}</b></button>`; };
function premiumBlock(li) {
  if (V.loaded) return `<div class="list-group">
      ${li('unlock', 'Premium unlocked', `${V.count} extra song${V.count === 1 ? '' : 's'} · remembered on this device`, '', '', 'ok')}
      ${li('lock', 'Lock premium on this device', 'You will need the password again', '', 'role="button" data-act="vault-lock"', 'danger')}
    </div>`;
  return `<div class="list-group">
      ${li('lock', 'Premium content', 'Enter the password to unlock hidden playlists. You only need to do this once on each device.')}
      <form class="premium-form" data-form="vault"><label class="field">${I('lock')}<input id="vault-pw" type="password" placeholder="Password" autocomplete="current-password" enterkeyhint="go"></label><button class="btn-pill accent" type="submit">Unlock</button></form>
    </div>`;
}
function viewPage(name) {
  const st = U.settings;
  const wrap = (title, body) => `<div class="page">${backTop(title)}<h1 class="page-title">${esc(title)}</h1>${body}</div>`;
  const li = (icon, title, sub, right = '', attrs = '', cls = '') => `<div class="li ${cls}" ${attrs}>${icon ? I(icon) : ''}<div class="li-body">${title}${sub ? `<small>${sub}</small>` : ''}</div>${right}</div>`;
  const sw = (k) => `<button class="switch${st[k] ? ' on' : ''}" data-act="set-toggle" data-k="${k}" aria-label="Toggle"></button>`;
  switch (name) {
    case 'settings': return wrap('Settings', `
      <div class="list-title">Appearance</div>
      <div class="list-group">
        ${li('moon', 'Mode', '', `<div class="seg">${['dark', 'light', 'system'].map((t) => `<button class="${st.mode === t ? 'on' : ''}" data-act="set" data-k="mode" data-v="${t}">${t[0].toUpperCase() + t.slice(1)}</button>`).join('')}</div>`)}
        ${li('palette', 'Colour palette', 'Changes the whole app')}
        <div class="pal-grid">${Object.keys(PALETTES).map(palCard).join('')}</div>
      </div>
      <div class="list-title">Playback</div>
      <div class="list-group">
        ${li('timer', 'Sleep timer', PS.sleep ? (PS.sleep.eot ? 'End of current song' : `${Math.max(1, Math.ceil((PS.sleep.until - Date.now()) / 60000))} min left`) : 'Off', I('back', 'rot'), 'role="button" data-act="sleep"')}
        ${li('mic', 'Show lyrics in player', 'Lyrics card under the controls', sw('showLyrics'))}
        ${li('clock', 'Continue where I left off', 'Remember the last song and position', sw('resume'))}
      </div>
      <div class="list-title">Storage on this device</div>
      <div class="list-group">
        ${li('dl', 'Downloads', `<span id="st-est">${U.dl.size} songs</span>`, I('back', 'rot'), 'role="button" data-href="#/downloads"')}
        ${li('trash', 'Remove all downloads', '', '', 'role="button" data-act="dl-clear-all"', 'danger')}
        ${li('clock', 'Clear listening history', `${U.history.length} plays`, '', 'role="button" data-act="clear-history"')}
        ${li('search', 'Clear recent searches', '', '', 'role="button" data-act="clear-searches"')}
        ${li('close', 'Reset everything', 'Likes, playlists, history, downloads, settings', '', 'role="button" data-act="reset-all"', 'danger')}
      </div>
      <div class="list-title" id="premium"><span class="badge-p">${I('crown')}</span> Premium</div>
      ${premiumBlock(li)}
      <p class="muted" style="font-size:12px;text-align:center">${esc(SITE.name)} v${VERSION}</p>`);
    case 'history': {
      const list = U.history.filter((x) => SONG.has(x.id)).slice(0, 200);
      if (!list.length) return wrap('Recents', emptyState('clock', 'Nothing played yet', 'Songs you play will show up here.'));
      const day = (t) => { const d = new Date(t), now = new Date(); const diff = Math.round((new Date(now.toDateString()) - new Date(d.toDateString())) / 864e5); return diff === 0 ? 'Today' : diff === 1 ? 'Yesterday' : d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' }); };
      let out = '', last = '';
      list.forEach((x) => {
        const d = day(x.t); if (d !== last) { out += `<div class="hist-day">${d}</div>`; last = d; }
        out += trackRow(SONG.get(x.id), { type: 'track', id: x.id, sub: `${esc(SONG.get(x.id).artist)} · ${new Date(x.t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}` });
      });
      return wrap('Recents', `<div class="actions"><button class="btn-pill" data-act="clear-history">${I('trash')} Clear history</button></div><div class="tracks">${out}</div>`);
    }
    case 'about': {
      const pub = SONGS.filter((s) => !s.vault);
      const { t, known } = totalDur(pub.map((s) => s.id));
      const gen = LIB.generated ? new Date(LIB.generated).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
      return wrap('About', `
        <div style="display:flex;gap:16px;align-items:center;margin-bottom:18px"><span class="logo-btn" style="width:64px;height:64px">${I('logo')}</span><div><b style="font-size:22px;letter-spacing:.06em">${esc(SITE.name)}</b><div class="muted">${esc(SITE.tagline)}</div></div></div>
        <p class="prose">${esc(SITE.about)}</p>
        <div class="list-group">
          ${li('note', 'Songs', '', `<b>${pub.length}</b>`)}${li('user', 'Artists', '', `<b>${[...ARTISTS.values()].filter((a) => !a.vault).length}</b>`)}${li('library', 'Playlists', '', `<b>${PLAYLISTS.filter((p) => !p.vault).length}</b>`)}
          ${known && t ? li('clock', 'Total music', '', `<b>${fmtLong(t)}</b>`) : ''}
          ${li('bolt', 'Library updated', '', `<span class="muted">${gen}</span>`)}
          ${li('info', 'Version', '', `<span class="muted">${VERSION}</span>`)}
        </div>
        ${SITE.owner ? `<p class="muted" style="text-align:center">Curated by ${esc(SITE.owner)}</p>` : ''}`);
    }
    case 'help': {
      const faq = [
        ['Install it like an app (iPhone)', 'Open the site in Safari → tap the Share button → “Add to Home Screen”. It opens full-screen with its own icon, and your likes, playlists and downloads are kept more reliably.'],
        ['Does music keep playing with the screen locked?', 'Yes. Start a song, then lock the phone or switch apps. Control it from the lock screen, Control Centre, headphones, Bluetooth or CarPlay.'],
        ['Playing in the car', 'Connect the phone via Bluetooth or CarPlay, open the site and press play. Song title, artist and cover appear on the car screen; next/previous buttons on the steering wheel work too.'],
        ['Listening offline', 'Tap the download arrow on a playlist (or ··· → Download on a song). Downloaded songs show a small arrow and play without internet.'],
        ['Sharing', 'Tap the share icon on any song, playlist or artist. Your own playlists and Liked Songs are shared as a snapshot: your friend opens the link and taps Save to keep a copy.'],
        ['What is Premium?', 'Some playlists are hidden. If you were given the password, open Settings → Premium (at the bottom) and enter it once. The device remembers it.'],
        ['What can I search?', 'Song titles, artists, genres, playlist names, a line of the lyrics, a release year like 2026 or a month like “November 2025”. Small typos are forgiven.'],
        ['Likes, playlists and history', 'Everything you like or create is saved only on this device and browser. Nobody else can see it.'],
        ['Colours', 'Tap the logo → Settings → pick a palette and dark or light mode.'],
        ['Gestures', 'Swipe the mini player or the big cover left/right to skip. Swipe the full player down to close it.'],
        ['A song is missing or won’t play', 'Use Contact to tell the owner which one.'],
      ];
      return wrap('Help', faq.map(([q, a]) => `<details class="faq"><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join(''));
    }
    case 'terms': return wrap('Terms & privacy', `<div class="prose"><ol>${(SITE.terms || []).map((t) => `<li>${esc(t)}</li>`).join('')}</ol></div>`);
    case 'contact': {
      const c = SITE.contact || {};
      const links = [['mail', 'Email', c.email && `mailto:${c.email}`, c.email], ['link', 'Instagram', c.instagram, c.instagram], ['link', 'Telegram', c.telegram, c.telegram], ['link', 'WhatsApp', c.whatsapp, c.whatsapp]].filter((x) => x[2]);
      return wrap('Contact', `<p class="prose">Song request, broken file or idea? Get in touch.</p><div class="list-group">${links.map(([ic, l, h, v]) => `<a class="li" href="${esc(h)}" target="_blank" rel="noopener">${I(ic)}<div class="li-body">${l}<small>${esc(String(v).replace(/^https?:\/\//, ''))}</small></div></a>`).join('') || li('info', 'No contact set', 'Add details in config.js')}</div>`);
    }
    default: return wrap('Not found', emptyState('help', 'Page not found', ''));
  }
}
async function estimateStorage() {
  try { const e = await navigator.storage.estimate(); const el = $('#st-est'); if (el) el.textContent = `${U.dl.size} songs · ${(e.usage / 1048576).toFixed(0)} MB used`; } catch { }
}

/* ---------- tab bar, sidebar, drawer ---------- */
function renderTabbar() {
  $('#tabbar').innerHTML = TABS.map((t) => `<button class="tab${t.cls ? ' ' + t.cls : ''}${lastTab === t.id ? ' on' : ''}" data-act="tab" data-v="${t.id}">${I(lastTab === t.id ? t.on : t.icon)}<span>${t.label}</span></button>`).join('');
}
function renderSidebar() {
  const el = $('#sidebar'); if (!el) return;
  if (window.innerWidth < 1024) { el.innerHTML = ''; return; }
  const sc = $('.side-box.grow', el)?.scrollTop || 0;
  el.innerHTML = `<div class="side-box"><div class="side-brand"><button class="logo-btn" data-act="drawer" aria-label="Menu">${I('logo')}</button>${esc(SITE.name)}</div>
    ${TABS.map((t) => `<button class="side-nav${lastTab === t.id ? ' on' : ''}" data-act="tab" data-v="${t.id}">${I(lastTab === t.id ? t.on : t.icon)} ${t.label}</button>`).join('')}</div>
    <div class="side-box grow"><div class="side-lib-head"><button data-href="#/library" style="display:flex;gap:10px;align-items:center;font-weight:700">${I('library')} Your Library</button><button class="icon-btn sm" data-act="new-pl" aria-label="Create playlist">${I('plus')}</button></div>
    <div class="tracks lib-list">${libItems().slice(0, 80).map((x) => `<button class="track${x.c.round ? ' round' : ''}" data-href="${collHref(x.c)}">${collCover(x.c)}<div class="t-body"><div class="t-title ellipsis">${esc(x.c.title)}</div><div class="t-sub">${premiumBadge(x.c)}<span class="ellipsis">${esc(collSub(x.c))}</span></div></div></button>`).join('')}</div></div>`;
  const g = $('.side-box.grow', el); if (g) g.scrollTop = sc;
}
let rsT; window.addEventListener('resize', () => { clearTimeout(rsT); rsT = setTimeout(renderSidebar, 150); });

function openDrawer() {
  const dark = document.documentElement.dataset.theme === 'dark';
  $('#drawer').innerHTML = `
    <div class="d-head"><span class="logo-btn">${I('logo')}</span><div><b>${esc(SITE.name)}</b><small>${esc(SITE.tagline)}</small></div></div>
    <button class="d-item" data-href="#/page/history">${I('clock')} Recents</button>
    <button class="d-item" data-href="#/latest">${I('bolt')} What's new</button>
    <button class="d-item" data-href="#/downloads">${I('dl')} Downloads</button>
    <button class="d-item" data-act="theme-toggle">${I('moon')} Dark mode <span class="right switch${dark ? ' on' : ''}"></span></button>
    <div class="d-item" style="padding-bottom:8px">${I('palette')} Colours</div>
    <div class="d-pal">${Object.entries(PALETTES).map(([k, p]) => `<button class="dot${U.settings.palette === k ? ' on' : ''}" style="background:linear-gradient(135deg,${p.sw[2]} 50%,${p.sw[1]} 50%)" data-act="set" data-k="palette" data-v="${k}" aria-label="${esc(p.name)}" title="${esc(p.name)}"></button>`).join('')}</div>
    <button class="d-item" data-href="#/page/settings">${I('sliders')} Settings</button>
    <button class="d-item" data-href="#/page/help">${I('help')} Help</button>
    <button class="d-item" data-href="#/page/about">${I('info')} About</button>
    <button class="d-item" data-href="#/page/terms">${I('doc')} Terms & privacy</button>
    <button class="d-item" data-href="#/page/contact">${I('mail')} Contact</button>
    <div class="d-foot">${SONGS.filter((s) => !s.vault).length} songs · ${PLAYLISTS.filter((p) => !p.vault).length} playlists${LIB.generated ? '<br>Updated ' + new Date(LIB.generated).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}</div>`;
  $('#drawer').classList.add('open'); $('#drawer-scrim').classList.add('open'); $('#drawer').setAttribute('aria-hidden', 'false');
}
function closeDrawer() { $('#drawer').classList.remove('open'); $('#drawer-scrim').classList.remove('open'); $('#drawer').setAttribute('aria-hidden', 'true'); }

/* ---------- bottom sheet menus ---------- */
function openSheet(html) { const s = $('#sheet'); s.innerHTML = `<div class="grab"></div>${html}`; s.classList.add('open'); s.scrollTop = 0; $('#sheet-scrim').classList.add('open'); s.setAttribute('aria-hidden', 'false'); }
function closeSheet() { $('#sheet').classList.remove('open'); $('#sheet-scrim').classList.remove('open'); $('#sheet').setAttribute('aria-hidden', 'true'); }
swipe($('#sheet'), { down: () => { if ($('#sheet').scrollTop <= 0) closeSheet(); } }, true);
const sItem = (icon, label, cmd, data = {}, on = false) => `<button class="s-item${on ? ' on' : ''}" data-act="menu" data-cmd="${cmd}" ${Object.entries(data).map(([k, v]) => `data-${k}="${esc(v)}"`).join(' ')}>${I(icon)}<span>${esc(label)}</span>${on ? I('check', 'check') : ''}</button>`;

function trackMenu(id, type, cid) {
  const s = SONG.get(id); if (!s) return;
  const d = { song: id, type: type || '', id: cid || '' };
  const liked = isLiked(id), dl = U.dl.has(id);
  openSheet(`<div class="s-head">${songCover(s)}<div style="min-width:0"><b class="ellipsis">${esc(s.title)}</b><span class="muted ellipsis" style="display:block">${esc(s.artist)}${s.dateText ? ' · ' + esc(s.dateText) : ''}</span></div></div>
    ${sItem(liked ? 'heartFill' : 'heart', liked ? 'Remove from Liked Songs' : 'Add to Liked Songs', 'like', d, liked)}
    ${sItem('addList', 'Add to playlist', 'addpl', d)}
    ${type === 'local' ? sItem('trash', 'Remove from this playlist', 'rmpl', d) : ''}
    ${sItem('queue', 'Add to queue', 'queue', d)}
    ${sItem('next', 'Play next', 'playnext', d)}
    ${sItem(dl ? 'dlFill' : 'dl', dl ? 'Remove download' : 'Download', 'dl', d, dl)}
    ${sItem('save', 'Save file to device', 'save', d)}
    ${s.lyrics ? sItem('mic', 'View lyrics', 'lyrics', d) : ''}
    ${sItem('user', s.artists.length > 1 ? 'Go to artists' : 'Go to artist', 'artist', d)}
    ${sItem('info', 'Song details', 'details', d)}
    ${sItem('share', 'Share', 'share', d)}`);
}
function collMenu(type, id) {
  const c = coll(type, id); if (!c) return;
  if (type === 'track') return trackMenu(id, '', '');
  const d = { type, id }, allDl = c.songs.length && c.songs.every((x) => U.dl.has(x));
  openSheet(`<div class="s-head">${collCover(c)}<div style="min-width:0"><b class="ellipsis">${esc(c.title)}</b><span class="muted">${esc(collSub(c))}</span></div></div>
    ${c.shared ? sItem('libAdd', 'Save to Your Library', 'csave', d) : ''}
    ${sItem('shuffle', 'Shuffle play', 'cshuffle', d)}
    ${sItem('queue', 'Add to queue', 'cqueue', d)}
    ${sItem(allDl ? 'dlFill' : 'dl', allDl ? 'Remove download' : 'Download', 'cdl', d, allDl)}
    ${sItem('share', 'Share', 'cshare', d)}
    ${c.local ? sItem('edit', 'Rename', 'crename', d) + sItem('trash', 'Delete playlist', 'cdelete', d) : ''}`);
}
function sleepMenu() {
  const cur = PS.sleep ? (PS.sleep.eot ? 'eot' : '') : '0';
  openSheet(`<div class="s-title">Sleep timer</div>${[[5, '5 minutes'], [15, '15 minutes'], [30, '30 minutes'], [45, '45 minutes'], [60, '1 hour'], ['eot', 'End of song'], [0, 'Off']]
    .map(([v, l]) => sItem('timer', l, 'sleep', { v }, String(cur) === String(v))).join('')}`);
}
function addToPlaylistMenu(songIds) {
  openSheet(`<div class="s-title">Add to playlist</div>
    ${sItem('plus', 'New playlist', 'newpl-add', { songs: songIds.join(',') })}
    ${U.local.map((p) => sItem('library', p.title, 'addto', { pl: p.id, songs: songIds.join(',') })).join('')}
    ${U.local.length ? '' : '<p class="muted" style="padding:0 20px">Your own playlists live only on this device.</p>'}`);
}
function createPlaylist(songs = []) {
  const name = (window.prompt('Name your playlist', `My playlist #${U.local.length + 1}`) || '').trim();
  if (!name) return null;
  const p = { id: 'local-' + Date.now().toString(36), title: name.slice(0, 80), created: new Date().toISOString().slice(0, 10), songs: songs.slice() };
  U.local.unshift(p); saveU('local'); renderSidebar();
  toast(songs.length ? `Added to ${p.title}` : `Created ${p.title}`);
  return p;
}

/* =========================================================
   Events
   ========================================================= */
let navCount = 0, goingBack = false;
function closeLayers() { closeSheet(); closeDrawer(); closeOverlay(); closeFull(); }
function applyTheme() {
  const st = U.settings; let m = st.mode;
  if (m === 'system') m = matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  const root = document.documentElement;
  root.dataset.theme = m;
  root.dataset.palette = st.palette in PALETTES ? st.palette : 'evergreen';
  const bg = getComputedStyle(root).getPropertyValue('--bg').trim() || '#121212';
  $('meta[name="theme-color"]').setAttribute('content', bg);
}
matchMedia('(prefers-color-scheme: light)').addEventListener?.('change', () => { if (U.settings.mode === 'system') applyTheme(); });
const saveSettings = () => store.set('settings', U.settings);
const goArtistOf = (s) => {
  if (s.artists.length > 1) openSheet(`<div class="s-title">Artists</div>${s.artists.map((a) => `<button class="s-item" data-href="#/artist/${enc64(a)}">${I('user')}<span>${esc(a)}</span></button>`).join('')}`);
  else { closeLayers(); go(`#/artist/${enc64(s.artists[0])}`); }
};

document.addEventListener('submit', (e) => {
  const f = e.target.closest('[data-form="vault"]'); if (!f) return;
  e.preventDefault();
  const i = $('#vault-pw'); const pw = (i?.value || '').trim();
  if (!pw) { toast('Enter the password'); return; }
  i.blur(); unlockVault(pw);
});

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act],[data-href]'); if (!el) return;
  const sw = el.closest('.m-swipe'); if (sw && sw._swiped && Date.now() - sw._swiped < 450) return;
  const d = el.dataset, act = d.act;
  if (d.pick) { const k = d.pick.indexOf(':'); pushSearch(d.pick.slice(0, k), d.pick.slice(k + 1)); }
  if (!act && d.href) { e.preventDefault(); closeLayers(); go(d.href); return; }
  switch (act) {
    case 'tab': closeLayers(); if (route().r === d.v) window.scrollTo({ top: 0, behavior: 'smooth' }); else go('#/' + d.v); break;
    case 'back': if (navCount > 0) { goingBack = true; history.back(); } else go('#/' + (lastTab || 'home')); break;
    case 'drawer': openDrawer(); break;
    case 'open-full': openFull(); break;
    case 'close-full': closeFull(); break;
    case 'close-ov': closeOverlay(); break;
    case 'goto-ctx': { const c = PS.ctx && coll(PS.ctx.type, PS.ctx.id); if (c) { closeLayers(); go(collHref(c)); } break; }
    case 'goto-artist': { const s = SONG.get(PS.cur); if (s) goArtistOf(s); break; }

    case 'toggle': toggle(); break;
    case 'next': next(false); break;
    case 'prev': prev(); break;
    case 'shuffle': setShuffle(!PS.shuffle); if (elOv.classList.contains('queue-o')) openQueue(); break;
    case 'repeat': cycleRepeat(); break;
    case 'play-track': {
      if (PS.cur === d.song && sameCtx(d.type, d.id)) { if (!isPlaying()) toggle(); else openFull(); break; }
      playColl(coll(d.type, d.id) || coll('track', d.song), d.song); break;
    }
    case 'play-coll': { e.stopPropagation(); if (sameCtx(d.type, d.id)) toggle(); else playColl(coll(d.type, d.id)); break; }
    case 'like-cur': if (PS.cur) toggleLike(PS.cur); break;
    case 'like': toggleLike(d.song); break;
    case 'lyrics': if (PS.cur) openLyrics(PS.cur); break;
    case 'queue': openQueue(); break;
    case 'queue-jump': {
      const i = +d.i;
      if (d.kind === 'm') { const [id] = PS.manual.splice(i, 1); load(id, true); }
      else { PS.idx = i; load(PS.queue[i], true); }
      break;
    }
    case 'queue-remove': e.stopPropagation(); PS.manual.splice(+d.i, 1); saveState(); openQueue(); break;
    case 'queue-clear': PS.manual = []; saveState(); openQueue(); break;
    case 'sleep': sleepMenu(); break;
    case 'mute': { const v = $('#vol'); if (audio.volume > 0) { v.dataset.prev = v.value; v.value = 0; } else v.value = v.dataset.prev || 100; v.dispatchEvent(new Event('input')); break; }
    case 'share-cur': { const s = SONG.get(PS.cur); if (s) share(s.title, `#/track/${enc64(s.id)}`); break; }
    case 'share-song': { const s = SONG.get(d.song); if (s) share(s.title, `#/track/${enc64(s.id)}`); break; }
    case 'cur-more': if (PS.cur) trackMenu(PS.cur, PS.ctx?.type, PS.ctx?.id); break;

    case 'track-more': e.stopPropagation(); trackMenu(d.song, d.type, d.id); break;
    case 'coll-more': collMenu(d.type, d.id); break;
    case 'menu': runMenu(d); break;
    case 'coll-dl': { const c = coll(d.type, d.id); if (!c || !c.songs.length) break; const all = c.songs.every((x) => U.dl.has(x)); if (all) { if (confirm(`Remove “${c.title}” from downloads?`)) removeDownload(c.songs); } else download(c.songs); break; }
    case 'share-coll': shareColl(coll(d.type, d.id)); break;
    case 'save-shared': saveShared(d.id); break;
    case 'coll-sort': openSheet(`<div class="s-title">Sort by</div>${SORTS.map(([v, l]) => sItem('sort', l, 'csort', { key: d.key, v }, CS[d.key].sort === v)).join('')}`); break;

    case 'clear-q': e.preventDefault(); SQ.q = ''; SQ.filter = 'all'; $('#q').value = ''; el.classList.add('hidden'); renderResults(); $('#q').focus(); break;
    case 'schip': SQ.filter = SQ.filter === d.v && d.v !== 'all' ? 'all' : d.v; renderResults(); window.scrollTo(0, 0); break;
    case 'search-forget': e.stopPropagation(); U.searches.splice(+d.i, 1); saveU('searches'); renderResults(); break;
    case 'search-clear': U.searches = []; saveU('searches'); renderResults(); break;

    case 'lib-chip': LS.filter = LS.filter === d.v ? '' : d.v; render(true); break;
    case 'lib-view': U.settings.libView = U.settings.libView === 'grid' ? 'list' : 'grid'; saveSettings(); render(true); break;
    case 'lib-sort': openSheet(`<div class="s-title">Sort by</div>${[['recents', 'Recents'], ['added', 'Recently added'], ['alpha', 'Alphabetical']].map(([v, l]) => sItem('sort', l, 'libsort', { v }, U.settings.libSort === v)).join('')}`); break;
    case 'lib-find': LS.find = !LS.find; if (!LS.find) LS.q = ''; render(true); bindLibFind(true); break;
    case 'new-pl': { const p = createPlaylist(); if (p) { closeLayers(); go(`#/local/${enc64(p.id)}`); } break; }

    case 'warp-go': {
      const id = d.id || '';
      if (sameCtx('warp', id)) toggle();
      else { const c = coll('warp', id); if (!c.songs.length) { toast('Nothing here yet'); break; } playColl(c, null, { forceShuffle: true }); toast(c.title); }
      break;
    }
    case 'warp-surprise': { const c = coll('warp', ''); if (!c.songs.length) break; playColl(c, c.songs[(Math.random() * c.songs.length) | 0], { forceShuffle: true }); openFull(); break; }

    case 'set': U.settings[d.k] = d.v; saveSettings(); applyTheme(); if (route().r === 'page') render(true); if ($('#drawer').classList.contains('open')) openDrawer(); break;
    case 'set-toggle': U.settings[d.k] = !U.settings[d.k]; saveSettings(); render(true); if (PS.cur) updateNowPlaying(); break;
    case 'theme-toggle': U.settings.mode = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; saveSettings(); applyTheme(); openDrawer(); if (route().r === 'page') render(true); break;
    case 'vault-lock': if (confirm('Lock premium content on this device?')) lockVault(); break;
    case 'clear-history': if (confirm('Clear your listening history?')) { U.history = []; U.recents = []; saveU('history'); saveU('recents'); render(true); toast('History cleared'); } break;
    case 'clear-searches': U.searches = []; saveU('searches'); toast('Recent searches cleared'); break;
    case 'dl-clear-all': if (U.dl.size && confirm('Remove all downloaded songs from this device?')) { (async () => { if (canCache) await caches.delete(MEDIA_CACHE); U.dl.clear(); saveU('dl'); notifySW(); refreshDownloads(); toast('Downloads removed'); })(); } break;
    case 'reset-all': if (confirm('Reset everything on this device? Likes, your playlists, history, downloads, premium and settings will be removed.')) {
      (async () => { Object.keys(localStorage).filter((k) => k.startsWith('orbit.')).forEach((k) => localStorage.removeItem(k)); if (canCache) await caches.delete(MEDIA_CACHE); location.hash = '#/home'; location.reload(); })(); } break;
    default: if (d.href) { closeLayers(); go(d.href); }
  }
});

function runMenu(d) {
  const s = SONG.get(d.song), c = d.type ? coll(d.type, d.id) : null;
  if (!['addpl', 'artist'].includes(d.cmd)) closeSheet();
  switch (d.cmd) {
    case 'like': toggleLike(d.song); break;
    case 'addpl': addToPlaylistMenu([d.song]); break;
    case 'newpl-add': createPlaylist(d.songs.split(',')); break;
    case 'addto': { const p = U.local.find((x) => x.id === d.pl); if (!p) break; const add = d.songs.split(',').filter((x) => !p.songs.includes(x)); p.songs.push(...add); saveU('local'); toast(add.length ? `Added to ${p.title}` : `Already in ${p.title}`); renderSidebar(); if (route().r === 'local') render(true); break; }
    case 'rmpl': { const p = U.local.find((x) => x.id === d.id); if (p) { p.songs = p.songs.filter((x) => x !== d.song); saveU('local'); render(true); toast(`Removed from ${p.title}`); } break; }
    case 'queue': addToQueue([d.song]); break;
    case 'playnext': addToQueue([d.song], true); break;
    case 'dl': U.dl.has(d.song) ? removeDownload([d.song]) : download([d.song]); break;
    case 'save': saveToDevice(s).catch(() => toast('Could not save the file')); break;
    case 'lyrics': openLyrics(d.song); break;
    case 'artist': goArtistOf(s); break;
    case 'details': closeLayers(); go(`#/track/${enc64(s.id)}`); break;
    case 'share': share(s.title, `#/track/${enc64(s.id)}`); break;
    case 'sleep': setSleep(d.v === 'eot' ? 'eot' : +d.v); if (route().arg === 'settings') render(true); break;
    case 'libsort': U.settings.libSort = d.v; saveSettings(); render(true); break;
    case 'csort': CS[d.key].sort = d.v; render(true); break;
    case 'csave': saveShared(d.id); break;
    case 'cshuffle': if (c) playColl(c, null, { forceShuffle: true }); break;
    case 'cqueue': if (c) addToQueue(c.songs); break;
    case 'cdl': if (c) { c.songs.every((x) => U.dl.has(x)) ? removeDownload(c.songs) : download(c.songs); } break;
    case 'cshare': shareColl(c); break;
    case 'crename': { const p = U.local.find((x) => x.id === d.id); const n = p && (window.prompt('Rename playlist', p.title) || '').trim(); if (n) { p.title = n.slice(0, 80); saveU('local'); render(true); } break; }
    case 'cdelete': { if (confirm('Delete this playlist?')) { U.local = U.local.filter((x) => x.id !== d.id); saveU('local'); go('#/library'); } break; }
  }
}

document.addEventListener('keydown', (e) => {
  const typing = /INPUT|TEXTAREA/.test(document.activeElement?.tagName);
  if (e.key === 'Escape') { closeSheet(); closeDrawer(); if (elOv.classList.contains('open')) closeOverlay(); else closeFull(); return; }
  if (typing) return;
  if (e.code === 'Space' && !document.activeElement?.closest?.('button,[role=button]')) { e.preventDefault(); toggle(); }
  else if (e.key === 'ArrowRight' && e.shiftKey) next(false);
  else if (e.key === 'ArrowLeft' && e.shiftKey) prev();
  else if (e.key === '/') { e.preventDefault(); go('#/search'); setTimeout(() => $('#q')?.focus(), 50); }
  else if (e.key === 'Enter' && document.activeElement?.matches?.('[role=button]')) document.activeElement.click();
});
$('#sheet-scrim').addEventListener('click', closeSheet);
$('#drawer-scrim').addEventListener('click', closeDrawer);
window.addEventListener('hashchange', () => { navCount = goingBack ? Math.max(0, navCount - 1) : navCount + 1; goingBack = false; render(); });
window.addEventListener('pagehide', saveState);
document.addEventListener('visibilitychange', () => { if (document.hidden) saveState(); });

/* =========================================================
   Start
   ========================================================= */
(async () => {
  applyTheme();
  buildPlayerUI();
  let vp = null;
  if (store.get('vault', null)) {
    vp = openVault(null).catch((e) => { if (['wrong', 'missing', 'format'].includes(e.message)) store.del('vault'); throw e; });
    try { await Promise.race([vp, new Promise((_, r) => setTimeout(() => r(new Error('slow')), 8000))]); } catch { }
  }
  restore();
  render();
  if (vp && !V.loaded) vp.then(() => { if (!PS.cur) restore(); render(true); }).catch(() => {});
  reconcileDownloads();
  if ('serviceWorker' in navigator && canCache) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
})();
