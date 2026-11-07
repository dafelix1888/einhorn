// Rauchtest: Jede Seite lädt ohne JavaScript-Fehler, ohne Anfragen an Google und mit Rechtslinks.
// Fremde Server werden blockiert, damit der Test ohne Netz und ohne echte Dienste läuft.
const { chromium } = require('playwright');
const B=(process.env.BASIS||'http://localhost:8765')+'/app/';
const SEITEN=[
  ['index.html', {recht:true}], ['index.html#/abenteuer/einhorn', {recht:true}], ['party.html?thema=einhorn', {recht:true}],
  ['planer.html?thema=einhorn', {}], ['spiel.html?thema=einhorn', {warte:2500}], ['einladung.html', {recht:true}],
  ['danke.html', {recht:true}], ['bereit.html?thema=einhorn', {recht:true}], ['vorausgeher.html?thema=einhorn', {recht:true}],
  ['druck.html?thema=einhorn', {}], ['impressum.html', {}], ['datenschutz.html', {}], ['landing.html', {}], ['landing.html?v=b', {}],
];
let f=0; const ok=(c,t)=>{ console.log((c?'ok   ':'FEHLER ')+t); if(!c) f++; };
(async()=>{
  const b=await chromium.launch();
  for(const [pfad, opt] of SEITEN){
    const c=await b.newContext({viewport:{width:393,height:852}});
    await c.addInitScript(()=>{ window.KONTO_TEST={url:'',key:''}; });
    const fremd=[]; await c.route(u=>!/^https?:\/\/(localhost|127\.0\.0\.1)/.test(u.toString()) && !/^(data|blob):/.test(u.toString()), r=>{ fremd.push(r.request().url()); r.abort(); });
    const p=await c.newPage(), errs=[];
    p.on('pageerror', e=>errs.push(e.message));
    const antwort=await p.goto(B+pfad); await p.waitForTimeout(opt.warte||900);
    ok(antwort && antwort.ok(), pfad+': lädt');
    ok(errs.length===0, pfad+': keine JS-Fehler '+(errs.length?JSON.stringify(errs.slice(0,2)):''));
    ok(!fremd.some(u=>/googleapis|gstatic/.test(u)), pfad+': keine Google-Fonts');
    if(opt.recht) ok(await p.locator('#recht-fuss a[href="impressum.html"]').count()===1, pfad+': Impressum-Link');
    await c.close();
  }
  console.log(f?f+' FEHLER':'ALLES OK'); await b.close(); process.exit(f?1:0);
})();
