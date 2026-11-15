// Namens-Sätze: gemeinsamer Kern für die App (namen.js) und die Edge Function „namen“ (UNICORN-49/50/51, ADR-28).
// Kopie liegt in server/functions/namen/namen-kern.js und muss gleich bleiben (Test namen-kern.test.cjs).
//
//  * Vorlagen kommen aus tour.json (namenSaetze): je Stelle 2–3 Varianten, nur {name} als Variable,
//    das Alter als eigener Satz mit {alter}. So hängt der Ton eines Namens-Satzes nur am Namen.
//  * Schlüssel einer Aufnahme = Hash aus Stimme, Modell, Einstellungen und dem gesprochenen Text.
//  * Je Text höchstens MAX_AUFNAHMEN Aufnahmen insgesamt, beste zuerst (Wert).
(function(g){
  'use strict';
  var MAX_AUFNAHMEN=3, MAX_NEU=3, NAME_LAENGE=20;
  var NAME=/^[\p{L}][\p{L}\p{M} '’-]*$/u;
  // Teilwörter, die nie in einem Namen vorkommen sollen, und ganze Wörter (sonst träfen sie echte Namen wie Nazim)
  var SPERR_TEIL=['arsch','scheiss','fick','fotze','wichs','nutte','hitler','fuck','shit','bitch','porno','schwuchtel','missgeburt','kanake','neger','kotze','spasti'];
  var SPERR_WORT=['hure','nazi','nazis','sex','penis','vagina','muschi','kacke','pisse','spast','idiot','depp','trottel','behindert','tot','tod','mord','blod','bloed','dumm','doof','opfer','schlampe','titten','pipi','kaka'];

  function sauber(s){ return String(s==null?'':s).normalize('NFC').trim().replace(/\s+/g,' '); }
  function flach(s){ return sauber(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/ß/g,'ss'); }
  // Leer = in Ordnung, sonst ein Satz für die Eltern
  function pruefeName(s, wofuer){
    s=sauber(s); var was=wofuer||'den Vornamen';
    if(!s) return 'Bitte '+was+' eintragen.';
    if(s.length>NAME_LAENGE) return 'Bitte höchstens '+NAME_LAENGE+' Zeichen.';
    if(!NAME.test(s)) return 'Bitte nur Buchstaben, Leerzeichen, Bindestrich oder Apostroph.';
    var f=flach(s), worte=f.split(/[ '’-]+/);
    for(var i=0;i<SPERR_TEIL.length;i++) if(f.indexOf(SPERR_TEIL[i])>=0) return 'Diesen Namen kann Funkel leider nicht sagen.';
    for(var j=0;j<worte.length;j++) if(SPERR_WORT.indexOf(worte[j])>=0) return 'Diesen Namen kann Funkel leider nicht sagen.';
    return '';
  }

  // Zahl als Wort, damit Funkel jedes Alter richtig ausspricht (UNICORN-52: keine Altersgrenze)
  var E=['null','eins','zwei','drei','vier','fünf','sechs','sieben','acht','neun','zehn','elf','zwölf','dreizehn','vierzehn','fünfzehn','sechzehn','siebzehn','achtzehn','neunzehn'];
  var Z=['','','zwanzig','dreißig','vierzig','fünfzig','sechzig','siebzig','achtzig','neunzig'];
  function unter100(n){ if(n<20) return E[n]; var e=n%10, z=Z[Math.floor(n/10)]; return e ? (e===1?'ein':E[e])+'und'+z : z; }
  function zahlwort(n){
    n=Math.round(Number(n));
    if(!(n>=1 && n<1000)) return String(n);
    if(n<100) return unter100(n);
    var h=Math.floor(n/100), r=n%100;
    return (h===1?'ein':E[h])+'hundert'+(r ? (r===1?'eins':unter100(r)) : '');
  }
  // „6 Jahre“ / „ein Jahr“: so passt der Satz am Geburtstag und bei einer Feier danach (UNICORN-57)
  function jahre(a, wort){ return a===1 ? (wort==='1'?'1 Jahr':'ein Jahr') : wort+' Jahre'; }
  function alterZahl(a){ var n=Math.round(Number(a)); return n>=1 ? n : 0; }

  function fuellen(t, w){ return String(t).replace(/\{(name|alter)\}/g, function(_, k){ return w[k]==null?'':String(w[k]); }); }

  // Vorlagen prüfen: sonst könnte eine kaputte tour.json Credits kosten
  function vorlagenOk(v){
    if(!v || typeof v!=='object' || !Array.isArray(v.stellen) || !v.stellen.length) return false;
    var ok=v.stellen.every(function(s){
      return s && /^[a-z]{2,20}$/.test(s.id) && Array.isArray(s.varianten) && s.varianten.length>=1 && s.varianten.length<=5 &&
        s.varianten.every(function(t){ return typeof t==='string' && t.length<=220 && t.indexOf('{name}')>=0 && t.indexOf('{alter}')<0; });
    });
    if(v.alter) ok=ok && Array.isArray(v.alter.varianten) && v.alter.varianten.length>=1 &&
      v.alter.varianten.every(function(t){ return typeof t==='string' && t.length<=220 && t.indexOf('{alter}')>=0 && t.indexOf('{name}')<0; });
    return ok;
  }

  // Alle Sätze einer Party: je Stelle angezeigter und gesprochener Text. wahl = {stelle: Variante}.
  // Der Alters-Satz heißt „alter“ und folgt im Spiel direkt auf den Satz der Stelle v.alter.nach (Standard „schatz“).
  function bilden(v, o){
    o=o||{}; var name=sauber(o.name), sprech=sauber(o.aussprache)||name, a=alterZahl(o.alter), wahl=o.wahl||{}, r={};
    v.stellen.forEach(function(s){
      var i=Math.max(0, Math.min(s.varianten.length-1, Math.round(Number(wahl[s.id])||0)));
      r[s.id]={titel:s.titel||s.id, variante:i, varianten:s.varianten.length, zeigen:fuellen(s.varianten[i], {name:name}), sprechen:fuellen(s.varianten[i], {name:sprech})};
    });
    if(v.alter && a){
      r.alter={titel:'Alter', variante:0, varianten:1, nach:v.alter.nach||'schatz', zeigen:fuellen(v.alter.varianten[0], {alter:jahre(a, String(a))}), sprechen:fuellen(v.alter.varianten[0], {alter:jahre(a, zahlwort(a))})};
    }
    return r;
  }
  function naechsteWahl(v, wahl){ var w={}; v.stellen.forEach(function(s){ w[s.id]=((Math.round(Number((wahl||{})[s.id]))||0)+1)%s.varianten.length; }); return w; }

  // Schlüssel einer Aufnahme (ADR-28): nicht der Name, nicht die Party, sondern genau das, was gesprochen wird
  function schluessel(stimme, text){
    var s=JSON.stringify([stimme.voice_id, stimme.modell, stimme.einstellungen, stimme.vorweg||'', sauber(text)]);
    return g.crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)).then(function(b){
      return Array.prototype.map.call(new Uint8Array(b), function(x){ return ('0'+x.toString(16)).slice(-2); }).join('').slice(0,40);
    });
  }

  // Welche Aufnahme? aufnahmen = [{aufnahme, wert}] aus dem Speicher, aktuell = bisher gewählte Nummer (oder null).
  // Ergebnis {aufnahme, neu}: neu = muss bei ElevenLabs erzeugt werden.
  function aufnahmeWaehlen(aufnahmen, aktuell, andereBetonung){
    var l=(aufnahmen||[]).slice().sort(function(a,b){ return (b.wert-a.wert)||(a.aufnahme-b.aufnahme); });
    var hoechste=l.reduce(function(m,x){ return Math.max(m, x.aufnahme); }, 0);
    if(!l.length) return {aufnahme:1, neu:true};
    if(!andereBetonung || aktuell==null){
      for(var k=0;k<l.length;k++) if(l[k].aufnahme===aktuell) return {aufnahme:aktuell, neu:false};   // bisherige behalten
      return {aufnahme:l[0].aufnahme, neu:false};
    }
    if(l.length<MAX_AUFNAHMEN) return {aufnahme:hoechste+1, neu:true};
    var nr=l.map(function(x){ return x.aufnahme; }).sort(function(a,b){ return a-b; }), i=nr.indexOf(aktuell);
    return {aufnahme:nr[(i+1)%nr.length], neu:false};
  }

  // Zählen gegenüber den Eltern: das erste Einsprechen ist frei, danach MAX_NEU Mal neu.
  function uebrig(erzeugungen){ return Math.max(0, MAX_NEU-Math.max(0, (erzeugungen||0)-1)); }

  g.NamenKern={MAX_AUFNAHMEN:MAX_AUFNAHMEN, MAX_NEU:MAX_NEU, NAME_LAENGE:NAME_LAENGE, sauber:sauber, pruefeName:pruefeName, zahlwort:zahlwort, jahre:jahre, alterZahl:alterZahl,
    fuellen:fuellen, vorlagenOk:vorlagenOk, bilden:bilden, naechsteWahl:naechsteWahl, schluessel:schluessel, aufnahmeWaehlen:aufnahmeWaehlen, uebrig:uebrig};
})(typeof globalThis!=='undefined' ? globalThis : this);
