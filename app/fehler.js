// Fehler aus der App anonym melden (Supabase, Funktion fehler_melden). Daraus werden Incidents in PBIM.
// Gesendet wird nur Technisches: Seite ohne Parameter, Fehlermeldung, Datei und Zeile, Stapel, App-Version, Browser.
// Keine Party-Daten, keine Links mit Schlüssel (alles nach ? wird entfernt), höchstens 5 Meldungen je Seitenaufruf.
(function(){
  'use strict';
  var URL='https://fsqnzmwuojngopffcxso.supabase.co', KEY='sb_publishable_mD1QtSgNGkljx0XrBMfvgQ_tL0vOGku';  // öffentlich, wie in konto.js
  if(/^(localhost|127\.)/.test(location.hostname) && !window.FEHLER_TEST) return;   // lokal nicht melden
  var gesendet=0, schon={};
  function ohne(t){ return String(t==null?'':t).replace(/\?[^\s):'"]*/g,'').replace(/#[^\s):'"]*/g,''); }
  function melden(meldung, quelle, zeile, stapel){
    meldung=ohne(meldung).slice(0,500); if(!meldung) return;
    if(/^Script error\.?$/i.test(meldung) || /ResizeObserver loop/.test(meldung)) return;      // fremde Skripte, harmlos
    if(/^(chrome|moz|safari)-extension:/.test(quelle||'') || /extension:\/\//.test(stapel||'')) return; // Browser-Erweiterungen
    var k=meldung+'|'+quelle+'|'+zeile; if(schon[k] || gesendet>=5) return; schon[k]=1; gesendet++;
    var version='__VERSION__';                                     // beim Veröffentlichen durch den Git-Stand ersetzt
    try{
      fetch(URL+'/rest/v1/rpc/fehler_melden', {method:'POST', keepalive:true, headers:{apikey:KEY, 'Content-Type':'application/json'},
        body:JSON.stringify({seite:location.pathname, meldung:meldung, quelle:ohne(quelle).slice(0,300), zeile:zeile|0, stapel:ohne(stapel).slice(0,2000), version:version, geraet:navigator.userAgent.slice(0,160)})})['catch'](function(){});
    }catch(e){}
  }
  window.addEventListener('error', function(e){
    if(!e || !e.message) return;                                   // Ladefehler von Bildern o. Ä. ohne Meldung
    melden(e.message, e.filename, e.lineno, e.error && e.error.stack);
  });
  window.addEventListener('unhandledrejection', function(e){
    var r=e && e.reason; if(!r) return;
    var m=r.message||String(r); if(/abort|Failed to fetch|NetworkError|Load failed/i.test(m)) return;   // kein Netz: kein App-Fehler
    melden('Unbehandelt: '+m, '', 0, r.stack);
  });
  window.Fehler={melden:melden};
})();
