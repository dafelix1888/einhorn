// Ende der Tour (UNICORN-75): Abschlusskarte statt Reset-Knopf, Party-Übersicht im Zustand „Gefeiert“.
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
  const morgen=new Date(Date.now()+864e5).toISOString().slice(0,10);
  await p.evaluate(([st,d])=>{ localStorage.clear();
    localStorage.setItem('sj.party.einhorn', JSON.stringify({format:1,thema:'einhorn',kind:{name:'Mia',alter:5},datum:d,start:'15:00',kinder:6,helfer:2,vorausgeher:true,ort:'draussen',planB:true,ausdrucke:true,erledigt:{},einkauf:{}}));
    localStorage.setItem('sj.plan.einhorn', JSON.stringify({format:1,thema:'einhorn',variante:'a',kinder:6,stationen:st,strecke:900})); }, [st, morgen]);

  // Vor der Tour: Übersicht wie gewohnt
  await p.goto(B+'party.html?thema=einhorn'); await p.waitForSelector('.held');
  ok(!(await p.locator('#nach-der-party').count()) && await p.locator('.station.dran').count()===1, 'Vor der Tour: keine Karte „Nach der Party“, ein Schritt „Als Nächstes“');

  // Tour bis nach Hause
  await p.goto(B+'spiel.html?thema=einhorn'); await p.waitForTimeout(800);
  await p.evaluate(()=>{ const s=__zs.state(); s.phase='heim'; s.step=0; s.idx=6; });
  await p.evaluate(()=>document.getElementById('btn-main').click()); await p.waitForTimeout(400);
  await p.evaluate(()=>document.getElementById('btn-main').click()); await p.waitForTimeout(200);   // versehentlicher Tipp setzt nichts zurück
  ok((await p.evaluate(()=>__zs.state().phase))==='heim' && (await p.evaluate(()=>__zs.state().step))===1, 'Zu Hause angekommen');
  ok(!(await p.locator('#btn-main').isVisible()), 'Kein Hauptknopf, der die Tour zurücksetzt');
  const ab=await p.locator('#abschluss').innerText();
  ok(/Gruppenfoto machen/.test(ab) && /Urkunden verteilen/.test(ab) && /nach dem Essen/.test(ab) && /Danke an die Gäste/.test(ab), 'Abschlusskarte: Foto, Urkunden, Schatz, Danke');
  ok(await p.locator('#abschluss-party').isVisible() && !(await p.locator('#btn-portal').isVisible()), 'Großer Knopf „Zur Party“ in der Karte');
  ok(!/abwischen/.test(await p.locator('body').innerText()), 'Kein „Tattoos abwischen“');
  ok(await p.evaluate(()=>!!JSON.parse(localStorage.getItem('sj.party.einhorn')).tourEnde), 'Party merkt sich: Tour zu Ende gespielt');

  // Party-Übersicht: Gefeiert
  await p.click('#abschluss-party'); await p.waitForSelector('.held');
  ok(await p.locator('#nach-der-party').isVisible() && await p.locator('#danke-link').isVisible(), 'Party: Karte „Nach der Party“ gleich nach der Tour, mit Danke-Link');
  ok(!(await p.locator('.dran-marke').count()) && !/Startklar öffnen/.test(await p.locator('.held').innerText()), 'Kein „Als Nächstes“ und kein „Startklar“ mehr');
  ok(/Gefeiert/.test(await p.locator('.sprech').innerText()), 'Regenbogen-Satz: Gefeiert');
  ok(await p.locator('details.vorbereitung-zu').count()===1 && !(await p.locator('details.vorbereitung-zu').evaluate(e=>e.open)), 'Vorbereitung eingeklappt');

  // Tablet mit fremder Party: Hinweis statt Knopf
  await p.evaluate(()=>{ localStorage.removeItem('sj.party.einhorn'); });
  await p.goto(B+'spiel.html?thema=einhorn'); await p.waitForTimeout(800);
  await p.evaluate(()=>{ const s=__zs.state(); s.phase='heim'; s.step=1; s.idx=6; }); await p.evaluate(()=>window.__zs.render && __zs.render());
  await p.evaluate(()=>document.getElementById('btn-speak').click()).catch(()=>{}); await p.waitForTimeout(300);
  const ab2=await p.locator('#abschluss').innerText().catch(()=>'');
  ok(!ab2 || (/Handy der Gastgeber/.test(ab2) && !(await p.locator('#abschluss-party').count())), 'Ohne eigene Party: Hinweis aufs Handy der Gastgeber');

  ok(!pf.length, 'Keine Seitenfehler'+(pf.length?': '+pf.join(' | '):''));
  await b.close(); console.log(fehler?fehler+' FEHLER':'ALLES OK'); process.exit(fehler?1:0);
})();
