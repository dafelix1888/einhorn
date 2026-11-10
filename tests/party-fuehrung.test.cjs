// Party-Übersicht (UNICORN-27): Überblick mit Regenbogen und Weg, jeder Schritt als eigene Ansicht mit allem, was er braucht
const {chromium}=require('/opt/npm-tools/node_modules/playwright');
const B=process.env.BASIS||'http://localhost:8765/app/';
let fehler=0; function ok(b, t){ console.log((b?'OK   ':'FEHLER ')+t); if(!b) fehler++; }
(async()=>{
  const b=await chromium.launch(), c=await b.newContext({viewport:{width:393,height:852}});
  await c.route(/^https?:\/\/(?!localhost)/, r=>r.abort());
  const p=await c.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  const d=new Date(Date.now()+12*864e5).toISOString().slice(0,10), lang='Feste Schuhe und Kleidung für draußen, bei Regen Regenjacke und Matschhose. Bitte eine Trinkflasche mitgeben und an die Mütze denken.';
  await p.goto(B+'party.html?thema=einhorn');
  await p.evaluate(([d,lang])=>{ localStorage.clear(); localStorage.setItem('sj.party.einhorn', JSON.stringify({format:1,thema:'einhorn',kind:{name:'Mia',alter:5},datum:d,start:'15:00',kinder:6,helfer:2,vorausgeher:true,ort:'draussen',planB:true,ausdrucke:true,erledigt:{},einkauf:{},gaesteHinweis:lang}));
    localStorage.setItem('sj.plan.einhorn', JSON.stringify({format:1,thema:'einhorn',variante:'a',kinder:6,adresse:'Teststraße 1',strecke:1200,stationen:[{lat:53.5,lng:9.9,name:'Haustür'},{lat:53.501,lng:9.901,name:'Ecke'}]})); }, [d,lang]);
  await p.reload(); await p.waitForSelector('.held');
  const anzahl=s=>p.locator(s).count();

  // Überblick
  const titel=await p.locator('.weg .titel b').allInnerTexts();
  ok(titel.length===6 && titel[0]==='Alles bestellen' && titel[1]==='Gäste einladen', 'Überblick: 6 Schritte, Bestellen zuerst, Einladen danach');
  ok(await anzahl('.bogen .b')===6 && await anzahl('.bogen .b.an')===0, 'Regenbogen mit 6 Bögen, noch keiner leuchtet');
  ok(await anzahl('.station.dran')===1 && /Als Nächstes/i.test(await p.locator('.station.dran').innerText()) && /Alles bestellen/.test(await p.locator('.station.dran').innerText()), '„Als Nächstes“ zeigt auf Bestellen');
  const zeiten=await p.locator('.weg .zeit').allInnerTexts();
  ok(zeiten[0]==='am besten gleich' && zeiten[1]==='wann du magst' && !zeiten.some(z=>/fällig/.test(z)), 'Zeithinweise freundlich, kein „fällig“');
  ok(await p.locator('.station').last().evaluate(e=>e.getBoundingClientRect().bottom<=window.innerHeight), 'Alle 6 Schritte passen auf einen Bildschirm');
  ok(await anzahl('#gast-link')===0 && await anzahl('#vg-link')===0 && await anzahl('.ding')===0, 'Überblick ohne Werkzeuge');
  ok(await p.locator('#kalender').isVisible(), 'Kalender im Überblick');

  // Schritt öffnen: eigene Ansicht, Leiste mit allen Schritten
  await p.click('[data-oeffne="einladen"]'); await p.waitForSelector('#einladung');
  ok(/#einladung$/.test(p.url()) && await anzahl('.held')===0, 'Einladen öffnet als eigene Ansicht, Adresse #einladung');
  ok(await anzahl('.punkte button')===6 && await anzahl('.punkte button.hier')===1 && await p.locator('#zum-ueberblick').isVisible(), 'Leiste: 6 Punkte und zurück zum Überblick');
  ok(await p.evaluate(()=>getComputedStyle(document.querySelector('.leiste-oben')).position)==='sticky', 'Leiste bleibt beim Scrollen stehen');
  ok(await p.locator('#gast-link').isVisible() && await p.locator('#ansehen').isVisible(), 'Einladen: Link und Vorschau im Schritt');
  ok(/Eltern-Gruppe/.test(await p.locator('#gast-link').innerText()), 'Einladungslink ist erklärt');
  ok(await p.locator('#gh').evaluate(e=>e.scrollHeight<=e.clientHeight+2 && e.clientHeight>60), 'Textfeld zeigt den ganzen Text');
  await p.fill('#gh', lang+' '+lang.slice(0,60)); 
  ok(await p.locator('#gh').evaluate(e=>e.scrollHeight<=e.clientHeight+2), 'Textfeld wächst beim Tippen mit');

  // Springen über die Leiste, ohne Umweg über den Überblick
  await p.click('.punkte [data-oeffne="partytag"]'); await p.waitForSelector('#s-partytag');
  ok(await p.locator('#vg-link').isVisible() && /vorgeht/.test(await p.locator('#vg-link').innerText()), 'Partytag: Vorausgeher-Link mit Erklärung');
  ok(await p.locator('#umschalten').isVisible() && await anzahl('.teile [data-teil]')===3, 'Partytag: Plan B und drei Teilschritte zum Abhaken');
  await p.click('.blaettern [data-oeffne="geraet"]'); await p.waitForSelector('#s-geraet');
  ok(await p.locator('#teilen').isVisible() && /anderen Gerät/.test(await p.locator('#teilen').innerText()), 'Blättern zum iPad-Schritt, iPad-Link erklärt');
  await p.goBack(); await p.waitForSelector('.held');
  ok(!/#/.test(p.url()), 'Browser-Zurück führt aus dem Schritt zum Überblick');

  // Schritt abschließen: Bogen leuchtet, Überblick feiert, nächster Schritt
  await p.click('[data-oeffne="bestellen"]'); await p.waitForSelector('#einkauf .ding');
  ok(await anzahl('#einkauf .ding')>3, 'Bestellen: Einkaufsliste im Schritt');
  await p.click('[data-fertig="bestellen"]'); await p.waitForSelector('.held');
  ok(await anzahl('.bogen .b.an')===1 && /Rot leuchtet/.test(await p.locator('.sprech').innerText()), 'Erledigt: zurück im Überblick, der erste Bogen leuchtet');
  ok(/Gäste einladen/.test(await p.locator('.station.dran').innerText()) && !/#/.test(p.url()), '„Als Nächstes“ rückt weiter');
  // Reihenfolge ist frei: Route abhaken, obwohl Einladen offen ist
  await p.click('[data-oeffne="route"]'); await p.waitForSelector('#s-route .route-karte');
  await p.click('[data-teil="probelauf"]'); await p.waitForSelector('.held');
  ok(await anzahl('.bogen .b.an')===2 && /Gelb leuchtet/.test(await p.locator('.sprech').innerText()), 'Letzter Teilschritt abgehakt: Schritt fertig, Bogen leuchtet');
  ok(/Gäste einladen/.test(await p.locator('.station.dran').innerText()), 'Einladen bleibt offen, nichts ist gesperrt');
  await p.click('[data-oeffne="route"]'); await p.click('[data-umschalten="route"]'); await p.waitForTimeout(150);
  ok(await anzahl('[data-fertig="route"]')===1, '„Wieder öffnen“ macht den Schritt wieder offen');

  // Direktlinks
  await p.goto(B+'party.html?thema=einhorn#einkauf'); await p.reload(); await p.waitForSelector('#einkauf');
  ok(await anzahl('.punkte button.hier')===1 && await anzahl('.geschafft')===1, 'Adresse #einkauf öffnet den Schritt Bestellen (erledigt)');
  await p.click('#zum-ueberblick'); await p.waitForSelector('.held');
  ok(!/#/.test(p.url()), '„Überblick“ führt vom Direktlink zurück');
  ok(errs.length===0, 'keine Seitenfehler '+errs.join(' | '));
  console.log(fehler?fehler+' FEHLER':'ALLES OK'); await b.close(); process.exit(fehler?1:0);
})();
