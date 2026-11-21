// Wichtel Bommi (UNICORN-140): Messpunkte für Marketer (Namen und Regeln aus MAR-77, Marketer-Repo docs/integration.md).
// Jedes Ereignis trägt produkt: 'wichtel'. Ab der Anmeldung dazu `familie` (zufällige Kennung je Konto, nie E-Mail oder Konto-ID)
// und, bei Test-Konten, `pruefung` ('test' für Rollen und Generalprobe, 'praxis' für Felix' Familie).
// Test-Konto markieren: Wichtel-Seite einmal mit ?pruefung=test oder ?pruefung=praxis öffnen; das wandert mit ins Konto.
// `kanal` = utm_source des ersten Besuchs (bis zur Anmeldung gemerkt). Gesendet über marketer.track (m.js), sonst über Konto.mkMelden.
(function(root){
  'use strict';
  var gemessen={};
  function lies(k){ try{ return JSON.parse(root.localStorage.getItem(k)||'null'); }catch(e){ return null; } }
  function schreib(k,v){ try{ if(v==null) root.localStorage.removeItem(k); else root.localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }
  function angemeldet(){ return !!(root.WichtelKonto && root.WichtelKonto.angemeldet()); }
  function zufall(){
    var a='abcdefghijkmnpqrstuvwxyz23456789', s='', c=root.crypto;
    if(c && c.getRandomValues){ var b=new Uint8Array(12); c.getRandomValues(b); for(var i=0;i<12;i++) s+=a[b[i]%a.length]; }
    else for(var j=0;j<12;j++) s+=a[Math.floor(Math.random()*a.length)];
    return 'f-'+s;
  }
  // Einmal je Konto: kommt sie vom Konto (Abgleich), gilt die vom Konto.
  function familie(){ var f=lies('sj.wichtel.familie'); if(!f){ f=zufall(); schreib('sj.wichtel.familie', f); } return f; }

  // Beim Laden: Kanal (nur der erste) und Prüf-Markierung aus der Adresse merken.
  (function adresse(){
    var q; try{ q=new URLSearchParams(root.location.search); }catch(e){ return; }
    var u=q.get('utm_source'), c=q.get('utm_campaign'), p=q.get('pruefung');
    if(u && !lies('sj.wichtel.kanal')){ schreib('sj.wichtel.kanal', String(u).slice(0,60)); if(c) schreib('sj.wichtel.kampagne', String(c).slice(0,60)); }
    if(p==='test' || p==='praxis') schreib('sj.wichtel.pruefung', p);
    if(p==='aus') schreib('sj.wichtel.pruefung', null);
  })();

  function eigenschaften(props, mitFamilie){
    var p={produkt:'wichtel'}, x;
    for(x in props||{}) if(props[x]!==undefined) p[x]=props[x];
    if(mitFamilie || angemeldet()) p.familie=familie();
    var pr=lies('sj.wichtel.pruefung'); if(pr) p.pruefung=pr;
    return p;
  }
  function senden(name, p){
    root.wichtelMessung=root.wichtelMessung||[]; root.wichtelMessung.push({name:name, props:p});
    if(root.marketer && root.marketer.track){ try{ root.marketer.track(name, p); }catch(e){} return; }
    if(root.Konto && root.Konto.mkMelden) root.Konto.mkMelden(name, p);
  }
  // einmal: Schlüssel, damit Start und Ende je Geschichte und Format höchstens einmal je Seitenaufruf zählen.
  function messen(name, props, einmal){
    if(einmal){ if(gemessen[einmal]) return false; gemessen[einmal]=true; }
    senden(name, eigenschaften(props)); return true;
  }
  // Geschichte 1 zu Ende gesehen (für g1_gesehen beim signup)
  function g1(){ schreib('sj.wichtel.g1', true); }
  // Für konto.js: Eigenschaften des vorhandenen `signup` im Wichtel-Bereich
  function signup(){
    var p={herkunft:'wichtel'}, k=lies('sj.wichtel.kanal'), c=lies('sj.wichtel.kampagne');
    if(k) p.kanal=k; if(c) p.kampagne=c; if(lies('sj.wichtel.g1')) p.g1_gesehen=true;
    return eigenschaften(p, true);
  }
  // Für den Abgleich mit dem Konto (wichtel-konto.js)
  function stand(){ return { familie:lies('sj.wichtel.familie'), pruefung:lies('sj.wichtel.pruefung') }; }
  function uebernehmen(d){
    if(!d) return;
    if(d.familie) schreib('sj.wichtel.familie', d.familie);
    if(d.pruefung==='test' || d.pruefung==='praxis') schreib('sj.wichtel.pruefung', d.pruefung);
  }

  root.WichtelMessung={ messen:messen, g1:g1, signup:signup, familie:familie, stand:stand, uebernehmen:uebernehmen };
})(this);
