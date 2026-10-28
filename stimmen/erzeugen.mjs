// Erzeugt funkel-stimme.json mit ElevenLabs-Stimmen.
// Liest die Sätze direkt aus der verschlüsselten index.html (Zauberwort als Umgebungsvariable),
// verteilt sie nach stimmen/rollen.json auf die Figuren und erzeugt nur geänderte Sätze neu.
//
//   ZAUBERWORT=… ELEVENLABS_API_KEY=… node stimmen/erzeugen.mjs
//   ZAUBERWORT=… node stimmen/erzeugen.mjs --liste      (nur Sätze und Rollen zeigen, kostet nichts)

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash, webcrypto } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import vm from 'node:vm';

const WURZEL = new URL('..', import.meta.url).pathname;
const nurListe = process.argv.includes('--liste');
const zauberwort = process.env.ZAUBERWORT;
const apiKey = process.env.ELEVENLABS_API_KEY;
if (!zauberwort) fehler('ZAUBERWORT fehlt (GitHub: Settings → Secrets and variables → Actions).');
if (!nurListe && !apiKey) fehler('ELEVENLABS_API_KEY fehlt (GitHub: Settings → Secrets and variables → Actions).');

function fehler(t) { console.error('Fehler: ' + t); process.exit(1); }
const b = (s) => Buffer.from(s, 'base64');

// 1) App entschlüsseln
const huelle = readFileSync(WURZEL + 'index.html', 'utf8');
const zeile = huelle.split('\n').find((z) => z.includes('var D={'));
if (!zeile) fehler('Verschlüsselter Block in index.html nicht gefunden.');
const D = JSON.parse(zeile.slice(zeile.indexOf('{'), zeile.lastIndexOf('}') + 1));
const { subtle } = webcrypto;
const roh = await subtle.importKey('raw', new TextEncoder().encode(zauberwort), 'PBKDF2', false, ['deriveKey']);
const key = await subtle.deriveKey({ name: 'PBKDF2', salt: b(D.s), iterations: D.n, hash: 'SHA-256' }, roh, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
let app;
try { app = new TextDecoder().decode(await subtle.decrypt({ name: 'AES-GCM', iv: b(D.i) }, key, b(D.c))); }
catch { fehler('Das Zauberwort passt nicht zu index.html.'); }

// 2) Sätze genau so ermitteln wie die App selbst (STATIONS, T_…, texte())
function stueck(von, bis) {
  const a = app.indexOf(von), e = app.indexOf(bis, a);
  if (a < 0 || e < 0) fehler('Textstelle „' + von + '“ in der App nicht gefunden.');
  return app.slice(a, e);
}
const code = stueck('var STATIONS=[', '/* ---------- Varianten') + '\n' + stueck('var T_START=', 'var TEXTE=texte();') + '\nTEXTE=texte();'
  + (app.includes('/* ---------- Kakapups ----------') ? '\n' + stueck('/* ---------- Kakapups ----------', '/* ---------- Kakapups Ende') + '\nKAKATEXTE=kakaTexte();' : '');
const sandbox = { TEXTE: null, KAKATEXTE: [] };
vm.runInNewContext(code, sandbox, { timeout: 2000 });
const saetze = sandbox.TEXTE.concat(sandbox.KAKATEXTE || []).map((t) => ({ key: t.key, label: t.label, text: t.text }));

// 3) Rollen zuordnen
const rollen = JSON.parse(readFileSync(WURZEL + 'stimmen/rollen.json', 'utf8'));
function rolleFuer(k) {
  for (const [r, keys] of Object.entries(rollen.zuordnung || {})) if (keys.includes(k)) return r;
  for (const [p, r] of Object.entries(rollen.praefix || {})) if (k.startsWith(p)) return r;
  return rollen.standard;
}
for (const s of saetze) {
  s.rolle = rolleFuer(s.key);
  if (!rollen.figuren[s.rolle]) fehler('Rolle „' + s.rolle + '“ für ' + s.key + ' fehlt unter „figuren“.');
}

if (nurListe) {
  for (const s of saetze) console.log(`${s.key.padEnd(18)} ${s.rolle.padEnd(10)} ${s.text}`);
  for (const [k, g] of Object.entries(rollen.geraeusche || {})) console.log(`${k.padEnd(18)} ${'geräusch'.padEnd(10)} ${g.text}`);
  console.log(`\n${saetze.length} Sätze, ${Object.keys(rollen.geraeusche || {}).length} Geräusche.`);
  process.exit(0);
}

// 4) Erzeugen – nur, was sich an Text oder Stimme geändert hat
const ziel = WURZEL + 'funkel-stimme.json';
const alt = existsSync(ziel) ? JSON.parse(readFileSync(ziel, 'utf8')) : { clips: {} };
const MODELL = rollen.modell || 'eleven_multilingual_v2';
const FORMAT = 'mp3_44100_64';
const aus = { version: 2, rate: 1, clips: {} };
const VORLAUF = 250;   // ms Stille vor jedem Satz, sonst verschluckt das iPad (v. a. mit Bluetooth) die erste Silbe

function mitVorlauf(mp3) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', 'pipe:0', '-af', `adelay=${VORLAUF}:all=1`, '-c:a', 'libmp3lame', '-b:a', '64k', '-ar', '44100', '-f', 'mp3', 'pipe:1'], { input: mp3, maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0 || !r.stdout || r.stdout.length < 1000) { fehler('ffmpeg fehlt oder scheitert, kein Vorlauf möglich: ' + String(r.error || r.stderr || '').slice(0, 300)); }
  return r.stdout;
}
let neu = 0, behalten = 0;

for (const s of saetze) {
  const f = rollen.figuren[s.rolle];
  const fassung = createHash('sha256').update(JSON.stringify([s.text, f.voice_id, f.einstellungen || {}, MODELL, FORMAT])).digest('hex').slice(0, 16);
  const vorher = alt.clips && alt.clips[s.key];
  if (vorher && vorher.h === fassung) {
    if (vorher.vorlauf !== VORLAUF) {          // ältere Fassung ohne Vorlauf: nachrüsten, kostet keine Credits
      const p = mitVorlauf(b(vorher.b64));
      if (p) { vorher.b64 = p.toString('base64'); vorher.vorlauf = VORLAUF; vorher.h = fassung; }
    }
    aus.clips[s.key] = vorher; behalten++; continue;
  }

  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${f.voice_id}?output_format=${FORMAT}`, {
    method: 'POST',
    headers: { 'xi-api-key': apiKey, 'content-type': 'application/json', accept: 'audio/mpeg' },
    body: JSON.stringify({ text: s.text, model_id: MODELL, voice_settings: f.einstellungen || undefined }),
  });
  if (!r.ok) fehler(`ElevenLabs lehnt ${s.key} (${s.rolle}) ab: HTTP ${r.status} ${(await r.text()).slice(0, 300)}`);
  let mp3 = Buffer.from(await r.arrayBuffer());
  const gepolstert = mitVorlauf(mp3);
  if (gepolstert) mp3 = gepolstert;
  aus.clips[s.key] = { type: 'audio/mpeg', b64: mp3.toString('base64'), rate: f.tempo || 1, h: fassung, rolle: s.rolle, vorlauf: gepolstert ? VORLAUF : 0 };
  neu++;
  console.log(`neu: ${s.key} (${s.rolle}, ${Math.round(mp3.length / 1024)} KB)`);
}

// 5) Geräusche (z. B. Kakapups' Pupse) über ElevenLabs Sound Effects
for (const [k, g] of Object.entries(rollen.geraeusche || {})) {
  const fassung = createHash('sha256').update(JSON.stringify(['geraeusch', g.text, g.dauer, FORMAT])).digest('hex').slice(0, 16);
  const vorher = alt.clips && alt.clips[k];
  if (vorher && vorher.h === fassung) { aus.clips[k] = vorher; behalten++; continue; }
  const r = await fetch(`https://api.elevenlabs.io/v1/sound-generation?output_format=${FORMAT}`, {
    method: 'POST',
    headers: { 'xi-api-key': apiKey, 'content-type': 'application/json', accept: 'audio/mpeg' },
    body: JSON.stringify({ text: g.text, duration_seconds: g.dauer, prompt_influence: 0.6 }),
  });
  if (!r.ok) fehler(`ElevenLabs lehnt Geräusch ${k} ab: HTTP ${r.status} ${(await r.text()).slice(0, 300)}`);
  const mp3 = Buffer.from(await r.arrayBuffer());
  aus.clips[k] = { type: 'audio/mpeg', b64: mp3.toString('base64'), rate: 1, h: fassung, rolle: 'geraeusch', vorlauf: VORLAUF };
  neu++;
  console.log(`neu: ${k} (Geräusch, ${Math.round(mp3.length / 1024)} KB)`);
}

writeFileSync(ziel, JSON.stringify(aus));
console.log(`\nFertig: ${neu} neu erzeugt, ${behalten} unverändert, ${saetze.length} Sätze insgesamt.`);
