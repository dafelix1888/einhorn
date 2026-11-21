// Wichtel Bommi (UNICORN-144): Plan und Fortschritt zwischen Gerät und Konto abgleichen.
// Geschichte 1 läuft ohne Konto. Ab Geschichte 2 melden sich Eltern mit dem Konto der Einhorn-Tour an (konto.js).
// Auf dem Gerät: sj.wichtel (Auswahl, Zeitplan), sj.wichtel.gespielt (Nr.), sj.wichtel.zeit (letzte Änderung).
// Im Konto: Tabelle `wichtel` (server/supabase.sql), dazu das Häkchen „Bommi darf mich erinnern“.
// Klemmt der Server, bleibt alles auf dem Gerät; niemand bleibt hängen.
(function(root){
  'use strict';
  var WK=root.WichtelKern, uhr=null;
  function lies(k){ try{ return JSON.parse(localStorage.getItem(k)||'null'); }catch(e){ return null; } }
  function schreib(k,v){ try{ if(v==null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }
  function konto(){ return root.Konto && Konto.aktiv() ? Konto : null; }
  function angemeldet(){ var k=konto(); return !!(k && k.angemeldet()); }
  function lokal(){
    var d={ wahl:lies('sj.wichtel'), gespielt:lies('sj.wichtel.gespielt')||[], zeit:+lies('sj.wichtel.zeit')||0 };
    var m=root.WichtelMessung && WichtelMessung.stand();   // Familien-Kennung und Prüf-Markierung (UNICORN-140)
    if(m && m.familie) d.familie=m.familie; if(m && m.pruefung) d.pruefung=m.pruefung;
    return d;
  }

  // Schranke: vor Geschichte 2 und später, solange der Server erreichbar ist und niemand angemeldet ist.
  function schranke(nr){ return WK.braucheKonto(nr) && !!konto() && !angemeldet(); }

  function hochladen(erinnern){
    if(!angemeldet()) return Promise.resolve(false);
    return Konto.wichtelSpeichern(lokal(), erinnern).then(function(){ return true; }, function(){ return false; });
  }
  // Nach jeder Änderung auf dem Gerät: Zeit merken, kurz warten, dann ins Konto.
  function geaendert(){
    schreib('sj.wichtel.zeit', Date.now());
    if(!angemeldet()) return;
    clearTimeout(uhr); uhr=setTimeout(function(){ hochladen(); }, 1200);
  }
  // Beim Öffnen und direkt nach der Anmeldung. Liefert true, wenn sich auf dem Gerät etwas geändert hat.
  function abgleichen(){
    if(!angemeldet()) return Promise.resolve(false);
    return Konto.wichtelHolen().then(function(z){
      var vorher=JSON.stringify(lokal()), r=WK.abgleich(lokal(), z);
      if(r.daten.wahl) schreib('sj.wichtel', r.daten.wahl);
      schreib('sj.wichtel.gespielt', r.daten.gespielt); schreib('sj.wichtel.zeit', r.daten.zeit||null);
      if(root.WichtelMessung) WichtelMessung.uebernehmen(r.daten);
      if(z) schreib('sj.wichtel.erinnern', !!z.erinnern);
      var p=r.hochladen ? hochladen() : Promise.resolve();
      return p.then(function(){ return JSON.stringify(lokal())!==vorher; });
    }, function(){ return false; });
  }
  // Häkchen „Bommi darf mich erinnern“ (nie vorausgewählt, im Konto änderbar)
  function erinnern(an){ schreib('sj.wichtel.erinnern', !!an); return hochladen(!!an); }
  function erinnertGemerkt(){ return !!lies('sj.wichtel.erinnern'); }

  // Anmelden mit dem vorhandenen Fenster aus konto.js, danach Plan abgleichen und das Häkchen speichern.
  function anmelden(haken, weiter){
    var k=konto(); if(!k){ if(weiter) weiter(); return; }
    k.fenster('wichtel', { titel:'Bommi bleibt bei euch', vorteile:false,
      text:'Mit deiner E-Mail-Adresse. Wir schicken dir einen Code, kein Passwort. Hast du schon ein Konto von der Einhorn-Tour? Dann nimm dieselbe Adresse.',
      wer:'<b>Deine</b> E-Mail-Adresse. Dorthin kommt der Code.',
      fertig:'Euer Plan ist jetzt im Konto.',
      danach:function(){ abgleichen().then(function(){ return haken ? erinnern(true) : null; }).then(function(){ if(weiter) weiter(); }); } });
  }

  root.WichtelKonto={ schranke:schranke, angemeldet:angemeldet, geaendert:geaendert, abgleichen:abgleichen, erinnern:erinnern, erinnertGemerkt:erinnertGemerkt, anmelden:anmelden, lokal:lokal };
})(this);
