// Bis zu 30 Kinder (UNICORN-120): Zähler im Assistenten, Mengen und Packungen im Material, Hinweis zu Erwachsenen.
// Dazu (UNICORN-121): schwebender Regenbogen im Stil der Party-Übersicht, „Angekommen!“ mit Stationsnummer.
const { chromium } = require('playwright');
const fs=require('fs'), path=require('path');
const S='http://localhost:8765';
let fehler=0; const ok=(b,t)=>{ console.log((b?'ok   ':'FEHL ')+t); if(!b) fehler++; };
(async()=>{
  const tour=JSON.parse(fs.readFileSync(path.join(__dirname,'..','app/themen/einhorn/tour.json'),'utf8'));
  ok(tour.kinder.min===3 && tour.kinder.max===30, 'tour.json: 3 bis 30 Kinder');
  const b=await chromium.launch(), c=await b.newContext({viewport:{width:393,height:852}});
  await c.addInitScript(()=>{ window.KONTO_TEST={url:'',key:''}; });
  await c.route(/^https?:\/\/(?!localhost)/, r=>r.abort());
  const p=await c.newPage(); const pf=[]; p.on('pageerror', e=>pf.push(e.message));
  await p.goto(S+'/app/');
  // Mengen und Packungen
  const ek=await p.evaluate(t=>{ const r={}; [12,13,30].forEach(k=>{ r[k]=Party.einkauf({kinder:k, ort:'draussen', ausdrucke:true}, t).map(x=>({id:x.id, n:x.menge, pk:x.packungen, pa:x.packung, s:x.summe})); }); return r; }, tour);
  const je=tour.utensilien.filter(u=>u.menge==='je Kind').map(u=>u.id);
  const falsch=[]; [12,13,30].forEach(k=>ek[k].forEach(x=>{ if(je.indexOf(x.id)>=0){ if(x.n!==k) falsch.push(k+':'+x.id+' Menge '+x.n); if(x.pa && x.pk!==Math.ceil(k/x.pa)) falsch.push(k+':'+x.id+' Packungen '+x.pk); } }));
  ok(!falsch.length, 'Je-Kind-Artikel: Menge = Kinderzahl, Packungen aufgerundet (12, 13, 30)'+(falsch.length?': '+falsch.join(', '):''));
  const haar=ek[30].find(x=>x.id==='u0'); ok(haar.n===30 && haar.pk===3, 'Haarreifen für 30 Kinder: 3 Packungen à 12');
  const seil=k=>ek[k].find(x=>x.id==='u9').n; ok(seil(12)===1 && seil(30)===2, 'Seil: eins bis 15 Kinder, ab 16 zwei');
  ok(ek[30].reduce((t,x)=>t+(x.s||0),0) > ek[12].reduce((t,x)=>t+(x.s||0),0), 'Summe für 30 Kinder höher als für 12');
  // Assistent: bis 30 hochzählen, Hinweis zu Erwachsenen
  await p.evaluate(()=>{ localStorage.clear(); localStorage.setItem('sj.plan.einhorn', JSON.stringify({format:1,thema:'einhorn',variante:'a',kinder:10,stationen:[0,1,2,3,4,5,6].map(i=>({lat:53.55+i*0.001,lng:10,name:'Ort '+i}))})); });
  await p.goto(S+'/app/party.html?thema=einhorn'); await p.waitForSelector('#name');
  await p.fill('#name','Mia'); await p.fill('#alter','5'); await p.fill('#datum','2030-06-01'); await p.click('#weiter'); await p.waitForSelector('[data-z="kinder"]');
  for(let i=0;i<25;i++) await p.click('[data-z="kinder"][data-d="1"]');
  const zahl=await p.locator('.zaehlzeile').first().innerText();
  ok(/\b30\b/.test(zahl) && !/\b31\b/.test(zahl), 'Assistent zählt bis 30, nicht weiter');
  ok(/mehr als 15 Kindern nehmt lieber drei oder mehr Erwachsene/.test(await p.locator('#seite').innerText()), 'Hinweis: bei mehr als 15 Kindern mehr Erwachsene');
  // UNICORN-121: Stil im Quelltext
  const sp=fs.readFileSync(path.join(__dirname,'..','app/spiel.html'),'utf8');
  ok(/#bogen-wrap\.schwebt \.arc\{stroke:var\(--c\);opacity:\.16/.test(sp) && /schweb-text/.test(sp), 'Schwebender Regenbogen: Farben wie in der Party-Übersicht, mit Satz');
  ok(/id="pop-nr"/.test(sp) && /pop-stern/.test(sp) && /prefers-reduced-motion:reduce\)\{ \.pop-karte/.test(sp), '„Angekommen!“ mit Stationsnummer, Stern, ohne Bewegung bei reduzierter Bewegung');
  ok(!pf.length, 'Keine Seitenfehler'+(pf.length?': '+pf.join(' | '):''));
  await b.close(); process.exit(fehler?1:0);
})();
