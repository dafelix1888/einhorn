// Erzeugt funkel-stimme.json mit ElevenLabs-Stimmen.
// Liest die Sätze direkt aus der verschlüsselten index.html (Zauberwort als Umgebungsvariable),
// verteilt sie nach stimmen/rollen.json auf die Figuren und erzeugt nur geänderte Sätze neu.
//
//   ZAUBERWORT=… ELEVENLABS_API_KEY=… node stimmen/erzeugen.mjs
//   ZAUBERWORT=… node stimmen/erzeugen.mjs --liste      (nur Sätze und Rollen zeigen, kostet nichts)

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash, webcrypto } from 'node:crypto';
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
const code = stueck('var STATIONS=[', '/* ---------- Varianten') + '\n' + stueck('var T_START=', 'var TEXTE=texte();') + '\nTEXTE=texte();';
const sandbox = { TEXTE: null };
vm.runInNewContext(code, sandbox, { timeout: 2000 });
const saetze = sandbox.TEXTE.map((t) => ({ key: t.key, label: t.label, text: t.text }));

// 3) Rollen zuordnen
const rollen = JSON.parse(readFileSync(WURZEL + 'stimmen/rollen.json', 'utf8'));
function rolleFuer(k) {
  for (const [r, keys] of Object.entries(rollen.zuordnung || {})) if (keys.includes(k)) return r;
  return rollen.standard;
}
for (const s of saetze) {
  s.rolle = rolleFuer(s.key);
  if (!rollen.figuren[s.rolle]) fehler('Rolle „' + s.rolle + '“ für ' + s.key + ' fehlt unter „figuren“.');
}

if (nurListe) {
  for (const s of saetze) console.log(`${s.key.padEnd(18)} ${s.rolle.padEnd(10)} ${s.text}`);
  console.log(`\n${saetze.length} Sätze.`);
  process.exit(0);
}

// 4) Erzeugen – nur, was sich an Text oder Stimme geändert hat
const ziel = WURZEL + 'funkel-stimme.json';
const alt = existsSync(ziel) ? JSON.parse(readFileSync(ziel, 'utf8')) : { clips: {} };
const MODELL = rollen.modell || 'eleven_multilingual_v2';
const FORMAT = 'mp3_44100_64';
const aus = { version: 2, rate: 1, clips: {} };
let neu = 0, behalten = 0;

for (const s of saetze) {
  const f = rollen.figuren[s.rolle];
  const fassung = createHash('sha256').update(JSON.stringify([s.text, f.voice_id, f.einstellungen || {}, MODELL, FORMAT])).digest('hex').slice(0, 16);
  const vorher = alt.clips && alt.clips[s.key];
  if (vorher && vorher.h === fassung) { aus.clips[s.key] = vorher; behalten++; continue; }

  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${f.voice_id}?output_format=${FORMAT}`, {
    method: 'POST',
    headers: { 'xi-api-key': apiKey, 'content-type': 'application/json', accept: 'audio/mpeg' },
    body: JSON.stringify({ text: s.text, model_id: MODELL, voice_settings: f.einstellungen || undefined }),
  });
  if (!r.ok) fehler(`ElevenLabs lehnt ${s.key} (${s.rolle}) ab: HTTP ${r.status} ${(await r.text()).slice(0, 300)}`);
  const mp3 = Buffer.from(await r.arrayBuffer());
  aus.clips[s.key] = { type: 'audio/mpeg', b64: mp3.toString('base64'), rate: f.tempo || 1, h: fassung, rolle: s.rolle };
  neu++;
  console.log(`neu: ${s.key} (${s.rolle}, ${Math.round(mp3.length / 1024)} KB)`);
}

writeFileSync(ziel, JSON.stringify(aus));
console.log(`\nFertig: ${neu} neu erzeugt, ${behalten} unverändert, ${saetze.length} Sätze insgesamt.`);
