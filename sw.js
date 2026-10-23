/* Uso offline: il sito, i dati e le foto viste restano sul telefono;
   le tile della mappa già visitate pure (fino a un limite). */
const VERSIONE = "sl-v1";
const TILE = "sl-tile";
const MAX_TILE = 800;

const GUSCIO = [
  "./",
  "index.html",
  "css/stile.css",
  "js/app.js",
  "data/itinerario.json",
  "vendor/leaflet/leaflet.css",
  "vendor/leaflet/leaflet.js",
  "fonts/young-serif-latin.woff2",
  "fonts/atkinson-hyperlegible-next-latin.woff2",
  "icone/icona.svg",
  "manifest.webmanifest"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSIONE).then((c) => c.addAll(GUSCIO)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((nomi) => Promise.all(nomi.filter((n) => n !== VERSIONE && n !== TILE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (url.hostname === "tile.openstreetmap.org") {
    e.respondWith(tile(req));
    return;
  }
  if (url.origin !== self.location.origin) return;

  // Pagina e dati: prima la rete (così le modifiche al JSON si vedono subito), poi la copia salvata
  if (req.mode === "navigate" || url.pathname.endsWith(".json")) {
    e.respondWith(primaRete(req));
    return;
  }
  // Tutto il resto: subito dalla copia salvata, aggiornata in background
  e.respondWith(copiaPoiAggiorna(req, e));
});

async function primaRete(req) {
  const cache = await caches.open(VERSIONE);
  try {
    const r = await fetch(req);
    if (r.ok) cache.put(req.mode === "navigate" ? "index.html" : req.url.split("?")[0], r.clone());
    return r;
  } catch (err) {
    const salvata = req.mode === "navigate"
      ? await cache.match("index.html")
      : await cache.match(req, { ignoreSearch: true });
    if (salvata) return salvata;
    // una foto.json mai vista offline: nessuna foto
    if (req.url.endsWith("foto.json")) return new Response("[]", { headers: { "Content-Type": "application/json" } });
    throw err;
  }
}

async function copiaPoiAggiorna(req, e) {
  const cache = await caches.open(VERSIONE);
  const salvata = await cache.match(req);
  const rete = fetch(req).then((r) => {
    if (r.ok) cache.put(req, r.clone());
    return r;
  });
  if (salvata) {
    e.waitUntil(rete.catch(() => {}));
    return salvata;
  }
  return rete;
}

async function tile(req) {
  const cache = await caches.open(TILE);
  const salvata = await cache.match(req);
  if (salvata) return salvata;
  const r = await fetch(req);
  if (r.ok) {
    await cache.put(req, r.clone());
    const chiavi = await cache.keys();
    for (let i = 0; i < chiavi.length - MAX_TILE; i++) await cache.delete(chiavi[i]);
  }
  return r;
}
