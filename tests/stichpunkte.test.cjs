// Stichpunkte für Erwachsene (tour.json → info): passen zur Mechanik und zu jeder Route (UNICORN-77, UNICORN-78, UNICORN-112). Läuft ohne Browser.
const fs=require('fs'), path=require('path');
let fehler=0; const ok=(b,t)=>{ console.log((b?'ok   ':'FEHL ')+t); if(!b) fehler++; };
const tour=JSON.parse(fs.readFileSync(path.join(__dirname,'..','app/themen/einhorn/tour.json'),'utf8'));
const info=tour.info, text=z=>(z||[]).map(r=>r.join(' ')).join(' · ');

// Station 5 „Wer war das?“: Merken – Malen – Vergleichen (UNICORN-77)
tour.stationen.forEach((s,i)=>{
  if(!s.merken) return;
  const vor=info[i+'.0']||{};
  ['a','c'].forEach(v=>{ const z=text(vor[v]||vor.a); ok(/merken/i.test(z) && /Nebel/.test(z), 'Station '+(i+1)+' ('+v+'): Stichpunkte vor der Lösung nennen Merken und Nebel'); });
  ok(/Zaubertafel/.test(text(vor.a)), 'Station '+(i+1)+' draußen: Zaubertafel vor der Lösung');
  ok(!/Finden/.test(text((info[i+'.1']||{}).a)), 'Station '+(i+1)+' draußen: nach der Lösung keine Suche mehr');
});
const tafel=tour.gaben.find(g=>/Zaubertafel/.test(g.was));
ok(tafel && /Gedächtnis/.test(tafel.wie) && !/abmalen|malen sie die Fuchspfote/.test(tafel.wie), '„Wer bekommt was wo“: Zaubertafel aus dem Gedächtnis');

// Keine Ortsreste vom Original-Geburtstag in Stichpunkten ohne Extra (UNICORN-78). Das Extra (b) braucht bewusst einen Zaun.
const ORT=/\b(Erdweg|Parkbank|Berg|Zaun|Zauns|Kreuzung|Hügel)\b/;
const ortsreste=Object.entries(info).filter(([k,e])=>ORT.test(text(e.a))).map(([k])=>k);
ok(!ortsreste.length, 'Stichpunkte ohne Extra ohne Zaun, Berg, Parkbank, Kreuzung'+(ortsreste.length?': '+ortsreste.join(', '):''));
const tasche=tour.vorbereitung.variante.a.map(b=>b.items.join(' ')).join(' ');
ok(!ORT.test(tasche), 'Vorausgeher-Tasche ohne Extra ohne feste Orte');
ok(/etwas Rotes/.test(tasche) && /auffällt/.test(tasche), 'Ohne Extra: rote Bögen neben etwas Rotes, gelbe an eine Stelle, die auffällt');
const spiel=fs.readFileSync(path.join(__dirname,'..','app/spiel.html'),'utf8');
ok(!/am Zaun weiter|zur Parkbank/.test(spiel), 'Hauptzeilen im Spiel ohne Zaun und Parkbank');
ok(/'Letzte Station'/.test(fs.readFileSync(path.join(__dirname,'..','app/planer-kern.js'),'utf8')), 'Planer: Ersatz-Wegpunkt am Ziel heißt „Letzte Station“');

if(fehler){ console.log(fehler+' FEHLER'); process.exit(1); }
console.log('ALLES OK');
