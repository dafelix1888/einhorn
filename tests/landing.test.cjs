// Landingpage „Schatzweg“ von Marketer (UNICORN-22): Varianten, Screenshots, sechs Erzähler-Stimmen, Rechtslinks, Funkel.
const { chromium } = require('playwright');
const B=''+(process.env.BASIS||'http://localhost:8765')+'/app/';
let fehler=0; const ok=(c,t)=>{ console.log((c?'ok   ':'FEHLER ')+t); if(!c) fehler++; };
(async()=>{
  const b=await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']}), errs=[];
  const c=await b.newContext({viewport:{width:393,height:852}});
  await c.route('https://efdjomgubucdnvgtuqmp.supabase.co/**', r=>r.abort());
  await c.addInitScript(()=>{ window.__ev=[]; window.marketer={track:(n,p)=>window.__ev.push([n,p||{}])}; HTMLMediaElement.prototype.play=function(){ Object.defineProperty(this,'paused',{value:false,configurable:true}); return Promise.resolve(); }; });
  const p=await c.newPage(); p.on('pageerror',e=>errs.push(e.message));
  const html=await (await p.request.get(B+'landing.html')).text();
  const pfade=[...new Set(html.match(/landing\/[a-z0-9\/_.-]+/g)||[])];
  ok(pfade.filter(x=>x.endsWith('.webp')).length===3 && pfade.filter(x=>x.endsWith('.mp3')).length===6, 'Seite verweist auf 3 Screenshots und 6 Stimmen');
  for(const x of pfade){ const r=await p.request.get(B+x); ok(r.status()===200 && (await r.body()).length>1000, x+' wird geliefert'); }
  for(const v of ['a','b']){
    await p.goto(B+'landing.html?v='+v); await p.waitForTimeout(500);
    ok(await p.locator('main:not([hidden])').count()===1, 'Variante '+v+' sichtbar');
  }
  ok(await p.locator('main:not([hidden]) .funkel-buehne').count()===1, 'Funkel steht über der Hörprobe');
  ok(await p.locator('footer a[href="impressum.html"]').count()===1 && await p.locator('footer a[href="datenschutz.html"]').count()===1, 'Impressum und Datenschutz unten');
  ok(/Schatzweg/.test(await p.title()+await p.locator('body').innerText()), 'Name Schatzweg auf der Seite');
  const st=p.locator('main:not([hidden]) [data-figur]').first();
  const figur=await st.getAttribute('data-figur'); await st.scrollIntoViewIfNeeded(); await st.click(); await p.waitForTimeout(200);
  ok((await p.evaluate(()=>__ev)).some(e=>e[0]==='hoerprobe_played' && e[1].figur), 'Erzähler-Stimme meldet hoerprobe_played mit Figur ('+figur+')');
  ok(errs.length===0, 'keine Seitenfehler '+errs.join(' | '));
  console.log(fehler?fehler+' FEHLER':'ALLES OK'); await b.close(); process.exit(fehler?1:0);
})();
