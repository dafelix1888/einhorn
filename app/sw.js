// Schnitzeljagd: hält Spiel, Thema, Stimmen und Funkel in 3D für unterwegs ohne Empfang bereit.
var CACHE='schnitzeljagd-v41';
var DATEIEN=['./','./spiel.html','./tour-laden.js','./config.json','./themen/index.json','./themen/einhorn/tour.json','./themen/einhorn/cover.svg','./themen/einhorn/figuren/funkel.svg','./themen/einhorn/figuren/kakapups.svg','./stil.css','./planer.html','./planer.js','./planer-kern.js','../stimmen/pakete/einhorn-basis.json','../stimmen/pakete/einhorn-kakapups.json','./party.html','./party.js','./konto.js','./namen.js','./landing.html','./funkel-buehne.js','./danke.html','./recht.js','./weg.js','./fehler.js','./impressum.html','./datenschutz.html','./schrift/baloo2.woff','./schrift/atkinson-regular.woff','./schrift/atkinson-bold.woff','./bereit.html','./vorausgeher.html','./einladung.html','./druck.html','./dunkel.css','../funkel3d.js','../three.module.min.js'];
// Umgeleitete Antworten (z. B. /app/index.html → /app/) dürfen nicht an eine Seitennavigation gehen,
// sonst brechen Safari und Chrome mit ERR_FAILED ab (PBIM-19). Deshalb ohne Umleitungs-Kennung neu verpacken.
function sauber(r){
  if(!r || !r.redirected) return r;
  return r.blob().then(function(b){ return new Response(b, {status:r.status, statusText:r.statusText, headers:r.headers}); });
}
self.addEventListener('install', function(e){
  e.waitUntil(caches.open(CACHE).then(function(c){
    return Promise.all(DATEIEN.map(function(u){ return fetch(u, {cache:'no-cache'}).then(sauber).then(function(r){ if(r.ok) return c.put(u, r); })['catch'](function(){}); }));
  }).then(function(){ return self.skipWaiting(); }));
});
self.addEventListener('activate', function(e){
  e.waitUntil(caches.keys().then(function(ks){ return Promise.all(ks.filter(function(k){ return k.indexOf('schnitzeljagd-')===0 && k!==CACHE; }).map(function(k){ return caches['delete'](k); })); }).then(function(){ return self.clients.claim(); }));
});
self.addEventListener('fetch', function(e){
  var url=new URL(e.request.url);
  if(e.request.method!=='GET' || url.origin!==location.origin) return;     // Karten, OSM und Worker gehen immer direkt ins Netz
  var frisch = /\.(html|json|js|css)$/.test(url.pathname) || url.pathname.endsWith('/');   // Seiten, Daten, Skripte und Stile immer zusammen aktuell, sonst passt neues HTML nicht zum alten Stil
  if(frisch){                                  // erst Netz (neue Fassung), nach 4 s oder ohne Empfang Vorrat
    e.respondWith(caches.open(CACHE).then(function(c){
      // no-cache: beim Server nachfragen statt den Browser-Zwischenspeicher (bis 10 Min.) zu nehmen, sonst passt neues HTML nicht zum alten Skript
      var netz=fetch(url.href, {cache:'no-cache', credentials:'same-origin'}).then(sauber).then(function(r){ if(r.ok) c.put(e.request, r.clone()); return r; });
      var vorrat=new Promise(function(ok){ setTimeout(ok, 4000); }).then(function(){ return c.match(e.request, {ignoreSearch:true}); });
      return Promise.race([netz['catch'](function(){ return c.match(e.request, {ignoreSearch:true}); }), vorrat.then(function(h){ return h || netz; })])
        .then(function(r){ return r || netz; });
    }));
  } else {
    e.respondWith(caches.match(e.request).then(function(hit){
      var netz=fetch(e.request).then(sauber).then(function(r){ if(r.ok){ var k=r.clone(); caches.open(CACHE).then(function(c){ c.put(e.request, k); }); } return r; })['catch'](function(){ return hit; });
      return hit || netz;
    }));
  }
});
