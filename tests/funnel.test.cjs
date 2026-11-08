// Weg von der Landingpage zur Tour: Planer → Party-Assistent → Anmeldung spätestens vor dem Tour-Start
const { chromium } = require('playwright');
const S='https://test.supabase.co', B=''+(process.env.BASIS||'http://localhost:8765')+'/app/';
let fehler=0; const ok=(c,t)=>{ console.log((c?'ok   ':'FEHLER ')+t); if(!c) fehler++; };
const links={};
async function mock(route){
  const req=route.request(), u=new URL(req.url()), body=req.postData()?JSON.parse(req.postData()):null;
  const j=(s,o)=>route.fulfill({status:s, contentType:'application/json', body:o===undefined?'':JSON.stringify(o)});
  if(u.pathname==='/auth/v1/otp') return j(200,{});
  if(u.pathname==='/auth/v1/verify') return j(200,{access_token:'AT-x', refresh_token:'RT-x', expires_in:3600, user:{id:'U1', email:body.email, created_at:new Date().toISOString()}});
  if(u.pathname==='/rest/v1/rpc/link_lesen'){ const l=links[body.t]; return j(200, l||null); }
  if(u.pathname==='/rest/v1/parties' && req.method()==='GET') return j(200, []);
  if(u.pathname.startsWith('/rest/v1/rpc/') || u.pathname.startsWith('/functions/')) return j(200, null);
  return j(201);
}
(async()=>{
  const b=await chromium.launch(), errs=[];
  async function geraet(){
    const c=await b.newContext({viewport:{width:393,height:852}});
    await c.route('https://efdjomgubucdnvgtuqmp.supabase.co/**', r=>r.abort());
    await c.route(S+'/**', mock);
    await c.addInitScript(()=>{ window.KONTO_TEST={url:'https://test.supabase.co', key:'anon'}; window.__ev=[]; window.marketer={track:(n)=>window.__ev.push(n)}; });
    const p=await c.newPage(); p.on('pageerror',e=>errs.push(e.message)); return p;
  }
  const plan={format:1,thema:'einhorn',variante:'a',kinder:8,adresse:'Teststraße 1',strecke:1200,stand:'x',stationen:[{lat:53.5,lng:9.9,name:'Haustür'},{lat:53.501,lng:9.901,name:'Ecke'}]};

  // 1. Planer ohne Party führt in den Assistenten, nicht ins Spiel
  const a=await geraet();
  await a.goto(B+'planer.html?thema=einhorn'); await a.evaluate(()=>localStorage.clear());
  const src=await (await a.request.get(B+'planer.js')).text();
  ok(!/'spiel\.html'\+'\?thema=/.test(src) && (src.match(/location\.href='party\.html\?thema='/g)||[]).length===2, 'Planer: „Route übernehmen“ führt immer zur Party');
  await a.evaluate(pl=>localStorage.setItem('sj.plan.einhorn', JSON.stringify(pl)), plan);
  await a.goto(B+'party.html?thema=einhorn'); await a.waitForTimeout(600);
  ok(await a.locator('.route-geschafft').isVisible(), 'Assistent: Route schon gespeichert (Karte)');

  // 2. Spiel ohne Anmeldung: vor dem Aufwecken kommt die Anmeldung
  const party={format:1,thema:'einhorn',kind:{name:'Emma',alter:5},datum:new Date(Date.now()+9*864e5).toISOString().slice(0,10),start:'15:00',kinder:8,helfer:2,vorausgeher:true,ort:'draussen',planB:true,ausdrucke:true,erledigt:{},einkauf:{}};
  await a.evaluate(p=>localStorage.setItem('sj.party.einhorn', JSON.stringify(p)), party);
  await a.goto(B+'spiel.html?thema=einhorn'); await a.waitForTimeout(800);
  await a.evaluate(()=>document.getElementById('btn-main').click());
  await a.waitForTimeout(300);
  ok(await a.locator('dialog.konto-dlg[open]').isVisible() && /Bevor Funkel loslegt/.test(await a.locator('dialog.konto-dlg').innerText()), 'Spiel: Anmeldung vor dem Start');
  ok((await a.evaluate(()=>__zs.state().phase))==='start', 'Spiel: Tour noch nicht gestartet');
  await a.fill('#kd-mail','eltern@example.org'); await a.click('#kd-los'); await a.waitForTimeout(300);
  await a.fill('#kd-code','123456'); await a.waitForFunction(()=>/Geschafft/.test((document.querySelector('dialog.konto-dlg')||{}).innerText||''), null, {timeout:8000}).catch(()=>{});
  ok(/Geschafft/.test(await a.locator('dialog.konto-dlg').innerText().catch(()=>'')) , 'Code wird nach 6 Ziffern selbst geprüft, „Geschafft!“');
  await a.waitForTimeout(1600);
  ok(await a.evaluate(()=>Konto.angemeldet()), 'Spiel: angemeldet');
  ok((await a.evaluate(()=>__ev)).includes('signup'), 'Marketer bekommt signup');
  await a.evaluate(()=>document.getElementById('btn-main').click()); await a.waitForTimeout(300);
  ok((await a.evaluate(()=>__zs.state().phase))!=='start', 'Nach der Anmeldung startet die Tour');
  ok((await a.evaluate(()=>__ev)).filter(x=>x==='activated').length===1, 'Marketer bekommt activated (einmal)');

  // 3. iPad mit geheimem Link: kein Konto nötig
  links['SPIELTOKENSPIELTOKEN1234']={rolle:'spiel', daten:Object.assign({}, plan, {party:{thema:'einhorn', kind:{name:'Emma',alter:5}, ort:'draussen'}})};
  const i=await geraet();
  await i.goto(B+'spiel.html?thema=einhorn&k=SPIELTOKENSPIELTOKEN1234'); await i.waitForURL(u=>!/k=/.test(String(u))); await i.waitForTimeout(1200);
  await i.evaluate(()=>document.getElementById('btn-main').click()); await i.waitForTimeout(300);
  ok(!(await i.locator('dialog.konto-dlg[open]').count()) && (await i.evaluate(()=>__zs.state().phase))!=='start', 'iPad mit geheimem Link startet ohne Anmeldung');

  // 4. Spiel ohne m.js: activated geht direkt an Marketers Schnittstelle
  const c4=await b.newContext(); const gesendet=[];
  await c4.route('https://efdjomgubucdnvgtuqmp.supabase.co/**', r=>{ if(r.request().method()==='POST') gesendet.push(JSON.parse(r.request().postData()||'{}')); r.fulfill({status:204}); });
  await c4.route(S+'/**', mock);
  await c4.addInitScript(()=>{ window.KONTO_TEST={url:'https://test.supabase.co', key:'anon'}; window.MK_TEST=true; });
  const n=await c4.newPage(); n.on('pageerror',e=>errs.push(e.message));
  await n.goto(B+'spiel.html?thema=einhorn&k=SPIELTOKENSPIELTOKEN1234'); await n.waitForURL(u=>!/k=/.test(String(u))); await n.waitForTimeout(1000);
  await n.evaluate(()=>document.getElementById('btn-main').click()); await n.waitForTimeout(500);
  ok(gesendet.some(e=>e.name==='activated' && e.properties && e.properties.rolle==='spiel' && !e.email), 'Spiel meldet activated direkt, ohne persönliche Daten');

  // 5. Übergabe vom Planer: Routen-Karte
  await a.evaluate(()=>localStorage.removeItem('sj.party.einhorn')); await a.goto(B+'party.html?thema=einhorn'); await a.waitForTimeout(600);
  ok(await a.locator('.route-geschafft svg .rg-p').count()===1 && /1 Stationen|Eure Tour steht/.test(await a.locator('.route-geschafft').innerText()), 'Assistent zeigt die Routen-Karte');

  // 6. Mailversand gesperrt (Supabase ohne eigenen Mailserver): Notweg ohne Anmeldung
  const c6=await b.newContext({viewport:{width:393,height:852}});
  await c6.route('https://efdjomgubucdnvgtuqmp.supabase.co/**', r=>r.abort());
  const meldungen=[];
  await c6.route(S+'/**', r=>{ const u=new URL(r.request().url());
    if(u.pathname==='/auth/v1/otp') return r.fulfill({status:400, contentType:'application/json', body:JSON.stringify({code:400, error_code:'email_address_not_authorized', msg:'Email address not authorized'})});
    return mock(r); });
  await c6.route('https://fsqnzmwuojngopffcxso.supabase.co/rest/v1/rpc/fehler_melden', r=>{ meldungen.push(JSON.parse(r.request().postData()).meldung); r.fulfill({status:204}); });
  await c6.addInitScript(()=>{ window.KONTO_TEST={url:'https://test.supabase.co', key:'anon'}; window.FEHLER_TEST=true; });
  const g=await c6.newPage(); g.on('pageerror',e=>errs.push(e.message));
  await g.goto(B+'party.html?thema=einhorn'); await g.evaluate(([p,pl])=>{ localStorage.clear(); localStorage.setItem('sj.party.einhorn', JSON.stringify(p)); localStorage.setItem('sj.plan.einhorn', JSON.stringify(pl)); }, [party, plan]);
  await g.goto(B+'spiel.html?thema=einhorn'); await g.waitForTimeout(800);
  await g.click('#btn-main'); await g.fill('#kd-mail','fremd@example.org'); await g.click('#kd-los'); await g.waitForFunction(()=>/klemmt/.test((document.querySelector('dialog.konto-dlg')||{}).innerText||''), null, {timeout:8000}).catch(()=>{});
  ok(/klemmt/.test(await g.locator('dialog.konto-dlg').innerText()), 'Mailversand gesperrt: Notweg wird angeboten');
  await g.click('#kd-ohne'); await g.waitForTimeout(400);
  ok((await g.evaluate(()=>__zs.state().phase))!=='start', 'Notweg: Tour startet ohne Anmeldung');
  ok(meldungen.some(m=>/Anmeldung gestört: 400 email_address_not_authorized/.test(m)), 'Störung wird als Fehler gemeldet (PBIM)');
  await g.goto(B+'party.html?thema=einhorn'); await g.waitForTimeout(600);
  ok(await g.evaluate(()=>/einladung\.html\?e=/.test(Party.einladungsLink(Party.lesen('einhorn'), Party.plan('einhorn'))||'')), 'Notweg: Einladungslink mit Daten wie früher');

  // 7. Startadresse: neu → Landingpage (mit utm), mit Party → App, alter #tour-Link → Spiel
  const r=await geraet(); await r.goto(B.replace(/app\/$/,'')); await r.evaluate(()=>localStorage.clear());
  await r.goto(B.replace(/app\/$/,'')+'?utm_source=test'); await r.waitForURL(/landing\.html/);
  ok(/landing\.html\?utm_source=test/.test(r.url()), 'Startadresse: neue Besucher auf die Landingpage, utm bleibt');
  await r.evaluate(p=>localStorage.setItem('sj.party.einhorn', JSON.stringify(p)), party);
  await r.goto(B.replace(/app\/$/,'')); await r.waitForURL(u=>/\/app\/(index\.html)?$/.test(new URL(u).pathname));
  ok(true, 'Startadresse: mit Party in die App');
  await r.goto(B.replace(/app\/$/,'')+'#tour'); await r.waitForURL(/spiel\.html/);
  ok(/spiel\.html\?thema=einhorn#tour/.test(r.url()), 'Startadresse: alter #tour-Link ins Spiel');

  ok(errs.length===0, 'keine Seitenfehler '+errs.join(' | '));
  console.log(fehler?fehler+' FEHLER':'ALLES OK'); await b.close(); process.exit(fehler?1:0);
})();
