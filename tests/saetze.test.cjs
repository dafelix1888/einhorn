// Gesprochene Sätze (UNICORN-48): ortsneutral, Generator liest aus tour.json
const { execFileSync } = require('child_process');
const path = require('path');
let fehler = 0; const ok = (b, t) => { console.log((b ? 'ok   ' : 'FEHL ') + t); if (!b) fehler++; };
const wurzel = path.join(__dirname, '..');
const liste = execFileSync('node', ['stimmen/erzeugen.mjs', '--liste'], { cwd: wurzel, encoding: 'utf8' });
const zeilen = liste.split('\n').filter((z) => /^\S+\s+\S+\s+/.test(z) && !/Sätze,/.test(z));
ok(zeilen.length > 100, 'Generator liest die Sätze ohne Zauberwort aus tour.json (' + zeilen.length + ' Zeilen)');
// Feste Orte, die es nicht überall gibt. Erlaubt bleiben Dinge, die Eltern selbst hinlegen (Schleife, Laken, Kreidekreis, Kissenberg).
const verboten = /\b(Zaun|Zauns|Berg|Parkbank|Bank|Bäumen|Straße|Kreuzung|Hügel)\b/;
const treffer = zeilen.filter((z) => verboten.test(z.replace(/Riesenberg|Kissenberg/g, '')));
ok(!treffer.length, 'Kein Satz nennt Zaun, Berg, Parkbank, Straße oder Kreuzung' + (treffer.length ? ':\n  ' + treffer.join('\n  ') : ''));
const neu = execFileSync('node', ['stimmen/erzeugen.mjs', '--neu'], { cwd: wurzel, encoding: 'utf8' });
ok(/Sätze neu/.test(neu), 'Trockenlauf „--neu“ zeigt, was Credits kosten würde');
console.log(fehler ? fehler + ' FEHLER' : 'ALLES OK'); process.exit(fehler ? 1 : 0);
