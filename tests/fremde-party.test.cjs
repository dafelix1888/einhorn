// PBIM-24/25: Öffnet ein Gerät mit eigener Party den Link zu einer fremden Party, darf die eigene Party
// weder auf dem Gerät verloren gehen noch auf dem Server überschrieben werden. UNICORN-36: Speichern vor Teilen.
const { chromium } = require('playwright');
const S='https://test.supabase.co', B=''+(process.env.BASIS||'http://localhost:8765')+'/app/';
const db={parties:{}, links:{}};
function nutzer(req){ const a=req.headers()['authorization']||''; return a.startsWith('Bearer AT-') ? 'U-'+a.slice(10) : null; }
async function mock(route){
  const req=route.request(), u=new URL(req.url()), m=req.method(), body=req.postData()?JSON.parse(req.postData()):null, me=nutzer(req);
  const j=(s,o)=>route.fulfill({status:s, contentType:'application/json', body:o===undefined?'':JSON.stringify(o)});
  if(u.pathname==='/auth/v1/otp') return j(200,{});
  if(u.pathname==='/auth/v1/verify') return j(200,{access_token:'AT-'+body.email, refresh_token:'RT-'+body.email, expires_in:3600, user:{id:'U-'+body.email, email:body.email}});
  if(u.pathname==='/rest/v1/rpc/link_lesen'){ const l=db.links[body.t]; return j(200, l?{rolle:l.rolle, daten:l.daten}:null); }
  if(/^\/rest\/v1\/rpc\/aufbau_/.test(u.pathname)) return j(200,null);
  if(u.pathname==='/functions/v1/namen') return j(200,{hash:null});
  if(!me) return j(401,{message:'permission denied'});
  if(u.pathname==='/rest/v1/parties'){
    if(m==='POST'){ const alt=db.parties[body.id]; if(alt && alt.owner!==me) return j(403,{message:'rls'}); db.parties[body.id]={...body, owner:me}; return j(201); }
    if(m==='GET') return j(200, Object.values(db.parties).filter(p=>p.owner===me));
  }
  if(u.pathname==='/rest/v1/links'){
    if(m==='POST'){ for(const l of body){ const p=db.parties[l.party_id]; if(!p||p.owner!==me) return j(403,{message:'rls'}); db.links[l.token]={...l, owner:me}; } return j(201); }
    if(m==='DELETE') return j(204);
  }
  if(u.pathname==='/rest/v1/antworten') return j(200, []);
  return j(200, []);
}
let fehler=0; function pruefe(ok, t){ console.log((ok?'ok   ':'FEHLER ')+t); if(!ok) fehler++; }

(async()=>{
  const b=await chromium.launch(), errs=[];
  async function geraet(){
    const c=await b.newContext({viewport:{width:393,height:852}});
    await c.route('https://efdjomgubucdnvgtuqmp.supabase.co/**', r=>r.abort());
    await c.addInitScript(()=>{ window.KONTO_TEST={url:'https://test.supabase.co', key:'anon'}; }); await c.route(S+'/**', mock);
    const p=await c.newPage(); p.on('pageerror',e=>errs.push(e.message)); return p;
  }
  const d=new Date(Date.now()+12*864e5).toISOString().slice(0,10);
  const mk=(name)=>({format:1,thema:'einhorn',kind:{name,alter:5},datum:d,start:'15:00',kinder:8,helfer:2,vorausgeher:true,ort:'draussen',planB:true,ausdrucke:true,erledigt:{},einkauf:{}});
  const plan={format:1,thema:'einhorn',variante:'a',kinder:8,strecke:900,stand:'x',stationen:[{lat:50,lng:8,name:'Start'},{lat:50.001,lng:8.001,name:'Ecke'}]};
  async function anmelden(p, email){ await p.evaluate(e=>localStorage.setItem('sj.konto', JSON.stringify({access_token:'AT-'+e, refresh_token:'RT-'+e, ablauf:Date.now()+36e5, email:e, id:'U-'+e})), email); }
  async function gespeichert(p, name, email){
    await p.goto(B); await p.evaluate(([pa,pl])=>{ localStorage.clear(); localStorage.setItem('sj.party.einhorn',JSON.stringify(pa)); localStorage.setItem('sj.plan.einhorn',JSON.stringify(pl)); }, [mk(name), plan]);
    await anmelden(p, email);
    await p.goto(B+'party.html?thema=einhorn'); await p.waitForTimeout(400);
    const ok=await p.evaluate(()=>Konto.sync('einhorn', true).then(()=>true, ()=>false));
    return ok && await p.evaluate(()=>Party.lesen('einhorn').server);
  }

  // Kollege: Leos Party, gespeichert
  const k=await geraet();
  let kServer=await gespeichert(k, 'Leo', 'kollege@test.de');
  if(!kServer){                                               // Anmeldung über das Fenster, falls die Test-Sitzung nicht greift
    await k.evaluate(()=>Konto.bereit('einhorn', function(){}));
    await k.fill('#kd-mail','kollege@test.de'); await k.click('#kd-los'); await k.waitForSelector('#kd-code'); await k.fill('#kd-code','123456');
    await k.waitForTimeout(2600); kServer=await k.evaluate(()=>Party.lesen('einhorn').server);
  }
  pruefe(!!(kServer && kServer.id), 'Kollege: Leos Party gespeichert');
  const leoId=kServer.id, vgLink=kServer.k.vorausgeher;

  // Felix: eigene Party Emma, gespeichert
  const f=await geraet();
  await f.goto(B); await f.evaluate(([pa,pl])=>{ localStorage.clear(); localStorage.setItem('sj.party.einhorn',JSON.stringify(pa)); localStorage.setItem('sj.plan.einhorn',JSON.stringify(pl)); }, [mk('Emma'), plan]);
  await f.goto(B+'party.html?thema=einhorn'); await f.waitForTimeout(400);
  await f.evaluate(()=>Konto.bereit('einhorn', function(){}));
  pruefe(/Deine/.test(await f.locator('.kd-wer').innerText()), 'Anmeldefenster sagt klar: deine eigene E-Mail (UNICORN-36)');
  await f.fill('#kd-mail','felix@test.de'); await f.click('#kd-los'); await f.waitForSelector('#kd-code'); await f.fill('#kd-code','123456');
  await f.waitForTimeout(2600);
  const fServer=await f.evaluate(()=>Party.lesen('einhorn').server);
  pruefe(!!(fServer && db.parties[fServer.id] && db.parties[fServer.id].party.kind.name==='Emma'), 'Felix: Emma gespeichert');

  // Felix öffnet den Vorausgeher-Link des Kollegen
  await f.goto(B+'vorausgeher.html?thema=einhorn&k='+vgLink); await f.waitForTimeout(1500);
  const lokal=await f.evaluate(()=>({p:Party.lesen('einhorn'), e:JSON.parse(localStorage.getItem('sj.eigen.einhorn')||'null')}));
  pruefe(lokal.p.kind.name==='Leo' && lokal.p.fremd===true && !lokal.p.server, 'Link: Leos Party fremd, ohne eigene server-Angaben');
  pruefe(lokal.e && lokal.e.party.kind.name==='Emma' && lokal.e.party.server.id===fServer.id, 'eigene Party Emma beiseitegelegt');
  const synct=await f.evaluate(()=>Konto.sync('einhorn', true));
  pruefe(synct===false && db.parties[fServer.id].party.kind.name==='Emma' && db.parties[leoId].party.kind.name==='Leo', 'Speichern gesperrt: Server unverändert');
  const nl=await f.evaluate(()=>Konto.neuerLink('einhorn','gast').then(()=>'ja', ()=>'nein'));
  pruefe(nl==='nein', '„Neuer Link“ für fremde Party gesperrt');

  // Mein Bereich und Party-Seite zeigen sie als fremd
  await f.goto(B+'party.html?thema=einhorn'); await f.waitForTimeout(600);
  pruefe(/gehört jemand anderem/.test(await f.locator('#seite').innerText()), 'Party-Seite: fremde Party, nichts bearbeiten');
  await f.evaluate(()=>Konto.bereich('einhorn')); await f.waitForTimeout(200);
  const mb=await f.locator('dialog.konto-dlg').innerText();
  pruefe(/Über einen Link geöffnet/i.test(mb) && !/Neuer Link/.test(mb) && !/Gäste/.test(mb), 'Mein Bereich: fremd, keine Links, keine Gäste');
  await f.click('[data-konto="eigene"]'); await f.waitForTimeout(900);
  const zurueck=await f.evaluate(()=>({p:Party.lesen('einhorn'), l:localStorage.getItem('sj.link.einhorn')}));
  pruefe(zurueck.p.kind.name==='Emma' && !zurueck.p.fremd && zurueck.p.server.id===fServer.id && !zurueck.l, '„Meine eigene Party öffnen“: Emma wieder da');

  // Reparatur: Gerät mit altem, vermischtem Stand (Leos Daten unter Emmas server.id)
  await f.evaluate(([leo,srv,k])=>{ const p=Object.assign(leo,{server:srv}); localStorage.setItem('sj.party.einhorn',JSON.stringify(p)); localStorage.setItem('sj.link.einhorn',JSON.stringify({k:k, rolle:'vorausgeher'})); localStorage.removeItem('sj.eigen.einhorn'); }, [mk('Leo'), fServer, vgLink]);
  await f.goto(B+'party.html?thema=einhorn'); await f.waitForTimeout(800);
  const rep=await f.evaluate(()=>Party.lesen('einhorn'));
  pruefe(rep.fremd===true && !rep.server, 'Reparatur: vermischte Party wird fremd, server entfernt');
  pruefe(db.parties[fServer.id].party.kind.name==='Emma', 'Reparatur: Emma auf dem Server unverändert');
  await f.click('#eigene-oeffnen'); await f.waitForTimeout(1200);
  const geholt=await f.evaluate(()=>Party.lesen('einhorn'));
  pruefe(geholt && geholt.kind.name==='Emma' && geholt.server && geholt.server.id===fServer.id, 'ohne Sicherung: eigene Party kommt vom Server zurück');

  // Eigener Link auf dem eigenen Gerät bleibt eigene Party
  await f.goto(B+'vorausgeher.html?thema=einhorn&k='+fServer.k.vorausgeher); await f.waitForTimeout(1200);
  const eig=await f.evaluate(()=>Party.lesen('einhorn'));
  pruefe(!eig.fremd && eig.server && eig.server.id===fServer.id, 'eigener Link: bleibt eigene Party mit server');

  // Teilen einer fremden Party: Hinweis statt Anmeldung
  await f.goto(B+'vorausgeher.html?thema=einhorn&k='+vgLink); await f.waitForTimeout(1200);
  await f.goto(B+'party.html?thema=einhorn'); await f.waitForTimeout(400);
  await f.evaluate(()=>Konto.bereit('einhorn', function(){ window.__geteilt=true; }));
  pruefe(/gehört jemand anderem/.test(await f.locator('dialog.konto-dlg').innerText()) && !(await f.evaluate(()=>window.__geteilt)), 'Teilen fremder Party: Hinweis, kein Teilen');

  pruefe(errs.length===0, 'keine Skriptfehler'+(errs.length?': '+errs.join(' | '):''));
  await b.close();
  console.log(fehler ? fehler+' Fehler' : 'Alles grün');
  process.exit(fehler?1:0);
})();
