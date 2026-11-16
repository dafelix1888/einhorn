// Wolke ohne Ausdruck (UNICORN-41): nichts mehr zu drucken, die Wolke schläft nur im Spiegel.
const { chromium } = require('playwright');
const fs=require('fs'), path=require('path');
const B=(process.env.BASIS||'http://localhost:8765')+'/app/';
let fehler=0; const ok=(c,t)=>{ console.log((c?'ok   ':'FEHLER ')+t); if(!c) fehler++; };
const lies=n=>fs.readFileSync(path.join(__dirname,'..','app',n),'utf8');
const PARTY={format:1,thema:'einhorn',kind:{name:'Mia',alter:5},datum:'2030-06-01',start:'15:00',kinder:6,helfer:2,vorausgeher:true,ort:'draussen',planB:true,ausdrucke:true,erledigt:{},einkauf:{}};

(async()=>{
  ok(!/\bA3\b|Wolke/.test(lies('druck.html')), 'Druckseite: keine Wolke, kein A3 im Quelltext');
  ok(!/\bA3\b/.test(lies('party.html')+lies('party.js')), 'Einrichtung und Checkliste: kein A3');
  const tour=JSON.parse(lies('themen/einhorn/tour.json'));
  ok(!/\bA3\b|Wolken-Ausdruck/.test(JSON.stringify(tour)), 'Tour-Datei: kein Wolken-Ausdruck in den Listen');

  const b=await chromium.launch(), p=await b.newPage({viewport:{width:820,height:1180}});
  const fehlerSeite=[]; p.on('pageerror',e=>fehlerSeite.push(e.message));
  await p.goto(B+'party.html?thema=einhorn');
  await p.evaluate(x=>localStorage.setItem('sj.party.einhorn', JSON.stringify(x)), PARTY);
  await p.goto(B+'druck.html?thema=einhorn'); await p.waitForSelector('#auswahl label');
  ok(await p.locator('#auswahl label').count()===2 && !/Wolke/.test(await p.locator('body').innerText()), 'Druckseite zeigt nur Einladungen und Urkunden');

  for(const v of ['a','b','c']){
    await p.goto(B+'spiel.html?thema=einhorn'); await p.waitForFunction(()=>window.__zs);
    await p.evaluate(v=>{ const s=__zs.state(); s.variante=v; s.phase='scene'; s.idx=5; s.step=0; localStorage.setItem('sj.einhorn.v1', JSON.stringify(s)); }, v);
    await p.reload(); await p.waitForFunction(()=>window.__zs && document.querySelector('#mirror-pic .pic'));
    ok(await p.locator('#mirror-pic svg.deko-wolke').count()===1 && await p.locator('#mirror-pic .pic').count()===1, 'Variante '+v+': Am Wolkenberg schläft die Wolke im Spiegel');
  }
  await p.evaluate(()=>{ const s=__zs.state(); s.idx=4; s.step=0; localStorage.setItem('sj.einhorn.v1', JSON.stringify(s)); });
  await p.reload(); await p.waitForFunction(()=>window.__zs);
  ok(await p.locator('#mirror-pic svg.deko-wolke').count()===0, 'Andere Station: keine Wolke');
  ok(!fehlerSeite.length, 'Keine Fehler auf den Seiten'+(fehlerSeite.length?': '+fehlerSeite[0]:''));
  await b.close();
  console.log(fehler?fehler+' FEHLER':'ALLES OK'); process.exit(fehler?1:0);
})();
