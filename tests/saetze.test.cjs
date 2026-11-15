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
// Einschübe (UNICORN-64): Der Satz nach dem Namens-Gruß passt mit und ohne Gruß, Ortsansagen stehen im Worker
const fs = require('fs');
const tour = JSON.parse(fs.readFileSync(path.join(wurzel, 'app/themen/einhorn/tour.json'), 'utf8'));
const nach = tour.stationen[0].say2;
ok(!/^(Aber|Doch|Trotzdem|Dann)\b/.test(nach), 'Satz nach dem Namens-Gruß beginnt nicht mit Aber/Doch: „' + nach.slice(0, 40) + '…“');
const worker = fs.readFileSync(path.join(wurzel, 'worker/stimmen.js'), 'utf8');
const fehlt = tour.stationen.map((s) => s.ansage).filter(Boolean).filter((a) => !worker.includes("'" + a + "'"));
ok(!fehlt.length, 'Jede Ortsansage ist im Stimmen-Worker erlaubt' + (fehlt.length ? ': ' + fehlt.join(' | ') : ''));
const ortsWoerter = /\b(Zaun|Wolkenberg|Parkbank|Kreuzung)\b/;
ok(!tour.stationen.some((s) => s.ansage && ortsWoerter.test(s.ansage)), 'Ortsansagen nennen nur, was der Satz davor eingeführt hat');
const namen = JSON.stringify(tour.namenSaetze);
ok(!/wunderbares Abenteuer/.test(namen), 'Abschied wiederholt nicht „Abenteuer“ direkt nach „Bis zum nächsten Abenteuer!“');
const spiel = fs.readFileSync(path.join(wurzel, 'app/spiel.html'), 'utf8');
ok(/dbPut\('n\.'\+k, \{[^}]*rate:1\}/.test(spiel), 'Namens-Sätze laufen im Tempo 1 wie Funkels feste Sätze');
// Vorbereitung (UNICORN-66): Was Funkel anspricht, ist nötig und hat eine Notlösung
const vb = tour.vorbereitung;
ok(vb.noetig.every((x) => x.notfalls), 'Jedes nötige Ding hat eine Notlösung');
const gesprochen = JSON.stringify([tour.stationen.map((s) => [s.say, s.say2, s.seek, s.after, s.task, (s.steps || []).map((x) => x.say), s.ohne]), tour.texte, tour.erzaehler]);
const pruef = [['Haarreifen', /Hörner|Haarreif/], ['Tattoos', /mein Zeichen/], ['Glückssteine', /Glücksstein/], ['Buntes Band', /das bunte Band/]];
for (const [ding, muster] of pruef) {
  const gesagt = muster.test(gesprochen), noetig = vb.noetig.some((x) => x.x.includes(ding)), extra = vb.extras.some((x) => x.x.includes(ding));
  ok(!gesagt || (noetig && !extra), ding + (gesagt ? ' kommt im Spiel vor, steht deshalb unter „nötig“' : ' kommt im Spiel nicht vor'));
}
console.log(fehler ? fehler + ' FEHLER' : 'ALLES OK'); process.exit(fehler ? 1 : 0);
