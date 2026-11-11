// Karten-Worker ohne Netz: Herkunft, Prüfung der Abfragen, Ausweichserver, Cache und Rückfall auf ältere Antwort.
const path=require('path');
let fehler=0; const ok=(c,t)=>{ console.log((c?'ok   ':'FEHLER ')+t); if(!c) fehler++; };
(async()=>{
  const speicher=new Map();
  globalThis.caches={default:{
    match:async k=>{ const v=speicher.get(k.url); return v ? new Response(v.text, {headers:v.headers}) : undefined; },
    put:async (k,r)=>{ speicher.set(k.url, {text:await r.text(), headers:Object.fromEntries(r.headers)}); } }};
  let aufrufe=[], dienst='gut', abgebrochen=0, overpassZaehler=0, pp='aus', ofm='aus';
  // Postpass-Antwort: zwei Wege mit gemeinsamem Punkt, eine Bank, ein Zebrastreifen, ein Park
  const PP={type:'FeatureCollection', features:[
    {type:'Feature', properties:{k:'w', osm_id:11, tags:{highway:'footway', name:'Weg A'}}, geometry:{type:'LineString', coordinates:[[9.9000,53.5000],[9.9010,53.5000],[9.9020,53.5000]]}},
    {type:'Feature', properties:{k:'w', osm_id:12, tags:{highway:'residential', name:'Weg B'}}, geometry:{type:'LineString', coordinates:[[9.9010,53.5000],[9.9010,53.5010]]}},
    {type:'Feature', properties:{k:'n', osm_id:21, tags:{amenity:'bench'}}, geometry:{type:'Point', coordinates:[9.9015,53.5001]}},
    {type:'Feature', properties:{k:'n', osm_id:22, tags:{highway:'crossing', crossing:'zebra'}}, geometry:{type:'Point', coordinates:[9.9010,53.5000]}},
    {type:'Feature', properties:{k:'f', osm_id:31, tags:{leisure:'park', name:'Park'}}, geometry:{type:'Point', coordinates:[9.9030,53.5005]}}]};
  // kleine Vektorkachel (MVT) bauen: Ebene transportation mit zwei Wegen, poi mit Spielplatz
  const vi=(n)=>{ const b=[]; do{ let x=n&0x7f; n=Math.floor(n/128); if(n) x|=0x80; b.push(x); }while(n); return b; };
  const fld=(nr,typ,b)=>[...vi(nr*8+typ), ...(typ===2?vi(b.length):[]), ...b];
  const str=(nr,s)=>fld(nr,2,[...Buffer.from(s)]);
  const zz=(n)=>n<0?-2*n-1:2*n;
  const geom=(pts)=>{ const g=[1|(1<<3), zz(pts[0][0]), zz(pts[0][1]), 2|((pts.length-1)<<3)]; for(let i=1;i<pts.length;i++) g.push(zz(pts[i][0]-pts[i-1][0]), zz(pts[i][1]-pts[i-1][1])); return g; };
  const merkmal=(tags,typ,pts)=>fld(2,2,[...fld(2,2,tags.flatMap(vi)), ...fld(3,0,vi(typ)), ...fld(4,2,(typ===1?[9, zz(pts[0][0]), zz(pts[0][1])]:geom(pts)).flatMap(vi))]);
  const wert=(s)=>fld(4,2,str(1,s));
  const ebene=(name,keys,werte,feats)=>fld(3,2,[...fld(15,0,vi(2)), ...str(1,name), ...feats.flat(), ...keys.flatMap(k=>str(3,k)), ...werte.flatMap(wert), ...fld(5,0,vi(4096))]);
  const MVT=Buffer.from([
    ...ebene('transportation',['class','subclass'],['path','footway','minor'],[ merkmal([0,0,1,1],2,[[100,2000],[2048,2048],[3000,2048]]), merkmal([0,2],2,[[2048,2048],[2048,1000]]) ]),
    ...ebene('poi',['class','subclass','name'],['playground','playground','Spielplatz Mitte'],[ merkmal([0,0,1,1,2,2],1,[[2100,2100]]) ])]);
  const ARGS={};
  globalThis.fetch=async (url, init)=>{ aufrufe.push(String(url)+' '+((init&&init.headers&&init.headers['User-Agent'])||''));
    if(dienst==='aus') throw new Error('weg');
    if(String(url).includes('postpass')){ ARGS.pp=String(init&&init.body||''); if(pp==='aus') return new Response('busy',{status:503}); return new Response(JSON.stringify(PP),{status:200}); }
    if(String(url)==='https://tiles.openfreemap.org/planet'){ if(ofm==='aus') return new Response('weg',{status:503}); return new Response(JSON.stringify({tiles:['https://tiles.openfreemap.org/planet/x/{z}/{x}/{y}.pbf']}),{status:200}); }
    if(String(url).includes('tiles.openfreemap.org/planet/x/')){ ARGS.ofm=(ARGS.ofm||0)+1; return new Response(MVT,{status:200}); }
    if(/interpreter/.test(String(url)) && dienst==='overpass-haengt') await new Promise((ja,nein)=>{ const t=setTimeout(ja, 20000); init.signal && init.signal.addEventListener('abort', ()=>{ clearTimeout(t); abgebrochen++; nein(new Error('abgebrochen')); }); });
    if(/interpreter/.test(String(url)) && dienst==='overpass-aus') return new Response('busy', {status:504});
    if(/interpreter/.test(String(url))) overpassZaehler++;
    if(/interpreter/.test(String(url)) && dienst==='zweimal-504' && overpassZaehler<=2) return new Response('busy', {status:504});
    if(String(url).includes('overpass-api.de') && dienst==='erster-aus') return new Response('busy', {status:429});
    if(String(url).includes('overpass-api.de') && dienst==='erster-langsam') await new Promise((ja,nein)=>{ const t=setTimeout(ja, 15000); init.signal && init.signal.addEventListener('abort', ()=>{ clearTimeout(t); abgebrochen++; nein(new Error('abgebrochen')); }); });
    return new Response(JSON.stringify({elements:[{type:'node',id:1}], quelle:String(url)}), {status:200}); };
  const w=(await import(path.join(__dirname,'..','worker','karte.js'))).default;
  const env={ERLAUBTE_URSPRUENGE:'https://dafelix1888.github.io'}, warten=[], ctx={waitUntil:p=>warten.push(p)};
  const anfrage=(pfad, init={}, herkunft='https://dafelix1888.github.io')=>w.fetch(new Request('https://karte.test'+pfad, {...init, headers:{Origin:herkunft, ...(init.headers||{})}}), env, ctx);
  const Q='data='+encodeURIComponent('[out:json][timeout:40];(way(around:900,53.5,9.9)[highway];)->.w;.w out body geom;');
  const post={method:'POST', body:Q, headers:{'Content-Type':'application/x-www-form-urlencoded'}};

  ok((await anfrage('/overpass', post, 'https://fremd.example')).status===403, 'fremde Herkunft: 403');
  ok((await anfrage('/overpass', {...post, body:'data='+encodeURIComponent('[out:xml];node(around:99999,1,1);out;')})).status===400, 'fremde Overpass-Abfrage: 400');
  ok((await anfrage('/hoehe?latitude=1,2&longitude=3')).status===400, 'Höhen mit ungleichen Listen: 400');

  dienst='erster-aus'; aufrufe=[];
  let r=await anfrage('/overpass', post); await Promise.all(warten);
  const j=await r.json();
  ok(r.status===200 && /mail\.ru/.test(j.quelle) && r.headers.get('X-Karte')==='dienst', 'Overpass: bei Fehler sofort der zweite Server');
  ok(aufrufe.every(a=>/Schatzweg\/1.0/.test(a)), 'meldet sich mit eigenem Namen an');
  r=await anfrage('/overpass', post); ok(r.headers.get('X-Karte')==='cache', 'gleiche Abfrage kommt aus dem Cache');

  // erster Server hängt: nach 6 s fragt der Worker den zweiten dazu, der erste wird abgebrochen
  dienst='erster-langsam'; aufrufe=[]; speicher.clear();
  const t0=Date.now(); r=await anfrage('/overpass', {...post, body:Q.replace('900','901')}); const dauer=Date.now()-t0;
  ok(r.status===200 && /mail\.ru/.test((await r.json()).quelle) && dauer>7500 && dauer<11000, 'Overpass: hängt der erste, gewinnt nach ~8 s der zweite ('+dauer+' ms)');
  ok(abgebrochen===1, 'der hängende Server wird abgebrochen');
  dienst='gut'; r=await anfrage('/overpass', post); await Promise.all(warten);

  // alle Server lehnen zweimal sofort ab (504): der Worker versucht es nach kurzer Pause weiter
  dienst='zweimal-504'; overpassZaehler=0; speicher.clear();
  r=await anfrage('/overpass', {...post, body:Q.replace('900','902')}); await Promise.all(warten);
  ok(r.status===200 && overpassZaehler===3, 'Overpass: nach zwei Ablehnungen klappt der dritte Versuch ('+overpassZaehler+' Versuche)');
  dienst='gut'; r=await anfrage('/overpass', post); await Promise.all(warten);

  // veraltete Antwort, Dienst aus: ältere Antwort springt ein
  for(const [k,v] of speicher) v.headers['x-gemerkt']=String(Date.now()-60*86400e3);
  dienst='aus'; r=await anfrage('/overpass', post);
  ok(r.status===200 && r.headers.get('X-Karte')==='cache-alt', 'Dienst aus: ältere Antwort springt ein');
  r=await anfrage('/adresse?q=Musterweg%201'); ok(r.status===502, 'Dienst aus und nichts gemerkt: 502, der Planer fragt dann direkt');
  dienst='gut'; r=await anfrage('/adresse?q=Musterweg%201'); ok(r.status===200 && (r.headers.get('Access-Control-Allow-Origin')==='https://dafelix1888.github.io'), 'Adresse mit CORS für die App');

  // ---------- Ausweichquellen (UNICORN-34) ----------
  const PK=require(path.join(__dirname,'..','app','planer-kern.js'));
  // Overpass lehnt sofort ab: Postpass gleich dazu, nicht erst nach 5 s
  dienst='overpass-aus'; pp='gut'; speicher.clear();
  let t0b=Date.now(); r=await anfrage('/overpass', {...post, body:Q.replace('900','904')}); await Promise.all(warten);
  ok(r.headers.get('X-Quelle')==='postpass' && Date.now()-t0b<2000, 'Overpass lehnt ab: Postpass sofort ('+(Date.now()-t0b)+' ms)');
  // Overpass hängt: nach 5 s fragt der Worker Postpass, Postpass gewinnt, Overpass wird abgebrochen
  dienst='overpass-haengt'; pp='gut'; speicher.clear(); abgebrochen=0;
  let t1=Date.now(); r=await anfrage('/overpass', {...post, body:Q.replace('900','903')}); let d1=Date.now()-t1; await Promise.all(warten);
  let o=await r.json();
  ok(r.status===200 && r.headers.get('X-Quelle')==='postpass' && d1>4500 && d1<7500, 'Overpass hängt: nach ~5 s gewinnt Postpass ('+d1+' ms)');
  ok(abgebrochen>=1, 'Overpass wird nach dem Treffer abgebrochen');
  ok(/postpass_line/.test(decodeURIComponent(ARGS.pp)) && /ST_DWithin/.test(decodeURIComponent(ARGS.pp)) && /'footway'/.test(decodeURIComponent(ARGS.pp)) && /9\.900000,53\.500000/.test(decodeURIComponent(ARGS.pp)), 'Postpass bekommt SQL mit Mitte, Umkreis und Wegearten');
  const wa=o.elements.find(e=>e.id===11), wb=o.elements.find(e=>e.id===12), zeb=o.elements.find(e=>e.tags&&e.tags.crossing==='zebra');
  ok(wa && wb && wa.nodes[1]===wb.nodes[0] && wa.geometry.length===3, 'Postpass → Overpass-Format: gemeinsamer Punkt hat dieselbe Knoten-ID');
  ok(zeb && zeb.id===wa.nodes[1] && o.elements.some(e=>e.center && e.tags.leisure==='park') && o.elements.some(e=>e.type==='node'&&e.tags.amenity==='bench'), 'Zebrastreifen auf dem Wegknoten, Park als Fläche, Bank als Punkt');
  let netz=PK.netzBauen(o);
  ok(netz.baenke.length===1 && (netz.nachbarn[wa.nodes[1]]||[]).length===3 && netz.querungen[wa.nodes[1]]==='Zebrastreifen', 'Planer baut daraus ein verbundenes Wegenetz (Kreuzung mit 3 Kanten, Zebrastreifen)');
  r=await anfrage('/overpass', {...post, body:Q.replace('900','903')}); ok(r.headers.get('X-Karte')==='cache' && r.headers.get('X-Quelle')==='postpass', 'Postpass-Antwort kommt beim zweiten Mal aus dem Cache');

  // Overpass und Postpass scheitern: OpenFreeMap springt ein (Vektorkacheln)
  dienst='overpass-aus'; pp='aus'; ofm='gut'; speicher.clear(); ARGS.ofm=0;
  const Q2='data='+encodeURIComponent('[out:json][timeout:25];(way(around:600,53.5503,9.9930)[highway];)->.w;.w out body geom;');
  t1=Date.now(); r=await anfrage('/overpass', {...post, body:Q2}); d1=Date.now()-t1; await Promise.all(warten);
  o=await r.json();
  const wege=o.elements.filter(e=>e.type==='way'&&e.nodes);
  ok(r.status===200 && r.headers.get('X-Quelle')==='openfreemap' && d1<2000, 'Overpass lehnt ab, Postpass scheitert: sofort OpenFreeMap ('+d1+' ms, '+ARGS.ofm+' Kacheln)');
  ok(wege.some(w=>w.tags.highway==='footway') && wege.some(w=>w.tags.highway==='residential') && o.elements.some(e=>e.type==='node'&&e.tags.leisure==='playground'&&e.tags.name==='Spielplatz Mitte'), 'Vektorkachel → Fußweg, Wohnstraße, Spielplatz mit Namen');
  netz=PK.netzBauen(o);
  ok(Object.keys(netz.nachbarn).some(k=>netz.nachbarn[k].length>=3), 'Wege aus der Kachel treffen sich an einem gemeinsamen Knoten');
  const g=wege[0].geometry[0]; ok(Math.abs(g.lat-53.55)<0.05 && Math.abs(g.lon-9.99)<0.05, 'Kachel-Koordinaten landen am richtigen Ort ('+g.lat.toFixed(4)+', '+g.lon.toFixed(4)+')');
  let alt=[...speicher.values()].find(v=>v.headers['x-quelle']==='openfreemap');
  ok(alt && alt.headers['x-frisch']==='86400', 'OpenFreeMap-Antwort gilt nur 1 Tag');

  // alles aus: Fehler, der Planer fragt dann selbst
  ofm='aus'; speicher.clear();
  r=await anfrage('/overpass', {...post, body:Q2}); ok(r.status===502, 'Alle Quellen aus: 502');
  // Quelle erzwingen zum Prüfen
  dienst='gut'; pp='gut'; speicher.clear();
  r=await anfrage('/overpass?nur=postpass', {...post, body:Q2}); ok(r.headers.get('X-Quelle')==='postpass', '?nur=postpass fragt nur Postpass');
  r=await anfrage('/overpass', {...post, body:Q2}); ok(r.headers.get('X-Quelle')==='overpass', 'normal gewinnt Overpass, wenn er antwortet');
  console.log(fehler?fehler+' FEHLER':'ALLES OK'); process.exit(fehler?1:0);
})();
