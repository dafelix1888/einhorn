// Konto: Party geschützt speichern und mit Links nach Rolle teilen (Supabase, ohne Bibliothek).
//
//  * Planen geht ohne Konto, alles bleibt im Gerät.
//  * Wer teilen will, meldet sich mit einem Code aus der E-Mail an (kein Passwort). Dann liegt die Party
//    geschützt auf dem Server, und jede Rolle bekommt einen eigenen Link mit langem Zufallsschlüssel:
//      gast         einladung.html?k=…    Termin, Treffpunkt, Abholen, Hinweis (keine Route)
//      vorausgeher  vorausgeher.html?k=…  Route und Stationen
//      spiel        spiel.html?k=…        ganze Tour fürs iPad
//    Gäste, Vorausgeher und iPad brauchen kein Konto. Ein Link lässt sich durch einen neuen ersetzen (sperren).
//  * Ohne Eintrag unten (URL leer) läuft alles wie bisher: Daten stecken im Link.
//
// Der Schlüssel unten ist der öffentliche „anon“-Schlüssel von Supabase. Er darf im Code stehen; geschützt wird
// über die Zugriffsregeln in server/supabase.sql.
(function(root){
  'use strict';
  var SUPABASE_URL='https://fsqnzmwuojngopffcxso.supabase.co';
  var SUPABASE_KEY='sb_publishable_mD1QtSgNGkljx0XrBMfvgQ_tL0vOGku';
  try{ if(root.KONTO_TEST){ SUPABASE_URL=root.KONTO_TEST.url; SUPABASE_KEY=root.KONTO_TEST.key; } }catch(e){}

  var SITZUNG='sj.konto', ROLLEN=['gast','vorausgeher','spiel'];
  var zustand={}, uhr={};                              // je Thema: 'speichert' | 'gespeichert' | 'fehler'
  // Notweg: Klappt die Anmeldung aus technischen Gründen nicht (Mailversand gesperrt, Limit, Server weg),
  // läuft die App einen Tag lang wie ohne Server weiter: Daten stecken im Link, kein Anmelden nötig.
  var NOTWEG='sj.konto.notweg';
  function notweg(){ var t=lies(NOTWEG); return !!t && Date.now()-t<864e5; }
  function aktiv(){ return !!(SUPABASE_URL && SUPABASE_KEY) && !(notweg() && !sitzung()); }
  function technisch(e){ return !e || !e.status || e.status===429 || e.status>=500 || /not.?authori[sz]ed|over_email_send_rate_limit|rate limit/i.test((e.code||'')+' '+(e.message||'')); }
  function lies(k){ try{ return JSON.parse(localStorage.getItem(k)||'null'); }catch(e){ return null; } }
  function schreib(k,v){ try{ if(v==null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }
  function esc(t){ return String(t==null?'':t).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function zufall(n){ var a=new Uint8Array(n); crypto.getRandomValues(a); var s=''; for(var i=0;i<n;i++) s+=String.fromCharCode(a[i]); return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); }
  function uuid(){ if(crypto.randomUUID) return crypto.randomUUID(); var h=Array.prototype.map.call(crypto.getRandomValues(new Uint8Array(16)),function(b){ return ('0'+b.toString(16)).slice(-2); }).join('');
    return h.slice(0,8)+'-'+h.slice(8,12)+'-4'+h.slice(13,16)+'-'+((parseInt(h[16],16)&3)|8).toString(16)+h.slice(17,20)+'-'+h.slice(20,32); }
  function basisUrl(){ return location.href.replace(/[?#].*$/,'').replace(/[^/]*$/,''); }

  // ---------- Anfragen ----------
  function anfrage(pfad, opt){
    opt=opt||{}; var h={apikey:SUPABASE_KEY, 'Content-Type':'application/json'};
    if(opt.token) h.Authorization='Bearer '+opt.token;
    if(opt.prefer) h.Prefer=opt.prefer;
    return fetch(SUPABASE_URL.replace(/\/$/,'')+pfad, {method:opt.method||'GET', headers:h, body:opt.body!=null?JSON.stringify(opt.body):undefined}).then(function(r){
      return r.text().then(function(t){ var j=null; try{ j=t?JSON.parse(t):null; }catch(e){}
        if(!r.ok){ var f=new Error((j&&(j.fehler||j.msg||j.message||j.error_description||j.error))||('HTTP '+r.status)); f.status=r.status; f.daten=j; f.code=j&&(j.error_code||j.code); throw f; }
        return j; });
    });
  }

  // ---------- Sitzung ----------
  function sitzung(){ var s=lies(SITZUNG); return s && s.refresh_token ? s : null; }
  function angemeldet(){ return aktiv() && !!sitzung(); }
  function sitzungMerken(j, email){
    var s={access_token:j.access_token, refresh_token:j.refresh_token, ablauf:Date.now()+((j.expires_in||3600)-60)*1000,
      email:(j.user&&j.user.email)||email||(sitzung()&&sitzung().email)||'', id:(j.user&&j.user.id)||(sitzung()&&sitzung().id)||''};
    schreib(SITZUNG, s); return s;
  }
  var erneuern=null;
  function token(){                                    // gültiges Zugriffstoken, bei Bedarf erneuert
    var s=sitzung(); if(!s) return Promise.reject(new Error('nicht angemeldet'));
    if(s.ablauf>Date.now()) return Promise.resolve(s.access_token);
    if(!erneuern) erneuern=anfrage('/auth/v1/token?grant_type=refresh_token', {method:'POST', body:{refresh_token:s.refresh_token}})
      .then(function(j){ erneuern=null; return sitzungMerken(j).access_token; }, function(e){ erneuern=null; if(e.status===400||e.status===401) schreib(SITZUNG,null); throw e; });
    return erneuern;
  }
  function codeSchicken(email){
    return anfrage('/auth/v1/otp?redirect_to='+encodeURIComponent(location.href.replace(/#.*$/,'')), {method:'POST', body:{email:email, create_user:true}});
  }
  function codePruefen(email, code){
    return anfrage('/auth/v1/verify', {method:'POST', body:{type:'email', email:email, token:code}}).then(function(j){
      var neu=j.user && j.user.created_at && Date.now()-Date.parse(j.user.created_at)<30*60000;
      if(neu) mkMelden('signup');                      // Marketer: Stufe „Anmeldung“ (nur das Ereignis, keine E-Mail)
      return sitzungMerken(j, email);
    });
  }
  // Ereignis an Marketer (gleiche Schnittstelle wie m.js, ohne Cookies, nichts auf dem Gerät).
  // Seiten mit m.js nutzen dessen track(); das Spiel lädt m.js bewusst nicht und schickt nur seine wenigen Ereignisse direkt.
  var MK_URL='https://efdjomgubucdnvgtuqmp.supabase.co/functions/v1/track', MK_KEY='45d4d32f10391d24b7e915bd19d6790a4152644ef418aa07';
  function mkMelden(name, props){
    if(root.marketer && root.marketer.track){ try{ root.marketer.track(name, props); }catch(e){} return; }
    if(!root.fetch || /^(localhost|127\.)/.test(location.hostname) && !root.MK_TEST) return;
    try{ fetch(MK_URL, {method:'POST', keepalive:true, credentials:'omit', headers:{'content-type':'application/json', authorization:'Bearer '+MK_KEY},
      body:JSON.stringify({name:name, properties:Object.assign({path:location.pathname}, props||{})})})['catch'](function(){}); }catch(e){}
  }
  function abmelden(){
    var s=sitzung(); schreib(SITZUNG, null); gaesteVergessen();
    if(s) anfrage('/auth/v1/logout', {method:'POST', token:s.access_token})['catch'](function(){});
  }
  // Anmelde-Link aus der Mail (gleicher Browser): Tokens stehen im #-Teil der Adresse
  function linkAusMail(){
    if(!aktiv() || !/access_token=/.test(location.hash)) return null;
    var h=new URLSearchParams(location.hash.slice(1)), j={access_token:h.get('access_token'), refresh_token:h.get('refresh_token'), expires_in:+h.get('expires_in')||3600};
    try{ history.replaceState(null,'',location.pathname+location.search); }catch(e){}
    if(!j.refresh_token) return null;
    sitzungMerken(j);
    return anfrage('/auth/v1/user', {token:j.access_token}).then(function(u){ var s=sitzung(); s.email=u.email; s.id=u.id; schreib(SITZUNG, s); return s; }, function(){ return sitzung(); });
  }

  // ---------- Party speichern ----------
  function schluessel(p){                              // Server-ID und je Rolle ein Link-Schlüssel, einmal pro Party
    if(p.server && p.server.id && p.server.k) return false;
    p.server={id:uuid(), k:{}}; ROLLEN.forEach(function(r){ p.server.k[r]=zufall(18); }); return true;
  }
  function stand(o){ var s=JSON.stringify(o), h=0; for(var i=0;i<s.length;i++){ h=(h*31+s.charCodeAt(i))|0; } return s.length+':'+h; }
  function sync(thema, erzwingen){
    if(!angemeldet() || !root.Party) return Promise.resolve(false);
    var p=Party.lesen(thema); if(!p) return Promise.resolve(false);
    var pl=Party.plan(thema);
    if(schluessel(p)) schreib('sj.party.'+thema, p);
    var daten={gast:Party.einladungsDaten(p, pl), vorausgeher:Party.planKern(pl, p), spiel:Party.planKern(pl, p)};
    var st=stand([p, pl, daten]);
    if(!erzwingen && lies('sj.konto.stand.'+thema)===st) return Promise.resolve(true);
    zustand[thema]='speichert'; zeichnen(thema);
    return token().then(function(t){
      return anfrage('/rest/v1/parties?on_conflict=id', {method:'POST', token:t, prefer:'resolution=merge-duplicates,return=minimal',
        body:{id:p.server.id, thema:thema, party:p, plan:pl, datum:/^\d{4}-\d\d-\d\d$/.test(p.datum||'')?p.datum:null}})
      .then(function(){ return anfrage('/rest/v1/links?on_conflict=token', {method:'POST', token:t, prefer:'resolution=merge-duplicates,return=minimal',
        body:ROLLEN.map(function(r){ return {token:p.server.k[r], party_id:p.server.id, rolle:r, daten:daten[r]}; })}); });
    }).then(function(){ schreib('sj.konto.stand.'+thema, st); zustand[thema]='gespeichert'; zeichnen(thema); return true; },
      function(e){ zustand[thema]=sitzung()?'fehler':null; zeichnen(thema); throw e; });
  }
  function merken(thema){                              // nach jeder Änderung: kurz warten, dann speichern
    if(!angemeldet()) return;
    clearTimeout(uhr[thema]); uhr[thema]=setTimeout(function(){ sync(thema)['catch'](function(){}); }, 1200);
  }
  // Partys vom Server holen, die auf diesem Gerät fehlen (zweites Gerät, neuer Browser)
  function holen(){
    return token().then(function(t){ return anfrage('/rest/v1/parties?select=id,thema,party,plan&order=aktualisiert.desc', {token:t}); }).then(function(liste){
      var neu=0;
      (liste||[]).forEach(function(z){
        if(!/^[a-z0-9-]+$/.test(z.thema) || lies('sj.party.'+z.thema)) return;
        var p=z.party||{}; p.thema=z.thema; p.server=p.server||{id:z.id, k:{}}; schreib('sj.party.'+z.thema, p);
        if(z.plan && !lies('sj.plan.'+z.thema)) schreib('sj.plan.'+z.thema, z.plan);
        neu++;
      });
      return neu;
    });
  }
  function neuerLink(thema, rolle){                   // alten Link sperren: Schlüssel ersetzen, alte Zeile löschen
    var p=Party.lesen(thema); if(!p || !p.server) return Promise.reject(new Error('nicht gespeichert'));
    var alt=p.server.k[rolle]; p.server.k[rolle]=zufall(18); schreib('sj.party.'+thema, p);
    return token().then(function(t){ return anfrage('/rest/v1/links?token=eq.'+encodeURIComponent(alt), {method:'DELETE', token:t}); }).then(function(){ return sync(thema, true); });
  }
  function serverLoeschen(thema, p){
    if(!angemeldet() || !p || !p.server) return Promise.resolve();
    schreib('sj.konto.stand.'+thema, null); schreib('sj.gaeste.'+thema, null);
    return token().then(function(t){ return anfrage('/rest/v1/parties?id=eq.'+p.server.id, {method:'DELETE', token:t}); })['catch'](function(){});
  }

  // ---------- Links einlösen (Gäste, Vorausgeher, iPad: ohne Konto) ----------
  function linkLesen(k){
    if(!aktiv() || !/^[A-Za-z0-9_-]{22,64}$/.test(k||'')) return Promise.resolve(null);
    return anfrage('/rest/v1/rpc/link_lesen', {method:'POST', body:{t:k}});
  }
  function meldung(titel, text){
    document.body.innerHTML='<main style="font:19px/1.45 system-ui,sans-serif;padding:32px;max-width:32rem;margin:auto;color:#F5F2FA;background:#0F0B17;min-height:100vh;box-sizing:border-box">'+
      '<h1 style="font-size:1.5rem">'+esc(titel)+'</h1><p style="color:#B3A9C4">'+esc(text)+'</p><p><a style="color:#A78BFA" href="'+(window.Weg?Weg.heim():'landing.html')+'">Weiter</a></p></main>';
    document.body.style.margin='0';
  }
  // Für Spiel und Vorausgeher: ?k=… holen, im Gerät ablegen, Seite ohne Schlüssel neu laden. true = Seite wartet.
  function einloesen(thema){
    var q=new URLSearchParams(location.search), k=q.get('k');
    if(!k) return false;
    if(!aktiv()){ meldung('Link geht hier nicht', 'Dieser Link braucht den Server, der ist auf dieser Seite nicht eingerichtet.'); return true; }
    meldung('Einen Moment …', 'Die Tour wird geladen.');
    linkLesen(k).then(function(r){
      if(!r || (r.rolle!=='spiel' && r.rolle!=='vorausgeher') || !r.daten || r.daten.thema!==thema){
        meldung('Dieser Link geht nicht mehr', 'Er wurde ersetzt oder die Party ist vorbei. Bitte die Eltern um einen neuen Link.'); return; }
      Party.ausLinkUebernehmen(thema, r.daten);
      schreib('sj.link.'+thema, {k:k, rolle:r.rolle});         // für die Live-Haken des Vorausgehers
      q.delete('k'); location.replace(location.pathname+'?'+q.toString()+location.hash);
    }, function(){ meldung('Kein Netz', 'Zum ersten Öffnen braucht der Link Internet. Danach geht die Tour auch ohne.'); });
    return true;
  }

  // ---------- Vorausgeher live: Haken „Station steht“ ----------
  // Schreiben nur mit Vorausgeher-Link; lesen mit Vorausgeher- oder iPad-Link, Eltern über ihren eigenen iPad-Schlüssel.
  function linkRolle(thema){ var l=lies('sj.link.'+thema); return aktiv() && l && l.k ? l.rolle : null; }
  function aufbauSchluessel(thema){
    var l=lies('sj.link.'+thema); if(l && l.k) return l.k;
    var p=root.Party && Party.lesen(thema); return (p && p.server && p.server.k && p.server.k.spiel) || null;
  }
  var offen={}, wiederUhr={};
  function aufbauSenden(thema){
    var st=offen[thema], l=lies('sj.link.'+thema); if(!st || !l) return;
    clearTimeout(wiederUhr[thema]);
    anfrage('/rest/v1/rpc/aufbau_setzen', {method:'POST', body:{t:l.k, stationen:st}}).then(function(r){
      if(offen[thema]===st) delete offen[thema];
      melden({art:r?'aufbau-gesendet':'aufbau-abgelehnt', thema:thema});
    }, function(){ melden({art:'aufbau-wartet', thema:thema}); wiederUhr[thema]=setTimeout(function(){ aufbauSenden(thema); }, 20000); });
  }
  function aufbauMelden(thema, aufgebaut){
    if(linkRolle(thema)!=='vorausgeher') return false;
    var st={}; Object.keys(aufgebaut||{}).forEach(function(i){ if(aufgebaut[i]) st[i]=true; });
    offen[thema]=st; aufbauSenden(thema); return true;
  }
  root.addEventListener('online', function(){ Object.keys(offen).forEach(aufbauSenden); });
  function aufbauLesen(thema){
    var t=aufbauSchluessel(thema); if(!aktiv() || !t) return Promise.resolve(null);
    return anfrage('/rest/v1/rpc/aufbau_lesen', {method:'POST', body:{t:t}});
  }
  // Alle ms Millisekunden nachsehen, solange die Seite sichtbar ist. cb bekommt {stationen, aktualisiert}.
  function aufbauBeobachten(thema, cb, ms){
    if(!aktiv() || !aufbauSchluessel(thema)) return function(){};
    var uhr=null, aus=false;
    function holen(){ if(aus) return; if(document.visibilityState==='hidden'){ uhr=setTimeout(holen, ms); return; }
      aufbauLesen(thema).then(function(r){ if(r) cb(r); }, function(){}).then(function(){ if(!aus) uhr=setTimeout(holen, ms); }); }
    document.addEventListener('visibilitychange', function(){ if(document.visibilityState==='visible' && !aus){ clearTimeout(uhr); holen(); } });
    holen();
    return function(){ aus=true; clearTimeout(uhr); };
  }

  // ---------- Funkel kennt das Kind: Namens-Sätze (Edge Function „namen“) ----------
  function namenAnfrage(body, mitAnmeldung){
    var los=function(t){ return anfrage('/functions/v1/namen', {method:'POST', token:t, body:body}); };
    return mitAnmeldung ? token().then(los) : los(null);
  }
  function partyId(thema){ var p=root.Party && Party.lesen(thema); return p && p.server && p.server.id; }
  function namenStand(thema){
    var id=partyId(thema); if(!angemeldet() || !id) return Promise.resolve(null);
    return sync(thema)['catch'](function(){}).then(function(){ return namenAnfrage({aktion:'stand', party_id:id}, true); });
  }
  function namenErzeugen(thema, name, aussprache, alter){
    var id=partyId(thema); if(!angemeldet() || !id) return Promise.reject(new Error('Bitte zuerst speichern.'));
    return sync(thema)['catch'](function(){}).then(function(){ return namenAnfrage({aktion:'erzeugen', party_id:id, name:name, aussprache:aussprache, alter:alter}, true); });
  }
  // Fürs Spiel: Sätze mit dem iPad-Schlüssel holen (eigener Link oder der Schlüssel der eigenen Party)
  function namenHolen(thema, hash){
    var l=lies('sj.link.'+thema), p=root.Party && Party.lesen(thema);
    var t=(l && l.k && l.rolle==='spiel') ? l.k : (p && p.server && p.server.k && p.server.k.spiel);
    if(!aktiv() || !t) return Promise.resolve(null);
    return namenAnfrage({aktion:'holen', t:t, hash:hash||undefined}, false);
  }

  // ---------- Nach der Party: Rückmeldung der Gast-Eltern ----------
  function feedbackGeben(k, wert){ return anfrage('/rest/v1/rpc/feedback_geben', {method:'POST', body:{t:k, wert:wert}}); }
  function feedbackLesen(thema){
    var id=partyId(thema); if(!angemeldet() || !id) return Promise.resolve(null);
    return token().then(function(t){ return anfrage('/rest/v1/feedback?select=wert&party_id=eq.'+id, {token:t}); });
  }

  // ---------- Gästeliste (UNICORN-29): Zu- und Absagen über den Einladungs-Link ----------
  // Gäste schreiben mit dem Schlüssel des Einladungs-Links (ohne Konto), lesen und entfernen dürfen nur die Eltern der Party.
  function antwortGeben(k, kennung, name, kommt){ return anfrage('/rest/v1/rpc/antwort_geben', {method:'POST', body:{t:k, k:kennung, n:name, ja:!!kommt}}); }
  function einladungGesehen(k){ return anfrage('/rest/v1/rpc/einladung_gesehen', {method:'POST', body:{t:k}}); }
  function gaesteGemerkt(thema){ var g=lies('sj.gaeste.'+thema), id=partyId(thema); return g && id && g.id===id && angemeldet() ? g : null; }
  function gaeste(thema){
    var id=partyId(thema); if(!angemeldet() || !id) return Promise.resolve(null);
    return token().then(function(t){ return Promise.all([
      anfrage('/rest/v1/antworten?select=kennung,name,kommt,geaendert&party_id=eq.'+id+'&order=geaendert.asc', {token:t}),
      anfrage('/rest/v1/links?select=geoeffnet&rolle=eq.gast&party_id=eq.'+id, {token:t})]);
    }).then(function(r){
      var l=(r[0]||[]).map(function(x){ return {kennung:String(x.kennung), name:String(x.name||''), kommt:!!x.kommt}; });
      var g={id:id, liste:l, ja:l.filter(function(x){ return x.kommt; }).length, nein:l.filter(function(x){ return !x.kommt; }).length,
        geoeffnet:(r[1] && r[1][0] && +r[1][0].geoeffnet)||0, zeit:Date.now()};
      schreib('sj.gaeste.'+thema, g); return g;
    });
  }
  function gastEntfernen(thema, kennung){
    var id=partyId(thema); if(!angemeldet() || !id) return Promise.reject(new Error('nicht angemeldet'));
    return token().then(function(t){ return anfrage('/rest/v1/antworten?party_id=eq.'+id+'&kennung=eq.'+encodeURIComponent(kennung), {method:'DELETE', token:t}); }).then(function(){ return gaeste(thema); });
  }
  function gaesteKurz(g){ if(!g) return ''; var t=[]; if(g.ja) t.push(g.ja+(g.ja===1?' Zusage':' Zusagen')); if(g.nein) t.push(g.nein+(g.nein===1?' Absage':' Absagen')); return t.join(' · '); }
  function gaesteZeile(g){ return !g ? 'Lädt …' : (gaesteKurz(g)||'Noch keine Antwort')+' · '+(g.geoeffnet ? 'Einladung '+g.geoeffnet+'-mal geöffnet' : 'Einladung noch nicht geöffnet'); }
  function gaesteVergessen(){ try{ for(var i=localStorage.length-1;i>=0;i--){ var k=localStorage.key(i); if(/^sj\.gaeste\./.test(k)) localStorage.removeItem(k); } }catch(e){} }

  // ---------- Oberfläche: Karte in der Party-Übersicht und Anmelde-Fenster ----------
  var STIL='.konto-dlg button{font:inherit;font-weight:700;border-radius:999px;padding:11px 18px;min-height:44px;cursor:pointer;border:0;background:var(--akzent,#7C5BD6);color:#fff}'+
    '.konto-dlg button.leer{background:transparent;color:inherit;border:1px solid var(--linie,#2F2740)}'+
    '.konto-dlg button:disabled{opacity:.6}'+
    '.konto{background:var(--karte,#1F1929);border:1px solid var(--linie,#2F2740);border-radius:16px;padding:16px 18px;margin:0 0 14px}'+
    '.konto p{margin:6px 0 12px;color:var(--leise,#B3A9C4);font-size:.95rem}.konto .zeile{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 0;border-top:1px solid var(--linie,#2F2740)}'+
    '.konto .stand{font-size:.85rem;color:var(--leise,#B3A9C4)}.konto .stand.gut{color:var(--gruen,#4ADE80)}.konto .stand.schlecht{color:var(--rot,#F87171)}.konto summary{cursor:pointer;color:var(--akzent,#A78BFA);font-weight:700;margin-top:6px}'+
    'dialog.konto-dlg{border:0;border-radius:24px;padding:26px 22px 20px;max-width:25rem;width:calc(100% - 32px);color:var(--text,#F5F2FA);'+
      'background:radial-gradient(120% 70% at 50% -10%,rgba(167,139,250,.28),rgba(167,139,250,0) 60%),var(--panel,#17121F);box-shadow:0 30px 80px rgba(0,0,0,.55),inset 0 0 0 1px rgba(167,139,250,.18)}'+
    'dialog.konto-dlg[open]{animation:kd-rein .38s cubic-bezier(.2,1.3,.4,1)}dialog.konto-dlg::backdrop{background:rgba(8,5,16,.66);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px)}'+
    '@keyframes kd-rein{from{transform:translateY(24px) scale(.97);opacity:0}to{transform:none;opacity:1}}'+
    '@media (max-width:599px){dialog.konto-dlg{margin:auto auto 0;width:100%;max-width:100%;border-radius:26px 26px 0 0;padding-bottom:calc(22px + env(safe-area-inset-bottom))}@keyframes kd-rein{from{transform:translateY(100%)}to{transform:none}}}'+
    '@media (prefers-reduced-motion:reduce){dialog.konto-dlg[open]{animation:none}}'+
    '.kd-held{width:88px;height:88px;margin:-6px auto 10px;border-radius:50%;display:grid;place-items:center;background:radial-gradient(circle,rgba(167,139,250,.45),rgba(167,139,250,0) 70%)}'+
    '.kd-held img{width:76px;height:76px;object-fit:contain;animation:kd-schweb 3.2s ease-in-out infinite}@keyframes kd-schweb{50%{transform:translateY(-4px) rotate(-3deg)}}'+
    '.konto-dlg h2{margin:0 0 6px;font-size:1.45rem;text-align:center;line-height:1.2}.konto-dlg .unter{color:var(--leise,#B3A9C4);margin:0 0 16px;text-align:center}'+
    '.kd-vorteile{list-style:none;margin:0 0 18px;padding:0;display:grid;gap:10px}'+
    '.kd-vorteile li{display:grid;grid-template-columns:38px 1fr;gap:12px;align-items:center;background:rgba(255,255,255,.035);border:1px solid var(--linie,#2F2740);border-radius:14px;padding:10px 12px}'+
    '.kd-vorteile .ic{width:38px;height:38px;border-radius:11px;display:grid;place-items:center;background:linear-gradient(135deg,#A78BFA,#7C5BD6);color:#fff}'+
    '.kd-vorteile b{display:block;font-size:.98rem}.kd-vorteile small{color:var(--leise,#B3A9C4);font-size:.85rem;line-height:1.35;display:block}'+
    '.konto-dlg input{width:100%;box-sizing:border-box;font:inherit;font-size:1.1rem;padding:14px 16px;border-radius:14px;border:1.5px solid var(--linie,#2F2740);background:var(--karte,#1F1929);color:inherit;margin:0 0 10px;transition:border-color .2s,box-shadow .2s}'+
    '.konto-dlg input:focus{outline:none;border-color:var(--akzent,#A78BFA);box-shadow:0 0 0 4px rgba(167,139,250,.22)}'+
    '.konto-dlg input.code{letter-spacing:.45em;text-align:center;font-size:2rem;font-weight:800;padding:14px 8px 14px 20px;font-variant-numeric:tabular-nums}'+
    '.konto-dlg .fehler{color:var(--rot,#F87171);min-height:1.2em;margin:0 0 8px;font-size:.92rem;text-align:center}'+
    '.konto-dlg .los{width:100%;padding:15px 18px;font-size:1.05rem;background:linear-gradient(135deg,#B79CFF,#7C5BD6);box-shadow:0 10px 26px rgba(124,91,214,.45)}'+
    '.konto-dlg .neben{display:block;margin:12px auto 0;background:none;color:var(--leise,#B3A9C4);font-weight:600;min-height:40px;padding:8px 14px}'+
    '.konto-dlg .mail{display:inline-block;background:rgba(167,139,250,.14);color:var(--text,#F5F2FA);border-radius:999px;padding:3px 10px;font-weight:700}'+
    '.kd-fertig{text-align:center;padding:10px 0 6px}.kd-fertig .haken{width:72px;height:72px;margin:0 auto 12px;border-radius:50%;display:grid;place-items:center;background:linear-gradient(135deg,#4ADE80,#16A34A);color:#fff;animation:kd-plopp .5s cubic-bezier(.2,1.6,.4,1)}'+
    '@keyframes kd-plopp{from{transform:scale(.3);opacity:0}}'+
    '.konto-dlg .kd-zu{position:absolute;top:12px;right:12px;width:44px;height:44px;padding:0;background:none;color:var(--leise,#B3A9C4);font-size:1.7rem;line-height:1;font-weight:400}'+
    '.mb h2{text-align:left;margin:0 44px 8px 0}.mb h3{font-size:.78rem;text-transform:uppercase;letter-spacing:.05em;color:var(--leise,#B3A9C4);margin:20px 0 8px}'+
    '.mb p{margin:0 0 10px;color:var(--leise,#B3A9C4);font-size:.95rem;line-height:1.4}'+
    '.mb-zeile{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:54px;margin:0 0 8px;padding:10px 14px;border-radius:14px;background:rgba(255,255,255,.04);border:1px solid var(--linie,#2F2740);color:inherit;text-decoration:none}'+
    '.mb-zeile b{display:block}.mb-zeile small{display:block;color:var(--leise,#B3A9C4);font-size:.86rem;line-height:1.3}'+
    '.mb-zeile .pf{width:9px;height:9px;flex:0 0 auto;border-right:2px solid var(--leise,#B3A9C4);border-top:2px solid var(--leise,#B3A9C4);transform:rotate(45deg);margin-right:4px}'+
    '.konto-dlg .mb-klein{padding:7px 13px;min-height:38px;font-size:.88rem;flex:0 0 auto}'+
    '.mb .mb-fuss{margin:18px 0 0;text-align:center;font-size:.85rem}.mb-fuss a{color:var(--leise,#B3A9C4)}';
  function stilEinmal(){ if(document.getElementById('konto-stil')) return; var s=document.createElement('style'); s.id='konto-stil'; s.textContent=STIL; document.head.appendChild(s); }
  var aktuellesThema=null;
  function karte(thema){
    if(!aktiv()) return '';
    stilEinmal(); aktuellesThema=thema;
    var s=sitzung(), p=root.Party&&Party.lesen(thema), z=zustand[thema];
    if(!s || !p || !p.server) return '<div class="konto" id="konto-karte"><b>Noch nicht gespeichert</b>'+
      '<p>Die Party liegt nur auf diesem Gerät. Zum Teilen speichern wir sie geschützt: Nur wer einen Link von euch bekommt, sieht Treffpunkt oder Route. Gast-Eltern brauchen kein Konto.</p>'+
      '<button type="button" class="knopf mittel" data-konto="anmelden">Speichern und teilen</button></div>';
    var st=z==='speichert'?'<span class="stand">Speichert …</span>':z==='fehler'?'<span class="stand schlecht">Nicht gespeichert, kein Netz?</span>':'<span class="stand gut">Gespeichert</span>';
    function zeile(r, n){ return '<div class="zeile"><span>'+n+'</span><button type="button" class="knopf klein leer" data-konto-neu="'+r+'">Neuer Link</button></div>'; }
    return '<div class="konto" id="konto-karte"><div class="zeile" style="border:0;padding-top:0"><b>Geschützt gespeichert</b>'+st+'</div>'+
      '<p>Angemeldet als '+esc(s.email)+'. Jeder Link zeigt nur, was er braucht: die Einladung Termin und Treffpunkt, Vorausgeher und iPad die Route. 30 Tage nach der Party wird alles gelöscht.</p>'+
      '<details><summary>Link sperren</summary><p>Ein neuer Link ersetzt den alten, der geht dann nicht mehr. Den neuen noch einmal schicken.</p>'+
      zeile('gast','Einladung')+zeile('vorausgeher','Vorausgeher')+zeile('spiel','iPad')+'</details>'+
      '<div class="reihe" style="margin-top:12px"><button type="button" class="knopf klein leer" data-konto="abmelden">Abmelden</button></div></div>';
  }
  function zeichnen(thema){ var e=document.getElementById('konto-karte'); if(e && thema===aktuellesThema){ var d=document.createElement('div'); d.innerHTML=karte(thema); e.replaceWith(d.firstChild); } }
  function melden(t){ try{ root.dispatchEvent(new CustomEvent('konto', {detail:t})); }catch(e){} }

  var dlg=null;
  function fenster(thema, opt){
    opt=opt||{}; bereichOffen=false;
    stilEinmal(); aktuellesThema=thema;
    if(!dlg){ dlg=document.createElement('dialog'); dlg.className='konto-dlg'; document.body.appendChild(dlg); }
    var email=(sitzung()&&sitzung().email)||lies('sj.konto.email')||'';
    var IC={schloss:'<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="10.5" width="16" height="10.5" rx="2.5"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/></svg>',
      teilen:'<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="6.5" y="2.5" width="11" height="19" rx="2.5"/><path d="M10.5 18h3"/></svg>',
      brief:'<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="m4 7 8 6 8-6"/></svg>',
      haken:'<svg viewBox="0 0 24 24" width="38" height="38" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>'};
    var held=thema==='einhorn' ? '<div class="kd-held"><img alt="" src="themen/einhorn/figuren/funkel.svg"></div>' : '';
    function schritt1(fehler){
      dlg.innerHTML='<form method="dialog" id="kd1">'+held+'<h2>'+esc(opt.titel||'Party speichern und teilen')+'</h2>'+
        '<p class="unter">'+esc(opt.text||'Einmal anmelden, dann kann es losgehen.')+'</p>'+
        '<ul class="kd-vorteile">'+
          '<li><span class="ic">'+IC.schloss+'</span><span><b>Eure Tour ist geschützt</b><small>Route und Treffpunkt sieht nur, wer euren Link hat.</small></span></li>'+
          '<li><span class="ic">'+IC.teilen+'</span><span><b>Links für iPad und Gäste</b><small>Die brauchen kein Konto, ein Tipp auf den Link reicht.</small></span></li>'+
          '<li><span class="ic">'+IC.brief+'</span><span><b>Code statt Passwort</b><small>Wir schicken dir einen Code per E-Mail.</small></span></li></ul>'+
        '<input type="email" id="kd-mail" autocomplete="email" inputmode="email" placeholder="deine@email.de" aria-label="E-Mail-Adresse" required value="'+esc(email)+'">'+
        '<div class="fehler" id="kd-f">'+esc(fehler||'')+'</div>'+
        '<button class="los" id="kd-los" type="submit">Code schicken</button><button class="neben" type="button" id="kd-zu">Später</button></form>';
      dlg.querySelector('#kd-zu').onclick=function(){ dlg.close(); };
      dlg.querySelector('#kd1').onsubmit=function(ev){ ev.preventDefault();
        var m=dlg.querySelector('#kd-mail').value.trim(), b=dlg.querySelector('#kd-los');
        if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(m)){ dlg.querySelector('#kd-f').textContent='Bitte eine E-Mail-Adresse eingeben.'; return; }
        b.disabled=true; b.textContent='Schickt …'; email=m; schreib('sj.konto.email', m);
        codeSchicken(m).then(function(){ schritt2(); }, function(e){ b.disabled=false; b.textContent='Code schicken';
          if(technisch(e)){ stoerung(e); return; }
          dlg.querySelector('#kd-f').textContent='Das ging nicht. Bitte die E-Mail-Adresse prüfen.'; });
      };
      setTimeout(function(){ var i=dlg.querySelector('#kd-mail'); if(i && !i.value) i.focus(); }, 60);
    }
    function schritt2(fehler){
      dlg.innerHTML='<form method="dialog" id="kd2"><div class="kd-held" style="width:72px;height:72px"><span class="ic" style="color:#fff">'+IC.brief.replace(/20/g,'34')+'</span></div><h2>Code eingeben</h2>'+
        '<p class="unter">Gerade an <span class="mail">'+esc(email)+'</span> geschickt.<br>Nichts da? Schau im Spam-Ordner nach.</p>'+
        '<input class="code" id="kd-code" inputmode="numeric" autocomplete="one-time-code" maxlength="10" placeholder="Code" aria-label="Code aus der E-Mail" required>'+
        '<div class="fehler" id="kd-f">'+esc(fehler||'')+'</div>'+
        '<button class="los" id="kd-ok" type="submit">Anmelden</button><button class="neben" type="button" id="kd-zurueck">Andere E-Mail</button></form>';
      dlg.querySelector('#kd-zurueck').onclick=function(){ schritt1(); };
      var feld=dlg.querySelector('#kd-code');
      var warte=null;   // Code-Länge kann 6 bis 10 Ziffern sein: nach kurzer Tipp-Pause selbst prüfen
      feld.addEventListener('input', function(){ var c=feld.value.replace(/\D/g,''); if(c!==feld.value) feld.value=c; clearTimeout(warte);
        if(c.length>=6 && !feld.dataset.los) warte=setTimeout(function(){ feld.dataset.los='1'; dlg.querySelector('#kd2').requestSubmit ? dlg.querySelector('#kd2').requestSubmit() : dlg.querySelector('#kd-ok').click(); }, c.length>=10?0:900); });
      dlg.querySelector('#kd2').onsubmit=function(ev){ ev.preventDefault();
        var c=feld.value.replace(/\D/g,''), b=dlg.querySelector('#kd-ok');
        if(c.length<6){ dlg.querySelector('#kd-f').textContent='Der Code hat mindestens 6 Ziffern.'; return; }
        b.disabled=true; b.textContent='Prüft …';
        codePruefen(email, c).then(function(){ return angemeldetWeiter(thema); }).then(function(){ fertig(); },
          function(e){ b.disabled=false; b.textContent='Anmelden'; delete feld.dataset.los;
            if(!(e.status===400||e.status===401||e.status===403) && technisch(e)){ stoerung(e); return; }
            dlg.querySelector('#kd-f').textContent='Der Code stimmt nicht oder ist abgelaufen.'; });
      };
      setTimeout(function(){ feld.focus(); }, 60);
    }
    function stoerung(e){
      try{ if(root.FehlerMelden) root.FehlerMelden('Anmeldung gestört: '+((e&&e.status)||'kein Netz')+' '+((e&&(e.code||e.message))||''), 'konto.js'); }catch(x){}
      dlg.innerHTML='<div class="kd-fertig">'+held+'<h2>Die Anmeldung klemmt gerade</h2>'+
        '<p class="unter">Kein Problem: Es geht auch ohne. Eure Daten stecken dann direkt im Link. Später könnt ihr euch noch anmelden.</p>'+
        '<button class="los" id="kd-ohne" type="button">Ohne Anmeldung weiter</button><button class="neben" type="button" id="kd-nochmal">Noch mal versuchen</button></div>';
      dlg.querySelector('#kd-nochmal').onclick=function(){ schritt1(); };
      dlg.querySelector('#kd-ohne').onclick=function(){ schreib(NOTWEG, Date.now()); dlg.close(); melden({art:'notweg', thema:thema}); if(opt.weiter) opt.weiter(); };
    }
    function fertig(){
      dlg.innerHTML='<div class="kd-fertig"><div class="haken">'+IC.haken+'</div><h2>Geschafft!</h2><p class="unter" style="margin:0">'+esc(opt.fertig||'Eure Party ist gesichert.')+'</p></div>';
      setTimeout(function(){ if(dlg.open) dlg.close(); }, 1400);
    }
    schritt1();
    if(!dlg.open) dlg.showModal();
  }
  function angemeldetWeiter(thema){
    return holen()['catch'](function(){ return 0; }).then(function(n){ return sync(thema, true).then(function(){ return n; }, function(){ return n; }); })
      .then(function(n){ zeichnen(thema); melden({art:'angemeldet', thema:thema, geholt:n}); });
  }

  // ---------- Mein Bereich (UNICORN-28): das Profil für ein Konto auf Zeit ----------
  // Kein Platz für Einstellungen, denn es gibt nichts einzustellen. Gezeigt wird, was Eltern an einer Stelle sehen wollen:
  // Bin ich angemeldet? Meine Party. Wer kommt? Wer hat welchen Link? Was ist gespeichert und wie lange?
  var bereichOffen=false;
  function bereich(thema){
    stilEinmal(); aktuellesThema=thema;
    if(!dlg){ dlg=document.createElement('dialog'); dlg.className='konto-dlg'; document.body.appendChild(dlg); }
    if(!dlg.__mb){ dlg.__mb=true;
      dlg.addEventListener('close', function(){ bereichOffen=false; });
      dlg.addEventListener('click', function(ev){
        if(!bereichOffen) return;
        var r=dlg.getBoundingClientRect(), draussen=ev.target===dlg && (ev.clientX<r.left || ev.clientX>r.right || ev.clientY<r.top || ev.clientY>r.bottom);
        if(draussen || ev.target.closest('[data-mb="zu"]') || ev.target.closest('a')) dlg.close();
      });
    }
    var s=sitzung(), p=root.Party&&Party.lesen(thema), gesichert=!!(s && p && p.server && p.server.id), g=gaesteGemerkt(thema);
    var h='<div class="mb"><button class="kd-zu" type="button" data-mb="zu" aria-label="Schließen">×</button><h2>Mein Bereich</h2>';
    if(!aktiv()) h+='<p>Hier läuft Schatzweg ohne Anmeldung. Alles bleibt auf diesem Gerät.</p>';
    else if(s) h+='<p>Angemeldet als <span class="mail">'+esc(s.email)+'</span></p>'+(p && !gesichert ? '<p>Eure Party liegt noch nur auf diesem Gerät.</p><button class="los" type="button" data-konto="anmelden">Party sichern</button>' : '');
    else h+='<p>'+(p ? 'Ihr seid nicht angemeldet, eure Party liegt nur auf diesem Gerät. Mit Anmeldung ist sie gesichert, und ihr könnt Einladung und Links teilen.'
                    : 'Zum Ausprobieren braucht ihr kein Konto. Schon eine Party auf einem anderen Gerät? Meldet euch an, dann holen wir sie hierher.')+'</p>'+
      '<button class="los" type="button" data-konto="anmelden">'+(p?'Anmelden und sichern':'Anmelden')+'</button>';
    if(p){
      var d=Party.datum(p), n=p.kind&&p.kind.name ? p.kind.name+(/[sßxz]$/i.test(p.kind.name)?'’':'s')+' Party' : 'Eure Party';
      h+='<h3>Eure Party</h3><a class="mb-zeile" href="party.html?thema='+thema+'"><span><b>'+esc(n)+'</b><small>'+esc(Party.datumText(d))+', '+esc(p.start)+' Uhr</small></span><span class="pf"></span></a>';
      if(gesichert){
        h+='<a class="mb-zeile" href="party.html?thema='+thema+'#einladung"><span><b>Gäste</b><small id="mb-gaeste">'+esc(gaesteZeile(g))+'</small></span><span class="pf"></span></a>'+
          '<h3>Links</h3><p>Jeder Link zeigt nur, was er braucht. Ein neuer Link sperrt den alten.</p>'+
          [['gast','Einladung','für die Gast-Eltern, ohne Route'],['vorausgeher','Vorausgeher','Route und Stationen'],['spiel','iPad','die ganze Tour']].map(function(z){
            return '<div class="mb-zeile"><span><b>'+z[1]+'</b><small>'+z[2]+'</small></span><button type="button" class="leer mb-klein" data-konto-neu="'+z[0]+'">Neuer Link</button></div>'; }).join('');
      }
      var weg=new Date(d.getTime()+30*864e5).toLocaleDateString('de-DE',{day:'numeric', month:'long'});
      h+='<h3>Eure Daten</h3><p>'+(gesichert ? 'Ein Konto auf Zeit: Am '+esc(weg)+', 30 Tage nach der Party, löschen wir alles von selbst. Früher geht es in der Party mit „Party löschen“.'
                                           : 'Ohne Anmeldung bleibt eure Party nur auf diesem Gerät.')+'</p>';
    }
    h+=(s?'<button type="button" class="leer" data-konto="abmelden">Abmelden</button>':'')+
      '<p class="mb-fuss"><a href="impressum.html">Impressum</a> · <a href="datenschutz.html">Datenschutz</a></p></div>';
    dlg.innerHTML=h; bereichOffen=true;
    if(!dlg.open) dlg.showModal();
    if(gesichert) gaeste(thema).then(function(neu){ var e=document.getElementById('mb-gaeste'); if(e && neu) e.textContent=gaesteZeile(neu); }, function(){});
  }
  root.addEventListener('konto', function(ev){
    if(bereichOffen && dlg && dlg.open && ev.detail && /^(angemeldet|abgemeldet|neuer-link)$/.test(ev.detail.art||'')) bereich(ev.detail.thema||aktuellesThema);
  });

  // Vor dem Teilen: ohne Server sofort weiter; mit Server erst anmelden und speichern.
  function bereit(thema, weiter){
    if(!aktiv()){ weiter(); return; }
    var p=root.Party&&Party.lesen(thema);
    if(angemeldet() && p && p.server && p.server.k){ sync(thema)['catch'](function(){}); weiter(); return; }
    if(angemeldet()){ angemeldetWeiter(thema); return; }
    fenster(thema, {weiter:weiter});
  }

  document.addEventListener('click', function(ev){
    var b=ev.target.closest && ev.target.closest('[data-konto],[data-konto-neu]'); if(!b) return;
    var th=aktuellesThema; if(!th) return;
    var a=b.getAttribute('data-konto');
    if(a==='anmelden'){ bereit(th, function(){}); return; }
    if(a==='abmelden'){ if(confirm('Abmelden? Die Party bleibt auf diesem Gerät und auf dem Server.')){ abmelden(); zeichnen(th); melden({art:'abgemeldet', thema:th}); } return; }
    var r=b.getAttribute('data-konto-neu');
    if(r && confirm('Neuen Link erzeugen? Der alte geht dann nicht mehr.')){
      b.disabled=true; neuerLink(th, r).then(function(){ melden({art:'neuer-link', thema:th, rolle:r}); }, function(){ b.disabled=false; melden({art:'fehler', thema:th}); });
    }
  });

  var mailLink=null;
  try{ mailLink=linkAusMail(); }catch(e){}

  root.Konto={notweg:notweg, mkMelden:mkMelden, aktiv:aktiv, angemeldet:angemeldet, sitzung:sitzung, bereit:bereit, sync:sync, merken:merken, holen:holen, neuerLink:neuerLink,
    serverLoeschen:serverLoeschen, linkLesen:linkLesen, einloesen:einloesen, karte:karte, fenster:fenster, abmelden:abmelden,
    feedbackGeben:feedbackGeben, feedbackLesen:feedbackLesen, bereich:bereich,
    antwortGeben:antwortGeben, einladungGesehen:einladungGesehen, gaeste:gaeste, gaesteGemerkt:gaesteGemerkt, gastEntfernen:gastEntfernen, gaesteKurz:gaesteKurz, gaesteZeile:gaesteZeile,
    namenStand:namenStand, namenErzeugen:namenErzeugen, namenHolen:namenHolen,
    linkRolle:linkRolle, aufbauMelden:aufbauMelden, aufbauLesen:aufbauLesen, aufbauBeobachten:aufbauBeobachten,
    codeSchicken:codeSchicken, codePruefen:codePruefen, nachMailLink:function(thema){ return mailLink ? mailLink.then(function(){ return angemeldetWeiter(thema); }) : null; }};
})(this);
