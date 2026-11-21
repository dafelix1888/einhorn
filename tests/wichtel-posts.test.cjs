// Wichtel Bommi (UNICORN-147, MAR-76): Post-Bilder für Instagram und Pinterest liegen öffentlich unter app/themen/wichtel/posts/.
// Erzeugt per Skript von Marketer (motive.py, motive_woche1.py), Dateien unverändert. Läuft ohne Browser.
const fs=require('fs'), path=require('path');
let fehler=0; const ok=(c,t)=>{ console.log((c?'ok   ':'FEHLER ')+t); if(!c) fehler++; };
const ORDNER=path.join(__dirname,'..','app','themen','wichtel','posts');
// Maße aus dem JPEG-Kopf (SOF-Marker) lesen.
function masse(datei){
  const b=fs.readFileSync(datei); let i=2;
  while(i<b.length){
    if(b[i]!==0xFF){ i++; continue; }
    const m=b[i+1], len=b.readUInt16BE(i+2);
    if(m>=0xC0 && m<=0xCF && m!==0xC4 && m!==0xC8 && m!==0xCC) return [b.readUInt16BE(i+7), b.readUInt16BE(i+5)];
    i+=2+len;
  }
  return null;
}
const SOLL={
  'reel-titel.jpg':[1080,1920], 'karussell-1.jpg':[1080,1350], 'karussell-2.jpg':[1080,1350], 'karussell-3.jpg':[1080,1350], 'karussell-4.jpg':[1080,1350],
  'pin-start.jpg':[1000,1500], 'pin-einzug.jpg':[1000,1500], 'profil.jpg':[640,640],
  'advent-1.jpg':[1080,1350], 'pin-ideen.jpg':[1000,1500], 'morgen-g1.jpg':[1080,1350], 'pin-material.jpg':[1000,1500], 'reel-g1.jpg':[1080,1920],
  'pin-g1.jpg':[1000,1500], 'morgen-g2.jpg':[1080,1350], 'standbild-g2.jpg':[1080,1350], 'pin-g2.jpg':[1000,1500]
};
for(const [d,[w,h]] of Object.entries(SOLL)){
  const p=path.join(ORDNER,d);
  if(!fs.existsSync(p)){ ok(false, d+' fehlt'); continue; }
  const b=fs.readFileSync(p);
  ok(b[0]===0xFF && b[1]===0xD8, d+' ist ein JPEG');
  const m=masse(p);
  ok(m && m[0]===w && m[1]===h, d+' hat '+(m?m.join('x'):'?')+' (soll '+w+'x'+h+')');
}
ok(fs.readdirSync(ORDNER).filter(f=>f.endsWith('.jpg')).length===Object.keys(SOLL).length, 'keine weiteren Bilder im Ordner');
ok(!fs.existsSync(path.join(ORDNER,'motive.py')), 'Skripte liegen nicht im Repo');
const sw=fs.readFileSync(path.join(__dirname,'..','app','sw.js'),'utf8');
ok(!/wichtel\/posts/.test(sw), 'Post-Bilder werden nicht im Service Worker vorgeladen');
if(fehler){ console.log(fehler+' Fehler'); process.exit(1); }
console.log('alles ok');
