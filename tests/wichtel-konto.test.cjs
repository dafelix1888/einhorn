// Wichtel Bommi (UNICORN-144): Konto ab Geschichte 2. Schranke mit der vorhandenen Anmeldung, Häkchen „Bommi darf mich erinnern“,
// Plan und Fortschritt wandern ins Konto und kommen auf einem zweiten Gerät wieder an. Gegen ein nachgebautes Supabase.
const { chromium } = require('playwright');
const WK=require('../app/wichtel-kern.js');
const B=(process.env.BASIS||'http://localhost:8765')+'/app/', S='https://test.supabase.co';
let f=0; const ok=(c,t)=>{ console.log((c?'ok   ':'FEHLER ')+t); if(!c) f++; };

// ---------- Abgleich ohne Browser ----------
const w1={nr:[1,2,8], paket:'klein', szenario:'gemischt', erster:'2026-12-01', letzter:'2026-12-22', eigene:{}};
const w2={nr:[1,2,3,4,5,6,7,8], paket:'ganz', szenario:'kaufen', erster:'2026-12-01', letzter:'2026-12-24', eigene:{}};
ok(WK.braucheKonto(1)===false && WK.braucheKonto(2)===true && WK.braucheKonto('8')===true, 'Konto erst ab Geschichte 2');
let r=WK.abgleich({wahl:w1, gespielt:[1], zeit:100}, null);
ok(r.hochladen && r.daten.wahl===w1 && !r.vomKonto, 'Konto leer: Gerät lädt hoch');
r=WK.abgleich({wahl:null, gespielt:[], zeit:0}, {daten:{wahl:w2, gespielt:[1,2], zeit:50}});
ok(r.vomKonto && r.daten.wahl===w2 && r.daten.gespielt.join()==='1,2' && !r.hochladen, 'Neues Gerät: Plan kommt aus dem Konto');
r=WK.abgleich({wahl:w1, gespielt:[3], zeit:200}, {daten:{wahl:w2, gespielt:[1,2], zeit:50}});
ok(!r.vomKonto && r.daten.wahl===w1 && r.daten.gespielt.join()==='1,2,3' && r.hochladen, 'Gerät neuer: Gerät gewinnt, Gespieltes wird vereinigt');
r=WK.abgleich({wahl:w1, gespielt:[1], zeit:10}, {daten:{wahl:w2, gespielt:[1], zeit:50}});
ok(r.vomKonto && r.daten.wahl===w2 && !r.hochladen, 'Konto neuer: Konto gewinnt');
r=WK.abgleich({wahl:w2, gespielt:[1], zeit:50}, {daten:{wahl:w2, gespielt:[1], zeit:50}});
ok(!r.hochladen, 'Gleicher Stand: nichts hochladen');
ok(WK.abgleich({gespielt:[9,'2',2]}, null).daten.gespielt.join()==='2', 'Gespielt: nur 1 bis 8, ohne Doppelte');

// ---------- Nachgebautes Supabase ----------
const db={wichtel:{}}; const mails=[];
function nutzer(req){ const a=req.headers()['authorization']||''; return a.startsWith('Bearer AT-') ? 'U-'+a.slice(10) : null; }
async function mock(route){
  const req=route.request(), u=new URL(req.url()), m=req.method(), body=req.postData()?JSON.parse(req.postData()):null, me=nutzer(req);
  const j=(s,o)=>route.fulfill({status:s, contentType:'application/json', body:o===undefined?'':JSON.stringify(o)});
  if(req.headers()['apikey']!=='anon') return j(401,{message:'no apikey'});
  if(u.pathname==='/auth/v1/otp'){ mails.push(body.email); return j(200,{}); }
  if(u.pathname==='/auth/v1/verify'){ if(body.token!=='123456') return j(403,{msg:'invalid'});
    return j(200,{access_token:'AT-'+body.email, refresh_token:'RT-'+body.email, expires_in:3600, user:{id:'U-'+body.email, email:body.email, created_at:new Date().toISOString()}}); }
  if(!me) return j(401,{message:'permission denied'});
  if(u.pathname==='/rest/v1/parties' && m==='GET') return j(200,[]);
  if(u.pathname==='/rest/v1/wichtel'){
    if(m==='GET') return j(200, db.wichtel[me] ? [{daten:db.wichtel[me].daten, erinnern:db.wichtel[me].erinnern}] : []);
    if(m==='POST'){ if(body.owner!==me) return j(403,{message:'rls'}); const alt=db.wichtel[me]||{erinnern:false}; db.wichtel[me]={...alt, ...body}; return j(201); }
  }
  return j(404,{message:'?'});
}

(async()=>{
  const b=await chromium.launch(), errs=[];
  async function geraet(opt={}){
    const c=await b.newContext({viewport:{width:393,height:852}, hasTouch:true});
    await c.route(u=>!/^https?:\/\/(localhost|127\.0\.0\.1)/.test(u.toString()) && !u.toString().startsWith(S), r=>r.abort());
    await c.route(S+'/**', mock);
    await c.addInitScript(o=>{ window.KONTO_TEST={url:o.ohne?'':'https://test.supabase.co', key:o.ohne?'':'anon'}; window.mk=[]; window.marketer={track:(n,p)=>window.mk.push([n,p])};
      if(!sessionStorage.getItem('x')){ sessionStorage.setItem('x','1'); for(const k in (o.lokal||{})) localStorage.setItem(k, JSON.stringify(o.lokal[k])); } }, opt);
    const p=await c.newPage(); p.on('pageerror', e=>errs.push(e.message)); return p;
  }
  const sicht=(p,id)=>p.evaluate(i=>!document.getElementById(i).hidden, id);

  // Gerät A: Geschichte 1 ohne Konto
  let p=await geraet({lokal:{'sj.wichtel':{...w1, schritt:5}}});
  await p.goto(B+'wichtel-kind.html?nr=1'); await p.waitForSelector('#s-video:not([hidden])', {timeout:10000});
  ok(!(await sicht(p,'s-schranke')), 'Geschichte 1: keine Schranke, das Video kommt');
  // Geschichte 2: Schranke
  await p.goto(B+'wichtel-kind.html?nr=2'); await p.waitForSelector('#s-schranke:not([hidden])', {timeout:10000});
  ok(!(await sicht(p,'s-video')) && !(await sicht(p,'s-bilder')), 'Geschichte 2: erst die Schranke, kein Video, keine Bilder');
  ok((await p.locator('#s-schranke h1').innerText())==='Bommi bleibt bei euch', 'Schranke: „Bommi bleibt bei euch“');
  ok(!(await p.locator('#erinnern').isChecked()), 'Häkchen „Bommi darf mich erinnern“ ist nicht vorausgewählt');
  ok(await p.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth), 'Schranke: nichts ragt seitlich heraus');
  await p.screenshot({path:require('path').join(process.env.BILDER||require('os').tmpdir(),'wichtel-schranke.png')}).catch(()=>{});
  await p.check('#erinnern');
  await p.click('#anmelden');
  await p.waitForSelector('#kd-mail'); await p.fill('#kd-mail','eltern@test.de'); await p.click('#kd-los');
  await p.waitForSelector('#kd-code'); await p.fill('#kd-code','123456'); await p.click('#kd-ok');
  await p.waitForSelector('#s-video:not([hidden]), #s-bilder:not([hidden])', {timeout:10000});
  ok(mails[0]==='eltern@test.de', 'Anmeldung mit dem vorhandenen Code-Verfahren');
  ok(!(await sicht(p,'s-schranke')), 'Nach der Anmeldung geht Geschichte 2 los');
  const z=db.wichtel['U-eltern@test.de'];
  ok(z && z.daten.wahl && z.daten.wahl.nr.join()==='1,2,8', 'Plan liegt im Konto');
  ok(z && z.erinnern===true && !!z.erinnern_seit, 'Häkchen ist im Konto gespeichert (mit Zeitpunkt)');
  const mk=await p.evaluate(()=>window.mk);
  ok(mk.some(e=>e[0]==='signup' && e[1] && e[1].herkunft==='wichtel'), 'Messung: signup mit Herkunft Wichtel');
  // Geschichte 2 zu Ende → gespielt ins Konto
  await p.goto(B+'wichtel-kind.html?nr=2&ab=bilder'); await p.waitForSelector('#s-bilder:not([hidden])');
  for(let i=0;i<4;i++) await p.click('#weiter');
  await p.waitForTimeout(1800);
  ok((db.wichtel['U-eltern@test.de'].daten.gespielt||[]).includes(2), 'Geschichte 2 gespielt: steht im Konto');

  // Gerät B (Tablet), gleiches Konto, leeres Gerät
  const ses={access_token:'AT-eltern@test.de', refresh_token:'RT-eltern@test.de', ablauf:Date.now()+36e5, email:'eltern@test.de', id:'U-eltern@test.de'};
  let q=await geraet({lokal:{'sj.konto':ses}});
  await q.goto(B+'wichtel.html'); await q.waitForSelector('#s-vorb:not([hidden])', {timeout:10000});
  const lw=await q.evaluate(()=>({w:JSON.parse(localStorage.getItem('sj.wichtel')), g:JSON.parse(localStorage.getItem('sj.wichtel.gespielt'))}));
  ok(lw.w && lw.w.nr.join()==='1,2,8' && lw.w.paket==='klein', 'Zweites Gerät: Auswahl aus dem Konto');
  ok(lw.w && lw.w.erster==='2026-12-01' && lw.w.letzter==='2026-12-22', 'Zweites Gerät: Zeitplan aus dem Konto');
  ok(lw.g && lw.g.includes(2), 'Zweites Gerät: Fortschritt aus dem Konto');
  ok(await q.locator('#vorb li').count()===3, 'Zweites Gerät: Vorbereiten zeigt die 3 Geschichten');
  ok((await q.locator('#konto-zeile').innerText()).includes('eltern@test.de'), 'Zweites Gerät: angemeldet mit derselben Adresse');
  ok(await q.locator('#konto-erinnern').isChecked(), 'Zweites Gerät: Häkchen gesetzt');
  await q.uncheck('#konto-erinnern'); await q.waitForTimeout(500);
  ok(db.wichtel['U-eltern@test.de'].erinnern===false, 'Häkchen im Konto abwählbar');
  await q.goto(B+'wichtel-kind.html?nr=3&ab=bilder'); await q.waitForSelector('#s-bilder:not([hidden])', {timeout:10000});
  ok(!(await sicht(q,'s-schranke')), 'Angemeldet: keine Schranke');

  // Ohne Server (Notweg/kein Konto eingerichtet): keine Schranke, niemand bleibt hängen
  const o=await geraet({ohne:true});
  await o.goto(B+'wichtel-kind.html?nr=2'); await o.waitForSelector('#s-video:not([hidden]), #s-bilder:not([hidden])', {timeout:10000});
  ok(!(await sicht(o,'s-schranke')), 'Ohne Server: Geschichte 2 geht ohne Anmeldung');

  // Wichtel-Seite ohne Anmeldung: Hinweis statt Häkchen
  const n=await geraet({lokal:{'sj.wichtel':{...w1, schritt:5}}});
  await n.goto(B+'wichtel.html'); await n.waitForSelector('#s-vorb:not([hidden])');
  ok((await n.locator('#konto-zeile').innerText()).includes('Ab der zweiten'), 'Ohne Konto: Hinweis „Ab der zweiten … anmelden“');

  ok(!errs.length, 'Keine Skriptfehler'+(errs.length?': '+errs.join(' | '):''));
  await b.close();
  console.log(f ? f+' Fehler' : 'Alles grün'); process.exit(f?1:0);
})().catch(e=>{ console.error(e); process.exit(1); });
