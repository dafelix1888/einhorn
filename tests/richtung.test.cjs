// UNICORN-37: Die gewählte Himmelsrichtung gilt immer. Geprüft wird der Planer-Kern (ohne Browser)
// und der Weg im Planer: Richtung ändern, neu planen, gespeicherte Route passt zur neuen Richtung.
// Alle Koordinaten sind erfunden.
const { chromium } = require('playwright');
const path=require('path');
const K=require(path.join(__dirname,'..','app','planer-kern.js'));
const TOUR=require(path.join(__dirname,'..','app','themen','einhorn','tour.json'));
const B=''+(process.env.BASIS||'http://localhost:8765')+'/app/';
const KARTE='https://schnitzeljagd-karte.schatzsuche-app.workers.dev';
let fehler=0; const ok=(c,t)=>{ console.log((c?'ok   ':'FEHLER ')+t); if(!c) fehler++; };

const L0=53.55, G0=9.95, dLat=0.00076, dLng=0.00128, START={lat:L0, lng:G0};
const diff=(a,b)=>{ const d=Math.abs(a-b)%360; return d>180?360-d:d; };
const peil=p=>K.peilung(START, p);

// Raster aus Straßen (~85 m Abstand). `erlaubt(i,j)` lässt Kreuzungen weg, `baenke` sind Rasterpunkte mit Bank.
function gegend(N, erlaubt, baenke){
  const M=(N-1)/2, el=[]; let id=1;
  const nid=(i,j)=>1000+i*N+j, lat=i=>L0+(i-M)*dLat, lng=j=>G0+(j-M)*dLng;
  const stueck=(a,b,name,art)=>el.push({type:'way', id:id++, nodes:[nid(a[0],a[1]), nid(b[0],b[1])], geometry:[{lat:lat(a[0]),lon:lng(a[1])},{lat:lat(b[0]),lon:lng(b[1])}], tags:{highway:art, name}});
  for(let i=0;i<N;i++) for(let j=0;j<N;j++){
    if(!erlaubt(i-M,j-M)) continue;
    if(j+1<N && erlaubt(i-M,j+1-M)) stueck([i,j],[i,j+1],'Weg '+String.fromCharCode(65+i),'residential');
    if(i+1<N && erlaubt(i+1-M,j-M)) stueck([i,j],[i+1,j],j%3===0?null:'Gasse '+(j+1), j%3===0?'footway':'residential');
  }
  baenke.forEach(([di,dj],k)=>el.push({type:'node', id:6000+k, lat:lat(di+M)+0.00004, lon:lng(dj+M)+0.00006, tags:{amenity:'bench'}}));
  return {version:0.6, elements:el};
}
const plane=(osm, opt)=>K.planen(osm, Object.assign({start:START, stationen:TOUR.stationen, hoehen:null}, opt));
const zielVon=r=>r.stationen[r.stationen.length-1];
// Schwerpunkt der ganzen Strecke (Hinweg, beim Rundkurs mit Rückweg), vom Start aus gesehen
function schwerpunkt(r){ const pk=r.route.concat(r.heimRoute||[]); let a=0,b=0; pk.forEach(p=>{ a+=p[0]; b+=p[1]; }); return {lat:a/pk.length, lng:b/pk.length}; }

(async()=>{
  // ---------- 1. Kern: rundum Wege und Bänke, jede Richtung, beide Formen, alle Varianten ----------
  const rundum=[]; for(let i=-6;i<=6;i+=2) for(let j=-6;j<=6;j+=2) if(i||j) rundum.push([i,j]);
  const offen=gegend(13, ()=>true, rundum);
  let schief=[], weitWeg=[], anzahl=0;
  for(const rundkurs of [false,true]) for(const r of Object.keys(K.RICHTUNG)){
    const erste=await plane(offen, {richtung:r, distanz:rundkurs?900:450, rundkurs, versuch:0});
    for(let v=0; v<erste.varianten; v++){
      const pl=v ? await plane(offen, {richtung:r, distanz:rundkurs?900:450, rundkurs, versuch:v}) : erste; anzahl++;
      const d=diff(peil(zielVon(pl)), K.RICHTUNG[r]);
      if(d>75) schief.push(r+(rundkurs?' Rundkurs':'')+' Variante '+(v+1)+': '+Math.round(d)+'°');
    }
    const d0=diff(peil(zielVon(erste)), K.RICHTUNG[r]), ds=diff(peil(schwerpunkt(erste)), K.RICHTUNG[r]);
    if(d0>40 || ds>60) weitWeg.push(r+(rundkurs?' Rundkurs':'')+': Ziel '+Math.round(d0)+'°, Strecke '+Math.round(ds)+'°');
  }
  ok(!schief.length, 'Ziel liegt nie außerhalb der gewählten Richtung ('+anzahl+' Routen geprüft)'+(schief.length?': '+schief.join('; '):''));
  ok(!weitWeg.length, 'Erster Vorschlag führt klar in die gewählte Richtung (Ziel höchstens 40° daneben)'+(weitWeg.length?': '+weitWeg.join('; '):''));

  // ---------- 2. Kern: nur im Süden gibt es Wege → Richtung Norden meldet das, statt nach Süden zu planen ----------
  const nurSued=gegend(13, (i)=>i<=0, [[-4,0],[-4,2],[-4,-2],[-6,0]]);
  let meldung='';
  for(const rundkurs of [false,true]){
    try{ const pl=await plane(nurSued, {richtung:'N', distanz:rundkurs?900:450, rundkurs}); meldung='Route mit Ziel '+Math.round(peil(zielVon(pl)))+'°'; }
    catch(e){ meldung=e.message; }
    ok(/In dieser Richtung/.test(meldung), 'Keine Wege im Norden'+(rundkurs?' (Rundkurs)':'')+': Hinweis statt Route in eine andere Richtung ('+meldung.slice(0,60)+')');
  }
  const sued=await plane(nurSued, {richtung:'S', distanz:450});
  ok(diff(peil(zielVon(sued)), 180)<=75, 'Gleiche Gegend, Richtung Süden: Route gefunden');

  // ---------- 3. Kern: Im Osten ein schlichter Wegpunkt, am Rand der Richtung (Südsüdost) eine Bank ----------
  // Früher gewann die Bank am Rand; die Route sah dann aus, als ginge sie nach Süden.
  const rand=gegend(13, (i,j)=>(i===0 && j>=0) || (j===0 && i<=0) || (i===-4 && j>=0 && j<=2) || (j===2 && i<=-2 && i>=-4), [[-4,2]]);
  {
    const pl=await plane(rand, {richtung:'O', distanz:430});
    const d=diff(peil(zielVon(pl)), 90);
    ok(d<=40, 'Osten gewählt, Wege nach Osten und Süden: erster Vorschlag endet im Osten (Ziel '+Math.round(peil(zielVon(pl)))+'°)');
    ok(pl.varianten>1, 'Die Route am Rand der Richtung bleibt über „Andere Route“ erreichbar ('+pl.varianten+' Varianten)');
  }

  // ---------- 4. Im Planer: Richtung ändern und neu planen ----------
  const b=await chromium.launch(), errs=[];
  const c=await b.newContext({viewport:{width:393,height:852}}); let abfragen=0;
  await c.route('https://efdjomgubucdnvgtuqmp.supabase.co/**', r=>r.abort());
  await c.addInitScript(()=>{ window.KONTO_TEST={url:'', key:''}; window.marketer={track:()=>{}}; });
  const json=(r,o)=>r.fulfill({status:200, contentType:'application/json', body:JSON.stringify(o), headers:{'Access-Control-Allow-Origin':'*'}});
  const ADRESSE=[{lat:String(L0), lon:String(G0), display_name:'Musterweg 1, Musterstadt'}];
  await c.route(KARTE+'/**', r=>{ const u=new URL(r.request().url());
    if(u.pathname==='/suche') return json(r,{features:[]}); if(u.pathname==='/adresse') return json(r,ADRESSE);
    if(u.pathname==='/overpass'){ abfragen++; return json(r,offen); }
    if(u.pathname==='/hoehe'){ const n=u.searchParams.get('latitude').split(',').length; return json(r,{elevation:Array.from({length:n},()=>10)}); }
    return r.fulfill({status:404}); });
  await c.route('https://tile.openstreetmap.org/**', r=>r.fulfill({status:200, contentType:'image/png', body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=','base64')}));
  const p=await c.newPage(); p.on('pageerror',e=>errs.push(e.message));
  await p.goto(B+'planer.html?thema=einhorn'); await p.evaluate(()=>localStorage.clear()); await p.reload(); await p.waitForTimeout(600);
  const planLesen=()=>p.evaluate(()=>JSON.parse(localStorage.getItem('sj.plan.einhorn')||'null'));
  const planeImBrowser=async()=>{ const vorher=((await planLesen())||{}).stand; await p.click('#planen');
    await p.waitForFunction(v=>{ const pl=JSON.parse(localStorage.getItem('sj.plan.einhorn')||'null'); const s=document.querySelector('#speichern'); return pl && pl.stand!==v && s && s.offsetParent; }, vorher, {timeout:30000}).catch(()=>{});
    return planLesen(); };
  const zielGrad=pl=>peil(pl.stationen[pl.stationen.length-1]);

  await p.fill('#adresse','Musterweg 1');
  await p.click('#form button[data-f="true"]');                       // Rundkurs
  await p.click('#richtung button[data-r="S"]');
  let pl=await planeImBrowser();
  ok(pl && pl.richtung==='S' && pl.rundkurs && diff(zielGrad(pl),180)<=75, 'Planer: Rundkurs Richtung Süden geplant (Ziel '+(pl?Math.round(zielGrad(pl)):'–')+'°)');
  ok((await p.locator('#start-text').innerText()).includes('Süden'), 'Planer: Die Karte nennt die Richtung der Route ('+(await p.locator('#start-text').innerText())+')');
  for(const r of ['O','N','W']){
    await p.click('#start-pille');                                        // Stift auf der Karte
    await p.click('#richtung button[data-r="'+r+'"]');
    pl=await planeImBrowser();
    ok(pl && pl.richtung===r && diff(zielGrad(pl), K.RICHTUNG[r])<=75, 'Planer: Richtung auf '+r+' geändert, neue Route geht dorthin (Ziel '+(pl?Math.round(zielGrad(pl)):'–')+'°)');
  }
  await p.click('#anders'); await p.waitForTimeout(1200); pl=await planLesen();
  ok(diff(zielGrad(pl), 270)<=75, '„Andere Route“ bleibt in der gewählten Richtung (Ziel '+Math.round(zielGrad(pl))+'°)');
  await p.reload(); await p.waitForTimeout(800);
  await p.click('#start-pille');
  ok(await p.locator('#richtung button[data-r="W"]').getAttribute('aria-pressed')==='true', 'Nach dem Neuladen ist die zuletzt geplante Richtung gewählt');
  // von Rundkurs auf „Hin und zurück“ mit gleicher Strecke: Der Umkreis wird größer, die Karte muss neu geholt werden
  const vorher=abfragen;
  await p.click('#form button[data-f="false"]');
  await p.evaluate(()=>{ const d=document.querySelector('#distanz'); d.value=d.max; d.dispatchEvent(new Event('input',{bubbles:true})); });
  await p.click('#form button[data-f="true"]'); await p.click('#form button[data-f="false"]');
  pl=await planeImBrowser();
  ok(abfragen>vorher, 'Größerer Umkreis: Wege werden neu geladen statt aus dem alten Ausschnitt geplant');
  ok(!errs.length, 'keine Seitenfehler '+errs.join(' | '));
  await b.close();
  console.log(fehler?('\n'+fehler+' FEHLER'):'\nALLES OK'); process.exit(fehler?1:0);
})();
