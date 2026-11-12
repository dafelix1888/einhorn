// Funkel kennt das Kind: Karte in der Party-Übersicht.
// Funkel sagt den Namen an drei Stellen: Begrüßung an der Haustür, Geburtstagsgruß beim Schatz, Abschied zu Hause.
// Erzeugt wird auf dem Server (Edge Function „namen“), höchstens 3-mal je Party. Braucht konto.js.
(function(root){
  'use strict';
  var STELLEN=[['gruss','An der Haustür'],['schatz','Beim Schatz'],['abschied','Zu Hause']];
  var thema=null, stand=null, audio={}, fehler='', laeuft=false, spieler=null;
  function esc(t){ return String(t==null?'':t).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function party(){ return root.Party && Party.lesen(thema); }
  function vorname(){ var p=party(); return (p && p.kind && p.kind.name) || ''; }

  function innen(){
    var p=party(), n=vorname();
    if(!root.Konto || !Konto.aktiv() || !p) return '';
    if(!Konto.angemeldet() || !p.server)
      return '<p>Funkel sagt '+(n?esc(n):'den Namen')+' an drei Stellen: bei der Begrüßung, beim Schatz und zum Abschied. Dafür die Party speichern.</p>'+
        '<button type="button" class="knopf mittel" data-konto="anmelden">Speichern und teilen</button>';
    if(!stand) return '<p class="leise">Lädt …</p>'+(fehler?'<p class="namen-fehler">'+esc(fehler)+'</p>':'');
    var h='', t=stand.texte;
    if(t) h+='<div class="namen-saetze">'+STELLEN.map(function(s){
      return '<div class="zeile"><span><b>'+s[1]+'</b><br><span class="leise">„'+esc(t[s[0]]||'')+'“</span></span>'+
        (audio[s[0]]?'<button type="button" class="knopf klein leer" data-namen-hoeren="'+s[0]+'" aria-label="'+s[1]+' anhören">▶ Anhören</button>':'')+'</div>';
    }).join('')+'</div>';
    else h+='<p>Funkel sagt '+(n?esc(n):'den Namen')+' an drei Stellen: bei der Begrüßung, beim Schatz und zum Abschied. Vorher anhören, dann aufs Tablet.</p>';
    h+='<label class="namen-feld">Vorname<input id="namen-name" maxlength="30" autocomplete="off" value="'+esc(stand.name||n)+'"></label>'+
       '<label class="namen-feld">So spricht man ihn <span class="leise">(nur wenn Funkel ihn falsch sagt, z. B. „Mija“ für Mia)</span><input id="namen-aussprache" maxlength="30" autocomplete="off" value="'+esc(stand.aussprache||'')+'"></label>';
    if(fehler) h+='<p class="namen-fehler">'+esc(fehler)+'</p>';
    if(stand.uebrig>0) h+='<button type="button" class="knopf mittel" id="namen-los"'+(laeuft?' disabled':'')+'>'+(laeuft?'Funkel spricht ein …':t?'Neu einsprechen':'Sätze einsprechen')+'</button>';
    h+='<p class="leise" style="margin-top:8px">'+(stand.uebrig>0?'Noch '+stand.uebrig+' von '+stand.max+' Mal einsprechen möglich. Gleicher Name zählt nicht neu.':'Alle '+stand.max+' Mal eingesprochen.')+
       (t?' Das Tablet holt die Sätze beim nächsten Öffnen mit Internet.':'')+'</p>';
    return h;
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
  function audioAus(saetze){ audio={}; Object.keys(saetze||{}).forEach(function(k){ if(saetze[k] && saetze[k].b64) audio[k]=saetze[k].b64; }); }
  function laden(){
    if(!Konto.angemeldet() || !(party()||{}).server) return;
    Konto.namenStand(thema).then(function(s){
      if(!s) return; stand=s; fehler='';
      zeichnen();
      if(s.hash){ melden(); }
      if(s.hash) Konto.namenHolen(thema).then(function(r){ if(r && r.saetze){ audioAus(r.saetze); zeichnen(); } }, function(){});
    }, function(e){ fehler=e.message||'Laden ging nicht.'; zeichnen(); });
  }
  function hoeren(k){
    if(!audio[k]) return;
    try{ if(spieler) spieler.pause(); spieler=new Audio('data:audio/mpeg;base64,'+audio[k]); var pr=spieler.play(); if(pr && pr['catch']) pr['catch'](function(){}); }catch(e){}
  }
  function erzeugen(){
    var name=(document.getElementById('namen-name')||{}).value||'', aus=(document.getElementById('namen-aussprache')||{}).value||'';
    name=name.trim(); aus=aus.trim();
    if(!name){ fehler='Bitte den Vornamen eintragen.'; zeichnen(); return; }
    var p=party(); laeuft=true; fehler=''; stand.name=name; stand.aussprache=aus; zeichnen();
    Konto.namenErzeugen(thema, name, aus, p.kind && p.kind.alter).then(function(r){
      laeuft=false; stand.uebrig=r.uebrig; stand.max=r.max; stand.hash=r.hash;
      stand.texte={}; Object.keys(r.saetze||{}).forEach(function(k){ stand.texte[k]=r.saetze[k].text; });
      audioAus(r.saetze); zeichnen(); hoeren('gruss'); melden();
    }, function(e){ laeuft=false; fehler=e.message||'Das ging nicht.'; if(e.daten && typeof e.daten.uebrig==='number') stand.uebrig=e.daten.uebrig; zeichnen(); });
  }
  document.addEventListener('click', function(ev){
    var t=ev.target; if(!t.closest) return;
    var h=t.closest('[data-namen-hoeren]'); if(h){ hoeren(h.getAttribute('data-namen-hoeren')); return; }
    if(t.closest('#namen-los')) erzeugen();
  });
  root.addEventListener('konto', function(ev){ if(ev.detail && ev.detail.thema===thema && ev.detail.art==='angemeldet'){ stand=null; setTimeout(laden, 0); } });
  var stil=document.createElement('style');
  stil.textContent='.namen .zeile{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 0;border-top:1px solid var(--linie,#2F2740)}.namen .zeile:first-child{border-top:0}'+
    '.namen .zeile .leise{font-size:.9rem}.namen .zeile button{white-space:nowrap;flex:none}.namen-saetze{margin-bottom:12px}.namen-feld{display:block;margin:0 0 10px;font-weight:700;font-size:.92rem}'+
    '.namen-feld input{display:block;width:100%;box-sizing:border-box;margin-top:6px;font:inherit;font-weight:400;font-size:1.05rem;padding:11px 13px;border-radius:12px;border:1.5px solid var(--linie,#2F2740);background:var(--panel,#17121F);color:inherit}'+
    '.namen-fehler{color:var(--rot,#F87171);margin:4px 0 10px}#namen{scroll-margin-top:84px}';
  document.head.appendChild(stil);
  root.Namen={karte:karte};
})(this);
