/* ORBIT service worker: offline app shell + downloaded songs (with seeking support) */
const SHELL = 'orbit-shell-v2';
const MEDIA = 'orbit-media-v1';
const IMAGES = 'orbit-img-v1';
const SHELL_FILES = ['./', 'index.html', 'styles.css', 'app.js', 'config.js', 'library.js', 'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png'];
const AUDIO_RE = /\.(mp3|m4a|aac|mp4|wav|ogg|oga|opus|flac|webm)$/i;
const IMG_RE = /\.(jpe?g|png|webp|gif|svg)$/i;
let known = new Set(); // URLs of downloaded songs

async function loadKnown() {
  try { const c = await caches.open(MEDIA); known = new Set((await c.keys()).map((r) => r.url)); } catch { }
}
loadKnown();

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => Promise.all(SHELL_FILES.map((f) => c.add(f).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keep = [SHELL, MEDIA, IMAGES];
    for (const k of await caches.keys()) if (!keep.includes(k)) await caches.delete(k);
    await self.clients.claim();
  })());
});
self.addEventListener('message', (e) => { if (e.data?.type === 'refresh-media') e.waitUntil ? e.waitUntil(loadKnown()) : loadKnown(); });

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  const href = url.href.split('#')[0];
  if (AUDIO_RE.test(url.pathname)) {
    if (known.has(href) || !self.navigator.onLine) e.respondWith(media(req, href));
    return;
  }
  if (IMG_RE.test(url.pathname)) { e.respondWith(staleWhileRevalidate(req)); return; }
  e.respondWith(networkFirst(req));
});

async function media(req, href) {
  const hit = await (await caches.open(MEDIA)).match(href);
  if (!hit) return fetch(req);
  const buf = await hit.arrayBuffer();
  const total = buf.byteLength;
  const type = hit.headers.get('Content-Type') || 'audio/mpeg';
  const range = req.headers.get('range');
  if (!range) return new Response(buf, { status: 200, headers: { 'Content-Type': type, 'Content-Length': String(total), 'Accept-Ranges': 'bytes' } });
  const m = /bytes=(\d*)-(\d*)/.exec(range) || [];
  let start, end;
  if (m[1] === '' && m[2]) { start = Math.max(0, total - Number(m[2])); end = total - 1; }
  else { start = Number(m[1] || 0); end = m[2] ? Math.min(Number(m[2]), total - 1) : total - 1; }
  if (start >= total) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${total}` } });
  return new Response(buf.slice(start, end + 1), {
    status: 206,
    headers: { 'Content-Type': type, 'Content-Range': `bytes ${start}-${end}/${total}`, 'Content-Length': String(end - start + 1), 'Accept-Ranges': 'bytes' },
  });
}
async function staleWhileRevalidate(req) {
  const hit = await caches.match(req, { ignoreSearch: true });
  const fresh = fetch(req).then(async (res) => { if (res.ok) (await caches.open(IMAGES)).put(req, res.clone()); return res; }).catch(() => null);
  return hit || (await fresh) || new Response('', { status: 404 });
}
async function networkFirst(req) {
  try {
    const res = await fetch(req, { cache: 'no-cache' });
    if (res.ok) (await caches.open(SHELL)).put(req, res.clone());
    return res;
  } catch {
    const hit = await caches.match(req, { ignoreSearch: true });
    if (hit) return hit;
    if (req.mode === 'navigate') return (await caches.match('index.html')) || (await caches.match('./'));
    return new Response('', { status: 504 });
  }
}
