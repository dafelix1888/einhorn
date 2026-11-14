// Planer (UNICORN-46): Menü herunterziehen für die große Karte, Weglänge bei weit entfernter Station
const { chromium } = require('playwright');
const S='http://localhost:8765';
let fehler=0; const ok=(b,t)=>{ console.log((b?'ok   ':'FEHL ')+t); if(!b) fehler++; };

// Kleines Wegenetz als Gitter um den Start (Overpass-Format)
function gitter(){
  const el=[], id=(r,s)=>1000+r*20+s, pos=(r,s)=>({lat:53.549+r*0.001, lon:9.999+s*0.0012}), z=[...Array(12).keys()];
  let w=1;
  for(let r=0;r<12;r++) el.push({type:'way', id:w++, nodes:z.map(s=>id(r,s)), geometry:z.map(s=>pos(r,s)), tags:{highway:'footway'}});
  for(let s=0;s<12;s++) el.push({type:'way', id:w++, nodes:z.map(r=>id(r,s)), geometry:z.map(r=>pos(r,s)), tags:{highway:'footway'}});
  return {elements:el};
}

(async()=>{
  const b=await chromium.launch(), c=await b.newContext({viewport:{width:393,height:852}, hasTouch:true, geolocation:{latitude:53.55, longitude:10.0, accuracy:6}, permissions:['geolocation']});
  await c.addInitScript(()=>{ window.KONTO_TEST={url:'',key:''}; window.KARTE_GEDULD=10; });
  const netz=JSON.stringify(gitter());
  await c.route(/^https?:\/\/(?!localhost)/, r=>{
    const u=r.request().url();
    if(r.request().method()==='POST' && /overpass|interpreter/.test(u+r.request().postData())) return r.fulfill({status:200, contentType:'application/json', body:netz});
    return r.abort();
  });
  await c.route(/\/config\.json$/, r=>r.fulfill({status:200, contentType:'application/json', body:'{}'}));
  const p=await c.newPage(); const pf=[]; p.on('pageerror', e=>pf.push(e.message));
  await p.goto(S+'/app/');
  await p.evaluate(()=>{ localStorage.clear();
    const st=[0,1,2,3,4,5,6].map(i=>({lat:53.55+i*0.001, lng:10.0+i*0.0012, name:'Ort '+i, nachMeter:i*100, gefunden:true}));
    localStorage.setItem('sj.plan.einhorn', JSON.stringify({format:1, thema:'einhorn', adresse:'Musterweg 1', start:{lat:53.55,lng:10.0}, distanz:800, richtung:'n', rundkurs:false, strecke:1200, stationen:st, stand:new Date().toISOString()})); });
  await p.goto(S+'/app/planer.html?thema=einhorn'); await p.waitForSelector('#liste button[data-i="1"]', {state:'attached', timeout:8000});
  await p.waitForTimeout(800);

  // --- 1. Menü herunterziehen (Maus am Griff) ---
  const hoch=()=>p.evaluate(()=>{ const r=document.getElementById('sheet').getBoundingClientRect(); return Math.round(innerHeight-r.top); });
  const offen=await hoch();
  const g=await p.locator('#griff').boundingBox();
  await p.mouse.move(g.x+g.width/2, g.y+g.height/2); await p.mouse.down();
  for(let i=1;i<=10;i++) await p.mouse.move(g.x+g.width/2, g.y+g.height/2+i*25);
  await p.mouse.up(); await p.waitForTimeout(400);
  const klein=await hoch();
  ok(await p.evaluate(()=>document.getElementById('sheet').classList.contains('klein')), 'Griff nach unten gezogen: Menü ist klein');
  ok(klein<140 && klein<offen-150, 'Nur noch der Kopf ist zu sehen ('+offen+' px → '+klein+' px)');
  ok(/Euer Weg/.test(await p.locator('.sheet-kopf').innerText()) && klein>40, '„Euer Weg“ und die Länge bleiben sichtbar');
  // Tippen auf das kleine Menü klappt es wieder auf
  await p.click('.sheet-kopf'); await p.waitForTimeout(400);
  ok(!(await p.evaluate(()=>document.getElementById('sheet').classList.contains('klein'))) && Math.abs(await hoch()-offen)<5, 'Tippen klappt das Menü wieder auf');
  // Tippen auf den Griff macht es klein
  await p.click('#griff'); await p.waitForTimeout(400);
  ok(await p.evaluate(()=>document.getElementById('sheet').classList.contains('klein')), 'Tippen auf den Griff macht das Menü klein');
  await p.click('#griff'); await p.waitForTimeout(400);
  // Wischen mit dem Finger aus dem Inhalt nach unten (Inhalt ganz oben)
  await p.evaluate(()=>{
    const el=document.getElementById('st-titel'), r=el.getBoundingClientRect(), x=r.left+20;
    const t=(y)=>new Touch({identifier:1, target:el, clientX:x, clientY:y});
    el.dispatchEvent(new TouchEvent('touchstart', {bubbles:true, cancelable:true, touches:[t(r.top)], changedTouches:[t(r.top)]}));
    for(let i=1;i<=8;i++) el.dispatchEvent(new TouchEvent('touchmove', {bubbles:true, cancelable:true, touches:[t(r.top+i*30)], changedTouches:[t(r.top+i*30)]}));
    el.dispatchEvent(new TouchEvent('touchend', {bubbles:true, cancelable:true, touches:[], changedTouches:[t(r.top+240)]}));
  });
  await p.waitForTimeout(400);
  ok(await p.evaluate(()=>document.getElementById('sheet').classList.contains('klein')), 'Mit dem Finger nach unten gewischt: Menü ist klein');
  // Kurz nach oben wischen: wieder offen
  await p.evaluate(()=>{
    const el=document.querySelector('.sheet-kopf'), r=el.getBoundingClientRect(), x=r.left+20;
    const t=(y)=>new Touch({identifier:2, target:el, clientX:x, clientY:y});
    el.dispatchEvent(new TouchEvent('touchstart', {bubbles:true, cancelable:true, touches:[t(r.top)], changedTouches:[t(r.top)]}));
    for(let i=1;i<=6;i++) el.dispatchEvent(new TouchEvent('touchmove', {bubbles:true, cancelable:true, touches:[t(r.top-i*30)], changedTouches:[t(r.top-i*30)]}));
    el.dispatchEvent(new TouchEvent('touchend', {bubbles:true, cancelable:true, touches:[], changedTouches:[t(r.top-180)]}));
  });
  await p.waitForTimeout(400);
  ok(!(await p.evaluate(()=>document.getElementById('sheet').classList.contains('klein'))), 'Nach oben gewischt: Menü wieder offen');

  // --- 2. Weglänge: Station 2 rund 20 km entfernt vor Ort setzen ---
  await p.evaluate(()=>document.querySelector('#liste button[data-i="1"]').click());
  await c.setGeolocation({latitude:53.73, longitude:10.0, accuracy:6});
  await p.click('#hier-setzen');
  for(let i=0;i<4;i++){ await c.setGeolocation({latitude:53.73+i*0.000001, longitude:10.0, accuracy:6}); await p.waitForTimeout(300); }
  await p.waitForTimeout(300);
  const plan=await p.evaluate(()=>JSON.parse(localStorage.getItem('sj.plan.einhorn')));
  ok(plan.stationen[1].lat>53.72, 'Station 2 liegt jetzt rund 20 km weg');
  ok(plan.strecke>39000, 'Weglänge passt: hin und wieder zurück zu den nächsten Stationen ≈ 40 km ('+plan.strecke+' m)');
  ok(plan.stationen[1].nachMeter>19000, 'Station 2 „nach '+plan.stationen[1].nachMeter+' m“');
  ok(plan.luft==='teils', 'Als „teils Luftlinie“ gekennzeichnet');
  ok(/teils Luftlinie/.test(await p.locator('#k-kurz').innerText()), 'Kopf zeigt: '+await p.locator('#k-kurz').innerText());
  ok(/außerhalb der Karte/.test(await p.locator('#toast').innerText()), 'Hinweis: Station liegt außerhalb der Karte');
  // Zurück in die Nähe: wieder normaler Fußweg
  await p.evaluate(()=>document.querySelector('#liste button[data-i="1"]').click());
  await c.setGeolocation({latitude:53.551, longitude:10.0012, accuracy:6});
  await p.click('#hier-setzen');
  for(let i=0;i<4;i++){ await c.setGeolocation({latitude:53.551, longitude:10.0012+i*0.000001, accuracy:6}); await p.waitForTimeout(300); }
  await p.waitForTimeout(300);
  const plan2=await p.evaluate(()=>JSON.parse(localStorage.getItem('sj.plan.einhorn')));
  ok(plan2.strecke<3000 && !plan2.luft, 'Station wieder nah: Fußweg ohne Luftlinie ('+plan2.strecke+' m)');
  ok(!/Luftlinie/.test(await p.locator('#k-kurz').innerText()), 'Kopf ohne „Luftlinie“');

  ok(!pf.length, 'Keine Seitenfehler'+(pf.length?': '+pf.join(' | '):''));
  await b.close(); console.log(fehler?fehler+' FEHLER':'ALLES OK'); process.exit(fehler?1:0);
})();
