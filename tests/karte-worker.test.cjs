// Karten-Worker ohne Netz: Herkunft, Prüfung der Abfragen, Ausweichserver, Cache und Rückfall auf ältere Antwort.
const path=require('path');
let fehler=0; const ok=(c,t)=>{ console.log((c?'ok   ':'FEHLER ')+t); if(!c) fehler++; };
(async()=>{
  const speicher=new Map();
  globalThis.caches={default:{
    match:async k=>{ const v=speicher.get(k.url); return v ? new Response(v.text, {headers:v.headers}) : undefined; },
    put:async (k,r)=>{ speicher.set(k.url, {text:await r.text(), headers:Object.fromEntries(r.headers)}); } }};
  let aufrufe=[], dienst='gut';
  globalThis.fetch=async (url, init)=>{ aufrufe.push(String(url)+' '+((init&&init.headers&&init.headers['User-Agent'])||''));
    if(dienst==='aus') throw new Error('weg');
    if(String(url).includes('overpass-api.de') && dienst==='erster-aus') return new Response('busy', {status:429});
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
  ok(r.status===200 && /kumi/.test(j.quelle) && r.headers.get('X-Karte')==='dienst', 'Overpass: weicht auf den zweiten Server aus');
  ok(aufrufe.every(a=>/Schatzweg\/1.0/.test(a)), 'meldet sich mit eigenem Namen an');
  r=await anfrage('/overpass', post); ok(r.headers.get('X-Karte')==='cache', 'gleiche Abfrage kommt aus dem Cache');

  // veraltete Antwort, Dienst aus: ältere Antwort springt ein
  for(const [k,v] of speicher) v.headers['x-gemerkt']=String(Date.now()-60*86400e3);
  dienst='aus'; r=await anfrage('/overpass', post);
  ok(r.status===200 && r.headers.get('X-Karte')==='cache-alt', 'Dienst aus: ältere Antwort springt ein');
  r=await anfrage('/adresse?q=Musterweg%201'); ok(r.status===502, 'Dienst aus und nichts gemerkt: 502, der Planer fragt dann direkt');
  dienst='gut'; r=await anfrage('/adresse?q=Musterweg%201'); ok(r.status===200 && (r.headers.get('Access-Control-Allow-Origin')==='https://dafelix1888.github.io'), 'Adresse mit CORS für die App');
  console.log(fehler?fehler+' FEHLER':'ALLES OK'); process.exit(fehler?1:0);
})();
