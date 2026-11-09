// Planer mit nachgebauter Nachbarschaft: Adresse → Route mit 7 Stationen → „Route übernehmen“ → Party-Assistent.
// Kartendienste sind nachgebaut; geprüft wird auch, dass der Karten-Worker zuerst gefragt wird und der Planer
// bei dessen Ausfall direkt auf die Dienste ausweicht.
const { chromium } = require('playwright');
const B=''+(process.env.BASIS||'http://localhost:8765')+'/app/';
const KARTE='https://schnitzeljagd-karte.schatzsuche-app.workers.dev';
let fehler=0; const ok=(c,t)=>{ console.log((c?'ok   ':'FEHLER ')+t); if(!c) fehler++; };

// Raster 9×9 Straßen (~85 m Abstand), dazu Fußwege, Orte und Flächen
function nachbarschaft(){
  const L0=53.55, G0=9.95, dLat=0.00076, dLng=0.00128, N=9, el=[]; let id=1;
  const nid=(i,j)=>1000+i*N+j, lat=i=>L0+(i-4)*dLat, lng=j=>G0+(j-4)*dLng;
  for(let i=0;i<N;i++){                                   // Ost-West-Straßen
    const nodes=[], geometry=[]; for(let j=0;j<N;j++){ nodes.push(nid(i,j)); geometry.push({lat:lat(i), lon:lng(j)}); }
    el.push({type:'way', id:id++, nodes, geometry, tags:{highway:i===4?'tertiary':'residential', name:'Weg '+String.fromCharCode(65+i)}});
  }
  for(let j=0;j<N;j++){                                   // Nord-Süd-Straßen
    const nodes=[], geometry=[]; for(let i=0;i<N;i++){ nodes.push(nid(i,j)); geometry.push({lat:lat(i), lon:lng(j)}); }
    el.push({type:'way', id:id++, nodes, geometry, tags:{highway:j%3===0?'footway':'residential', name:j%3===0?null:'Gasse '+(j+1)}});
  }
  for(let i=0;i<N;i+=2) for(let j=0;j<N;j+=3) el.push({type:'node', id:5000+i*N+j, lat:lat(i), lon:lng(j), tags:{highway:'crossing', crossing:'zebra'}});
  [[1,1],[2,6],[5,2],[6,7],[7,4],[3,3]].forEach(([i,j],k)=>el.push({type:'node', id:6000+k, lat:lat(i)+0.00008, lon:lng(j)+0.0002, tags:{amenity:'bench'}}));
  el.push({type:'node', id:7001, lat:lat(5)+0.0002, lon:lng(5)+0.0004, tags:{leisure:'playground', name:'Spielplatz Mitte'}});
  el.push({type:'way', id:8001, center:{lat:lat(6), lon:lng(3)}, tags:{leisure:'park', name:'Stadtpark'}});
  el.push({type:'way', id:8002, center:{lat:lat(2), lon:lng(2)}, tags:{natural:'wood'}});
  el.push({type:'way', id:8100, geometry:[{lat:lat(3)+0.0001,lon:lng(1)},{lat:lat(3)+0.0001,lon:lng(3)}], tags:{barrier:'fence'}});
  el.push({type:'way', id:8101, geometry:[{lat:lat(7)+0.0001,lon:lng(5)},{lat:lat(7)+0.0001,lon:lng(7)}], tags:{barrier:'hedge'}});
  for(let k=0;k<60;k++) el.push({type:'node', id:9000+k, lat:L0+((k*37)%90-45)*0.00006, lon:G0+((k*53)%90-45)*0.0001});
  return {version:0.6, elements:el};
}
const OSM=JSON.stringify(nachbarschaft());
const ADRESSE=[{lat:'53.55', lon:'9.95', display_name:'Musterweg 1, Musterstadt'}];
const PHOTON={features:[{properties:{name:'Musterweg', housenumber:'1', postcode:'12345', city:'Musterstadt'}, geometry:{coordinates:[9.95,53.55]}}]};
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=','base64');

(async()=>{
  const b=await chromium.launch(), errs=[];
  async function lauf(workerGeht, vorschlagNehmen, workerHaengt, allesAus){
    const c=await b.newContext({viewport:{width:393,height:852}}), log=[];
    await c.route('https://efdjomgubucdnvgtuqmp.supabase.co/**', r=>r.abort());
    if(workerHaengt) await c.addInitScript(()=>{ window.KARTE_GEDULD=1500; });
    await c.addInitScript(()=>{ window.KONTO_TEST={url:'', key:''}; window.marketer={track:(n)=>{ const l=JSON.parse(sessionStorage.getItem('ev')||'[]'); l.push(n); sessionStorage.setItem('ev', JSON.stringify(l)); }}; });
    const json=(r,o)=>r.fulfill({status:200, contentType:'application/json', body:typeof o==='string'?o:JSON.stringify(o), headers:{'Access-Control-Allow-Origin':'*'}});
    const hoehe=r=>{ const n=new URL(r.request().url()).searchParams.get('latitude').split(',').length; return json(r,{elevation:Array.from({length:n},(_,i)=>10+(i%7))}); };
    await c.route(KARTE+'/**', r=>{ const u=new URL(r.request().url()); log.push('karte'+u.pathname);
      if(!workerGeht) return r.fulfill({status:502, body:'{}', headers:{'Access-Control-Allow-Origin':'*'}});
      if(workerHaengt && u.pathname==='/overpass') return;   // keine Antwort
      if(u.pathname==='/suche') return json(r,PHOTON); if(u.pathname==='/adresse') return json(r,ADRESSE);
      if(u.pathname==='/overpass') return json(r,OSM); if(u.pathname==='/hoehe') return hoehe(r); return r.fulfill({status:404}); });
    await c.route('https://photon.komoot.io/**', r=>{ log.push('photon'); json(r,PHOTON); });
    await c.route('https://nominatim.openstreetmap.org/**', r=>{ log.push('nominatim'); json(r,ADRESSE); });
    await c.route(/overpass-api\.de|kumi\.systems|mail\.ru/, r=>{ log.push('overpass'); if(allesAus) return r.fulfill({status:504, body:'busy', headers:{'Access-Control-Allow-Origin':'*'}}); json(r,OSM); });
    await c.route('https://api.open-meteo.com/**', r=>{ log.push('open-meteo'); hoehe(r); });
    await c.route('https://tile.openstreetmap.org/**', r=>r.fulfill({status:200, contentType:'image/png', body:PNG}));
    const p=await c.newPage(); p.on('pageerror',e=>errs.push(e.message));
    await p.goto(B+'planer.html?thema=einhorn'); await p.evaluate(()=>localStorage.clear()); await p.reload(); await p.waitForTimeout(600);
    await p.fill('#adresse','Musterweg 1'); await p.waitForTimeout(700);
    const vorschlag=await p.locator('#vorschlaege li[data-i]').count();
    if(vorschlagNehmen){ await p.click('#vorschlaege li[data-i="0"]'); await p.waitForTimeout(300); }
    log.push('klick');
    await p.click('#planen');
    await p.waitForFunction(()=>{ try{ const pl=JSON.parse(localStorage.getItem('sj.plan.einhorn')||'null'); return !!(document.querySelector('#speichern') && document.querySelector('#speichern').offsetParent); }catch(e){ return false; } }, null, {timeout:30000}).catch(()=>{});
    const status=await p.locator('#status').innerText().catch(()=>'');
    const sichtbar=await p.locator('#speichern').isVisible().catch(()=>false);
    let stationen=0;
    if(sichtbar){ await p.click('#speichern'); await p.waitForURL(/party\.html/, {timeout:5000}).catch(()=>{});
      stationen=await p.evaluate(()=>{ const pl=JSON.parse(localStorage.getItem('sj.plan.einhorn')||'null'); return pl&&pl.stationen?pl.stationen.length:0; }); }
    const ev=await p.evaluate(()=>JSON.parse(sessionStorage.getItem('ev')||'[]')).catch(()=>[]);
    await c.close();
    return {log, vorschlag, status, sichtbar, stationen, url:p.url(), ev};
  }

  const a=await lauf(true);
  ok(a.vorschlag>0, 'Vorschläge beim Tippen');
  ok(a.sichtbar, 'Route geplant'+(a.sichtbar?'':' (Status: '+a.status+')'));
  ok(a.stationen===7, 'Route hat 7 Stationen ('+a.stationen+')');
  ok(/party\.html/.test(a.url), '„Route übernehmen“ führt in den Party-Assistenten');
  ok(a.ev.includes('route_planned'), 'route_planned an Marketer');
  ok(a.log.includes('karte/overpass') && !a.log.includes('overpass') && !a.log.includes('nominatim'), 'Karten-Worker wird zuerst gefragt ('+[...new Set(a.log)].join(', ')+')');

  // Vorschlag gewählt: Kartendaten laden schon vor „Route planen“ und werden nur einmal geholt (UNICORN-7)
  const v=await lauf(true, true);
  ok(v.sichtbar && v.stationen===7, 'mit gewähltem Vorschlag: Route mit 7 Stationen');
  ok(v.log.indexOf('karte/overpass')>-1 && v.log.indexOf('karte/overpass')<v.log.indexOf('klick'), 'Kartendaten werden beim Wählen der Adresse vorgeladen');
  ok(v.log.filter(x=>x==='karte/overpass').length===1, 'Kartendaten nur einmal geholt ('+v.log.filter(x=>x==='karte/overpass').length+')');

  // Worker antwortet nicht: nach der Geduld fragt der Planer zusätzlich direkt, die erste Antwort gewinnt
  const h=await lauf(true, false, true);
  ok(h.sichtbar && h.stationen===7 && h.log.includes('overpass'), 'Worker hängt: Planer fragt nach kurzer Zeit direkt und plant trotzdem');

  // Alles überlastet: verständliche Meldung statt ewigem Warten
  const x=await lauf(false, false, false, true);
  ok(!x.sichtbar && /überlastet/.test(x.status), 'alle Kartendienste überlastet: klare Meldung ('+x.status.slice(0,60)+')');

  const f=await lauf(false);
  ok(f.sichtbar && f.stationen===7, 'Worker aus: Planer weicht auf die Dienste direkt aus');
  ok(f.log.includes('overpass') && f.log.includes('nominatim'), 'Worker aus: direkte Anfragen ('+[...new Set(f.log)].join(', ')+')');

  ok(errs.length===0, 'keine Seitenfehler '+errs.join(' | '));
  console.log(fehler?fehler+' FEHLER':'ALLES OK'); await b.close(); process.exit(fehler?1:0);
})();
