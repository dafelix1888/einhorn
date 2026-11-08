// .assetsignore darf keine Datei der App treffen (PBIM-18: „sw.js“ schloss auch app/sw.js aus, kein Offline-Modus bei Cloudflare).
// Prüft Einträge ohne „/“ und ohne Platzhalter: Sie gelten in jedem Ordner und dürfen unter app/ nicht vorkommen.
const fs=require('fs'), path=require('path');
const wurzel=path.join(__dirname,'..');
let fehler=0; const ok=(c,t)=>{ console.log((c?'ok   ':'FEHLER ')+t); if(!c) fehler++; };
const muster=fs.readFileSync(path.join(wurzel,'.assetsignore'),'utf8').split('\n').map(z=>z.trim()).filter(z=>z && !z.startsWith('#'));
const namen=muster.filter(m=>!m.includes('/') && !/[*?\[]/.test(m));
function dateien(dir){ return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?dateien(path.join(dir,e.name)):[path.join(dir,e.name)]); }
const app=dateien(path.join(wurzel,'app')).map(f=>path.relative(wurzel,f));
for(const n of namen){ const treffer=app.filter(f=>f.split(path.sep).includes(n)); ok(!treffer.length, '„'+n+'“ schließt keine App-Datei aus'+(treffer.length?' ('+treffer.join(', ')+')':'')); }
ok(fs.existsSync(path.join(wurzel,'app','sw.js')) && !namen.includes('sw.js'), 'app/sw.js wird ausgeliefert');
console.log(fehler?fehler+' FEHLER':'ALLES OK'); process.exit(fehler?1:0);
