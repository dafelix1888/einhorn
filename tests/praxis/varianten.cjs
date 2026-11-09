// Diagnose (UNICORN-7): Welche Teile der Overpass-Abfrage kosten Zeit? Misst Varianten an drei Orten.
// Läuft nur in der Action „Praxistest“ mit Eingabe varianten=ja. Wenige Abfragen, mit Pausen (Overpass-Regeln).
const SERVER=process.env.SERVER||'https://maps.mail.ru/osm/tools/overpass/api/interpreter';
const ORTE=[['München Marienplatz',48.13743,11.57549],['Ahrenshoop',54.38353,12.42531],['Messestadt Riem',48.13226,11.69578]];
const HW_ALLE='footway|path|pedestrian|track|steps|bridleway|cycleway|living_street|residential|service|unclassified|tertiary|tertiary_link|secondary|secondary_link|primary|primary_link';
const HW_OHNE_SERVICE=HW_ALLE.replace('|service','');
function bbox(lat,lng,r){ const dLat=r/111320, dLng=r/(111320*Math.cos(lat*Math.PI/180)); return [(lat-dLat).toFixed(6),(lng-dLng).toFixed(6),(lat+dLat).toFixed(6),(lng+dLng).toFixed(6)].join(','); }
// Gleiche Inhalte wie der Planer, aber mit Rechteck statt Umkreis und kleinen Angaben zu Zeit/Speicher
function abfrageRechteck(lat,lng,r,o){
  const kopf='[out:json][timeout:'+(o.timeout||40)+']'+(o.maxsize?'[maxsize:'+o.maxsize+']':'')+'[bbox:'+bbox(lat,lng,r)+'];';
  return kopf+'('+
    'way[highway~"^('+HW_OHNE_SERVICE+'|service)$"]["access"!~"^(private|no)$"]["foot"!~"^(no|private)$"]["service"!~"^(parking_aisle|driveway|drive-through)$"];'+
    ')->.w;.w out body geom;'+
    '(node[highway~"^(crossing|traffic_signals)$"];node[amenity=bench];node[leisure=playground];node[natural=peak];node[tourism=viewpoint];)->.n;.n out body;'+
    '(way[barrier~"^(fence|hedge|wall)$"];)->.z;.z out body geom;'+
    '(way[leisure~"^(park|playground)$"];way[natural=wood];way[landuse~"^(forest|meadow|grass|recreation_ground)$"];)->.f;.f out tags center;'+
    'node[natural=tree];out skel qt 3000;';
}
function abfrage(lat,lng,r,o){
  const a='(around:'+r+','+lat.toFixed(6)+','+lng.toFixed(6)+')';
  return '[out:json][timeout:40];('+
    'way'+a+'[highway~"^('+(o.service?HW_ALLE:HW_OHNE_SERVICE)+')$"]["access"!~"^(private|no)$"]["foot"!~"^(no|private)$"];'+
    ')->.w;.w out body geom;'+
    '(node'+a+'[highway~"^(crossing|traffic_signals)$"];node'+a+'[amenity=bench];node'+a+'[leisure=playground];node'+a+'[natural=peak];node'+a+'[tourism=viewpoint];)->.n;.n out body;'+
    '(way'+a+'[barrier~"^('+(o.mauer?'fence|hedge|wall':'fence|hedge')+')$"];)->.z;.z out body geom;'+
    '(way'+a+'[leisure~"^(park|playground)$"];way'+a+'[natural=wood];way'+a+'[landuse~"^(forest|meadow|grass|recreation_ground)$"];)->.f;.f out tags center;'+
    (o.baeume?'node'+a+'[natural=tree];out skel qt 3000;':'');
}
const HEUTE=(lat,lng)=>abfrage(lat,lng,650,{service:true,mauer:true,baeume:true}).replace('["foot"!~"^(no|private)$"];','["foot"!~"^(no|private)$"]["service"!~"^(parking_aisle|driveway|drive-through)$"];');
const VARIANTEN2=[
  ['Umkreis 650 (live)',          HEUTE],
  ['Rechteck 650',                (la,ln)=>abfrageRechteck(la,ln,650,{})],
  ['Rechteck 650, klein angem.',  (la,ln)=>abfrageRechteck(la,ln,650,{timeout:20,maxsize:33554432})],
];
const VARIANTEN=[
  ['heute (r=775)',            775, {service:true,  mauer:true,  baeume:true}],
  ['r=600',                    600, {service:true,  mauer:true,  baeume:true}],
  ['r=600 ohne service',       600, {service:false, mauer:true,  baeume:true}],
  ['r=600 ohne Bäume',         600, {service:true,  mauer:true,  baeume:false}],
  ['r=600 schlank',            600, {service:false, mauer:false, baeume:false}],
];
(async()=>{
  if(process.env.RUNDE==='2'){
    for(const srv of ['https://overpass-api.de/api/interpreter','https://maps.mail.ru/osm/tools/overpass/api/interpreter']){
      for(const [ort,lat,lng] of ORTE) for(const [name,f] of VARIANTEN2){
        const t0=Date.now(); let erg='';
        try{ const ac=new AbortController(); const to=setTimeout(()=>ac.abort(),60000);
          const res=await fetch(srv,{method:'POST',body:'data='+encodeURIComponent(f(lat,lng)),headers:{'Content-Type':'application/x-www-form-urlencoded','User-Agent':'Schatzweg-Praxistest/1.0 (+https://schatzweg.de)'},signal:ac.signal});
          const text=await res.text(); clearTimeout(to); let n=0; try{ n=JSON.parse(text).elements.length; }catch(e){}
          erg=res.status+' · '+Math.round(text.length/1024)+' KB · '+n+' Elemente'; }catch(e){ erg='Fehler '+e.name; }
        console.log('VARIANTE | '+srv.split('/')[2]+' | '+ort+' | '+name+' | '+erg+' | '+(Date.now()-t0)+' ms');
        await new Promise(z=>setTimeout(z,2000));
      }
    }
    return;
  }
  console.log('Server:', SERVER);
  for(const [ort,lat,lng] of ORTE){
    for(const [name,r,o] of VARIANTEN){
      const t0=Date.now(); let erg='';
      try{
        const ac=new AbortController(); const to=setTimeout(()=>ac.abort(),55000);
        const res=await fetch(SERVER,{method:'POST',body:'data='+encodeURIComponent(abfrage(lat,lng,r,o)),headers:{'Content-Type':'application/x-www-form-urlencoded','User-Agent':'Schatzweg-Praxistest/1.0 (+https://schatzweg.de)'},signal:ac.signal});
        const text=await res.text(); clearTimeout(to);
        let n=0; try{ n=JSON.parse(text).elements.length; }catch(e){}
        erg=res.status+' · '+Math.round(text.length/1024)+' KB · '+n+' Elemente';
      }catch(e){ erg='Fehler '+e.name; }
      console.log('VARIANTE | '+ort+' | '+name+' | '+erg+' | '+(Date.now()-t0)+' ms');
      await new Promise(z=>setTimeout(z,3000));
    }
  }
})();
