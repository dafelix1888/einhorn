// Wichtel Bommi (UNICORN-141): Einstieg → Auswahl → Material-Weg → Zeitplan läuft am Handy und am Tablet, Wahl bleibt auf dem Gerät.
const { chromium } = require('playwright');
const B=(process.env.BASIS||'http://localhost:8765');
let f=0; const ok=(c,t)=>{ console.log((c?'ok   ':'FEHLER ')+t); if(!c) f++; };
(async()=>{
  const b=await chromium.launch();
  for(const [name, vp] of [['Handy',{width:393,height:852}],['Tablet',{width:820,height:1180}]]){
    const c=await b.newContext({viewport:vp});
    await c.route(u=>!/^https?:\/\/(localhost|127\.0\.0\.1)/.test(u.toString()), r=>r.abort());
    const p=await c.newPage(), errs=[]; p.on('pageerror', e=>errs.push(e.message));
    await p.goto(B+'/wichtel/'); await p.waitForURL(/app\/wichtel\.html/); await p.waitForSelector('#los');
    ok(await p.locator('#s-start h1').innerText()==='Wichtel Bommi zieht bei euch ein', name+': Einstieg mit Überschrift');
    await p.click('#los');
    ok(await p.locator('#pakete button').count()===3, name+': drei Pakete');
    ok(await p.locator('#geschichten input').count()===8, name+': 8 Geschichten');
    ok(await p.locator('#geschichten input[data-nr="1"]').isDisabled() && await p.locator('#geschichten input[data-nr="8"]').isDisabled(), name+': Nr. 1 und 8 fest');
    await p.click('[data-paket=klein]');
    ok(await p.locator('#geschichten input:checked').count()===3, name+': Klein wählt 3');
    await p.check('#geschichten input[data-nr="4"]');
    ok(await p.locator('[data-paket][aria-pressed=true]').count()===0, name+': eigene Auswahl hebt das Paket auf');
    await p.click('#s-auswahl [data-weiter]');
    ok(await p.locator('#szenarien button').count()===3, name+': drei Material-Wege');
    ok(await p.locator('[data-szenario=gemischt]').getAttribute('aria-pressed')==='true', name+': Gemischt ist vorgewählt');
    await p.click('[data-szenario=kaufen]');
    await p.click('#s-szenario [data-weiter]');
    ok(await p.locator('#plan li').count()===4, name+': Zeitplan mit 4 Geschichten');
    ok(/Bestellen bis/.test(await p.locator('#plan').innerText()), name+': Bestellen bis steht da');
    await p.fill('#erster', '2026-12-05'); await p.locator('#erster').dispatchEvent('change');
    ok((await p.locator('#plan li input').first().inputValue())==='2026-12-05', name+': Starttag geändert');
    const breit=await p.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth);
    ok(breit, name+': nichts ragt seitlich heraus');
    await p.screenshot({path:require('path').join(process.env.BILDER||require('os').tmpdir(),'wichtel-'+name.toLowerCase()+'.png'), fullPage:true}).catch(()=>{});
    await p.reload(); await p.waitForSelector('#plan li');
    ok(await p.locator('#plan li').count()===4 && (await p.locator('#erster').inputValue())==='2026-12-05', name+': Wahl bleibt nach Neuladen');
    await p.emulateMedia({media:'print'});
    ok(await p.locator('#druck-zeilen tr').count()===4 && await p.locator('.druck-tabelle').isVisible(), name+': Druckansicht mit Tabelle');
    ok(errs.length===0, name+': keine JS-Fehler '+errs.slice(0,2).join(' | '));
    await c.close();
  }
  console.log(f?f+' FEHLER':'ALLES OK'); await b.close(); process.exit(f?1:0);
})();
