// Wichtel Bommi, Serie (UNICORN-138): Jede Geschichte 2 bis 8, deren Ordner schon da ist, hat 5 Bilder und 5 Vorlese-Töne,
// klein genug fürs Handy, und liegt genau dort, wo die Kinder-Ansicht sie sucht (WichtelKern.medien). Das Video ist freiwillig:
// Fehlt es, startet die Kinder-Ansicht gleich mit den Bildern. Läuft ohne Browser.
const fs=require('fs'), path=require('path');
const WK=require('../app/wichtel-kern.js');
let fehler=0; const ok=(c,t)=>{ console.log((c?'ok   ':'FEHLER ')+t); if(!c) fehler++; };
const APP=path.join(__dirname,'..','app');
const groesse=f=>fs.existsSync(path.join(APP,f))?fs.statSync(path.join(APP,f)).size:0;
const KB=1024, MB=1024*1024;

const fertig=[];
for(let nr=2;nr<=8;nr++){
  const ordner=path.join(APP,'themen','wichtel','g'+nr);
  if(!fs.existsSync(ordner)) continue;
  fertig.push(nr);
  const m=WK.medien(nr);
  ok(m.bilder.length===5, 'Geschichte '+nr+': 5 Seiten');
  m.bilder.forEach((s,i)=>{
    ok(groesse(s.bild)>50*KB && groesse(s.bild)<400*KB, 'Geschichte '+nr+' Bild '+(i+1)+' liegt da und ist kleiner als 400 KB');
    ok(groesse(s.ton)>20*KB && groesse(s.ton)<400*KB, 'Geschichte '+nr+' Bild '+(i+1)+' wird vorgelesen');
  });
  if(groesse(m.video)) ok(groesse(m.video)<10*MB, 'Geschichte '+nr+': Video kleiner als 10 MB');
  else console.log('     Geschichte '+nr+': noch kein Video, Kinder-Ansicht zeigt gleich die Bilder');
}
ok(fertig.includes(2), 'Geschichte 2 ist da');
ok(fertig.includes(3), 'Geschichte 3 ist da');
ok(fertig.includes(4), 'Geschichte 4 ist da');
ok(fertig.includes(5), 'Geschichte 5 ist da');
ok(fertig.includes(6), 'Geschichte 6 ist da');
ok(fertig.includes(7), 'Geschichte 7 ist da');
ok(fertig.includes(8), 'Geschichte 8 ist da');
const videos=fertig.filter(nr=>groesse(WK.medien(nr).video));
ok(videos.includes(2), 'Geschichte 2 hat ein Video');
ok(videos.includes(3), 'Geschichte 3 hat ein Video');
ok(videos.includes(4), 'Geschichte 4 hat ein Video');
ok(videos.includes(5), 'Geschichte 5 hat ein Video');
ok(videos.includes(6), 'Geschichte 6 hat ein Video');
ok(videos.includes(7), 'Geschichte 7 hat ein Video');
ok(videos.includes(8), 'Geschichte 8 hat ein Video');
console.log('Videos fertig: '+[1].concat(videos).join(', '));
console.log('Bildergeschichten fertig: '+[1].concat(fertig).join(', '));
process.exit(fehler?1:0);
