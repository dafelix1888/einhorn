// Konto und geschützte Links gegen ein nachgebautes Supabase (im Speicher, mit Eigentümer-Prüfung wie RLS)
const { chromium } = require('playwright');
const S='https://test.supabase.co', B=''+(process.env.BASIS||'http://localhost:8765')+'/app/';
const db={parties:{}, links:{}, aufbau:{}, namen:{}}, mails=[];
let stimmeAus=true;   // erst ohne Schlüssel (UNICORN-8)
function nutzer(req){ const a=req.headers()['authorization']||''; return a.startsWith('Bearer AT-') ? 'U-'+a.slice(10) : null; }
async function mock(route){
  const req=route.request(), u=new URL(req.url()), m=req.method(), body=req.postData()?JSON.parse(req.postData()):null, me=nutzer(req);
  const j=(s,o)=>route.fulfill({status:s, contentType:'application/json', body:o===undefined?'':JSON.stringify(o)});
  if(req.headers()['apikey']!=='anon') return j(401,{message:'no apikey'});
  if(u.pathname==='/auth/v1/otp'){ mails.push(body.email); return j(200,{}); }
  if(u.pathname==='/auth/v1/verify'){ if(body.token!=='123456') return j(403,{msg:'Token has expired or is invalid'}); return j(200,{access_token:'AT-'+body.email, refresh_token:'RT-'+body.email, expires_in:3600, user:{id:'U-'+body.email, email:body.email}}); }
  if(u.pathname==='/auth/v1/logout') return j(204);
  if(u.pathname==='/rest/v1/rpc/link_lesen'){ const l=db.links[body.t]; return j(200, l?{rolle:l.rolle, daten:l.daten}:null); }
  if(u.pathname==='/rest/v1/rpc/aufbau_setzen'){ const l=db.links[body.t]; if(!l||l.rolle!=='vorausgeher') return j(200,null); const st={}; for(const k in body.stationen) if(/^\d{1,2}$/.test(k)&&body.stationen[k]===true) st[k]=true; db.aufbau[l.party_id]={stationen:st, aktualisiert:new Date().toISOString()}; return j(200,{stationen:st}); }
  if(u.pathname==='/rest/v1/rpc/aufbau_lesen'){ const l=db.links[body.t]; if(!l||l.rolle==='gast') return j(200,null); const a=db.aufbau[l.party_id]||{stationen:{},aktualisiert:null}; return j(200,a); }
  if(u.pathname==='/functions/v1/namen'){
    if(body.aktion==='holen'){ const l=db.links[body.t]; if(!l||l.rolle!=='spiel') return j(404,{fehler:'Link geht nicht'}); const n=db.namen[l.party_id]; if(!n) return j(200,{hash:null}); if(body.hash===n.hash) return j(200,{hash:n.hash,gleich:true}); return j(200,{hash:n.hash,saetze:n.saetze}); }
    const p=db.parties[body.party_id]; if(!me||!p||p.owner!==me) return j(401,{fehler:'Nicht angemeldet oder fremde Party'});
    const n=db.namen[body.party_id]||{erzeugungen:0};
    if(body.aktion==='stand') return j(200,{max:3,uebrig:3-n.erzeugungen,hash:n.hash||null,texte:n.saetze?{gruss:n.saetze.gruss.text,schatz:n.saetze.schatz.text,abschied:n.saetze.abschied.text}:null,name:n.saetze?n.saetze.gruss.name:'',aussprache:''});
    if(!/^[\p{L}][\p{L} '-]{0,29}$/u.test(body.name)) return j(400,{fehler:'Bitte nur einen Vornamen mit Buchstaben eingeben.'});
    if(n.saetze && n.saetze.gruss.name===body.name) return j(200,{max:3,uebrig:3-n.erzeugungen,hash:n.hash,saetze:n.saetze,gleich:true});   // gleicher Text kostet nichts
    if(n.erzeugungen>=3) return j(402,{fehler:'Alle 3 Erzeugungen sind verbraucht.',uebrig:0});
    if(stimmeAus) return j(503,{fehler:'Die Stimme ist noch nicht eingerichtet.'});   // wie live ohne ELEVENLABS_API_KEY
    const mp3=require('fs').readFileSync(require('path').join(__dirname,'..','app/themen/einhorn/hoerprobe.mp3')).toString('base64');
    const mk=t=>({text:t,name:body.name,aussprache:body.aussprache,b64:mp3});
    db.namen[body.party_id]={erzeugungen:n.erzeugungen+1,hash:'h'+(n.erzeugungen+1),saetze:{gruss:mk('Und heute ist ein ganz besonderer Tag: '+body.name+' hat Geburtstag!'),schatz:mk('Alles Liebe, '+body.name+'!'),abschied:mk('Tschüss, '+body.name+'!')}};
    const z=db.namen[body.party_id]; return j(200,{max:3,uebrig:3-z.erzeugungen,hash:z.hash,saetze:z.saetze});
  }
  if(!me) return j(401,{message:'permission denied'});
  if(u.pathname==='/rest/v1/parties'){
    if(m==='POST'){ const alt=db.parties[body.id]; if(alt && alt.owner!==me) return j(403,{message:'rls'}); db.parties[body.id]={...body, owner:me, aktualisiert:Date.now()}; return j(201); }
    if(m==='GET') return j(200, Object.values(db.parties).filter(p=>p.owner===me));
    if(m==='DELETE'){ const id=u.searchParams.get('id').slice(3); if(db.parties[id]&&db.parties[id].owner===me){ delete db.parties[id]; for(const k in db.links) if(db.links[k].party_id===id) delete db.links[k]; } return j(204); }
  }
  if(u.pathname==='/rest/v1/links'){
    if(m==='POST'){ for(const l of body){ const p=db.parties[l.party_id]; if(!p||p.owner!==me) return j(403,{message:'rls'}); const alt=db.links[l.token]; if(alt&&alt.owner!==me) return j(403,{}); db.links[l.token]={...l, owner:me}; } return j(201); }
    if(m==='DELETE'){ const t=u.searchParams.get('token').slice(3); if(db.links[t]&&db.links[t].owner===me) delete db.links[t]; return j(204); }
  }
  return j(404,{message:'?'});
}
let fehler=0; function pruefe(ok, t){ console.log((ok?'ok   ':'FEHLER ')+t); if(!ok) fehler++; }

(async()=>{
  const b=await chromium.launch(), errs=[];
  async function geraet(mitServer=true){
    const c=await b.newContext({viewport:{width:393,height:852}});
    await c.route('https://efdjomgubucdnvgtuqmp.supabase.co/**', r=>r.abort());   // kein echtes Marketer-Tracking aus Tests
    if(mitServer){ await c.addInitScript(()=>{ window.KONTO_TEST={url:'https://test.supabase.co', key:'anon'}; }); await c.route(S+'/**', mock); }
    else await c.addInitScript(()=>{ window.KONTO_TEST={url:'', key:''}; });
    const p=await c.newPage(); p.on('pageerror',e=>errs.push(e.message)); return p;
  }
  const d=new Date(Date.now()+12*864e5).toISOString().slice(0,10);
  const party={format:1,thema:'einhorn',kind:{name:'Emma',alter:5},datum:d,start:'15:00',kinder:8,helfer:2,vorausgeher:true,ort:'draussen',planB:true,ausdrucke:true,erledigt:{},einkauf:{},telefon:'01701234567',gaesteHinweis:'Matschhose'};
  const plan={format:1,thema:'einhorn',variante:'a',kinder:8,adresse:'Teststraße 1',strecke:1200,stand:'x',stationen:[{lat:53.5,lng:9.9,name:'Haustür'},{lat:53.501,lng:9.901,name:'Ecke'}]};

  // Gerät A: Eltern
  const a=await geraet();
  await a.goto(B); await a.evaluate(([p,pl])=>{ localStorage.clear(); localStorage.setItem('sj.party.einhorn',JSON.stringify(p)); localStorage.setItem('sj.plan.einhorn',JSON.stringify(pl)); }, [party, plan]);
  await a.goto(B+'party.html?thema=einhorn'); await a.waitForTimeout(800);
  pruefe(await a.locator('#konto-karte').innerText().then(t=>/Noch nicht gespeichert/.test(t)), 'Karte: noch nicht gespeichert');
  pruefe(await a.evaluate(()=>Party.einladungsLink(Party.lesen('einhorn'), Party.plan('einhorn'))===null), 'ohne Speichern kein Einladungslink');
  await a.locator('#gast-link').click();
  pruefe(await a.locator('dialog.konto-dlg').isVisible(), 'Teilen öffnet Anmeldung');
  await a.fill('#kd-mail','eltern@test.de'); await a.click('#kd-los'); await a.waitForSelector('#kd-code');
  pruefe(mails[0]==='eltern@test.de', 'Code angefordert');
  await a.fill('#kd-code','000000'); await a.waitForFunction(()=>/stimmt nicht/.test((document.getElementById('kd-f')||{}).textContent||''), null, {timeout:8000}).catch(()=>{});
  pruefe(/stimmt nicht/.test(await a.locator('#kd-f').innerText()), 'falscher Code wird abgelehnt');
  await a.fill('#kd-code','123456'); await a.waitForTimeout(2600);
  pruefe(!(await a.locator('dialog.konto-dlg').isVisible()), 'Fenster zu nach Anmeldung');
  pruefe(/Geschützt gespeichert/.test(await a.locator('#konto-karte').innerText()), 'Karte: geschützt gespeichert');
  await a.screenshot({path:'konto-karte.png'});
  pruefe(Object.keys(db.parties).length===1 && Object.keys(db.links).length===3, 'Server: 1 Party, 3 Links');
  const gast=Object.values(db.links).find(l=>l.rolle==='gast');
  pruefe(!JSON.stringify(gast.daten).includes('53.5') && !gast.daten.stationen, 'Gast-Daten ohne Route');
  const links=await a.evaluate(()=>{ const p=Party.lesen('einhorn'), pl=Party.plan('einhorn'); return {e:Party.einladungsLink(p,pl), v:Party.vorausgeherLink(p,pl), s:Party.spielLink(p,pl)}; });
  pruefe(/einladung\.html\?k=[\w-]{24}$/.test(links.e) && /&k=/.test(links.v) && /&k=/.test(links.s) && !/plan=|e=/.test(links.e+links.v+links.s), 'Links nur mit Schlüssel');

  // Funkel kennt das Kind (steht im Schritt „iPad startklar machen“)
  await a.click('[data-oeffne="geraet"]');
  await a.waitForSelector('#namen-name', {timeout:5000});
  pruefe(await a.inputValue('#namen-name')==='Emma', 'Namens-Karte mit Vorname');
  await a.click('#namen-los'); await a.waitForSelector('.namen-fehler', {timeout:5000});
  pruefe(/noch nicht eingerichtet/.test(await a.locator('#namen-karte').innerText()) && /Noch 3 von 3/.test(await a.locator('#namen-karte').innerText()), 'Ohne Schlüssel: verständliche Meldung, nichts verbraucht');
  stimmeAus=false;
  await a.click('#namen-los'); await a.waitForSelector('[data-namen-hoeren="gruss"]', {timeout:5000});
  pruefe(/Emma hat Geburtstag/.test(await a.locator('#namen-karte').innerText()) && /Noch 2 von 3/.test(await a.locator('#namen-karte').innerText()), 'Sätze erzeugt, noch 2 übrig');
  await a.click('#namen-los'); await a.waitForFunction(()=>!document.querySelector('#namen-los') || !document.querySelector('#namen-los').disabled);
  await a.waitForTimeout(300);
  pruefe(/Noch 2 von 3/.test(await a.locator('#namen-karte').innerText()) && db.namen[Object.keys(db.namen)[0]].erzeugungen===1, 'Gleicher Name noch einmal: zählt nicht');
  await a.locator('#namen-karte').screenshot({path:'namen-karte.png'});
  // Änderung wird nachgespeichert
  await a.click('[data-oeffne="einladen"]');
  await a.fill('#gh','Regenhose und Mütze'); await a.locator('#gh').blur(); await a.waitForTimeout(2000);
  pruefe(Object.values(db.links).find(l=>l.rolle==='gast').daten.h==='Regenhose und Mütze', 'Änderung landet auf dem Server');

  // Gast: fremdes Gerät ohne Konto
  const g=await geraet(); await g.goto(links.e); await g.waitForTimeout(800);
  const gt=await g.locator('#seite').innerText();
  pruefe(/Emma wird 5/.test(gt) && /Regenhose und Mütze/.test(gt), 'Gast sieht Einladung mit Hinweis');
  await g.screenshot({path:'konto-gast.png'});
  pruefe(await g.evaluate(()=>!localStorage.getItem('sj.plan.einhorn') && !localStorage.getItem('sj.party.einhorn')), 'Gast-Gerät bekommt keine Route');
  const kaputt=await geraet(); await kaputt.goto(B+'einladung.html?k=AAAAAAAAAAAAAAAAAAAAAAAA'); await kaputt.waitForTimeout(600);
  pruefe(/nicht gefunden/.test(await kaputt.locator('#seite').innerText()), 'erfundener Schlüssel: nichts');

  // Vorausgeher
  const v=await geraet(); await v.goto(links.v); await v.waitForURL(u=>!/k=/.test(u.toString()), {timeout:8000}); await v.waitForTimeout(800);
  pruefe(await v.evaluate(()=>{ const pl=JSON.parse(localStorage.getItem('sj.plan.einhorn')); return pl.stationen.length===2 && !JSON.parse(localStorage.getItem('sj.party.einhorn')).server; }), 'Vorausgeher hat Route, keine Schlüssel');
  pruefe(await v.evaluate(()=>JSON.parse(localStorage.getItem('sj.link.einhorn')).rolle==='vorausgeher'), 'Vorausgeher-Link gemerkt');
  pruefe(/live/.test(await v.locator('#live-hinweis').innerText()), 'Vorausgeher: Hinweis live');
  await v.locator('[data-weiter]').first().click(); await v.waitForTimeout(800);
  pruefe(Object.values(db.aufbau)[0] && Object.keys(Object.values(db.aufbau)[0].stationen).length===1, 'Haken landet auf dem Server');
  // iPad
  const s=await geraet(); await s.goto(links.s); await s.waitForURL(u=>!/k=/.test(u.toString()), {timeout:8000}); await s.waitForTimeout(1500);
  pruefe(await s.evaluate(()=>JSON.parse(localStorage.getItem('sj.plan.einhorn')).stationen[1].name==='Ecke'), 'iPad hat die Tour');
  await s.waitForTimeout(1000);
  const live=await s.locator('#aufbau-live').innerText().catch(()=> '');
  console.log('   iPad zeigt:', live); pruefe(/bis Station 2 aufgebaut|alles aufgebaut/.test(live), 'iPad sieht den Aufbau live');
  await s.screenshot({path:'konto-ipad.png'});
  await s.waitForTimeout(800);
  const nk=await s.evaluate(()=>{ const k=__zs.clips(); return ['n.gruss','n.schatz','n.abschied'].map(x=>k.includes(x)); });
  pruefe(nk.every(Boolean), 'iPad hat die drei Namens-Sätze');
  pruefe(await s.evaluate(()=>{ const st=__zs.state(); st.phase='end'; const a=__zs.akt(); return a.zweit && a.zweit.key==='n.schatz' && a.zweit.zweit.key==='ende.b'; }), 'Schatz: Namens-Satz in der Kette');
  pruefe(await s.evaluate(()=>{ const st=__zs.state(); st.phase='scene'; st.idx=0; st.step=0; const a=__zs.akt(); return a.zweit.key==='n.gruss' && a.zweit.zweit.key==='s0.b'; }), 'Begrüßung: Namens-Satz zwischen Teil 1 und 2');
  pruefe(await s.evaluate(()=>{ const st=__zs.state(); st.phase='heim'; st.step=1; return __zs.akt().zweit.key==='n.abschied'; }), 'Abschied: Namens-Satz am Ende');
  const g3=await geraet(); await g3.goto(B); const gastLiest=await g3.evaluate(async(t)=>{ const r=await fetch('https://test.supabase.co/rest/v1/rpc/aufbau_lesen',{method:'POST',headers:{apikey:'anon','Content-Type':'application/json'},body:JSON.stringify({t})}); return r.json(); }, links.e.split('k=')[1]);
  pruefe(gastLiest===null, 'Gast-Link liest keinen Aufbau');

  // Link sperren
  await a.locator('#konto-karte summary').click();
  a.once('dialog', x=>x.accept()); await a.locator('[data-konto-neu="gast"]').click(); await a.waitForTimeout(1200);
  const neuE=await a.evaluate(()=>Party.einladungsLink(Party.lesen('einhorn'), Party.plan('einhorn')));
  pruefe(neuE!==links.e && !db.links[links.e.split('k=')[1]] && Object.keys(db.links).length===3, 'neuer Gast-Link, alter gelöscht');
  const g2=await geraet(); await g2.goto(links.e); await g2.waitForTimeout(800);
  pruefe(/ersetzt/.test(await g2.locator('#seite').innerText()), 'alter Gast-Link geht nicht mehr');
  // nach dem Sperren weiter ändern: alter Schlüssel darf nicht zurückkommen
  await a.fill('#gh','Gummistiefel'); await a.locator('#gh').blur(); await a.waitForTimeout(2000);
  pruefe(!db.links[links.e.split('k=')[1]] && Object.values(db.links).find(l=>l.rolle==='gast').daten.h==='Gummistiefel', 'alter Schlüssel bleibt gesperrt');

  // Zweites Gerät der Eltern: anmelden holt die Party
  const z=await geraet(); await z.goto(B+'party.html?thema=einhorn'); await z.waitForTimeout(600);
  await z.evaluate(()=>Konto.codePruefen('eltern@test.de','123456')); await z.evaluate(()=>Konto.holen());
  pruefe(await z.evaluate(()=>{ const p=Party.lesen('einhorn'); return p && p.kind.name==='Emma' && !!p.server && Party.plan('einhorn').stationen.length===2; }), 'zweites Gerät holt Party und Route');

  // Fremde Eltern sehen nichts
  const f=await geraet(); await f.goto(B+'party.html?thema=einhorn'); await f.evaluate(()=>Konto.codePruefen('fremd@test.de','123456'));
  pruefe(await f.evaluate(()=>Konto.holen())===0, 'fremdes Konto sieht keine Party');

  // Löschen räumt den Server auf
  await a.evaluate(()=>{ window.confirm=()=>true; }); await a.locator('#loeschen').click(); await a.waitForTimeout(800);
  pruefe(Object.keys(db.parties).length===0 && Object.keys(db.links).length===0, 'Party löschen löscht auch auf dem Server');

  // Ohne Server wie bisher
  const o=await geraet(false); await o.goto(B); await o.evaluate(([p,pl])=>{ localStorage.setItem('sj.party.einhorn',JSON.stringify(p)); localStorage.setItem('sj.plan.einhorn',JSON.stringify(pl)); }, [party, plan]);
  await o.goto(B+'party.html?thema=einhorn'); await o.waitForTimeout(800);
  pruefe(await o.locator('#konto-karte').count()===0, 'ohne Server keine Konto-Karte');
  pruefe(await o.evaluate(()=>/\?e=/.test(Party.einladungsLink(Party.lesen('einhorn'), Party.plan('einhorn')))), 'ohne Server: Daten im Link wie bisher');

  console.log('Seitenfehler:', errs); console.log(fehler?fehler+' FEHLER':'ALLES OK');
  await b.close(); process.exit(fehler?1:0);
})();
