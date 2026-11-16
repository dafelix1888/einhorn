// Führung für Erwachsene (UNICORN-39, erweitert in UNICORN-54):
// „Zum ersten Mal hier?“ auf dem ersten Bildschirm des Spiels (ohne Scrollen sichtbar, verdeckt den Startknopf nicht),
// Einführung mit Menü, Springen und dem, was bei „zu früh“ oder „öffnet nicht“ hilft, Hilfe im Menü,
// Tipps unterwegs je einmal und zusammen abschaltbar. Alles mit einem Tipp zu überspringen.
const { chromium } = require('playwright');
const B=(process.env.BASIS||'http://localhost:8765')+'/app/';
let f=0; const ok=(c,t)=>{ console.log((c?'ok   ':'FEHLER ')+t); if(!c) f++; };
(async()=>{
  const b=await chromium.launch(), errs=[];
  async function neu(opt){
    const c=await b.newContext(Object.assign({viewport:{width:393,height:852}}, opt||{}));
    await c.addInitScript(()=>{ window.KONTO_TEST={url:'',key:''}; });
    await c.route(u=>!/^https?:\/\/(localhost|127\.0\.0\.1)/.test(u.toString()) && !/^(data|blob):/.test(u.toString()), r=>r.abort());
    const p=await c.newPage(); p.on('pageerror', e=>errs.push(e.message)); return p;
  }
  const gesehen=p=>p.evaluate(()=>localStorage.getItem('sj.einfuehrung.v2'));
  const imBild=(p, s)=>p.locator(s).evaluate(e=>{ const r=e.getBoundingClientRect(); return r.top>=0 && r.bottom<=window.innerHeight && r.left>=0 && r.right<=window.innerWidth; });
  const ueberlappt=(p, a, z)=>p.evaluate(([a,z])=>{ const x=document.querySelector(a).getBoundingClientRect(), y=document.querySelector(z).getBoundingClientRect(); return !(x.right<=y.left || y.right<=x.left || x.bottom<=y.top || y.bottom<=x.top); }, [a,z]);

  // 1) Startklar-Seite: Angebot im Seitenfluss, „Überspringen“ gilt nur dort – das Spiel bietet die Einführung noch einmal an
  let p=await neu(); await p.goto(B+'bereit.html?thema=einhorn'); await p.waitForSelector('#einf-angebot');
  ok(/Zum ersten Mal hier\?/.test(await p.textContent('#einf-angebot')) && /zu früh oder gar nicht/.test(await p.textContent('#einf-angebot')), 'Startklar: Angebot „Zum ersten Mal hier?“ nennt zu früh und gar nicht');
  ok(await p.locator('.einf-schleier').count()===0, 'Startklar: Angebot verdeckt nichts (kein Fenster von selbst)');
  await p.click('#einf-nein');
  ok(await p.locator('#einf-angebot').count()===0 && await gesehen(p)===null, 'Startklar: ein Tipp auf „Überspringen“ genügt');
  await p.reload(); await p.waitForTimeout(700);
  ok(await p.locator('#einf-angebot').count()===0, 'Startklar: nach dem Überspringen kommt es dort nicht wieder');
  await p.goto(B+'spiel.html?thema=einhorn'); await p.waitForSelector('#einf-angebot');
  ok(true, 'Spiel: bietet die Einführung trotzdem noch einmal an');
  await p.click('#einf-nein');
  ok(await p.locator('#einf-angebot').count()===0 && await gesehen(p)==='1', 'Spiel: „Überspringen“ räumt es weg und merkt es sich');
  await p.reload(); await p.waitForSelector('#btn-main'); await p.waitForTimeout(1200);
  ok(await p.locator('#einf-angebot').count()===0, 'Spiel: danach kommt es nicht wieder');
  await p.context().close();

  // 2) Erster Bildschirm: Angebot ohne Scrollen sichtbar, Startknopf frei – Handy und Tablet quer
  for(const [name, vp] of [['Handy', {width:393,height:852}], ['Tablet quer', {width:1180,height:820}], ['kleines Handy', {width:375,height:667}]]){
    p=await neu({viewport:vp}); await p.goto(B+'spiel.html?thema=einhorn'); await p.waitForSelector('#einf-angebot'); await p.waitForTimeout(1200);
    ok(await imBild(p, '#einf-angebot'), name+': Angebot ist ohne Scrollen ganz zu sehen');
    ok(!(await ueberlappt(p, '#einf-angebot', '#btn-main')), name+': Angebot verdeckt den Startknopf nicht');
    if(name==='Tablet quer') ok(await imBild(p, '#btn-main'), 'Tablet quer: Startknopf ist ohne Scrollen zu sehen');
    await p.context().close();
  }

  // 3) Einführung draußen: 5 Karten, Tastatur, Fokus, Zurück
  p=await neu(); await p.goto(B+'spiel.html?thema=einhorn'); await p.waitForSelector('#einf-angebot');
  await p.focus('#einf-ja'); await p.keyboard.press('Enter'); await p.waitForSelector('.einf-blatt');
  ok(await p.getAttribute('.einf-blatt','role')==='dialog' && await p.getAttribute('.einf-blatt','aria-modal')==='true', 'Einführung: als Dialog ausgezeichnet');
  ok(await p.evaluate(()=>document.activeElement.id)==='einf-weiter', 'Einführung: Fokus liegt auf „Weiter“');
  ok(/1 von 5/.test(await p.textContent('#einf-zaehler')), 'Einführung draußen: 5 Karten');
  ok(/Erwachsene/.test(await p.textContent('#einf-text')) && /Hilfe/.test(await p.textContent('#einf-text')), 'Karte 1: Menü „Erwachsene“ mit Ablauf, Einrichten, Hilfe');
  await p.keyboard.press('Tab'); const f1=await p.evaluate(()=>document.activeElement.id);
  await p.keyboard.press('Tab'); const f2=await p.evaluate(()=>document.activeElement.id);
  ok(f1==='einf-skip' && f2==='einf-weiter', 'Einführung: Tab bleibt im Fenster ('+f1+', '+f2+')');
  await p.keyboard.press('Enter');
  ok(/Ablauf/.test(await p.textContent('#einf-titel')) && await p.locator('.einf-bild .einf-ring').count()===1, 'Karte 2: Springen über „Ablauf“ hervorgehoben');
  await p.click('#einf-weiter');
  ok(/Angekommen/.test(await p.textContent('#einf-text')) && /zu früh/.test(await p.textContent('#einf-text')) && /Weiter/.test(await p.textContent('#einf-text')), 'Karte 3: Station meldet sich zu früh – erst an der Stelle „Weiter“');
  await p.click('#einf-weiter');
  ok(/Wir sind da/.test(await p.textContent('#einf-text')) && /Station von Hand öffnen/.test(await p.textContent('#einf-text')), 'Karte 4: Station öffnet nicht – „Wir sind da“ oder von Hand');
  await p.click('#einf-zurueck'); ok(/3 von 5/.test(await p.textContent('#einf-zaehler')), 'Einführung: „Zurück“ geht eine Karte zurück');
  await p.click('#einf-weiter'); await p.click('#einf-weiter');
  ok(await p.textContent('#einf-weiter')==='Los geht’s' && /Funkel sprechen lassen/.test(await p.textContent('#einf-text')), 'Karte 5: Funkel und Erzähler, letzter Knopf „Los geht’s“');
  await p.click('#einf-weiter');
  ok(await p.locator('.einf-blatt').count()===0 && await p.locator('#einf-angebot').count()===0 && await gesehen(p)==='1', 'Einführung: nach „Los geht’s“ zu und gemerkt');

  // 4) Spielstart: Tipp unter „Erwachsene“, hält den Start nicht auf, ein Tipp irgendwohin schließt ihn, kommt nur einmal
  await p.click('#btn-main'); await p.waitForSelector('#einf-tipp');
  ok(/Ablauf/.test(await p.textContent('#einf-tipp')) && /Hilfe/.test(await p.textContent('#einf-tipp')), 'Spielstart: Tipp nennt „Ablauf“ und „Hilfe“');
  ok(/Station 1/.test(await p.textContent('#station-nr')), 'Spielstart: Tour läuft trotz Tipp');
  await p.waitForTimeout(700); await p.mouse.click(190, 600);
  ok(await p.locator('#einf-tipp').count()===0, 'Spielstart: ein Tipp irgendwohin schließt ihn');
  await p.reload(); await p.waitForSelector('#btn-main'); await p.waitForTimeout(1200);
  ok(await p.locator('#einf-tipp').count()===0 && await p.locator('#einf-angebot').count()===0, 'Mitten in der Tour: nichts erscheint von selbst');

  // 5) Menü „Erwachsene“ → „Hilfe“: Liste zum Nachschlagen, Esc schließt, Fokus zurück
  await p.click('#btn-erw');
  ok(await p.locator('#btn-hilfe').isVisible() && /Spielart, Erzähler/.test(await p.textContent('#tab-setup')), 'Menü: „Hilfe“ ist da, „Einrichten“ nennt Spielart und Erzähler');
  await p.click('#btn-hilfe'); await p.waitForSelector('.einf-hilfe');
  const fragen=await p.locator('.einf-hilfe summary').allInnerTexts();
  ok(fragen[0]==='Station öffnet sich nicht' && fragen.includes('Station meldet sich zu früh') && fragen.includes('Kein Ton'), 'Hilfe: das Häufigste zuerst ('+fragen.join(' · ')+')');
  await p.click('[data-hilfe="oft"] summary');
  ok(/10 m/.test(await p.locator('[data-hilfe="oft"] p').innerText()), 'Hilfe: „oft zu früh“ nennt den Abstand 10 m');
  await p.click('[data-hilfe="ton"] summary');
  ok(await p.locator('.einf-hilfe details[open]').count()===1, 'Hilfe: immer nur eine Antwort offen');
  await p.keyboard.press('Escape'); ok(await p.locator('.einf-hilfe').count()===0, 'Hilfe: Esc schließt');

  // 6) Einrichten → Tour: Einführung erneut, Tipps abschaltbar
  await p.click('#btn-erw'); await p.click('#tab-setup'); await p.evaluate(()=>{ document.getElementById('k-tour').open=true; });
  await p.click('#btn-einf'); await p.waitForSelector('.einf-blatt');
  ok(true, 'Einrichten: Einführung lässt sich erneut starten');
  await p.keyboard.press('Escape'); ok(await p.locator('.einf-blatt').count()===0, 'Einführung: Esc schließt');
  ok(await p.evaluate(()=>document.activeElement.id)==='btn-einf', 'Einführung: Fokus kehrt zum Knopf zurück');
  ok(await p.locator('#tipps-an').isChecked(), 'Einrichten: Schalter „Tipps für Erwachsene“ ist an');
  await p.evaluate(()=>{ const e=document.getElementById('tipps-an'); e.checked=false; e.dispatchEvent(new Event('change',{bubbles:true})); });
  ok(await p.evaluate(()=>!window.Einfuehrung.tippsAn() && !window.Einfuehrung.tippOffen('unterwegs')), 'Tipps aus: unterwegs kommt keiner mehr');
  await p.context().close();

  // 7) Ohne Einführung direkt starten: Angebot verschwindet, Tipp kommt; „Keine Tipps mehr“ schaltet alle ab
  p=await neu(); await p.goto(B+'spiel.html?thema=einhorn'); await p.waitForSelector('#einf-angebot');
  await p.click('#btn-main'); await p.waitForSelector('#einf-tipp');
  ok(await p.locator('#einf-angebot').count()===0 && await gesehen(p)==='1', 'Direkt gestartet: Angebot weg, kommt nicht wieder');
  await p.waitForTimeout(700); await p.click('#einf-tipp-aus');
  ok(await p.locator('#einf-tipp').count()===0 && await p.evaluate(()=>!window.Einfuehrung.tippsAn()), '„Keine Tipps mehr“: Tipp weg, Tipps abgeschaltet');
  ok(!(await p.locator('#tipps-an').isChecked()), 'Schalter in „Einrichten“ steht danach auf aus');
  await p.context().close();

  // 8) Drinnen: Einführung ohne GPS-Karten, dafür „Station öffnen“
  p=await neu(); await p.goto(B+'impressum.html');
  await p.evaluate(()=>{ localStorage.setItem('sj.plan.einhorn', JSON.stringify({format:1,thema:'einhorn',variante:'c',kinder:6,stand:'2026-11-01T10:00:00Z',stationen:[],strecke:0})); });
  await p.goto(B+'spiel.html?thema=einhorn'); await p.waitForSelector('#einf-angebot');
  ok(/drinnen die Stationen öffnest/.test(await p.textContent('#einf-angebot')), 'Drinnen: Angebot spricht vom Öffnen der Stationen');
  await p.click('#einf-ja'); await p.waitForSelector('.einf-blatt');
  ok(/1 von 4/.test(await p.textContent('#einf-zaehler')), 'Drinnen: 4 Karten');
  await p.click('#einf-weiter'); await p.click('#einf-weiter');
  ok(/Station öffnen/.test(await p.textContent('#einf-text')) && !/GPS/.test(await p.textContent('#einf-text')), 'Drinnen: Karte „Station öffnen“ statt GPS');
  await p.keyboard.press('Escape');
  await p.context().close();

  // 9) Weniger Bewegung: keine Animation
  p=await neu({reducedMotion:'reduce'}); await p.goto(B+'spiel.html?thema=einhorn'); await p.waitForSelector('#einf-angebot');
  const a0=await p.evaluate(()=>getComputedStyle(document.getElementById('einf-angebot')).animationName);
  await p.click('#einf-ja');
  const anim=await p.evaluate(()=>[getComputedStyle(document.querySelector('.einf-blatt')).animationName, getComputedStyle(document.querySelector('.einf-ring')).animationName].join(','));
  ok(a0==='none' && anim==='none,none', 'Weniger Bewegung: keine Animation ('+a0+','+anim+')');
  await p.context().close();

  ok(errs.length===0, 'keine JS-Fehler '+(errs.length?JSON.stringify(errs.slice(0,3)):''));
  console.log(f?f+' FEHLER':'ALLES OK'); await b.close(); process.exit(f?1:0);
})();
