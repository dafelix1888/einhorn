// Nach der Party nach dem Wert fragen (UNICORN-115, für STRAT-8): vier Stufen, anonym, einmal je Party.
// Dazu: Dauer je Schritt bleibt eine Zeile (UNICORN-91, wackelte auf GitHub).
const { chromium } = require('playwright');
const S='http://localhost:8765';
let fehler=0; const ok=(b,t)=>{ console.log((b?'ok   ':'FEHL ')+t); if(!b) fehler++; };
(async()=>{
  const b=await chromium.launch(), c=await b.newContext({viewport:{width:360,height:740}});
  await c.addInitScript(()=>{ window.KONTO_TEST={url:'https://test.supabase.co',key:'anon'}; });
  const gesendet=[];
  await c.route(/^https?:\/\/(?!localhost)/, r=>{ const u=r.request().url(); if(/rpc\/wert_geben/.test(u)){ gesendet.push(JSON.parse(r.request().postData())); return r.fulfill({status:200, contentType:'application/json', body:'true'}); } return r.abort(); });
  const p=await c.newPage(); const pf=[]; p.on('pageerror', e=>pf.push(e.message));
  await p.goto(S+'/app/');
  const gestern=new Date(Date.now()-2*864e5).toISOString().slice(0,10);
  await p.evaluate(d=>{ localStorage.clear();
    localStorage.setItem('sj.party.einhorn', JSON.stringify({format:1,thema:'einhorn',kind:{name:'Mia',alter:5},datum:d,start:'15:00',kinder:6,helfer:2,vorausgeher:true,ort:'draussen',planB:true,ausdrucke:true,erledigt:{},einkauf:{}}));
    localStorage.setItem('sj.plan.einhorn', JSON.stringify({format:1,thema:'einhorn',variante:'a',kinder:6,stationen:[0,1,2,3,4,5,6].map(i=>({lat:53.55+i*0.001,lng:10,name:'Ort '+i})),strecke:900,heimweg:300})); }, gestern);
  await p.goto(S+'/app/party.html?thema=einhorn'); await p.waitForSelector('#nach-der-party');
  ok(await p.locator('#wert-frage [data-wert]').count()===4 && /Was wäre euch die Schatzsuche wert gewesen/.test(await p.locator('#nach-der-party').innerText()), 'Nach der Party: Frage mit vier Stufen');
  await p.click('#wert-frage [data-wert="2"]'); await p.waitForSelector('.wert-danke');
  ok(gesendet.length===1 && gesendet[0].p_stufe===2 && gesendet[0].p_betrag===15 && !('name' in gesendet[0]), 'Antwort geht anonym raus: Stufe und Betrag ('+JSON.stringify(gesendet[0])+')');
  await p.reload(); await p.waitForSelector('#nach-der-party');
  ok(await p.locator('#wert-frage').count()===0 && /Etwa 15 €/.test(await p.locator('.wert-danke').innerText()), 'Einmal je Party: danach nur noch die Antwort');
  // Dauer-Zeile: eine Zeile, auch auf schmalen Geräten
  const hoehen=await p.locator('.station .zeile2').evaluateAll(l=>l.map(e=>Math.round(e.getBoundingClientRect().height)));
  ok(hoehen.length>=5 && Math.max(...hoehen)<=Math.min(...hoehen)+2, 'Zeit und Dauer je Schritt in einer Zeile ('+hoehen.join(',')+')');
  // Ohne Server keine Frage
  const k=await b.newContext(); await k.addInitScript(()=>{ window.KONTO_TEST={url:'',key:''}; }); await k.route(/^https?:\/\/(?!localhost)/, r=>r.abort());
  const q=await k.newPage(); await q.goto(S+'/app/');
  await q.evaluate(d=>{ localStorage.setItem('sj.party.einhorn', JSON.stringify({format:1,thema:'einhorn',kind:{name:'Mia',alter:5},datum:d,start:'15:00',kinder:6,helfer:2,ort:'draussen',erledigt:{},einkauf:{}})); }, gestern);
  await q.goto(S+'/app/party.html?thema=einhorn'); await q.waitForSelector('#nach-der-party');
  ok(await q.locator('#wert-frage').count()===0, 'Ohne Server keine Wert-Frage');
  ok(!pf.length, 'Keine Seitenfehler'+(pf.length?': '+pf.join(' | '):''));
  await b.close(); process.exit(fehler?1:0);
})();
