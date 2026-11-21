// Wichtel Bommi (UNICORN-142): Eltern-Ansicht. Fortschritt für Paket Klein und Ganz, „morgen dran“, Vorbereitungs-Seite je Geschichte am Handy.
const fs=require('fs'), path=require('path');
const WK=require('../app/wichtel-kern.js');
const W=path.join(__dirname,'..','app','themen','wichtel');
const M=JSON.parse(fs.readFileSync(path.join(W,'material.json'),'utf8'));
const G=JSON.parse(fs.readFileSync(path.join(W,'geschichten.json'),'utf8'));
const B=(process.env.BASIS||'http://localhost:8765');
let f=0; const ok=(c,t)=>{ console.log((c?'ok   ':'FEHLER ')+t); if(!c) f++; };
const wahl=(paket, szenario='gemischt')=>({ nr:WK.paket(M,paket), szenario, erster:'2026-12-01', letzter:'2026-12-22', sonntage:paket==='advent', eigene:{} });

// Fortschritt
const klein=WK.plan(M,G,wahl('klein'),'2026-11-21'), ganz=WK.plan(M,G,wahl('ganz'),'2026-11-21');
ok(WK.fortschritt(klein.zeilen,[]).text==='0 von 3 Bommeln', 'Klein: 0 von 3 Bommeln');
ok(WK.fortschritt(klein.zeilen,[1,2]).text==='2 von 3 Bommeln', 'Klein: 2 von 3 Bommeln');
ok(WK.fortschritt(klein.zeilen,[1,3,4,5]).text==='1 von 3 Bommeln', 'Klein: Geschichten außerhalb des Pakets zählen nicht');
ok(WK.fortschritt(klein.zeilen,[1,2,8]).fertig, 'Klein: alle 3 gespielt = fertig');
ok(WK.fortschritt(ganz.zeilen,[1,2,3]).text==='3 von 8 Bommeln', 'Ganz: 3 von 8 Bommeln');
ok(WK.fortschritt(ganz.zeilen,['1','2','2']).gespielt===2, 'Ganz: doppelte und Text-Nummern zählen einmal');
ok(!WK.fortschritt(ganz.zeilen,[1,2,3,4,5,6,7]).fertig && WK.fortschritt(ganz.zeilen,[1,2,3,4,5,6,7,8]).fertig, 'Ganz: fertig erst bei 8 von 8');

// Morgen dran
const d=WK.dran(ganz.zeilen,'2026-12-03');
ok(d.morgen && d.morgen.nr===2 && !d.heute, 'Am 3.12. ist morgen Geschichte 2 dran');
ok(WK.dran(ganz.zeilen,'2026-12-01').heute.nr===1, 'Am 1.12. ist heute Geschichte 1 dran');
ok(!WK.dran(ganz.zeilen,'2026-11-21').morgen, 'Im November ist noch nichts dran');

// Vorbereitungs-Seite: alle 8 mit echtem Text
for(const z of ganz.zeilen){
  const g=G.geschichten.find(x=>x.nr===z.nr), v=WK.vorbereitung(z,g);
  ok(v.aufbau.length===4 && /Bommel dazulegen/.test(v.aufbau[3]) && v.aufbau[3].includes(g.bommel), 'Nr. '+z.nr+': 3 Schritte Aufbau plus '+g.bommel+'er Bommel zum Schluss');
  ok(v.mitmachen.length>10 && /Oma Mooswinkel$/.test(v.brief) && v.material.length>0, 'Nr. '+z.nr+': Mitmachen, Brief und Material da');
}
const v1g=WK.vorbereitung(ganz.zeilen[0], G.geschichten[0]), v1s=WK.vorbereitung(WK.plan(M,G,wahl('ganz','selbst'),null).zeilen[0], G.geschichten[0]);
ok(v1g.material.find(m=>m.id==='tuer').gekauft && !v1s.material.find(m=>m.id==='tuer').gekauft, 'Material passt zum Weg: Tür bei Gemischt gekauft, bei Selbst gebastelt');
ok(v1s.material.every(m=>m.selbst), 'Jeder Artikel hat einen Ersatz zum Selbermachen');

// Im Browser (Handy)
(async()=>{
  let chromium; try{ ({chromium}=require('playwright')); }catch(e){ console.log('ohne Playwright: Browser-Teil übersprungen'); return ende(); }
  const b=await chromium.launch();
  const c=await b.newContext({viewport:{width:393,height:852}});
  await c.route(u=>!/^https?:\/\/(localhost|127\.0\.0\.1)/.test(u.toString()), r=>r.abort());
  await c.addInitScript(()=>{ if(!sessionStorage.getItem('x')){ sessionStorage.setItem('x','1'); localStorage.setItem('sj.wichtel', JSON.stringify({schritt:3, paket:'klein', nr:[1,2,8], szenario:'gemischt', erster:'2026-12-01', letzter:'2026-12-22', eigene:{}})); localStorage.setItem('sj.wichtel.gespielt', JSON.stringify([1])); } });
  const p=await c.newPage(), errs=[]; p.on('pageerror', e=>errs.push(e.message));
  await p.goto(B+'/app/wichtel.html'); await p.waitForSelector('#vorbereiten');
  await p.click('#vorbereiten');
  ok(await p.locator('#vorb li').count()===3, 'Übersicht: 3 Geschichten aus dem Paket Klein');
  ok((await p.locator('#fortschritt').innerText()).includes('1 von 3 Bommeln'), 'Übersicht: 1 von 3 Bommeln');
  ok(await p.locator('#fortschritt .punkte i.an').count()===1, 'Übersicht: ein Bommel leuchtet');
  await p.click('#vorb button[data-nr="2"]');
  ok((await p.locator('#vg-titel').innerText()).startsWith('2. '), 'Vorbereitung: Geschichte 2 offen');
  ok(await p.locator('#vg-aufbau li').count()===4, 'Vorbereitung: 4 Schritte Aufbau');
  ok((await p.locator('#vg-brief').innerText()).includes('Oma Mooswinkel'), 'Vorbereitung: Brief von Oma Mooswinkel');
  ok((await p.locator('#vg-kinder').getAttribute('href'))==='wichtel-kind.html?nr=2', 'Knopf „Den Kindern zeigen“ öffnet Geschichte 2');
  ok(await p.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth), 'Handy: nichts ragt seitlich heraus');
  await p.screenshot({path:path.join(process.env.BILDER||require('os').tmpdir(),'wichtel-vorbereiten.png'), fullPage:true}).catch(()=>{});
  await p.reload(); await p.waitForSelector('#vg-titel:not(:empty)');
  ok((await p.locator('#vg-titel').innerText()).startsWith('2. '), 'Nach Neuladen bleibt Geschichte 2 offen');
  await p.evaluate(()=>document.body.classList.add('brief-druck')); await p.emulateMedia({media:'print'});
  ok(await p.locator('#druck-brief').isVisible() && !(await p.locator('.druck-tabelle').isVisible()), 'Brief drucken: nur der Brief');
  ok(errs.length===0, 'keine JS-Fehler '+errs.slice(0,2).join(' | '));
  await b.close(); ende();
})();
function ende(){ console.log(f?f+' FEHLER':'ALLES OK'); process.exit(f?1:0); }
