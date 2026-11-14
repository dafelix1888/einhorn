// Gesamtablauf (UNICORN-54): Das Wichtige zur Tour kommt früh und bleibt im Spiel unter „Erwachsene“ erhalten.
// Wegweiser Route → Party → Vorbereiten → Feiern, Erzähler-Wahl im Assistenten, „So spielt ihr“ in der Party,
// Wahl wandert ins Spiel (gleiches Gerät und Tablet-Link) und zurück, Startklar lädt die richtige Stimme,
// „Einrichten“ in drei Gruppen ohne Verlust, Tipps unterwegs (von Hand öffnen, zu früh gemeldet).
const { chromium } = require('playwright');
const B=process.env.BASIS||'http://localhost:8765/app/';
let fehler=0; const ok=(b,t)=>{ console.log((b?'ok   ':'FEHL ')+t); if(!b) fehler++; };
(async()=>{
  const b=await chromium.launch(), pf=[];
  async function neu(opt){
    const c=await b.newContext(Object.assign({viewport:{width:393,height:852}}, opt||{}));
    await c.addInitScript(()=>{ window.KONTO_TEST={url:'',key:''}; });
    await c.route(/^https?:\/\/(?!localhost)/, r=>r.abort());
    const p=await c.newPage(); p.on('pageerror', e=>pf.push(e.message)); return p;
  }
  const STATIONEN=[{lat:53.5,lng:9.9,name:'Haustür'},{lat:53.5006,lng:9.9,name:'Ecke'},{lat:53.502,lng:9.902,name:'Bach'},{lat:53.503,lng:9.903,name:'Zaun'},{lat:53.504,lng:9.904,name:'Weg'},{lat:53.505,lng:9.905,name:'Hügel'},{lat:53.506,lng:9.906,name:'Bank'}];
  const PLAN={format:1,thema:'einhorn',variante:'a',kinder:6,adresse:'Teststraße 1',strecke:1200,stand:'2026-11-01T10:00:00Z',stationen:STATIONEN};
  let p=await neu();
  const plan=()=>p.evaluate(()=>JSON.parse(localStorage.getItem('sj.plan.einhorn')||'null'));
  const party=()=>p.evaluate(()=>JSON.parse(localStorage.getItem('sj.party.einhorn')||'null'));
  const spiel=()=>p.evaluate(()=>window.__zs.state());

  // --- 1. Planer: Wegweiser zeigt, wo man im Gesamtablauf ist ---
  await p.goto(B+'planer.html?thema=einhorn'); await p.evaluate(()=>localStorage.clear()); await p.reload(); await p.waitForSelector('.wegweiser');
  ok(await p.getAttribute('.wegweiser','aria-label')==='Abschnitt 1 von 4: Route', 'Planer: Wegweiser „Abschnitt 1 von 4: Route“');
  ok((await p.locator('.wegweiser li').allInnerTexts()).map(t=>t.replace(/\s+/g,' ').trim()).join('|')==='1 Route|2 Party|3 Vorbereiten|4 Feiern', 'Wegweiser: Route, Party, Vorbereiten, Feiern');

  // --- 2. Assistent: vier Schritte, Extra früh, Erzähler mit Hörprobe ---
  await p.evaluate(pl=>localStorage.setItem('sj.plan.einhorn', JSON.stringify(pl)), PLAN);
  await p.goto(B+'party.html?thema=einhorn'); await p.waitForSelector('#name');
  ok(await p.getAttribute('.wegweiser','aria-label')==='Abschnitt 2 von 4: Party' && await p.locator('.wegweiser .war').count()===1, 'Assistent: Wegweiser bei „Party“, Route abgehakt');
  ok(/Schritt 1 von 4/.test(await p.locator('#seite').innerText()), 'Assistent hat 4 Schritte');
  await p.fill('#name','Mia'); await p.fill('#alter','5'); await p.fill('#datum', new Date(Date.now()+12*864e5).toISOString().slice(0,10));
  await p.click('#weiter'); await p.waitForSelector('#vorein');
  ok(/ohne Extra/.test(await p.locator('#vorein summary').innerText()), 'Schritt 2: Voreinstellung nennt „ohne Extra“');
  await p.click('#vorein summary'); await p.check('#extra-assistent');
  ok(/Extra: Hinweise am Weg/.test(await p.locator('#vorein summary').innerText()), 'Schritt 2: Extra „Echte Hinweise am Weg“ lässt sich gleich einschalten');
  await p.uncheck('#extra-assistent');
  await p.click('#weiter'); await p.waitForSelector('.erz-liste');
  ok(/Wer liest die Aufgaben vor\?/.test(await p.locator('h1').innerText()) && /Schritt 3 von 4/.test(await p.locator('#seite').innerText()), 'Schritt 3: „Wer liest die Aufgaben vor?“');
  ok(await p.locator('.erz-zeile').count()===6 && await p.locator('.erz-zeile img').count()===6, 'Sechs Erzähler mit Bild');
  ok(await p.locator('[data-erz="kakapups"][aria-pressed="true"]').count()===1, 'Der erste Erzähler ist vorgewählt');
  await p.click('[data-erz-hoer="rudi"]');
  ok(await p.locator('[data-erz-hoer="rudi"].spielt').count()===1, 'Hörprobe läuft (Knopf zeigt Pause)');
  ok(await p.evaluate(()=>fetch('themen/einhorn/erzaehler/rudi.mp3',{method:'HEAD'}).then(r=>r.ok)), 'Hörprobe liegt beim Thema');
  await p.click('[data-erz-hoer="rudi"]');
  ok(await p.locator('.erz-hoer.spielt').count()===0, 'Zweiter Tipp hält die Hörprobe an');
  await p.click('[data-erz="bruno"]');
  ok(await p.locator('[data-erz="bruno"][aria-pressed="true"]').count()===1 && await p.locator('.erz-zeile.an').count()===1, 'Bruno gewählt');
  await p.click('#weiter'); await p.waitForSelector('.zusammen');
  ok(/Bruno, der brummige Bär/.test(await p.locator('.summe').innerText()), 'Zusammenfassung nennt den Erzähler');
  await p.click('#weiter'); await p.waitForSelector('.held');
  ok((await party()).erz==='bruno' && (await plan()).erz==='bruno' && !!(await plan()).erzStand, 'Party und Tourplan kennen den Erzähler');
  ok((await plan()).stand===PLAN.stand, 'Der Stand der Punkte bleibt unberührt (Spiel behält seine Punkte)');

  // --- 3. Überblick: Zeile „So spielt ihr“, die 6 Schritte passen weiter auf einen Bildschirm ---
  ok(/So spielt ihr/.test(await p.locator('.spiel-zeile').innerText()) && /Draußen · Bruno liest vor/.test(await p.locator('.spiel-zeile').innerText()), 'Überblick: „So spielt ihr: Draußen · Bruno liest vor“');
  ok(await p.locator('.station').count()===6 && await p.locator('.station').last().evaluate(e=>e.getBoundingClientRect().bottom<=window.innerHeight), 'Alle 6 Schritte passen weiter auf einen Bildschirm');

  // --- 4. Ansicht „So spielt ihr“: Spielart mit Extra, Erzähler, Ablauf der Tour ---
  await p.click('.spiel-zeile'); await p.waitForSelector('#so-spielt-ihr');
  ok(/#so-spielt-ihr$/.test(p.url()), 'Eigene Adresse #so-spielt-ihr');
  ok(await p.locator('#so-spielt-ihr [data-spielart]').count()===2 && await p.locator('#extra-hinweise').count()===1 && await p.locator('#so-spielt-ihr .erz-zeile').count()===6, 'Spielart, Extra und Erzähler an einer Stelle');
  ok(await p.locator('.lauf li').count()===3 && /von Hand/.test(await p.locator('.lauf').innerText()), '„So läuft die Tour“ in drei Sätzen, nennt „von Hand“');
  ok(/Erwachsene/.test(await p.locator('.wozu').innerText()), 'Hinweis: alles auch im Spiel unter „Erwachsene“');
  await p.click('[data-erz="rudi"]'); await p.waitForTimeout(200);
  ok((await party()).erz==='rudi' && (await plan()).erz==='rudi', 'Erzähler geändert: Party und Plan folgen');
  await p.click('#so-spielt-ihr [data-spielart="drinnen"]'); await p.waitForSelector('.sa-wechsel');
  ok((await party()).ort==='drinnen' && /Wechsel zu „Drinnen“/.test(await p.locator('.sa-wechsel').innerText()), 'Spielart gewechselt, die Ansicht zeigt, was sich ändert');
  ok(await p.locator('#extra-hinweise').count()===0, 'Drinnen: kein Extra');
  await p.click('#so-spielt-ihr [data-spielart="draussen"]'); await p.waitForTimeout(200);
  await p.click('#einf-zeigen'); await p.waitForSelector('.einf-blatt');
  ok(/1 von 5/.test(await p.textContent('#einf-zaehler')), '„Kurz erklärt“ öffnet die Einführung schon in der Party');
  await p.keyboard.press('Escape');
  await p.goBack(); await p.waitForSelector('.held');
  ok(!/#/.test(p.url()) && /Draußen · Rudi liest vor/.test(await p.locator('.spiel-zeile').innerText()), 'Browser-Zurück führt zum Überblick, Zeile zeigt den neuen Stand');

  // --- 5. Schritte verweisen zur rechten Zeit darauf ---
  await p.click('[data-oeffne="geraet"]'); await p.waitForSelector('#s-geraet');
  ok(/So spielt ihr: Draußen · Rudi liest vor/.test(await p.locator('#s-geraet .kachel[data-oeffne="spiel"]').innerText()), 'Tablet startklar: Kachel zeigt Spielart und Erzähler');
  ok(/Erzähler schon drin/.test(await p.locator('#teilen').innerText()), 'Link fürs Tablet nennt den Erzähler');
  await p.click('#s-geraet .kachel[data-oeffne="spiel"]'); await p.waitForSelector('#so-spielt-ihr'); ok(true, 'Kachel öffnet „So spielt ihr“');
  await p.goto(B+'party.html?thema=einhorn#s-route'); await p.waitForSelector('#einf-gps');
  await p.click('#einf-gps'); await p.waitForSelector('.einf-blatt');
  ok(/3 von 5/.test(await p.textContent('#einf-zaehler')) && /zu früh/.test(await p.textContent('#einf-text')), 'Route ablaufen: „So öffnen sich die Stationen“ springt zur Karte mit „zu früh“');
  await p.keyboard.press('Escape');

  // --- 6. Startklar: zeigt die Wahl und lädt die Stimme des gewählten Erzählers ---
  await p.goto(B+'bereit.html?thema=einhorn'); await p.waitForSelector('#so-spielt:not([hidden])');
  ok(/Draußen · Rudi liest vor/.test(await p.locator('#so-spielt').innerText()) && /party\.html\?thema=einhorn#so-spielt-ihr$/.test(await p.getAttribute('#so-spielt','href')), 'Startklar: „So spielt ihr“ mit Weg zum Ändern');
  await p.waitForSelector('#laden');
  const geladen=p.waitForRequest(/einhorn-rudi\.json/, {timeout:20000}).then(()=>true, ()=>false);
  await p.click('#laden');
  ok(await geladen, 'Startklar lädt das Stimmen-Paket von Rudi, nicht das voreingestellte');

  // --- 7. Spiel auf demselben Gerät: übernimmt den Erzähler, „Einrichten“ behält alles und schreibt zurück ---
  await p.goto(B+'spiel.html?thema=einhorn#einrichten'); await p.waitForSelector('#erz-wahl [data-erz]', {state:'attached'}); await p.waitForTimeout(600);
  ok((await spiel()).erz==='rudi' && /Rudi/.test(await p.textContent('#sum-erz')), 'Spiel: Erzähler aus der Party übernommen');
  ok((await p.locator('#view-setup .gruppe').evaluateAll(l=>l.map(h=>h.firstChild.textContent))).join('|')==='So spielt ihr|Vorbereiten|Mehr', 'Einrichten in drei Gruppen: So spielt ihr, Vorbereiten, Mehr');
  const karten=await p.locator('#view-setup > details.karte').evaluateAll(l=>l.map(d=>d.id));
  ok(karten.join(',')==='k-variante,k-erz,k-tour,k-vorbereitung,k-gaben,k-punkte,k-protokoll,k-kamera,k-stimme,k-loeschen', 'Einrichten: alle 10 Karten sind noch da ('+karten.length+')');
  ok(await p.locator('#einf-angebot').count()===0, 'In „Einrichten“ schwebt kein Angebot');
  await p.evaluate(()=>{ document.getElementById('k-erz').open=true; }); await p.click('#erz-wahl [data-erz="charly"]');
  ok((await spiel()).erz==='charly' && (await party()).erz==='charly' && (await plan()).erz==='charly', 'Erzähler im Spiel geändert: gilt auch für die Party');
  await p.reload(); await p.waitForSelector('#erz-wahl [data-erz]', {state:'attached'}); await p.waitForTimeout(400);
  ok((await spiel()).erz==='charly', 'Wahl im Spiel bleibt nach dem Neuladen');
  // Party ändert ihn wieder: das Spiel folgt
  await p.goto(B+'party.html?thema=einhorn#so-spielt-ihr'); await p.waitForSelector('#so-spielt-ihr [data-erz="alfonso"]');
  ok(await p.locator('[data-erz="charly"][aria-pressed="true"]').count()===1, 'Party zeigt die Wahl aus dem Spiel');
  await p.click('[data-erz="alfonso"]'); await p.waitForTimeout(200);
  await p.goto(B+'spiel.html?thema=einhorn'); await p.waitForSelector('#btn-main'); await p.waitForTimeout(600);
  ok((await spiel()).erz==='alfonso', 'Neue Wahl in der Party kommt wieder im Spiel an');
  const link=await p.evaluate(()=>Party.spielLink(Party.lesen('einhorn'), Party.plan('einhorn')));
  await p.context().close();

  // --- 8. Tablet mit Link: Erzähler steckt im Link ---
  p=await neu({viewport:{width:1180,height:820}});
  await p.goto(link); await p.waitForSelector('#btn-main'); await p.waitForTimeout(600);
  ok((await p.evaluate(()=>window.__zs.state().erz))==='alfonso', 'Tablet-Link bringt den Erzähler mit');
  await p.context().close();

  // --- 9. Unterwegs mit GPS: Tipp „von Hand öffnen“ einmal, bei der ersten Ankunft „Zu früh?“ ---
  p=await neu({geolocation:{latitude:53.5,longitude:9.9,accuracy:5}, permissions:['geolocation']});
  await p.goto(B+'impressum.html'); await p.evaluate(pl=>{ localStorage.clear(); localStorage.setItem('sj.plan.einhorn', JSON.stringify(pl)); }, PLAN);
  await p.goto(B+'spiel.html?thema=einhorn'); await p.waitForSelector('#btn-main'); await p.waitForTimeout(800);
  await p.click('#btn-main'); await p.waitForSelector('#einf-tipp'); await p.click('#einf-tipp-zu');
  for(let i=0;i<8;i++){ if((await p.evaluate(()=>window.__zs.state().phase))==='seek') break; await p.click('#btn-main'); await p.waitForTimeout(500); }
  ok(await p.locator('#einf-tipp').count()===0, 'Vor „Funkel sprechen lassen“ kommt kein Tipp');
  await p.click('#btn-speak'); await p.waitForSelector('#einf-tipp[data-tipp="unterwegs"]', {timeout:20000});
  ok(/Station von Hand öffnen/.test(await p.textContent('#einf-tipp')), 'Unterwegs: Tipp nennt „Station von Hand öffnen“');
  ok(await p.locator('#btn-hand').isVisible() && /Station von Hand öffnen/.test(await p.textContent('#btn-hand')), 'Der Knopf dazu steht unter dem Spiegel');
  await p.click('#einf-tipp-zu');
  await p.waitForTimeout(9000);                                             // erst nach 10 s unterwegs öffnet etwas von selbst
  for(let m=20;m>=0;m-=2){ await p.context().setGeolocation({latitude:53.5006-m/111320,longitude:9.9,accuracy:5}); await p.waitForTimeout(900); }
  await p.waitForSelector('#pop:not([hidden])', {timeout:20000});
  await p.waitForFunction(()=>window.__zs.kompass().wartet, null, {timeout:10000});
  ok(await p.locator('#pop-tipp').isVisible() && /Zu früh\?/.test(await p.textContent('#pop-tipp')), 'Erste Ankunft per GPS: Hinweis „Zu früh? Erst zur Stelle laufen“');
  await p.click('#btn-pop'); await p.waitForTimeout(400);
  const gemerkt=await p.evaluate(()=>JSON.parse(localStorage.getItem('sj.einfuehrung.tipps')||'{}'));
  ok(gemerkt.start===1 && gemerkt.unterwegs===1 && gemerkt.ankunft===1, 'Jeder Tipp ist gemerkt und kommt nicht wieder');
  await p.context().close();

  ok(!pf.length, 'Keine Seitenfehler'+(pf.length?': '+pf.join(' | '):''));
  await b.close(); console.log(fehler?fehler+' FEHLER':'ALLES OK'); process.exit(fehler?1:0);
})();
