// Kontowechsel im selben Browser (PBIM-30): Party wurde mit Konto A gespeichert, dann meldet sich Konto B an.
// Vorher lehnte der Server ab (fremde ID, RLS) und die Karte zeigte „Nicht gespeichert, kein Netz?“. Jetzt: eigene Kopie für B.
const { chromium } = require('playwright');
const S='https://test.supabase.co', B=(process.env.BASIS||'http://localhost:8765')+'/app/';
const db={parties:{}, links:{}};
let fehler=0; const ok=(c,t)=>{ console.log((c?'ok   ':'FEHLER ')+t); if(!c) fehler++; };
const nutzer=req=>{ const a=req.headers()['authorization']||''; return a.startsWith('Bearer AT-') ? 'U-'+a.slice(10) : null; };
async function mock(route){
  const req=route.request(), u=new URL(req.url()), m=req.method(), body=req.postData()?JSON.parse(req.postData()):null, me=nutzer(req);
  const j=(s,o)=>route.fulfill({status:s, contentType:'application/json', body:o===undefined?'':JSON.stringify(o)});
  if(u.pathname==='/auth/v1/user') return j(200,{id:me,email:(me||'').slice(2)});
  if(u.pathname==='/auth/v1/logout') return j(204);
  if(!me) return j(401,{message:'permission denied'});
  if(u.pathname==='/rest/v1/parties'){
    if(m==='POST'){ const alt=db.parties[body.id]; if(alt && alt.owner!==me) return j(403,{code:'42501',message:'new row violates row-level security policy'}); db.parties[body.id]={...body, owner:me}; return j(201); }
    if(m==='GET') return j(200, Object.values(db.parties).filter(p=>p.owner===me));
  }
  if(u.pathname==='/rest/v1/links'){
    if(m==='POST'){ for(const l of body){ const p=db.parties[l.party_id]; if(!p||p.owner!==me) return j(403,{}); const alt=db.links[l.token]; if(alt&&alt.owner!==me) return j(403,{}); db.links[l.token]={...l, owner:me}; } return j(201); }
    if(m==='GET') return j(200, []);
  }
  return j(200, []);
}
const PARTY={format:1,thema:'einhorn',kind:{name:'Mia',alter:5},datum:'2030-06-01',start:'15:00',kinder:6,helfer:2,vorausgeher:true,ort:'draussen',erledigt:{},einkauf:{}};
const PLAN={format:1,thema:'einhorn',variante:'a',kinder:6,stationen:[],strecke:0};

(async()=>{
  const b=await chromium.launch(), c=await b.newContext({viewport:{width:393,height:852}});
  await c.addInitScript(()=>{ window.KONTO_TEST={url:'https://test.supabase.co',key:'anon'}; });
  await c.route(S+'/**', mock);
  await c.route(/^https?:\/\/(?!localhost)(?!test\.supabase)/, r=>r.abort());
  const p=await c.newPage(); const pf=[]; p.on('pageerror', e=>pf.push(e.message));
  await p.goto(B+'party.html?thema=einhorn');
  await p.evaluate(([party, plan])=>{ localStorage.clear(); localStorage.setItem('sj.party.einhorn', JSON.stringify(party)); localStorage.setItem('sj.plan.einhorn', JSON.stringify(plan)); }, [PARTY, PLAN]);

  // Konto A speichert
  await p.evaluate(()=>{ const s={access_token:'AT-a@x.de', refresh_token:'RT-a@x.de', ablauf:Date.now()+3600e3, email:'a@x.de', id:'U-a@x.de'}; localStorage.setItem('sj.konto', JSON.stringify(s)); });
  await p.reload(); await p.waitForFunction(()=>window.Konto && Konto.angemeldet && Konto.angemeldet());
  await p.evaluate(()=>Konto.sync('einhorn', true));
  const idA=await p.evaluate(()=>JSON.parse(localStorage.getItem('sj.party.einhorn')).server.id);
  ok(db.parties[idA] && db.parties[idA].owner==='U-a@x.de', 'Konto A: Party gespeichert');
  ok(await p.evaluate(()=>JSON.parse(localStorage.getItem('sj.party.einhorn')).server.owner)==='U-a@x.de', 'Besitzer im Gerät vermerkt');

  // Abmelden, Konto B im selben Browser
  await p.evaluate(()=>{ const s={access_token:'AT-b@x.de', refresh_token:'RT-b@x.de', ablauf:Date.now()+3600e3, email:'b@x.de', id:'U-b@x.de'}; localStorage.setItem('sj.konto', JSON.stringify(s)); });
  await p.reload(); await p.waitForFunction(()=>window.Konto && Konto.angemeldet && Konto.angemeldet());
  const r=await p.evaluate(()=>Konto.sync('einhorn', true).then(()=>'ok', e=>'fehler '+e.message));
  const idB=await p.evaluate(()=>JSON.parse(localStorage.getItem('sj.party.einhorn')).server.id);
  ok(r==='ok' && idB!==idA && db.parties[idB] && db.parties[idB].owner==='U-b@x.de', 'Konto B: eigene Kopie gespeichert statt Fehler');
  ok(db.parties[idA].owner==='U-a@x.de', 'Party von Konto A bleibt unverändert');

  // Alte Partys ohne Besitzer-Vermerk: Server lehnt ab → einmal als Kopie
  await p.evaluate(id=>{ const x=JSON.parse(localStorage.getItem('sj.party.einhorn')); x.server={id, k:x.server.k}; localStorage.setItem('sj.party.einhorn', JSON.stringify(x)); localStorage.removeItem('sj.konto.stand.einhorn'); }, idA);
  const r2=await p.evaluate(()=>Konto.sync('einhorn', true).then(()=>'ok', e=>'fehler '+e.message));
  const idC=await p.evaluate(()=>JSON.parse(localStorage.getItem('sj.party.einhorn')).server.id);
  ok(r2==='ok' && idC!==idA && db.parties[idC].owner==='U-b@x.de', 'Ohne Besitzer-Vermerk: nach Ablehnung eigene Kopie');
  ok(!pf.length, 'Keine JS-Fehler'+(pf.length?': '+pf[0]:''));
  await b.close(); console.log(fehler?fehler+' FEHLER':'ALLES OK'); process.exit(fehler?1:0);
})();
