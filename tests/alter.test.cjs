// Alter ohne Grenze (UNICORN-52): jedes Alter lässt sich im Assistenten eintragen, ohne Hinweis oder Fehlermeldung
const { chromium } = require('playwright');
const B=process.env.BASIS||'http://localhost:8765/app/';
let fehler=0; const ok=(b,t)=>{ console.log((b?'ok   ':'FEHL ')+t); if(!b) fehler++; };
(async()=>{
  const b=await chromium.launch(), c=await b.newContext({viewport:{width:393,height:852}});
  await c.addInitScript(()=>{ window.KONTO_TEST={url:'',key:''}; });
  await c.route(/^https?:\/\/(?!localhost)/, r=>r.abort());
  const p=await c.newPage(); const pf=[]; p.on('pageerror', e=>pf.push(e.message));
  const datum=new Date(Date.now()+10*864e5).toISOString().slice(0,10);
  for(const alter of ['1','99']){
    await p.goto(B+'party.html?thema=einhorn'); await p.evaluate(()=>{ localStorage.clear(); sessionStorage.clear(); localStorage.setItem('sj.plan.einhorn', JSON.stringify({format:1,thema:'einhorn',variante:'c',kinder:7,stationen:[],strecke:0})); }); await p.reload(); await p.waitForSelector('#name');
    ok(await p.locator('#alter').evaluate(e=>!e.hasAttribute('min') && !e.hasAttribute('max')), 'Feld „Wird“ ohne Unter- und Obergrenze');
    await p.fill('#name','Mia'); await p.fill('#alter',alter); await p.fill('#datum',datum);
    await p.click('#weiter'); await p.waitForTimeout(400);
    ok(await p.locator('#alter').count()===0, 'Alter '+alter+': Assistent geht weiter');
    ok(!/zwischen/.test(await p.locator('body').innerText()), 'Alter '+alter+': kein Hinweis zur Altersgrenze');
    const e=await p.evaluate(()=>{ try{ return JSON.parse(sessionStorage.getItem(Object.keys(sessionStorage).filter(k=>/entwurf|party/i.test(k))[0])||'null'); }catch(x){ return null; } });
    if(e && e.kind) ok(e.kind.alter===+alter, 'Alter '+alter+' gespeichert');
  }
  // leeres Feld fragt weiter nach dem Alter
  await p.goto(B+'party.html?thema=einhorn'); await p.evaluate(()=>{ localStorage.clear(); sessionStorage.clear(); localStorage.setItem('sj.plan.einhorn', JSON.stringify({format:1,thema:'einhorn',variante:'c',kinder:7,stationen:[],strecke:0})); }); await p.reload(); await p.waitForSelector('#name');
  await p.fill('#name','Mia'); await p.fill('#datum',datum); await p.click('#weiter'); await p.waitForTimeout(300);
  ok(await p.locator('#alter').count()===1 && /Alter eingeben/.test(await p.locator('body').innerText()), 'Ohne Alter: „Bitte das Alter eingeben.“');
  ok(pf.length===0, 'keine JS-Fehler '+pf.join(' | '));
  await b.close(); console.log(fehler?fehler+' Fehler':'Alles grün'); process.exit(fehler?1:0);
})();
