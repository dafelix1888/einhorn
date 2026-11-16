// Eine Generalprobe statt zwei Läufen (UNICORN-76): Schritt 3 ist die Probe, sie hakt sich selbst ab und gilt für die Route, mit der sie lief.
const { chromium } = require('playwright');
const S='http://localhost:8765', B=S+'/app/';
let fehler=0; const ok=(b,t)=>{ console.log((b?'ok   ':'FEHL ')+t); if(!b) fehler++; };
(async()=>{
  const b=await chromium.launch(), c=await b.newContext({viewport:{width:393,height:852}});
  await c.addInitScript(()=>{ window.KONTO_TEST={url:'',key:''}; });
  await c.route(/^https?:\/\/(?!localhost)/, r=>r.abort());
  const p=await c.newPage(); const pf=[]; p.on('pageerror', e=>pf.push(e.message));
  await p.goto(B);
  const party={format:1,thema:'einhorn',kind:{name:'Mia',alter:5},datum:'2030-06-15',start:'15:00',kinder:6,helfer:2,vorausgeher:true,ort:'draussen',planB:true,ausdrucke:true,erledigt:{},einkauf:{}};
  const st=[0,1,2,3,4,5,6].map(i=>({lat:53.55+i*0.001, lng:10.0+i*0.001, name:'Ort '+i}));
  const plan={format:1,thema:'einhorn',variante:'a',kinder:6,stationen:st,strecke:900};
  const setzen=(pa,pl)=>p.evaluate(([pa,pl])=>{ localStorage.clear(); localStorage.setItem('sj.party.einhorn', JSON.stringify(pa)); localStorage.setItem('sj.plan.einhorn', JSON.stringify(pl)); }, [pa,pl]);
  const schritt=id=>p.evaluate(async id=>{ const t=await (await fetch('themen/einhorn/tour.json')).json(); return Party.aufgaben(Party.lesen('einhorn'), t, Party.plan('einhorn')).find(a=>a.id===id); }, id);

  // Schritt 3 draußen
  await setzen(party, plan);
  let r=await schritt('route');
  ok(r.titel==='Generalprobe' && /probe=1/.test(r.link) && r.knopf==='Generalprobe starten', 'Schritt 3 heißt Generalprobe und startet sie');
  ok(!r.fertig, 'Ohne Probe: offen');
  const pt=await schritt('partytag');
  ok(!pt.teile.some(x=>x.id==='generalprobe') && !/Generalprobe/.test(pt.text+pt.kurz), 'Partytag draußen ohne Generalprobe am Vortag');

  // Alte Haken zählen weiter
  await setzen(Object.assign({}, party, {erledigt:{generalprobe:true}}), plan);
  ok((await schritt('route')).fertig, 'Alter Haken „Generalprobe am Vortag“ zählt');
  await setzen(Object.assign({}, party, {erledigt:{probelauf:true}}), plan);
  ok((await schritt('route')).fertig, 'Alter Haken „Einmal abgelaufen“ zählt');

  // Zu Ende gespielte Probe hakt selbst ab
  await setzen(party, plan);
  await p.goto(B+'spiel.html?thema=einhorn&probe=1'); await p.waitForTimeout(800);
  await p.evaluate(()=>{ const s=__zs.state(); s.phase='end'; s.idx=6; }); await p.evaluate(()=>document.getElementById('btn-main').click()).catch(()=>{});
  await p.evaluate(()=>{ const s=__zs.state(); s.phase='heim'; s.step=1; }); await p.waitForTimeout(200);
  await p.evaluate(()=>{ if(window.__zs.render) __zs.render(); });
  await p.waitForFunction(()=>{ const x=JSON.parse(localStorage.getItem('sj.party.einhorn')); return x.erledigt && x.erledigt.probelauf; }, null, {timeout:5000}).catch(()=>{});
  const nach=await p.evaluate(()=>JSON.parse(localStorage.getItem('sj.party.einhorn')));
  ok(nach.erledigt.probelauf && !!nach.probeRoute, 'Zu Ende gespielte Probe hakt „Einmal abgelaufen“ ab und merkt sich die Route');
  await p.goto(B); r=await schritt('route');
  ok(r.fertig, 'Schritt Generalprobe ist danach erledigt');

  // Route geändert: Haken wieder offen
  await p.evaluate(()=>{ const pl=JSON.parse(localStorage.getItem('sj.plan.einhorn')); pl.stationen[3].lat+=0.0005; localStorage.setItem('sj.plan.einhorn', JSON.stringify(pl)); });
  r=await schritt('route');
  ok(!r.fertig && /Route geändert/.test(r.teile.find(x=>x.id==='probelauf').text) && /noch einmal ab/.test(r.text), 'Route geändert: Haken wieder offen, mit Hinweis');

  // Kalender: Generalprobe eine Woche vorher, nicht am Vortag
  const ics=await p.evaluate(async()=>{ const t=await (await fetch('themen/einhorn/tour.json')).json(); return Party.ics(Party.lesen('einhorn'), t, Party.plan('einhorn')); });
  ok(/SUMMARY:[^\n]*Generalprobe/.test(ics) && /DTSTART;VALUE=DATE:20300608/.test(ics), 'Kalender: Generalprobe eine Woche vor der Party');
  ok(!/UID:einhorn-generalprobe/.test(ics), 'Kalender: kein Termin „Generalprobe“ am Vortag');

  // Drinnen bleibt die Generalprobe am Vortag freiwillig
  await setzen(Object.assign({}, party, {ort:'drinnen'}), plan);
  const ptd=await schritt('partytag');
  ok(ptd.teile.some(x=>x.id==='generalprobe' && x.extra), 'Drinnen: Generalprobe am Vortag bleibt freiwillig');

  ok(!pf.length, 'Keine Seitenfehler'+(pf.length?': '+pf.join(' | '):''));
  await b.close(); console.log(fehler?fehler+' FEHLER':'ALLES OK'); process.exit(fehler?1:0);
})();
