// Praxistest (UNICORN-7, STRAT-16): Planer mit ECHTEN Kartendaten an öffentlichen Orten.
// Läuft nicht in tests/alle.cjs, sondern per GitHub Action „Praxistest“ (braucht Internet).
// Der Planer fragt wie bei Nutzern über den Karten-Worker (Herkunft localhost:8765 ist dort erlaubt).
// Keine Adressen aus Felix' Umfeld: nur öffentliche Plätze, Rathäuser, Parks.
const { chromium } = require('playwright');
const fs=require('fs'), path=require('path');
const B=(process.env.BASIS||'http://localhost:8765')+'/app/';
const AUS=process.env.AUSGABE||path.join(__dirname,'ergebnis');
fs.mkdirSync(AUS,{recursive:true});

const ORTE=[
  ['Großstadt, Zentrum',      'Marienplatz 8, München'],
  ['Großstadt, Wohnviertel',  'Venloer Straße 419, Köln'],
  ['Großstadt, am Park',      'Alaunplatz, Dresden'],
  ['Kleinstadt',              'Marktplatz, Weinheim'],
  ['Kleinstadt, Hanglage',    'Marktplatz, Tübingen'],
  ['Dorf, Küste',             'Ahrenshoop'],
  ['Dorf, Park',              'Wörlitz'],
  ['Neubaugebiet',            'Messestadt Riem, München'],
  ['Neubaugebiet',            'Vaubanallee, Freiburg im Breisgau'],
  ['Hanglage, Großstadt',     'Killesberg, Stuttgart'],
  ['Hanglage, steil',         'Ölberg, Wuppertal'],
  ['Alpendorf',               'Oberstdorf'],
];
let ersteAbfrage=null;
const nur=process.env.ORTE ? process.env.ORTE.split(',').map(Number) : null;

function hoehenmeter(p){ if(!p||p.length<2) return null; let auf=0; for(let i=1;i<p.length;i++){ const d=p[i].h-p[i-1].h; if(d>0) auf+=d; } return Math.round(auf); }

(async()=>{
  const b=await chromium.launch(), erg=[];
  for(let n=0;n<ORTE.length;n++){
    if(nur && !nur.includes(n+1)) continue;
    const [lage, adresse]=ORTE[n];
    const c=await b.newContext({viewport:{width:393,height:852}, deviceScaleFactor:1});
    await c.addInitScript(()=>{ window.KONTO_TEST={url:'', key:''}; });
    await c.route(/efdjomgubucdnvgtuqmp\.supabase\.co|fsqnzmwuojngopffcxso\.supabase\.co/, r=>r.abort());   // keine Messung, kein Konto
    const anfragen=[], fehler=[];
    c.on('request', r=>{ const u=r.url(); if(/workers\.dev|overpass|nominatim|photon|open-meteo/.test(u)) anfragen.push({u:u.replace(/\?.*/,''), t:Date.now()}); });
    const zeiten=[];
    c.on('requestfinished', async q=>{ const u=q.url(); if(!/workers\.dev|overpass|nominatim|photon|open-meteo/.test(u)) return;
      const t=q.timing(); const res=await q.response().catch(()=>null);
      zeiten.push({pfad:u.replace(/^https:\/\/([^/]+)\/?([^?]*).*$/,'$1/$2'), status:res?res.status():0, quelle:res?(res.headers()['x-karte']||''):'', ms:Math.round(t.responseEnd)});
      if(/overpass/.test(u) && q.postData()) ersteAbfrage=ersteAbfrage||q.postData(); });
    c.on('requestfailed', r=>{ if(!/tile\.openstreetmap/.test(r.url())) fehler.push('Anfrage fehlgeschlagen: '+r.url().replace(/\?.*/,'')+' '+(r.failure()||{}).errorText); });
    const p=await c.newPage(); p.on('pageerror',e=>fehler.push('Seitenfehler: '+e.message));
    const r={nr:n+1, lage, adresse};
    try{
      await p.goto(B+'planer.html?thema=einhorn'); await p.evaluate(()=>localStorage.clear()); await p.reload(); await p.waitForSelector('#adresse');
      await p.fill('#adresse', adresse); await p.waitForTimeout(1200);
      const t0=Date.now();
      await p.click('#planen');
      await p.waitForFunction(()=>{ const s=document.querySelector('#speichern'); const st=(document.querySelector('#status')||{}).className||''; return (s && s.offsetParent) || /fehler/.test(st); }, null, {timeout:150000});
      r.sekunden=Math.round((Date.now()-t0)/100)/10;
      r.status=(await p.locator('#status').innerText().catch(()=>'')).trim();
      r.gefunden=await p.locator('#speichern').isVisible().catch(()=>false);
      if(r.gefunden){
        await p.waitForTimeout(4000);   // Höhenprofil lädt nach
        r.zusammenfassung=(await p.locator('#zusammenfassung').innerText().catch(()=>'')).trim();
        await p.screenshot({path:path.join(AUS, String(n+1).padStart(2,'0')+'.png')});
        await p.click('#speichern'); await p.waitForURL(/party\.html/, {timeout:15000}).catch(()=>{});
        const pl=await p.evaluate(()=>JSON.parse(localStorage.getItem('sj.plan.einhorn')||'null'));
        if(pl){
          r.stationen=(pl.stationen||[]).length;
          r.passend=(pl.stationen||[]).filter((s,i)=>i===0 || s.gefunden).length;
          r.ersatz=r.stationen-r.passend;
          r.strecke=pl.strecke; r.heimweg=pl.heimweg;
          r.hoehenmeter=hoehenmeter(pl.hoehenProfil);
          r.route=!!(pl.route && pl.route.length);
          r.abstaende=(pl.stationen||[]).slice(1).map((s,i)=>{ const a=pl.stationen[i]; const R=6371000, toR=x=>x*Math.PI/180;
            const dLat=toR(s.lat-a.lat), dLng=toR(s.lng-a.lng); const h=Math.sin(dLat/2)**2+Math.cos(toR(a.lat))*Math.cos(toR(s.lat))*Math.sin(dLng/2)**2; return Math.round(2*R*Math.asin(Math.sqrt(h))); });
          r.namen=(pl.stationen||[]).map(s=>s.name||'').slice(1);
        }
      } else {
        await p.screenshot({path:path.join(AUS, String(n+1).padStart(2,'0')+'-fehler.png')});
      }
    }catch(e){ r.fehler=(r.fehler||'')+e.message.split('\n')[0]; await p.screenshot({path:path.join(AUS, String(n+1).padStart(2,'0')+'-fehler.png')}).catch(()=>{}); }
    r.anfragen=anfragen.length; r.ueberWorker=anfragen.filter(a=>/workers\.dev/.test(a.u)).length; r.direkt=anfragen.filter(a=>!/workers\.dev/.test(a.u)).length;
    r.meldungen=fehler.filter(m=>!/m\.js/.test(m)).slice(0,5); r.zeiten=zeiten;
    erg.push(r); console.log(JSON.stringify(r));
    await c.close();
    await new Promise(z=>setTimeout(z, 2000));   // freundlich zu Nominatim und Overpass
  }
  // Overpass-Server direkt messen (gleiche Abfrage wie der Planer), um langsame Server zu erkennen
  if(ersteAbfrage){
    for(const srv of ['https://overpass-api.de/api/interpreter','https://overpass.kumi.systems/api/interpreter','https://maps.mail.ru/osm/tools/overpass/api/interpreter','https://overpass.private.coffee/api/interpreter']){
      const t0=Date.now(); let st='';
      try{ const ac=new AbortController(); const to=setTimeout(()=>ac.abort(),60000);
        const rr=await fetch(srv,{method:'POST',body:ersteAbfrage,headers:{'Content-Type':'application/x-www-form-urlencoded','User-Agent':'Schatzweg-Praxistest/1.0 (+https://schatzweg.de)'},signal:ac.signal});
        clearTimeout(to); st=rr.status+' '+((await rr.text()).length)+' Bytes'; }catch(e){ st='Fehler '+e.name; }
      console.log('OVERPASS-DIREKT', srv, st, (Date.now()-t0)+' ms');
    }
    for(let k=0;k<2;k++){ const t0=Date.now(); let st='';
      try{ const rr=await fetch('https://schnitzeljagd-karte.schatzsuche-app.workers.dev/overpass',{method:'POST',body:ersteAbfrage,headers:{'Content-Type':'application/x-www-form-urlencoded','Origin':'http://localhost:8765'}});
        st=rr.status+' '+(rr.headers.get('x-karte')||'')+' '+((await rr.text()).length)+' Bytes'; }catch(e){ st='Fehler '+e.message; }
      console.log('OVERPASS-WORKER', k+1, st, (Date.now()-t0)+' ms'); }
  }
  await b.close();
  fs.writeFileSync(path.join(AUS,'ergebnis.json'), JSON.stringify(erg,null,1));
  const km=m=>m==null?'–':(m/1000).toFixed(2).replace('.',',')+' km';
  let md='| # | Lage | Ort | Route | Stationen (passend/Ersatz) | Strecke | Heimweg | Höhenmeter | Dauer | Auffällig |\n|---|---|---|---|---|---|---|---|---|---|\n';
  for(const r of erg){
    const auff=[]; if(r.fehler) auff.push(r.fehler); if(!r.gefunden && r.status) auff.push(r.status);
    if(r.ersatz) auff.push(r.ersatz+' Ersatzort(e)'); if(r.direkt) auff.push(r.direkt+' direkte Anfragen (Worker-Ausfall?)');
    if(r.abstaende && r.abstaende.some(a=>a<25)) auff.push('Stationen < 25 m auseinander');
    if(r.abstaende && r.abstaende.some(a=>a>400)) auff.push('Abstand > 400 m');
    if(r.meldungen && r.meldungen.length) auff.push(r.meldungen.join('; ').slice(0,160));
    md+=`| ${r.nr} | ${r.lage} | ${r.adresse} | ${r.gefunden?'ja':'**nein**'} | ${r.stationen!=null?r.stationen+' ('+r.passend+'/'+r.ersatz+')':'–'} | ${km(r.strecke)} | ${km(r.heimweg)} | ${r.hoehenmeter!=null?r.hoehenmeter+' m':'–'} | ${r.sekunden!=null?r.sekunden+' s':'–'} | ${auff.join(' · ')||'–'} |\n`;
  }
  fs.writeFileSync(path.join(AUS,'ergebnis.md'), md);
  if(process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, '## Praxistest Planer\n\n'+md);
  console.log('\n'+md);
})();
