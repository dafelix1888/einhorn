// Quatschbilder (UNICORN-127): alle vier Bilder gleich sichtbar, kein Durchklicken, Text passt dazu.
const { chromium } = require('playwright');
const S='http://localhost:8765';
let fehler=0; const ok=(b,t)=>{ console.log((b?'ok   ':'FEHL ')+t); if(!b) fehler++; };
(async()=>{
  const b=await chromium.launch(), c=await b.newContext({viewport:{width:393,height:852}, deviceScaleFactor:2});
  await c.addInitScript(()=>{ window.KONTO_TEST={url:'',key:''}; });
  await c.route(/^https?:\/\/(?!localhost)/, r=>r.abort());
  const p=await c.newPage(); const pf=[]; p.on('pageerror',e=>pf.push(e.message)); await p.goto(S+'/app/');
  await p.evaluate(()=>{ localStorage.clear(); const st=[0,1,2,3,4,5,6].map(i=>({lat:53.55+i*0.001,lng:10,name:'O'}));
    localStorage.setItem('sj.plan.einhorn', JSON.stringify({format:1,thema:'einhorn',variante:'a',kinder:6,stationen:st,strecke:900}));
    localStorage.setItem('sj.einhorn.v1', JSON.stringify({points:st.map(s=>({lat:s.lat,lng:s.lng})), idx:3, phase:'scene', step:0, radius:15, showTest:true, autoSag:false, variante:'a', erz:'kakapups'})); });
  await p.goto(S+'/app/spiel.html?thema=einhorn'); await p.waitForTimeout(1200);
  ok(await p.locator('#choices .choice').count()===4 && await p.locator('#choices .choice').first().isVisible(), 'Alle vier Bilder gleich da');
  const mt=(await p.textContent('#btn-main')||'').trim();
  ok(!/Nächstes Bild|Alle vier gesehen/.test(mt) && !(await p.locator('#btn-main').isVisible() && mt), 'Kein Durchklicken ('+(mt||'kein Hauptknopf')+')');
  const txt=await p.textContent('#scene-text, .scene-text, #text').catch(()=>'');
  const t=await p.evaluate(()=>document.body.innerText);
  ok(!/eins nach dem anderen|langsam weiter|Bild für Bild/.test(t), 'Text spricht nicht mehr vom Durchklicken oder Weiterlaufen');
  ok(/vier Quatschbilder/.test(t) && /Ruft bei jedem/.test(t), 'Text: vier Quatschbilder, bei jedem rufen');
  await p.screenshot({path:'/tmp/quatsch.png'});
  await p.click('#choices .choice[data-id="sonne"]'); await p.waitForTimeout(500);
  ok(await p.evaluate(()=>__zs.state().step===1), 'Sonne antippen löst die Station');
  ok(!pf.length, 'Keine Seitenfehler'+(pf.length?': '+pf.join(' | '):''));
  await b.close(); console.log(fehler?fehler+' FEHLER':'ALLES OK'); process.exit(fehler?1:0);
})();
