// „Funkel kennt …“ als eigener Moment (UNICORN-56): Vorschau im Assistenten, Ansicht #namen ohne Anmeldung,
// Zeitstrahl mit den drei Namens-Stellen, ganzer Text, Anmeldung erst beim Einsprechen.
const { chromium } = require('playwright');
const B=process.env.BASIS||'http://localhost:8765/app/';
let fehler=0; const ok=(b,t)=>{ console.log((b?'ok   ':'FEHL ')+t); if(!b) fehler++; };
(async()=>{
  const b=await chromium.launch(), c=await b.newContext({viewport:{width:393,height:852}});
  await c.addInitScript(()=>{ window.KONTO_TEST={url:'https://test.supabase.co',key:'anon'}; });
  await c.route(/^https?:\/\/(?!localhost)/, r=>r.abort());
  const p=await c.newPage(); const pf=[]; p.on('pageerror', e=>pf.push(e.message));
  const datum=new Date(Date.now()+10*864e5).toISOString().slice(0,10);

  // 1. Assistent: im Schritt „Fertig“ steht schon, was Funkel sagt
  await p.goto(B+'party.html?thema=einhorn');
  await p.evaluate(()=>{ localStorage.clear(); sessionStorage.clear(); localStorage.setItem('sj.plan.einhorn', JSON.stringify({format:1,thema:'einhorn',variante:'c',kinder:7,stationen:[],strecke:0})); });
  await p.goto(B+'party.html?thema=einhorn&neu=1'); await p.waitForSelector('#name');
  await p.fill('#name','Mia'); await p.fill('#alter','6'); await p.fill('#datum',datum);
  for(let i=0;i<4 && !(await p.locator('.zusammen').count());i++){ await p.click('#weiter'); await p.waitForTimeout(250); }
  const v=p.locator('.nm-vorschau');
  ok(await v.count()===1 && /Funkel kennt Mia/.test(await v.innerText()) && await v.locator('mark').first().innerText()==='Mia', 'Fertig-Schritt: Vorschau „Funkel kennt Mia“ mit Satz, Name hervorgehoben');
  await p.click('#weiter'); await p.waitForSelector('.namen-pille', {timeout:5000});
  ok(/Funkel sagt „Mia“/.test(await p.locator('.namen-pille').innerText()), 'Nach „Plan erstellen“: Hinweis „Funkel sagt „Mia““ im Überblick');

  // 2. Ansicht ohne Anmeldung: alles sichtbar, Einsprechen führt zur Anmeldung
  await p.click('.namen-pille'); await p.waitForSelector('.nm-strahl', {timeout:5000}); await p.waitForTimeout(200);
  ok(/#namen$/.test(p.url()), 'Adresse #namen');
  ok(await p.locator('.nm-strahl .nm-p.nm-name').count()===3 && await p.locator('.nm-moment').count()===3, 'Ohne Anmeldung: Zeitstrahl und drei Stellen');
  ok(/6 Jahre, wie toll!/.test(await p.locator('.nm-moment').nth(1).innerText()), 'Alters-Satz beim Schatz (6)');
  ok(await p.locator('#nm-haupt [data-konto="anmelden"]').count()===1 && await p.locator('[data-namen-los]').count()===0, 'Knopf „Party sichern und einsprechen“ statt Einsprechen');
  ok(await p.locator('[data-namen-ganz]').count()===0, 'Ohne Ton kein „Mit Geschichte“');
  await p.click('#nm-haupt [data-namen-beispiel]'); await p.waitForTimeout(400);
  ok(await p.locator('.nm-buehne.spricht').count()===1 && /Emma/.test(await p.locator('#nm-untertitel').innerText()), 'Hörprobe mit „Emma“: Funkel spricht, Satz eingeblendet');
  await p.click('#nm-haupt [data-namen-beispiel]'); await p.waitForTimeout(100);
  ok(await p.locator('.nm-buehne.spricht').count()===0, 'Zweiter Tipp hält die Hörprobe an');
  await p.fill('#namen-name','Lotta'); await p.waitForTimeout(100);
  ok(/Lotta/.test(await p.locator('#nm-untertitel').innerText()) && /Lotta!/.test(await p.locator('.nm-strahl').innerText()), 'Name tippen: Funkels Satz und Zeitstrahl sofort mit „Lotta“');
  await p.fill('#namen-name','Mia');
  await p.screenshot({path:require('path').join(require('os').tmpdir(),'namen-ohne-konto.png'), fullPage:true});

  // 3. Direktlink und Zurück
  await p.click('#zum-ueberblick'); await p.waitForSelector('.namen-pille');
  ok(!/#namen/.test(p.url()), 'Überblick: Adresse ohne #namen');
  await p.goto(B+'party.html?thema=einhorn#namen'); await p.waitForSelector('.nm-strahl', {timeout:5000});
  ok(/Funkel kennt Mia/.test(await p.locator('.namen-ansicht h1').innerText()), 'Direktlink #namen öffnet die Ansicht');
  await p.click('[data-oeffne="geraet"]').catch(()=>{});
  ok(pf.length===0, 'keine JS-Fehler '+pf.join(' | '));
  await b.close(); console.log(fehler?fehler+' Fehler':'Alles grün'); process.exit(fehler?1:0);
})();
