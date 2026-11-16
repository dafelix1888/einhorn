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

// Schatzkiste: eine Regel (UNICORN-74)
const roh=fs.readFileSync(path.join(__dirname,'..','app/themen/einhorn/tour.json'),'utf8');
ok(!/Schatzkiste[^"]*(Parkbank|Kratzbild|Zeichenschablon)/.test(roh) && !/(Kratzbildern, Zaubertafeln|Darin liegen)/.test(roh+spiel), 'Schatzkiste: kein Ort und kein fester Inhalt in Texten');
ok(!/Schatzkiste/.test(tour.stationen[6].planer.versteck), 'Planer: Schatzkiste ist kein Versteck an Station 7');
ok(/versteckt/.test(tour.stationen[6].vorOrt), 'Hinweis vor Ort: Schatzkiste bleibt noch versteckt');
ok(Object.values(tour.vorbereitung.variante).every(l=>l.every(b=>b.items.filter(x=>/^Schatzkiste/.test(x)).every(x=>/nicht hinlegen/.test(x)))), 'Packlisten: Schatzkiste „nicht hinlegen“');
ok(/hinstellen/.test(text(info.ende.a)) && /zu Hause/.test(text(info.ende.a)), 'Stichpunkte am Schatz: hinstellen, öffnen, zu Hause verteilen');

// Jeder Schritt hat Stichpunkte, in jeder Spielart ohne Ortsreste außer im Extra b (UNICORN-112)
const soll=['start','ende','heim','heim.ende'];
tour.stationen.forEach((s,i)=>{ if(i>0) soll.push('w'+i); const n=s.steps&&s.steps.length ? s.steps.length : (s.kind==='recolor'||s.kind==='wahl') ? 2 : 1; for(let k=0;k<n;k++) soll.push(i+'.'+k); });
const fehlt=soll.filter(k=>!info[k] || !(info[k].a||[]).length);
ok(!fehlt.length, 'Jeder Schritt hat Stichpunkte ('+soll.length+' Schritte)'+(fehlt.length?', fehlt: '+fehlt.join(', '):''));
const leer=[]; Object.entries(info).forEach(([k,e])=>Object.entries(e).forEach(([v,z])=>(z||[]).forEach(r=>{ if(!r[0]||!r[1]) leer.push(k+' '+v); })));
ok(!leer.length, 'Keine leeren Stichpunkte'+(leer.length?': '+leer.join(', '):''));
const resteAlle=[]; Object.entries(info).forEach(([k,e])=>Object.entries(e).forEach(([v,z])=>{ if(v!=='b' && ORT.test(text(z))) resteAlle.push(k+' '+v); }));
ok(!resteAlle.length, 'Auch drinnen (c) und in allen anderen Fassungen keine Ortsreste'+(resteAlle.length?': '+resteAlle.join(', '):''));

if(fehler){ console.log(fehler+' FEHLER'); process.exit(1); }
console.log('ALLES OK');
