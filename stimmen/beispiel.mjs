// Hörprobe für „Funkel kennt …“ (UNICORN-54): Funkel sagt die drei Namens-Sätze einmal mit einem Beispielnamen.
// Eltern hören damit vor dem Einsprechen, wie es klingt. Erzeugt nur, wenn Text oder Stimme sich geändert haben
// (Fassung steht in namen-beispiel.json), sonst kostet der Lauf nichts.
//
//   ELEVENLABS_API_KEY=… node stimmen/beispiel.mjs
//   node stimmen/beispiel.mjs --neu     (nur zeigen, ob neu erzeugt würde)

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';

const WURZEL = new URL('..', import.meta.url).pathname;
const NAME = 'Emma';                       // muss zu BEISPIEL in app/namen.js passen
const ZIEL = WURZEL + 'app/themen/einhorn/namen-beispiel.mp3';
const STAND = WURZEL + 'app/themen/einhorn/namen-beispiel.json';

const TOUR = JSON.parse(readFileSync(WURZEL + 'app/themen/einhorn/tour.json', 'utf8'));
const rollen = JSON.parse(readFileSync(WURZEL + 'stimmen/rollen.json', 'utf8'));
const f = rollen.figuren.funkel;
const ns = TOUR.namenSaetze;
const satz = (id) => ns.stellen.find((s) => s.id === id).varianten[0].split('{name}').join(NAME);
// Begrüßung, Geburtstagsgruß mit Alter, Abschied: so wie in der Tour, nur kürzer hintereinander
const text = [satz('gruss'), satz('schatz'), ns.alter.varianten[0].split('{alter}').join('fünf Jahre'), satz('abschied')].join(' ');
const fassung = createHash('sha256').update(JSON.stringify([text, f.voice_id, f.einstellungen, rollen.modell])).digest('hex').slice(0, 16);

const alt = existsSync(STAND) ? JSON.parse(readFileSync(STAND, 'utf8')) : {};
if (alt.fassung === fassung && existsSync(ZIEL)) { console.log('Hörprobe aktuell, nichts zu tun.'); process.exit(0); }
console.log(`Hörprobe neu (${text.length} Zeichen): ${text}`);
if (process.argv.includes('--neu')) process.exit(0);

const apiKey = process.env.ELEVENLABS_API_KEY;
if (!apiKey) { console.error('ELEVENLABS_API_KEY fehlt.'); process.exit(1); }
const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${f.voice_id}?output_format=mp3_44100_128`, {
  method: 'POST',
  headers: { 'xi-api-key': apiKey, 'content-type': 'application/json', accept: 'audio/mpeg' },
  body: JSON.stringify({ text, model_id: rollen.modell, voice_settings: f.einstellungen || undefined }),
});
if (!r.ok) { console.error(`ElevenLabs lehnt ab: HTTP ${r.status} ${(await r.text()).slice(0, 300)}`); process.exit(1); }
writeFileSync(ZIEL, Buffer.from(await r.arrayBuffer()));
writeFileSync(STAND, JSON.stringify({ fassung, name: NAME, text }, null, 1) + '\n');
console.log('Hörprobe erzeugt: app/themen/einhorn/namen-beispiel.mp3');
