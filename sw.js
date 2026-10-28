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
  } else if(url.pathname.endsWith('funkel-stimme.json')){   // Stimmen: erst Netz (neue Stimmen), nach 5 s oder ohne Empfang Vorrat
    e.respondWith(caches.open(CACHE).then(function(c){
      var netz=fetch(e.request).then(function(r){ if(r.ok) c.put('./funkel-stimme.json', r.clone()); return r; });
      var vorrat=new Promise(function(ok){ setTimeout(ok, 5000); }).then(function(){ return c.match('./funkel-stimme.json'); });
      return Promise.race([netz['catch'](function(){ return c.match('./funkel-stimme.json'); }), vorrat.then(function(h){ return h || netz; })])
        .then(function(r){ return r || netz; });
    }));
  } else {                                     // Rest: erst Vorrat, im Hintergrund erneuern
    e.respondWith(caches.match(e.request).then(function(hit){
      var netz=fetch(e.request).then(function(r){ if(r.ok){ var k=r.clone(); caches.open(CACHE).then(function(c){ c.put(e.request, k); }); } return r; })['catch'](function(){ return hit; });
      return hit || netz;
    }));
  }
});
