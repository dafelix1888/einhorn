// UNICORN-36 / STRAT-34: Anmeldung über den Link in der Mail (statt Code).
// Auch dieser Weg meldet `signup` an Marketer (einmal je Konto), speichert die Party,
// und ein offenes Code-Fenster im ersten Tab macht von selbst weiter.
const { chromium } = require('playwright');
const S='https://test.supabase.co', B=''+(process.env.BASIS||'http://localhost:8765')+'/app/';
let fehler=0; const ok=(c,t)=>{ console.log((c?'ok   ':'FEHLER ')+t); if(!c) fehler++; };
const HASH='#access_token=AT-link&refresh_token=RT-link&expires_in=3600&token_type=bearer&type=signup';
const party={format:1,thema:'einhorn',kind:{name:'Emma',alter:5},datum:new Date(Date.now()+9*864e5).toISOString().slice(0,10),start:'15:00',kinder:8,helfer:2,vorausgeher:true,ort:'draussen',planB:true,ausdrucke:true,erledigt:{},einkauf:{}};
const plan={format:1,thema:'einhorn',variante:'a',kinder:8,adresse:'Teststraße 1',strecke:1200,stand:'x',stationen:[{lat:53.5,lng:9.9,name:'Haustür'},{lat:53.501,lng:9.901,name:'Ecke'}]};
(async()=>{
  const b=await chromium.launch(), errs=[];
  async function geraet(kontoAlterMin){
    const z={gespeichert:0, user:0};
    const c=await b.newContext({viewport:{width:393,height:852}});
    await c.route('https://efdjomgubucdnvgtuqmp.supabase.co/**', r=>r.abort());
    await c.route(S+'/**', route=>{
      const req=route.request(), u=new URL(req.url());
      const j=(s,o)=>route.fulfill({status:s, contentType:'application/json', body:o===undefined?'':JSON.stringify(o)});
      if(u.pathname==='/auth/v1/otp') return j(200,{});
      if(u.pathname==='/auth/v1/user'){ z.user++; return j(200,{id:'U-link', email:'eltern@example.org', created_at:new Date(Date.now()-kontoAlterMin*60000).toISOString()}); }
      if(u.pathname==='/rest/v1/parties' && req.method()==='GET') return j(200, []);
      if(u.pathname==='/rest/v1/parties'){ z.gespeichert++; return j(201); }
      if(u.pathname.startsWith('/rest/v1/rpc/') || u.pathname.startsWith('/functions/')) return j(200, null);
      return j(201);
    });
    await c.addInitScript(()=>{ window.KONTO_TEST={url:'https://test.supabase.co', key:'anon'};
      window.marketer={track:(n)=>{ const l=JSON.parse(localStorage.getItem('__ev')||'[]'); l.push(n); localStorage.setItem('__ev', JSON.stringify(l)); }}; });
    const neu=async()=>{ const p=await c.newPage(); p.on('pageerror',e=>errs.push(e.message)); return p; };
    const p=await neu();
    await p.goto(B+'impressum.html'); await p.evaluate(([pa,pl])=>{ localStorage.clear(); localStorage.setItem('sj.party.einhorn', JSON.stringify(pa)); localStorage.setItem('sj.plan.einhorn', JSON.stringify(pl)); }, [party, plan]);
    return {c, p, z, neu, ev:()=>p.evaluate(()=>JSON.parse(localStorage.getItem('__ev')||'[]'))};
  }
  const signups=async g=>(await g.ev()).filter(x=>x==='signup').length;

  // 1) Neues Konto kommt über den Mail-Link zurück: angemeldet, signup gemeldet, Party gespeichert
  let g=await geraet(1);
  await g.p.goto(B+'party.html?thema=einhorn'+HASH); await g.p.waitForFunction(()=>window.Konto && Konto.angemeldet()); await g.p.waitForTimeout(1200);
  ok(!/access_token/.test(g.p.url()), 'Mail-Link: Schlüssel verschwinden aus der Adresse');
  ok(await signups(g)===1, 'Mail-Link, neues Konto: signup geht an Marketer');
  ok(g.z.gespeichert>=1, 'Mail-Link: die Party wird gespeichert');
  await g.p.goto(B+'impressum.html'); await g.p.goto(B+'party.html?thema=einhorn'+HASH); await g.p.waitForTimeout(1200);
  ok(await signups(g)===1, 'Mail-Link zweimal geöffnet: signup bleibt bei einem');
  await g.c.close();

  // 2) Altes Konto über den Mail-Link: kein signup
  g=await geraet(3*24*60);
  await g.p.goto(B+'party.html?thema=einhorn'+HASH); await g.p.waitForFunction(()=>window.Konto && Konto.angemeldet()); await g.p.waitForTimeout(1000);
  ok(await signups(g)===0, 'Mail-Link, bestehendes Konto: kein signup');
  await g.c.close();

  // 3) Code-Fenster offen, Anmeldung passiert im zweiten Tab über den Link: erster Tab macht von selbst weiter
  g=await geraet(1);
  await g.p.goto(B+'party.html?thema=einhorn'); await g.p.waitForFunction(()=>window.Konto); await g.p.waitForTimeout(500);
  await g.p.evaluate(()=>Konto.bereit('einhorn'));
  await g.p.fill('#kd-mail','eltern@example.org'); await g.p.click('#kd-los'); await g.p.waitForSelector('#kd-code');
  ok(/nur ein Link/.test(await g.p.locator('dialog.konto-dlg').innerText()), 'Code-Fenster erklärt, was bei einem Link in der Mail zu tun ist');
  const vorher=g.z.gespeichert;
  const t2=await g.neu(); await t2.goto(B+'impressum.html'+HASH); await t2.waitForTimeout(300);
  await t2.evaluate(()=>localStorage.setItem('sj.konto', JSON.stringify({access_token:'AT-link', refresh_token:'RT-link', ablauf:Date.now()+3500000, email:'eltern@example.org', id:'U-link'})));
  await g.p.waitForFunction(()=>!document.querySelector('#kd-code'), null, {timeout:8000}).catch(()=>{});
  ok(await g.p.locator('#kd-code').count()===0, 'Erster Tab: Code-Feld verschwindet nach der Anmeldung im zweiten Tab');
  await g.p.waitForTimeout(600);
  ok(g.z.gespeichert>vorher, 'Erster Tab: Party wird danach gespeichert');
  ok(await g.p.evaluate(()=>Konto.angemeldet()), 'Erster Tab: angemeldet');
  await g.c.close();

  ok(errs.length===0, 'keine JS-Fehler '+(errs.length?JSON.stringify(errs.slice(0,3)):''));
  console.log(fehler?fehler+' FEHLER':'ALLES OK'); await b.close(); process.exit(fehler?1:0);
})();
