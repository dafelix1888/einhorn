// Erzähler-Figuren (UNICORN-59): Die bewegten Figuren aus dem Spiel (#kaka in app/spiel.html) liegen als Kopie
// beim Thema (app/themen/einhorn/erzaehler/figuren.html), damit die Party sie bei der Hörprobe zeigen kann.
// Dieser Test prüft, dass die Kopie gleich bleibt. Neu schreiben: node tests/erzaehler-figuren.test.cjs --schreiben
const fs = require('fs'), path = require('path');
const W = path.join(__dirname, '..');
const spiel = fs.readFileSync(path.join(W, 'app/spiel.html'), 'utf8');
const ZIEL = path.join(W, 'app/themen/einhorn/erzaehler/figuren.html');
let f = 0; const ok = (c, t) => { console.log((c ? 'ok   ' : 'FEHLER ') + t); if (!c) f++; };

function ausSpiel() {
  const a = spiel.indexOf('<div class="kaka" id="kaka"');
  if (a < 0) return null;
  const start = spiel.indexOf('>', a) + 1;
  const letzte = spiel.indexOf('</svg>', spiel.indexOf('data-figur="', spiel.lastIndexOf('<svg viewBox="0 0 240 300" class="kk"'))) + 6;
  return spiel.slice(start, letzte).replace(/^\s+/, '').replace(/\s+$/, '') + '\n';
}
const kopf = '<!-- Erzähler-Figuren, Kopie aus app/spiel.html (#kaka). Nicht von Hand ändern: node tests/erzaehler-figuren.test.cjs --schreiben -->\n';
const soll = ausSpiel();
ok(!!soll && (soll.match(/data-figur="/g) || []).length === 6, 'Spiel hat sechs Figuren');
if (process.argv.includes('--schreiben')) { fs.writeFileSync(ZIEL, kopf + soll); console.log('geschrieben: ' + path.relative(W, ZIEL)); }
const ist = fs.existsSync(ZIEL) ? fs.readFileSync(ZIEL, 'utf8') : '';
ok(ist === kopf + soll, 'Kopie beim Thema ist gleich wie im Spiel');
const tour = JSON.parse(fs.readFileSync(path.join(W, 'app/themen/einhorn/tour.json'), 'utf8'));
for (const fig of tour.erzaehler.reihe) {
  const m = ist.match(new RegExp('<svg[^>]*data-figur="' + fig + '"[\\s\\S]*?</svg>'));
  ok(!!m && /kk-mund-innen/.test(m[0]) && /kk-auge/.test(m[0]), fig + ': Figur mit Mund und Augen');
}
console.log(f ? f + ' FEHLER' : 'ALLES OK'); process.exit(f ? 1 : 0);
