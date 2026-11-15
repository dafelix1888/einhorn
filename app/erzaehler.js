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
    '.erz-zeile{display:flex;flex-wrap:wrap;align-items:stretch;background:var(--karte,#1F1929);border:2px solid var(--linie,#2F2740);border-radius:16px;overflow:hidden}'+
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
    '.erz-waehle:focus-visible,.erz-hoer:focus-visible{outline-offset:-3px}'+
    /* Bühne (UNICORN-59): die Zeile fächert auf, die Figur ploppt herein und spricht */
    '.erz-buehne{flex-basis:100%;position:relative;height:180px;overflow:hidden;border-top:1px solid var(--linie,#2F2740);background:radial-gradient(ellipse at 50% 115%,rgba(167,139,250,.45),transparent 62%),radial-gradient(circle at 20% 30%,rgba(253,230,138,.12),transparent 30%),#140F1D}'+
    '.erz-buehne .kk{position:absolute;left:50%;bottom:-6px;height:176px;width:auto;margin-left:-70px;overflow:visible;transform-origin:50% 100%}'+
    '.erz-buehne .kk-wolke,.erz-buehne .kk-mini,.erz-buehne .kk-extra{display:none}'+
    '.erz-buehne .kk .kk-kopf{transform-origin:120px 230px;transform-box:view-box}'+
    '.erz-buehne .name{position:absolute;left:12px;top:10px;font-size:.8rem;font-weight:700;color:var(--leise,#B3A9C4);background:rgba(20,15,29,.7);padding:3px 10px;border-radius:999px}'+
    '.erz-buehne .welle{position:absolute;right:14px;top:12px;display:flex;gap:3px;align-items:flex-end;height:18px}'+
    '.erz-buehne .welle i{width:4px;border-radius:2px;background:var(--akzent,#A78BFA);height:20%}'+
    '@media (prefers-reduced-motion:no-preference){'+
      '.erz-buehne{animation:erz-auf .38s cubic-bezier(.2,.9,.3,1) both}.erz-buehne.zu{animation:erz-zu .3s ease-in both}'+
      '.erz-buehne .kk{animation:erz-plopp .55s .12s cubic-bezier(.3,1.6,.45,1) both}'+
    '}'+
    '.erz-buehne.still,.erz-buehne.still .kk{animation:none!important}'+
    '@keyframes erz-auf{from{height:0}to{height:180px}}@keyframes erz-zu{from{height:180px}to{height:0}}'+
    '@keyframes erz-plopp{from{opacity:0;transform:translateY(30%) scale(.4)}to{opacity:1;transform:none}}';
  var cssDa=false;
  function css(){ if(cssDa || typeof document==='undefined') return; cssDa=true; var s=document.createElement('style'); s.textContent=CSS; document.head.appendChild(s); }

  // Auswahl: je Figur eine Zeile mit Bild, Name, einem Satz zum Charakter und Hörprobe
  function zeilen(tour, gewaehlt){
    css(); if(typeof fetch!=='undefined') figurenHolen(tour);
    return '<div class="erz-liste" role="group" aria-label="Wer liest die Aufgaben vor?">'+reihe(tour).map(function(f){
      var an=f===gewaehlt, x=figur(tour, f);
      return '<div class="erz-zeile'+(an?' an':'')+(laeuft===f?' offen':'')+'" data-erz-zeile="'+esc(f)+'"><button type="button" class="erz-waehle" data-erz="'+esc(f)+'" aria-pressed="'+an+'">'+
        '<img src="'+esc(bild(tour, f))+'" alt="" width="48" height="48"><span class="t"><b>'+esc(x.name)+'</b><small>'+esc(x.was||'')+'</small></span><span class="ring" aria-hidden="true"></span></button>'+
        '<button type="button" class="erz-hoer'+(laeuft===f?' spielt':'')+'" data-erz-hoer="'+esc(f)+'" aria-label="'+esc(x.name)+' anhören" aria-expanded="'+(laeuft===f)+'"><span>'+(laeuft===f?PAUSE:PLAY)+'</span></button>'+
        (laeuft===f ? buehneHtml(tour, f, true) : '')+'</div>';
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
  // ---------- Figur auf der Bühne (UNICORN-59) ----------
  // Die Figuren sind dieselben wie im Spiel (themen/<id>/erzaehler/figuren.html, Kopie aus spiel.html #kaka).
  var figurSvg={}, figurenLaden=null, pegel=null, zaehler=0;
  function figurenHolen(tour){
    if(figurenLaden) return figurenLaden;
    figurenLaden=fetch('themen/'+encodeURIComponent(tour.id)+'/erzaehler/figuren.html').then(function(r){ return r.ok ? r.text() : ''; }).then(function(t){
      var m, re=/<svg[^>]*data-figur="([a-z]+)"[\s\S]*?<\/svg>/g;
      while((m=re.exec(t))) figurSvg[m[1]]=m[0].replace(/\shidden(="")?(?=[\s>])/, '');
    }, function(){});
    return figurenLaden;
  }
  function svgFuer(f){
    var s=figurSvg[f]; if(!s) return '';
    var n='e'+(++zaehler);                       // eigene IDs je Bühne, falls eine alte gerade noch zuklappt
    return s.replace(/(id="|url\(#)kk-(braun|kittel|wolke)/g, '$1'+n+'-$2');
  }
  function buehneHtml(tour, f, ohneAnimation){
    var x=figur(tour, f);
    return '<div class="erz-buehne'+(ohneAnimation?' still':'')+'" data-buehne="'+esc(f)+'" aria-hidden="true">'+svgFuer(f)+
      '<span class="name">'+esc(x.kurz||x.name)+' spricht</span><span class="welle"><i></i><i></i><i></i><i></i></span></div>';
  }
  function buehneAuf(tour, f){
    if(typeof document==='undefined') return;
    var z=document.querySelector('[data-erz-zeile="'+f+'"]'); if(!z) return;
    var weg=z.querySelector('.erz-buehne'); if(weg) weg.remove();
    z.classList.add('offen'); z.insertAdjacentHTML('beforeend', buehneHtml(tour, f));
    var h=z.querySelector('[data-erz-hoer]'); if(h) h.setAttribute('aria-expanded','true');
    if(!figurSvg[f]) figurenHolen(tour).then(function(){                         // Figuren kamen erst jetzt: nachreichen
      var b=document.querySelector('.erz-buehne[data-buehne="'+f+'"]'); if(b && !b.querySelector('svg') && laeuft===f) b.insertAdjacentHTML('afterbegin', svgFuer(f));
    });
    try{ z.scrollIntoView({block:'nearest', behavior:'smooth'}); }catch(e){}
  }
  function buehneZu(){
    if(typeof document==='undefined') return;
    Array.prototype.forEach.call(document.querySelectorAll('.erz-buehne'), function(b){
      var z=b.parentNode; if(z){ z.classList.remove('offen'); var h=z.querySelector('[data-erz-hoer]'); if(h) h.setAttribute('aria-expanded','false'); }
      b.classList.add('zu'); setTimeout(function(){ if(b.parentNode) b.parentNode.removeChild(b); }, 320);
    });
  }
  // Mund folgt der Lautstärke (Web Audio); geht das nicht, spricht die Figur im gleichmäßigen Takt
  var actx=null;
  function pegelVon(a){
    try{
      var AC=window.AudioContext||window.webkitAudioContext; if(!AC) return null;
      actx=actx||new AC(); if(actx.state==='suspended') actx.resume();
      if(actx.state!=='running') return null;     // sonst wäre der Ton stumm (Safari): dann nur gleichmäßiger Takt
      var q=actx.createMediaElementSource(a), an=actx.createAnalyser(); an.fftSize=512;
      q.connect(an); an.connect(actx.destination);
      var d=new Uint8Array(an.fftSize);
      return function(){ an.getByteTimeDomainData(d); var s=0; for(var i=0;i<d.length;i+=4){ var v=(d[i]-128)/128; s+=v*v; } return Math.min(1, Math.sqrt(s/(d.length/4))*4.5); };
    }catch(e){ return null; }
  }
  var ruhig=false; try{ ruhig=window.matchMedia('(prefers-reduced-motion: reduce)').matches; }catch(e){}
  function animieren(){
    var m=0, blinzelnAb=0, naechstes=performance.now()+1500, start=performance.now(), meins=laeuft;
    (function bild(t){
      if(laeuft!==meins || !meins) return;
      var b=document.querySelector('.erz-buehne[data-buehne="'+meins+'"]:not(.zu)'), sv=b && b.querySelector('svg.kk');
      if(sv){
        var p=0; if(ton && !ton.paused){ if(pegel){ try{ p=pegel(); }catch(e){ p=0; } } else p=.35+.35*Math.sin((t-start)/90); }
        m+=(p-m)*(p>m?.6:.3);
        var mund=sv.querySelector('.kk-mund-innen'), zunge=sv.querySelector('.kk-zunge'), kopf=sv.querySelector('.kk-kopf'), brauen=sv.querySelector('.kk-brauen');
        if(mund){ var ry0=+(mund.getAttribute('data-ry')||mund.getAttribute('ry')); mund.setAttribute('data-ry', ry0); mund.setAttribute('ry', (ry0+m*13).toFixed(1)); }
        if(zunge) zunge.setAttribute('cy', (3+m*6).toFixed(1));
        if(brauen) brauen.setAttribute('transform','translate(0 '+(-m*5).toFixed(1)+')');
        if(t>naechstes){ blinzelnAb=t; naechstes=t+2000+Math.random()*2500; }
        var bl=t-blinzelnAb<150 ? Math.sin((t-blinzelnAb)/150*Math.PI) : 0;
        Array.prototype.forEach.call(sv.querySelectorAll('.kk-auge'), function(a){ a.setAttribute('transform','translate('+a.getAttribute('data-x')+' '+a.getAttribute('data-y')+') scale(1 '+(1-bl*.9).toFixed(2)+')'); });
        if(kopf && !ruhig) kopf.style.transform='rotate('+(Math.sin(t/380)*3+m*2).toFixed(2)+'deg)';
        Array.prototype.forEach.call(b.querySelectorAll('.welle i'), function(w, i){ w.style.height=(20+Math.max(0, m-.08*i)*95).toFixed(0)+'%'; });
      }
      requestAnimationFrame(bild);
    })(performance.now());
  }
  function still(){ if(ton){ try{ ton.pause(); }catch(e){} ton=null; } pegel=null; laeuft=null; zeichneKnoepfe(); buehneZu(); }
  function hoeren(tour, f, fehler){
    if(laeuft===f){ still(); return; }
    still();
    try{
      var a=new Audio(probe(tour, f)); ton=a; laeuft=f; zeichneKnoepfe();
      buehneAuf(tour, f); pegel=pegelVon(a); animieren();
      a.addEventListener('ended', function(){ if(ton===a) still(); });
      a.addEventListener('error', function(){ if(ton===a){ still(); if(fehler) fehler(); } });
      var pr=a.play(); if(pr && pr['catch']) pr['catch'](function(){ if(ton===a) still(); });
    }catch(e){ still(); }
  }
  root.Erzaehler={vorladen:figurenHolen, reihe:reihe, gibt:gibt, wahl:wahl, name:name, kurz:kurz, bild:bild, probe:probe, satz:satz, zeilen:zeilen, hoeren:hoeren, still:still, laeuft:function(){ return laeuft; }};
})(typeof window!=='undefined' ? window : this);
