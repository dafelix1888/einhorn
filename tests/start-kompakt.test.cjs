// Startseite ohne Party (UNICORN-128): das eine Abenteuer kompakt, „Bald auf Schatzweg“ schon auf dem ersten Bildschirm.
const { chromium } = require('playwright');
let fehler=0; const ok=(b,t)=>{ console.log((b?'ok   ':'FEHL ')+t); if(!b) fehler++; };
(async()=>{ const b=await chromium.launch(), c=await b.newContext({viewport:{width:393,height:852}});
  await c.addInitScript(()=>{ window.KONTO_TEST={url:'',key:''}; });
  await c.route(/^https?:\/\/(?!localhost)/, r=>r.abort());
  const p=await c.newPage(); const pf=[]; p.on('pageerror',e=>pf.push(e.message));
  await p.goto('http://localhost:8765/app/'); await p.evaluate(()=>localStorage.clear()); await p.reload(); await p.waitForSelector('.buehne');
  ok(/Jetzt spielbar/.test(await p.textContent('.start-k')) && /erstes Abenteuer/.test(await p.textContent('.start-k')), 'Überschrift „Jetzt spielbar · unser erstes Abenteuer“');
  const k=await p.locator('.buehne').boundingBox();
  ok(k.height<300, 'Karte kompakt ('+Math.round(k.height)+' px hoch)');
  const bald=await p.locator('.reihe-bald h2', {hasText:'Bald auf Schatzweg'}).boundingBox();
  ok(bald && bald.y<852, '„Bald auf Schatzweg“ schon auf dem ersten Bildschirm (y='+Math.round(bald&&bald.y)+')');
  ok(await p.locator('.buehne a.voll').isVisible() && await p.locator('.buehne .probeknopf').isVisible(), '„Party planen“ und Hörprobe bleiben');
  ok(!pf.length, 'Keine Seitenfehler'+(pf.length?': '+pf.join(' | '):''));
  await b.close(); console.log(fehler?fehler+' FEHLER':'ALLES OK'); process.exit(fehler?1:0); })();
