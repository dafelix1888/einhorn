// Funkel kennt das Kind: Karte in der Party-Übersicht.
// Funkel sagt den Namen an drei Stellen: Begrüßung an der Haustür, Geburtstagsgruß beim Schatz (mit Alter), Abschied zu Hause.
// Die Sätze stehen sofort beim Tippen da (Vorlagen aus tour.json, namen-kern.js), der Ton kommt vom Server (Edge Function „namen“).
// Erstes Einsprechen frei, danach 3-mal neu: andere Betonung, andere Worte oder Name/Aussprache ändern (UNICORN-51).
// Gleiche Namen anderer Familien kommen aus dem Stimmen-Speicher (UNICORN-49, ADR-28). Braucht konto.js und namen-kern.js.
(function(root){
  'use strict';
  var K=root.NamenKern;
  var thema=null, vorlagen=null, stand=null, audio={}, fehler='', laeuft='', spieler=null, alterGeprueft=false;
  function esc(t){ return String(t==null?'':t).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function party(){ return root.Party && Party.lesen(thema); }
  function vorname(){ var p=party(); return (p && p.kind && p.kind.name) || ''; }
  function alter(){ var p=party(); return (p && p.kind && p.kind.alter) || null; }
  function wert(id){ var e=document.getElementById(id); return e ? K.sauber(e.value) : null; }
  function eingabe(){
    var n=wert('namen-name'), a=wert('namen-aussprache');
    return {name:n!=null?n:K.sauber((stand&&stand.name)||vorname()), aussprache:a!=null?a:K.sauber((stand&&stand.aussprache)||'')};
  }
  function gespeichert(){ return !!(stand && stand.texte); }
  function geaendert(){ var e=eingabe(); return gespeichert() && (e.name!==K.sauber(stand.name) || e.aussprache!==K.sauber(stand.aussprache)); }

  // Sätze für die Anzeige: gespeicherte, solange nichts geändert ist, sonst sofort aus den Vorlagen
  function saetze(){
    if(gespeichert() && !geaendert()) return stand.texte;
    if(!vorlagen || !K) return null;
    var e=eingabe(); if(!e.name) return null;
    var b=K.bilden(vorlagen, {name:e.name, alter:alter(), wahl:(stand&&stand.wahl)||{}}), t={};
    Object.keys(b).forEach(function(k){ t[k]=b[k].zeigen; });
    return t;
  }
  function stellen(){ return vorlagen ? vorlagen.stellen.map(function(s){ return [s.id, s.titel||s.id]; }) : [['gruss','An der Haustür'],['schatz','Beim Schatz'],['abschied','Zu Hause']]; }
  function satzHtml(){
    var t=saetze(), mitTon=gespeichert() && !geaendert(), nach=(vorlagen && vorlagen.alter && vorlagen.alter.nach)||'schatz';
    if(!t) return '<p>Funkel sagt '+(vorname()?esc(vorname()):'den Namen')+' an drei Stellen: bei der Begrüßung, beim Schatz und zum Abschied. Vorher anhören, dann aufs Tablet.</p>';
    return '<div class="namen-saetze'+(mitTon?'':' vorschau')+'">'+stellen().map(function(s){
      var text=(t[s[0]]||'')+(s[0]===nach && t.alter ? ' '+t.alter : '');
      return '<div class="zeile"><span><b>'+esc(s[1])+'</b><br><span class="leise">„'+esc(text)+'“</span></span>'+
        (mitTon && audio[s[0]]?'<button type="button" class="knopf klein leer" data-namen-hoeren="'+s[0]+'" aria-label="'+esc(s[1])+' anhören">▶ Anhören</button>':'')+'</div>';
    }).join('')+'</div>'+(mitTon?'':'<p class="leise namen-vorschau-hinweis">So sagt Funkel es. Zum Anhören einsprechen.</p>');
  }
  function knopfHtml(){
    if(!stand) return '';
    var h='', u=stand.uebrig, max=stand.max||3, aus=laeuft?' disabled':'';
    if(!gespeichert()){
      h+='<button type="button" class="knopf mittel" data-namen-los="neu"'+aus+'>'+(laeuft?'Funkel spricht ein …':'Sätze einsprechen')+'</button>';
      h+='<p class="leise namen-info">Das erste Einsprechen ist frei. Danach kannst du '+max+'-mal neu erzeugen.</p>';
      return h;
    }
    if(geaendert()){
      h+=u>0 ? '<button type="button" class="knopf mittel" data-namen-los="neu"'+aus+'>'+(laeuft?'Funkel spricht ein …':'Neu einsprechen')+'</button>' : '';
    } else if(u>0){
      h+='<div class="namen-knoepfe"><button type="button" class="knopf mittel leer" data-namen-los="betonung"'+aus+'>'+(laeuft==='betonung'?'Funkel spricht …':'Andere Betonung')+'</button>'+
         '<button type="button" class="knopf mittel leer" data-namen-los="worte"'+aus+'>'+(laeuft==='worte'?'Funkel spricht …':'Andere Worte')+'</button></div>';
    }
    h+='<p class="leise namen-info">'+(u>0?'Noch '+u+' von '+max+' Mal neu erzeugen.':'Alle '+max+' Mal neu erzeugt.')+' Das Tablet holt die Sätze beim nächsten Öffnen mit Internet.</p>';
    return h;
  }
  function innen(){
    var p=party(), n=vorname();
    if(!root.Konto || !Konto.aktiv() || !p) return '';
    if(!Konto.angemeldet() || !p.server)
      return '<p>Funkel sagt '+(n?esc(n):'den Namen')+' an drei Stellen: bei der Begrüßung, beim Schatz und zum Abschied. Dafür die Party speichern.</p>'+
        '<button type="button" class="knopf mittel" data-konto="anmelden">Speichern und teilen</button>';
    if(!stand) return '<p class="leise">Lädt …</p>'+(fehler?'<p class="namen-fehler">'+esc(fehler)+'</p>':'');
    var e=eingabe();
    return '<div id="namen-texte">'+satzHtml()+'</div>'+
      '<label class="namen-feld">Vorname<input id="namen-name" maxlength="'+K.NAME_LAENGE+'" autocomplete="off" value="'+esc(e.name)+'"></label>'+
      '<label class="namen-feld">So spricht man ihn <span class="leise">(nur wenn Funkel ihn falsch sagt, z. B. „Mija“ für Mia)</span><input id="namen-aussprache" maxlength="'+K.NAME_LAENGE+'" autocomplete="off" value="'+esc(e.aussprache)+'"></label>'+
      '<p class="namen-fehler" id="namen-fehler"'+(fehler?'':' hidden')+'>'+esc(fehler)+'</p>'+
      '<div id="namen-unten">'+knopfHtml()+'</div>';
  }
  function karte(th){
    thema=th; var p=party();
    if(!root.Konto || !Konto.aktiv() || !p) return '';
    setTimeout(laden, 0);
    return '<h2 id="namen">Funkel kennt '+esc(vorname()||'das Kind')+'</h2><div class="konto namen" id="namen-karte">'+innen()+'</div>';
  }
  // Sätze sind da: die Party-Seite hakt „Funkel kennt …“ ab (UNICORN-33)
  function melden(){ try{ root.dispatchEvent(new CustomEvent('namen', {detail:{thema:thema}})); }catch(e){} }
  function zeichnen(){ var e=document.getElementById('namen-karte'); if(e) e.innerHTML=innen(); }
  // Beim Tippen nur Sätze und Knöpfe neu, die Felder behalten den Fokus
  function teilweise(){
    var t=document.getElementById('namen-texte'), u=document.getElementById('namen-unten'), f=document.getElementById('namen-fehler');
    if(t) t.innerHTML=satzHtml(); if(u) u.innerHTML=knopfHtml();
    if(f){ f.textContent=fehler; f.hidden=!fehler; }
  }
  function audioAus(s){ audio={}; Object.keys(s||{}).forEach(function(k){ if(s[k] && s[k].b64) audio[k]=s[k].b64; }); }
  function vorlagenLaden(){
    if(vorlagen) return Promise.resolve(vorlagen);
    return fetch('themen/'+encodeURIComponent(thema)+'/tour.json').then(function(r){ return r.json(); }).then(function(t){
      if(K && K.vorlagenOk(t.namenSaetze)) vorlagen=t.namenSaetze; return vorlagen;
    })['catch'](function(){ return null; });
  }
  function laden(){
    if(!Konto.angemeldet() || !(party()||{}).server) return;
    vorlagenLaden().then(function(){ if(stand) teilweise(); });
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
  function hoeren(k){
    if(!audio[k]) return;
    var nach=(vorlagen && vorlagen.alter && vorlagen.alter.nach)||'schatz';
    try{
      if(spieler) spieler.pause();
      spieler=new Audio('data:audio/mpeg;base64,'+audio[k]);
      if(k===nach && audio.alter) spieler.addEventListener('ended', function(){ hoeren('alter'); });
      var pr=spieler.play(); if(pr && pr['catch']) pr['catch'](function(){});
    }catch(e){}
  }
  function erzeugen(art, still){
    var e=eingabe(), p=party();
    fehler=K.pruefeName(e.name) || (e.aussprache ? K.pruefeName(e.aussprache, 'die Aussprache') : '');
    if(fehler){ teilweise(); return; }
    laeuft=art||'neu'; if(!still) teilweise();
    Konto.namenErzeugen(thema, e.name, e.aussprache, p.kind && p.kind.alter, art).then(function(r){
      laeuft=''; stand.uebrig=r.uebrig; stand.max=r.max; stand.hash=r.hash; stand.name=e.name; stand.aussprache=e.aussprache;
      stand.texte={}; stand.wahl={}; Object.keys(r.saetze||{}).forEach(function(k){ stand.texte[k]=r.saetze[k].text; stand.wahl[k]=r.saetze[k].variante||0; });
      stand.alter=alter()||null;
      audioAus(r.saetze); zeichnen(); if(!still) hoeren('gruss'); melden();
    }, function(x){ laeuft=''; if(!still) fehler=x.message||'Das ging nicht.'; if(x.daten && typeof x.daten.uebrig==='number') stand.uebrig=x.daten.uebrig; teilweise(); });
  }
  document.addEventListener('click', function(ev){
    var t=ev.target; if(!t.closest) return;
    var h=t.closest('[data-namen-hoeren]'); if(h){ hoeren(h.getAttribute('data-namen-hoeren')); return; }
    var l=t.closest('[data-namen-los]'); if(l && !l.disabled) erzeugen(l.getAttribute('data-namen-los'));
  });
  document.addEventListener('input', function(ev){
    if(!ev.target || (ev.target.id!=='namen-name' && ev.target.id!=='namen-aussprache')) return;
    fehler=''; teilweise();
  });
  root.addEventListener('konto', function(ev){ if(ev.detail && ev.detail.thema===thema && ev.detail.art==='angemeldet'){ stand=null; setTimeout(laden, 0); } });
  var stil=document.createElement('style');
  stil.textContent='.namen .zeile{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 0;border-top:1px solid var(--linie,#2F2740)}.namen .zeile:first-child{border-top:0}'+
    '.namen .zeile .leise{font-size:.9rem}.namen .zeile button{white-space:nowrap;flex:none}.namen-saetze{margin-bottom:12px}.namen-saetze.vorschau .leise{opacity:.8}.namen-vorschau-hinweis{font-size:.85rem;margin:-6px 0 12px}'+
    '.namen-feld{display:block;margin:0 0 10px;font-weight:700;font-size:.92rem}'+
    '.namen-feld input{display:block;width:100%;box-sizing:border-box;margin-top:6px;font:inherit;font-weight:400;font-size:1.05rem;padding:11px 13px;border-radius:12px;border:1.5px solid var(--linie,#2F2740);background:var(--panel,#17121F);color:inherit}'+
    '.namen-knoepfe{display:flex;gap:10px;flex-wrap:wrap}.namen-knoepfe .knopf{flex:1;min-width:140px}.namen-info{margin-top:8px}'+
    '.namen-fehler{color:var(--rot,#F87171);margin:4px 0 10px}#namen{scroll-margin-top:84px}';
  document.head.appendChild(stil);
  root.Namen={karte:karte};
})(this);
