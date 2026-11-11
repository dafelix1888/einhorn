// Cloudflare Worker „Karte“: Zwischenstation für die freien Kartendienste des Planers.
// - meldet sich mit eigenem Namen (User-Agent) an, wie es Nominatim und Overpass verlangen
// - merkt sich Antworten im Cloudflare-Cache, damit dieselbe Gegend nicht zweimal abgefragt wird
// - fragt Overpass hartnäckig: reihum bis zu 8 Versuche, nach Ablehnung kurz warten, höchstens zwei gleichzeitig; erster Treffer gewinnt
// - nimmt nur Anfragen von der App an (Herkunft) und nur Abfragen, wie der Planer sie stellt
// - Ausweichquellen für Wege und Orte (UNICORN-34): Antwortet Overpass nach 5 s nicht, fragt er parallel Postpass (Geofabrik);
//   die erste brauchbare Antwort gewinnt. Klappt beides nicht, kommen Vektorkacheln von OpenFreeMap (weniger Details).
//   Postpass und OpenFreeMap werden ins Overpass-Format übersetzt, der Planer merkt davon nichts. Kopfzeile X-Quelle sagt, woher.
//
//   GET  /suche?q=…&lat=…&lon=…      Vorschläge beim Tippen (Photon)
//   GET  /adresse?q=…                 Adresse → Koordinaten (Nominatim)
//   GET  /hoehe?latitude=…&longitude=…  Höhen (Open-Meteo), bis 100 Punkte
//   POST /overpass   body: data=…      Wege und Orte (Overpass, ersatzweise Postpass, dann OpenFreeMap); ?nur=… erzwingt eine Quelle

const AGENT = 'Schatzweg/1.0 (+https://schatzweg.de)';
const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
const OVERPASS_VERSATZ = 8000, OVERPASS_JE_SERVER = 60000, OVERPASS_GESAMT = 85000, OVERPASS_VERSUCHE = 8, OVERPASS_PAUSE = 1500;   // Gesamt unter dem Zeitlimit des Planers (95 s)
const POSTPASS = 'https://postpass.geofabrik.de/api/0.2/interpreter', POSTPASS_NACH = 5000, POSTPASS_ZEIT = 40000;
const OFM = 'https://tiles.openfreemap.org/planet', OFM_SPAETESTENS = 45000, OFM_ZEIT = 25000, OFM_Z = 14;
const GESAMT = 85000;   // unter dem Zeitlimit des Planers (95 s)
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
function antwort(text, status, h, quelle, alter, herkunft) {
  const { ok, ...kopf } = h;
  return new Response(text, { status, headers: { ...kopf, 'Content-Type': 'application/json; charset=utf-8', 'X-Karte': quelle, ...(herkunft ? { 'X-Quelle': herkunft, 'Access-Control-Expose-Headers': 'X-Karte, X-Quelle' } : {}), ...(alter ? { 'Cache-Control': 'public, max-age=' + alter } : {}) } });
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
    const zeit = +alt.headers.get('X-Gemerkt') || 0, kurz = +alt.headers.get('X-Frisch') || frisch;
    if (Date.now() - zeit < Math.min(frisch, kurz) * 1000) return { text: await alt.text(), quelle: 'cache', herkunft: alt.headers.get('X-Quelle') || '' };
  }
  try {
    const r = await holen(), text = typeof r === 'string' ? r : r.text, herkunft = (r && r.quelle) || '';
    const kopf = { 'Cache-Control': 'public, max-age=' + 30 * TAG, 'X-Gemerkt': String(Date.now()), 'X-Quelle': herkunft };
    if (r && r.frisch) kopf['X-Frisch'] = String(r.frisch);
    ctx.waitUntil(cache.put(key, new Response(text, { headers: kopf })));
    return { text, quelle: 'dienst', herkunft };
  } catch (e) {
    if (alt) return { text: await alt.text(), quelle: 'cache-alt', herkunft: alt.headers.get('X-Quelle') || '' };
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
function overpassVersetzt(daten, abbruch, beiAblehnung) {
  const body = 'data=' + encodeURIComponent(daten);
  return new Promise((ja, nein) => {
    if (abbruch) abbruch.addEventListener('abort', () => ende(nein, new Error('abgebrochen')));
    const laeufe = new Set(); let versuch = 0, fertig = false, letzter = new Error('Zeit');
    const ende = (fn, wert) => { if (fertig) return; fertig = true; laeufe.forEach((c) => c.abort()); timer.forEach(clearTimeout); fn(wert); };
    const starte = () => {
      if (fertig || versuch >= OVERPASS_VERSUCHE || laeufe.size >= 2) return;
      const ac = new AbortController(); laeufe.add(ac);
      const server = OVERPASS[versuch++ % OVERPASS.length];
      holeJson(server, { method: 'POST', body, signal: ac.signal, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }, OVERPASS_JE_SERVER)
        .then((text) => ende(ja, text), (e) => {
          letzter = e; laeufe.delete(ac); if (beiAblehnung) beiAblehnung();
          if (versuch >= OVERPASS_VERSUCHE) { if (!laeufe.size) ende(nein, letzter); return; }
          timer.push(setTimeout(starte, OVERPASS_PAUSE));
        });
    };
    const timer = [setTimeout(starte, OVERPASS_VERSATZ), setTimeout(() => ende(nein, letzter), OVERPASS_GESAMT)];
    starte();
  });
}
// ---------- Prio 2: Postpass (Geofabrik), dieselben Filter wie die Overpass-Abfrage des Planers ----------
const HW = ['footway', 'path', 'pedestrian', 'track', 'steps', 'bridleway', 'cycleway', 'living_street', 'residential', 'service', 'unclassified', 'tertiary', 'tertiary_link', 'secondary', 'secondary_link', 'primary', 'primary_link'];
const liste = (a) => a.map((s) => "'" + s + "'").join(',');
function postpassSql(m) {
  const p = 'ST_SetSRID(ST_MakePoint(' + m.lng.toFixed(6) + ',' + m.lat.toFixed(6) + '),4326)', r = m.radius;
  const box = 'geom && ST_Expand(' + p + ',' + (r / 111320 / Math.max(0.2, Math.cos(m.lat * Math.PI / 180))).toFixed(6) + ')';
  const nah = box + ' AND ST_DWithin(geom::geography,' + p + '::geography,' + r + ')';
  return [
    "SELECT 'w' AS k, osm_id, tags, geom FROM postpass_line WHERE tags->>'highway' IN (" + liste(HW) + ") AND " + nah +
      " AND coalesce(tags->>'access','') NOT IN ('private','no') AND coalesce(tags->>'foot','') NOT IN ('no','private')" +
      " AND coalesce(tags->>'service','') NOT IN ('parking_aisle','driveway','drive-through')",
    "SELECT 'n', osm_id, tags, geom FROM postpass_point WHERE (tags->>'highway' IN ('crossing','traffic_signals') OR tags->>'amenity'='bench' OR tags->>'leisure'='playground' OR tags->>'natural'='peak' OR tags->>'tourism'='viewpoint') AND " + nah,
    "SELECT 'z', osm_id, tags, geom FROM postpass_line WHERE tags->>'barrier' IN ('fence','hedge','wall') AND " + nah,
    "SELECT 'f', osm_id, tags, ST_PointOnSurface(geom) FROM postpass_polygon WHERE (tags->>'leisure' IN ('park','playground') OR tags->>'natural'='wood' OR tags->>'landuse' IN ('forest','meadow','grass','recreation_ground')) AND " + nah,
    "(SELECT 't', osm_id, '{}'::jsonb, geom FROM postpass_point WHERE tags->>'natural'='tree' AND " + nah + " LIMIT 3000)",
  ].join(' UNION ALL ');
}
// Knoten-IDs aus Koordinaten: gemeinsame Punkte von Wegen haben dieselben Koordinaten, also dieselbe ID
function knotenIds() { const m = new Map(); return (key) => { let v = m.get(key); if (v === undefined) { v = -(m.size + 1); m.set(key, v); } return v; }; }
function ausPostpass(text) {
  const fc = JSON.parse(text);
  if (!fc || !Array.isArray(fc.features)) throw new Error('Postpass: keine Features');
  const id = knotenIds(), el = [], kid = (c) => id(Math.round(c[1] * 1e7) + ',' + Math.round(c[0] * 1e7));
  const linien = (g) => (g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : []);
  for (const f of fc.features) {
    const q = f.properties || {}, g = f.geometry || {}, tags = typeof q.tags === 'string' ? JSON.parse(q.tags) : (q.tags || {});
    if (q.k === 'w' || q.k === 'z') {
      for (const l of linien(g)) if (l.length > 1) el.push({ type: 'way', id: q.osm_id, tags, nodes: l.map(kid), geometry: l.map((c) => ({ lat: c[1], lon: c[0] })) });
    } else if ((q.k === 'n' || q.k === 't') && g.type === 'Point') {
      el.push({ type: 'node', id: kid(g.coordinates), lat: g.coordinates[1], lon: g.coordinates[0], tags });
    } else if (q.k === 'f' && g.type === 'Point') {
      el.push({ type: 'way', id: q.osm_id, tags, center: { lat: g.coordinates[1], lon: g.coordinates[0] } });
    }
  }
  return JSON.stringify({ version: 0.6, generator: 'Schatzweg aus Postpass', elements: el });
}
async function postpass(m, signal) {
  const text = await holeJson(POSTPASS, { method: 'POST', body: 'data=' + encodeURIComponent(postpassSql(m)), signal, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }, POSTPASS_ZEIT);
  return ausPostpass(text);
}

// ---------- Prio 3: OpenFreeMap, Vektorkacheln (OpenMapTiles) dekodieren ----------
function pbf(buf) {
  let i = 0;
  const varint = () => { let r = 0, s = 1, b; do { b = buf[i++]; r += (b & 0x7f) * s; s *= 128; } while (b & 0x80); return r; };
  const felder = (ende) => { const a = []; while (i < ende) { const k = varint(), nr = Math.floor(k / 8), typ = k & 7; let wert;
    if (typ === 0) wert = varint(); else if (typ === 2) { const n = varint(); wert = buf.subarray(i, i + n); i += n; }
    else if (typ === 1) { wert = new DataView(buf.buffer, buf.byteOffset + i, 8).getFloat64(0, true); i += 8; }
    else if (typ === 5) { wert = new DataView(buf.buffer, buf.byteOffset + i, 4).getFloat32(0, true); i += 4; }
    else throw new Error('pbf'); a.push([nr, wert, typ]); } return a; };
  return felder(buf.length);
}
const unterpbf = (b) => pbf(b), zz = (n) => (n % 2 ? -(n + 1) / 2 : n / 2);
const packed = (b) => { const out = []; let i = 0; while (i < b.length) { let r = 0, s = 1, x; do { x = b[i++]; r += (x & 0x7f) * s; s *= 128; } while (x & 0x80); out.push(r); } return out; };
const text8 = (b) => new TextDecoder().decode(b);
function kachelLesen(buf, tx, ty, z) {
  const ebenen = {};
  for (const [nr, lb] of pbf(buf)) {
    if (nr !== 3) continue;
    let name = '', ausdehnung = 4096; const keys = [], werte = [], roh = [];
    for (const [n, w] of unterpbf(lb)) {
      if (n === 1) name = text8(w); else if (n === 3) keys.push(text8(w)); else if (n === 5) ausdehnung = w;
      else if (n === 4) { let v = null; for (const [vn, vw, vt] of unterpbf(w)) v = vn === 1 ? text8(vw) : vt === 0 && vn === 6 ? zz(vw) : vw; werte.push(v); }
      else if (n === 2) roh.push(w);
    }
    if (!['transportation', 'transportation_name', 'poi', 'park', 'landcover'].includes(name)) continue;
    ebenen[name] = roh.map((fb) => {
      let typ = 0, tags = [], geo = [];
      for (const [n, w] of unterpbf(fb)) { if (n === 2) tags = packed(w); else if (n === 3) typ = w; else if (n === 4) geo = packed(w); }
      const p = {}; for (let j = 0; j + 1 < tags.length; j += 2) p[keys[tags[j]]] = werte[tags[j + 1]];
      // Geometrie: Befehle MoveTo/LineTo/ClosePath, globale Raster-Koordinaten (für gemeinsame Knoten über Kachelgrenzen)
      const teile = []; let x = 0, y = 0, akt = null;
      for (let j = 0; j < geo.length;) { const c = geo[j++], cmd = c & 7, anz = c >> 3;
        if (cmd === 7) { if (akt && akt.length) akt.push(akt[0]); continue; }
        for (let k = 0; k < anz; k++) { x += zz(geo[j++]); y += zz(geo[j++]); if (cmd === 1) { akt = []; teile.push(akt); } akt.push([tx * ausdehnung + x, ty * ausdehnung + y]); } }
      return { typ, p, teile, ausdehnung, z };
    });
  }
  return ebenen;
}
const zuGrad = (gx, gy, a, z) => { const n = Math.pow(2, z) * a; return { lon: gx / n * 360 - 180, lat: Math.atan(Math.sinh(Math.PI * (1 - 2 * gy / n))) * 180 / Math.PI }; };
function kachelNr(lat, lng, z) { const n = Math.pow(2, z), r = lat * Math.PI / 180; return { x: Math.floor((lng + 180) / 360 * n), y: Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * n) }; }
const OMT_WEG = { minor: 'residential', service: 'service', track: 'track', tertiary: 'tertiary', secondary: 'secondary', primary: 'primary' };
const OMT_PFAD = /^(footway|path|pedestrian|steps|bridleway|cycleway)$/;
async function openfreemap(m, signal) {
  const tj = JSON.parse(await holeJson(OFM, { signal }, 8000)), vorlage = tj.tiles && tj.tiles[0];
  if (!vorlage) throw new Error('OpenFreeMap: keine Kacheln');
  const dlat = m.radius / 111320, dlng = dlat / Math.max(0.2, Math.cos(m.lat * Math.PI / 180));
  const a = kachelNr(m.lat + dlat, m.lng - dlng, OFM_Z), b = kachelNr(m.lat - dlat, m.lng + dlng, OFM_Z), kacheln = [];
  for (let x = a.x; x <= b.x; x++) for (let y = a.y; y <= b.y; y++) kacheln.push({ x, y });
  if (kacheln.length > 16) throw new Error('OpenFreeMap: zu viele Kacheln');
  const bufs = await Promise.all(kacheln.map(async (k) => {
    const r = await mitZeit(fetch(vorlage.replace('{z}', OFM_Z).replace('{x}', k.x).replace('{y}', k.y), { signal, headers: { 'User-Agent': AGENT } }), OFM_ZEIT);
    if (r.status === 204 || r.status === 404) return null;
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return { k, buf: new Uint8Array(await r.arrayBuffer()) };
  }));
  const id = knotenIds(), el = [], cosl = Math.cos(m.lat * Math.PI / 180);
  const nah = (g) => { const dy = (g.lat - m.lat) * 111320, dx = (g.lon - m.lng) * 111320 * cosl; return dx * dx + dy * dy <= (m.radius + 30) * (m.radius + 30); };
  let wegId = 0;
  for (const t of bufs) {
    if (!t) continue;
    const e = kachelLesen(t.buf, t.k.x, t.k.y, OFM_Z);
    (e.transportation || []).forEach((f) => {
      if (f.typ !== 2) return;
      const p = f.p, hw = p.class === 'path' ? (OMT_PFAD.test(p.subclass) ? p.subclass : 'path') : OMT_WEG[p.class];
      if (!hw || p.brunnel === 'tunnel' || p.access === 'no' || /^(parking_aisle|driveway|drive-through)$/.test(p.service || '')) return;
      f.teile.forEach((l) => {
        const g = l.map((c) => zuGrad(c[0], c[1], f.ausdehnung, OFM_Z));
        if (l.length < 2 || !g.some(nah)) return;
        el.push({ type: 'way', id: ++wegId, tags: { highway: hw, ...(p.name ? { name: p.name } : {}) }, nodes: l.map((c) => id(c[0] + ',' + c[1])), geometry: g.map((q) => ({ lat: q.lat, lon: q.lon })) });
      });
    });
    (e.poi || []).forEach((f) => {
      if (f.typ !== 1 || !f.teile[0]) return;
      const art = f.p.subclass || f.p.class; if (art !== 'playground') return;
      const g = zuGrad(f.teile[0][0][0], f.teile[0][0][1], f.ausdehnung, OFM_Z);
      if (nah(g)) el.push({ type: 'node', id: id('p' + f.teile[0][0].join(',')), lat: g.lat, lon: g.lon, tags: { leisure: 'playground', ...(f.p.name ? { name: f.p.name } : {}) } });
    });
    [['park', (p) => (p.class === 'park' || p.class === 'nature_reserve' ? 'park' : null)], ['landcover', (p) => (p.class === 'wood' ? 'wood' : p.class === 'grass' ? 'grass' : null)]].forEach(([ebene, art]) => {
      (e[ebene] || []).forEach((f) => {
        const a2 = art(f.p); if (f.typ !== 3 || !a2 || !f.teile[0] || !f.teile[0].length) return;
        const r = f.teile[0]; let sx = 0, sy = 0; r.forEach((c) => { sx += c[0]; sy += c[1]; });
        const g = zuGrad(sx / r.length, sy / r.length, f.ausdehnung, OFM_Z);
        if (nah(g)) el.push({ type: 'way', id: ++wegId, tags: a2 === 'park' ? { leisure: 'park', ...(f.p.name ? { name: f.p.name } : {}) } : a2 === 'wood' ? { natural: 'wood' } : { landuse: 'grass' }, center: g });
      });
    });
  }
  if (!el.some((x) => x.nodes)) throw new Error('OpenFreeMap: keine Wege');
  return JSON.stringify({ version: 0.6, generator: 'Schatzweg aus OpenFreeMap', elements: el });
}

// ---------- Reihenfolge: Overpass zuerst, nach 5 s parallel Postpass, erst wenn beides scheitert OpenFreeMap ----------
function wegeUndOrte(daten, m, nur) {
  return new Promise((ja, nein) => {
    const ac = new AbortController(), timer = []; let fertig = false, laufen = 0, letzter = new Error('Zeit'); const gestartet = {};
    const ende = (fn, wert) => { if (fertig) return; fertig = true; timer.forEach(clearTimeout); ac.abort(); fn(wert); };
    const starte = (name) => {
      if (fertig || gestartet[name] || (nur && nur !== name)) return;
      gestartet[name] = true; laufen++;
      const p = name === 'overpass' ? overpassVersetzt(daten, ac.signal, () => starte('postpass')) : name === 'postpass' ? postpass(m, ac.signal) : openfreemap(m, ac.signal);
      p.then((text) => ende(ja, { text, quelle: name, ...(name === 'openfreemap' ? { frisch: TAG } : {}) }), (e) => {
        letzter = e; laufen--;
        if (name === 'overpass') starte('postpass');          // Overpass schon gescheitert: nicht auf die 5 s warten
        if (name === 'postpass') starte('openfreemap');
        if (!laufen && (gestartet.openfreemap || nur)) ende(nein, letzter);
        else if (!laufen && !gestartet.postpass) starte('postpass');
      });
    };
    starte(nur || 'overpass');
    // lehnt ein Overpass-Server sofort ab (502/504), fragt er Postpass gleich dazu statt nach 5 s
    timer.push(setTimeout(() => starte('postpass'), POSTPASS_NACH), setTimeout(() => starte('openfreemap'), OFM_SPAETESTENS), setTimeout(() => ende(nein, letzter), GESAMT));
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
        const um = daten.match(/\(around:(\d+),(-?[\d.]+),(-?[\d.]+)\)/), mitte = um && { radius: +um[1], lat: +um[2], lng: +um[3] };
        if (!mitte || !zahl(mitte.lat, -85, 85) || !zahl(mitte.lng, -180, 180)) return fehler(400, 'Abfrage passt nicht zum Planer', h);
        const nur = ['overpass', 'postpass', 'openfreemap'].includes(p.get('nur')) ? p.get('nur') : '';   // zum Prüfen einer Quelle
        const r = await gemerkt(ctx, 'overpass/' + (nur ? nur + '/' : '') + await hash(daten), 14 * TAG, () => wegeUndOrte(daten, mitte, nur));
        return antwort(r.text, 200, h, r.quelle, 0, r.herkunft || 'unbekannt');
      }
      return fehler(404, 'Unbekannt', h);
    } catch (e) {
      return fehler(502, 'Kartendienst antwortet nicht', h);
    }
  },
};
