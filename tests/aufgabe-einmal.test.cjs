// Aufgabe nicht doppelt erzählen (UNICORN-122): Funkel sagt die Aufgabe, der Erzähler bringt seinen Witz und dann
// entweder Neues (z. B. Einhorn-Prüfung) oder ein kurzes „Also nochmal: …“ – nie beides.
// Wegsätze spricht Funkel selbst (Knopf heißt „Funkel sprechen lassen“).
const { spawnSync } = require('child_process');
const fs=require('fs'), path=require('path');
let fehler=0; const ok=(b,t)=>{ console.log((b?'ok   ':'FEHL ')+t); if(!b) fehler++; };
const W=path.join(__dirname,'..');
const r=spawnSync('node', [path.join(W,'stimmen/erzeugen.mjs'), '--liste'], {cwd:W, encoding:'utf8'});
const zeilen=r.stdout.split('\n').map(z=>{ const m=z.match(/^(\S+)\s+(\S+)\s+(.*)$/); return m ? {key:m[1], rolle:m[2], text:m[3]} : null; }).filter(Boolean);
ok(zeilen.length>100, 'Stimmen-Liste gelesen ('+zeilen.length+' Sätze)');
const erz=zeilen.filter(z=>/^(k|e\.[a-z]+)\.s\d/.test(z.key));
const tour=JSON.parse(fs.readFileSync(path.join(W,'app/themen/einhorn/tour.json'),'utf8'));
const kern=tour.erzaehler.kern;
// 1) Erzähler: höchstens eine Wiederholung
const zweimal=erz.filter(z=>{ const m=z.key.match(/s(\d)\.(\d)/); const hatKern=!!(kern[m[1]] && kern[m[1]][m[2]]); return hatKern && /[Aa]lso nochmal:|ganz kurz:/.test(z.text); });
ok(!zweimal.length, 'Kein Erzähler sagt erst die Aufgabe und dann noch „Also nochmal“'+(zweimal.length?': '+zweimal.slice(0,3).map(z=>z.key).join(', '):''));
const lang=erz.filter(z=>!/s0\.0/.test(z.key) && z.text.length>200);
ok(!lang.length, 'Erzählersätze sind kurz (außer der Einhorn-Prüfung)'+(lang.length?': '+lang.slice(0,3).map(z=>z.key+' '+z.text.length).join(', '):''));
// 2) Station 5: „merken“ und „Nebel“ sagt nur Funkel ausführlich
const s4=erz.filter(z=>/s4\.0/.test(z.key));
ok(s4.length>0 && s4.every(z=>!/Nebel/.test(z.text)), 'Station 5: Der Erzähler erzählt den Nebel nicht noch einmal');
// 3) Kein Erzähler wiederholt einen ganzen Satz von Funkel
const funkel=zeilen.filter(z=>z.rolle==='funkel').map(z=>z.text);
const saetze=t=>t.split(/(?<=[.!?])\s+/).filter(s=>s.split(' ').length>=5);
const gleich=[]; erz.forEach(z=>saetze(z.text).forEach(s=>{ if(funkel.some(f=>f.indexOf(s)>=0)) gleich.push(z.key+': '+s); }));
ok(!gleich.length, 'Kein Erzähler wiederholt einen Satz von Funkel wörtlich'+(gleich.length?': '+gleich.slice(0,3).join(' | '):''));
// 4) Wegsätze: Funkel spricht
const weg=zeilen.filter(z=>/^s\d\.weg/.test(z.key));
ok(weg.length>=6 && weg.every(z=>z.rolle==='funkel'), 'Alle Wegsätze spricht Funkel (Knopf „Funkel sprechen lassen“)');
ok(tour.stimmen.live.rolle==='funkel' && /funkel:\s*\{\s*voice_id/.test(fs.readFileSync(path.join(W,'worker/stimmen.js'),'utf8')), 'Ortsansagen ebenfalls in Funkels Stimme (Worker kennt die Rolle)');
// 5) Weg und Station sagen nicht dasselbe
const st=tour.stationen; const doppelt=st.filter(s=>s.seek && s.say && saetze(s.seek).some(x=>s.say.indexOf(x)>=0));
ok(!doppelt.length && !/zeigt euch mein Spiegel Bilder mit falschen Farben/.test(st[3].seek), 'Wegsatz kündigt an, wiederholt aber nicht die Aufgabe der Station');
process.exit(fehler?1:0);
