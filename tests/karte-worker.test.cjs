// Karten-Worker ohne Netz: Herkunft, Prüfung der Abfragen, Ausweichserver, Cache und Rückfall auf ältere Antwort.
const path=require('path');
let fehler=0; const ok=(c,t)=>{ console.log((c?'ok   ':'FEHLER ')+t); if(!c) fehler++; };
(async()=>{
  const speicher=new Map();
  globalThis.caches={default:{
    match:async k=>{ const v=speicher.get(k.url); return v ? new Response(v.text, {headers:v.headers}) : undefined; },
    put:async (k,r)=>{ speicher.set(k.url, {text:await r.text(), headers:Object.fromEntries(r.headers)}); } }};
  let aufrufe=[], dienst='gut', abgebrochen=0, overpassZaehler=0;
  globalThis.fetch=async (url, init)=>{ aufrufe.push(String(url)+' '+((init&&init.headers&&init.headers['User-Agent'])||''));
    if(dienst==='aus') throw new Error('weg');
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
  console.log(fehler?fehler+' FEHLER':'ALLES OK'); process.exit(fehler?1:0);
})();
