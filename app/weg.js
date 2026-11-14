// Klickwege (UNICORN-25): wohin „Zuhause“ und „Zurück“ führen.
// Zuhause: Eltern mit Party → ihre Party-Übersicht, alle anderen → Landingpage. Der Katalog („Alle Abenteuer“)
// ist nie Ziel von Zuhause oder Zurück, nur von eigenen Links.
// Zurück: einen Schritt zurück, wenn die vorige Seite aus der App kommt, sonst zum festen Ersatzziel.
(function(root){
  function lies(k){ try{ return JSON.parse(localStorage.getItem(k)); }catch(e){ return null; } }
  function party(thema){ var p=lies('sj.party.'+(thema||'einhorn')); return p && p.thema ? p : null; }
  function plan(thema){ var p=lies('sj.plan.'+(thema||'einhorn')); return p && p.stationen && p.stationen.length>1 ? p : null; }
  function erstesThemaMitParty(){
    try{ for(var i=0;i<localStorage.length;i++){ var k=localStorage.key(i); if(/^sj\.party\./.test(k) && party(k.slice(9))) return k.slice(9); } }catch(e){}
    return null;
  }
  function heim(thema){
    var t=thema && party(thema) ? thema : erstesThemaMitParty();
    return t ? 'party.html?thema='+encodeURIComponent(t) : 'landing.html';
  }
  // Kam man von einer Seite der App (gleiche Herkunft)? Dann ist „Zurück“ im Browser richtig.
  function vonSeite(muster){ try{ return document.referrer && new URL(document.referrer).origin===location.origin && muster.test(new URL(document.referrer).pathname); }catch(e){ return false; } }
  function zurueck(ersatz){
    if(history.length>1 && vonSeite(/\/(app\/|ideen\/)/)){ history.back(); return; }
    location.href=ersatz;
  }
  // Links mit data-heim bekommen das Zuhause-Ziel, Links mit data-zurueck="<Ersatz>" gehen einen Schritt zurück.
  function verdrahten(thema){
    var t=thema || new URLSearchParams(location.search).get('thema') || null;
    Array.prototype.forEach.call(document.querySelectorAll('[data-heim]'), function(a){ a.href=heim(t); });
    Array.prototype.forEach.call(document.querySelectorAll('[data-zurueck]'), function(a){
      if(a.__weg) return; a.__weg=true;
      a.addEventListener('click', function(ev){ ev.preventDefault(); zurueck(a.getAttribute('data-zurueck')||heim(t)); });
    });
  }
  // Wegweiser (UNICORN-54): die vier Abschnitte von der Route bis zur Party, damit man auf jeder Seite sieht, wo man ist.
  // Reine Anzeige, keine Links: Zurück und Zuhause bleiben, wie oben beschrieben.
  var ABSCHNITTE=[['route','Route'],['party','Party'],['vorbereiten','Vorbereiten'],['feiern','Feiern']];
  var WW_CSS='.wegweiser{list-style:none;display:flex;align-items:center;gap:6px;margin:0 0 12px;padding:0;font-size:.8rem;font-weight:700;color:var(--leise,#B3A9C4);white-space:nowrap}'+
    '.wegweiser li{display:flex;align-items:center;gap:5px;min-width:0}'+
    '.wegweiser li+li::before{content:"";width:10px;height:2px;border-radius:1px;background:var(--linie,#2F2740);margin-right:1px;flex:none}'+
    '.wegweiser i{flex:none;font-style:normal;width:19px;height:19px;border-radius:50%;display:grid;place-items:center;font-size:.7rem;border:1.5px solid var(--linie,#2F2740)}'+
    '.wegweiser .war i{background:var(--gruen,#4ADE80);border-color:var(--gruen,#4ADE80);color:#062B12}'+
    '.wegweiser .hier{color:var(--text,#F5F2FA)}.wegweiser .hier i{background:var(--akzent,#A78BFA);border-color:var(--akzent,#A78BFA);color:#160C2B}'+
    '@media (max-width:350px){.wegweiser li:not(.hier) span{display:none}}';
  var wwCss=false;
  function pfad(aktiv){
    if(!wwCss && typeof document!=='undefined'){ wwCss=true; var st=document.createElement('style'); st.textContent=WW_CSS; document.head.appendChild(st); }
    var nr=0; ABSCHNITTE.forEach(function(a, i){ if(a[0]===aktiv) nr=i; });
    return '<ol class="wegweiser" aria-label="Abschnitt '+(nr+1)+' von '+ABSCHNITTE.length+': '+ABSCHNITTE[nr][1]+'">'+ABSCHNITTE.map(function(a, i){
      return '<li class="'+(i<nr?'war':i===nr?'hier':'')+'"'+(i===nr?' aria-current="step"':'')+'><i aria-hidden="true">'+(i<nr?'✓':i+1)+'</i><span>'+a[1]+'</span></li>';
    }).join('')+'</ol>';
  }
  root.Weg={heim:heim, party:party, plan:plan, zurueck:zurueck, vonSeite:vonSeite, verdrahten:verdrahten, themaMitParty:erstesThemaMitParty, pfad:pfad};
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', function(){ verdrahten(); }); else verdrahten();
})(window);
