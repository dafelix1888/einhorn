// Funkels Zauberspiegel: hält Seite und Stimmen-Datei für unterwegs ohne Empfang bereit.
var CACHE='zauberspiegel-v1';
var DATEIEN=['./','./index.html','./funkel-stimme.json'];
self.addEventListener('install', function(e){
  e.waitUntil(caches.open(CACHE).then(function(c){
    return Promise.all(DATEIEN.map(function(u){ return c.add(u)['catch'](function(){}); }));
  }).then(function(){ return self.skipWaiting(); }));
});
self.addEventListener('activate', function(e){
  e.waitUntil(caches.keys().then(function(ks){ return Promise.all(ks.filter(function(k){ return k!==CACHE; }).map(function(k){ return caches['delete'](k); })); }).then(function(){ return self.clients.claim(); }));
});
self.addEventListener('fetch', function(e){
  var url=new URL(e.request.url);
  if(e.request.method!=='GET' || url.origin!==location.origin) return;
  var seite = url.pathname.endsWith('/') || url.pathname.endsWith('index.html');
  if(seite){                                   // Seite: erst Netz (neue Fassung), sonst Vorrat
    e.respondWith(fetch(e.request).then(function(r){ var k=r.clone(); caches.open(CACHE).then(function(c){ c.put('./index.html', k); }); return r; })['catch'](function(){ return caches.match('./index.html'); }));
  } else {                                     // Stimmen-Datei und Rest: erst Vorrat, im Hintergrund erneuern
    e.respondWith(caches.match(e.request).then(function(hit){
      var netz=fetch(e.request).then(function(r){ if(r.ok){ var k=r.clone(); caches.open(CACHE).then(function(c){ c.put(e.request, k); }); } return r; })['catch'](function(){ return hit; });
      return hit || netz;
    }));
  }
});
