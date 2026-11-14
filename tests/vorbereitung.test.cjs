// Vorbereitung: nur das Nötige zählt, jeweils mit Notlösung; Extras und Packliste aufklappbar
const { chromium } = require('playwright');
const S='http://localhost:8765';
let fehler=0; const ok=(b,t)=>{ console.log((b?'ok   ':'FEHL ')+t); if(!b) fehler++; };
(async()=>{
  const b=await chromium.launch(), c=await b.newContext({viewport:{width:393,height:852}});
  await c.addInitScript(()=>{ window.KONTO_TEST={url:'',key:''}; });
  await c.route(/^https?:\/\/(?!localhost)/, r=>r.abort());
  const p=await c.newPage(); const pf=[]; p.on('pageerror', e=>pf.push(e.message));
  await p.goto(S+'/app/'); await p.evaluate(()=>localStorage.clear());
  await p.goto(S+'/app/spiel.html?thema=einhorn#einrichten'); await p.waitForSelector('#liste .haken', {state:'attached'});
  await p.evaluate(()=>{ document.getElementById('k-vorbereitung').open=true; document.getElementById('k-vorbereitung').scrollIntoView(); }); await p.waitForTimeout(200);
  const n=await p.locator('#liste > .haken').count(), notfalls=await p.locator('#liste > .haken .notfalls').count();
  ok(n>=8 && n<=12, 'Oben nur das Nötige: '+n+' Dinge statt 28');
  ok(notfalls===n, 'Jedes nötige Ding hat eine Notlösung');
  ok(/Das braucht die Tour wirklich/.test(await p.locator('#liste').innerText()), 'Überschrift „Das braucht die Tour wirklich“');
  ok(await p.locator('#vb-extras').count()===1 && !(await p.locator('#vb-extras').evaluate(e=>e.open)), 'Extras zugeklappt');
  ok(await p.locator('#vb-packen').count()===1 && /Vorausgeher-Tasche/.test(await p.locator('#vb-packen').innerHTML()), 'Packliste für den Tag (mit Vorausgeher-Tasche) zugeklappt');
  ok(new RegExp('0 von '+n+' nötigen').test(await p.locator('#liste-note').innerText()), 'Zähler zählt nur die nötigen');
  await p.evaluate(()=>{ const d=document.getElementById('vb-extras'); d.open=true; });
  await p.locator('#vb-extras input').first().check({force:true}); await p.waitForTimeout(150);
  ok(new RegExp('0 von '+n+' nötigen').test(await p.locator('#liste-note').innerText()) && await p.locator('#vb-extras').evaluate(e=>e.open), 'Extra abhaken ändert den Zähler nicht, Extras bleiben offen');
  await p.locator('#liste > .haken input').first().check({force:true}); await p.waitForTimeout(150);
  ok(new RegExp('1 von '+n+' nötigen').test(await p.locator('#liste-note').innerText()), 'Nötiges abhaken zählt');
  ok(!/funkel-stimme\.json/.test(await p.locator('#liste').innerHTML()), 'Kein Entwickler-Text mehr in der Liste');
  ok(!pf.length, 'Keine Seitenfehler'+(pf.length?': '+pf.join(' | '):''));
  await b.close(); console.log(fehler?fehler+' FEHLER':'ALLES OK'); process.exit(fehler?1:0);
})();
