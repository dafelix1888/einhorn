// „Wer war das?“ (UNICORN-62): Spur kurz zeigen, Nebel, aus dem Gedächtnis malen, vergleichen.
// Und der Zauberspiegel wird an der Haustür erklärt (UNICORN-63).
const { chromium } = require('playwright');
const fs=require('fs'), path=require('path');
const B=(process.env.BASIS||'http://localhost:8765')+'/app/';
let fehler=0; const ok=(c,t)=>{ console.log((c?'ok   ':'FEHLER ')+t); if(!c) fehler++; };
const tour=JSON.parse(fs.readFileSync(path.join(__dirname,'..','app/themen/einhorn/tour.json'),'utf8'));

(async()=>{
  // Texte
  const s4=tour.stationen[4];
  ok(!!s4.merken && s4.kind==='wahl', 'Station 4 hat den Merk-Ablauf');
  ok(!/Fuchs/.test(s4.say+s4.merken.malen+s4.merken.vergleich+s4.merken.drinnen.vergleich), 'Vor der Lösung sagt niemand „Fuchs“');
  ok(/Zauberspiegel/.test(tour.stationen[0].say) && /meinen Regenbogen gemopst/.test(tour.stationen[0].say2), 'Haustür: Funkel stellt den Zauberspiegel vor (UNICORN-63)');

  const b=await chromium.launch(), p=await b.newPage({viewport:{width:393,height:852}});
  const pf=[]; p.on('pageerror',e=>pf.push(e.message));
  const auf=async v=>{
    await p.goto(B+'spiel.html?thema=einhorn'); await p.waitForFunction(()=>window.__zs);
    await p.evaluate(v=>{ const s=__zs.state(); s.variante=v; s.phase='scene'; s.idx=4; s.step=0; s.spur=''; localStorage.setItem('sj.einhorn.v1', JSON.stringify(s)); }, v);
    await p.reload(); await p.waitForFunction(()=>window.__zs && document.querySelector('#mirror-pic svg'));
  };
  const zustand=()=>p.evaluate(()=>__zs.state().spur||'');
  const haupt=()=>p.locator('#btn-main').innerText();

  // Draußen
  await auf('a');
  ok(await p.locator('#mirror-pic.nebel').count()===1 && await p.locator('#choices .choice').count()===0, 'Draußen: Spur liegt unter Nebel, keine Auswahl');
  ok(/Spur zeigen/.test(await haupt()), 'Knopf „Spur zeigen“');
  await p.click('#btn-main'); await p.waitForTimeout(200);
  ok(await zustand()==='zeigen' && await p.locator('#mirror-pic.spur-sichtbar').count()===1 && await p.locator('#mirror-pic .spur-uhr').count()===1, 'Spur ist sichtbar, die Uhr läuft');
  ok(await p.locator('#choices .choice').count()===0, 'Während die Spur zu sehen ist: keine Auswahl');
  await p.waitForFunction(()=>__zs.state().spur==='nebel', null, {timeout:8000});
  ok(await p.locator('#mirror-pic.nebel').count()===1 && /Fertig gemalt/.test(await haupt()), 'Nach 5 Sekunden Nebel, Knopf „Fertig gemalt“');
  ok(await p.locator('[data-spur-nochmal]').count()===1 && await p.locator('#choices .choice').count()===0, 'Beim Malen: „Spur noch einmal zeigen“, noch keine Auswahl');
  ok(/Zaubertafel/.test(await p.locator('#scene-say').innerText()), 'Funkel sagt: Zaubertafel suchen und malen');
  await p.click('#btn-main'); await p.waitForTimeout(200);
  ok(await zustand()==='wahl' && await p.locator('#choices .choice').count()===3, 'Nach „Fertig gemalt“: drei Spuren zur Auswahl');
  ok(await p.locator('#choices .choice.richtig, #choices .choice.falsch').count()===0 && (await p.locator('#choices .choice span').allInnerTexts()).every(t=>t==='?'), 'Alle drei gleich, ohne Namen');
  ok(await p.locator('#mirror-pic.nebel').count()===1, 'Die Spur bleibt beim Vergleichen im Nebel');
  ok(/neben meinen Spiegel/.test(await p.locator('#scene-say').innerText()), 'Funkel: Tafel neben den Spiegel halten');
  await p.click('#choices .choice[data-id="hase"]'); await p.waitForTimeout(150);
  ok(/War eure Spur so lang/.test(await p.locator('#scene-say').innerText()), 'Falsche Wahl: Hinweis auf die eigene Spur');
  await p.click('[data-spur-nochmal]'); await p.waitForTimeout(150);
  ok(await zustand()==='zeigen', '„Spur noch einmal zeigen“ zeigt sie wieder');
  await p.waitForFunction(()=>__zs.state().spur==='wahl', null, {timeout:6000});
  ok(true, 'Danach zurück zur Auswahl (kein zweites Malen)');
  await p.click('#choices .choice[data-id="fuchs"]'); await p.waitForTimeout(200);
  ok(await p.evaluate(()=>__zs.state().step)===1 && /Ein Fuchs!/.test(await p.locator('#scene-say').innerText()) && /einsteck|hinterher/.test(await p.locator('#scene-say').innerText()), 'Richtig: „Ein Fuchs!“, Tafel einstecken');
  ok(await p.locator('#mirror-pic.nebel').count()===0, 'Nach der Lösung kein Nebel mehr');

  // Neu laden während die Spur zu sehen ist: Uhr läuft weiter
  await auf('a'); await p.click('#btn-main'); await p.reload(); await p.waitForFunction(()=>window.__zs);
  await p.waitForFunction(()=>__zs.state().spur==='nebel', null, {timeout:8000});
  ok(true, 'Nach Neuladen geht der Nebel trotzdem auf');

  // Drinnen: kein Malen vor der Wahl, Tafel liegt hinter der Fuchs-Tür
  await auf('c');
  await p.click('#btn-main'); await p.waitForFunction(()=>__zs.state().spur==='wahl', null, {timeout:8000});
  ok(await p.locator('#choices .choice').count()===3 && /Türen/.test(await p.locator('#scene-say').innerText()), 'Drinnen: nach dem Nebel gleich die Auswahl, Spurenkarten vor den Türen');
  await p.click('#choices .choice[data-id="fuchs"]'); await p.waitForTimeout(200);
  ok(/Fuchs-Tür/.test(await p.locator('#scene-say').innerText()), 'Drinnen: Lösung führt zur Fuchs-Tür');

  ok(!pf.length, 'Keine JS-Fehler'+(pf.length?': '+pf[0]:''));
  await b.close();
  console.log(fehler?fehler+' FEHLER':'ALLES OK'); process.exit(fehler?1:0);
})();
