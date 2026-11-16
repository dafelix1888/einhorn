// Ein Wort je Sache (UNICORN-119): Die Bildschirmtexte der App nutzen die Wörter aus der Wortliste in CLAUDE.md.
// Landingpage und Themenseiten gehören Marketer und sind ausgenommen. Kommentare im Code zählen nicht.
const fs=require('fs'), path=require('path');
let fehler=0; const ok=(c,t)=>{ console.log((c?'ok   ':'FEHLER ')+t); if(!c) fehler++; };
const APP=path.join(__dirname,'..','app');
const dateien=[];
(function sammeln(d){ for(const n of fs.readdirSync(d)){ const p=path.join(d,n), rel=path.relative(APP,p);
  if(/^(landing|ideen|vendor|schrift)\b/.test(rel)) continue;
  if(fs.statSync(p).isDirectory()) sammeln(p); else if(/\.(html|js|json)$/.test(n) && n!=='landing.html') dateien.push(p); } })(APP);
const ohneKommentare=s=>s.replace(/\/\*[\s\S]*?\*\//g,'').replace(/<!--[\s\S]*?-->/g,'').split('\n').map(z=>z.replace(/(^|\s)\/\/\s.*$/,'')).join('\n');
const VERBOTEN=[
  [/Schnitzeljagd/, 'Schatzsuche'],
  [/\bJagd\b/, 'Tour oder Schatzsuche'],
  [/Probelauf/, 'Generalprobe'],
  [/Route ablaufen/, 'Generalprobe'],
  [/Spiel-Gerät/, 'Tablet'],
  [/Elternbereich/, '„Erwachsene“ → „Einrichten“'],
  [/Einkaufsliste/, 'Material'],
  [/Bastelliste/, 'Packliste oder Basteln'],
];
for(const [re, statt] of VERBOTEN){
  const funde=[];
  for(const f of dateien){ const t=ohneKommentare(fs.readFileSync(f,'utf8')); t.split('\n').forEach((z,i)=>{ if(re.test(z)) funde.push(path.relative(APP,f)+':'+(i+1)); }); }
  ok(!funde.length, 'Kein „'+re.source.replace(/\\b/g,'')+'“, sondern '+statt+(funde.length?': '+funde.slice(0,5).join(', '):''));
}
ok(/## Wortliste/.test(fs.readFileSync(path.join(__dirname,'..','CLAUDE.md'),'utf8')), 'Wortliste steht in CLAUDE.md');
console.log(fehler?fehler+' FEHLER':'ALLES OK'); process.exit(fehler?1:0);
