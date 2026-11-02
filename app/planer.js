// Tourplaner: Adresse, Richtung und Strecke rein, fertige Stationen raus.
// Daten: Nominatim (Adresse), Overpass (Wege und Orte), Open-Meteo (Höhen) – alle frei und ohne Schlüssel.
(function(){
  'use strict';
  var NOMINATIM='https://nominatim.openstreetmap.org/search';
  var OVERPASS=['https://overpass-api.de/api/interpreter','https://overpass.kumi.systems/api/interpreter'];
  var ELEVATION='https://api.open-meteo.com/v1/elevation';
  var RICHTUNGEN=['NW','N','NO','W','egal','O','SW','S','SO'];
  var PFEIL={N:'↑',NO:'↗',O:'→',SO:'↘',S:'↓',SW:'↙',W:'←',NW:'↖',egal:'egal'};

  var q=new URLSearchParams(location.search), thema=(q.get('thema')||'einhorn').replace(/[^a-z0-9-]/gi,'');
  var PLAN_KEY='sj.plan.'+thema;
  var tour=null, plan=null, osmCache=null, versuch=0, karte=null, ebenen=null;
  var wahl={variante:'a', richtung:'egal', distanz:500, kinder:10, start:null, adresse:''};

  function $(id){ return document.getElementById(id); }
  function esc(t){ return String(t==null?'':t).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function toast(t){ var e=$('toast'); e.textContent=t; e.hidden=false; clearTimeout(toast.t); toast.t=setTimeout(function(){ e.hidden=true; }, 3500); }
  function status(t, fehler){ var s=$('status'); s.textContent=t||''; s.className='status'+(fehler?' fehler':''); }
  function draussen(){ return !!(tour.varianten[wahl.variante]||{}).draussen; }
  function km(m){ return m>=1000 ? (m/1000).toFixed(1).replace('.',',')+' km' : m+' m'; }

  // ---------- Netz ----------
  function mitZeitlimit(p, ms, text){ return Promise.race([p, new Promise(function(_,nein){ setTimeout(function(){ nein(new Error(text)); }, ms); })]); }
  function adresseSuchen(text){
    return fetch(NOMINATIM+'?format=jsonv2&limit=1&accept-language=de&q='+encodeURIComponent(text)).then(function(r){ if(!r.ok) throw new Error('Adresssuche: HTTP '+r.status); return r.json(); })
      .then(function(l){ if(!l.length) throw new Error('Diese Adresse kenne ich nicht. Mit Ort versuchen, z. B. „Musterweg 3, Hamburg“.'); return {lat:+l[0].lat, lng:+l[0].lon, name:l[0].display_name}; });
  }
  function overpass(abfrage){
    var i=0;
    function versuchen(){
      return mitZeitlimit(fetch(OVERPASS[i], {method:'POST', body:'data='+encodeURIComponent(abfrage), headers:{'Content-Type':'application/x-www-form-urlencoded'}}), 45000, 'Kartendienst antwortet nicht')
        .then(function(r){ if(!r.ok) throw new Error('Kartendienst: HTTP '+r.status); return r.json(); })
        ['catch'](function(e){ if(++i<OVERPASS.length) return versuchen(); throw e; });
    }
    return versuchen();
  }
  function hoehen(punkte){                       // Open-Meteo: bis zu 100 Punkte je Anfrage
    var teile=[]; for(var i=0;i<punkte.length;i+=100) teile.push(punkte.slice(i,i+100));
    return Promise.all(teile.map(function(t){
      return fetch(ELEVATION+'?latitude='+t.map(function(p){ return p.lat.toFixed(5); }).join(',')+'&longitude='+t.map(function(p){ return p.lng.toFixed(5); }).join(','))
        .then(function(r){ if(!r.ok) throw new Error('Höhen: HTTP '+r.status); return r.json(); }).then(function(j){ return j.elevation; });
    })).then(function(l){ return [].concat.apply([], l); });
  }

  // ---------- Oberfläche ----------
  function segZeichnen(){
    $('variante').innerHTML=Object.keys(tour.varianten).map(function(k){ var v=tour.varianten[k]; return '<button type="button" data-v="'+k+'" aria-pressed="'+(wahl.variante===k)+'">'+esc(v.name)+'</button>'; }).join('');
    $('variante-kurz').textContent=(tour.varianten[wahl.variante]||{}).kurz||'';
    $('richtung').innerHTML=RICHTUNGEN.map(function(r){ return '<button type="button" data-r="'+r+'" aria-pressed="'+(wahl.richtung===r)+'" aria-label="'+(r==='egal'?'Richtung egal':'Richtung '+r)+'">'+PFEIL[r]+'</button>'; }).join('');
    $('distanz-wert').textContent=km(wahl.distanz);
    $('kinder').textContent=wahl.kinder;
    $('draussen').hidden=!draussen(); $('drinnen').hidden=draussen();
    $('planen').textContent=draussen() ? 'Tour planen' : 'Speichern und spielen';
  }
  function planCode(p){                          // kompakt für den Link: ohne Route und Höhenprofil
    var k={format:1, thema:p.thema, stand:p.stand, variante:p.variante, kinder:p.kinder, stationen:(p.stationen||[]).map(function(s){ return {lat:s.lat, lng:s.lng, name:s.name, an:s.an, zu:s.zu}; })};
    var bytes=new TextEncoder().encode(JSON.stringify(k)), s=''; for(var i=0;i<bytes.length;i++) s+=String.fromCharCode(bytes[i]);
    return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  }
  function spielLink(p){ var u=new URL('spiel.html', location.href); u.searchParams.set('thema', thema); u.searchParams.set('plan', planCode(p)); return u.toString(); }
  function speichern(){
    plan.stand=new Date().toISOString(); plan.variante=wahl.variante; plan.kinder=wahl.kinder;
    try{ localStorage.setItem(PLAN_KEY, JSON.stringify(plan)); }catch(e){}
  }

  function markerIcon(i, s){ return L.divIcon({className:'nr-marker'+(i===0?' start':s.gefunden?'':' ersatz'), html:String(i===0?'⌂':i+1), iconSize:[38,38]}); }
  var netz=null, marker=[], linie=null, rechenWunsch=null;

  // ---------- Kennzahlen: Strecke, Dauer, Heimweg ----------
  function kennzahlenZeigen(strecke, heim, luftlinie){
    var d=PlanerKern.dauer(tour, strecke||0);
    $('k-strecke').textContent=km(strecke||0)+(luftlinie?' (Luftlinie)':'');
    $('k-dauer').textContent='ca. '+d.gesamt+' min';
    $('k-dauer-teile').textContent=d.gehen+' min gehen + '+d.stationen+' min Stationen';
    $('k-heim').textContent=heim!=null ? km(heim) : '–';
    $('k-heim-min').textContent=heim!=null ? 'ca. '+Math.round(heim/((tour.dauer||{}).meterProMinute||35))+' min zurück' : '';
  }
  function luftlinie(){                          // Notbehelf, solange das Wegenetz noch lädt
    var st=plan.stationen, m=0, nach=[0];
    for(var i=1;i<st.length;i++){ m+=PlanerKern.meter(st[i-1], st[i]); nach.push(Math.round(m)); }
    return {strecke:Math.round(m), nach:nach, heim:Math.round(PlanerKern.meter(st[st.length-1], st[0]))};
  }
  function neuRechnen(){                         // Route durch die aktuellen Stationen (auch die gerade gezogene)
    var punkte=plan.stationen.map(function(s,i){ var m=marker[i]; if(m && m.dragging && m._ziehen){ var p=m.getLatLng(); return {lat:p.lat, lng:p.lng}; } return {lat:s.lat, lng:s.lng}; });
    if(!netz){ var l=luftlinie(); return {strecke:l.strecke, nach:l.nach, heim:l.heim, luft:true}; }
    var r=PlanerKern.routeDurch(netz, punkte); if(!r) return null;
    r.heim=PlanerKern.wegLaenge(netz, punkte[punkte.length-1], punkte[0]);
    return r;
  }
  function liveAktualisieren(){                  // beim Ziehen: höchstens einmal pro Bild neu rechnen
    if(rechenWunsch) return;
    rechenWunsch=requestAnimationFrame(function(){
      rechenWunsch=null;
      var r=neuRechnen(); if(!r) return;
      if(r.route && linie) linie.setLatLngs(r.route);
      kennzahlenZeigen(r.strecke, r.heim, r.luft);
      marker.forEach(function(m,i){ if(m._ziehen) m.setTooltipContent((i+1)+' · nach '+km(r.nach[i])); });
    });
  }
  function nachZiehen(i){                        // losgelassen: auf den Weg setzen, Namen, Strecke, Höhen übernehmen
    var r=neuRechnen(), s=plan.stationen[i];
    if(r && r.knoten){
      var k=r.knoten[i], o=PlanerKern.ortAm(netz, k.id);
      s.lat=k.lat; s.lng=k.lng;
      s.name=(tour.stationen[i].name||'Station')+(o.strasse?' '+o.an:''); s.an=o.an; s.zu=o.zu;
      plan.route=r.route; plan.strecke=r.strecke; plan.heimweg=r.heim;
    } else {
      var p=marker[i].getLatLng(); s.lat=+p.lat.toFixed(6); s.lng=+p.lng.toFixed(6);
      if(r){ plan.strecke=r.strecke; plan.heimweg=r.heim; }
    }
    s.gefunden=true; s.hinweis='von Hand gesetzt'; s.verschoben=true;
    if(r) plan.stationen.forEach(function(x,j){ x.nachMeter=r.nach[j]; });
    speichern(); listeZeichnen(); kartenZeichnen(false);
    toast('Station '+(i+1)+' gespeichert · '+km(plan.strecke)+' · ca. '+PlanerKern.dauer(tour, plan.strecke).gesamt+' min');
    if(r && r.route) hoehenNeu();
  }
  function hoehenNeu(){                          // Höhenprofil zur neuen Route nachladen
    var route=plan.route, m=[0];
    for(var i=1;i<route.length;i++) m.push(m[i-1]+PlanerKern.meter({lat:route[i-1][0],lng:route[i-1][1]},{lat:route[i][0],lng:route[i][1]}));
    var schritt=Math.max(15, m[m.length-1]/40), idx=[], weiter=0;
    m.forEach(function(x,i){ if(x>=weiter || i===m.length-1){ idx.push(i); weiter=x+schritt; } });
    var punkte=idx.map(function(i){ return {lat:route[i][0], lng:route[i][1]}; }), stand=plan.stand;
    hoehen(punkte.concat(plan.stationen)).then(function(h){
      if(plan.stand!==stand) return;
      plan.hoehenProfil=idx.map(function(i,k){ return {m:Math.round(m[i]), h:h[k]}; });
      plan.stationen.forEach(function(s,j){ s.hoehe=Math.round(h[idx.length+j]); });
      speichern(); listeZeichnen();
    })['catch'](function(){});
  }

  function listeZeichnen(){
    var st=plan.stationen, fehlt=st.filter(function(s){ return !s.gefunden; }).length;
    $('zusammenfassung').textContent=st.length+' Stationen'+(fehlt?', '+fehlt+' davon mit Ersatzort':', alle Orte passen zur Geschichte')+'.';
    $('liste').innerHTML=st.map(function(s,i){
      var t=tour.stationen[i];
      return '<li><span class="nr">'+(i+1)+'</span><div><b>'+esc(s.name)+'</b> · '+esc(t.title||(t.steps&&t.steps[0].title)||'')+
        '<div class="h">'+(i===0?'Start':(s.gefunden?'<span class="ok">✓ '+esc(s.hinweis)+'</span>':'<span class="warn">Ersatz: '+esc(s.hinweis)+'</span>')+' · nach '+km(s.nachMeter||0))+(s.hoehe!=null?' · '+s.hoehe+' m ü. NN':'')+'</div>'+
        '<div class="h">Geschichte: '+esc(t.wo)+'</div></div></li>';
    }).join('');
    profilZeichnen();
    kennzahlenZeigen(plan.strecke, plan.heimweg, false);
  }
  function kartenZeichnen(einpassen){
    var st=plan.stationen;
    if(!karte){
      karte=L.map('karte',{scrollWheelZoom:false, tap:false});
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19, attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}).addTo(karte);
      ebenen=L.layerGroup().addTo(karte);
    }
    ebenen.clearLayers(); marker=[];
    linie=L.polyline(plan.route||st.map(function(s){ return [s.lat,s.lng]; }),{color:'#6B35C9', weight:5, opacity:.8, dashArray:plan.route?null:'6 8'}).addTo(ebenen);
    st.forEach(function(s,i){
      var m=L.marker([s.lat,s.lng],{icon:markerIcon(i,s), draggable:i>0, autoPan:true, title:s.name}).addTo(ebenen);
      m.bindTooltip((i+1)+' · '+s.name);
      m.on('dragstart', function(){ m._ziehen=true; m.openTooltip(); $('kennzahlen').classList.add('zieht'); });
      m.on('drag', liveAktualisieren);
      m.on('dragend', function(){ $('kennzahlen').classList.remove('zieht'); nachZiehen(i); m._ziehen=false; });
      marker.push(m);
    });
    if(einpassen) setTimeout(function(){ karte.invalidateSize(); karte.fitBounds(L.latLngBounds(st.map(function(s){ return [s.lat,s.lng]; })).pad(0.15)); }, 50);
  }
  function ergebnisZeigen(){
    $('ergebnis').hidden=false;
    if(plan.heimweg==null && netz){ var st=plan.stationen; plan.heimweg=PlanerKern.wegLaenge(netz, st[st.length-1], st[0]); }
    listeZeichnen(); kartenZeichnen(true);
  }
  function netzNachladen(){                      // gespeicherte Tour: Wegenetz im Hintergrund holen, damit Verschieben live rechnet
    if(netz || !plan || !plan.start) return;
    var radius=Math.min(2500, (plan.distanz||wahl.distanz)*1.15+200);
    overpass(PlanerKern.overpassAbfrage(plan.start.lat, plan.start.lng, radius)).then(function(osm){
      osmCache={osm:osm, start:plan.start, distanz:plan.distanz||wahl.distanz}; wahl.start=plan.start;
      netz=PlanerKern.netzBauen(osm);
      if(plan.heimweg==null){ var st=plan.stationen; plan.heimweg=PlanerKern.wegLaenge(netz, st[st.length-1], st[0]); speichern(); }
      kennzahlenZeigen(plan.strecke, plan.heimweg, false);
    })['catch'](function(){});
  }
  function profilZeichnen(){
    var svg=$('profil'), p=plan.hoehenProfil;
    if(!p || p.length<2){ svg.innerHTML=''; svg.style.display='none'; return; }
    svg.style.display='';
    var maxM=p[p.length-1].m||1, hs=p.map(function(x){ return x.h; }), lo=Math.min.apply(null,hs), hi=Math.max.apply(null,hs), sp=Math.max(6, hi-lo);
    function x(m){ return m/maxM*600; } function y(h){ return 110-(h-lo)/sp*90; }
    var d='M0,120 '+p.map(function(e){ return 'L'+x(e.m).toFixed(1)+','+y(e.h).toFixed(1); }).join(' ')+' L600,120 Z';
    var marken=plan.stationen.map(function(s,i){ if(s.nachMeter==null||s.hoehe==null) return ''; return '<circle cx="'+x(s.nachMeter).toFixed(1)+'" cy="'+y(s.hoehe).toFixed(1)+'" r="5" fill="#6B35C9"/>'; }).join('');
    svg.innerHTML='<path d="'+d+'" fill="#E6DEF7" stroke="#6B35C9" stroke-width="2" vector-effect="non-scaling-stroke"/>'+marken+
      '<text x="6" y="16" font-size="13" fill="#5A5073">'+Math.round(lo)+' bis '+Math.round(hi)+' m</text>';
  }

  function planenKlick(){
    if(!draussen()){                             // drinnen: nur Variante und Kinder merken
      plan={format:1, thema:thema, stationen:[], strecke:0};
      speichern(); location.href='spiel.html?thema='+encodeURIComponent(thema); return;
    }
    var text=$('adresse').value.trim();
    if(!wahl.start && !text){ status('Bitte eine Startadresse eingeben oder „Mein Standort“ tippen.', true); return; }
    $('planen').disabled=true; versuch=0;
    var startHolen = (wahl.start && (!text || text===wahl.adresse)) ? Promise.resolve(wahl.start) : (status('Adresse wird gesucht …'), adresseSuchen(text).then(function(a){ wahl.start={lat:a.lat,lng:a.lng}; wahl.adresse=text; $('start-info').textContent=a.name; return wahl.start; }));
    startHolen.then(function(start){
      if(osmCache && osmCache.start===start && wahl.distanz<=osmCache.distanz) return rechnen();   // gleiche Gegend: Daten wiederverwenden
      status('Wege, Bänke, Zäune und Kreuzungen werden geladen …');
      var radius=Math.min(2500, wahl.distanz*1.15+200);
      return overpass(PlanerKern.overpassAbfrage(start.lat, start.lng, radius)).then(function(osm){ osmCache={osm:osm, start:start, distanz:wahl.distanz}; netz=null; return rechnen(); });
    })['catch'](function(e){ status(String(e.message||e), true); })
    .then(function(){ $('planen').disabled=false; });
  }
  function rechnen(){
    status('Höhen werden geladen und die Route wird geplant …');
    return PlanerKern.planen(osmCache.osm, {start:osmCache.start, richtung:wahl.richtung, distanz:wahl.distanz, stationen:tour.stationen, hoehen:hoehen, versuch:versuch})
      .then(function(r){
        netz=r.netz;
        plan={format:1, thema:thema, adresse:wahl.adresse, start:osmCache.start, richtung:wahl.richtung, distanz:wahl.distanz,
              strecke:r.strecke, stationen:r.stationen, route:r.route, hoehenProfil:r.hoehenProfil, varianten:r.varianten,
              heimweg:PlanerKern.wegLaenge(r.netz, r.stationen[r.stationen.length-1], r.stationen[0])};
        speichern(); ergebnisZeigen();
        status('Fertig'+(r.varianten>1?' · Route '+(r.versuch+1)+' von '+r.varianten:'')+'. Gespeichert auf diesem Gerät.');
        $('ergebnis').scrollIntoView({behavior:'smooth'});
      })['catch'](function(e){ status(String(e.message||e), true); });
  }

  function verbinden(){
    $('variante').addEventListener('click', function(e){ var b=e.target.closest('button[data-v]'); if(!b) return; wahl.variante=b.getAttribute('data-v'); segZeichnen(); });
    $('richtung').addEventListener('click', function(e){ var b=e.target.closest('button[data-r]'); if(!b) return; wahl.richtung=b.getAttribute('data-r'); segZeichnen(); });
    $('distanz').addEventListener('input', function(){ wahl.distanz=+this.value; $('distanz-wert').textContent=km(wahl.distanz); });
    $('k-minus').addEventListener('click', function(){ wahl.kinder=Math.max(tour.kinder.min, wahl.kinder-1); segZeichnen(); });
    $('k-plus').addEventListener('click', function(){ wahl.kinder=Math.min(tour.kinder.max, wahl.kinder+1); segZeichnen(); });
    $('adresse').addEventListener('input', function(){ if(this.value.trim()!==wahl.adresse){ wahl.start=null; $('start-info').textContent=''; } });
    $('hier').addEventListener('click', function(){
      if(!navigator.geolocation){ toast('Dieses Gerät kann den Standort nicht bestimmen.'); return; }
      status('Standort wird bestimmt …');
      navigator.geolocation.getCurrentPosition(function(p){
        wahl.start={lat:p.coords.latitude, lng:p.coords.longitude}; wahl.adresse='Mein Standort'; $('adresse').value='Mein Standort';
        $('start-info').textContent='Genauigkeit etwa '+Math.round(p.coords.accuracy)+' m'; status('');
      }, function(){ status('Standort nicht erlaubt. Bitte die Adresse eintippen.', true); }, {enableHighAccuracy:true, timeout:15000});
    });
    $('planen').addEventListener('click', planenKlick);
    $('anders').addEventListener('click', function(){ if(!osmCache){ toast('Bitte erst neu planen.'); return; } versuch++; rechnen(); });
    $('speichern').addEventListener('click', function(){ speichern(); location.href='spiel.html?thema='+encodeURIComponent(thema); });
    $('teilen').addEventListener('click', function(){
      speichern(); var link=spielLink(plan);
      if(navigator.share){ navigator.share({title:tour.titel, text:'Unsere Schnitzeljagd', url:link})['catch'](function(){}); return; }
      try{ navigator.clipboard.writeText(link).then(function(){ toast('Link kopiert. Auf dem iPad öffnen, dann ist die Tour dort.'); }, function(){ prompt('Link kopieren:', link); }); }catch(e){ prompt('Link kopieren:', link); }
    });
  }

  fetch('themen/'+thema+'/tour.json').then(function(r){ if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); }).then(function(t){
    tour=t; document.title='Tour planen · '+t.titel;
    $('titel').textContent=t.titel+': Tour planen'; $('untertitel').textContent=t.untertitel+' · '+t.alter+' · '+t.dauer.text;
    var d=$('distanz'); d.min=t.strecke.min; d.max=t.strecke.max; wahl.distanz=t.strecke.standard; wahl.kinder=t.kinder.standard; d.value=wahl.distanz;
    try{ plan=JSON.parse(localStorage.getItem(PLAN_KEY)||'null'); }catch(e){ plan=null; }
    if(plan){
      wahl.variante=plan.variante||wahl.variante; wahl.kinder=plan.kinder||wahl.kinder;
      if(plan.distanz){ wahl.distanz=plan.distanz; d.value=plan.distanz; }
      if(plan.richtung) wahl.richtung=plan.richtung;
      if(plan.start){ wahl.start=plan.start; wahl.adresse=plan.adresse||''; $('adresse').value=wahl.adresse; }
    }
    segZeichnen(); verbinden();
    if(plan && plan.stationen && plan.stationen.length){ ergebnisZeigen(); status('Gespeicherte Tour von diesem Gerät.'); netzNachladen(); }
  })['catch'](function(e){ status('Thema „'+thema+'“ lässt sich nicht laden: '+e.message, true); });
})();
