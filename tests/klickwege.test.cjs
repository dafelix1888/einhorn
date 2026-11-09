// Klickwege (UNICORN-25): „Zurück“ geht einen Schritt zurück, „Zuhause“ ist Party oder Landingpage, nie der Katalog.
const { chromium } = require('playwright');
const B=''+(process.env.BASIS||'http://localhost:8765')+'/app/';
const W=B.replace(/app\/$/,'');
let fehler=0; const ok=(c,t)=>{ console.log((c?'ok   ':'FEHLER ')+t); if(!c) fehler++; };
const PLAN={format:1, thema:'einhorn', stationen:[{lat:53.55,lon:9.99},{lat:53.551,lon:9.991},{lat:53.552,lon:9.992}], strecke:900, adresse:'Musterweg 1'};
const PARTY={format:1, thema:'einhorn', kind:{name:'Mia', alter:5}, datum:'2030-06-01', start:'15:00', kinder:6, helfer:2, vorausgeher:true, ort:'draussen', planB:true, ausdrucke:true, erledigt:{}, einkauf:{}};
const pfad=u=>{ const x=new URL(u); return x.pathname.replace(/^\/app\//,'')+x.search; };
(async()=>{
  const b=await chromium.launch(), errs=[];
  async function neu(daten){
    const c=await b.newContext({viewport:{width:393,height:852}});
    await c.route(/^https?:\/\/(?!localhost)/, r=>r.abort());
    await c.addInitScript(d=>{ if(sessionStorage.getItem('__init')) return; sessionStorage.setItem('__init','1'); localStorage.clear(); for(const k in d) localStorage.setItem(k, JSON.stringify(d[k])); }, daten||{});
    const p=await c.newPage(); p.on('pageerror',e=>errs.push(p.url()+': '+e.message)); return p;
  }
  async function klick(p, sel){ await Promise.all([p.waitForNavigation({timeout:8000}).catch(()=>{}), p.locator(sel).first().click()]); await p.waitForLoadState('domcontentloaded'); }

  // 1) Neuer Besucher: Landing → Planer → Zurück = Landing
  let p=await neu();
  await p.goto(B+'landing.html'); await klick(p,'main:not([hidden]) a.cta');
  ok(pfad(p.url()).startsWith('planer.html'), 'Landing → Planer');
  await klick(p,'#zurueck-eingabe');
  ok(pfad(p.url()).startsWith('landing.html'), 'Planer Zurück → Landingpage (nicht Katalog)');

  // 2) Planer direkt geöffnet (ohne Verlauf), keine Party → Ersatz Landingpage
  p=await neu(); await p.goto(B+'planer.html?thema=einhorn'); await klick(p,'#zurueck-eingabe');
  ok(pfad(p.url()).startsWith('landing.html'), 'Planer ohne Verlauf → Landingpage');

  // 3) Route da, keine Party: Party-Assistent Schritt 1 Zurück → Planer; Eingaben bleiben
  p=await neu({'sj.plan.einhorn':PLAN});
  await p.goto(B+'planer.html?thema=einhorn'); await p.goto(B+'party.html?thema=einhorn'); await p.waitForSelector('#name');
  await p.fill('#name','Mia');
  await klick(p,'a[data-zurueck]');
  ok(pfad(p.url()).startsWith('planer.html'), 'Assistent Schritt 1 Zurück → Planer');
  await p.goto(B+'party.html?thema=einhorn'); await p.waitForSelector('#name');
  ok(await p.inputValue('#name')==='Mia', 'Eingabe im Assistenten bleibt erhalten');

  // 4) Browser-Zurück im Assistenten geht einen Schritt zurück
  await p.fill('#alter','5'); await p.fill('#datum','2030-06-01');
  await p.click('#weiter'); await p.waitForFunction(()=>/schritt-2/.test(location.hash));
  ok(/Schritt 2 von/.test(await p.locator('#seite').innerText()), 'Weiter → Schritt 2 im Verlauf');
  await p.goBack(); await p.waitForFunction(()=>/Schritt 1 von/.test(document.getElementById('seite').innerText));
  ok(pfad(p.url()).startsWith('party.html') && await p.inputValue('#name')==='Mia', 'Browser-Zurück → Schritt 1, Eingaben noch da');

  // 5) Party da: Startadresse → Party-Übersicht; Übersicht ohne „← Alle Abenteuer“, Planer-Zurück → Party
  p=await neu({'sj.plan.einhorn':PLAN, 'sj.party.einhorn':PARTY});
  await p.goto(W); await p.waitForURL(/party\.html/);
  ok(pfad(p.url()).startsWith('party.html?thema=einhorn'), 'Startadresse mit Party → Party-Übersicht');
  await p.waitForSelector('#seite .marke-sw', {timeout:10000}).catch(()=>{});
  ok(!/← Alle Abenteuer/.test(await p.locator('#seite').innerText()) && await p.locator('a[href="./"]', {hasText:'Alle Abenteuer'}).count()>0, 'Übersicht: Katalog nur als eigener Link');
  await p.goto(B+'planer.html?thema=einhorn'); await klick(p,'#zurueck-karte');
  ok(pfad(p.url()).startsWith('party.html'), 'Planer Zurück mit Party → Party');

  // 6) Startadresse: nur Route → Assistent; nichts → Landingpage (Parameter bleiben); #tour → Spiel
  p=await neu({'sj.plan.einhorn':PLAN}); await p.goto(W); await p.waitForURL(/party\.html/);
  ok(true, 'Startadresse mit Route → Party-Assistent');
  p=await neu(); await p.goto(W+'?utm_source=test'); await p.waitForURL(/landing\.html/);
  ok(/utm_source=test/.test(p.url()), 'Startadresse neu → Landingpage mit Parametern');
  p=await neu(); await p.goto(W+'#tour', {waitUntil:'commit'}); await p.waitForURL(/spiel\.html/, {waitUntil:'commit'});
  ok(true, 'alter #tour-Link → Spiel');

  // 7) Katalog: „Party planen“ ohne Party startet mit dem Planer, mit Route „Weiter zur Party“ statt „Spiel öffnen“
  p=await neu(); await p.goto(B); await p.waitForTimeout(400);
  const hrefs=await p.$$eval('a', as=>as.filter(a=>/Party planen/.test(a.textContent+a.getAttribute('aria-label'))).map(a=>a.getAttribute('href')));
  ok(hrefs.length>0 && hrefs.every(h=>/^planer\.html/.test(h)), 'Katalog „Party planen“ → Planer ('+hrefs.length+')');
  p=await neu({'sj.plan.einhorn':PLAN}); await p.goto(B); await p.waitForTimeout(400);
  const mitRoute=await p.$$eval('a', as=>as.filter(a=>/Party planen|Weiter zur Party|Spiel öffnen/.test(a.textContent+(a.getAttribute('aria-label')||''))).map(a=>a.getAttribute('href')));
  ok(mitRoute.length>0 && mitRoute.every(h=>/^party\.html/.test(h)), 'Katalog mit Route: alle Wege → Party, kein „Spiel öffnen“ ('+mitRoute.join(', ')+')');

  // 7b) Landingpage „Meine Party“ (MAR-58): ohne Party → Auswahl Anmelden/Neue Party; mit Party → Übersicht
  p=await neu(); await p.goto(B+'landing.html'); await klick(p,'.marke a.mein');
  await p.waitForSelector('#holen', {timeout:8000}).catch(()=>{});
  ok(pfad(p.url()).startsWith('party.html') && await p.locator('#holen').count()===1, 'Landing „Meine Party“ ohne Party → Anmelden und Party holen');
  ok(await p.locator('a[href^="planer.html"]', {hasText:'Neue Party planen'}).count()===1, 'Auswahl bietet „Neue Party planen“ → Planer');
  p=await neu({'sj.party.einhorn':PARTY}); await p.goto(B+'landing.html'); await klick(p,'.marke a.mein');
  await p.waitForSelector('#seite .marke-sw', {timeout:10000}).catch(()=>{});
  ok(/Mias Einhorn/.test(await p.locator('#seite').innerText()), 'Landing „Meine Party“ mit Party → Party-Übersicht');

  // 8) Impressum: Zurück → vorige Seite bzw. Landingpage
  p=await neu(); await p.goto(B+'landing.html'); await p.goto(B+'impressum.html'); await klick(p,'a[data-zurueck]');
  ok(pfad(p.url()).startsWith('landing.html'), 'Impressum Zurück → Landingpage');

  // 9) Bereit, Druck: Haus → Party
  p=await neu({'sj.party.einhorn':PARTY, 'sj.plan.einhorn':PLAN}); await p.goto(B+'bereit.html?thema=einhorn');
  ok(/party\.html\?thema=einhorn/.test(await p.getAttribute('a.heim-link','href',{timeout:90000})), 'Bereit: Haus-Symbol → Party');

  // 10) Gäste und Helfer: nie Katalog
  for(const s of ['einladung.html','vorausgeher.html','spiel.html?thema=einhorn']){
    const q=await neu(); await q.goto(B+s, {waitUntil:'domcontentloaded'}); await q.waitForTimeout(800);
    const kat=await q.$$eval('a', as=>as.filter(a=>a.offsetParent!==null && /^(\.\/|index\.html)(#|$)/.test(a.getAttribute('href')||'')).length);
    ok(kat===0, s+': kein sichtbarer Link in den Katalog');
  }
  // 11) Spiel ohne Party: kein „Zur Party“; mit Party zeigt es auf die Party
  p=await neu(); await p.goto(B+'spiel.html?thema=einhorn', {waitUntil:'domcontentloaded'}); await p.waitForTimeout(800);
  ok(await p.locator('#erw-portal').evaluate(e=>e.hidden,null,{timeout:90000}), 'Spiel ohne Party: „Zur Party“ versteckt');
  p=await neu({'sj.party.einhorn':PARTY}); await p.goto(B+'spiel.html?thema=einhorn', {waitUntil:'domcontentloaded'}); await p.waitForTimeout(800);
  ok(/party\.html\?thema=einhorn/.test(await p.getAttribute('#erw-portal','href',{timeout:90000})), 'Spiel mit Party: „Zur Party“ → Party');

  ok(errs.length===0, 'keine Seitenfehler '+errs.slice(0,3).join(' | '));
  console.log(fehler?fehler+' FEHLER':'ALLES OK'); await b.close(); process.exit(fehler?1:0);
})();
