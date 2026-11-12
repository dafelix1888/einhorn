// Kurze Einführung für Erwachsene (UNICORN-39): zeigt, wie man im Spiel zu jedem Schritt springt.
// Wird vor dem Spielstart einmal angeboten (Startklar-Seite und Spiel), lässt sich mit einem Tipp überspringen
// und merkt sich das im Gerät. Beim Spielstart kommt dazu einmal ein kurzer Hinweis, der nichts aufhält.
(function(){
  'use strict';
  var GESEHEN='sj.einfuehrung.gesehen', HINWEIS='sj.einfuehrung.hinweis';
  function lies(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } }
  function setz(k){ try{ localStorage.setItem(k, '1'); }catch(e){} }
  function ruhig(){ try{ return window.matchMedia('(prefers-reduced-motion: reduce)').matches; }catch(e){ return false; } }
  function el(tag, cls, html){ var e=document.createElement(tag); if(cls) e.className=cls; if(html!=null) e.innerHTML=html; return e; }

  var SCHLOSS='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';
  var SCHRITTE=[
    { titel:'Oben rechts ist dein Menü',
      text:'Im Spiel steht oben rechts „Erwachsene“. Dahinter liegt alles, was nur du brauchst. Kinder tippen dort nicht aus Versehen hinein.',
      bild:'<div class="einf-bild b1" aria-hidden="true"><span class="einf-leiste"><i></i><i></i><i></i></span><span class="einf-erw einf-ring">'+SCHLOSS+'Erwachsene</span></div>' },
    { titel:'Mit „Ablauf“ zu jedem Schritt springen',
      text:'Im Menü auf „Ablauf“ tippen und dann einen Schritt antippen. So lasst ihr eine Station aus, holt eine nach oder geht einen Schritt zurück.',
      bild:'<div class="einf-bild b2" aria-hidden="true"><ol><li class="war"><b></b>Start an der Haustür</li><li class="war"><b></b>Station 1</li><li class="hier einf-ring"><b></b>Station 2<em>antippen</em></li><li><b></b>Station 3</li></ol></div>' },
    { titel:'Funkel führt euch von selbst',
      text:'Funkel liest Aufgaben und Lösungen vor. Am Ziel öffnet sich die Station von allein. Klappt das GPS einmal nicht, tippst du unten auf „Wir sind da“.',
      bild:'<div class="einf-bild b3" aria-hidden="true"><span class="einf-spiegel"><i></i></span><span class="einf-knopf">Wir sind da</span></div>' }
  ];

  var CSS=
  '.einf{--e-fl:var(--surface,var(--karte,#1F1929));--e-tx:var(--ink,var(--text,#F5F2FA));--e-ak:var(--magic,var(--akzent,#A78BFA));--e-aktx:var(--magic-ink,#160C2B);--e-leise:var(--ink-soft,var(--leise,#B3A9C4));--e-li:var(--line,var(--linie,#2F2740));--e-tint:var(--tint,var(--hover,#2A2236))}'+
  '.einf-schleier{position:fixed;inset:0;z-index:4000;background:rgba(8,5,14,.72);display:grid;place-items:end center;padding:12px;padding-bottom:calc(12px + env(safe-area-inset-bottom,0px))}'+
  '@media (min-height:640px) and (min-width:560px){.einf-schleier{place-items:center}}'+
  '.einf-blatt{width:min(440px,100%);max-height:calc(100vh - 24px);overflow:auto;background:var(--e-fl);color:var(--e-tx);border-radius:22px;padding:18px 18px 16px;box-shadow:0 18px 50px rgba(0,0,0,.55);font-size:1rem;line-height:1.45}'+
  '.einf-kopf{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:0 0 10px}'+
  '.einf-zaehler{font-size:.85rem;color:var(--e-leise);font-weight:700;margin:0}'+
  '.einf-skip{background:none;border:0;color:var(--e-ak);font:inherit;font-weight:700;min-height:44px;padding:8px 4px;cursor:pointer;text-decoration:underline;text-underline-offset:3px}'+
  '.einf-blatt h2{font-size:1.3rem;line-height:1.2;margin:12px 0 6px}'+
  '.einf-blatt p.einf-text{margin:0 0 14px}'+
  '.einf-weiter{width:100%;min-height:52px;border:0;border-radius:999px;background:var(--e-ak);color:var(--e-aktx);font:inherit;font-weight:800;font-size:1.1rem;cursor:pointer}'+
  '.einf-skip:focus-visible,.einf-weiter:focus-visible,.einf-angebot button:focus-visible,.einf-tipp button:focus-visible{outline:3px solid var(--e-tx);outline-offset:2px}'+
  '.einf-bild{position:relative;height:132px;border-radius:16px;background:var(--e-tint);overflow:hidden;border:1px solid var(--e-li)}'+
  '.einf-ring{box-shadow:0 0 0 3px var(--e-fl),0 0 0 6px var(--e-ak)}'+
  '@media (prefers-reduced-motion:no-preference){.einf-ring{animation:einf-puls 1.6s ease-in-out infinite}.einf-blatt{animation:einf-rein .22s ease-out}}'+
  '@keyframes einf-puls{50%{box-shadow:0 0 0 3px var(--e-fl),0 0 0 11px color-mix(in srgb,var(--e-ak) 35%,transparent)}}'+
  '@keyframes einf-rein{from{opacity:0;transform:translateY(14px)}}'+
  '.einf-leiste{position:absolute;left:14px;top:18px;display:flex;gap:5px}.einf-leiste i{width:26px;height:12px;border-radius:12px 12px 0 0;background:var(--e-li)}'+
  '.einf-erw{position:absolute;right:16px;top:14px;display:inline-flex;align-items:center;gap:6px;padding:8px 12px;border-radius:999px;background:var(--e-fl);color:var(--e-tx);font-weight:700;font-size:.92rem}'+
  '.einf-erw svg{width:18px;height:18px}'+
  '.einf-bild.b2{padding:10px 14px}.einf-bild ol{list-style:none;margin:0;padding:0;font-size:.9rem}'+
  '.einf-bild li{position:relative;display:flex;align-items:center;gap:10px;padding:4px 8px;border-radius:10px;margin:0 0 3px;color:var(--e-leise)}'+
  '.einf-bild li b{width:13px;height:13px;border-radius:50%;border:2.5px solid var(--e-li);flex:0 0 auto}'+
  '.einf-bild li.war b{background:var(--e-ak);border-color:var(--e-ak)}'+
  '.einf-bild li.hier{background:var(--e-fl);color:var(--e-tx);font-weight:700}.einf-bild li.hier b{border-color:var(--e-ak)}'+
  '.einf-bild li em{margin-left:auto;font-style:normal;font-size:.78rem;color:var(--e-ak)}'+
  '.einf-spiegel{position:absolute;left:50%;top:12px;width:66px;height:66px;margin-left:-33px;border-radius:50%;border:5px solid var(--e-ak);background:var(--e-fl);display:grid;place-items:center}'+
  '.einf-spiegel i{width:22px;height:22px;border-radius:50%;background:var(--e-ak);opacity:.55}'+
  '.einf-knopf{position:absolute;left:50%;bottom:12px;transform:translateX(-50%);padding:7px 16px;border-radius:999px;border:2px dashed var(--e-leise);color:var(--e-tx);font-size:.9rem;font-weight:700;white-space:nowrap}'+
  '.einf-angebot{background:var(--e-fl);color:var(--e-tx);border:1px solid var(--e-li);border-radius:16px;padding:12px 14px;margin:14px 0;font-size:.95rem;line-height:1.4}'+
  '.einf-angebot b{display:block;margin-bottom:2px}'+
  '.einf-angebot .einf-zeile{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}'+
  '.einf-angebot button{min-height:44px;border-radius:999px;padding:8px 16px;font:inherit;font-weight:700;cursor:pointer;border:1.5px solid var(--e-leise);background:none;color:var(--e-tx)}'+
  '.einf-angebot button.einf-ja{background:var(--e-ak);border-color:var(--e-ak);color:var(--e-aktx)}'+
  '.einf-angebot.schwebt{position:fixed;left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom,0px));z-index:30;margin:0 auto;max-width:440px;box-shadow:0 12px 34px rgba(0,0,0,.5)}'+
  '.einf-tipp{position:fixed;right:10px;top:calc(64px + env(safe-area-inset-top,0px));z-index:40;max-width:min(300px,calc(100vw - 20px));text-align:left;background:var(--e-ak);color:var(--e-aktx);border-radius:16px;padding:10px 14px;font-size:.95rem;line-height:1.35;box-shadow:0 10px 28px rgba(0,0,0,.45);cursor:pointer}'+
  '.einf-tipp::before{content:"";position:absolute;right:38px;top:-7px;width:14px;height:14px;background:inherit;transform:rotate(45deg)}'+
  '.einf-tipp button{display:block;margin:2px 0 -6px -4px;min-height:36px;padding:4px;background:none;border:0;color:inherit;font:inherit;font-size:.85rem;font-weight:700;text-decoration:underline;cursor:pointer}';
  function stil(){ if(document.getElementById('einf-stil')) return; var s=el('style'); s.id='einf-stil'; s.textContent=CSS; document.head.appendChild(s); }

  var offen=null;
  // Die Einführung selbst: 3 kurze Karten. „Überspringen“ und Esc schließen sofort. In jedem Fall gilt sie danach als gesehen.
  function zeigen(opt){
    opt=opt||{}; if(offen) return; stil();
    var i=0, vorher=document.activeElement;
    var schleier=el('div','einf einf-schleier'), blatt=el('div','einf-blatt');
    blatt.setAttribute('role','dialog'); blatt.setAttribute('aria-modal','true'); blatt.setAttribute('aria-labelledby','einf-titel'); blatt.setAttribute('aria-describedby','einf-text');
    blatt.innerHTML='<div class="einf-kopf"><p class="einf-zaehler" id="einf-zaehler"></p><button type="button" class="einf-skip" id="einf-skip">Überspringen</button></div>'+
      '<div id="einf-bild"></div><div aria-live="polite"><h2 id="einf-titel" tabindex="-1"></h2><p class="einf-text" id="einf-text"></p></div>'+
      '<button type="button" class="einf-weiter" id="einf-weiter"></button>';
    schleier.appendChild(blatt); document.body.appendChild(schleier);
    var q=function(id){ return blatt.querySelector('#'+id); };
    function malen(){
      var s=SCHRITTE[i];
      q('einf-zaehler').textContent='Kurz erklärt · '+(i+1)+' von '+SCHRITTE.length;
      q('einf-bild').innerHTML=s.bild; q('einf-titel').textContent=s.titel; q('einf-text').textContent=s.text;
      q('einf-weiter').textContent=i===SCHRITTE.length-1 ? 'Los geht’s' : 'Weiter';
    }
    function zu(){
      setz(GESEHEN); document.removeEventListener('keydown', taste, true);
      if(schleier.parentNode) schleier.parentNode.removeChild(schleier); offen=null; angebotWeg();
      try{ if(vorher && vorher.focus && document.contains(vorher)) vorher.focus(); }catch(e){}
      if(opt.fertig) opt.fertig();
    }
    function taste(e){
      if(e.key==='Escape'){ e.preventDefault(); e.stopPropagation(); zu(); return; }
      if(e.key!=='Tab') return;
      var f=[q('einf-skip'), q('einf-weiter')], a=document.activeElement;        // Fokus bleibt im Fenster
      if(e.shiftKey && (a===f[0] || !blatt.contains(a))){ e.preventDefault(); f[1].focus(); }
      else if(!e.shiftKey && (a===f[1] || !blatt.contains(a))){ e.preventDefault(); f[0].focus(); }
    }
    q('einf-skip').addEventListener('click', zu);
    q('einf-weiter').addEventListener('click', function(){ if(i>=SCHRITTE.length-1){ zu(); return; } i++; malen(); });
    schleier.addEventListener('click', function(e){ if(e.target===schleier) zu(); });
    document.addEventListener('keydown', taste, true);
    offen={zu:zu}; malen();
    try{ q('einf-weiter').focus({preventScroll:true}); }catch(e){}
  }

  // Angebot vor dem Spielstart: eine kleine Karte, die nichts verdeckt und nichts aufhält.
  var angebotEl=null;
  function angebotWeg(){ if(angebotEl && angebotEl.parentNode) angebotEl.parentNode.removeChild(angebotEl); angebotEl=null; }
  function anbieten(opt){
    opt=opt||{}; if(lies(GESEHEN) || angebotEl || offen) return false; stil();
    var a=el('section','einf einf-angebot'+(opt.ziel?'':' schwebt'));
    a.id='einf-angebot'; a.setAttribute('aria-label','Kurze Einführung');
    a.innerHTML='<b>Zum ersten Mal dabei?</b>In einer halben Minute siehst du, wie du im Spiel zu jedem Schritt springst.'+
      '<div class="einf-zeile"><button type="button" class="einf-ja" id="einf-ja">Kurz ansehen</button><button type="button" id="einf-nein">Überspringen</button></div>';
    if(opt.ziel && opt.ziel.parentNode) opt.ziel.parentNode.insertBefore(a, opt.ziel); else document.body.appendChild(a);
    angebotEl=a;
    a.querySelector('#einf-ja').addEventListener('click', function(){ angebotWeg(); zeigen(); });
    a.querySelector('#einf-nein').addEventListener('click', function(){ setz(GESEHEN); angebotWeg(); });
    return true;
  }

  // Beim Spielstart: einmal ein kurzer Hinweis unter „Erwachsene“. Ein Tipp irgendwohin schließt ihn, das Spiel läuft weiter.
  var tippEl=null, tippT=null;
  function tippWeg(){ clearTimeout(tippT); document.removeEventListener('pointerdown', tippWeg, true); document.removeEventListener('keydown', tippTaste, true); if(tippEl && tippEl.parentNode) tippEl.parentNode.removeChild(tippEl); tippEl=null; }
  function tippTaste(e){ if(e.key==='Escape') tippWeg(); }
  function hinweis(){
    angebotWeg();
    if(lies(HINWEIS) || tippEl) return false; setz(HINWEIS); setz(GESEHEN); stil();
    var t=el('div','einf einf-tipp'); t.id='einf-tipp'; t.setAttribute('role','status');
    t.innerHTML='Für Erwachsene: Über „Erwachsene“ und „Ablauf“ springst du zu jedem Schritt.<button type="button" id="einf-tipp-zu">Schließen</button>';
    document.body.appendChild(t); tippEl=t;
    t.addEventListener('click', tippWeg);
    setTimeout(function(){ if(tippEl){ document.addEventListener('pointerdown', tippWeg, true); document.addEventListener('keydown', tippTaste, true); } }, 600);   // nicht vom Start-Tipp selbst geschlossen werden
    tippT=setTimeout(tippWeg, 12000);
    return true;
  }

  window.Einfuehrung={ zeigen:zeigen, anbieten:anbieten, hinweis:hinweis, gesehen:function(){ return !!lies(GESEHEN); }, ruhig:ruhig };
})();
