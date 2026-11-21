// Wichtel Bommi (UNICORN-140): Messpunkte für Marketer (Namen aus MAR-77). Jedes Ereignis mit produkt 'wichtel',
// ab der Anmeldung mit `familie` (gleich auf allen Geräten des Kontos), Prüf-Markierung und Kanal bis zum signup.
const { chromium } = require('playwright');
const WK=require('../app/wichtel-kern.js');
const B=(process.env.BASIS||'http://localhost:8765')+'/app/', S='https://test.supabase.co';
let f=0; const ok=(c,t)=>{ console.log((c?'ok   ':'FEHLER ')+t); if(!c) f++; };

// ---------- Abgleich: Familien-Kennung und Prüf-Markierung wandern mit ----------
const w1={nr:[1,2,8], paket:'klein', szenario:'gemischt', erster:'2026-12-01', letzter:'2026-12-22', eigene:{}};
let r=WK.abgleich({wahl:w1, gespielt:[1], zeit:100, familie:'f-geraet', pruefung:'praxis'}, null);
ok(r.hochladen && r.daten.familie==='f-geraet' && r.daten.pruefung==='praxis', 'Abgleich: Kennung vom Gerät geht ins leere Konto');
r=WK.abgleich({wahl:w1, gespielt:[1], zeit:100, familie:'f-neu'}, {daten:{wahl:w1, gespielt:[1], zeit:100, familie:'f-konto'}});
ok(r.daten.familie==='f-konto' && !r.hochladen, 'Abgleich: Kennung im Konto gilt');
r=WK.abgleich({wahl:w1, gespielt:[1], zeit:100, familie:'f-geraet'}, {daten:{wahl:w1, gespielt:[1], zeit:100}});
ok(r.hochladen && r.daten.familie==='f-geraet', 'Abgleich: Konto ohne Kennung bekommt sie');
r=WK.abgleich({wahl:w1, gespielt:[1], zeit:100}, {daten:{wahl:w1, gespielt:[1], zeit:100}});
ok(!r.hochladen && !('familie' in r.daten), 'Abgleich: ohne Kennung unverändert');

// ---------- Nachgebautes Supabase ----------
const db={wichtel:{}};
function nutzer(req){ const a=req.headers()['authorization']||''; return a.startsWith('Bearer AT-') ? 'U-'+a.slice(10) : null; }
async function mock(route){
  const req=route.request(), u=new URL(req.url()), m=req.method(), body=req.postData()?JSON.parse(req.postData()):null, me=nutzer(req);
  const j=(s,o)=>route.fulfill({status:s, contentType:'application/json', body:o===undefined?'':JSON.stringify(o)});
  if(u.pathname==='/auth/v1/otp') return j(200,{});
  if(u.pathname==='/auth/v1/verify') return j(200,{access_token:'AT-'+body.email, refresh_token:'RT-'+body.email, expires_in:3600, user:{id:'U-'+body.email, email:body.email, created_at:new Date().toISOString()}});
  if(!me) return j(401,{message:'permission denied'});
  if(u.pathname==='/rest/v1/parties' && m==='GET') return j(200,[]);
  if(u.pathname==='/rest/v1/wichtel'){
    if(m==='GET') return j(200, db.wichtel[me] ? [{daten:db.wichtel[me].daten, erinnern:db.wichtel[me].erinnern}] : []);
    if(m==='POST'){ const alt=db.wichtel[me]||{erinnern:false}; db.wichtel[me]={...alt, ...body}; return j(201); }
  }
  return j(404,{message:'?'});
}

(async()=>{
  const b=await chromium.launch(), errs=[];
  async function geraet(lokal){
    const c=await b.newContext({viewport:{width:393,height:852}, hasTouch:true});
    await c.route(u=>!/^https?:\/\/(localhost|127\.0\.0\.1)/.test(u.toString()) && !u.toString().startsWith(S), r=>r.abort());
    await c.route(S+'/**', mock);
    await c.addInitScript(o=>{ window.KONTO_TEST={url:'https://test.supabase.co', key:'anon'};
      window.marketer={track:(n,p)=>{ const a=JSON.parse(localStorage.getItem('mk')||'[]'); a.push([n,p]); localStorage.setItem('mk', JSON.stringify(a)); }};
      if(!sessionStorage.getItem('x')){ sessionStorage.setItem('x','1'); for(const k in (o||{})) localStorage.setItem(k, JSON.stringify(o[k])); } }, lokal||{});
    const p=await c.newPage(); p.on('pageerror', e=>errs.push(e.message)); return p;
  }
  const mk=p=>p.evaluate(()=>JSON.parse(localStorage.getItem('mk')||'[]'));
  const eins=(l,n)=>l.filter(e=>e[0]===n);

  // Gerät A: von der Landingpage mit Kanal, als Praxistest markiert. Eltern-Ansicht von Auswahl bis Material.
  let p=await geraet({'sj.wichtel':{...w1, schritt:2}});
  await p.goto(B+'wichtel.html?utm_source=instagram&utm_campaign=start&pruefung=praxis'); await p.waitForSelector('#s-szenario:not([hidden])', {timeout:10000});
  await p.click('#s-szenario [data-weiter]'); await p.waitForSelector('#s-plan:not([hidden])');
  await p.click('#material'); await p.waitForSelector('#s-material:not([hidden])');
  const amz=p.locator('#kauf a.knopf').first();
  ok(await amz.count()===1, 'Material: es gibt einen Amazon-Link');
  if(await amz.count()) await amz.evaluate(a=>{ a.removeAttribute('target'); a.addEventListener('click', e=>e.preventDefault()); a.click(); });
  await p.evaluate(()=>{ const a=document.getElementById('vorlagen'); a.addEventListener('click', e=>e.preventDefault()); a.click(); });
  let l=await mk(p);
  const pc=eins(l,'wichtel_package_chosen')[0];
  ok(pc && pc[1].anzahl===3 && pc[1].material==='gemischt', 'wichtel_package_chosen mit anzahl und material');
  ok(eins(l,'wichtel_schedule_created').length===1 && eins(l,'wichtel_schedule_created')[0][1].anzahl===3, 'wichtel_schedule_created mit anzahl');
  ok(eins(l,'wichtel_shopping_list_opened').length===1, 'wichtel_shopping_list_opened');
  const ac=eins(l,'wichtel_amazon_clicked')[0];
  ok(ac && typeof ac[1].artikel==='string' && ac[1].artikel.length>0 && ac[1].geschichte>=1, 'wichtel_amazon_clicked mit artikel und geschichte');
  ok(eins(l,'wichtel_template_downloaded').length===1, 'wichtel_template_downloaded');
  ok(l.every(e=>e[1].produkt==='wichtel'), 'Alle Ereignisse mit produkt wichtel');
  ok(l.every(e=>e[1].pruefung==='praxis'), 'Alle Ereignisse mit pruefung praxis (Testlauf)');
  ok(l.every(e=>!('familie' in e[1])), 'Vor der Anmeldung keine familie');

  // Kinder-Ansicht: Geschichte 1 als Bildergeschichte bis zum Ende, mit Vorlesen
  await p.goto(B+'wichtel-kind.html?nr=1&ab=bilder'); await p.waitForSelector('#s-bilder:not([hidden])', {timeout:10000});
  await p.click('#vorlesen');
  for(let i=0;i<6;i++) if(await p.locator('#weiter').isEnabled()) await p.click('#weiter');
  await p.click('#zurueck'); await p.click('#weiter');   // nochmal ans Ende: zählt nicht doppelt
  l=await mk(p);
  ok(eins(l,'wichtel_story_started').filter(e=>e[1].geschichte===1 && e[1].format==='bilder').length===1, 'wichtel_story_started Bildergeschichte 1 (einmal)');
  ok(eins(l,'wichtel_story_completed').filter(e=>e[1].geschichte===1 && e[1].format==='bilder').length===1, 'wichtel_story_completed Bildergeschichte 1 (einmal)');
  ok(eins(l,'wichtel_read_aloud').filter(e=>e[1].geschichte===1).length===1, 'wichtel_read_aloud Geschichte 1');

  // Geschichte 2: Schranke, Anmeldung → signup mit familie, kanal, g1_gesehen
  await p.goto(B+'wichtel-kind.html?nr=2&ab=bilder'); await p.waitForSelector('#s-schranke:not([hidden])', {timeout:10000});
  await p.click('#anmelden');
  await p.waitForSelector('#kd-mail'); await p.fill('#kd-mail','familie@test.de'); await p.click('#kd-los');
  await p.waitForSelector('#kd-code'); await p.fill('#kd-code','123456'); await p.click('#kd-ok');
  await p.waitForSelector('#s-bilder:not([hidden])', {timeout:10000}); await p.waitForTimeout(800);
  l=await mk(p);
  const su=eins(l,'signup')[0];
  ok(su && su[1].herkunft==='wichtel' && su[1].produkt==='wichtel', 'signup mit herkunft und produkt wichtel');
  ok(su && /^f-[a-z0-9]{12}$/.test(su[1].familie||''), 'signup mit zufälliger familie (keine Adresse, keine Konto-ID)');
  ok(su && su[1].kanal==='instagram' && su[1].kampagne==='start', 'signup mit kanal aus dem ersten Besuch');
  ok(su && su[1].g1_gesehen===true, 'signup mit g1_gesehen');
  ok(su && su[1].pruefung==='praxis', 'signup mit pruefung praxis');
  ok(!JSON.stringify(l).includes('familie@test.de') && !JSON.stringify(l).includes('U-familie'), 'Keine Adresse und keine Konto-ID in der Messung');
  const fam=su && su[1].familie;
  const st2=eins(l,'wichtel_story_started').filter(e=>e[1].geschichte===2)[0];
  ok(st2 && st2[1].familie===fam, 'Nach der Anmeldung: Ereignisse mit derselben familie');
  const z=db.wichtel['U-familie@test.de'];
  ok(z && z.daten.familie===fam && z.daten.pruefung==='praxis', 'Kennung und Prüf-Markierung liegen im Konto');

  // Gerät B, gleiches Konto: gleiche familie, Prüf-Markierung aus dem Konto
  const ses={access_token:'AT-familie@test.de', refresh_token:'RT-familie@test.de', ablauf:Date.now()+36e5, email:'familie@test.de', id:'U-familie@test.de'};
  const q=await geraet({'sj.konto':ses});
  await q.goto(B+'wichtel.html'); await q.waitForSelector('#s-vorb:not([hidden])', {timeout:10000}); await q.waitForTimeout(500);
  await q.goto(B+'wichtel-kind.html?nr=3&ab=bilder'); await q.waitForSelector('#s-bilder:not([hidden])', {timeout:10000});
  const lq=await mk(q), s3=eins(lq,'wichtel_story_started').filter(e=>e[1].geschichte===3)[0];
  ok(s3 && s3[1].familie===fam, 'Zweites Gerät: dieselbe familie');
  ok(s3 && s3[1].pruefung==='praxis', 'Zweites Gerät: pruefung aus dem Konto');

  ok(!errs.length, 'Keine Skriptfehler'+(errs.length?': '+errs.join(' | '):''));
  await b.close();
  console.log(f ? f+' Fehler' : 'Alles grün'); process.exit(f?1:0);
})().catch(e=>{ console.error(e); process.exit(1); });
