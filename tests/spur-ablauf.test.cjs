// „Wer war das?“ (UNICORN-125): je Knopfdruck, wer was sagt. Erzähler je Schritt nur einmal, Malen und Vergleich nur Funkel.
const { chromium } = require('playwright');
const S='http://localhost:8765';
let fehler=0; const ok=(b,t)=>{ console.log((b?'ok   ':'FEHL ')+t); if(!b) fehler++; };
(async()=>{
  const b=await chromium.launch();
  for(const ind of [false, true]){
    const c=await b.newContext({viewport:{width:393,height:852}});
    await c.addInitScript(()=>{ window.KONTO_TEST={url:'',key:''}; });
    await c.route(/^https?:\/\/(?!localhost)/, r=>r.abort());
    const p=await c.newPage(); const pf=[]; p.on('pageerror',e=>pf.push(e.message)); await p.goto(S+'/app/');
    await p.evaluate((ind)=>{ localStorage.clear(); const st=[0,1,2,3,4,5,6].map(i=>({lat:53.55+i*0.001,lng:10,name:'O'}));
      localStorage.setItem('sj.plan.einhorn', JSON.stringify({format:1,thema:'einhorn',variante:ind?'c':'a',kinder:6,stationen:st,strecke:900}));
      localStorage.setItem('sj.einhorn.v1', JSON.stringify({points:st.map(s=>({lat:s.lat,lng:s.lng})), idx:4, phase:'scene', step:0, radius:15, showTest:true, autoSag:true, variante:ind?'c':'a', erz:'dagobert', startZeit:Date.now()})); }, ind);
    await p.goto(S+'/app/spiel.html?thema=einhorn'+(ind?'&ort=drinnen':'')); await p.waitForTimeout(1000);
    await p.evaluate(()=>{ window.LOG=[]; window.__hoer=function(w,k,t){ LOG.push({w:w,k:k,t:t}); return true; }; });
    const tipp=async sel=>{ await p.evaluate(()=>LOG.length=0); await p.click(sel); await p.waitForTimeout(2200); return p.evaluate(()=>LOG.slice()); };
    const E=l=>l.filter(x=>x.w==='Erzähler'), wo=ind?'Drinnen':'Draußen';
    let l=await tipp('#btn-speak');
    ok(l[0].k==='s4.frage' && E(l).length===1 && !/malen|antippen|Tafel|Karte/.test(E(l)[0].t), wo+': Ankunft: Funkel, dann einmal Erzähler, ohne Malen vorwegzunehmen');
    l=await tipp('#btn-speak');
    ok(l.length===1 && l[0].w==='Funkel', wo+': Nochmal anhören wiederholt nur Funkel');
    await tipp('#btn-main'); await p.waitForTimeout(5200);   // Spur zeigen, 5 s, Nebel
    l=await p.evaluate(()=>LOG.slice());
    ok(l.length===1 && l[0].w==='Funkel' && /Nebel/.test(l[0].t), wo+': Nebel: nur Funkel ('+l.map(x=>x.k).join(', ')+')');
    if(!ind){
      l=await tipp('#btn-main');   // Fertig gemalt
      ok(l.length===1 && l[0].k==='s4.vergleich', wo+': „Fertig gemalt“: nur Funkel, kein Erzähler');
    }
    l=await tipp('#choices .choice[data-id="fuchs"]');
    ok(l[0].w==='Funkel' && /Fuchs/.test(l[0].t) && E(l).length===1, wo+': Fuchs: Funkel, dann einmal Erzähler');
    ok(await p.locator('#btn-aufgabe').isVisible(), wo+': Erzähler-Knopf bleibt zum Nachhören');
    ok(!pf.length, wo+': keine Seitenfehler'+(pf.length?': '+pf.join(' | '):''));
    await c.close();
  }
  await b.close(); console.log(fehler?fehler+' FEHLER':'ALLES OK'); process.exit(fehler?1:0);
})();
