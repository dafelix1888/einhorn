// Tourplaner: Adresse, Richtung und Strecke rein, fertige Stationen raus.
// Daten: Nominatim (Adresse), Overpass (Wege und Orte), Open-Meteo (Höhen) – alle frei und ohne Schlüssel.
// Ansicht: erst die Eingabe, danach Karte über den ganzen Bildschirm mit Bereich „Euer Weg“ unten.
(function(){
  'use strict';
  var NOMINATIM='https://nominatim.openstreetmap.org/search';
  var PHOTON='https://photon.komoot.io/api/';      // Suche beim Tippen (OpenStreetMap-Daten); Nominatim erlaubt keine Vorschläge beim Tippen
  var OVERPASS=['https://overpass-api.de/api/interpreter','https://maps.mail.ru/osm/tools/overpass/api/interpreter','https://overpass.kumi.systems/api/interpreter'];
  var ELEVATION='https://api.open-meteo.com/v1/elevation';
  // Karten-Worker (config.json „kartenUrl“): merkt sich Antworten und probiert mehrere Server. Fällt er aus, direkt wie bisher.
  var KARTE=null, kartenBereit=fetch('config.json').then(function(r){ return r.json(); }).then(function(c){ if(c && c.kartenUrl) KARTE=c.kartenUrl.replace(/\/$/,''); })['catch'](function(){});
  function alsJson(r){ if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); }
  function ueberKarte(pfad, init, direkt, ms){
    return kartenBereit.then(function(){
      if(!KARTE) return direkt();
      return mitZeitlimit(fetch(KARTE+pfad, init||{}), ms||20000, 'Karte').then(alsJson)['catch'](function(){ return direkt(); });
    });
  }
  var RICHTUNGEN=['NW','N','NO','W','egal','O','SW','S','SO'];
  var WINKEL={N:0,NO:45,O:90,SO:135,S:180,SW:225,W:270,NW:315};
  var FARBEN=['#9050C8','#E23A3F','#F28C1B','#B8860B','#C2410C','#3A9D4B','#2B6FE0','#DB2777','#0E9F9F'];
  var HAUS='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round" aria-hidden="true"><path d="M4 11 12 4l8 7v9h-5v-6H9v6H4z"/></svg>';

  var q=new URLSearchParams(location.search), thema=(q.get('thema')||'einhorn').replace(/[^a-z0-9-]/gi,'');
  var PLAN_KEY='sj.plan.'+thema;
  var tour=null, plan=null, party=null, osmCache=null, versuch=0, karte=null, ebenen=null, netzLaedt=false, gewaehlt=0;
  var wahl={variante:null, rundkurs:false, richtung:'egal', distanz:500, kinder:10, start:null, adresse:''};

  function $(id){ return document.getElementById(id); }
  function esc(t){ return String(t==null?'':t).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function toast(t){ var e=$('toast'); e.textContent=t; e.hidden=false; clearTimeout(toast.t); toast.t=setTimeout(function(){ e.hidden=true; }, 3500); }
  function kartenAnsicht(){ return !$('ergebnis').hidden; }
  function status(t, fehler){
    var s=kartenAnsicht() ? $('sheet-status') : $('status');
    s.textContent=t||''; s.className=(kartenAnsicht()?'sheet-status':'status')+(fehler?' fehler':'');
    if(kartenAnsicht()) s.hidden=!t;
  }
  function draussen(){ return !!(tour.varianten[wahl.variante]||{}).draussen; }
  function km(m){ m=Math.round(m||0); return m>=1000 ? (m/1000).toFixed(1).replace('.',',')+' km' : m+' m'; }
  function zurueckZiel(){ return party ? 'party.html?thema='+encodeURIComponent(thema) : 'landing.html'; }   // nie in den Katalog (UNICORN-25)

  // ---------- Netz ----------
  function mitZeitlimit(p, ms, text){ return Promise.race([p, new Promise(function(_,nein){ setTimeout(function(){ nein(new Error(text)); }, ms); })]); }
  // ---------- Vorschläge beim Tippen ----------
  var vorschlagListe=[], vorschlagAktiv=-1, vorschlagTimer=null, vorschlagNr=0;
  function vorschlagText(p){
    var strasse=p.street ? p.street+(p.housenumber?' '+p.housenumber:'') : '';
    var titel=p.name && p.name!==p.street ? p.name+(strasse?', '+strasse:'') : (strasse||p.name||'');
    var ort=[p.postcode, p.city||p.town||p.village||p.district||p.locality].filter(Boolean).join(' ');
    var zusatz=[p.city&&p.district&&p.district!==p.city?p.district:null, ort, p.country&&p.countrycode!=='DE'?p.country:null].filter(Boolean).join(', ');
    return {titel:titel||ort, zusatz:titel?zusatz:(p.state||''), voll:[titel, ort].filter(Boolean).join(', ')};
  }
  function vorschlagen(text){
    clearTimeout(vorschlagTimer); text=text.trim();
    if(text.length<3 || text==='Mein Standort'){ vorschlaegeZu(); return; }
    vorschlagTimer=setTimeout(function(){
      var nr=++vorschlagNr, nah=wahl.start || (plan && plan.start) || {lat:51.2, lng:10.4};   // Vorschläge in der Nähe zuerst, sonst Mitte Deutschlands
      ueberKarte('/suche?q='+encodeURIComponent(text)+'&lat='+nah.lat.toFixed(2)+'&lon='+nah.lng.toFixed(2), null, function(){
        return fetch(PHOTON+'?q='+encodeURIComponent(text)+'&lang=de&limit=6&lat='+nah.lat.toFixed(3)+'&lon='+nah.lng.toFixed(3)).then(alsJson); }, 6000)
        .then(function(j){
          if(nr!==vorschlagNr) return;                 // eine spätere Eingabe war schneller
          var gesehen={};
          vorschlagListe=(j.features||[]).map(function(f){ var t=vorschlagText(f.properties||{}); t.lat=f.geometry.coordinates[1]; t.lng=f.geometry.coordinates[0]; return t; })
            .filter(function(t){ if(!t.titel || gesehen[t.voll]) return false; gesehen[t.voll]=1; return true; }).slice(0,5);
          vorschlagAktiv=-1; vorschlaegeZeichnen();
        })['catch'](function(){ vorschlaegeZu(); });   // ohne Vorschläge geht es wie bisher mit „Route planen“
    }, 250);
  }
  function vorschlaegeZeichnen(){
    var ul=$('vorschlaege');
    if(!vorschlagListe.length){ vorschlaegeZu(); return; }
    ul.innerHTML=vorschlagListe.map(function(v,i){ return '<li role="option" id="vs-'+i+'" data-i="'+i+'" aria-selected="'+(i===vorschlagAktiv)+'"><b>'+esc(v.titel)+'</b>'+(v.zusatz?'<span>'+esc(v.zusatz)+'</span>':'')+'</li>'; }).join('')+
      '<li class="quelle" aria-hidden="true">Vorschläge: Photon, Daten © OpenStreetMap</li>';
    ul.hidden=false; $('adresse').setAttribute('aria-expanded','true');
    if(vorschlagAktiv>=0) $('adresse').setAttribute('aria-activedescendant','vs-'+vorschlagAktiv); else $('adresse').removeAttribute('aria-activedescendant');
  }
  function vorschlaegeZu(){ var ul=$('vorschlaege'); if(ul){ ul.hidden=true; ul.innerHTML=''; } vorschlagListe=[]; vorschlagAktiv=-1; $('adresse').setAttribute('aria-expanded','false'); $('adresse').removeAttribute('aria-activedescendant'); }
  function vorschlagWaehlen(i){
    var v=vorschlagListe[i]; if(!v) return;
    wahl.start={lat:v.lat, lng:v.lng}; wahl.adresse=v.voll; $('adresse').value=v.voll;
    $('start-info').textContent='Startpunkt gesetzt: '+v.voll;
    vorschlaegeZu(); status(''); vorladen();
  }

  function adresseSuchen(text){
    return ueberKarte('/adresse?q='+encodeURIComponent(text), null, function(){
        return fetch(NOMINATIM+'?format=jsonv2&limit=1&accept-language=de&q='+encodeURIComponent(text)).then(function(r){ if(!r.ok) throw new Error('Adresssuche: HTTP '+r.status); return r.json(); }); })
      .then(function(l){ if(!l.length) throw new Error('Diese Adresse kenne ich nicht. Mit Ort versuchen, z. B. „Musterweg 3, Hamburg“.'); return {lat:+l[0].lat, lng:+l[0].lon, name:l[0].display_name}; });
  }
  // Gleiche Abfrage nur einmal stellen: Vorladen beim Wählen der Adresse und „Route planen“ teilen sich die Antwort (UNICORN-7)
  var overpassLaeuft={};
  function overpass(abfrage){
    if(overpassLaeuft[abfrage]) return overpassLaeuft[abfrage];
    var p=overpassHolen(abfrage); overpassLaeuft[abfrage]=p;
    p['catch'](function(){ delete overpassLaeuft[abfrage]; });
    return p;
  }
  function overpassHolen(abfrage){
    var i=0;
    function versuchen(){
      return mitZeitlimit(fetch(OVERPASS[i], {method:'POST', body:'data='+encodeURIComponent(abfrage), headers:{'Content-Type':'application/x-www-form-urlencoded'}}), 45000, 'Kartendienst antwortet nicht')
        .then(function(r){ if(!r.ok) throw new Error('Kartendienst: HTTP '+r.status); return r.json(); })
        ['catch'](function(e){ if(++i<OVERPASS.length) return versuchen(); throw new Error('Die Kartendienste sind gerade überlastet. Bitte in einer Minute noch einmal auf „Route planen“ tippen.'); });
    }
    // Worker zuerst (Cache, mehrere Server). Antwortet er nach GEDULD ms nicht oder scheitert, fragt der Browser zusätzlich direkt:
    // overpass-api.de begrenzt je IP-Adresse, vom Handy der Eltern klappt es oft besser als von den geteilten Cloudflare-Adressen.
    // Die erste gültige Antwort gewinnt; der Worker rechnet im Hintergrund weiter und füllt seinen Cache (UNICORN-7, Praxistest 3).
    var GEDULD=window.KARTE_GEDULD||20000;
    var UEBERLAST='Die Kartendienste sind gerade überlastet. Bitte in einer Minute noch einmal auf „Route planen“ tippen.';
    return new Promise(function(ja, nein){
      var fertig=false, offen=0, direktLaeuft=false;
      function gut(x){ if(!fertig){ fertig=true; ja(x); } }
      function weg(){ offen--; if(!direktLaeuft) direkt(); else if(offen<=0 && !fertig){ fertig=true; nein(new Error(UEBERLAST)); } }
      function direkt(){ if(direktLaeuft || fertig) return; direktLaeuft=true; offen++; versuchen().then(gut, weg); }
      kartenBereit.then(function(){
        if(!KARTE){ direkt(); return; }
        offen++;
        mitZeitlimit(fetch(KARTE+'/overpass', {method:'POST', body:'data='+encodeURIComponent(abfrage), headers:{'Content-Type':'application/x-www-form-urlencoded'}}), 95000, 'Karte').then(alsJson).then(gut, weg);
        setTimeout(direkt, GEDULD);
      });
    });
  }
  function umkreis(distanz, rundkurs){ return Math.min(2500, distanz*(rundkurs?0.6:1.0)+150); }   // Stationen liegen höchstens ~Distanz vom Start
  function vorladen(){ if(!wahl.start || !draussen()) return; overpass(PlanerKern.overpassAbfrage(wahl.start.lat, wahl.start.lng, umkreis(wahl.distanz, wahl.rundkurs)))['catch'](function(){}); }
  function hoehen(punkte){                       // Open-Meteo: bis zu 100 Punkte je Anfrage
    var teile=[]; for(var i=0;i<punkte.length;i+=100) teile.push(punkte.slice(i,i+100));
    return Promise.all(teile.map(function(t){
      var q='?latitude='+t.map(function(p){ return p.lat.toFixed(5); }).join(',')+'&longitude='+t.map(function(p){ return p.lng.toFixed(5); }).join(',');
      return ueberKarte('/hoehe'+q, null, function(){ return fetch(ELEVATION+q).then(function(r){ if(!r.ok) throw new Error('Höhen: HTTP '+r.status); return r.json(); }); }).then(function(j){ return j.elevation; });
    })).then(function(l){ return [].concat.apply([], l); });
  }

  // ---------- Eingabe ----------
  var HIMMEL={N:'Norden',NO:'Nordosten',O:'Osten',SO:'Südosten',S:'Süden',SW:'Südwesten',W:'Westen',NW:'Nordwesten'};
  function richtungKnopf(r){
    if(r==='egal') return '<span class="r-egal">egal</span>';
    return '<b>'+r+'</b><svg class="r-pfeil" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="transform:rotate('+WINKEL[r]+'deg)"><path d="M12 19V5M6 11l6-6 6 6"/></svg>';
  }
  function segZeichnen(){
    $('variante').innerHTML=Spielart.karten(tour, wahl.variante);                    // UNICORN-47: zuerst Draußen oder Drinnen
    $('variante-kurz').hidden=!!wahl.variante;
    $('richtung').innerHTML=RICHTUNGEN.map(function(r){ return '<button type="button" data-r="'+r+'" aria-pressed="'+(wahl.richtung===r)+'" aria-label="'+(r==='egal'?'Richtung egal':'Richtung '+HIMMEL[r])+'">'+richtungKnopf(r)+'</button>'; }).join('');
    $('richtung-text').textContent=wahl.richtung==='egal' ? 'Egal, wo es die schönsten Orte gibt' : 'Richtung '+HIMMEL[wahl.richtung];
    $('form').innerHTML=[[false,'Hin und zurück'],[true,'Rundkurs']].map(function(f){ return '<button type="button" data-f="'+f[0]+'" aria-pressed="'+(wahl.rundkurs===f[0])+'">'+f[1]+'</button>'; }).join('');
    $('form-kurz').textContent=wahl.rundkurs ? 'Zurück möglichst über andere Wege.' : 'Zurück auf dem kürzesten Weg, meist derselbe.';
    var d=$('distanz'), f=wahl.rundkurs?2:1; d.min=tour.strecke.min*f; d.max=tour.strecke.max*f;
    $('distanz-label').textContent=wahl.rundkurs ? 'Ganze Runde' : 'Bis zum Ziel';
    $('distanz-hinweis').textContent=wahl.rundkurs ? 'Kleine Kinder schaffen gut 1 km.' : 'Kleine Kinder schaffen gut 500 m.';
    d.value=wahl.distanz; $('distanz-wert').textContent=km(wahl.distanz);
    $('kinder').textContent=wahl.kinder;
    var innen=!draussen() || (party && party.ort==='drinnen'), offen=!wahl.variante && !party;   // ohne Wahl geht es nicht weiter
    $('draussen').hidden=innen || offen; $('drinnen').hidden=!innen || offen; $('sek-kinder').hidden=true; $('planen').hidden=offen;
    $('planen').textContent=innen ? 'Speichern und spielen' : 'Route planen';
  }
  function zeigeEingabe(){
    $('ergebnis').hidden=true; $('eingabe').hidden=false; document.body.classList.remove('mit-karte');
    $('zur-route').hidden=!(plan && plan.stationen && plan.stationen.length);
    status(''); window.scrollTo(0,0);
  }

  // ---------- Speichern und Link ----------
  function planCode(p){                          // kompakt für den Link: ohne Route und Höhenprofil
    var k={format:1, thema:p.thema, stand:p.stand, variante:p.variante, kinder:p.kinder, stationen:(p.stationen||[]).map(function(s){ return {lat:s.lat, lng:s.lng, name:s.name, an:s.an, zu:s.zu}; })};
    var bytes=new TextEncoder().encode(JSON.stringify(k)), s=''; for(var i=0;i<bytes.length;i++) s+=String.fromCharCode(bytes[i]);
    return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  }
  function spielLink(p){ var u=new URL('spiel.html', location.href); u.searchParams.set('thema', thema); u.searchParams.set('plan', planCode(p)); return u.toString(); }
  function speichern(){
    plan.stand=new Date().toISOString(); plan.variante=wahl.variante; plan.kinder=wahl.kinder;
    try{ localStorage.setItem(PLAN_KEY, JSON.stringify(plan)); }catch(e){}
    if(window.Konto) Konto.merken(thema);           // angemeldet: Route geschützt mitspeichern
  }

  // ---------- Kennzahlen: Strecke, Dauer, Heimweg ----------
  var netz=null, marker=[], linie=null, heimLinie=null, rechenWunsch=null;
  function kennzahlenZeigen(strecke, heim, luft){   // luft: 'ganz' = nur Luftlinie, 'teils' = ein Stück davon Luftlinie
    var d=PlanerKern.dauer(tour, strecke||0), zusatz=luft==='teils' ? 'teils Luftlinie' : luft ? 'Luftlinie' : '';
    $('k-kurz').textContent=km(strecke)+(zusatz?' '+zusatz:'')+' · etwa '+d.gesamt+' Min.';
    $('k-strecke').textContent=km(strecke)+(zusatz?' ('+zusatz+')':'');
    $('k-dauer').textContent='ca. '+d.gesamt+' min';
    $('k-dauer-teile').textContent=d.gehen+' gehen + '+d.stationen+' Stationen';
    $('k-heim-titel').textContent=plan && plan.rundkurs ? 'Heimweg (Runde)' : 'Heimweg';
    $('k-heim').textContent=heim!=null ? km(heim) : '–';
    var g=plan && plan.rundkurs && plan.heimGleich!=null && !luft ? (plan.heimGleich<=10 ? ' · eigener Weg' : ' · '+plan.heimGleich+' % wie hin') : '';
    $('k-heim-min').textContent=heim!=null ? 'ca. '+Math.round(heim/((tour.dauer||{}).meterProMinute||35))+' min'+g : '';
  }
  // Stück für Stück: zwischen zwei Stationen den Fußweg, wenn beide im geladenen Wegenetz liegen, sonst Luftlinie.
  // Greift, wenn das Netz noch fehlt oder eine Station weit außerhalb liegt (UNICORN-46: sonst blieb die alte Länge stehen).
  function stueckweise(punkte){
    var route=[[punkte[0].lat, punkte[0].lng]], nach=[0], luftTeile=0, wegTeile=0;
    function teil(a, b){
      var r=netz ? PlanerKern.routeDurch(netz, [a,b]) : null;
      if(r){ wegTeile++; return {m:r.strecke, w:[[a.lat,a.lng]].concat(r.route, [[b.lat,b.lng]])}; }
      luftTeile++; return {m:PlanerKern.meter(a,b), w:[[a.lat,a.lng],[b.lat,b.lng]]};
    }
    for(var i=1;i<punkte.length;i++){ var t=teil(punkte[i-1], punkte[i]); nach.push(nach[i-1]+t.m); route=route.concat(t.w.slice(1)); }
    var h=punkte.length>1 ? teil(punkte[punkte.length-1], punkte[0]) : {m:0, w:[]};
    return {strecke:Math.round(nach[nach.length-1]), nach:nach.map(Math.round), heim:Math.round(h.m),
            route:netz ? route : null, heimRoute:netz && plan.rundkurs ? h.w : null, heimGleich:null,
            luft:!luftTeile ? false : wegTeile ? 'teils' : 'ganz'};
  }
  function neuRechnen(){                         // Route durch die aktuellen Stationen (auch die gerade gezogene)
    var punkte=plan.stationen.map(function(s,i){ var m=marker[i]; if(m && m._ziehen){ var p=m.getLatLng(); return {lat:p.lat, lng:p.lng}; } return {lat:s.lat, lng:s.lng}; });
    var r=netz ? PlanerKern.routeDurch(netz, punkte) : null;
    if(!r) return stueckweise(punkte);
    var rw=PlanerKern.rueckweg(netz, r.ids, plan.rundkurs);
    r.heim=rw ? rw.laenge : null; r.heimRoute=rw ? rw.route : null; r.heimGleich=rw ? Math.round(rw.gleich*100) : null; r.luft=false;
    return r;
  }
  function streckeUebernehmen(r){                // Ergebnis von stueckweise() in den Plan
    plan.strecke=r.strecke; plan.heimweg=r.heim; plan.luft=r.luft||false;
    if(r.route){ plan.route=r.route; plan.heimRoute=r.heimRoute; plan.heimGleich=null; }
  }
  function liveAktualisieren(){                  // beim Ziehen: höchstens einmal pro Bild neu rechnen
    if(rechenWunsch) return;
    rechenWunsch=requestAnimationFrame(function(){
      rechenWunsch=null;
      var r=neuRechnen(); if(!r) return;
      if(r.route && linie) linie.setLatLngs(r.route);
      if(heimLinie){ if(r.heimRoute) heimLinie.setLatLngs(r.heimRoute); plan.heimGleich=r.heimGleich; }
      kennzahlenZeigen(r.strecke, r.heim, r.luft);
      marker.forEach(function(m,i){ if(m._ziehen) m.setTooltipContent((i+1)+' · nach '+km(r.nach[i])); });
    });
  }
  function nachZiehen(i){                        // losgelassen: auf den Weg setzen, Namen, Strecke, Höhen übernehmen
    var r=neuRechnen(), s=plan.stationen[i];
    if(r && r.knoten){
      var k=r.knoten[i], o=PlanerKern.ortAm(netz, k.id);
      s.lat=k.lat; s.lng=k.lng;
      s.name=(tour.stationen[i].name||'Station')+(o.strasse?' '+o.an:''); s.an=ansageFrei(i)?o.an:null; s.zu=ansageFrei(i)?o.zu:null;
      plan.route=r.route; plan.strecke=r.strecke; plan.heimweg=r.heim; plan.heimRoute=r.heimRoute; plan.heimGleich=r.heimGleich; plan.luft=false;
    } else {
      var p=marker[i].getLatLng(); s.lat=+p.lat.toFixed(6); s.lng=+p.lng.toFixed(6);
      if(r) streckeUebernehmen(r);
    }
    s.gefunden=true; s.hinweis='von Hand gesetzt'; s.verschoben=true;
    if(r) plan.stationen.forEach(function(x,j){ x.nachMeter=r.nach[j]; });
    gewaehlt=i; speichern(); listeZeichnen(); kartenZeichnen(false);
    toast(plan.luft==='teils' ? 'Station '+(i+1)+' liegt außerhalb der Karte. Strecke dort als Luftlinie: '+km(plan.strecke) : 'Station '+(i+1)+' gespeichert · '+km(plan.strecke)+' · ca. '+PlanerKern.dauer(tour, plan.strecke).gesamt+' min');
    if(r && r.route) hoehenNeu();
  }
  // ---------- Vor Ort setzen: Station auf den echten Standort legen (Generalprobe) ----------
  // Wartet, bis das GPS genau ist (3 Messungen ≤ 12 m, Mittelwert), höchstens 25 s; danach die beste Messung mit Rückfrage.
  var vorOrt=null;
  function vorOrtStopp(){ if(vorOrt){ try{ navigator.geolocation.clearWatch(vorOrt.w); }catch(e){} clearTimeout(vorOrt.t); vorOrt=null; } }
  function vorOrtStatus(text, warn){ var e=$('vor-ort-status'); if(e){ e.hidden=!text; e.textContent=text||''; e.className='vor-ort-status'+(warn?' warn':''); } }
  function vorOrtStart(i){
    if(!navigator.geolocation){ toast('Dieses Gerät kann den Standort nicht bestimmen.'); return; }
    vorOrtStopp();
    var gut=[], beste=null;
    vorOrt={i:i, w:null, t:null};
    $('hier-setzen').disabled=true; $('hier-setzen').textContent='GPS sucht …';
    vorOrtStatus('Bitte kurz stehen bleiben. Das GPS wird genauer …');
    function fertig(lat, lng, acc){ vorOrtStopp(); vorOrtSetzen(i, lat, lng, acc); }
    vorOrt.w=navigator.geolocation.watchPosition(function(p){
      var c=p.coords; if(!vorOrt) return;
      if(!beste || c.accuracy<beste.acc) beste={lat:c.latitude, lng:c.longitude, acc:c.accuracy};
      vorOrtStatus('GPS-Genauigkeit gerade ±'+Math.round(c.accuracy)+' m'+(c.accuracy>12?' · noch warten …':' · gleich fertig'));
      if(c.accuracy<=12){ gut.push(c); if(gut.length>=3){ var n=gut.slice(-3); fertig(n.reduce(function(s,x){ return s+x.latitude; },0)/3, n.reduce(function(s,x){ return s+x.longitude; },0)/3, Math.max.apply(null, n.map(function(x){ return x.accuracy; }))); } }
      else gut=[];
    }, function(err){
      if(!(err && err.code===1)) return;              // kurz kein Signal: weiter warten, die 25 s regeln den Rest
      vorOrtStopp(); zeichneVorOrtKnopf();
      vorOrtStatus('Standort nicht erlaubt. In den Einstellungen des Browsers den Standort für schatzweg.de erlauben.', true);
    }, {enableHighAccuracy:true, maximumAge:0});
    vorOrt.t=setTimeout(function(){
      if(!vorOrt) return;
      var b=beste; vorOrtStopp(); zeichneVorOrtKnopf();
      if(!b){ vorOrtStatus('Kein GPS-Signal. Unter freiem Himmel nochmal versuchen.', true); return; }
      if(b.acc>25 && !confirm('Das GPS ist gerade ungenau (±'+Math.round(b.acc)+' m). Trotzdem hier setzen?')){ vorOrtStatus('Nicht gesetzt. Ein paar Schritte ins Freie gehen und nochmal versuchen.', true); return; }
      vorOrtSetzen(i, b.lat, b.lng, b.acc);
    }, 25000);
  }
  function vorOrtSetzen(i, lat, lng, acc){
    var s=plan.stationen[i]; if(!s) return;
    if(marker[i]){ marker[i].setLatLng([lat,lng]); marker[i]._ziehen=true; }
    var r=neuRechnen(); if(marker[i]) marker[i]._ziehen=false;
    if(r && r.knoten){
      var k=r.knoten[i], o=PlanerKern.ortAm(netz, k.id);
      s.name=(tour.stationen[i].name||'Station')+(o.strasse?' '+o.an:''); s.an=ansageFrei(i)?o.an:null; s.zu=ansageFrei(i)?o.zu:null;
      plan.route=r.route; plan.strecke=r.strecke; plan.heimweg=r.heim; plan.heimRoute=r.heimRoute; plan.heimGleich=r.heimGleich; plan.luft=false;
    } else if(r) streckeUebernehmen(r);
    s.lat=+lat.toFixed(6); s.lng=+lng.toFixed(6);              // genau der Standort, nicht auf den Weg geschoben: so löst das GPS im Spiel hier aus
    s.gefunden=true; s.verschoben=true; s.vorOrt=Math.round(acc); s.hinweis='vor Ort gesetzt (±'+Math.round(acc)+' m)';
    if(r) plan.stationen.forEach(function(x,j){ x.nachMeter=r.nach[j]; });
    var weiter=i+1<plan.stationen.length ? i+1 : i;
    gewaehlt=weiter; speichern(); listeZeichnen(); kartenZeichnen(false);
    try{ if(karte && karte._loaded) karte.panTo([lat,lng]); }catch(e){}
    vorOrtStatus('Station '+(i+1)+' sitzt jetzt genau hier (±'+Math.round(acc)+' m).'+(weiter!==i?' Weiter zu Station '+(weiter+1)+'.':' Das war die letzte Station.'));
    toast(plan.luft==='teils' ? 'Station '+(i+1)+' gesetzt. Sie liegt außerhalb der Karte, Strecke dort als Luftlinie.' : 'Station '+(i+1)+' vor Ort gesetzt');
    if(r && r.route) hoehenNeu();
  }
  function zeichneVorOrtKnopf(){
    var b=$('hier-setzen'); if(!b) return;
    var i=gewaehlt; b.hidden=!(i>0); b.disabled=false;
    b.innerHTML='<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/></svg> Station '+(i+1)+' hier setzen';
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

  // ---------- Station wählen ----------
  function ersatz(i, s){ return i>0 && !s.gefunden; }
  // Von Hand gesetzt: Die Ortsansage („Der Zaun beginnt an der …“) nur, wo sie nicht von einem bestimmten Ding abhängt (UNICORN-48)
  function ansageFrei(i){ var t=((tour.stationen[i]||{}).ort||{}).typ; return t==='weg' || t==='strassenquerung'; }
  function farbe(i){ return FARBEN[i%FARBEN.length]; }
  function stationTitel(i){ var t=tour.stationen[i]||{}; return t.title||(t.steps&&t.steps[0]&&t.steps[0].title)||t.name||'Station'; }
  function stationZeigen(){
    var st=plan.stationen; if(!st.length) return;
    if(gewaehlt>=st.length) gewaehlt=0;
    var s=st[gewaehlt], t=tour.stationen[gewaehlt]||{}, i=gewaehlt, text;
    if(i===0) text='Start an der Haustür.';
    else if(ersatz(i,s)) text='<span class="leise">Einfacher Wegpunkt.</span> Passt so. Gesucht war: '+esc(t.wo||'')+'. Wer mag, zieht die Station dorthin.';
    else text='<span class="ok">'+esc(s.hinweis||'passt')+'</span> · '+esc(s.name)+' · nach '+km(s.nachMeter)+(s.hoehe!=null?' · '+s.hoehe+' m hoch':'');
    $('st-titel').textContent='Station '+(i+1)+': '+stationTitel(i);
    var pl=t.planer||{};                 // kurz, was dort passiert und welcher Ort passt (UNICORN-64)
    $('st-text').innerHTML=text+(pl.was?'<span class="st-was">'+esc(pl.was)+'</span>':'')+(pl.ort?'<span class="st-ort"><b>Passt gut:</b> '+esc(pl.ort)+'</span>':'');
    $('station').className='station'+(ersatz(i,s)?' ersatz':'');
    marker.forEach(function(m,j){ var e=m.getElement(); if(e) e.classList.toggle('gewaehlt', j===i); m.setZIndexOffset(j===i?1000:0); });
    Array.prototype.forEach.call($('liste').querySelectorAll('button[data-i]'), function(b){ b.setAttribute('aria-current', String(+b.getAttribute('data-i')===i)); });
    if(!vorOrt) zeichneVorOrtKnopf();
  }
  function waehle(i, hinfahren){
    if(vorOrt && vorOrt.i!==i){ vorOrtStopp(); vorOrtStatus(''); }
    gewaehlt=i; stationZeigen();
    if(hinfahren && karte && karte._loaded && marker[i]) karte.panInside(marker[i].getLatLng(), {paddingTopLeft:[30,90], paddingBottomRight:[30, sheetSichtbar()+30]});
  }

  // ---------- Liste, Karte, Profil ----------
  function listeZeichnen(){
    var st=plan.stationen, fehlt=st.filter(function(s,i){ return ersatz(i,s); }).length;
    $('zusammenfassung').textContent=(plan.rundkurs && plan.heimweg!=null ? 'Rundkurs, '+km(plan.strecke+plan.heimweg)+' insgesamt. ' : '')+st.length+' Stationen'+(fehlt?', '+fehlt+' davon an einem einfachen Wegpunkt (gestrichelt). Das passt auch so.':', alle Orte passen zur Geschichte.');
    $('liste').innerHTML=st.map(function(s,i){
      var e=ersatz(i,s);
      var pl=(tour.stationen[i]||{}).planer||{};
      return '<li><button type="button" data-i="'+i+'" class="'+(e?'ersatz':'')+'"><i style="background:'+farbe(i)+'">'+(i===0?HAUS:i+1)+'</i><span><b>'+esc(stationTitel(i))+'</b>'+
        '<small>'+(i===0?'Start':(e?'Einfacher Wegpunkt':esc(s.name))+' · nach '+km(s.nachMeter))+'</small>'+
        (pl.was?'<small class="li-info">'+esc(pl.was)+'</small>':'')+(pl.ort?'<small class="li-info"><b>Passt gut:</b> '+esc(pl.ort)+'</small>':'')+(pl.versteck?'<small class="li-info"><b>Versteckt:</b> '+esc(pl.versteck)+'</small>':'')+
        '</span></button></li>';
    }).join('');
    profilZeichnen();
    kennzahlenZeigen(plan.strecke, plan.heimweg, plan.luft);
    stationZeigen();
  }
  function markerIcon(i, s){
    return L.divIcon({className:'pin'+(ersatz(i,s)?' ersatz':'')+(i===gewaehlt?' gewaehlt':''), html:'<span style="background:'+farbe(i)+'">'+(i===0?HAUS:i+1)+'</span>', iconSize:[44,44], iconAnchor:[22,22], tooltipAnchor:[0,-22]});
  }
  function einpassen(){
    var st=plan.stationen; if(!karte || !st.length) return;
    karte.invalidateSize();
    var pkt=st.map(function(s){ return [s.lat,s.lng]; }).concat(plan.route||[]);
    karte.fitBounds(L.latLngBounds(pkt), {paddingTopLeft:[30,90], paddingBottomRight:[30, sheetSichtbar()+30], maxZoom:18});
  }
  // ---------- Menü (Sheet) herunterziehen: Karte groß ansehen (UNICORN-46) ----------
  function sheetKlein(){ return $('sheet').classList.contains('klein'); }
  function sheetVersatz(){ var sh=$('sheet'), k=$('sheet-kopf'); return Math.max(0, sh.offsetHeight-(k.offsetTop+k.offsetHeight+16)); }
  function sheetSichtbar(){ var sh=$('sheet'); return sheetKlein() ? sh.offsetHeight-sheetVersatz() : sh.offsetHeight; }
  function sheetSetzen(klein){
    var sh=$('sheet'); if(klein===sheetKlein() && !sh.style.transform) return;
    if(klein) sh.scrollTop=0;
    sh.style.setProperty('--versatz', sheetVersatz()+'px');
    sh.style.transform=''; sh.classList.toggle('klein', klein);
    $('griff').setAttribute('aria-expanded', String(!klein));
    $('griff').setAttribute('aria-label', klein ? 'Menü wieder aufklappen' : 'Menü kleiner machen, Karte groß zeigen');
    setTimeout(einpassen, 270);
  }
  function sheetZiehenEinrichten(){
    var sh=$('sheet'), zug=null, klickSperre=false;
    function start(y, ziel){ zug={y0:y, d:0, an:false, ausKopf:!!ziel.closest('.griff,.sheet-kopf'), klein:sheetKlein()}; }
    function bewegen(y){
      if(!zug) return false;
      var d=y-zug.y0;
      if(!zug.an){
        if(Math.abs(d)<8) return false;
        // Ziehen am Griff oder Kopf, im kleinen Zustand überall, sonst nur nach unten, wenn der Inhalt oben ist
        if(zug.ausKopf || zug.klein || (d>0 && sh.scrollTop<=0)){ zug.an=true; zug.y0=y; d=0; zug.max=sheetVersatz(); sh.classList.add('zieht'); }
        else { zug=null; return false; }
      }
      zug.d=d;
      sh.style.transform='translateY('+Math.max(0, Math.min(zug.max, (zug.klein?zug.max:0)+d))+'px)';
      return true;
    }
    function ende(){
      if(!zug) return; var z=zug; zug=null; sh.classList.remove('zieht');
      if(!z.an) return;
      klickSperre=true; setTimeout(function(){ klickSperre=false; }, 350);
      sheetSetzen(z.klein ? z.d>-40 : z.d>60);
    }
    sh.addEventListener('touchstart', function(e){ if(e.touches.length===1) start(e.touches[0].clientY, e.target); }, {passive:true});
    sh.addEventListener('touchmove', function(e){ if(zug && bewegen(e.touches[0].clientY)) e.preventDefault(); }, {passive:false});
    sh.addEventListener('touchend', ende); sh.addEventListener('touchcancel', ende);
    sh.addEventListener('mousedown', function(e){ if(e.button===0 && e.target.closest('.griff,.sheet-kopf')) start(e.clientY, e.target); });
    window.addEventListener('mousemove', function(e){ if(zug) bewegen(e.clientY); });
    window.addEventListener('mouseup', ende);
    sh.addEventListener('click', function(e){
      if(klickSperre){ e.preventDefault(); e.stopPropagation(); return; }
      if(sheetKlein()){ e.preventDefault(); e.stopPropagation(); sheetSetzen(false); return; }   // klein: Tippen klappt wieder auf
      if(e.target.closest('.griff')) sheetSetzen(true);
    }, true);
    window.addEventListener('resize', function(){ if(sheetKlein()) sh.style.setProperty('--versatz', sheetVersatz()+'px'); });
  }
  function kartenZeichnen(neuEinpassen){
    var st=plan.stationen;
    if(!karte){
      karte=L.map('karte',{zoomControl:false, tap:false});
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19, className:'kachel-dunkel', attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}).addTo(karte);
      karte.attributionControl.setPrefix(false);
      ebenen=L.layerGroup().addTo(karte);
    }
    ebenen.clearLayers(); marker=[];
    heimLinie=plan.heimRoute ? L.polyline(plan.heimRoute,{color:'#4ADE80', weight:4, opacity:.8, dashArray:'2 9', lineCap:'round'}).addTo(ebenen) : null;
    linie=L.polyline(plan.route||st.map(function(s){ return [s.lat,s.lng]; }),{color:'#A78BFA', weight:5, opacity:.95, dashArray:plan.route?null:'6 8', lineCap:'round'}).addTo(ebenen);
    st.forEach(function(s,i){
      var m=L.marker([s.lat,s.lng],{icon:markerIcon(i,s), draggable:i>0, autoPan:true, title:'Station '+(i+1)+': '+stationTitel(i), keyboard:true, zIndexOffset:i===gewaehlt?1000:0}).addTo(ebenen);
      m.bindTooltip((i+1)+' · '+s.name, {direction:'top'});
      m.on('click', function(){ waehle(i, false); if(sheetKlein()) sheetSetzen(false); });
      m.on('dragstart', function(){ ziehTippWeg(); m._ziehen=true; gewaehlt=i; stationZeigen(); m.openTooltip(); $('sheet-kopf').classList.add('zieht'); });
      m.on('drag', liveAktualisieren);
      m.on('dragend', function(){ $('sheet-kopf').classList.remove('zieht'); nachZiehen(i); m._ziehen=false; });
      marker.push(m);
    });
    stationZeigen();
    if(neuEinpassen) setTimeout(einpassen, 50);
  }
  function profilZeichnen(){
    var svg=$('profil'), p=plan.hoehenProfil;
    if(!p || p.length<2){ svg.innerHTML=''; svg.style.display='none'; return; }
    svg.style.display='';
    var maxM=p[p.length-1].m||1, hs=p.map(function(x){ return x.h; }), lo=Math.min.apply(null,hs), hi=Math.max.apply(null,hs), sp=Math.max(6, hi-lo);
    function x(m){ return m/maxM*600; } function y(h){ return 110-(h-lo)/sp*80; }
    var d='M0,120 '+p.map(function(e){ return 'L'+x(e.m).toFixed(1)+','+y(e.h).toFixed(1); }).join(' ')+' L600,120 Z';
    var marken=plan.stationen.map(function(s,i){ if(s.nachMeter==null||s.hoehe==null) return ''; return '<circle cx="'+x(s.nachMeter).toFixed(1)+'" cy="'+y(s.hoehe).toFixed(1)+'" r="5" fill="'+farbe(i)+'" vector-effect="non-scaling-stroke"/>'; }).join('');
    svg.innerHTML='<path d="'+d+'" fill="rgba(167,139,250,.18)" stroke="#A78BFA" stroke-width="2" vector-effect="non-scaling-stroke"/>'+marken+
      '<text x="10" y="20" font-size="15" fill="#B3A9C4">Höhe '+Math.round(lo)+' bis '+Math.round(hi)+' m</text>';
  }
  function startTextZeigen(){
    var form=plan.rundkurs?'Rundkurs':'Hin und zurück', ab=plan.adresse||'eure Haustür';   // Richtung zuerst, damit sie auf dem Handy nicht abgeschnitten wird
    $('start-text').textContent=HIMMEL[plan.richtung] ? 'Richtung '+HIMMEL[plan.richtung]+' · '+form+' · ab '+ab : 'Ab: '+ab+' · '+form;
  }
  function heimNachrechnen(){ var r=neuRechnen(); if(r && !r.luft){ plan.heimweg=r.heim; plan.heimRoute=r.heimRoute; plan.heimGleich=r.heimGleich; } }
  function ergebnisZeigen(){
    $('eingabe').hidden=true; $('ergebnis').hidden=false; document.body.classList.add('mit-karte');
    if(plan.heimweg==null && netz) heimNachrechnen();
    var erstesErsatz=-1; plan.stationen.forEach(function(s,i){ if(erstesErsatz<0 && ersatz(i,s)) erstesErsatz=i; });
    if(gewaehlt>=plan.stationen.length) gewaehlt=0;
    if(erstesErsatz>=0 && !ergebnisZeigen.schon) gewaehlt=erstesErsatz;
    ergebnisZeigen.schon=true;
    if(sheetKlein()) sheetSetzen(false);
    startTextZeigen(); listeZeichnen(); kartenZeichnen(true);
    setTimeout(ziehTipp, 900);
  }
  // Erster Blick auf die Karte (UNICORN-58): einmal je Gerät zeigen, dass man Stationen verschieben kann
  var ZIEH_TIPP='sj.planer.ziehTipp';
  function ziehTippWeg(){ var e=$('zieh-tipp'); if(e) e.hidden=true; try{ localStorage.setItem(ZIEH_TIPP,'1'); }catch(x){} }
  function ziehTipp(){
    var e=$('zieh-tipp'); if(!e || $('ergebnis').hidden) return;
    try{ if(localStorage.getItem(ZIEH_TIPP)) return; }catch(x){ return; }
    e.hidden=false;
  }
  function netzNachladen(){                      // gespeicherte Tour: Wegenetz im Hintergrund holen, damit Verschieben live rechnet
    if(netz || !plan || !plan.start) return;
    var radius=umkreis(plan.distanz||wahl.distanz, plan.rundkurs);
    netzLaedt=true;
    overpass(PlanerKern.overpassAbfrage(plan.start.lat, plan.start.lng, radius)).then(function(osm){
      osmCache={osm:osm, start:plan.start, distanz:plan.distanz||wahl.distanz, radius:radius}; wahl.start=plan.start;
      netz=PlanerKern.netzBauen(osm);
      if(plan.heimweg==null || (plan.rundkurs && !plan.heimRoute)){ heimNachrechnen(); speichern(); kartenZeichnen(false); }
      kennzahlenZeigen(plan.strecke, plan.heimweg, plan.luft);
    })['catch'](function(){}).then(function(){ netzLaedt=false; });
  }

  // ---------- Planen ----------
  function planenKlick(){
    if(!draussen() || (party && party.ort==='drinnen')){   // drinnen: nur Variante und Kinder merken
      plan={format:1, thema:thema, stationen:[], strecke:0};
      speichern(); location.href='party.html?thema='+encodeURIComponent(thema); return;
    }
    var text=$('adresse').value.trim();
    if(!wahl.start && !text){ status('Bitte eine Startadresse eingeben oder den Standort-Knopf tippen.', true); return; }
    $('planen').disabled=true; versuch=0;
    var startHolen = (wahl.start && (!text || text===wahl.adresse)) ? Promise.resolve(wahl.start) : (status('Adresse wird gesucht …'), adresseSuchen(text).then(function(a){ wahl.start={lat:a.lat,lng:a.lng}; wahl.adresse=text; $('start-info').textContent=a.name; return wahl.start; }));
    startHolen.then(function(start){
      if(osmCache && osmCache.start===start && umkreis(wahl.distanz, wahl.rundkurs)<=osmCache.radius) return rechnen();   // gleiche Gegend: Daten wiederverwenden
      status('Wege, Bänke, Zäune und Kreuzungen werden geladen …');
      var geduld=setTimeout(function(){ status('Die Kartendienste sind gerade gut besucht. Noch einen Moment, das kann bis zu einer Minute dauern …'); geduld=setTimeout(function(){ status('Fast geschafft, die Karte sucht noch Wege in eurer Gegend …'); }, 30000); }, 12000);
      var radius=umkreis(wahl.distanz, wahl.rundkurs);
      return overpass(PlanerKern.overpassAbfrage(start.lat, start.lng, radius)).then(function(osm){ clearTimeout(geduld); osmCache={osm:osm, start:start, distanz:wahl.distanz, radius:radius}; netz=null; return rechnen(); }, function(e){ clearTimeout(geduld); throw e; });
    })['catch'](function(e){ status(String(e.message||e), true); })
    .then(function(){ $('planen').disabled=false; });
  }
  function rechnen(){
    status('Die Route wird geplant …');
    var vorher=gewaehlt;
    return PlanerKern.planen(osmCache.osm, {start:osmCache.start, richtung:wahl.richtung, distanz:wahl.distanz, rundkurs:wahl.rundkurs, stationen:tour.stationen, hoehen:hoehen, versuch:versuch})
      .then(function(r){
        netz=r.netz;
        plan={format:1, thema:thema, adresse:wahl.adresse, start:osmCache.start, richtung:wahl.richtung, distanz:wahl.distanz, rundkurs:wahl.rundkurs,
              strecke:r.strecke, stationen:r.stationen, route:r.route, hoehenProfil:r.hoehenProfil, varianten:r.varianten,
              heimweg:r.heimweg, heimRoute:r.heimRoute, heimGleich:r.heimGleich};
        speichern(); status('');
        ergebnisZeigen.schon=false; gewaehlt=vorher; ergebnisZeigen();
        toast((r.varianten>1?'Route '+(r.versuch+1)+' von '+r.varianten+'. ':'')+'Auf diesem Gerät gespeichert.');
      })['catch'](function(e){ status(String(e.message||e), true); });
  }

  function verbinden(){
    $('variante').addEventListener('click', function(e){ var b=e.target.closest('button[data-spielart]'); if(!b) return; var o=b.getAttribute('data-spielart'); wahl.variante=Spielart.aus(o, wahl.variante==='b'); segZeichnen(); if(o==='draussen') vorladen(); });
    $('form').addEventListener('click', function(e){ var b=e.target.closest('button[data-f]'); if(!b) return; var neu=b.getAttribute('data-f')==='true'; if(neu!==wahl.rundkurs){ wahl.distanz=Math.round(wahl.distanz*(neu?2:0.5)/50)*50; } wahl.rundkurs=neu; segZeichnen(); });
    $('richtung').addEventListener('click', function(e){ var b=e.target.closest('button[data-r]'); if(!b) return; wahl.richtung=b.getAttribute('data-r'); segZeichnen(); });
    $('distanz').addEventListener('input', function(){ wahl.distanz=+this.value; $('distanz-wert').textContent=km(wahl.distanz); });
    $('k-minus').addEventListener('click', function(){ wahl.kinder=Math.max(tour.kinder.min, wahl.kinder-1); segZeichnen(); });
    $('k-plus').addEventListener('click', function(){ wahl.kinder=Math.min(tour.kinder.max, wahl.kinder+1); segZeichnen(); });
    $('adresse').addEventListener('input', function(){ if(this.value.trim()!==wahl.adresse){ wahl.start=null; $('start-info').textContent=''; } vorschlagen(this.value); });
    $('adresse').addEventListener('keydown', function(e){
      var l=vorschlagListe; if($('vorschlaege').hidden || !l.length) return;
      if(e.key==='ArrowDown'||e.key==='ArrowUp'){ e.preventDefault(); vorschlagAktiv=(vorschlagAktiv+(e.key==='ArrowDown'?1:-1)+l.length)%l.length; vorschlaegeZeichnen(); }
      else if(e.key==='Enter' && vorschlagAktiv>=0){ e.preventDefault(); vorschlagWaehlen(vorschlagAktiv); }
      else if(e.key==='Escape'){ vorschlaegeZu(); }
    });
    $('adresse').addEventListener('blur', function(){ setTimeout(vorschlaegeZu, 200); });
    $('vorschlaege').addEventListener('mousedown', function(e){ e.preventDefault(); });   // Tippen auf einen Vorschlag schließt die Liste nicht vorher
    $('vorschlaege').addEventListener('click', function(e){ var li=e.target.closest('li[data-i]'); if(li) vorschlagWaehlen(+li.getAttribute('data-i')); });
    $('hier').addEventListener('click', function(){
      if(!navigator.geolocation){ toast('Dieses Gerät kann den Standort nicht bestimmen.'); return; }
      status('Standort wird bestimmt …');
      navigator.geolocation.getCurrentPosition(function(p){
        wahl.start={lat:p.coords.latitude, lng:p.coords.longitude}; wahl.adresse='Mein Standort'; $('adresse').value='Mein Standort'; vorladen();
        $('start-info').textContent='Genauigkeit etwa '+Math.round(p.coords.accuracy)+' m'; status('');
      }, function(){ status('Standort nicht erlaubt. Bitte die Adresse eintippen.', true); }, {enableHighAccuracy:true, timeout:15000});
    });
    $('hier-setzen').addEventListener('click', function(){ vorOrtStart(gewaehlt); });
    sheetZiehenEinrichten();
    $('zieh-tipp-ok').addEventListener('click', ziehTippWeg);
    $('planen').addEventListener('click', planenKlick);
    $('zur-route').addEventListener('click', ergebnisZeigen);
    $('zurueck-eingabe').addEventListener('click', function(e){ e.preventDefault(); if(plan && plan.stationen && plan.stationen.length){ ergebnisZeigen(); return; } Weg.zurueck(zurueckZiel()); });
    $('zurueck-karte').addEventListener('click', function(e){ e.preventDefault(); Weg.zurueck(zurueckZiel()); });
    $('start-pille').addEventListener('click', zeigeEingabe);
    $('aendern').addEventListener('click', zeigeEingabe);
    $('liste').addEventListener('click', function(e){ var b=e.target.closest('button[data-i]'); if(b) waehle(+b.getAttribute('data-i'), true); });
    $('anders').addEventListener('click', function(){
      if(!osmCache){ if(netzLaedt) toast('Die Wege laden noch. Gleich nochmal tippen.'); else zeigeEingabe(); return; }
      var b=this; b.disabled=true; b.textContent='Moment …'; versuch++;
      rechnen().then(function(){ b.disabled=false; b.textContent='Andere Route'; });
    });
    $('speichern').addEventListener('click', function(){ speichern(); if(window.marketer) window.marketer.track('route_planned'); location.href='party.html?thema='+encodeURIComponent(thema); });
    if(window.Konto && Konto.aktiv()) $('teilen').hidden=true;   // geteilt wird geschützt über die Party-Seite
    $('teilen').addEventListener('click', function(){
      speichern(); var link=spielLink(plan);
      if(navigator.share){ navigator.share({title:tour.titel, text:'Unsere Schatzsuche', url:link})['catch'](function(){}); return; }
      try{ navigator.clipboard.writeText(link).then(function(){ toast('Link kopiert. Auf dem Tablet öffnen, dann ist die Tour dort.'); }, function(){ prompt('Link kopieren:', link); }); }catch(e){ prompt('Link kopieren:', link); }
    });
  }

  fetch('themen/'+thema+'/tour.json').then(function(r){ if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); }).then(function(t){
    tour=t; document.title='Route planen · '+t.titel;
    $('untertitel').textContent=t.titel;
    wahl.distanz=t.strecke.standard; wahl.kinder=t.kinder.standard;
    try{ plan=JSON.parse(localStorage.getItem(PLAN_KEY)||'null'); }catch(e){ plan=null; }
    if(plan){
      wahl.variante=plan.variante||wahl.variante; wahl.kinder=plan.kinder||wahl.kinder;
      if(plan.distanz) wahl.distanz=plan.distanz;
      wahl.rundkurs=!!plan.rundkurs;
      if(plan.richtung) wahl.richtung=plan.richtung;
      if(plan.start){ wahl.start=plan.start; wahl.adresse=plan.adresse||''; $('adresse').value=wahl.adresse; }
    }
    party=window.Party && Party.lesen(thema);
    if(party){                                   // Party gibt Variante und Kinder vor, der Planer kümmert sich nur um die Route
      wahl.variante=Party.variante(party); wahl.kinder=party.kinder;
      $('sek-variante').hidden=true; $('sek-kinder').hidden=true;
      if(party.kind && party.kind.name) $('titel').firstChild.textContent='Route für '+party.kind.name;
    }
    $('zurueck-eingabe').href=zurueckZiel(); $('zurueck-karte').href=zurueckZiel();
    if(!party && window.Weg && Weg.pfad) $('wegweiser').innerHTML=Weg.pfad('route');   // Wegweiser nur auf dem ersten Weg (UNICORN-54)
    segZeichnen(); verbinden();
    if(plan && plan.stationen && plan.stationen.length){ ergebnisZeigen(); netzNachladen(); }
  })['catch'](function(e){ status('Thema „'+thema+'“ lässt sich nicht laden: '+e.message, true); });
})();
