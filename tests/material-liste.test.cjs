// Material besorgen (UNICORN-124): drei Wege klein über der Liste, Liste immer vollständig, nach Stationen sortiert, Nicht-Gewähltes grau.
const { chromium } = require('playwright');
const S='http://localhost:8765', B=S+'/app/';
let fehler=0; const ok=(b,t)=>{ console.log((b?'ok   ':'FEHL ')+t); if(!b) fehler++; };
(async()=>{
  const b=await chromium.launch(), c=await b.newContext({viewport:{width:393,height:852}, deviceScaleFactor:2});
  await c.addInitScript(()=>{ window.KONTO_TEST={url:'',key:''}; });
  await c.route(/^https?:\/\/(?!localhost)/, r=>r.abort());
  const p=await c.newPage(); const pf=[]; p.on('pageerror', e=>pf.push(e.message));
  const ST=[0,1,2,3,4,5,6].map(i=>({lat:53.55+i*0.001, lng:10.0+i*0.001, name:'Ort '+i}));
  const d=new Date(Date.now()+10*864e5).toISOString().slice(0,10);
  await p.goto(B+'impressum.html');
  await p.evaluate(([st,d])=>{ localStorage.clear();
    localStorage.setItem('sj.party.einhorn', JSON.stringify({format:1,thema:'einhorn',kind:{name:'Tilda',alter:6},datum:d,start:'14:00',kinder:10,helfer:2,vorausgeher:true,ort:'draussen',planB:true,ausdrucke:true,erledigt:{},einkauf:{}}));
    localStorage.setItem('sj.plan.einhorn', JSON.stringify({format:1,thema:'einhorn',variante:'a',kinder:10,strecke:1200,stationen:st})); }, [ST, d]);
  await p.goto(B+'party.html?thema=einhorn#einkauf'); await p.waitForSelector('.wege');
  const gruppen=async()=>(await p.locator('#einkauf .ek-gruppe').allInnerTexts());
  const g=await gruppen();
  ok(g.slice(0,8).join('|')==='Ganze Tour|Station 1|Weg zu Station 2|Station 3|Station 4|Station 5|Station 7|Schatz', 'Gruppen in Tour-Reihenfolge: '+g.join('|'));
  ok(/^Von zu Hause/.test(g[g.length-1]), 'Danach „Von zu Hause“');
  ok(await p.locator('[data-wege]').count()===3, 'Drei Wege: Alles, Nur Nötiges, Nichts kaufen');
  const wegeY=(await p.locator('.wege').boundingBox()).y, ersteY=(await p.locator('#einkauf .ek-gruppe').first().boundingBox()).y, summeY=(await p.locator('.summe-box').boundingBox()).y;
  ok(summeY<wegeY && ersteY>wegeY && ersteY-wegeY<200, 'Wege stehen klein direkt über der Liste, Summe darüber');
  ok((await p.locator('.weg-k').first().boundingBox()).height<70, 'Wege-Knöpfe sind klein');
  const n=await p.locator('#einkauf .ding').count();
  ok(await p.locator('.ding.aus').count()===0 && await p.getAttribute('[data-wege="alles"]','aria-pressed')==='true', 'Alles: nichts grau');
  ok(await p.locator('.ding:has-text("Kratzbilder") .tag-extra').count()===1 && await p.locator('.ding:has-text("Seil") .tag-extra').count()===0, 'Extras sind markiert');

  await p.click('[data-wege="noetig"]'); await p.waitForTimeout(200);
  ok(await p.locator('#einkauf .ding').count()===n, 'Nur Nötiges: weiter alle Teile sichtbar');
  ok(await p.locator('.ding.aus:has-text("Kratzbilder")').count()===1 && await p.locator('.ding.aus:has-text("Seil")').count()===0, 'Nur Nötiges: Extras grau, Nötiges normal');
  const op=await p.locator('.ding.aus .dh').first().evaluate(e=>+getComputedStyle(e).opacity);
  ok(op>0.3 && op<0.7, 'Grau heißt leicht ausgegraut (Deckkraft '+op+')');
  await p.screenshot({path:'/tmp/material-noetig.png', fullPage:false, clip:{x:0,y:Math.max(0,summeY-20),width:393,height:852}});

  await p.click('[data-wege="nichts"]'); await p.waitForTimeout(200);
  const pa=await p.evaluate(()=>JSON.parse(localStorage.getItem('sj.party.einhorn')));
  ok(Object.keys(pa.einkaufAus).length>=8, 'Nichts kaufen: alle lieferbaren abgewählt');
  ok(await p.locator('#einkauf .ding').count()===n && await p.locator('.ding.aus').count()>=8, 'Nichts kaufen: alles sichtbar, alles grau');
  ok(!(await p.locator('#in-korb').count()) && /Nichts zu bestellen/.test(await p.textContent('.summe-box')), 'Kein Warenkorb-Knopf, ein klarer Satz');
  ok(await p.locator('.ding.aus .sonst').first().evaluate(e=>+getComputedStyle(e).opacity)===1, 'Notlösung bleibt gut lesbar');

  await p.click('[data-wege="alles"]'); await p.waitForTimeout(200);
  ok(await p.locator('.ding.aus').count()===0, 'Zurück zu Alles: nichts mehr grau');
  ok(!pf.length, 'Keine Seitenfehler'+(pf.length?': '+pf.join(' | '):''));
  await b.close(); console.log(fehler?fehler+' FEHLER':'ALLES OK'); process.exit(fehler?1:0);
})();
