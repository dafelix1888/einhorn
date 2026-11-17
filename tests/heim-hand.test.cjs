// Heimweg von Hand beenden oder überspringen (UNICORN-123)
const { chromium } = require('playwright');
const S='http://localhost:8765', B=S+'/app/';
let fehler=0; const ok=(b,t)=>{ console.log((b?'ok   ':'FEHL ')+t); if(!b) fehler++; };
(async()=>{
  const b=await chromium.launch(), c=await b.newContext({viewport:{width:393,height:852}, geolocation:{latitude:53.60, longitude:10.0, accuracy:5}, permissions:['geolocation']});
  await c.addInitScript(()=>{ window.KONTO_TEST={url:'',key:''}; });
  await c.route(/^https?:\/\/(?!localhost)/, r=>r.abort());
  const p=await c.newPage(); const pf=[]; p.on('pageerror', e=>pf.push(e.message));
  await p.goto(B);
  const st=[0,1,2,3,4,5,6].map(i=>({lat:53.55+i*0.001, lng:10.0+i*0.001, name:'Ort '+i}));
  const zustand=(ph)=>p.evaluate(([st,ph])=>{ localStorage.clear();
    localStorage.setItem('sj.plan.einhorn', JSON.stringify({format:1,thema:'einhorn',variante:'a',kinder:6,stationen:st,strecke:900}));
    const pts=st.map(s=>({lat:s.lat,lng:s.lng}));
    localStorage.setItem('sj.einhorn.v1', JSON.stringify({points:pts, idx:6, phase:ph, step:0, radius:15, showTest:true, autoSag:false, variante:'a', startZeit:Date.now()-3600e3, heim:{lat:53.55,lng:10.0}, probe:false})); }, [st, ph]);

  // 1. Heimweg mit GPS, Haustür 5 km weg: kleiner Knopf beendet ihn
  await zustand('heim');
  await p.goto(B+'spiel.html?thema=einhorn'); await p.waitForTimeout(1500);
  const hand=p.locator("#btn-hand"), ohne=p.locator("#btn-ohneheim");
  ok(await hand.isVisible() && /Zu Hause angekommen/.test(await hand.innerText()), 'Heimweg mit GPS: Knopf „Zu Hause angekommen“ unter dem Spiegel');
  await hand.click(); await p.waitForTimeout(400);
  ok(await p.evaluate(()=>__zs.state().phase==='heim' && __zs.state().step===1), 'Tippen: „Zu Hause!“');
  ok(await p.locator('#abschluss').isVisible() && await hand.isHidden(), 'Abschlusskarte da, Knopf weg');

  // 1b. Neuladen auf dem Heimweg bleibt auf dem Heimweg
  await zustand('heim'); await p.goto(B+'spiel.html?thema=einhorn'); await p.waitForTimeout(800);
  ok(await p.evaluate(()=>__zs.state().phase==='heim' && __zs.state().step===0), 'Neu geladen: weiter auf dem Heimweg, nicht zurück auf Anfang');

  // 2. Nach dem Schatz: Heimweg überspringen
  await zustand('end');
  await p.goto(B+'spiel.html?thema=einhorn'); await p.waitForTimeout(1500);
  ok(/Heimweg starten/.test(await p.locator('#btn-main').innerText()), 'Nach dem Schatz: Hauptknopf „Heimweg starten“');
  ok(await ohne.isVisible(), "Darunter klein: „Ohne Heimweg beenden“");
  await ohne.click(); await p.waitForTimeout(400);
  ok(await p.evaluate(()=>__zs.state().phase==='heim' && __zs.state().step===1) && await p.locator('#abschluss').isVisible(), 'Tippen: direkt „Zu Hause!“ mit Abschlusskarte');
  ok(await ohne.isHidden(), 'Knopf danach weg');

  ok(!pf.length, 'Keine Seitenfehler'+(pf.length?': '+pf.join(' | '):''));
  await b.close(); console.log(fehler?fehler+' FEHLER':'ALLES OK'); process.exit(fehler?1:0);
})();
