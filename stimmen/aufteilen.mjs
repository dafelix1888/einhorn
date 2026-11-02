// Teilt funkel-stimme.json in kleine Pakete für die generische App (app/):
//   stimmen/pakete/einhorn-basis.json     Geschichte (Funkel, Spiegel) und Geräusche
//   stimmen/pakete/einhorn-<figur>.json   je Erzähler (Kakapups, Rudi, …)
//   stimmen/pakete/einhorn-index.json     welche Sätze (mit Fassung) in welchem Paket stecken: Spiel und Bereit-Check laden nur, was fehlt
// So lädt ein Gerät nur, was es braucht, statt aller 33 MB.
//   node stimmen/aufteilen.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const WURZEL = new URL('..', import.meta.url).pathname;
const alle = JSON.parse(readFileSync(WURZEL + 'funkel-stimme.json', 'utf8'));
const pakete = {};
for (const [k, c] of Object.entries(alle.clips || {})) {
  const p = k.startsWith('k.') ? 'kakapups' : k.startsWith('e.') ? k.split('.')[1] : 'basis';
  (pakete[p] ||= { version: alle.version, rate: alle.rate, clips: {} }).clips[k] = c;
}
mkdirSync(WURZEL + 'stimmen/pakete', { recursive: true });
const index = {};
for (const [p, inhalt] of Object.entries(pakete)) {
  writeFileSync(WURZEL + `stimmen/pakete/einhorn-${p}.json`, JSON.stringify(inhalt));
  index[p] = Object.fromEntries(Object.keys(inhalt.clips).sort().map((k) => [k, inhalt.clips[k].h || '']));
  console.log(`${p}: ${Object.keys(index[p]).length} Sätze, ${(JSON.stringify(inhalt).length / 1e6).toFixed(1)} MB`);
}
writeFileSync(WURZEL + 'stimmen/pakete/einhorn-index.json', JSON.stringify(index, null, 1) + '\n');
