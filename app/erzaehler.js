// Erzähler (UNICORN-54): die Figur, die den Kindern an den Stationen die Aufgaben vorliest.
// Eine Stelle für Namen, Auswahl-Zeilen und Hörprobe: Party-Assistent, „So spielt ihr“ und Startklar nutzen dasselbe.
// Das Spiel behält seine eigene Auswahl unter „Erwachsene“ → „Einrichten“; die Wahl wandert über party.erz und den Tourplan dorthin.
(function(root){
  'use strict';
  function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
  function reihe(tour){ return (tour && tour.erzaehler && tour.erzaehler.reihe) || []; }
  function gibt(tour){ return reihe(tour).length>1; }                                   // nur Themen mit mehreren Erzählern haben eine Wahl
  function figur(tour, f){ return ((tour.erzaehler||{}).figuren||{})[f] || {}; }
  function wahl(tour, p){ var r=reihe(tour), e=p && p.erz; return r.indexOf(e)>=0 ? e : (r[0]||null); }   // ohne Wahl: die erste Figur, wie im Spiel
  function name(tour, f){ return figur(tour, f).name || ''; }
  function kurz(tour, f){ return figur(tour, f).kurz || name(tour, f); }
  function bild(tour, f){ var x=(tour.figuren||[]).filter(function(g){ return g.id===f; })[0]; return (x && x.bild) || 'themen/'+tour.id+'/figuren/'+f+'.svg'; }
  function probe(tour, f){ return 'themen/'+tour.id+'/erzaehler/'+f+'.mp3'; }
  function satz(tour, p){ var f=wahl(tour, p); return f ? kurz(tour, f)+' liest vor' : ''; }   // „Kakapups liest vor“

  var PLAY='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" fill="currentColor"/></svg>';
  var PAUSE='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5.5h3.6v13H7zM13.4 5.5H17v13h-3.6z" fill="currentColor"/></svg>';
  var CSS='.erz-liste{display:grid;gap:8px}'+
    '@media (min-width:620px){.erz-liste{grid-template-columns:1fr 1fr}}'+
    '.erz-zeile{display:flex;align-items:stretch;background:var(--karte,#1F1929);border:2px solid var(--linie,#2F2740);border-radius:16px;overflow:hidden}'+
    '.erz-zeile.an{border-color:var(--akzent,#A78BFA);background:color-mix(in srgb,var(--akzent,#A78BFA) 14%,var(--karte,#1F1929))}'+
    '.erz-waehle{flex:1;min-width:0;display:flex;align-items:center;gap:12px;padding:8px 6px 8px 10px;min-height:64px;background:none;border:0;color:inherit;font:inherit;text-align:left;cursor:pointer}'+
    '.erz-waehle img{flex:none;width:48px;height:48px;border-radius:50%;background:rgba(255,255,255,.92);object-fit:contain}'+
    '.erz-waehle .t{flex:1;min-width:0;line-height:1.25}.erz-waehle b{display:block}'+
    '.erz-waehle small{display:block;color:var(--leise,#B3A9C4);font-size:.84rem}'+
    '.erz-waehle .ring{flex:none;width:22px;height:22px;border-radius:50%;border:2px solid var(--leise,#B3A9C4);display:grid;place-items:center}'+
    '.erz-zeile.an .ring{border-color:var(--akzent,#A78BFA);background:var(--akzent,#A78BFA)}'+
    '.erz-zeile.an .ring::after{content:"";width:9px;height:5px;border-left:2.5px solid #160C2B;border-bottom:2.5px solid #160C2B;transform:rotate(-45deg) translate(1px,-1px)}'+
    '.erz-hoer{flex:none;width:56px;display:grid;place-items:center;background:none;border:0;border-left:1px solid var(--linie,#2F2740);color:var(--akzent,#A78BFA);cursor:pointer}'+
    '.erz-hoer span{width:38px;height:38px;border-radius:50%;display:grid;place-items:center;background:color-mix(in srgb,var(--akzent,#A78BFA) 18%,transparent)}'+
    '.erz-hoer svg{width:20px;height:20px}'+
    '.erz-hoer.spielt span{background:var(--akzent,#A78BFA);color:#160C2B}'+
    '.erz-waehle:focus-visible,.erz-hoer:focus-visible{outline-offset:-3px}';
  var cssDa=false;
  function css(){ if(cssDa || typeof document==='undefined') return; cssDa=true; var s=document.createElement('style'); s.textContent=CSS; document.head.appendChild(s); }

  // Auswahl: je Figur eine Zeile mit Bild, Name, einem Satz zum Charakter und Hörprobe
  function zeilen(tour, gewaehlt){
    css();
    return '<div class="erz-liste" role="group" aria-label="Wer liest die Aufgaben vor?">'+reihe(tour).map(function(f){
      var an=f===gewaehlt, x=figur(tour, f);
      return '<div class="erz-zeile'+(an?' an':'')+'"><button type="button" class="erz-waehle" data-erz="'+esc(f)+'" aria-pressed="'+an+'">'+
        '<img src="'+esc(bild(tour, f))+'" alt="" width="48" height="48"><span class="t"><b>'+esc(x.name)+'</b><small>'+esc(x.was||'')+'</small></span><span class="ring" aria-hidden="true"></span></button>'+
        '<button type="button" class="erz-hoer'+(laeuft===f?' spielt':'')+'" data-erz-hoer="'+esc(f)+'" aria-label="'+esc(x.name)+' anhören"><span>'+(laeuft===f?PAUSE:PLAY)+'</span></button></div>';
    }).join('')+'</div>';
  }

  // Hörprobe: immer nur eine, zweiter Tipp hält sie an
  var ton=null, laeuft=null;
  function zeichneKnoepfe(){
    if(typeof document==='undefined') return;
    Array.prototype.forEach.call(document.querySelectorAll('[data-erz-hoer]'), function(b){
      var an=b.getAttribute('data-erz-hoer')===laeuft; b.classList.toggle('spielt', an);
      var s=b.querySelector('span'); if(s) s.innerHTML=an?PAUSE:PLAY;
    });
  }
  function still(){ if(ton){ try{ ton.pause(); }catch(e){} ton=null; } laeuft=null; zeichneKnoepfe(); }
  function hoeren(tour, f, fehler){
    if(laeuft===f){ still(); return; }
    still();
    try{
      var a=new Audio(probe(tour, f)); ton=a; laeuft=f; zeichneKnoepfe();
      a.addEventListener('ended', function(){ if(ton===a) still(); });
      a.addEventListener('error', function(){ if(ton===a){ still(); if(fehler) fehler(); } });
      var pr=a.play(); if(pr && pr['catch']) pr['catch'](function(){ if(ton===a) still(); });
    }catch(e){ still(); }
  }
  root.Erzaehler={reihe:reihe, gibt:gibt, wahl:wahl, name:name, kurz:kurz, bild:bild, probe:probe, satz:satz, zeilen:zeilen, hoeren:hoeren, still:still, laeuft:function(){ return laeuft; }};
})(typeof window!=='undefined' ? window : this);
