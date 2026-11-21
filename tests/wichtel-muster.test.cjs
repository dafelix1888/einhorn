// Wichtel Bommi (UNICORN-135): Muster Geschichte 1 ist vollständig, klein genug fürs Handy und nicht für Suchmaschinen.
// Läuft ohne Browser.
const fs=require('fs'), path=require('path');
let fehler=0; const ok=(c,t)=>{ console.log((c?'ok   ':'FEHLER ')+t); if(!c) fehler++; };
const ORDNER=path.join(__dirname,'..','app','themen','wichtel','muster');
const da=f=>fs.existsSync(path.join(ORDNER,f));
const groesse=f=>da(f)?fs.statSync(path.join(ORDNER,f)).size:0;
const MB=1024*1024;

for(let i=1;i<=5;i++){
  ok(da('g1-bild'+i+'.jpg'), 'Bild '+i+' liegt da');
  ok(groesse('g1-bild'+i+'.jpg')<400*1024, 'Bild '+i+' ist kleiner als 400 KB');
  ok(da('g1-bild'+i+'.mp3'), 'Bild '+i+' wird vorgelesen');
}
ok(da('g1-video.mp4'), 'Video liegt da');
ok(groesse('g1-video.mp4')<10*MB, 'Video ist kleiner als 10 MB ('+(groesse('g1-video.mp4')/MB).toFixed(1)+' MB)');
// Schluss-Standbild aus dem Original-Bild 3, nicht aus dem letzten Clip-Bild (Abnahme UNICORN-135).
const schnitt=fs.readFileSync(path.join(__dirname,'..','stimmen','wichtel-video.sh'),'utf8');
ok(/-t 7\.5 -i "\$D\/b3\.png"/.test(schnitt) && !/c3_last/.test(schnitt), 'Schnitt nimmt als Schluss-Standbild das Original-Bild 3');
ok(da('bommi-melodie.mp3'), 'Bommi-Melodie liegt da');
ok(['bommi-probe-1.mp3','bommi-probe-2.mp3','bommi-probe-3.mp3'].every(da), 'Drei Stimmproben liegen da');

const html=fs.readFileSync(path.join(ORDNER,'index.html'),'utf8');
ok(/name="robots" content="noindex/.test(html), 'Muster-Seite ist für Suchmaschinen gesperrt');
ok(/Bommi liest vor/.test(html), 'Knopf „Bommi liest vor“ vorhanden');
ok(/\.\.\/geschichten\.json/.test(html), 'Texte kommen aus geschichten.json (eine Quelle)');
const verweise=[...html.matchAll(/(?:src|poster)="([^"]+)"/g)].map(m=>m[1]).filter(s=>!/^https?:/.test(s));
ok(verweise.every(da), 'Alle Dateien der Seite liegen da');

// Die Muster-Seite ist nirgends für Eltern oder Kinder verlinkt.
const APP=path.join(__dirname,'..','app');
const verlinkt=fs.readdirSync(APP).filter(f=>f.endsWith('.html')).some(f=>/wichtel\/muster/.test(fs.readFileSync(path.join(APP,f),'utf8')));
ok(!verlinkt, 'Muster-Seite ist in der App nicht verlinkt');

const stimmen=JSON.parse(fs.readFileSync(path.join(ORDNER,'..','stimmen.json'),'utf8'));
ok(stimmen.figuren.bommi.voice_id==='svptHMXByWlhGYcu3wTj', 'Bommis Stimme steht im Stimmen-Plan');

if(fehler){ console.log(fehler+' Fehler'); process.exit(1); } else console.log('Alles gut.');
