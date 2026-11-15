// Funkel kennt das Kind (UNICORN-8/33/49/50/51/56): eigene Ansicht in der Party-Seite (#namen).
// Funkel erscheint und spricht, darunter der Zeitstrahl der ganzen Tour mit den drei Stellen, an denen er den Namen sagt,
// und je Stelle der ganze gesprochene Text (davor, Namens-Satz, danach). Die Sätze stehen sofort beim Tippen da
// (Vorlagen aus tour.json, namen-kern.js), der Ton kommt vom Server (Edge Function „namen“, Stimmen-Speicher ADR-28).
// Erstes Einsprechen frei, danach 3-mal neu: andere Betonung, andere Worte oder Name/Aussprache ändern.
// Braucht konto.js und namen-kern.js; Funkel in 3D kommt aus ../funkel3d.js (sonst bleibt das Bild stehen).
(function(root){
  'use strict';
  var K=root.NamenKern;
  var thema=null, tour=null, vorlagen=null, stand=null, audio={}, fehler='', laeuft='', alterGeprueft=false;
  // Wo Funkel den Namen sagt, wie im Spiel (spiel.html, akt()): Namens-Satz zwischen zwei fertigen Geschichts-Sätzen
  var MOMENTE=[
    {stelle:'gruss',    ort:'s0',   titel:'An der Haustür',        wann:'Zur Begrüßung',      davor:'s0.a',      danach:'s0.b'},
    {stelle:'schatz',   ort:'ende', titel:'Der Regenbogen ist ganz', wann:'Vor dem Schatz',    davor:'ende.a',    danach:'ende.b', alter:true},
    {stelle:'abschied', ort:'heim', titel:'Wieder zu Hause',        wann:'Zum Abschied',       davor:'heim.ende', danach:null}
  ];
  var BOGEN={lila:'#8B5CF6', rot:'#EF5A6F', gelb:'#F2C94C', gruen:'#3FB950', blau:'#3B82F6'};
  function esc(t){ return String(t==null?'':t).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function $(id){ return document.getElementById(id); }
  function party(){ return root.Party && Party.lesen(thema); }
  function vorname(){ var p=party(); return (p && p.kind && p.kind.name) || ''; }
  function alter(){ var p=party(); return (p && p.kind && p.kind.alter) || null; }
  function wert(id){ var e=$(id); return e ? K.sauber(e.value) : null; }
  function eingabe(){
    var n=wert('namen-name'), a=wert('namen-aussprache');
    return {name:n!=null?n:K.sauber((stand&&stand.name)||vorname()), aussprache:a!=null?a:K.sauber((stand&&stand.aussprache)||'')};
  }
  function angemeldet(){ var p=party(); return !!(root.Konto && Konto.angemeldet() && p && p.server); }
  function gespeichert(){ return !!(stand && stand.texte); }
  function geaendert(){ var e=eingabe(); return gespeichert() && (e.name!==K.sauber(stand.name) || e.aussprache!==K.sauber(stand.aussprache)); }
  function mitTon(){ return gespeichert() && !geaendert() && !!audio.gruss; }

  // Sätze für die Anzeige: gespeicherte, solange nichts geändert ist, sonst sofort aus den Vorlagen
  function saetze(){
    if(gespeichert() && !geaendert()) return stand.texte;
    if(!vorlagen || !K) return null;
    var e=eingabe(); if(!e.name) return null;
    var b=K.bilden(vorlagen, {name:e.name, alter:alter(), wahl:(stand&&stand.wahl)||{}}), t={};
    Object.keys(b).forEach(function(k){ t[k]=b[k].zeigen; });
    return t;
  }
  function anzeigeName(){ var t=gespeichert() && !geaendert() ? K.sauber(stand.name) : eingabe().name; return t || vorname(); }
  // Name im Satz hervorheben (nach dem Escapen, damit nichts aus der Eingabe als HTML landet)
  function mitName(text){
    var h=esc(text), n=esc(anzeigeName());
    return n ? h.split(n).join('<mark>'+n+'</mark>') : h;
  }
  function satzVon(m, t){ return (t[m.stelle]||'')+(m.alter && t.alter ? ' '+t.alter : ''); }
  // Fertige Geschichts-Sätze rund um den Namen (gleiche Schlüssel wie die Stimmen-Pakete)
  function geschichte(k){
    if(!tour) return '';
    var s0=(tour.stationen||[])[0]||{}, x=tour.texte||{};
    return {'s0.a':s0.say, 's0.b':s0.say2, 'ende.a':x.ende, 'ende.b':x.ende2, 'heim.ende':x.heim2}[k] || '';
  }

  // ---------- Zeitstrahl: die ganze Tour auf einen Blick ----------
  function ablauf(){
    var zp=(tour && tour.zeitplan)||{}, st=(tour && tour.stationen)||[], ende=zp.ende||50, gesamt=ende+18, l=[];
    st.forEach(function(s, i){
      var min=(zp.stationen||[])[i]; if(min==null) min=Math.round(i*ende/Math.max(1, st.length));
      l.push({ort:'s'+i, min:min, titel:i===0?'Start an der Haustür':(s.kind==='finale'?'Letzte Station':(s.title||s.name||'Station '+i)), farbe:BOGEN[s.arc]||'#6B6280'});
    });
    l.push({ort:'ende', min:ende, titel:'Schatz gefunden', farbe:'#F2C14E'});
    l.push({ort:'heim', min:null, titel:'Wieder zu Hause', farbe:'#F2C14E'});
    l.forEach(function(p){ p.x=p.min==null ? 100 : Math.round(p.min/gesamt*1000)/10; });
    return l;
  }
  function strahlHtml(){
    var n=anzeigeName()||'Name', l=ablauf(), orte={}; MOMENTE.forEach(function(m){ orte[m.ort]=m; });
    return '<div class="nm-strahl" role="img" aria-label="Ablauf der Tour. Funkel sagt '+esc(n)+' an der Haustür, beim Schatz und zu Hause.">'+
      '<div class="nm-bahn"><span class="nm-linie"></span>'+l.map(function(p){
        var m=orte[p.ort];
        return '<span class="nm-p'+(m?' nm-name':'')+(p.x<12?' nm-l':p.x>88?' nm-r':'')+'" style="left:'+p.x+'%;--f:'+p.farbe+'"'+(m?' data-moment="'+m.stelle+'"':'')+' title="'+esc(p.titel)+'">'+
          (m?'<span class="nm-blase">'+esc(n)+'!</span>':'')+'</span>';
      }).join('')+'</div>'+
      '<div class="nm-skala">'+l.filter(function(p){ return p.ort==='s0' || p.ort==='ende' || p.ort==='heim'; }).map(function(p){
        return '<span class="'+(p.x<12?'nm-l':'nm-r')+'" style="left:'+p.x+'%">'+(p.ort==='s0'?'Start':p.ort==='ende'?'Schatz · '+p.min+' min':'Zuhause')+'</span>';
      }).join('')+'</div></div>';
  }
  function momenteHtml(){
    var t=saetze(); if(!t) return '';
    var ton=mitTon(), l=ablauf(), min={}; l.forEach(function(p){ min[p.ort]=p.min; });
    return MOMENTE.map(function(m, i){
      var davor=geschichte(m.davor), danach=m.danach?geschichte(m.danach):'';
      return '<article class="nm-moment" data-moment="'+m.stelle+'">'+
        '<div class="nm-kopf"><span class="nm-nr">'+(i+1)+'</span><span class="nm-wo"><b>'+esc(m.wann)+'</b><small>'+esc(m.titel)+(min[m.ort]==null?' · nach der Tour':min[m.ort]===0?' · gleich am Anfang':' · nach '+min[m.ort]+' min')+'</small></span>'+
          (ton?'<button type="button" class="knopf klein leer" data-namen-ganz="'+m.stelle+'" aria-label="'+esc(m.wann)+' mit Geschichte anhören">▶ Mit Geschichte</button>':'')+'</div>'+
        (davor?'<p class="nm-rede nm-davor">„'+esc(davor)+'“</p>':'')+
        '<p class="nm-rede nm-satz">„'+mitName(satzVon(m, t))+'“</p>'+
        (danach?'<p class="nm-rede nm-danach">„'+esc(danach)+'“</p>':'')+
      '</article>';
    }).join('');
  }

  // ---------- Bühne: Funkel, eingeblendeter Satz, Hauptknopf ----------
  var untertitelText=null;
  function untertitelHtml(){
    var t=saetze();
    if(untertitelText!=null) return '<p class="nm-sprech">„'+untertitelText+'“</p>';
    if(!t) return '<p class="nm-sprech leer">Trag den Vornamen ein, dann zeigt Funkel, was er sagt.</p>';
    return '<p class="nm-sprech">„'+mitName(t.gruss||'')+'“</p>';
  }
  // Hörprobe mit Beispielnamen (UNICORN-54): fest erzeugt (stimmen/beispiel.mjs), kostet beim Anhören nichts
  var BEISPIEL='Emma';
  function beispielKnopf(){ return '<button type="button" class="knopf mittel leer nm-beispiel" data-namen-beispiel>'+(spielt() && aktiv==='beispiel'?'■ Stopp':'▶ Hörprobe mit „'+BEISPIEL+'“')+'</button>'; }
  function hauptHtml(){
    return hauptKnopf()+(mitTon() ? '' : beispielKnopf());
  }
  function hauptKnopf(){
    var max=(stand&&stand.max)||3;
    if(!angemeldet()) return '<button type="button" class="knopf breit" data-konto="anmelden">Party sichern und einsprechen</button>'+
      '<p class="leise nm-info">Zum Einsprechen sicherst du die Party mit deiner E-Mail. Kein Passwort. Das erste Einsprechen ist frei.</p>';
    if(!stand) return '<p class="leise nm-info">Lädt …</p>';
    var aus=laeuft?' disabled':'';
    if(!gespeichert()) return '<button type="button" class="knopf breit" data-namen-los="neu"'+aus+'>'+(laeuft?'Funkel spricht ein …':'Funkel einsprechen lassen')+'</button>'+
      '<p class="leise nm-info">Das erste Einsprechen ist frei. Danach kannst du '+max+'-mal neu erzeugen.</p>';
    if(geaendert()) return stand.uebrig>0 ? '<button type="button" class="knopf breit" data-namen-los="neu"'+aus+'>'+(laeuft?'Funkel spricht ein …':'Neu einsprechen')+'</button>'+
      '<p class="leise nm-info">Zählt als 1 von '+stand.uebrig+' übrigen Mal.</p>' : '<p class="leise nm-info">Alle '+max+' Mal neu erzeugt.</p>';
    return '<button type="button" class="knopf breit" data-namen-alle'+(laeuft?' disabled':'')+'>'+(spielt()?'■ Stopp':'▶ Alle drei Stellen anhören')+'</button>';
  }
  function anpassenHtml(){
    if(!stand || !gespeichert() || geaendert()) return '';
    var u=stand.uebrig, max=stand.max||3, aus=laeuft?' disabled':'';
    return (u>0?'<div class="namen-knoepfe"><button type="button" class="knopf mittel leer" data-namen-los="betonung"'+aus+'>'+(laeuft==='betonung'?'Funkel spricht …':'Andere Betonung')+'</button>'+
         '<button type="button" class="knopf mittel leer" data-namen-los="worte"'+aus+'>'+(laeuft==='worte'?'Funkel spricht …':'Andere Worte')+'</button></div>':'')+
      '<p class="leise nm-info">'+(u>0?'Noch '+u+' von '+max+' Mal neu erzeugen.':'Alle '+max+' Mal neu erzeugt.')+' Das Tablet holt die Sätze beim nächsten Öffnen mit Internet.</p>';
  }
  function innen(){
    var p=party();
    if(!root.Konto || !Konto.aktiv() || !p) return '';
    var e=eingabe(), n=anzeigeName();
    return '<div class="nm-buehne"><div class="nm-funkel"><img src="themen/einhorn/figuren/funkel.svg" alt=""></div>'+
        '<div class="nm-blase-gross" id="nm-untertitel" aria-live="polite">'+untertitelHtml()+'</div></div>'+
      '<p class="nm-intro" id="nm-intro">'+introText(n)+'</p>'+
      '<label class="namen-feld">Vorname<input id="namen-name" maxlength="'+K.NAME_LAENGE+'" autocomplete="off" value="'+esc(e.name)+'"></label>'+
      '<details class="nm-aus"'+(e.aussprache?' open':'')+'><summary>Spricht Funkel den Namen falsch?</summary>'+
        '<label class="namen-feld">So spricht man ihn <span class="leise">(z. B. „Mija“ für Mia)</span><input id="namen-aussprache" maxlength="'+K.NAME_LAENGE+'" autocomplete="off" value="'+esc(e.aussprache)+'"></label></details>'+
      '<p class="namen-fehler" id="namen-fehler"'+(fehler?'':' hidden')+'>'+esc(fehler)+'</p>'+
      '<div id="nm-haupt">'+hauptHtml()+'</div>'+
      '<h2>So läuft die Tour</h2><div id="nm-strahl">'+strahlHtml()+'</div>'+
      '<h2>Das sagt Funkel</h2><p class="leise klein nm-legende">Hell: Funkels Geschichte, wie sie immer ist. Hervorgehoben: der Satz mit dem Namen.</p>'+
      '<div id="namen-texte">'+momenteHtml()+'</div>'+
      '<div id="namen-unten">'+anpassenHtml()+'</div>';
  }
  function introText(n){
    var a=alter();
    return n ? 'Funkel nennt <b>'+esc(n)+'</b> dreimal beim Namen: zur Begrüßung an der Haustür, vor dem Schatz'+(a?' mit Glückwunsch zum '+esc(a)+'. Geburtstag':'')+' und zum Abschied zu Hause. So klingt es später auf dem Tablet.'
             : 'Funkel nennt das Geburtstagskind dreimal beim Namen: an der Haustür, vor dem Schatz und zum Abschied.';
  }
  // Ansicht für die Party-Seite: tour kommt von dort, damit nichts doppelt geladen wird
  function karte(th, t){
    thema=th; if(t){ tour=t; if(K && K.vorlagenOk(t.namenSaetze)) vorlagen=t.namenSaetze; }
    var p=party();
    if(!root.Konto || !Konto.aktiv() || !p) return '';
    setTimeout(function(){ f3dEinsetzen(); laden(); }, 0);
    return '<div class="konto namen" id="namen-karte">'+innen()+'</div>';
  }
  // Vorschau im Assistenten „Fertig“: noch ohne Server, nur aus den Vorlagen
  function vorschau(t, e){
    if(!root.Konto || !Konto.aktiv() || !K || !t || !K.vorlagenOk(t.namenSaetze) || !e || !e.kind || !e.kind.name) return '';
    var b=K.bilden(t.namenSaetze, {name:e.kind.name, alter:e.kind.alter}), n=esc(K.sauber(e.kind.name));
    return '<div class="nm-vorschau"><img src="themen/einhorn/figuren/funkel.svg" alt=""><div><b>Funkel kennt '+n+'</b>'+
      '<p>Er nennt '+n+' dreimal beim Namen, zum Beispiel an der Haustür:</p><p class="nm-zitat">„'+esc(b.gruss.zeigen).split(n).join('<mark>'+n+'</mark>')+'“</p>'+
      '<p class="leise klein">Gleich nach dem Erstellen kannst du es anhören.</p></div></div>';
  }
  // Sätze sind da: die Party-Seite hakt „Funkel kennt …“ ab (UNICORN-33)
  function melden(){ try{ root.dispatchEvent(new CustomEvent('namen', {detail:{thema:thema}})); }catch(e){} }
  function zeichnen(){ var e=$('namen-karte'); if(e){ e.innerHTML=innen(); f3dEinsetzen(); markieren(aktiv); } }
  // Beim Tippen nur Sätze und Knöpfe neu, die Felder behalten den Fokus
  function teilweise(){
    var set=function(id, h){ var e=$(id); if(e) e.innerHTML=h; };
    set('nm-untertitel', untertitelHtml()); set('nm-intro', introText(anzeigeName())); set('nm-haupt', hauptHtml());
    set('nm-strahl', strahlHtml()); set('namen-texte', momenteHtml()); set('namen-unten', anpassenHtml());
    var f=$('namen-fehler'); if(f){ f.textContent=fehler; f.hidden=!fehler; }
    markieren(aktiv);
  }
  function audioAus(s){ audio={}; huellen={}; Object.keys(s||{}).forEach(function(k){ if(s[k] && s[k].b64) audio[k]=s[k].b64; }); }
  function vorlagenLaden(){
    if(vorlagen) return Promise.resolve(vorlagen);
    return fetch('themen/'+encodeURIComponent(thema)+'/tour.json').then(function(r){ return r.json(); }).then(function(t){
      tour=tour||t; if(K && K.vorlagenOk(t.namenSaetze)) vorlagen=t.namenSaetze; return vorlagen;
    })['catch'](function(){ return null; });
  }
  function laden(){
    vorlagenLaden().then(function(){ if(!stand) teilweise(); });
    if(!angemeldet()) return;
    Konto.namenStand(thema).then(function(s){
      if(!s) return; stand=s; fehler='';
      vorlagenLaden().then(function(){
        zeichnen();
        if(s.hash){
          melden();
          Konto.namenHolen(thema).then(function(r){ if(r && r.saetze){ audioAus(r.saetze); teilweise(); } }, function(){});
          // Alter im Assistenten geändert: Alters-Satz still nachziehen (zählt nicht)
          var a=alter()||null;
          if(!alterGeprueft && vorlagen && vorlagen.alter && (s.alter||null)!==a){ alterGeprueft=true; erzeugen('neu', true); }
        }
      });
    }, function(e){ fehler=e.message||'Laden ging nicht.'; zeichnen(); });
  }
  function erzeugen(art, still){
    var e=eingabe(), p=party();
    fehler=K.pruefeName(e.name) || (e.aussprache ? K.pruefeName(e.aussprache, 'die Aussprache') : '');
    if(fehler){ teilweise(); return; }
    stopp(); laeuft=art||'neu'; if(!still) teilweise();
    Konto.namenErzeugen(thema, e.name, e.aussprache, p.kind && p.kind.alter, art).then(function(r){
      laeuft=''; stand.uebrig=r.uebrig; stand.max=r.max; stand.hash=r.hash; stand.name=e.name; stand.aussprache=e.aussprache;
      stand.texte={}; stand.wahl={}; Object.keys(r.saetze||{}).forEach(function(k){ stand.texte[k]=r.saetze[k].text; stand.wahl[k]=r.saetze[k].variante||0; });
      stand.alter=alter()||null;
      audioAus(r.saetze); zeichnen(); if(!still) alleAnhoeren(); melden();
    }, function(x){ laeuft=''; if(!still) fehler=x.message||'Das ging nicht.'; if(x.daten && typeof x.daten.uebrig==='number') stand.uebrig=x.daten.uebrig; teilweise(); });
  }

  // ---------- Funkel in 3D: ein Element für die ganze Seite, wird in jede neue Bühne gehängt ----------
  var f3dEl=null, f3dBereit=false;
  function F(){ return root.Funkel3D || null; }
  function f3dEinsetzen(){
    var ziel=document.querySelector('#namen-karte .nm-funkel'); if(!ziel) return;
    if(!f3dEl){ f3dEl=document.createElement('div'); f3dEl.className='f3d'; f3dEl.setAttribute('aria-hidden','true'); }
    if(f3dEl.parentNode!==ziel) ziel.appendChild(f3dEl);
    if(f3dBereit) ziel.classList.add('bereit');
    if(!document.querySelector('script[data-funkel3d]')){
      var s=document.createElement('script'); s.type='module'; s.src='../funkel3d.js'; s.setAttribute('data-funkel3d',''); document.head.appendChild(s);
    }
    if(F()) f3dStart();
  }
  function f3dStart(){
    var f=F(); if(!f || !f3dEl) return;
    try{ f.start(f3dEl); }catch(e){ return; }
    var n=0; (function warte(){
      var z=f.zustand ? f.zustand() : null, b=document.querySelector('#namen-karte .nm-funkel');
      if(z && z.bilder>1 && !f3dEl.hidden){ f3dBereit=true; if(b) b.classList.add('bereit'); return; }
      if(++n<100) setTimeout(warte, 100);
    })();
  }
  root.addEventListener('funkel3d-bereit', f3dStart);
  // Lautstärkeverlauf je Aufnahme (60 Werte pro Sekunde), damit das Maul passt; bis dahin ein gleichmäßiges Plappern
  var huellen={};
  function huelle(k, b64){
    if(huellen[k]!==undefined) return; huellen[k]=null;
    var OAC=root.OfflineAudioContext || root.webkitOfflineAudioContext; if(!OAC) return;
    try{
      var bin=atob(b64), buf=new Uint8Array(bin.length); for(var i=0;i<bin.length;i++) buf[i]=bin.charCodeAt(i);
      var oc=new OAC(1, 44100, 44100);
      new Promise(function(ok, nein){ var p=oc.decodeAudioData(buf.buffer, ok, nein); if(p && p.then) p.then(ok, nein); }).then(function(b){
        var d=b.getChannelData(0), w=Math.max(1, Math.floor(b.sampleRate/60)), n=Math.ceil(d.length/w), h=new Float32Array(n), max=0;
        for(var i=0;i<n;i++){ var s=0, a=i*w, e=Math.min(d.length, a+w); for(var j=a;j<e;j+=2) s+=d[j]*d[j]; h[i]=Math.sqrt(s/Math.max(1,(e-a)/2)); if(h[i]>max) max=h[i]; }
        var ruhe=max*0.06; for(var x=0;x<n;x++) h[x]=Math.pow(Math.max(0,(h[x]-ruhe)/Math.max(1e-6, max*0.7-ruhe)), 0.8);
        huellen[k]=h;
      })['catch'](function(){});
    }catch(e){}
  }
  function zuckeln(){ var t=performance.now()/1000; return Math.max(0, .55+.45*Math.sin(t*15))*(.65+.35*Math.sin(t*3.3)); }

  // ---------- Abspielen: eine Kette aus Teilen {k, b64, text, moment, name} ----------
  var kette=null, aktiv=null;
  function spielt(){ return !!kette; }
  function markieren(m){
    aktiv=m||null;
    var l=document.querySelectorAll('#namen-karte [data-moment]');
    for(var i=0;i<l.length;i++) l[i].classList.toggle('spricht', !!m && l[i].getAttribute('data-moment')===m);
    var b=document.querySelector('#namen-karte .nm-buehne'); if(b) b.classList.toggle('spricht', !!m);
  }
  function untertitel(teil){
    untertitelText = teil ? (teil.name ? mitName(teil.text) : teil.k==='beispiel' ? esc(teil.text).split(BEISPIEL).join('<mark>'+BEISPIEL+'</mark>') : esc(teil.text)) : null;
    var e=$('nm-untertitel'); if(e) e.innerHTML=untertitelHtml();
    var u=e && e.querySelector('.nm-sprech'); if(u) u.classList.toggle('geschichte', !!(teil && !teil.name && teil.k!=='beispiel'));
  }
  function stopp(){
    if(kette && kette.au) try{ kette.au.pause(); }catch(e){}
    var war=!!kette; kette=null; markieren(null); untertitel(null);
    var f=F(); if(f && war) f.still();
    var h=$('nm-haupt'); if(h && war) h.innerHTML=hauptHtml();
  }
  function spiele(teile){
    stopp(); teile=teile.filter(function(t){ return t && (t.b64 || t.src); }); if(!teile.length) return;
    kette={teile:teile, i:0}; var h=$('nm-haupt'); if(h) h.innerHTML=hauptHtml(); weiter();
  }
  function weiter(){
    if(!kette) return;
    var t=kette.teile[kette.i], f=F();
    if(!t){ kette=null; markieren(null); untertitel(null); if(f){ f.still(); f.freude(); } var h=$('nm-haupt'); if(h) h.innerHTML=hauptHtml(); return; }
    markieren(t.moment); untertitel(t);
    if(t.b64) huelle(t.k, t.b64);
    var au; try{ au=new Audio(t.src || 'data:audio/mpeg;base64,'+t.b64); }catch(e){ stopp(); return; }
    kette.au=au; var meine=kette;
    au.addEventListener('playing', function(){
      var f=F(); if(!f || kette!==meine) return;
      f.sprich(function(){ if(au.paused) return 0; var h=huellen[t.k]; if(!h) return zuckeln(); var i=Math.floor((au.currentTime+0.03)*60); return i<h.length ? (h[i]||0) : 0; });
    });
    au.addEventListener('ended', function(){ if(kette!==meine) return; var f=F(); if(f) f.still(); kette.i++; setTimeout(weiter, t.name ? 350 : 250); });
    var p=au.play(); if(p && p['catch']) p['catch'](function(){ if(kette===meine) stopp(); });
  }
  function nameTeile(m){
    var t=stand && stand.texte || {}, l=[{k:'n.'+m.stelle, b64:audio[m.stelle], text:t[m.stelle]||'', moment:m.stelle, name:true}];
    if(m.alter && audio.alter) l.push({k:'n.alter', b64:audio.alter, text:t.alter||'', moment:m.stelle, name:true});
    return l;
  }
  function alleAnhoeren(){
    if(spielt()){ stopp(); return; }
    var l=[]; MOMENTE.forEach(function(m){ l=l.concat(nameTeile(m)); }); spiele(l);
  }
  // Ganze Stelle mit Geschichte: fertige Aufnahmen aus dem Stimmen-Paket des Themas (liegt fürs Spiel ohnehin im Gerät)
  var paket=null;
  function paketLaden(){
    if(paket) return paket;
    var pfad=tour && tour.stimmen && tour.stimmen.pakete && tour.stimmen.pakete.basis;
    paket = pfad ? fetch(pfad).then(function(r){ return r.json(); }).then(function(d){ return d.clips||{}; }) : Promise.resolve({});
    paket['catch'](function(){ paket=null; });
    return paket;
  }
  function ganzAnhoeren(stelle){
    var m=MOMENTE.filter(function(x){ return x.stelle===stelle; })[0]; if(!m) return;
    if(spielt() && aktiv===stelle){ stopp(); return; }
    var b=document.querySelector('[data-namen-ganz="'+stelle+'"]'); if(b) b.textContent='Lädt …';
    paketLaden().then(function(c){
      var g=function(k){ return k && c[k] && c[k].b64 ? {k:'g.'+k, b64:c[k].b64, text:geschichte(k), moment:m.stelle, name:false} : null; };
      spiele([g(m.davor)].concat(nameTeile(m), [g(m.danach)]));
      if(b) b.textContent='▶ Mit Geschichte';
    }, function(){ if(b) b.textContent='▶ Mit Geschichte'; fehler='Die Geschichte braucht Internet.'; teilweise(); });
  }

  var beispielText=null;
  function beispiel(th){
    if(spielt() && aktiv==='beispiel'){ stopp(); return; }
    var ordner='themen/'+encodeURIComponent(th||thema||'einhorn')+'/';
    var los=function(){ spiele([{k:'beispiel', src:ordner+'namen-beispiel.mp3', text:beispielText||'', moment:'beispiel', name:false}]); };
    if(beispielText!=null){ los(); return; }
    fetch(ordner+'namen-beispiel.json').then(function(r){ return r.json(); }).then(function(d){ beispielText=d.text||''; }, function(){ beispielText=''; }).then(los);
  }
  document.addEventListener('click', function(ev){
    var t=ev.target; if(!t.closest) return;
    var g=t.closest('[data-namen-ganz]'); if(g){ ganzAnhoeren(g.getAttribute('data-namen-ganz')); return; }
    if(t.closest('[data-namen-alle]')){ alleAnhoeren(); return; }
    if(t.closest('[data-namen-beispiel]')){ beispiel(); return; }
    if(t.closest('#namen-karte .nm-funkel')){ if(mitTon()) alleAnhoeren(); else beispiel(); return; }
    var l=t.closest('[data-namen-los]'); if(l && !l.disabled) erzeugen(l.getAttribute('data-namen-los'));
  });
  document.addEventListener('input', function(ev){
    if(!ev.target || (ev.target.id!=='namen-name' && ev.target.id!=='namen-aussprache')) return;
    fehler=''; stopp(); teilweise();
  });
  root.addEventListener('konto', function(ev){ if(ev.detail && ev.detail.thema===thema && ev.detail.art==='angemeldet'){ stand=null; setTimeout(function(){ zeichnen(); laden(); }, 0); } });
  var stil=document.createElement('style');
  stil.textContent=
    '#namen-karte{background:transparent;padding:0;border:0}'+
    '.nm-buehne{display:flex;flex-direction:column;align-items:center;gap:6px;margin:0 0 12px}'+
    '.nm-funkel{position:relative;width:min(210px,56vw);aspect-ratio:1;cursor:pointer;-webkit-tap-highlight-color:transparent}'+
    '.nm-funkel::before{content:"";position:absolute;inset:12% 8% 4%;border-radius:50%;background:radial-gradient(circle,rgba(167,139,250,.38),rgba(167,139,250,0) 68%);transition:transform .4s ease,opacity .4s ease;opacity:.7}'+
    '.nm-buehne.spricht .nm-funkel::before{transform:scale(1.14);opacity:1}'+
    '.nm-funkel img{position:absolute;inset:14%;width:72%;height:72%;object-fit:contain;transition:opacity .4s ease}.nm-funkel.bereit img{opacity:0}'+
    '.nm-funkel .f3d{position:absolute;inset:0;-webkit-mask-image:linear-gradient(to bottom,#000 70%,transparent 96%);mask-image:linear-gradient(to bottom,#000 70%,transparent 96%)}.nm-funkel .f3d canvas{width:100%;height:100%;display:block}'+
    '.nm-blase-gross{position:relative;width:100%;box-sizing:border-box;background:#2A2040;border:1.5px solid rgba(167,139,250,.5);border-radius:18px;padding:12px 16px;min-height:3.2em}'+
    '.nm-blase-gross::before{content:"";position:absolute;top:-9px;left:50%;margin-left:-9px;border:9px solid transparent;border-top:0;border-bottom-color:rgba(167,139,250,.5)}'+
    '.nm-sprech{margin:0;font-size:1.08rem;line-height:1.4;text-align:center}.nm-sprech.leer{color:var(--leise);font-size:.95rem}.nm-sprech.geschichte{color:#D9D2E8}'+
    '.namen mark,.nm-vorschau mark{background:none;color:#FDE68A;font-weight:800;text-decoration:underline;text-decoration-color:rgba(253,230,138,.5);text-underline-offset:3px}'+
    '.nm-intro{margin:0 0 14px;color:#D9D2E8}.nm-info{margin:8px 0 0;font-size:.9rem}#nm-haupt{margin:4px 0 6px}'+
    '.nm-aus{margin:-2px 0 10px}.nm-aus summary{cursor:pointer;color:var(--akzent,#A78BFA);font-weight:700;font-size:.92rem;min-height:36px;display:flex;align-items:center}'+
    '.nm-strahl{background:var(--karte,#1F1929);border-radius:16px;padding:34px 22px 12px;margin:0 0 6px}'+
    '.nm-bahn{position:relative;height:18px}.nm-linie{position:absolute;left:0;right:0;top:8px;height:3px;border-radius:2px;background:linear-gradient(90deg,#8B5CF6,#EF5A6F,#F2C94C,#3FB950,#3B82F6,#F2C14E)}'+
    '.nm-p{position:absolute;top:3px;width:13px;height:13px;margin-left:-6.5px;border-radius:50%;background:var(--f);border:2px solid #0F0B17}'+
    '.nm-p.nm-name{top:-1px;width:21px;height:21px;margin-left:-10.5px;background:#FDE68A;box-shadow:0 0 0 4px rgba(253,230,138,.25);transition:transform .3s,box-shadow .3s}'+
    '.nm-p.nm-name.spricht{transform:scale(1.25);box-shadow:0 0 0 7px rgba(253,230,138,.35)}'+
    '.nm-blase{position:absolute;bottom:26px;left:50%;transform:translateX(-50%);white-space:nowrap;background:#FDE68A;color:#2A1B4D;font-weight:800;font-size:.78rem;padding:2px 8px;border-radius:10px}'+
    '.nm-p.nm-l .nm-blase{left:-6px;transform:none}.nm-p.nm-r .nm-blase{left:auto;right:-6px;transform:none}'+
    '.nm-skala{position:relative;height:1.3em;margin-top:8px;color:var(--leise);font-size:.8rem}.nm-skala span{position:absolute;white-space:nowrap;transform:translateX(-50%)}.nm-skala .nm-l{transform:translateX(-8px)}.nm-skala .nm-r{transform:translateX(calc(-100% + 8px))}'+
    '.nm-legende{margin:-4px 0 10px}'+
    '.nm-moment{background:var(--karte,#1F1929);border-radius:16px;padding:12px 14px;margin:0 0 10px;border:1.5px solid transparent;transition:border-color .3s}.nm-moment.spricht{border-color:#FDE68A}'+
    '.nm-kopf{display:flex;align-items:center;gap:10px;margin-bottom:6px}.nm-nr{flex:none;width:26px;height:26px;border-radius:50%;display:grid;place-items:center;background:#FDE68A;color:#2A1B4D;font-weight:800;font-size:.85rem}'+
    '.nm-wo{flex:1;min-width:0;display:flex;flex-direction:column;line-height:1.2}.nm-wo small{color:var(--leise);font-size:.84rem}.nm-kopf .knopf{flex:none;white-space:nowrap}'+
    '.nm-rede{margin:6px 0 0;line-height:1.45}.nm-davor,.nm-danach{color:var(--leise);font-size:.9rem}.nm-satz{font-size:1.02rem;padding:8px 10px;border-left:3px solid #FDE68A;background:rgba(253,230,138,.07);border-radius:0 10px 10px 0}'+
    '.namen-feld{display:block;margin:0 0 10px;font-weight:700;font-size:.92rem}'+
    '.namen-feld input{display:block;width:100%;box-sizing:border-box;margin-top:6px;font:inherit;font-weight:400;font-size:1.05rem;padding:11px 13px;border-radius:12px;border:1.5px solid var(--linie,#2F2740);background:var(--panel,#17121F);color:inherit}'+
    '.nm-beispiel{width:100%;margin-top:8px}'+
    '.namen-knoepfe{display:flex;gap:10px;flex-wrap:wrap;margin-top:6px}.namen-knoepfe .knopf{flex:1;min-width:140px}'+
    '.namen-fehler{color:var(--rot,#F87171);margin:4px 0 10px}#namen{scroll-margin-top:84px}'+
    '.nm-vorschau{display:flex;gap:12px;align-items:flex-start;background:linear-gradient(130deg,#3B2A64,#1F1929);border-radius:16px;padding:14px 16px;margin:10px 0 0}'+
    '.nm-vorschau img{flex:none;width:64px;height:64px}.nm-vorschau b{font-size:1.1rem}.nm-vorschau p{margin:4px 0 0}.nm-zitat{font-size:1rem;line-height:1.4}'+
    '@media (prefers-reduced-motion:reduce){.nm-p.nm-name,.nm-funkel::before{transition:none}}';
  document.head.appendChild(stil);
  root.Namen={karte:karte, vorschau:vorschau, still:stopp, beispiel:beispiel, BEISPIEL:BEISPIEL};
})(this);
