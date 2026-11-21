// Wichtel Bommi (UNICORN-143): Kinder-Ansicht. Erst das Video, dann die Bildergeschichte mit „Bommi liest vor“.
// Am Handy und am Tablet, einmal mit Video und einmal ohne (dann startet sie direkt mit den Bildern).
const { chromium } = require('playwright');
const B=(process.env.BASIS||'http://localhost:8765');
let f=0; const ok=(c,t)=>{ console.log((c?'ok   ':'FEHLER ')+t); if(!c) f++; };
const sichtbar=(p,id)=>p.evaluate(i=>!document.getElementById(i).hidden, id);
const namen=p=>p.evaluate(()=>window.wichtelMessung.map(e=>e.name+':'+(e.props.format||'')));

(async()=>{
  const b=await chromium.launch();
  for(const [name, vp] of [['Handy',{width:393,height:852}],['Tablet',{width:820,height:1180}]]){
    // ---- mit Video ----
    let c=await b.newContext({viewport:vp, hasTouch:true});
    await c.route(u=>!/^https?:\/\/(localhost|127\.0\.0\.1)/.test(u.toString()), r=>r.abort());
    let p=await c.newPage(), errs=[]; p.on('pageerror', e=>errs.push(e.message));
    await p.goto(B+'/app/wichtel-kind.html?nr=1');
    await p.waitForSelector('#start:not([hidden])', {timeout:10000});
    ok(await sichtbar(p,'s-video') && !(await sichtbar(p,'s-bilder')), name+': zuerst das Video, keine Bilder');
    ok(await p.locator('a, nav, ul').count()===0, name+': kein Menü, keine Liste');
    const vb=await p.locator('#video').boundingBox();
    ok(vb.height<=vp.height+1 && vb.width<=vp.width+1, name+': Video passt auf den Bildschirm');
    ok(Math.abs((vb.x+vb.width/2)-vp.width/2)<2, name+': Video steht mittig');
    ok(await p.evaluate(()=>getComputedStyle(document.getElementById('video')).objectFit)==='contain', name+': Video wird nicht verzerrt');
    await p.evaluate(()=>{ document.getElementById('video').muted=true; });
    await p.click('#start');
    await p.waitForFunction(()=>!document.getElementById('video').paused, null, {timeout:8000});
    ok(await p.locator('#start').isHidden(), name+': Start-Knopf verschwindet beim Abspielen');
    await p.evaluate(()=>{ const v=document.getElementById('video'); v.pause(); v.dispatchEvent(new Event('ended')); });   // der Test-Server kann nicht vorspulen
    await p.waitForFunction(()=>!document.getElementById('s-bilder').hidden, null, {timeout:10000});
    ok(!(await sichtbar(p,'s-video')), name+': nach dem Video kommt die Bildergeschichte');
    ok(/Mitten in der Nacht/.test(await p.locator('#text').innerText()), name+': Bild 1 mit Text aus geschichten.json');
    ok(await p.locator('#zurueck').isDisabled(), name+': am Anfang kein Zurück');
    const fs=parseFloat(await p.evaluate(()=>getComputedStyle(document.getElementById('text')).fontSize));
    ok(fs>=22, name+': große Schrift zum Vorlesen ('+fs+' px)');
    await p.click('#weiter');
    ok(/Drinnen war alles riesig/.test(await p.locator('#text').innerText()), name+': Pfeil blättert weiter');
    // Wischen nach rechts = zurück
    await p.evaluate(()=>{ const r=document.getElementById('rahmen'), t=(x)=>[new Touch({identifier:1, target:r, clientX:x, clientY:300})];
      r.dispatchEvent(new TouchEvent('touchstart',{touches:t(100), changedTouches:t(100), bubbles:true}));
      r.dispatchEvent(new TouchEvent('touchend',{touches:[], changedTouches:t(260), bubbles:true})); });
    ok(/Mitten in der Nacht/.test(await p.locator('#text').innerText()), name+': Wischen blättert zurück');
    // Bommi liest vor: spielt den Ton und blättert am Ende selbst weiter
    await p.click('#vorlesen');
    ok(await p.locator('#vorlesen').getAttribute('aria-pressed')==='true', name+': Vorlesen ist an');
    await p.waitForFunction(()=>!window.wichtelTon.paused && /g1-bild1\.mp3$/.test(window.wichtelTon.src), null, {timeout:8000}).catch(()=>{});
    ok(await p.evaluate(()=>!window.wichtelTon.paused), name+': Ton zu Bild 1 läuft');
    await p.evaluate(()=>{ const t=window.wichtelTon; t.pause(); t.dispatchEvent(new Event('ended')); });
    await p.waitForFunction(()=>/Drinnen war alles riesig/.test(document.getElementById('text').textContent), null, {timeout:60000}).catch(()=>{});
    ok(/Drinnen war alles riesig/.test(await p.locator('#text').innerText()), name+': nach dem Ton blättert Bommi selbst weiter');
    await p.click('#vorlesen');
    ok(await p.locator('#vorlesen').getAttribute('aria-pressed')==='false', name+': Vorlesen lässt sich ausschalten');
    for(let i=0;i<4;i++) await p.click('#weiter').catch(()=>{});
    ok(await p.locator('#weiter').isDisabled() && await sichtbar(p,'ende'), name+': letztes Bild mit Bommel und Mitmach-Aufgabe');
    ok((await p.locator('#mitmachen').innerText()).includes('Willkommensschild'), name+': Mitmach-Aufgabe steht da');
    ok((await p.locator('#satz').innerText())==='Wo ein Bommel liegt, war ich da.', name+': fester Schluss-Satz');
    ok(JSON.stringify(await p.evaluate(()=>JSON.parse(localStorage.getItem('sj.wichtel.gespielt'))))==='[1]', name+': Geschichte 1 gilt als gespielt');
    const n=await namen(p);
    ok(['wichtel_story_started:video','wichtel_story_completed:video','wichtel_story_started:bilder','wichtel_story_completed:bilder','wichtel_read_aloud:'].every(x=>n.filter(y=>y===x).length===1), name+': Messpunkte je einmal, Video und Bilder getrennt ('+n.join(', ')+')');
    ok(await p.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth), name+': nichts ragt seitlich heraus');
    await p.screenshot({path:require('path').join(process.env.BILDER||require('os').tmpdir(),'wichtel-kind-'+name.toLowerCase()+'.png')}).catch(()=>{});
    // Erwachsene: kurz tippen tut nichts, 2 Sekunden halten führt zurück
    await p.click('#erw'); await p.waitForTimeout(300);
    ok(/wichtel-kind\.html/.test(p.url()), name+': kurzes Tippen auf „Erwachsene“ bleibt in der Geschichte');
    const eb=await p.locator('#erw').boundingBox();
    await p.mouse.move(eb.x+eb.width/2, eb.y+eb.height/2); await p.mouse.down();
    await p.waitForURL(/app\/wichtel\.html/, {timeout:5000}).catch(()=>{}); await p.mouse.up();
    ok(/app\/wichtel\.html/.test(p.url()), name+': 2 Sekunden halten führt zu den Eltern');
    ok(errs.length===0, name+': keine JS-Fehler '+errs.slice(0,2).join(' | '));
    await c.close();

    // ---- ohne Video ----
    c=await b.newContext({viewport:vp});
    await c.route(u=>!/^https?:\/\/(localhost|127\.0\.0\.1)/.test(u.toString()), r=>r.abort());
    await c.route(/g1-video\.mp4/, r=>r.fulfill({status:404, body:''}));
    p=await c.newPage(); errs=[]; p.on('pageerror', e=>errs.push(e.message));
    await p.goto(B+'/app/wichtel-kind.html?nr=1');
    await p.waitForFunction(()=>!document.getElementById('s-bilder').hidden, null, {timeout:8000}).catch(()=>{});
    ok(await sichtbar(p,'s-bilder') && !(await sichtbar(p,'s-video')), name+' ohne Video: startet direkt mit der Bildergeschichte');
    ok(/Mitten in der Nacht/.test(await p.locator('#text').innerText()), name+' ohne Video: Bild 1 ist da');
    ok(!(await namen(p)).some(x=>/:video$/.test(x)), name+' ohne Video: kein Video-Messpunkt');
    ok(errs.length===0, name+' ohne Video: keine JS-Fehler '+errs.slice(0,2).join(' | '));
    await c.close();
  }

  // Heute dran: ohne ?nr= nimmt die Ansicht die letzte Geschichte im Zeitplan, deren Tag erreicht ist.
  const WK=require('../app/wichtel-kern.js');
  const z=[{nr:1,datum:'2026-12-01'},{nr:2,datum:'2026-12-04'},{nr:8,datum:'2026-12-24'}];
  ok(WK.heutige(z,'2026-12-05',null)===2, 'Zeitplan: am 5.12. ist Geschichte 2 dran');
  ok(WK.heutige(z,'2026-11-28',null)===1, 'Zeitplan: vor dem Start ist Geschichte 1 dran');
  ok(WK.heutige(z,'2026-12-05','8')===8, 'Zeitplan: ?nr= gewinnt');
  ok(WK.heutige(null,'2026-12-05',null)===1, 'Ohne Zeitplan: Geschichte 1');
  ok(WK.medien(1).video==='themen/wichtel/muster/g1-video.mp4' && WK.medien(3).bilder[4].ton==='themen/wichtel/g3/g3-bild5.mp3', 'Dateien je Geschichte');

  // Nirgends verlinkt, bis UNICORN-146 den Bereich öffnet
  const fsm=require('fs'), path=require('path'), html=fsm.readFileSync(path.join(__dirname,'..','app','wichtel-kind.html'),'utf8');
  ok(/name="robots" content="noindex/.test(html), 'Kinder-Ansicht ist für Suchmaschinen gesperrt');

  console.log(f?f+' FEHLER':'ALLES OK'); await b.close(); process.exit(f?1:0);
})();
