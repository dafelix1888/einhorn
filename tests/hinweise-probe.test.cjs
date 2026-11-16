// UNICORN-58 bis 61: Hinweise im Ablauf, sprechende Erzähler-Figur, Bestellen oder Notlösungen, Basteln mit Aufwand, Generalprobe.
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
  const ST=[{lat:53.5,lng:9.9,name:'Haustür'},{lat:53.5006,lng:9.9,name:'Ecke'},{lat:53.502,lng:9.902,name:'Bach'},{lat:53.503,lng:9.903,name:'Zaun'},{lat:53.504,lng:9.904,name:'Weg'},{lat:53.505,lng:9.905,name:'Hügel'},{lat:53.506,lng:9.906,name:'Bank'}];
  const PLAN={format:1,thema:'einhorn',variante:'a',kinder:10,adresse:'Teststraße 1',strecke:1200,stand:'2026-11-01T10:00:00Z',stationen:ST};
  const d=new Date(Date.now()+12*864e5).toISOString().slice(0,10);
  const PARTY={format:1,thema:'einhorn',kind:{name:'Tilda',alter:6},datum:d,start:'14:00',kinder:10,helfer:2,vorausgeher:true,ort:'draussen',planB:true,ausdrucke:true,erledigt:{},einkauf:{}};

  // --- UNICORN-58: Planer zeigt einmal, dass man Stationen verschieben kann ---
  let p=await neu();
  await p.goto(B+'impressum.html'); await p.evaluate(pl=>{ localStorage.clear(); localStorage.setItem('sj.plan.einhorn', JSON.stringify(pl)); }, PLAN);
  await p.goto(B+'planer.html?thema=einhorn'); await p.waitForSelector('#zieh-tipp:not([hidden])', {timeout:15000});
  ok(/verschieben/.test(await p.textContent('#zieh-tipp')) && /gedrückt/.test(await p.textContent('#zieh-tipp')), 'Planer: Tipp „Stationen verschieben“ beim ersten Blick auf die Karte');
  await p.click('#zieh-tipp-ok');
  ok(await p.locator('#zieh-tipp').isHidden(), '„Verstanden“ schließt den Tipp');
  await p.reload(); await p.waitForTimeout(2500);
  ok(await p.locator('#zieh-tipp').isHidden(), 'Tipp kommt nur einmal je Gerät');

  // --- UNICORN-58: Assistent ---
  await p.goto(B+'party.html?thema=einhorn'); await p.waitForSelector('#name');
  ok(/30 Tage nach der Feier/.test(await p.textContent('.hinweis-loeschen')), 'Schritt 1: Hinweis, dass die Party 30 Tage nach der Feier gelöscht wird');
  await p.fill('#name','Tilda'); await p.fill('#alter','6'); await p.fill('#datum','2030-06-01');
  ok(/am 1\. Juli, 30 Tage nach der Feier/.test(await p.textContent('.hinweis-loeschen')), 'Mit Datum steht der Tag der Löschung da');
  await p.click('#weiter'); await p.waitForSelector('.spielart-jederzeit');
  ok(/auch noch am Partytag/.test(await p.textContent('.spielart-jederzeit')), 'Schritt 2: Spielart jederzeit änderbar, auch am Partytag');
  await p.click('#weiter'); await p.waitForSelector('.erz-liste');
  const vorher=await p.evaluate(()=>{ const h=document.querySelector('#seite .spielart-jederzeit'), l=document.querySelector('.erz-liste'); return !!(h && l && (h.compareDocumentPosition(l) & Node.DOCUMENT_POSITION_FOLLOWING)); });
  ok(vorher, 'Erzähler: Hinweis „jederzeit änderbar“ steht über der Auswahl');

  // --- UNICORN-59: Hörprobe fächert auf, Figur spricht ---
  await p.click('[data-erz-hoer="bruno"]'); await p.waitForSelector('.erz-buehne[data-buehne="bruno"] svg[data-figur="bruno"]', {timeout:8000});
  ok(await p.locator('.erz-zeile.offen').count()===1 && /Bruno spricht/.test(await p.textContent('.erz-buehne')), 'Hörprobe: Zeile fächert auf, Bruno erscheint');
  ok(await p.getAttribute('[data-erz-hoer="bruno"]','aria-expanded')==='true', 'Knopf meldet „aufgeklappt“');
  await p.click('[data-erz="bruno"]'); await p.waitForTimeout(200);
  ok(await p.locator('.erz-buehne[data-buehne="bruno"] svg').count()===1, 'Wählen während der Hörprobe: Figur bleibt sichtbar');
  await p.click('[data-erz-hoer="charly"]'); await p.waitForSelector('.erz-buehne[data-buehne="charly"] svg'); await p.waitForTimeout(400);
  ok(await p.locator('.erz-buehne').count()===1, 'Andere Hörprobe: nur eine Bühne offen');
  await p.click('[data-erz-hoer="charly"]'); await p.waitForTimeout(450);
  ok(await p.locator('.erz-buehne').count()===0 && await p.locator('.erz-zeile.offen').count()===0, 'Zweiter Tipp: klappt wieder zu');

  // --- UNICORN-58: „Fertig“ erklärt, wer Funkel ist (nur mit Server sichtbar: Konto aktiv) ---
  await p.click('#weiter'); await p.waitForSelector('.zusammen');
  const nm=await p.locator('.nm-vorschau').count();
  ok(nm===0 || /Einhorn im Zauberspiegel/.test(await p.textContent('.nm-vorschau')), 'Fertig: „Funkel kennt …“ erklärt, wer Funkel ist');
  await p.context().close();

  // --- UNICORN-60: zwei Wege, nötig vs. Extra, Notlösung ---
  p=await neu();
  await p.goto(B+'impressum.html'); await p.evaluate(([pa,pl])=>{ localStorage.clear(); localStorage.setItem('sj.party.einhorn', JSON.stringify(pa)); localStorage.setItem('sj.plan.einhorn', JSON.stringify(pl)); }, [PARTY, PLAN]);
  await p.goto(B+'party.html?thema=einhorn#einkauf'); await p.waitForSelector('.wege');
  const euro=async s=>+((await p.textContent('[data-wege="'+s+'"] .betrag')).replace(/[^0-9,]/g,'').replace(',','.'));
  const alles=await euro('alles'), noetig=await euro('noetig');
  ok(alles>0 && noetig>0 && noetig<alles, 'Zwei Wege mit Preis: alles ('+alles+' €) und nur das Nötige ('+noetig+' €)');
  ok((await p.locator('.ek-gruppe').allInnerTexts()).map(t=>t.replace(/\s*\d+$/,'')).join('|')==='Braucht die Tour|Extras, die es schöner machen', 'Liste in zwei Gruppen: nötig und Extras');
  ok(/Sonst: Aus Pappe ausschneiden/.test(await p.textContent('#einkauf')), 'Holz-Regenbogen mit derselben Notlösung wie im Spiel unter „Vorbereitung“');
  await p.click('[data-wege="noetig"]'); await p.waitForTimeout(200);
  const aus=await p.evaluate(()=>JSON.parse(localStorage.getItem('sj.party.einhorn')).einkaufAus);
  ok(aus.u5 && !aus.u0 && !aus.u1 && !aus.u3 && !aus.u2 && !aus.u9, '„Nur das Nötige“ behält alles, was im Spiel vorkommt (Haarreifen, Tattoos, Glückssteine), und wählt Geschenke ab (UNICORN-66)');
  ok(await p.getAttribute('[data-wege="noetig"]','aria-pressed')==='true', '„Nur das Nötige“ ist markiert');
  const nb=p.locator('.ding:has-text("Seil") [data-wie="not"]'); await nb.click(); await p.waitForTimeout(200);
  const pa=await p.evaluate(()=>JSON.parse(localStorage.getItem('sj.party.einhorn')));
  ok(pa.einkauf.u9 && pa.einkaufWie.u9==='not', 'Seil: „Notlösung“ hakt ab und merkt sich den Weg');
  ok(/Mit Notlösung/.test(await p.textContent('.erledigt-liste')), 'Erledigt-Liste zeigt „Mit Notlösung“');
  ok(await p.locator('.ding:has-text("Kindertattoos") [data-wie="weg"]').count()===0, 'Tattoos kommen im Spiel vor: kein „Lass ich weg“, nur Notlösung (UNICORN-66)');
  await p.click('[data-wege="alles"]'); await p.waitForTimeout(200);
  await p.locator('.ding:has-text("Kratzbilder") [data-wie]').first().click(); await p.waitForTimeout(200);
  ok(['weg','not'].includes(await p.evaluate(()=>JSON.parse(localStorage.getItem('sj.party.einhorn')).einkaufWie.u5)), 'Kratzbilder (Extra): weglassen oder Notlösung');

  // --- UNICORN-60: Basteln mit Aufwand ---
  await p.goto(B+'party.html?thema=einhorn#s-basteln'); await p.waitForSelector('.bastel');
  const bt=await p.textContent('#s-basteln');
  ok(/Etwa \d+ Minuten/.test(bt) && /Nötig sind nur 5 Minuten/.test(bt), 'Basteln: Gesamtaufwand und nötiger Teil');
  ok(await p.locator('.bastel li').count()===5 && /Ohne: Den Schuhkarton so lassen/.test(bt) && /Danke-Link/.test(bt), 'Je Aufgabe Minuten und was ohne passiert');

  // --- UNICORN-76: Eine Generalprobe statt zwei Läufen ---
  await p.goto(B+'party.html?thema=einhorn#s-route'); await p.waitForSelector('#s-route');
  const rt=await p.textContent('#s-route');
  ok(/Generalprobe/.test(await p.textContent('#s-route h1, #s-route h2').catch(()=>rt)) && /probe=1/.test(await p.getAttribute('#s-route a.kachel[href*="probe=1"]','href')||''), 'Schritt 3 heißt Generalprobe, Knopf startet sie');
  ok(!/im Planer die Station antippen/.test(rt), 'Kein zweiter Weg „im Planer hier setzen“ mehr');
  await p.goto(B+'party.html?thema=einhorn#s-partytag'); await p.waitForSelector('#s-partytag');
  const pt=await p.textContent('#s-partytag');
  ok(!/Generalprobe/.test(pt) && !/Generalprobe/.test(await p.locator('.teile').innerText()), 'Partytag draußen: keine Generalprobe am Vortag mehr');
  await p.context().close();

  // --- UNICORN-61: Generalprobe im Spiel ---
  p=await neu({geolocation:{latitude:53.4995,longitude:9.9,accuracy:6}, permissions:['geolocation']});
  await p.goto(B+'impressum.html'); await p.evaluate(pl=>{ localStorage.clear(); localStorage.setItem('sj.einfuehrung.v2','1'); localStorage.setItem('sj.plan.einhorn', JSON.stringify(pl)); }, PLAN);
  await p.goto(B+'spiel.html?thema=einhorn&probe=1'); await p.waitForSelector('#probe:not([hidden])');
  ok(/Generalprobe/.test(await p.textContent('#probe')) && (await p.evaluate(()=>window.__zs.state().probe))===true, 'Link mit probe=1 startet die Generalprobe');
  await p.waitForFunction(()=>/GPS ±\d+ m/.test(document.getElementById('probe-wert').textContent), null, {timeout:10000});
  ok(true, 'Leiste zeigt die GPS-Genauigkeit');
  await p.click('#btn-main');
  for(let i=0;i<8;i++){ if((await p.evaluate(()=>window.__zs.state().phase))==='seek') break; await p.click('#btn-main'); await p.waitForTimeout(400); }
  await p.waitForFunction(()=>/noch \d+ m/.test(document.getElementById('probe-wert').textContent), null, {timeout:10000});
  ok(/Punkt 2 hier setzen/.test(await p.textContent('#probe')), 'Unterwegs: Abstand und „Punkt 2 hier setzen“');
  await p.click('[data-probe-setzen="1"]'); await p.waitForTimeout(200);
  const pt1=await p.evaluate(()=>window.__zs.state().points[1]);
  ok(pt1 && Math.abs(pt1.lat-53.4995)<1e-4, 'Punkt 2 liegt jetzt am Standort');
  await p.click('#btn-erw');
  ok(/Generalprobe beenden/.test(await p.textContent('#btn-probe')), 'Menü: „Generalprobe beenden“');
  await p.click('#btn-probe'); await p.waitForTimeout(300);
  const st=await p.evaluate(()=>window.__zs.state());
  ok(!st.probe && st.phase==='start' && Math.abs(st.points[1].lat-53.4995)<1e-4 && (await p.locator('#probe').isHidden()), 'Beenden: zurück auf Anfang, Punkte bleiben');
  // Mitten in der Tour: zweimal tippen
  await p.click('#btn-main'); await p.waitForTimeout(300); await p.click('#btn-main'); await p.waitForTimeout(300);
  await p.click('#btn-erw'); await p.click('#btn-probe');
  ok(/noch einmal tippen/.test(await p.textContent('#btn-probe')) && !(await p.evaluate(()=>window.__zs.state().probe)), 'Mitten in der Tour: erst nachfragen');
  await p.click('#btn-probe'); await p.waitForTimeout(300);
  ok((await p.evaluate(()=>window.__zs.state().probe)) && (await p.evaluate(()=>window.__zs.state().phase))==='start', 'Zweiter Tipp: Generalprobe von vorn');
  await p.context().close();

  ok(!pf.length, 'Keine Seitenfehler'+(pf.length?': '+pf.join(' | '):''));
  await b.close(); console.log(fehler?fehler+' FEHLER':'ALLES OK'); process.exit(fehler?1:0);
})();
