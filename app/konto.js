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
  function aktiv(){ return !!(SUPABASE_URL && SUPABASE_KEY); }
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
    return anfrage('/auth/v1/verify', {method:'POST', body:{type:'email', email:email, token:code}}).then(function(j){ return sitzungMerken(j, email); });
  }
  function abmelden(){
    var s=sitzung(); schreib(SITZUNG, null);
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
    schreib('sj.konto.stand.'+thema, null);
    return token().then(function(t){ return anfrage('/rest/v1/parties?id=eq.'+p.server.id, {method:'DELETE', token:t}); })['catch'](function(){});
  }

  // ---------- Links einlösen (Gäste, Vorausgeher, iPad: ohne Konto) ----------
  function linkLesen(k){
    if(!aktiv() || !/^[A-Za-z0-9_-]{22,64}$/.test(k||'')) return Promise.resolve(null);
    return anfrage('/rest/v1/rpc/link_lesen', {method:'POST', body:{t:k}});
  }
  function meldung(titel, text){
    document.body.innerHTML='<main style="font:19px/1.45 system-ui,sans-serif;padding:32px;max-width:32rem;margin:auto;color:#F5F2FA;background:#0F0B17;min-height:100vh;box-sizing:border-box">'+
      '<h1 style="font-size:1.5rem">'+esc(titel)+'</h1><p style="color:#B3A9C4">'+esc(text)+'</p><p><a style="color:#A78BFA" href="index.html">Zur Übersicht</a></p></main>';
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

  // ---------- Oberfläche: Karte in der Party-Übersicht und Anmelde-Fenster ----------
  var STIL='.konto{background:var(--karte,#1F1929);border:1px solid var(--linie,#2F2740);border-radius:16px;padding:16px 18px;margin:0 0 14px}'+
    '.konto p{margin:6px 0 12px;color:var(--leise,#B3A9C4);font-size:.95rem}.konto .zeile{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 0;border-top:1px solid var(--linie,#2F2740)}'+
    '.konto .stand{font-size:.85rem;color:var(--leise,#B3A9C4)}.konto .stand.gut{color:var(--gruen,#4ADE80)}.konto .stand.schlecht{color:var(--rot,#F87171)}.konto summary{cursor:pointer;color:var(--akzent,#A78BFA);font-weight:700;margin-top:6px}'+
    'dialog.konto-dlg{border:0;border-radius:20px;padding:22px;max-width:26rem;width:calc(100% - 32px);background:var(--panel,#17121F);color:var(--text,#F5F2FA)}dialog.konto-dlg::backdrop{background:rgba(0,0,0,.6)}'+
    '.konto-dlg h2{margin:0 0 8px;font-size:1.3rem}.konto-dlg p{color:var(--leise,#B3A9C4);margin:0 0 14px}.konto-dlg input{width:100%;box-sizing:border-box;font:inherit;font-size:1.1rem;padding:12px 14px;border-radius:12px;border:1.5px solid var(--linie,#2F2740);background:var(--karte,#1F1929);color:inherit;margin:0 0 12px}'+
    '.konto-dlg input.code{letter-spacing:.3em;text-align:center;font-size:1.4rem}.konto-dlg .fehler{color:var(--rot,#F87171);min-height:1.2em;margin:-4px 0 10px;font-size:.92rem}.konto-dlg .reihe{display:flex;gap:10px;flex-wrap:wrap}';
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
  function fenster(thema){
    stilEinmal(); aktuellesThema=thema;
    if(!dlg){ dlg=document.createElement('dialog'); dlg.className='konto-dlg'; document.body.appendChild(dlg); }
    var email=(sitzung()&&sitzung().email)||lies('sj.konto.email')||'';
    function schritt1(fehler){
      dlg.innerHTML='<form method="dialog" id="kd1"><h2>Party speichern und teilen</h2>'+
        '<p>Wir schicken dir einen Code per E-Mail. Kein Passwort. Deine Gäste brauchen kein Konto.</p>'+
        '<input type="email" id="kd-mail" autocomplete="email" inputmode="email" placeholder="deine@email.de" required value="'+esc(email)+'">'+
        '<div class="fehler" id="kd-f">'+esc(fehler||'')+'</div>'+
        '<div class="reihe"><button class="knopf mittel" id="kd-los" type="submit">Code schicken</button><button class="knopf leer mittel" type="button" id="kd-zu">Später</button></div></form>';
      dlg.querySelector('#kd-zu').onclick=function(){ dlg.close(); };
      dlg.querySelector('#kd1').onsubmit=function(ev){ ev.preventDefault();
        var m=dlg.querySelector('#kd-mail').value.trim(), b=dlg.querySelector('#kd-los');
        if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(m)){ dlg.querySelector('#kd-f').textContent='Bitte eine E-Mail-Adresse eingeben.'; return; }
        b.disabled=true; b.textContent='Schickt …'; email=m; schreib('sj.konto.email', m);
        codeSchicken(m).then(function(){ schritt2(); }, function(e){ b.disabled=false; b.textContent='Code schicken';
          dlg.querySelector('#kd-f').textContent=e.status===429?'Zu viele Versuche. Bitte in ein paar Minuten noch mal.':'Das ging nicht. Ist das Internet an?'; });
      };
      setTimeout(function(){ var i=dlg.querySelector('#kd-mail'); if(i) i.focus(); }, 50);
    }
    function schritt2(fehler){
      dlg.innerHTML='<form method="dialog" id="kd2"><h2>Code eingeben</h2><p>Wir haben einen Code an '+esc(email)+' geschickt. Schau auch im Spam-Ordner nach.</p>'+
        '<input class="code" id="kd-code" inputmode="numeric" autocomplete="one-time-code" maxlength="10" placeholder="123456" required>'+
        '<div class="fehler" id="kd-f">'+esc(fehler||'')+'</div>'+
        '<div class="reihe"><button class="knopf mittel" id="kd-ok" type="submit">Anmelden</button><button class="knopf leer mittel" type="button" id="kd-zurueck">Andere E-Mail</button></div></form>';
      dlg.querySelector('#kd-zurueck').onclick=function(){ schritt1(); };
      dlg.querySelector('#kd2').onsubmit=function(ev){ ev.preventDefault();
        var c=dlg.querySelector('#kd-code').value.replace(/\D/g,''), b=dlg.querySelector('#kd-ok');
        if(c.length<6){ dlg.querySelector('#kd-f').textContent='Der Code hat mindestens 6 Ziffern.'; return; }
        b.disabled=true; b.textContent='Prüft …';
        codePruefen(email, c).then(function(){ return angemeldetWeiter(thema); }).then(function(){ dlg.close(); },
          function(e){ b.disabled=false; b.textContent='Anmelden';
            dlg.querySelector('#kd-f').textContent=(e.status===400||e.status===401||e.status===403)?'Der Code stimmt nicht oder ist abgelaufen.':'Das ging nicht. Ist das Internet an?'; });
      };
      setTimeout(function(){ var i=dlg.querySelector('#kd-code'); if(i) i.focus(); }, 50);
    }
    schritt1();
    if(!dlg.open) dlg.showModal();
  }
  function angemeldetWeiter(thema){
    return holen()['catch'](function(){ return 0; }).then(function(n){ return sync(thema, true).then(function(){ return n; }, function(){ return n; }); })
      .then(function(n){ zeichnen(thema); melden({art:'angemeldet', thema:thema, geholt:n}); });
  }

  // Vor dem Teilen: ohne Server sofort weiter; mit Server erst anmelden und speichern.
  function bereit(thema, weiter){
    if(!aktiv()){ weiter(); return; }
    var p=root.Party&&Party.lesen(thema);
    if(angemeldet() && p && p.server && p.server.k){ sync(thema)['catch'](function(){}); weiter(); return; }
    if(angemeldet()){ angemeldetWeiter(thema); return; }
    fenster(thema);
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

  root.Konto={aktiv:aktiv, angemeldet:angemeldet, sitzung:sitzung, bereit:bereit, sync:sync, merken:merken, holen:holen, neuerLink:neuerLink,
    serverLoeschen:serverLoeschen, linkLesen:linkLesen, einloesen:einloesen, karte:karte, fenster:fenster, abmelden:abmelden,
    namenStand:namenStand, namenErzeugen:namenErzeugen, namenHolen:namenHolen,
    linkRolle:linkRolle, aufbauMelden:aufbauMelden, aufbauLesen:aufbauLesen, aufbauBeobachten:aufbauBeobachten,
    codeSchicken:codeSchicken, codePruefen:codePruefen, nachMailLink:function(thema){ return mailLink ? mailLink.then(function(){ return angemeldetWeiter(thema); }) : null; }};
})(this);
