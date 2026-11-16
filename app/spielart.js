// Spielart (UNICORN-47): Draußen oder Drinnen, dazu draußen das Extra „Echte Hinweise am Weg“.
// Intern bleiben die Varianten a (draußen), b (draußen mit Extra) und c (drinnen), damit gespeicherte Partys weiterlaufen.
// Eine Stelle für Namen, Karten und den Hinweis beim Wechsel: Planer, Party und Spiel nutzen dasselbe.
(function(root){
  'use strict';
  function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
  function ort(v){ return v==='c' ? 'drinnen' : 'draussen'; }
  function hinweise(v){ return v==='b'; }
  function aus(o, mitHinweisen){ return o==='drinnen' ? 'c' : (mitHinweisen ? 'b' : 'a'); }
  function name(tour, v){ return ((tour.varianten||{})[v]||{}).name || ''; }
  function bild(tour, b){ return 'themen/'+tour.id+'/spielart/'+b+'.svg'; }

  var CSS='.spielarten{display:grid;grid-template-columns:1fr 1fr;gap:10px}'+
    '.spielarten button{display:flex;flex-direction:column;gap:6px;text-align:left;background:var(--karte,#1F1929);color:inherit;font:inherit;border:2px solid var(--linie,#2F2740);border-radius:16px;padding:10px;cursor:pointer;min-height:44px}'+
    '.spielarten button[aria-pressed=true]{border-color:var(--akzent,#A78BFA);background:color-mix(in srgb,var(--akzent,#A78BFA) 14%,var(--karte,#1F1929))}'+
    '.spielarten img{width:100%;height:auto;border-radius:10px;display:block}'+
    '.spielarten b{font-size:1.05rem}.spielarten span{color:var(--leise,#B3A9C4);font-size:.86rem;line-height:1.3}'+
    '.spielarten small{color:var(--leise,#B3A9C4);font-size:.8rem;line-height:1.3}.spielarten small em{font-style:normal;color:var(--text,#F5F2FA)}'+
    '.sa-extra{display:flex;gap:12px;align-items:flex-start;margin-bottom:12px;background:var(--karte,#1F1929);border:2px solid var(--linie,#2F2740);border-radius:16px;padding:12px}'+
    '.sa-extra.an{border-color:var(--akzent,#A78BFA)}.sa-extra img{width:96px;flex:0 0 96px;border-radius:10px}'+
    '.sa-extra div{flex:1;min-width:0}.sa-extra b{display:block}.sa-extra span,.sa-extra small{display:block;color:var(--leise,#B3A9C4);font-size:.86rem;line-height:1.35;margin-top:3px}'+
    '.sa-extra label{display:flex;justify-content:flex-start;align-items:center;gap:8px;text-align:left;margin-top:8px;font-weight:700;cursor:pointer}.sa-extra input{width:22px;height:22px;accent-color:var(--akzent,#A78BFA)}'+
    '.sa-wechsel{background:color-mix(in srgb,var(--gelb,#FACC15) 10%,var(--karte,#1F1929));border:1.5px solid color-mix(in srgb,var(--gelb,#FACC15) 50%,transparent);border-radius:14px;padding:10px 12px;font-size:.9rem;line-height:1.4}'+
    '.sa-wechsel b{display:block;margin-bottom:2px}.sa-wechsel ul{margin:4px 0 0;padding-left:18px}';
  var cssDa=false;
  function css(){ if(cssDa || typeof document==='undefined') return; cssDa=true; var s=document.createElement('style'); s.textContent=CSS; document.head.appendChild(s); }

  // Zwei Karten: Draußen und Drinnen, mit Bild, Satz und „Dazu brauchst du“
  function karten(tour, v){
    css();
    var o=v ? ort(v) : null;
    function karte(k, key){
      var x=tour.varianten[k]||{};
      return '<button type="button" data-spielart="'+key+'" aria-pressed="'+(o===key)+'"><img src="'+esc(bild(tour, x.bild||key))+'" alt="" width="160" height="100">'+
        '<b>'+esc(x.name)+'</b><span>'+esc(x.kurz)+'</span>'+(x.braucht?'<small><em>Dazu brauchst du:</em> '+esc(x.braucht)+'</small>':'')+'</button>';
    }
    return '<div class="spielarten" role="group" aria-label="Wo spielt ihr?">'+karte('a','draussen')+karte('c','drinnen')+'</div>';
  }
  // Karte für das Extra mit Schalter (nur draußen)
  function extraKarte(tour, an, id){
    css();
    var e=tour.extra||{};
    return '<div class="sa-extra'+(an?' an':'')+'"><img src="'+esc(bild(tour, e.bild||'hinweise'))+'" alt="" width="96" height="60"><div><b>Extra: '+esc(e.titel)+'</b><span>'+esc(e.text)+'</span>'+
      (e.braucht?'<small>Dazu brauchst du: '+esc(e.braucht)+'</small>':'')+
      '<label><input type="checkbox" id="'+esc(id||'extra-hinweise')+'"'+(an?' checked':'')+'> '+(an?'Ist eingeschaltet':'Einschalten')+'</label></div></div>';
  }
  // Was sich beim Wechsel ändert (Vorbereitung, Route, Tablet). Leer, wenn sich nichts ändert.
  function wechsel(tour, von, nach){
    if(!von || !nach || von===nach) return '';
    var vb=tour.vorbereitung||{}, noetig=vb.noetig||[];
    function fuer(v){ return noetig.filter(function(x){ return !x.nur || x.nur.indexOf(v)>=0; }).map(function(x){ return x.x; }); }
    var alt=fuer(von), neu=fuer(nach);
    var dazu=neu.filter(function(x){ return alt.indexOf(x)<0; }), weg=alt.filter(function(x){ return neu.indexOf(x)<0; });
    var l=[];
    if(dazu.length) l.push('Kommt dazu: '+dazu.join(', '));
    if(weg.length) l.push('Fällt weg: '+weg.join(', '));
    if(ort(von)!==ort(nach)) l.push(ort(nach)==='drinnen' ? 'Drinnen braucht keine Route. Die geplante Route bleibt gespeichert und kommt beim Zurückwechseln wieder.' : 'Draußen braucht eine Route. Der Planer hilft dabei.');
    else l.push('Die Route bleibt, wie sie ist. Das Spiel nimmt an Station 2, 4 und 6 andere Texte.');
    l.push('Ist das Tablet schon eingerichtet, dort den Spiel-Link einmal neu öffnen.');
    return '<div class="sa-wechsel" role="status"><b>Wechsel zu „'+esc(name(tour, nach))+'“</b><ul>'+l.map(function(x){ return '<li>'+esc(x)+'</li>'; }).join('')+'</ul></div>';
  }
  root.Spielart={ort:ort, hinweise:hinweise, aus:aus, name:name, karten:karten, extraKarte:extraKarte, wechsel:wechsel, css:css};
})(typeof window!=='undefined' ? window : this);
