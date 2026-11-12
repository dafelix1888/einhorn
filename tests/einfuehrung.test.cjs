// UNICORN-39: Kurze Einführung für Erwachsene. Vor dem Spielstart einmal angeboten, mit einem Tipp zu überspringen,
// beim Spielstart ein kurzer Hinweis, der nichts aufhält, und in „Einrichten“ erneut startbar.
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
  const gesehen=p=>p.evaluate(()=>localStorage.getItem('sj.einfuehrung.gesehen'));

  // 1) Startklar-Seite: Angebot erscheint einmal, „Überspringen“ räumt es mit einem Tipp weg und merkt es sich
  let p=await neu(); await p.goto(B+'bereit.html?thema=einhorn'); await p.waitForSelector('#einf-angebot');
  ok(/zu jedem Schritt springst/.test(await p.textContent('#einf-angebot')), 'Startklar: Angebot nennt das Springen');
  ok(await p.locator('.einf-schleier').count()===0, 'Startklar: Angebot verdeckt nichts (kein Fenster von selbst)');
  await p.click('#einf-nein');
  ok(await p.locator('#einf-angebot').count()===0 && await gesehen(p)==='1', 'Startklar: ein Tipp auf „Überspringen“ genügt');
  await p.reload(); await p.waitForTimeout(700);
  ok(await p.locator('#einf-angebot').count()===0, 'Startklar: nach dem Überspringen kommt es nicht wieder');
  await p.goto(B+'spiel.html?thema=einhorn'); await p.waitForSelector('#btn-main'); await p.waitForTimeout(1200);
  ok(await p.locator('#einf-angebot').count()===0, 'Spiel: nach dem Überspringen auch hier kein Angebot');
  await p.context().close();

  // 2) Spiel vor dem ersten Start: Angebot, Einführung mit 3 Karten, Tastatur, Fokus
  p=await neu(); await p.goto(B+'spiel.html?thema=einhorn'); await p.waitForSelector('#einf-angebot');
  ok(await p.isVisible('#btn-main'), 'Spiel: Startknopf bleibt sichtbar neben dem Angebot');
  await p.focus('#einf-ja'); await p.keyboard.press('Enter'); await p.waitForSelector('.einf-blatt');
  ok(await p.getAttribute('.einf-blatt','role')==='dialog' && await p.getAttribute('.einf-blatt','aria-modal')==='true', 'Einführung: als Dialog ausgezeichnet');
  ok(await p.evaluate(()=>document.activeElement.id)==='einf-weiter', 'Einführung: Fokus liegt auf „Weiter“');
  ok(/Erwachsene/.test(await p.textContent('#einf-text')), 'Einführung 1: Menü „Erwachsene“');
  await p.keyboard.press('Tab'); const f1=await p.evaluate(()=>document.activeElement.id);
  await p.keyboard.press('Tab'); const f2=await p.evaluate(()=>document.activeElement.id);
  ok(f1==='einf-skip' && f2==='einf-weiter', 'Einführung: Tab bleibt im Fenster ('+f1+', '+f2+')');
  await p.keyboard.press('Enter');
  ok(/Ablauf/.test(await p.textContent('#einf-titel')) && await p.locator('.einf-bild .einf-ring').count()===1, 'Einführung 2: Springen über „Ablauf“ hervorgehoben');
  await p.click('#einf-weiter'); ok(await p.textContent('#einf-weiter')==='Los geht’s', 'Einführung 3: letzter Knopf „Los geht’s“');
  await p.click('#einf-weiter');
  ok(await p.locator('.einf-blatt').count()===0 && await p.locator('#einf-angebot').count()===0 && await gesehen(p)==='1', 'Einführung: nach „Los geht’s“ zu und gemerkt');

  // 3) Spielstart: kurzer Hinweis, hält den Start nicht auf, ein Tipp schließt ihn, kommt nur einmal
  await p.click('#btn-main'); await p.waitForSelector('#einf-tipp');
  ok(/Ablauf/.test(await p.textContent('#einf-tipp')), 'Spielstart: Hinweis auf „Ablauf“');
  ok(/Station 1/.test(await p.textContent('#station-nr')), 'Spielstart: Tour läuft trotz Hinweis');
  await p.waitForTimeout(700); await p.mouse.click(190, 600);
  ok(await p.locator('#einf-tipp').count()===0, 'Spielstart: ein Tipp irgendwohin schließt den Hinweis');
  await p.reload(); await p.waitForSelector('#btn-main'); await p.waitForTimeout(1200);
  ok(await p.locator('#einf-tipp').count()===0 && await p.locator('#einf-angebot').count()===0, 'Mitten in der Tour: nichts erscheint von selbst');

  // 4) Einrichten → Tour: „Einführung noch einmal zeigen“, Esc schließt
  await p.click('#btn-erw'); await p.click('#tab-setup'); await p.evaluate(()=>{ document.getElementById('k-tour').open=true; });
  await p.click('#btn-einf'); await p.waitForSelector('.einf-blatt');
  ok(true, 'Einrichten: Einführung lässt sich erneut starten');
  await p.keyboard.press('Escape'); ok(await p.locator('.einf-blatt').count()===0, 'Einführung: Esc schließt');
  ok(await p.evaluate(()=>document.activeElement.id)==='btn-einf', 'Einführung: Fokus kehrt zum Knopf zurück');
  await p.context().close();

  // 5) Ohne Einführung direkt starten: Angebot verschwindet, Hinweis kommt, Einführung gilt als erledigt
  p=await neu(); await p.goto(B+'spiel.html?thema=einhorn'); await p.waitForSelector('#einf-angebot');
  await p.click('#btn-main'); await p.waitForSelector('#einf-tipp');
  ok(await p.locator('#einf-angebot').count()===0 && await gesehen(p)==='1', 'Direkt gestartet: Angebot weg, kommt nicht wieder');
  await p.keyboard.press('Escape'); await p.waitForTimeout(700); await p.keyboard.press('Escape');
  ok(await p.locator('#einf-tipp').count()===0, 'Hinweis: Esc schließt');
  await p.context().close();

  // 6) Weniger Bewegung: keine Animation
  p=await neu({reducedMotion:'reduce'}); await p.goto(B+'spiel.html?thema=einhorn'); await p.waitForSelector('#einf-angebot'); await p.click('#einf-ja');
  const anim=await p.evaluate(()=>[getComputedStyle(document.querySelector('.einf-blatt')).animationName, getComputedStyle(document.querySelector('.einf-ring')).animationName].join(','));
  ok(anim==='none,none', 'Weniger Bewegung: keine Animation ('+anim+')');
  await p.context().close();

  ok(errs.length===0, 'keine JS-Fehler '+(errs.length?JSON.stringify(errs.slice(0,3)):''));
  console.log(f?f+' FEHLER':'ALLES OK'); await b.close(); process.exit(f?1:0);
})();
