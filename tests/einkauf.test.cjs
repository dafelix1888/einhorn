// Kauflinks mit Rangfolge (UNICORN-11): erster verfügbarer Artikel gewinnt, kein Hinweis auf Rang, kein toter Link.
const { chromium } = require('playwright');
const fs=require('fs'), path=require('path'), vm=require('vm');
const B=(process.env.BASIS||'http://localhost:8765')+'/app/';
let fehler=0; const ok=(c,t)=>{ console.log((c?'ok   ':'FEHLER ')+t); if(!c) fehler++; };

// party.js ohne Browser laden
const ctx={localStorage:{getItem:()=>null,setItem:()=>{}}}; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname,'..','app','party.js'),'utf8'), ctx);
const P=ctx.Party;
const R1={asin:'AAAAAAAAA1', link:'https://www.amazon.de/dp/AAAAAAAAA1', packung:1, preis:12.99};
const R2={asin:'BBBBBBBBB2', link:'https://www.amazon.de/dp/BBBBBBBBB2', packung:1, preis:8.69};
const R3={asin:'CCCCCCCCC3', packung:2, preis:5};
const tour=u=>({utensilien:[{id:'r', name:'Holz-Regenbogen', menge:1, wann:'Stationen', ...u}]});
const ek=u=>P.einkauf({kinder:6, einkauf:{}}, tour(u))[0];

let x=ek({artikel:[R1,R2]});
ok(x.asin===R1.asin && x.link===R1.link && x.preis===12.99 && x.lieferbar, 'Rang 1 erreichbar: Rang 1 wird gezeigt');
x=ek({artikel:[{...R1, verfuegbar:false}, R2]});
ok(x.asin===R2.asin && x.link===R2.link && x.preis===8.69 && x.summe===8.69 && x.lieferbar, 'Rang 1 nicht erreichbar: Rang 2 mit eigenem Preis');
x=ek({artikel:[{...R1, verfuegbar:false}, {...R2, verfuegbar:false}, R3]});
ok(x.asin===R3.asin && x.link==='https://www.amazon.de/dp/'+R3.asin && x.packungen===1, 'Rang 3 ohne eigenen Link: Link aus der Artikelnummer');
x=ek({artikel:[{...R1, verfuegbar:false}, {...R2, verfuegbar:false}]});
ok(!x.link && !x.asin && !x.lieferbar && x.name==='Holz-Regenbogen', 'alle nicht erreichbar: Utensil bleibt, ohne Kauflink');
x=ek({asin:R1.asin, link:R1.link, packung:1, preis:12.99});
ok(x.asin===R1.asin && x.link===R1.link && x.lieferbar, 'alte Form mit einem Link funktioniert weiter');
x=ek({zuHause:true});
ok(!x.link && x.zuHause, 'Utensil ohne Artikel (zu Hause) unverändert');
x=ek({artikel:[{...R1, verfuegbar:false}, {...R2, name:'Regenbogen aus Holz, 7 Bögen'}]});
ok(x.name==='Regenbogen aus Holz, 7 Bögen', 'Name passt zum gezeigten Artikel, wenn einer hinterlegt ist');
const korb=P.warenkorbLink(P.einkauf({kinder:6, einkauf:{}}, tour({artikel:[{...R1, verfuegbar:false}, R2]})));
ok(/ASIN\.1=BBBBBBBBB2/.test(korb) && !/AAAAAAAAA1/.test(korb), 'Warenkorb nimmt den gezeigten Artikel');

// Echte Tour-Daten: Regenbogen hat eine Liste, alle Artikel mit Artikelnummer und Link
const echt=JSON.parse(fs.readFileSync(path.join(__dirname,'..','app','themen','einhorn','tour.json'),'utf8'));
const rb=echt.utensilien.find(u=>/Regenbogen/.test(u.name));
ok(Array.isArray(rb.artikel) && rb.artikel.length>=2 && rb.artikel.every(a=>/^[A-Z0-9]{10}$/.test(a.asin)), 'Tour: Regenbogen mit Rangfolge ('+rb.artikel.length+' Artikel)');

// Anzeige: kein Wort, das den Rang verrät
(async()=>{
  const b=await chromium.launch(), c=await b.newContext({viewport:{width:393,height:852}});
  await c.route(/^https?:\/\/(?!localhost)/, r=>r.abort());
  const p=await c.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(B+'party.html?thema=einhorn');
  await p.evaluate(()=>localStorage.setItem('sj.party.einhorn', JSON.stringify({format:1,thema:'einhorn',kind:{name:'Mia',alter:5},datum:'2030-06-01',start:'15:00',kinder:6,helfer:2,vorausgeher:true,ort:'draussen',planB:true,ausdrucke:true,erledigt:{},einkauf:{}})));
  // Rang 1 als nicht verfügbar markieren (wie es Felix in den Daten tun würde)
  await c.route(/themen\/einhorn\/tour\.json/, async r=>{ const res=await r.fetch(); const t=await res.json(); const u=t.utensilien.find(u=>/Regenbogen/.test(u.name)); u.artikel[0].verfuegbar=false; r.fulfill({response:res, json:t}); });
  await p.goto(B+'party.html?thema=einhorn#einkauf'); await p.reload(); await p.waitForSelector('#einkauf .ding', {timeout:15000});   // Liste steckt im Schritt „Bestellen“
  const html=await p.content();
  ok(html.includes('dp/'+rb.artikel[1].asin) && !html.includes('dp/'+rb.artikel[0].asin), 'Einkaufsliste zeigt den Link von Rang 2');
  const text=await p.locator('body').innerText();
  ok(!/Ersatz|Alternative|Rang|Priorität|nicht verfügbar/i.test(text), 'kein Hinweis auf Rang oder Ersatz');
  ok(errs.length===0, 'keine Seitenfehler '+errs.join(' | '));
  console.log(fehler?fehler+' FEHLER':'ALLES OK'); await b.close(); process.exit(fehler?1:0);
})();
