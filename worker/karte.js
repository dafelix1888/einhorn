// Cloudflare Worker „Karte“: Zwischenstation für die freien Kartendienste des Planers.
// - meldet sich mit eigenem Namen (User-Agent) an, wie es Nominatim und Overpass verlangen
// - merkt sich Antworten im Cloudflare-Cache, damit dieselbe Gegend nicht zweimal abgefragt wird
// - fragt Overpass hartnäckig: reihum bis zu 8 Versuche, nach Ablehnung kurz warten, höchstens zwei gleichzeitig; erster Treffer gewinnt
// - nimmt nur Anfragen von der App an (Herkunft) und nur Abfragen, wie der Planer sie stellt
//
//   GET  /suche?q=…&lat=…&lon=…      Vorschläge beim Tippen (Photon)
//   GET  /adresse?q=…                 Adresse → Koordinaten (Nominatim)
//   GET  /hoehe?latitude=…&longitude=…  Höhen (Open-Meteo), bis 100 Punkte
//   POST /overpass   body: data=…      Wege und Orte (Overpass)

const AGENT = 'Schatzweg/1.0 (+https://schatzweg.de)';
const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
const OVERPASS_VERSATZ = 8000, OVERPASS_JE_SERVER = 60000, OVERPASS_GESAMT = 85000, OVERPASS_VERSUCHE = 8, OVERPASS_PAUSE = 1500;   // Gesamt unter dem Zeitlimit des Planers (95 s)
const TAG = 86400;

function cors(req, env) {
  const o = req.headers.get('Origin') || '';
  const ok = (env.ERLAUBTE_URSPRUENGE || '').split(',').map((s) => s.trim()).includes(o);
  return { 'Access-Control-Allow-Origin': ok ? o : 'null', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', Vary: 'Origin', ok };
}
async function hash(s) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('').slice(0, 40);
}
function antwort(text, status, h, quelle, alter) {
  const { ok, ...kopf } = h;
  return new Response(text, { status, headers: { ...kopf, 'Content-Type': 'application/json; charset=utf-8', 'X-Karte': quelle, ...(alter ? { 'Cache-Control': 'public, max-age=' + alter } : {}) } });
}
function fehler(status, meldung, h) { return antwort(JSON.stringify({ fehler: meldung }), status, h, 'fehler'); }

async function mitZeit(p, ms) {
  let t; const z = new Promise((_, nein) => { t = setTimeout(() => nein(new Error('Zeit')), ms); });
  try { return await Promise.race([p, z]); } finally { clearTimeout(t); }
}

// holt eine Antwort aus dem Cache oder vom Dienst; bei Fehlern des Dienstes darf eine ältere Antwort einspringen
async function gemerkt(ctx, schluessel, frisch, holen) {
  const cache = caches.default, key = new Request('https://karte.cache/' + schluessel);
  const alt = await cache.match(key);
  if (alt) {
    const zeit = +alt.headers.get('X-Gemerkt') || 0;
    if (Date.now() - zeit < frisch * 1000) return { text: await alt.text(), quelle: 'cache' };
  }
  try {
    const text = await holen();
    ctx.waitUntil(cache.put(key, new Response(text, { headers: { 'Cache-Control': 'public, max-age=' + 30 * TAG, 'X-Gemerkt': String(Date.now()) } })));
    return { text, quelle: 'dienst' };
  } catch (e) {
    if (alt) return { text: await alt.text(), quelle: 'cache-alt' };
    throw e;
  }
}
async function holeJson(url, init, ms) {
  const r = await mitZeit(fetch(url, { ...init, headers: { 'User-Agent': AGENT, 'Accept-Language': 'de', ...((init && init.headers) || {}) } }), ms || 15000);
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const text = await r.text(); JSON.parse(text); return text;    // nur gültiges JSON merken
}
// Overpass hartnäckig fragen (UNICORN-7, Praxistest 9. Nov.): Die öffentlichen Server lehnen bei Last sofort ab (502/504)
// und antworten sonst nach 15–45 s. Deshalb: reihum bis zu OVERPASS_VERSUCHE Versuche, nach einer Ablehnung kurz warten,
// höchstens zwei gleichzeitig (zweiter startet nach OVERPASS_VERSATZ ms ohne Antwort). Erster Treffer gewinnt, Rest wird abgebrochen.
function overpassVersetzt(daten) {
  const body = 'data=' + encodeURIComponent(daten);
  return new Promise((ja, nein) => {
    const laeufe = new Set(); let versuch = 0, fertig = false, letzter = new Error('Zeit');
    const ende = (fn, wert) => { if (fertig) return; fertig = true; laeufe.forEach((c) => c.abort()); timer.forEach(clearTimeout); fn(wert); };
    const starte = () => {
      if (fertig || versuch >= OVERPASS_VERSUCHE || laeufe.size >= 2) return;
      const ac = new AbortController(); laeufe.add(ac);
      const server = OVERPASS[versuch++ % OVERPASS.length];
      holeJson(server, { method: 'POST', body, signal: ac.signal, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }, OVERPASS_JE_SERVER)
        .then((text) => ende(ja, text), (e) => {
          letzter = e; laeufe.delete(ac);
          if (versuch >= OVERPASS_VERSUCHE) { if (!laeufe.size) ende(nein, letzter); return; }
          timer.push(setTimeout(starte, OVERPASS_PAUSE));
        });
    };
    const timer = [setTimeout(starte, OVERPASS_VERSATZ), setTimeout(() => ende(nein, letzter), OVERPASS_GESAMT)];
    starte();
  });
}
const zahl = (v, a, b) => { const n = Number(v); return Number.isFinite(n) && n >= a && n <= b; };

export default {
  async fetch(req, env, ctx) {
    const h = cors(req, env);
    if (req.method === 'OPTIONS') return new Response(null, { headers: (({ ok, ...k }) => k)(h) });
    if (!h.ok) return fehler(403, 'Herkunft nicht erlaubt', h);
    const url = new URL(req.url), p = url.searchParams;
    try {
      if (req.method === 'GET' && url.pathname === '/suche') {
        const q = (p.get('q') || '').trim().slice(0, 120);
        if (q.length < 3) return fehler(400, 'Zu kurz', h);
        const lat = zahl(p.get('lat'), -90, 90) ? (+p.get('lat')).toFixed(2) : '51.20', lon = zahl(p.get('lon'), -180, 180) ? (+p.get('lon')).toFixed(2) : '10.40';
        const ziel = 'https://photon.komoot.io/api/?q=' + encodeURIComponent(q) + '&lang=de&limit=6&lat=' + lat + '&lon=' + lon;
        const r = await gemerkt(ctx, 'suche/' + await hash(ziel), 7 * TAG, () => holeJson(ziel, {}, 8000));
        return antwort(r.text, 200, h, r.quelle, 3600);
      }
      if (req.method === 'GET' && url.pathname === '/adresse') {
        const q = (p.get('q') || '').trim().slice(0, 160);
        if (q.length < 3) return fehler(400, 'Zu kurz', h);
        const ziel = 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&accept-language=de&q=' + encodeURIComponent(q);
        const r = await gemerkt(ctx, 'adresse/' + await hash(q.toLowerCase()), 30 * TAG, () => holeJson(ziel, {}, 10000));
        return antwort(r.text, 200, h, r.quelle, 86400);
      }
      if (req.method === 'GET' && url.pathname === '/hoehe') {
        const la = (p.get('latitude') || '').split(','), lo = (p.get('longitude') || '').split(',');
        if (!la.length || la.length !== lo.length || la.length > 100 || !la.every((v) => zahl(v, -90, 90)) || !lo.every((v) => zahl(v, -180, 180))) return fehler(400, 'Punkte ungültig', h);
        const ziel = 'https://api.open-meteo.com/v1/elevation?latitude=' + la.join(',') + '&longitude=' + lo.join(',');
        const r = await gemerkt(ctx, 'hoehe/' + await hash(ziel), 365 * TAG, () => holeJson(ziel, {}, 10000));
        return antwort(r.text, 200, h, r.quelle, 86400);
      }
      if (req.method === 'POST' && url.pathname === '/overpass') {
        const form = await req.text(), daten = new URLSearchParams(form).get('data') || '';
        // nur Abfragen, wie der Planer sie baut: JSON, kleiner Umkreis, keine fremden Ausgaben
        const radien = [...daten.matchAll(/\(around:(\d+),/g)].map((m) => +m[1]);
        if (!daten.startsWith('[out:json]') || daten.length > 4000 || !radien.length || radien.some((r) => r > 5000)) return fehler(400, 'Abfrage passt nicht zum Planer', h);
        const r = await gemerkt(ctx, 'overpass/' + await hash(daten), 14 * TAG, async () => {
          return overpassVersetzt(daten);
        });
        return antwort(r.text, 200, h, r.quelle);
      }
      return fehler(404, 'Unbekannt', h);
    } catch (e) {
      return fehler(502, 'Kartendienst antwortet nicht', h);
    }
  },
};
