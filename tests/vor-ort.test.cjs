// Planer: Station beim Probelauf auf den echten Standort setzen (GPS)
const { chromium } = require('playwright');
const S='http://localhost:8765';
let fehler=0; const ok=(b,t)=>{ console.log((b?'ok   ':'FEHL ')+t); if(!b) fehler++; };
(async()=>{
  const b=await chromium.launch(), c=await b.newContext({viewport:{width:393,height:852}, geolocation:{latitude:53.5600, longitude:10.0000, accuracy:40}, permissions:['geolocation']});
  await c.addInitScript(()=>{ window.KONTO_TEST={url:'',key:''}; });
  await c.route(/^https?:\/\/(?!localhost)/, r=>r.abort());
  const p=await c.newPage(); const pf=[]; p.on('pageerror', e=>pf.push(e.message));
  await p.goto(S+'/app/');
  await p.evaluate(()=>{ localStorage.clear();
    const st=[0,1,2,3,4,5,6].map(i=>({lat:53.55+i*0.0008, lng:10.0+i*0.0004, name:'Ort '+i, nachMeter:i*100, gefunden:true}));
    localStorage.setItem('sj.plan.einhorn', JSON.stringify({format:1, thema:'einhorn', adresse:'Musterweg 1', start:{lat:53.55,lng:10.0}, richtung:'n', rundkurs:false, strecke:600, stationen:st, stand:new Date().toISOString()})); });
  await p.goto(S+'/app/planer.html?thema=einhorn'); await p.waitForSelector('#liste button[data-i="1"]', {state:'attached', timeout:8000});
  const tippe=(i)=>p.evaluate(i=>document.querySelector('#liste button[data-i="'+i+'"]').click(), i);
  await tippe(0);
  ok(await p.locator('#hier-setzen').isHidden(), 'Haustür (Station 1) hat keinen „hier setzen“-Knopf');
  await tippe(1);
  ok(/Station 2 hier setzen/.test(await p.locator('#hier-setzen').innerText()), 'Station 2: Knopf „Station 2 hier setzen“');
  await p.click('#hier-setzen'); await p.waitForTimeout(400);
  ok(/±40 m · noch warten/.test(await p.locator('#vor-ort-status').innerText()), 'Ungenaues GPS: wartet und zeigt „±40 m · noch warten“');
  for(const [la,lo] of [[53.56010,10.00010],[53.56012,10.00012],[53.56014,10.00008]]){ await c.setGeolocation({latitude:la, longitude:lo, accuracy:6}); await p.waitForTimeout(300); }
  await p.waitForTimeout(300);
  const s=await p.evaluate(()=>JSON.parse(localStorage.getItem('sj.plan.einhorn')).stationen[1]);
  ok(Math.abs(s.lat-53.56012)<0.00002 && Math.abs(s.lng-10.0001)<0.00002, 'Station 2 liegt auf dem Mittel der 3 genauen Messungen ('+s.lat+', '+s.lng+')');
  ok(s.vorOrt===6 && /vor Ort gesetzt \(±6 m\)/.test(s.hinweis) && s.verschoben, 'Gespeichert mit Genauigkeit: „vor Ort gesetzt (±6 m)“');
  ok(/Station 2 sitzt jetzt genau hier/.test(await p.locator('#vor-ort-status').innerText()) && /Station 3 hier setzen/.test(await p.locator('#hier-setzen').innerText()), 'Danach geht es zu Station 3');
  ok(!pf.length, 'Keine Seitenfehler'+(pf.length?': '+pf.join(' | '):''));
  await b.close(); console.log(fehler?fehler+' FEHLER':'ALLES OK'); process.exit(fehler?1:0);
})();
