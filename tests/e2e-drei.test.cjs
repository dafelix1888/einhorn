// E2E-Prüfung, dritte Runde: Gerätefrage und GPS-Test in der Generalprobe (UNICORN-98), „Nicht stören“ (106),
// Versteck im Planer (86), Kreidespur (110), „Von zu Hause“ (92), Sticker (100), Urkunden aus „Basteln“ (101),
// QR-Code (97), Dauer je Schritt (90/91), Gruppenfoto am Schatz (113), Themenseiten (55)
const { chromium } = require('playwright');
const fs=require('fs'), path=require('path');
const S='http://localhost:8765';
let fehler=0; const ok=(b,t)=>{ console.log((b?'ok   ':'FEHL ')+t); if(!b) fehler++; };
const ST=[0,1,2,3,4,5,6].map(i=>({lat:53.55+i*0.001, lng:10.0+i*0.001, name:'Ort '+i}));
const PARTY={format:1,thema:'einhorn',kind:{name:'Mia',alter:5},datum:'2030-06-01',start:'15:00',kinder:6,helfer:2,vorausgeher:true,ort:'draussen',planB:true,ausdrucke:true,erledigt:{},einkauf:{}};
const PLAN={format:1,thema:'einhorn',variante:'a',kinder:6,stationen:ST.map((s,i)=>Object.assign({nachMeter:i*150},s)),strecke:910,heimweg:350,adresse:'Musterweg 1'};
(async()=>{
  const b=await chromium.launch(), c=await b.newContext({viewport:{width:393,height:852}});
  await c.addInitScript(()=>{ window.KONTO_TEST={url:'',key:''}; });
  await c.route(/^https?:\/\/(?!localhost)/, r=>r.abort());
  const p=await c.newPage(); const pf=[]; p.on('pageerror', e=>pf.push(e.message));
  await p.goto(S+'/app/');
  const setze=(pa, pl)=>p.evaluate(([pa, pl])=>{ localStorage.clear(); if(pa) localStorage.setItem('sj.party.einhorn', JSON.stringify(pa)); if(pl) localStorage.setItem('sj.plan.einhorn', JSON.stringify(pl)); }, [pa, pl]);
  const tour=await p.evaluate(()=>fetch('themen/einhorn/tour.json').then(r=>r.json()));

  // 110: Kreidespur mit Länge und Zeit, bei langen Wegen nur die letzten 100 m
  const kr=await p.evaluate(()=>[Party.kreideText({stationen:[{lat:0,lng:0},{lat:0,lng:0,nachMeter:90}]}), Party.kreideText({stationen:[{lat:0,lng:0},{lat:0,lng:0,nachMeter:270}]})]);
  ok(/ca\. 90 m, etwa 15 Minuten/.test(kr[0]), 'Kreidespur: „ca. 90 m, etwa 15 Minuten“ ('+kr[0]+')');
  ok(/ca\. 270 m/.test(kr[1]) && /letzten 100 m/.test(kr[1]), 'Lange Route: nur die letzten 100 m vor Station 2');
  // 91: Dauer je Schritt
  const da=await p.evaluate(([pa, pl, t])=>Party.aufgaben(pa, t, pl).map(a=>a.id+'='+a.dauer).join('|'), [PARTY, PLAN, tour]);
  ok(/route=ca\. 70 Min\. zu Fuß/.test(da) && /bestellen=ca\. 10 Min\./.test(da) && /basteln=ca\. \d+ bis \d+ Min\./.test(da) && /partytag=ca\. [\d,]+ Std\./.test(da), 'Dauer je Schritt ('+da+')');
  // 92: Von zu Hause
  const zh=await p.evaluate(([pa, t])=>Party.vonZuHause(pa, t).map(x=>x.x+(x.extra?'*':'')).join('|'), [PARTY, tour]);
  ok(/Buntes Band/.test(zh) && /Powerbank/.test(zh) && /Regenbogen-Snack\*/.test(zh) && !/Schleifen/.test(zh), 'Von zu Hause: Band, Powerbank, Snack (Extra); Schleifen nur mit Extra ('+zh+')');
  const zhb=await p.evaluate(([pa, t])=>Party.vonZuHause(Object.assign({}, pa, {ausdrucke:false}), t).map(x=>x.x).join('|'), [PARTY, tour]);
  ok(/Schleifen/.test(zhb), 'Mit Extra „Hinweise am Weg“: Schleifen von zu Hause');
  // 100 + 101: Basteln
  const bl=await p.evaluate(([pa, t])=>Party.basteln(pa, t).map(x=>x.x).join('|'), [PARTY, tour]);
  ok(/Stickerbogen in 6 Stücke schneiden, damit jedes Kind eins bekommt/.test(bl) && !/Einladungen drucken/.test(bl), 'Basteln: Sticker erklärt, Einladungen nicht mehr hier ('+bl+')');

  // Party-Seite: Dauer, Von zu Hause, Basteln → nur Urkunden
  await setze(PARTY, PLAN);
  await p.goto(S+'/app/party.html?thema=einhorn'); await p.waitForSelector('.station .dauer');
  ok(await p.locator('.station .dauer').count()>=5, 'Überblick: jeder Schritt mit ungefährer Dauer');
  await p.click('[data-oeffne="bestellen"]'); await p.waitForSelector('#zu-hause');
  const k=await p.locator('#zu-hause ~ .pack-ding [data-pack]').first().getAttribute('data-pack');
  await p.locator('#zu-hause ~ .pack-ding [data-pack]').first().check(); await p.waitForTimeout(200);
  ok(await p.evaluate(k=>JSON.parse(localStorage.getItem('sj.einhorn.liste')||'{}')[k]===true, k), '„Von zu Hause“ abhaken, gleiche Haken wie „Besorgen“ im Spiel ('+k+')');
  await p.goto(S+'/app/party.html?thema=einhorn'); await p.click('[data-oeffne="basteln"]'); await p.waitForTimeout(300);
  ok(/druck\.html\?thema=einhorn#urkunden/.test(await p.locator('#seite').innerHTML()), 'Basteln öffnet die Druckseite nur mit Urkunden');
  await p.goto(S+'/app/druck.html?thema=einhorn#urkunden'); await p.waitForSelector('.urkunde');
  ok(await p.locator('.einladung').count()===0, 'Druckseite #urkunden: keine Einladungen');

  // 97: QR-Code nur mit gesicherter Party
  await p.goto('about:blank'); await p.goto(S+'/app/druck.html?thema=einhorn#einladung'); await p.waitForSelector('.einladung');
  ok(await p.locator('.einladung .qr').count()===0, 'Ohne gesicherte Party kein QR-Code');
  const qr=await p.evaluate(()=>{ const s=QR.svg('https://schatzweg.de/app/einladung.html?k='+'A'.repeat(43)); return /^<svg/.test(s) && /<path d="M/.test(s); });
  ok(qr, 'QR-Code wird im Browser erzeugt');
  const kc=await b.newContext({viewport:{width:393,height:852}});
  await kc.addInitScript(()=>{ window.KONTO_TEST={url:'https://test.supabase.co',key:'anon'}; });
  await kc.route(/^https?:\/\/(?!localhost)/, r=>r.abort());
  const q=await kc.newPage(); q.on('pageerror', e=>pf.push(e.message));
  await q.goto(S+'/app/'); await q.evaluate(([pa, pl])=>{ localStorage.setItem('sj.party.einhorn', JSON.stringify(pa)); localStorage.setItem('sj.plan.einhorn', JSON.stringify(pl)); }, [Object.assign({}, PARTY, {server:{id:'p1', k:{gast:'G'.repeat(43)}}}), PLAN]);
  await q.goto(S+'/app/druck.html?thema=einhorn#einladung'); await q.waitForSelector('.einladung');
  ok(await q.locator('.einladung .qr svg').count()===2, 'Mit gesicherter Party: QR-Code auf beiden Karten');

  // 106: Nicht stören
  await setze(PARTY, PLAN);
  await p.goto(S+'/app/bereit.html?thema=einhorn'); await p.waitForSelector('#stoeren');
  await p.click('#stoeren'); ok(/Nicht stören ist an/.test(await p.locator('#liste').innerText()) && await p.locator('#stoeren').count()===0, 'Startklar: „Nicht stören ist an“ zum Bestätigen');

  // 86: Versteck im Planer
  await p.goto(S+'/app/planer.html?thema=einhorn'); await p.waitForTimeout(1200);
  const pv=await p.evaluate(()=>{ const b=document.querySelector('#liste button[data-i="1"]'); if(b) b.click(); return (document.getElementById('st-text')||{}).innerText||''; });
  ok(/Versteckt: Rote Bögen/.test(pv) && /bis zu einer Stunde allein/.test(pv), 'Planer: Versteck in der Karte der gewählten Station ('+pv.slice(0,80)+')');

  // 98 + 113: Spiel
  await p.goto(S+'/app/spiel.html?thema=einhorn&probe=1'); await p.waitForSelector('#probe-gps', {timeout:8000}).catch(()=>{});
  ok(/Mobilfunk/.test(await p.locator('#probe').innerText()) && await p.locator('#probe-gps').count()===1, 'Generalprobe: zuerst Gerätefrage und GPS-Test');
  ok(await p.locator('#foto-jetzt').count()===1 && await p.locator('#foto-jetzt').isHidden(), 'Gruppenfoto-Zeile nur am Schatz');

  // 90: „Später änderbar“ einmal je Bildschirm
  await setze(null, PLAN);
  await p.goto(S+'/app/party.html?thema=einhorn'); await p.waitForSelector('#name');
  await p.fill('#name','Mia'); await p.fill('#alter','5'); await p.fill('#datum','2030-06-01'); await p.click('#weiter'); await p.waitForSelector('.spielart-jederzeit, [data-spielart]');
  const t2=await p.locator('#seite').innerText(); const n2=(t2.match(/änderbar|später ändern/g)||[]).length;
  ok(n2===1, 'Assistent Schritt 2: „später änderbar“ genau einmal ('+n2+')');

  // 55: Themenseiten von Marketer
  const ideen=fs.readdirSync(path.join(__dirname,'..','ideen')).filter(f=>f.endsWith('.html') && f!=='index.html');
  ok(ideen.length===8 && ideen.every(f=>/Die Wahl trefft ihr gleich beim Planen/.test(fs.readFileSync(path.join(__dirname,'..','ideen',f),'utf8'))), 'Themenseiten: neuer Halbsatz zur Erzähler-Wahl ('+ideen.length+')');
  ok(!/iPad/.test(fs.readFileSync(path.join(__dirname,'..','app/landing.html'),'utf8')), 'Landingpage ohne „iPad“');

  ok(!pf.length, 'Keine Seitenfehler'+(pf.length?': '+pf.join(' | '):''));
  await b.close(); process.exit(fehler?1:0);
})();
