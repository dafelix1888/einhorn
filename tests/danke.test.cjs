const { chromium } = require('playwright');
const S='https://test.supabase.co', B=''+(process.env.BASIS||'http://localhost:8765')+'/app/';
const db={parties:{}, links:{}, feedback:[]};
async function mock(route){
  const req=route.request(), u=new URL(req.url()), m=req.method(), body=req.postData()?JSON.parse(req.postData()):null;
  const a=req.headers()['authorization']||'', me=a.startsWith('Bearer AT-')?'U-'+a.slice(10):null;
  const j=(s,o)=>route.fulfill({status:s, contentType:'application/json', body:o===undefined?'':JSON.stringify(o)});
  if(u.pathname==='/auth/v1/verify') return j(200,{access_token:'AT-'+body.email, refresh_token:'RT', expires_in:3600, user:{id:'U-'+body.email, email:body.email}});
  if(u.pathname==='/rest/v1/rpc/link_lesen'){ const l=db.links[body.t]; return j(200, l?{rolle:l.rolle, daten:l.daten}:null); }
  if(u.pathname==='/rest/v1/rpc/feedback_geben'){ const l=db.links[body.t]; if(!l||l.rolle!=='gast') return j(200,false); db.feedback.push({party_id:l.party_id, wert:body.wert}); return j(200,true); }
  if(u.pathname==='/rest/v1/feedback'){ const id=u.searchParams.get('party_id').slice(3); return j(200, db.feedback.filter(f=>f.party_id===id&&db.parties[id].owner===me).map(f=>({wert:f.wert}))); }
  if(u.pathname==='/rest/v1/parties'&&m==='POST'){ db.parties[body.id]={...body, owner:me}; return j(201); }
  if(u.pathname==='/rest/v1/parties'&&m==='GET') return j(200,[]);
  if(u.pathname==='/rest/v1/links'&&m==='POST'){ for(const l of body) db.links[l.token]={...l}; return j(201); }
  if(u.pathname.startsWith('/functions/')) return j(401,{fehler:'x'});
  return j(404,{});
}
let f=0; const ok=(c,t)=>{ console.log((c?'ok   ':'FEHLER ')+t); if(!c) f++; };
(async()=>{
  const b=await chromium.launch(), errs=[];
  async function geraet(){ const c=await b.newContext({viewport:{width:393,height:852}}); await c.route('https://efdjomgubucdnvgtuqmp.supabase.co/**', r=>r.abort()); await c.addInitScript(()=>{ window.KONTO_TEST={url:'https://test.supabase.co', key:'anon'}; }); await c.route(S+'/**', mock); const p=await c.newPage(); p.on('pageerror',e=>errs.push(e.message)); return p; }
  const heute=new Date().toISOString().slice(0,10);
  const party={format:1,thema:'einhorn',kind:{name:'Emma',alter:5},datum:heute,start:'00:01',kinder:6,helfer:2,vorausgeher:true,ort:'draussen',planB:true,ausdrucke:true,erledigt:{},einkauf:{}};
  const a=await geraet(); await a.goto(B+'party.html?thema=einhorn');
  await a.evaluate(p=>{ localStorage.setItem('sj.party.einhorn',JSON.stringify(p)); }, party);
  await a.evaluate(()=>Konto.codePruefen('e@test.de','123456')); await a.reload(); await a.waitForTimeout(1500);
  ok(await a.locator('#danke-link').isVisible(), 'Nach der Party: Knopf Danke-Link');
  const link=await a.evaluate(()=>Party.dankeLink(Party.lesen('einhorn'), Party.plan('einhorn')));
  ok(/danke\.html\?k=/.test(link), 'Danke-Link mit Schlüssel: '+link.split('/').pop().slice(0,20));
  await a.screenshot({path:'danke-eltern.png'});
  const g=await geraet(); await g.goto(link); await g.waitForTimeout(1200);
  ok(/Danke fürs Mitfeiern/.test(await g.locator('#seite').innerText()), 'Gast sieht Danke-Seite');
  await g.fill('#kind','Lotta'); await g.waitForTimeout(200);
  const hell=await g.evaluate(()=>{ const c=document.getElementById('urkunde').getContext('2d').getImageData(600,920,200,40).data; let n=0; for(let i=0;i<c.length;i+=4) if(c[i]<100) n++; return n; });
  ok(hell>50, 'Urkunde zeigt den Namen');
  await g.locator('[data-wert="3"]').click(); await g.waitForTimeout(500);
  ok(db.feedback.length===1 && db.feedback[0].wert===3, 'Rückmeldung angekommen');
  await g.screenshot({path:'danke-gast.png', fullPage:true});
  await g.reload(); await g.waitForTimeout(1200);
  ok(await g.locator('[data-wert="3"]').getAttribute('aria-pressed')==='true', 'nur einmal abstimmen');
  ok(/landing\.html\?utm_source=danke/.test(await g.locator('.selbst a').getAttribute('href')), 'Weg zur eigenen Party');
  await a.reload(); await a.waitForTimeout(1500);
  ok(/1 Familie hat geantwortet: 😍 1/.test(await a.locator('#rueckmeldung').innerText()), 'Eltern sehen Rückmeldung');
  const oc=await b.newContext(); await oc.route('https://efdjomgubucdnvgtuqmp.supabase.co/**', r=>r.abort()); await oc.addInitScript(()=>{ window.KONTO_TEST={url:'',key:''}; }); const ohne=await oc.newPage(); await ohne.goto(B+'party.html'); const alt=await ohne.evaluate(p=>{ return Party.dankeLink(p,null); }, party);
  await ohne.goto(alt); await ohne.waitForTimeout(800);
  ok(/Danke fürs Mitfeiern/.test(await ohne.locator('#seite').innerText()) && await ohne.locator('#rueck').count()===0, 'ohne Server: Danke-Seite ohne Abstimmung');
  ok(errs.length===0, 'keine Seitenfehler '+errs.join(' | '));
  console.log(f?f+' FEHLER':'ALLES OK'); await b.close(); process.exit(f?1:0);
})();
