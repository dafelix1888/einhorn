// Ganze Tour (UNICORN-126): je Knopfdruck, wer was sagt. Wenige Wechsel Funkel → Erzähler, keine doppelte Aufgabe, kurzer Start.
const { chromium } = require('playwright');
let fehler=0; const ok=(b,t)=>{ console.log((b?'ok   ':'FEHL ')+t); if(!b) fehler++; };
async function lauf(b, ERZ, V){ const IND=V==='c';
const c=await b.newContext({viewport:{width:393,height:852}});
await c.addInitScript(()=>{ window.KONTO_TEST={url:'',key:''}; });
await c.route(/^https?:\/\/(?!localhost)/, r=>r.abort());
const p=await c.newPage(); p.on('pageerror',e=>console.log('ERR',e.message)); await p.goto('http://localhost:8765/app/');
await p.evaluate(([erz,v])=>{ localStorage.clear(); const st=[0,1,2,3,4,5,6].map(i=>({lat:53.55+i*0.001,lng:10,name:'O'}));
 localStorage.setItem('sj.plan.einhorn', JSON.stringify({format:1,thema:'einhorn',variante:v,kinder:6,stationen:st,strecke:900}));
 localStorage.setItem('sj.einhorn.v1', JSON.stringify({points:st.map(s=>({lat:s.lat,lng:s.lng})), idx:0, phase:'start', step:0, radius:15, showTest:true, autoSag:true, variante:v, erz:erz})); }, [ERZ,V]);
await p.goto('http://localhost:8765/app/spiel.html?thema=einhorn'+(IND?'&ort=drinnen':'')); await p.waitForTimeout(1200);
await p.evaluate(()=>{ window.LOG=[]; window.__hoer=function(w,k,t){ LOG.push({w:w,k:k,t:t}); return true; }; });
const out=[]; let n=0;
const st=()=>p.evaluate(()=>{ const s=__zs.state(); return {ph:s.phase,i:s.idx,s:s.step,spur:s.spur||''}; });
async function tipp(sel, name){ await p.evaluate(()=>LOG.length=0); const s0=await st(); await p.evaluate(q=>document.querySelector(q).click(), sel); let vor=0; for(let w=0; w<8; w++){ await p.waitForTimeout(2000); const n=await p.evaluate(()=>LOG.length); if(n===vor) break; vor=n; }   /* warten, bis 2 s niemand mehr spricht */ const l=await p.evaluate(()=>LOG.slice()); out.push({tipp:name, st:s0, l}); }
async function vis(sel){ return p.locator(sel).first().isVisible().catch(()=>false); }
const JA={3:'sonne',4:'fuchs'};
for(let guard=0; guard<80; guard++){
  const s=await st(); if(s.ph==='heim' || s.ph==='end'){ if(s.ph==='end'){ await tipp('#btn-main','Heimweg starten'); } break; }
  const mt=(await p.textContent('#btn-main')||'').trim(), mv=await vis('#btn-main');
  if(s.ph==='seek'){
    await tipp('#btn-speak','Unterwegs: „Funkel sprechen lassen“');
    if(mv && mt) await p.click('#btn-main'); else await p.evaluate(()=>{ const b=document.getElementById('btn-hand')||document.getElementById('btn-test'); b.click(); });
    await p.waitForSelector('#btn-pop', {state:'visible', timeout:8000});
    await tipp('#btn-pop','Angekommen → „Weiter“ (Station '+(s.i+1)+')'); continue;
  }
  if(s.ph==='scene' && s.spur==='zeigen'){ await p.waitForTimeout(5600); const l=await p.evaluate(()=>LOG.splice(0)); out.push({tipp:'(5 s später: Nebel)', st:s, l}); continue; }
  if(mv && mt){ await tipp('#btn-main', mt); continue; }
  const ch=await p.evaluate((ja)=>{ const cs=[...document.querySelectorAll('#choices .choice')].filter(e=>e.offsetParent); if(!cs.length) return null; const r=cs.find(e=>e.dataset.id===ja)||cs.find(e=>/richtig|echt/.test(e.className))||null; return r? '#choices .choice[data-id="'+r.dataset.id+'"]' : '#choices .choice[data-id="'+cs[0].dataset.id+'"]'; }, JA[s.i]);
  if(ch){ await tipp(ch, 'Kind tippt Bild ('+ch.match(/data-id="([^"]+)/)[1]+')'); continue; }
  const bild=await vis('#mirror-pic [data-ja], #mirror-pic .tippbar, #mirror'); 
  out.push({tipp:'?? hängt', st:s, l:[]}); break;
}
await c.close(); return out; }
(async()=>{ const b=await chromium.launch();
  const LAEUFE=[['kakapups','a'],['dagobert','a'],['kakapups','c']], ERG=await Promise.all(LAEUFE.map(([e,v])=>lauf(b, e, v)));   // parallel, sonst über 4 Minuten
  for(const [n,[erz,v]] of LAEUFE.entries()){
    const out=ERG[n], wo=erz+'/'+(v==='c'?'drinnen':'draußen'), alle=[].concat(...out.map(x=>x.l));
    const E=alle.filter(x=>x.w==='Erzähler'), wechsel=out.filter(x=>x.l.some(y=>y.w==='Erzähler')).length;
    ok(!out.some(x=>x.tipp==='?? hängt') && out.some(x=>x.st.ph==='end'), wo+': Tour bis zum Schatz durchgespielt ('+out.length+' Knopfdrücke)');
    ok(wechsel===7, wo+': Erzähler kommt 7-mal von selbst (vorher 13): '+E.map(x=>x.k.replace(/^[ek]\.(\w+\.)?/,'')).join(', '));
    ok(!E.some(x=>/\.s(2\.0|4\.0|4\.1|5\.1|6\.0|6\.2)\b/.test(x.k)), wo+': kein Erzähler, wo Funkels letzter Satz schon die Aufgabe ist');
    const start=out[0].l.reduce((s,x)=>s+x.t.length,0);
    ok(start<740, wo+': Start kürzer ('+start+' Zeichen, vorher 805)');
    ok(!E.some(x=>/Moment, das wiederhol/.test(x.t)), wo+': Dagobert ohne lange Überleitung');
    ok(out.every(x=>x.l.filter(y=>y.w==='Erzähler').length<=1), wo+': je Knopfdruck höchstens ein Erzähler-Satz');
  }
  await b.close(); console.log(fehler?fehler+' FEHLER':'ALLES OK'); process.exit(fehler?1:0); })();
