// Spielart (UNICORN-47): zuerst Draußen oder Drinnen, draußen das Extra „Hinweise am Weg“, ein Name überall
const { chromium } = require('playwright');
const B=process.env.BASIS||'http://localhost:8765/app/';
let fehler=0; const ok=(b,t)=>{ console.log((b?'ok   ':'FEHL ')+t); if(!b) fehler++; };
(async()=>{
  const b=await chromium.launch(), c=await b.newContext({viewport:{width:393,height:852}});
  await c.addInitScript(()=>{ window.KONTO_TEST={url:'',key:''}; });
  await c.route(/^https?:\/\/(?!localhost)/, r=>r.abort());
  const p=await c.newPage(); const pf=[]; p.on('pageerror', e=>pf.push(e.message));
  const plan=()=>p.evaluate(()=>JSON.parse(localStorage.getItem('sj.plan.einhorn')||'null'));
  const party=()=>p.evaluate(()=>JSON.parse(localStorage.getItem('sj.party.einhorn')||'null'));

  // --- 1. Planer: die Spielart ist die erste Frage ---
  await p.goto(B+'planer.html?thema=einhorn'); await p.evaluate(()=>localStorage.clear()); await p.reload(); await p.waitForSelector('[data-spielart]');
  ok(await p.locator('[data-spielart]').count()===2, 'Planer: zwei Karten, Draußen und Drinnen');
  ok(await p.locator('[data-spielart] img').count()===2 && /Dazu brauchst du/.test(await p.locator('.spielarten').innerText()), 'Jede Karte mit Bild und „Dazu brauchst du“');
  ok(await p.locator('#adresse').isHidden() && await p.locator('#planen').isHidden(), 'Ohne Wahl geht es nicht weiter (keine Adresse, kein Knopf)');
  await p.click('[data-spielart="drinnen"]');
  ok(await p.locator('#drinnen').isVisible() && /Speichern und spielen/.test(await p.locator('#planen').innerText()), 'Drinnen: keine Route, „Speichern und spielen“');
  await p.click('[data-spielart="draussen"]');
  ok(await p.locator('#adresse').isVisible() && /Route planen/.test(await p.locator('#planen').innerText()), 'Draußen: Adresse und „Route planen“');
  const text1=await p.locator('#eingabe').innerText();
  ok(!/Outdoor|Indoor|Variante/.test(text1), 'Planer ohne „Outdoor“, „Indoor“, „Variante“');

  // --- 2. Party-Assistent übernimmt die Spielart aus dem Planer ---
  await p.evaluate(()=>{ localStorage.clear(); localStorage.setItem('sj.plan.einhorn', JSON.stringify({format:1,thema:'einhorn',variante:'c',kinder:7,stationen:[],strecke:0})); });
  await p.goto(B+'party.html?thema=einhorn'); await p.waitForSelector('#name');
  await p.fill('#name','Mia'); await p.fill('#alter','5'); await p.fill('#datum', new Date(Date.now()+10*864e5).toISOString().slice(0,10));
  await p.click('#weiter'); await p.waitForSelector('.spielart-zeile');
  ok(/Spielart\s*Drinnen/.test(await p.locator('.spielart-zeile').innerText()), 'Party: zeigt „Spielart: Drinnen“ statt neu zu fragen');
  ok(await p.locator('#ausdrucke').count()===0, 'Schalter „Wenig Aufbau“ ist weg');
  await p.click('#spielart-aendern');
  ok(await p.locator('[data-spielart="drinnen"][aria-pressed="true"]').count()===1, '„ändern“ zeigt die Karten, Drinnen gewählt');
  await p.click('#weiter'); await p.waitForSelector('.erz-liste');          // UNICORN-54: dazwischen „Wer liest die Aufgaben vor?“
  await p.click('#weiter'); await p.waitForSelector('.zusammen');
  ok(/Spielart\s*Drinnen/.test(await p.locator('.summe').innerText()), 'Zusammenfassung nennt die Spielart');

  // --- 3. Bestehende Party draußen: Wechsel zeigt, was sich ändert; Extra im Schritt „Basteln“ ---
  const d=new Date(Date.now()+12*864e5).toISOString().slice(0,10);
  await p.evaluate((d)=>{ localStorage.clear();
    localStorage.setItem('sj.party.einhorn', JSON.stringify({format:1,thema:'einhorn',kind:{name:'Mia',alter:5},datum:d,start:'15:00',kinder:6,helfer:2,vorausgeher:true,ort:'draussen',planB:true,ausdrucke:true,erledigt:{},einkauf:{}}));
    localStorage.setItem('sj.plan.einhorn', JSON.stringify({format:1,thema:'einhorn',variante:'a',kinder:6,stand:'2026-11-01T10:00:00Z',strecke:900,stationen:[{lat:53.5,lng:9.9,name:'Haustür'},{lat:53.501,lng:9.901,name:'Ecke'}]})); }, d);
  await p.goto('about:blank'); await p.goto(B+'party.html?thema=einhorn#s-basteln'); await p.waitForSelector('#extra-hinweise', {state:'attached'});
  ok(/Extra: Echte Hinweise am Weg/.test(await p.locator('.sa-extra').innerText()) && !(await p.locator('#extra-hinweise').isChecked()), 'Basteln: Extra „Echte Hinweise am Weg“, aus');
  await p.check('#extra-hinweise', {force:true}); await p.waitForTimeout(300);
  ok((await party()).ausdrucke===false && (await plan()).variante==='b', 'Extra an: Party und Plan auf „Draußen + Hinweise am Weg“');
  ok(await p.locator('#extra-hinweise').isChecked(), 'Schalter bleibt an');
  await p.goto(B+'party.html?thema=einhorn'); await p.waitForSelector('.held');
  await p.click('#aendern'); await p.waitForSelector('#weiter'); await p.click('#weiter'); await p.waitForSelector('[data-spielart]');
  await p.click('[data-spielart="drinnen"]'); await p.waitForSelector('.sa-wechsel');
  const w=await p.locator('.sa-wechsel').innerText();
  ok(/Wechsel zu „Drinnen“/.test(w) && /Drinnen braucht keine Route/.test(w) && /Kommt dazu/.test(w), 'Wechsel zeigt vorher, was sich ändert: '+w.replace(/\n/g,' · ').slice(0,140));

  // --- 4. Spiel: Spielart unter Einrichten, Extra-Schalter ---
  await p.evaluate((d)=>{ localStorage.setItem('sj.party.einhorn', JSON.stringify({format:1,thema:'einhorn',kind:{name:'Mia',alter:5},datum:d,start:'15:00',kinder:6,helfer:2,vorausgeher:true,ort:'draussen',planB:true,ausdrucke:false,erledigt:{},einkauf:{}}));
    localStorage.setItem('sj.plan.einhorn', JSON.stringify({format:1,thema:'einhorn',variante:'b',kinder:6,stand:'2026-11-02T10:00:00Z',strecke:900,stationen:[]})); }, d);
  await p.goto(B+'spiel.html?thema=einhorn#einrichten'); await p.waitForSelector('#variante [data-spielart]', {state:'attached'});
  ok(await p.locator('#variante [data-spielart="draussen"][aria-pressed="true"]').count()===1, 'Spiel: Draußen gewählt');
  ok(await p.locator('#extra-hinweise').isChecked(), 'Spiel: Extra ist an (wie in der Party)');
  ok(/Draußen \+ Hinweise am Weg/.test(await p.locator('#sum-variante').textContent()), 'Kopfzeile nennt „Draußen + Hinweise am Weg“');
  await p.evaluate(()=>{ const e=document.getElementById('extra-hinweise'); e.checked=false; e.dispatchEvent(new Event('change',{bubbles:true})); }); await p.waitForTimeout(300);
  ok((await party()).ausdrucke===true && (await plan()).variante==='a', 'Extra aus im Spiel: Party und Plan folgen');
  ok(/Wechsel zu „Draußen“/.test(await p.locator('#variante-note').innerText()), 'Spiel zeigt, was sich ändert');
  const text4=await p.locator('#view-setup').innerText();
  ok(!/Outdoor|Indoor/.test(text4), 'Spiel ohne „Outdoor“ und „Indoor“');

  ok(!pf.length, 'Keine Seitenfehler'+(pf.length?': '+pf.join(' | '):''));
  await b.close(); console.log(fehler?fehler+' FEHLER':'ALLES OK'); process.exit(fehler?1:0);
})();
