// Party-Übersicht als geführter Plan: alle Schritte auf einen Blick, einer offen mit allem, was er braucht
const {chromium}=require('/opt/npm-tools/node_modules/playwright');
const B=process.env.BASIS||'http://localhost:8765/app/';
let fehler=0; function ok(b, t){ console.log((b?'OK   ':'FEHLER ')+t); if(!b) fehler++; }
(async()=>{
  const b=await chromium.launch(), c=await b.newContext({viewport:{width:393,height:852}});
  await c.route(/^https?:\/\/(?!localhost)/, r=>r.abort());
  const p=await c.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  const d=new Date(Date.now()+12*864e5).toISOString().slice(0,10);
  await p.goto(B+'party.html?thema=einhorn');
  await p.evaluate(d=>{ localStorage.clear(); localStorage.setItem('sj.party.einhorn', JSON.stringify({format:1,thema:'einhorn',kind:{name:'Mia',alter:5},datum:d,start:'15:00',kinder:6,helfer:2,vorausgeher:true,ort:'draussen',planB:true,ausdrucke:true,erledigt:{},einkauf:{}}));
    localStorage.setItem('sj.plan.einhorn', JSON.stringify({format:1,thema:'einhorn',variante:'a',kinder:6,adresse:'Teststraße 1',strecke:1200,stationen:[{lat:53.5,lng:9.9,name:'Haustür'},{lat:53.501,lng:9.901,name:'Ecke'}]})); }, d);
  await p.reload(); await p.waitForSelector('.ueberblick');
  ok(await p.locator('.plan>li').count()===6, 'Überblick zeigt alle 6 Schritte');
  ok(await p.locator('.plan>li.auf').count()===1 && await p.locator('#einladung.auf').count()===1, 'Nur der nächste Schritt (Einladen) ist offen');
  ok(await p.locator('#gast-link').isVisible() && await p.locator('#gh').isVisible() && await p.locator('#ansehen').isVisible(), 'Einladen: Link, Hinweisfeld und Vorschau im Schritt');
  ok(/Gast-Eltern/.test(await p.locator('#einladung .werkzeug').first().innerText()), 'Einladungslink ist erklärt');
  // Erledigt → nächster Schritt öffnet sich, Einkaufsliste steckt darin
  await p.click('[data-fertig="einladen"]'); await p.waitForTimeout(200);
  ok(await p.locator('#einkauf.auf').count()===1 && await p.locator('#einkauf .ding').count()>3, 'Erledigt öffnet „Bestellen“ mit der Einkaufsliste');
  ok(/#einkauf$/.test(p.url()), 'Adresse zeigt den offenen Schritt');
  ok(await p.locator('#einladung .punkt.ok').count()===1, 'Einladen ist abgehakt');
  // Springen ohne Überblick zu verlieren
  await p.click('[data-oeffne="partytag"]'); await p.waitForTimeout(200);
  ok(await p.locator('.plan>li.auf').count()===1 && await p.locator('#s-partytag.auf').count()===1, 'Tipp auf Partytag öffnet nur diesen Schritt');
  ok(await p.locator('#vg-link').isVisible() && /losgeht/.test(await p.locator('#s-partytag .werkzeug').first().innerText()), 'Vorausgeher-Link im Partytag, mit Erklärung');
  ok(await p.locator('#umschalten').isVisible(), 'Plan B im Partytag');
  await p.click('#s-partytag [data-oeffne="geraet"]'); await p.waitForTimeout(200);
  ok(await p.locator('#s-geraet.auf').count()===1 && await p.locator('#teilen').isVisible() && /Gerät, mit dem die Kinder spielen/.test(await p.locator('#s-geraet').innerText()), '„← Zurück“ blättert zum iPad-Schritt, iPad-Link erklärt');
  await p.click('[data-oeffne="geraet"].oeffnen'); await p.waitForTimeout(200);
  ok(await p.locator('.plan>li.auf').count()===0, 'Nochmal tippen klappt zu');
  // Direktlink auf die Einkaufsliste
  await p.goto(B+'party.html?thema=einhorn#s-route'); await p.reload(); await p.waitForSelector('.ueberblick');
  ok(await p.locator('#s-route.auf .route-karte').count()===1, 'Adresse #s-route öffnet die Route mit Karte');
  ok(await p.locator('.werkzeuge').count()===0 && await p.locator('#kalender').isVisible(), 'Keine lose Knopfsammlung mehr, Kalender im Überblick');
  ok(errs.length===0, 'keine Seitenfehler '+errs.join(' | '));
  console.log(fehler?fehler+' FEHLER':'ALLES OK'); await b.close(); process.exit(fehler?1:0);
})();
