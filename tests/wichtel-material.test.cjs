// Wichtel Bommi (UNICORN-137): Material besorgen. Jede Kombination aus Paket und Material-Weg ergibt eine stimmige Liste,
// die Druckvorlagen liegen als ein PDF vor, und die Seite läuft am Handy.
const fs=require('fs'), path=require('path');
const WK=require('../app/wichtel-kern.js');
const W=path.join(__dirname,'..','app','themen','wichtel');
const M=JSON.parse(fs.readFileSync(path.join(W,'material.json'),'utf8'));
const G=JSON.parse(fs.readFileSync(path.join(W,'geschichten.json'),'utf8'));
let f=0; const ok=(c,t)=>{ console.log((c?'ok   ':'FEHLER ')+t); if(!c) f++; };
const B=process.env.BASIS||'http://localhost:8765';
const plan=(paket, szenario)=>WK.plan(M,G,{ nr:WK.paket(M,paket), szenario, erster:'2026-12-01', letzter:'2026-12-22', sonntage:paket==='advent', eigene:{} },'2026-11-21');

// 1. Jede Kombination aus Paket und Material-Weg
for(const paket of Object.keys(M.pakete)) for(const szen of Object.keys(M.szenarien)){
  const p=plan(paket, szen), e=WK.einkauf(p), was=paket+'/'+szen;
  const nrs=p.zeilen.map(z=>z.nr);
  const erwartet=M.artikel.filter(a=>!a.aus && (a.nr==='alle' || nrs.includes(a.nr)));
  const kaufIds=szen==='kaufen' ? erwartet.map(a=>a.id) : (M.szenarien[szen].kauf||[]).filter(id=>erwartet.some(a=>a.id===id));
  ok(JSON.stringify(e.kaufen.map(a=>a.id).sort())===JSON.stringify(kaufIds.slice().sort()), was+': bestellt genau '+(kaufIds.join(',')||'nichts'));
  ok(e.kaufen.every(a=>a.nr.every(n=>nrs.includes(n))), was+': nur Artikel für gewählte Geschichten');
  ok(new Set(e.kaufen.map(a=>a.id)).size===e.kaufen.length, was+': jeder Artikel nur einmal');
  ok(e.kaufen.every(a=>/^https:\/\/www\.amazon\.de\/(dp\/[A-Z0-9]{10}|s\?k=[^ ]+)$/.test(a.link) && !/tag=/.test(a.link)), was+': Amazon-Links ohne Partner-ID');
  ok(e.kaufen.every(a=>a.selbst && a.selbst.length>5), was+': Ersatz zum Selbermachen steht daneben');
  ok(e.kaufen.every(a=>a.bis===WK.plus(p.zeilen.find(z=>z.nr===a.nr[0]).datum,-4)), was+': Bestellen bis = 4 Tage vor der ersten Geschichte, die es braucht');
  const summe=e.kaufen.reduce((s,a)=>s+(a.preis||0),0);
  ok(Math.abs(summe-e.summe)<0.01, was+': Summe '+WK.euro(e.summe)+' passt zu den Artikeln');
  ok(e.basteln.length===p.zeilen.length && e.basteln.every(z=>z.was.some(t=>/Brief/.test(t))), was+': je Geschichte Basteln mit Brief');
  if(szen==='selbst') ok(e.kaufen.length===0 && e.summe===0, was+': nichts kaufen, 0 €');
  // was nicht gekauft wird, steht beim Basteln
  const nichtGekauft=erwartet.filter(a=>!kaufIds.includes(a.id));
  ok(nichtGekauft.every(a=>e.basteln.some(z=>z.was.includes(a.selbst))), was+': nicht gekaufte Artikel stehen als Ersatz beim Basteln');
}
const ganzKauf=WK.einkauf(plan('ganz','kaufen'));
ok(ganzKauf.kaufen.find(a=>a.id==='tuer').link==='https://www.amazon.de/dp/B0DB8DTL6W', 'Tür-Set verlinkt auf B0DB8DTL6W');
ok(ganzKauf.kaufen.find(a=>a.id==='papier').link==='https://www.amazon.de/s?k=druckerpapier+160g+a4', 'Papier verlinkt auf die Suche');
ok(ganzKauf.ohnePreis===2, 'Alles kaufen: Papier und Waschtag ohne Preis');
ok(/drei Jahren/.test(M.kleinteile), 'Kleinteile-Hinweis: nicht unter drei Jahren');

// 2. Druckvorlagen als ein PDF
const pdf=path.join(W,'druckvorlagen.pdf');
ok(fs.existsSync(pdf) && fs.readFileSync(pdf).slice(0,5).toString()==='%PDF-', 'druckvorlagen.pdf liegt da');
const roh=fs.existsSync(pdf)?fs.readFileSync(pdf,'latin1'):'';
const seiten=(roh.match(/\/Type\s*\/Page[^s]/g)||[]).length;
ok(seiten===8, 'PDF hat 8 Seiten ('+seiten+')');
const html=fs.readFileSync(path.join(W,'druckvorlagen.html'),'utf8');
for(const t of ['Wichteltür','Willkommensschild','Waschmittel-Etiketten','Baustellenschilder','Weihnachtskugel','Briefe von Oma Mooswinkel','160 g','drei Jahren']) ok(html.includes(t), 'Vorlage enthält: '+t);

// 3. Im Browser
(async()=>{
  const { chromium }=require('playwright');
  const b=await chromium.launch(), c=await b.newContext({viewport:{width:393,height:852}});
  await c.route(u=>!/^https?:\/\/(localhost|127\.0\.0\.1)/.test(u.toString()), r=>r.abort());
  const p=await c.newPage(), errs=[]; p.on('pageerror', e=>errs.push(e.message));
  // Briefe in der Vorlage werden aus geschichten.json gefüllt
  await p.goto(B+'/app/themen/wichtel/druckvorlagen.html'); await p.waitForSelector('body[data-fertig="1"]');
  ok(await p.locator('.brief').count()===8, 'Vorlage: 8 Briefe');
  ok((await p.locator('.brief[data-nr="2"]').innerText()).includes('Halbiert schmeckt ein Keks doppelt'), 'Vorlage: Brief 2 kommt aus geschichten.json');
  // Material-Seite
  await p.goto(B+'/app/wichtel.html'); await p.waitForSelector('#los');
  await p.click('#los'); await p.click('[data-paket=klein]'); await p.click('#s-auswahl [data-weiter]');
  await p.click('#s-szenario [data-weiter]');
  ok(await p.locator('#material').isEnabled(), 'Knopf „Material besorgen“ ist an');
  await p.click('#material');
  ok(await p.locator('#s-material').isVisible(), 'Material-Seite offen');
  ok(await p.locator('#wege button').count()===3 && await p.locator('[data-weg=gemischt]').getAttribute('aria-pressed')==='true', 'Drei Wege, Gemischt gewählt');
  ok(await p.locator('#kauf li[data-id]').count()===4, 'Klein, gemischt: 4 Teile bestellen');
  ok(await p.locator('#kauf a[href^="https://www.amazon.de/"]').count()===4, 'Je Teil ein Amazon-Link');
  ok(/Oder selbst/.test(await p.locator('#kauf').innerText()), 'Ersatz steht daneben');
  ok(await p.locator('#bast li').count()===3, 'Basteln je Geschichte');
  ok(await p.locator('#vorlagen').getAttribute('href')==='themen/wichtel/druckvorlagen.pdf', 'Link zu den Druckvorlagen');
  ok(/drei Jahren/.test(await p.locator('#kleinteile').innerText()), 'Kleinteile-Hinweis sichtbar');
  await p.click('[data-weg=selbst]');
  ok(await p.locator('#kauf li[data-id]').count()===0 && /kauft nichts/.test(await p.locator('#mat-zeile').innerText()), 'Selbst: nichts zu bestellen');
  await p.click('[data-weg=kaufen]');
  ok(await p.locator('#kauf li[data-id]').count()===7, 'Klein, alles kaufen: 7 Teile');
  ok(await p.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth), 'Handy: nichts ragt seitlich heraus');
  await p.reload(); await p.waitForSelector('#s-material:not([hidden])');
  ok(await p.locator('[data-weg=kaufen]').getAttribute('aria-pressed')==='true', 'Nach Neuladen: Material-Seite und Weg bleiben');
  const r=await p.request.get(B+'/app/themen/wichtel/druckvorlagen.pdf');
  ok(r.ok() && /pdf/.test(r.headers()['content-type']||''), 'PDF wird ausgeliefert');
  await p.screenshot({path:path.join(process.env.BILDER||require('os').tmpdir(),'wichtel-material.png'), fullPage:true}).catch(()=>{});
  ok(errs.length===0, 'keine JS-Fehler '+errs.slice(0,2).join(' | '));
  await b.close();
  console.log(f?f+' FEHLER':'ALLES OK'); process.exit(f?1:0);
})();
