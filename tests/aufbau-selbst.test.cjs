// Partytag ohne Vorausgeher (UNICORN-73): Teilschritt „Stationen aufbauen“ mit Uhrzeit, Aufbau-Liste für sich selbst, Startklar mit denselben Zeiten.
const { chromium } = require('playwright');
const S='http://localhost:8765', B=S+'/app/';
let fehler=0; const ok=(b,t)=>{ console.log((b?'ok   ':'FEHL ')+t); if(!b) fehler++; };
(async()=>{
  const b=await chromium.launch(), c=await b.newContext({viewport:{width:393,height:852}});
  await c.addInitScript(()=>{ window.KONTO_TEST={url:'',key:''}; });
  await c.route(/^https?:\/\/(?!localhost)/, r=>r.abort());
  const p=await c.newPage(); const pf=[]; p.on('pageerror', e=>pf.push(e.message));
  await p.goto(B);
  const st=[0,1,2,3,4,5,6].map(i=>({lat:53.55+i*0.001, lng:10.0+i*0.001, name:'Ort '+i}));
  const plan={format:1,thema:'einhorn',variante:'a',kinder:6,stationen:st,strecke:900};
  const party=vg=>({format:1,thema:'einhorn',kind:{name:'Mia',alter:5},datum:'2030-06-15',start:'15:00',kinder:6,helfer:2,vorausgeher:vg,ort:'draussen',planB:true,ausdrucke:true,erledigt:{},einkauf:{}});
  const setzen=pa=>p.evaluate(([pa,pl])=>{ localStorage.clear(); localStorage.setItem('sj.party.einhorn', JSON.stringify(pa)); localStorage.setItem('sj.plan.einhorn', JSON.stringify(pl)); }, [pa,plan]);
  const partytag=()=>p.evaluate(async()=>{ const t=await (await fetch('themen/einhorn/tour.json')).json(); return Party.aufgaben(Party.lesen('einhorn'), t, Party.plan('einhorn')).find(a=>a.id==='partytag'); });

  // Ohne Vorausgeher
  await setzen(party(false));
  let pt=await partytag();
  const auf=pt.teile.find(x=>x.id==='aufbau'), kr=pt.teile.find(x=>x.id==='kreide');
  ok(auf && auf.uhr==='13:45' && /Schatzkiste bleibt bei dir/.test(auf.text), 'Ohne Vorausgeher: „Stationen aufbauen“ um 13:45 (75 Min. vorher)');
  ok(kr && kr.uhr==='13:30', 'Ohne Vorausgeher: Kreidespur 90 Min. vorher');
  ok(!pt.teile.some(x=>x.id==='vorausgeher'), 'Kein „Vorausgeher startet“');
  const ics=await p.evaluate(async()=>{ const t=await (await fetch('themen/einhorn/tour.json')).json(); return Party.ics(Party.lesen('einhorn'), t, Party.plan('einhorn')); });
  ok(/Stationen aufbauen/.test(ics) && /DTSTART:20300615T134500/.test(ics), 'Kalender: Termin „Stationen aufbauen“ um 13:45');

  await p.goto(B+'party.html?thema=einhorn#s-partytag'); await p.waitForSelector('#s-partytag');
  const k=p.locator('#s-partytag a.kachel[href*="modus=selbst"]');
  ok(await k.count()===1 && /Aufbau-Liste öffnen/.test(await k.innerText()), 'Party: Kachel „Aufbau-Liste öffnen“');

  await p.goto(B+'bereit.html?thema=einhorn'); await p.waitForSelector('#heute .termin');
  const heute=await p.locator('#heute').innerText();
  ok(/13:30[\s\S]*Kreidespur/.test(heute) && /13:45[\s\S]*Stationen aufbauen/.test(heute) && !/Vorausgeher startet/.test(heute), 'Startklar: dieselben Uhrzeiten wie die Party');
  ok(/modus=selbst/.test(await p.locator('#heute a[href*="modus=selbst"]').getAttribute('href')||''), 'Startklar: Link zur Aufbau-Liste');

  await p.goto(B+'vorausgeher.html?thema=einhorn&modus=selbst'); await p.waitForSelector('.fokus');
  const seite=await p.locator('#seite').innerText();
  ok(/Stationen aufbauen/.test(await p.locator('.kopf').innerText()) && /Aufbauen ab 13:45/.test(seite), 'Aufbau-Seite „selbst“: Titel und Uhrzeit ohne Vorausgeher');
  ok(!/Losgehen um/.test(seite) && /abseits vom Weg/.test(seite), 'Ohne „Losgehen um“, mit Hinweis „Sachen liegen allein“');
  await p.evaluate(()=>{ const x=JSON.parse(localStorage.getItem('sj.party.einhorn')); x.aufgebaut={1:true,2:true,3:true,4:true,5:true,6:true}; localStorage.setItem('sj.party.einhorn', JSON.stringify(x)); });
  await p.reload(); await p.waitForSelector('.fertig-karte');
  const ende=await p.locator('#fokus').innerText();
  ok(/Alles steht/.test(ende) && /Gäste kommen um 15:00/.test(ende) && !/Geh der Gruppe entgegen/.test(ende), 'Schluss „selbst“: zurück nach Hause, nicht der Gruppe entgegen');

  // Mit Vorausgeher bleibt alles wie bisher
  await setzen(party(true));
  pt=await partytag();
  ok(!pt.teile.some(x=>x.id==='aufbau') && pt.teile.find(x=>x.id==='kreide').uhr==='14:00' && pt.teile.find(x=>x.id==='vorausgeher').uhr==='14:40', 'Mit Vorausgeher: Kreidespur 14:00, Vorausgeher 14:40, kein eigener Aufbau');
  await p.goto(B+'vorausgeher.html?thema=einhorn'); await p.waitForSelector('.fokus');
  ok(/Vorausgeher/.test(await p.locator('.kopf').innerText()) && /Losgehen um 14:40/.test(await p.locator('#seite').innerText()), 'Vorausgeher-Seite unverändert');

  ok(!pf.length, 'Keine Seitenfehler'+(pf.length?': '+pf.join(' | '):''));
  await b.close(); console.log(fehler?fehler+' FEHLER':'ALLES OK'); process.exit(fehler?1:0);
})();
