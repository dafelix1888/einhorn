// Führung für Erwachsene im Spiel (UNICORN-39, erweitert in UNICORN-54).
// 1. Einführung „Zum ersten Mal hier?“: kurze Karten zu Menü, Springen und dem, was man tut, wenn eine Station
//    zu früh oder gar nicht öffnet. Wird auf dem ersten Bildschirm des Spiels und auf der Startklar-Seite angeboten.
// 2. Hilfe: dieselben Inhalte als Liste zum Nachschlagen (Menü „Erwachsene“ → „Hilfe“).
// 3. Tipps: kurze Hinweise beim ersten Mal (Spielstart, unterwegs). Jeder kommt einmal und lässt sich ganz abschalten.
// Alles ist mit einem Tipp zu überspringen und hält das Spiel nie auf. Gemerkt wird nur im Gerät.
(function(){
  'use strict';
  var GESEHEN='sj.einfuehrung.v2',          // Einführung angesehen oder im Spiel übersprungen (v2: neue Inhalte, alle sehen sie einmal)
      BEREIT='sj.einfuehrung.bereit',       // Angebot auf der Startklar-Seite weggetippt; im Spiel kommt es trotzdem noch einmal
      TIPPS='sj.einfuehrung.tipps',         // gezeigte Tipps, z. B. {"start":1}
      AUS='sj.einfuehrung.tippsAus';        // Tipps ganz abgeschaltet
  function lies(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } }
  function setz(k, v){ try{ localStorage.setItem(k, v==null?'1':v); }catch(e){} }
  function weg(k){ try{ localStorage.removeItem(k); }catch(e){} }
  function ruhig(){ try{ return window.matchMedia('(prefers-reduced-motion: reduce)').matches; }catch(e){ return false; } }
  function el(tag, cls, html){ var e=document.createElement(tag); if(cls) e.className=cls; if(html!=null) e.innerHTML=html; return e; }
  function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }

  var SCHLOSS='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';
  // Karten der Einführung. nur: 'draussen' oder 'drinnen' = nur bei dieser Spielart. frage: Überschrift in der Hilfe.
  var KARTEN=[
    { id:'menue', titel:'Oben rechts ist dein Menü',
      text:'Hinter „Erwachsene“ liegt alles, was nur du brauchst: „Ablauf“ zum Springen, „Einrichten“ für Spielart, Erzähler und GPS, dazu „Hilfe“. Kinder tippen dort nicht aus Versehen hinein.',
      bild:'<div class="einf-bild b1" aria-hidden="true"><span class="einf-leiste"><i></i><i></i><i></i></span><span class="einf-erw einf-ring">'+SCHLOSS+'Erwachsene</span><span class="einf-menue"><i>Ablauf</i><i>Einrichten</i><i>Hilfe</i></span></div>' },
    { id:'ablauf', titel:'Mit „Ablauf“ zu jedem Schritt springen', frage:'Falscher Schritt oder zu weit getippt',
      text:'Im Menü auf „Ablauf“ tippen und dann einen Schritt antippen. So lasst ihr eine Station aus, holt eine nach oder geht einen Schritt zurück.',
      bild:'<div class="einf-bild b2" aria-hidden="true"><ol><li class="war"><b></b>Start an der Haustür</li><li class="war"><b></b>Station 1</li><li class="hier einf-ring"><b></b>Station 2<em>antippen</em></li><li><b></b>Station 3</li></ol></div>' },
    { id:'ankunft', nur:'draussen', titel:'Stationen öffnen sich von selbst', frage:'Station meldet sich zu früh',
      text:'Am Ziel meldet der Spiegel „Angekommen!“. Die Aufgabe beginnt erst, wenn du „Weiter“ tippst. Kommt die Meldung ein paar Meter zu früh: in Ruhe bis zur Stelle laufen und erst dort tippen.',
      bild:'<div class="einf-bild b4" aria-hidden="true"><span class="einf-spiegel"><i></i></span><span class="einf-plakette"><b>Angekommen!</b><span class="einf-voll einf-ring">Weiter</span></span></div>' },
    { id:'hand', nur:'draussen', titel:'Öffnet sich eine Station nicht?', frage:'Station öffnet sich nicht',
      text:'Ist das GPS unsicher, fragt der Spiegel „Fast da!“ und du tippst „Wir sind da“. Kommt gar nichts, tippst du unter dem Spiegel „Station von Hand öffnen“.',
      bild:'<div class="einf-bild b5" aria-hidden="true"><span class="einf-voll einf-ring">Wir sind da</span><span class="einf-knopf">Station von Hand öffnen</span></div>' },
    { id:'raum', nur:'drinnen', titel:'Drinnen öffnest du jede Station selbst', frage:'Station öffnen (drinnen)',
      text:'Geht zum nächsten Raum und tippt dort „Station öffnen“. Welcher Raum dran ist, zeigt der „Ablauf“ im Menü.',
      bild:'<div class="einf-bild b5" aria-hidden="true"><span class="einf-raum">Küche · Flur · Treppe</span><span class="einf-voll einf-ring">Station öffnen</span></div>' },
    { id:'funkel', titel:'Funkel spricht, du gibst den Takt', frage:'Funkel spricht nicht oder soll still sein',
      text:'Unterwegs wartet Funkel, bis du „Funkel sprechen lassen“ tippst. So sind erst alle Kinder da. Ein Tipp auf den Spiegel macht ihn still. Die Aufgaben liest euer Erzähler vor.',
      bild:'<div class="einf-bild b3" aria-hidden="true"><span class="einf-spiegel"><i></i></span><span class="einf-voll einf-ring unten">Funkel sprechen lassen</span></div>' }
  ];
  // Nur in der Hilfe: was man tut, wenn etwas dauerhaft hakt
  var MEHR=[
    { id:'oft', nur:'draussen', nach:'ankunft', frage:'Stationen öffnen oft zu früh oder zu spät',
      text:'„Erwachsene“ → „Einrichten“ → „GPS-Punkte“: Abstand auf 10 m stellen, wenn es zu früh kommt, auf 25 m, wenn es zu spät kommt. Ein Tablet ohne Mobilfunk hat oft kein GPS. Dann besser ein Handy als Spiegel nehmen oder die Stationen von Hand öffnen.' },
    { id:'ton', frage:'Kein Ton',
      text:'Stummschalter aus und Lautstärke hoch. Danach „Noch einmal hören“ tippen.' },
    { id:'regen', nur:'draussen', frage:'Es regnet',
      text:'„Erwachsene“ → „Einrichten“ → „Spielart“ → „Drinnen“. Die Geschichte bleibt gleich, die Stationen öffnest du von Hand.' }
  ];
  function passt(k, ort){ return !k.nur || k.nur===(ort==='drinnen'?'drinnen':'draussen'); }
  function karten(ort){ return KARTEN.filter(function(k){ return passt(k, ort); }); }
  // Reihenfolge der Hilfe: erst das, was unterwegs am häufigsten hakt
  function hilfeListe(ort){
    var l=[], dr=ort==='drinnen';
    (dr ? ['raum','ablauf','ton','funkel'] : ['hand','ankunft','oft','ablauf','ton','funkel','regen']).forEach(function(id){
      var k=KARTEN.concat(MEHR).filter(function(x){ return x.id===id; })[0]; if(k && passt(k, ort)) l.push(k);
    });
    return l;
  }

  var CSS=
  '.einf{--e-fl:var(--surface,var(--karte,#1F1929));--e-tx:var(--ink,var(--text,#F5F2FA));--e-ak:var(--magic,var(--akzent,#A78BFA));--e-aktx:var(--magic-ink,#160C2B);--e-leise:var(--ink-soft,var(--leise,#B3A9C4));--e-li:var(--line,var(--linie,#2F2740));--e-tint:var(--tint,var(--hover,#2A2236))}'+
  '.einf-schleier{position:fixed;inset:0;z-index:4000;background:rgba(8,5,14,.72);display:grid;place-items:end center;padding:12px;padding-bottom:calc(12px + env(safe-area-inset-bottom,0px))}'+
  '@media (min-height:640px) and (min-width:560px){.einf-schleier{place-items:center}}'+
  '.einf-blatt{width:min(440px,100%);max-height:calc(100vh - 24px);overflow:auto;background:var(--e-fl);color:var(--e-tx);border-radius:22px;padding:18px 18px 16px;box-shadow:0 18px 50px rgba(0,0,0,.55);font-size:1rem;line-height:1.45;text-align:left}'+
  '.einf-blatt.breit{width:min(520px,100%)}'+
  '.einf-kopf{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:0 0 10px}'+
  '.einf-zaehler{font-size:.85rem;color:var(--e-leise);font-weight:700;margin:0}'+
  '.einf-skip{background:none;border:0;color:var(--e-ak);font:inherit;font-weight:700;min-height:44px;padding:8px 4px;cursor:pointer;text-decoration:underline;text-underline-offset:3px}'+
  '.einf-blatt h2{font-size:1.3rem;line-height:1.2;margin:12px 0 6px;color:var(--e-tx)}'+
  '.einf-blatt p.einf-text{margin:0 0 14px}'+
  '.einf-fuss{display:flex;gap:10px;align-items:center}'+
  '.einf-zurueck{flex:none;background:none;border:1.5px solid var(--e-leise);color:var(--e-tx);border-radius:999px;min-height:52px;padding:0 18px;font:inherit;font-weight:700;cursor:pointer}'+
  '.einf-weiter{flex:1;width:100%;min-height:52px;border:0;border-radius:999px;background:var(--e-ak);color:var(--e-aktx);font:inherit;font-weight:800;font-size:1.1rem;cursor:pointer}'+
  '.einf button:focus-visible,.einf summary:focus-visible{outline:3px solid var(--e-tx);outline-offset:2px}'+
  '.einf-bild{position:relative;height:132px;border-radius:16px;background:var(--e-tint);overflow:hidden;border:1px solid var(--e-li)}'+
  '.einf-ring{box-shadow:0 0 0 3px var(--e-fl),0 0 0 6px var(--e-ak)}'+
  '@media (prefers-reduced-motion:no-preference){.einf-ring{animation:einf-puls 1.6s ease-in-out infinite}.einf-blatt{animation:einf-rein .22s ease-out}.einf-angebot.schwebt{animation:einf-runter .3s .5s ease-out both}}'+
  '@keyframes einf-puls{50%{box-shadow:0 0 0 3px var(--e-fl),0 0 0 11px color-mix(in srgb,var(--e-ak) 35%,transparent)}}'+
  '@keyframes einf-rein{from{opacity:0;transform:translateY(14px)}}@keyframes einf-runter{from{opacity:0;transform:translateY(-10px)}}'+
  '.einf-leiste{position:absolute;left:14px;top:18px;display:flex;gap:5px}.einf-leiste i{width:26px;height:12px;border-radius:12px 12px 0 0;background:var(--e-li)}'+
  '.einf-erw{position:absolute;right:16px;top:12px;display:inline-flex;align-items:center;gap:6px;padding:7px 12px;border-radius:999px;background:var(--e-fl);color:var(--e-tx);font-weight:700;font-size:.9rem}'+
  '.einf-erw svg{width:17px;height:17px}'+
  '.einf-menue{position:absolute;right:16px;top:58px;width:136px;display:grid;gap:3px;padding:6px 8px;border-radius:12px;background:var(--e-fl);font-size:.8rem;font-weight:700;color:var(--e-tx)}'+
  '.einf-menue i{font-style:normal;display:flex;align-items:center;gap:7px}.einf-menue i::before{content:"";width:7px;height:7px;border-radius:50%;background:var(--e-ak)}'+
  '.einf-bild.b2{padding:10px 14px}.einf-bild ol{list-style:none;margin:0;padding:0;font-size:.9rem}'+
  '.einf-bild li{position:relative;display:flex;align-items:center;gap:10px;padding:4px 8px;border-radius:10px;margin:0 0 3px;color:var(--e-leise)}'+
  '.einf-bild li b{width:13px;height:13px;border-radius:50%;border:2.5px solid var(--e-li);flex:0 0 auto}'+
  '.einf-bild li.war b{background:var(--e-ak);border-color:var(--e-ak)}'+
  '.einf-bild li.hier{background:var(--e-fl);color:var(--e-tx);font-weight:700}.einf-bild li.hier b{border-color:var(--e-ak)}'+
  '.einf-bild li em{margin-left:auto;font-style:normal;font-size:.78rem;color:var(--e-ak)}'+
  '.einf-spiegel{position:absolute;left:50%;top:12px;width:66px;height:66px;margin-left:-33px;border-radius:50%;border:5px solid var(--e-ak);background:var(--e-fl);display:grid;place-items:center}'+
  '.einf-spiegel i{width:22px;height:22px;border-radius:50%;background:var(--e-ak);opacity:.55}'+
  '.einf-voll{display:inline-block;padding:6px 16px;border-radius:999px;background:var(--e-ak);color:var(--e-aktx);font-size:.9rem;font-weight:800;white-space:nowrap}'+
  '.einf-voll.unten{position:absolute;left:50%;bottom:13px;transform:translateX(-50%)}'+
  '.einf-knopf{display:inline-block;padding:6px 14px;border-radius:999px;border:2px dashed var(--e-leise);color:var(--e-tx);font-size:.86rem;font-weight:700;white-space:nowrap}'+
  '.einf-bild.b4 .einf-spiegel{left:26%}'+
  '.einf-plakette{position:absolute;right:8%;top:50%;transform:translateY(-50%);display:grid;justify-items:center;gap:10px;padding:10px 16px 14px;border-radius:14px;background:var(--e-fl);color:var(--e-tx)}'+
  '.einf-bild.b5{display:grid;place-content:center;justify-items:center;gap:16px}'+
  '.einf-raum{font-size:.84rem;color:var(--e-leise);font-weight:700}'+
  /* Angebot vor dem Spielstart */
  '.einf-angebot{background:var(--e-fl);color:var(--e-tx);border:1px solid var(--e-li);border-radius:16px;padding:12px 14px;margin:14px 0;font-size:.95rem;line-height:1.4;text-align:left}'+
  '.einf-angebot b{display:block;margin-bottom:2px;font-size:1.02rem}'+
  '.einf-angebot .einf-zeile{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}'+
  '.einf-angebot button{min-height:44px;border-radius:999px;padding:8px 16px;font:inherit;font-weight:700;cursor:pointer;border:1.5px solid var(--e-leise);background:none;color:var(--e-tx)}'+
  '.einf-angebot button.einf-ja{background:var(--e-ak);border-color:var(--e-ak);color:var(--e-aktx)}'+
  '.einf-angebot.schwebt{position:fixed;left:10px;right:10px;top:calc(64px + env(safe-area-inset-top,0px));z-index:30;margin:0 0 0 auto;max-width:400px;border-color:var(--e-ak);box-shadow:0 12px 34px rgba(0,0,0,.55)}'+
  '.einf-angebot.schwebt::before{content:"";position:absolute;right:26px;top:-8px;width:14px;height:14px;background:var(--e-fl);border-left:1px solid var(--e-ak);border-top:1px solid var(--e-ak);transform:rotate(45deg)}'+
  /* Tipp unter „Erwachsene“ */
  '.einf-tipp{position:fixed;right:10px;top:calc(64px + env(safe-area-inset-top,0px));z-index:40;max-width:min(320px,calc(100vw - 20px));text-align:left;background:var(--e-ak);color:var(--e-aktx);border-radius:16px;padding:10px 14px 6px;font-size:.95rem;line-height:1.35;box-shadow:0 10px 28px rgba(0,0,0,.45)}'+
  '.einf-tipp.pfeil::before{content:"";position:absolute;right:38px;top:-7px;width:14px;height:14px;background:inherit;transform:rotate(45deg)}'+
  '.einf-tipp .einf-tz{display:flex;justify-content:space-between;gap:14px;margin-top:2px}'+
  '.einf-tipp button{min-height:40px;padding:4px 0;background:none;border:0;color:inherit;font:inherit;font-size:.86rem;font-weight:800;text-decoration:underline;text-underline-offset:3px;cursor:pointer}'+
  /* Hilfe */
  '.einf-hilfe h2{margin:0}'+
  '.einf-hilfe details{border-top:1px solid var(--e-li)}.einf-hilfe details:last-of-type{border-bottom:1px solid var(--e-li)}'+
  '.einf-hilfe summary{list-style:none;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:50px;padding:6px 2px;font-weight:700}'+
  '.einf-hilfe summary::-webkit-details-marker{display:none}'+
  '.einf-hilfe summary::after{content:"";flex:none;width:9px;height:9px;border-right:2px solid var(--e-leise);border-bottom:2px solid var(--e-leise);transform:rotate(45deg);margin-right:6px}'+
  '.einf-hilfe details[open] summary::after{transform:rotate(225deg)}'+
  '.einf-hilfe details p{margin:0 2px 14px;color:var(--e-tx)}'+
  '.einf-hilfe .einf-fuss{margin-top:16px;flex-wrap:wrap}';
  function stil(){ if(document.getElementById('einf-stil')) return; var s=el('style'); s.id='einf-stil'; s.textContent=CSS; document.head.appendChild(s); }

  // ---------- Fenster: Einführung und Hilfe teilen sich Schleier, Fokus und Tasten ----------
  var offen=null;
  function fenster(blatt, opt){
    var vorher=document.activeElement, schleier=el('div','einf einf-schleier');
    blatt.setAttribute('role','dialog'); blatt.setAttribute('aria-modal','true');
    schleier.appendChild(blatt); document.body.appendChild(schleier);
    function knoepfe(){ return Array.prototype.filter.call(blatt.querySelectorAll('button,summary'), function(b){ return !b.hidden && b.offsetParent!==null; }); }
    function zu(){
      document.removeEventListener('keydown', taste, true);
      if(schleier.parentNode) schleier.parentNode.removeChild(schleier); offen=null;
      try{ if(vorher && vorher.focus && document.contains(vorher)) vorher.focus(); }catch(e){}
      if(opt && opt.zu) opt.zu();
    }
    function taste(e){
      if(e.key==='Escape'){ e.preventDefault(); e.stopPropagation(); zu(); return; }
      if(e.key!=='Tab') return;
      var f=knoepfe(), a=document.activeElement, erster=f[0], letzter=f[f.length-1];          // Fokus bleibt im Fenster
      if(e.shiftKey && (a===erster || !blatt.contains(a))){ e.preventDefault(); letzter.focus(); }
      else if(!e.shiftKey && (a===letzter || !blatt.contains(a))){ e.preventDefault(); erster.focus(); }
    }
    schleier.addEventListener('click', function(e){ if(e.target===schleier) zu(); });
    document.addEventListener('keydown', taste, true);
    offen={zu:zu};
    return zu;
  }

  // Die Einführung selbst: kurze Karten. „Überspringen“ und Esc schließen sofort. In jedem Fall gilt sie danach als gesehen.
  // opt.ort: 'draussen' (Standard) oder 'drinnen' · opt.ab: Karte, bei der es losgeht · opt.fertig: danach aufrufen
  function zeigen(opt){
    opt=opt||{}; if(offen) return; stil(); tippWeg(); angebotWeg();
    var liste=karten(opt.ort), i=0;
    liste.forEach(function(k, n){ if(k.id===opt.ab) i=n; });
    var blatt=el('div','einf-blatt');
    blatt.setAttribute('aria-labelledby','einf-titel'); blatt.setAttribute('aria-describedby','einf-text');
    blatt.innerHTML='<div class="einf-kopf"><p class="einf-zaehler" id="einf-zaehler"></p><button type="button" class="einf-skip" id="einf-skip">Überspringen</button></div>'+
      '<div id="einf-bild"></div><div aria-live="polite"><h2 id="einf-titel" tabindex="-1"></h2><p class="einf-text" id="einf-text"></p></div>'+
      '<div class="einf-fuss"><button type="button" class="einf-zurueck" id="einf-zurueck">Zurück</button><button type="button" class="einf-weiter" id="einf-weiter"></button></div>';
    var zu=fenster(blatt, {zu:function(){ setz(GESEHEN); if(opt.fertig) opt.fertig(); }});
    var q=function(id){ return blatt.querySelector('#'+id); };
    function malen(){
      var s=liste[i];
      q('einf-zaehler').textContent='Kurz erklärt · '+(i+1)+' von '+liste.length;
      q('einf-bild').innerHTML=s.bild; q('einf-titel').textContent=s.titel; q('einf-text').textContent=s.text;
      q('einf-zurueck').hidden=i===0;
      q('einf-weiter').textContent=i===liste.length-1 ? 'Los geht’s' : 'Weiter';
    }
    q('einf-skip').addEventListener('click', zu);
    q('einf-zurueck').addEventListener('click', function(){ if(i>0){ i--; malen(); try{ q('einf-weiter').focus({preventScroll:true}); }catch(e){} } });
    q('einf-weiter').addEventListener('click', function(){ if(i>=liste.length-1){ zu(); return; } i++; malen(); });
    malen();
    try{ q('einf-weiter').focus({preventScroll:true}); }catch(e){}
  }

  // Hilfe: dieselben Inhalte zum Nachschlagen, das Häufigste zuerst. Markiert nichts als gesehen.
  function hilfe(opt){
    opt=opt||{}; if(offen) return; stil(); tippWeg();
    var blatt=el('div','einf-blatt breit einf-hilfe');
    blatt.setAttribute('aria-labelledby','einf-hilfe-titel');
    blatt.innerHTML='<div class="einf-kopf"><h2 id="einf-hilfe-titel">Hilfe</h2><button type="button" class="einf-skip" id="einf-hilfe-zu">Schließen</button></div>'+
      '<p class="einf-text">Was du tust, wenn unterwegs etwas hakt.</p>'+
      hilfeListe(opt.ort).map(function(k){ return '<details data-hilfe="'+k.id+'"><summary>'+esc(k.frage||k.titel)+'</summary><p>'+esc(k.text)+'</p></details>'; }).join('')+
      '<div class="einf-fuss"><button type="button" class="einf-zurueck" id="einf-von-vorn">Einführung zeigen</button></div>';
    var zu=fenster(blatt);
    blatt.querySelector('#einf-hilfe-zu').addEventListener('click', zu);
    blatt.querySelector('#einf-von-vorn').addEventListener('click', function(){ zu(); zeigen({ort:opt.ort}); });
    blatt.addEventListener('toggle', function(e){                                  // immer nur eine Antwort offen
      if(!e.target.open) return;
      Array.prototype.forEach.call(blatt.querySelectorAll('details[open]'), function(d){ if(d!==e.target) d.open=false; });
    }, true);
    try{ blatt.querySelector('#einf-hilfe-zu').focus({preventScroll:true}); }catch(e){}
  }

  // Angebot vor dem Spielstart: eine Karte, die nichts aufhält. Mit opt.ziel steht sie im Seitenfluss (Startklar),
  // sonst schwebt sie oben rechts unter „Erwachsene“: auf jedem Gerät ohne Scrollen zu sehen, nie über dem Startknopf (Spiel).
  // opt.wo: 'bereit' = „Überspringen“ gilt nur für die Startklar-Seite, das Spiel bietet sie noch einmal an.
  var angebotEl=null;
  function angebotWeg(){ if(angebotEl && angebotEl.parentNode) angebotEl.parentNode.removeChild(angebotEl); angebotEl=null; }
  function anbieten(opt){
    opt=opt||{}; var nurHier=opt.wo==='bereit';
    if(lies(GESEHEN) || (nurHier && lies(BEREIT)) || angebotEl || offen) return false; stil();
    var a=el('section','einf einf-angebot'+(opt.ziel?'':' schwebt'));
    a.id='einf-angebot'; a.setAttribute('aria-label','Kurze Einführung');
    a.innerHTML='<div><b>Zum ersten Mal hier?</b>'+(opt.ort==='drinnen'
        ? 'In einer Minute siehst du dein Menü und wie du drinnen die Stationen öffnest.'
        : 'In einer Minute siehst du dein Menü und was hilft, wenn eine Station zu früh oder gar nicht öffnet.')+'</div>'+
      '<div class="einf-zeile"><button type="button" class="einf-ja" id="einf-ja">Kurz ansehen</button><button type="button" id="einf-nein">Überspringen</button></div>';
    if(opt.ziel && opt.ziel.parentNode) opt.ziel.parentNode.insertBefore(a, opt.ziel); else document.body.appendChild(a);
    angebotEl=a;
    a.querySelector('#einf-ja').addEventListener('click', function(){ angebotWeg(); zeigen({ort:opt.ort}); });
    a.querySelector('#einf-nein').addEventListener('click', function(){ setz(nurHier?BEREIT:GESEHEN); angebotWeg(); });
    return true;
  }

  // ---------- Tipps: einmal je Tipp, zusammen abschaltbar ----------
  var TIPP={
    start:{pfeil:true, text:'Über „Erwachsene“ springst du mit „Ablauf“ zu jedem Schritt. Unter „Hilfe“ steht, was du tust, wenn etwas hakt.'},
    unterwegs:{text:'Öffnet sich die Station am Ziel nicht von selbst, tippst du unter dem Spiegel „Station von Hand öffnen“.'}
  };
  function gezeigt(){ try{ return JSON.parse(lies(TIPPS)||'{}')||{}; }catch(e){ return {}; } }
  function tippsAn(){ return !lies(AUS); }
  function tippsSetzen(an){ if(an) weg(AUS); else { setz(AUS); tippWeg(); } }
  function tippOffen(id){ return tippsAn() && !gezeigt()[id]; }                 // für Hinweise, die das Spiel selbst zeichnet (z. B. bei „Angekommen!“)
  function tippMerken(id){ var g=gezeigt(); if(g[id]) return; g[id]=1; setz(TIPPS, JSON.stringify(g)); }
  var tippEl=null, tippT=null;
  function tippWeg(){ clearTimeout(tippT); document.removeEventListener('pointerdown', tippDaneben, true); document.removeEventListener('keydown', tippTaste, true); if(tippEl && tippEl.parentNode) tippEl.parentNode.removeChild(tippEl); tippEl=null; }
  function tippDaneben(e){ if(tippEl && tippEl.contains(e.target)) return; tippWeg(); }   // Tipp irgendwohin schließt; Knöpfe im Tipp behalten ihren Klick
  function tippTaste(e){ if(e.key==='Escape') tippWeg(); }
  function tipp(id){
    var t=TIPP[id]; if(!t || tippEl || offen || !tippOffen(id)) return false;
    tippMerken(id); stil();
    var b=el('div','einf einf-tipp'+(t.pfeil?' pfeil':'')); b.id='einf-tipp'; b.setAttribute('role','status'); b.setAttribute('data-tipp', id);
    b.innerHTML='<b>Für Erwachsene:</b> '+esc(t.text)+'<div class="einf-tz"><button type="button" id="einf-tipp-zu">Verstanden</button><button type="button" id="einf-tipp-aus">Keine Tipps mehr</button></div>';
    document.body.appendChild(b); tippEl=b;
    b.querySelector('#einf-tipp-zu').addEventListener('click', tippWeg);
    b.querySelector('#einf-tipp-aus').addEventListener('click', function(){ tippsSetzen(false); try{ document.dispatchEvent(new CustomEvent('einfuehrung', {detail:{tipps:false}})); }catch(e){} });
    setTimeout(function(){ if(tippEl===b){ document.addEventListener('pointerdown', tippDaneben, true); document.addEventListener('keydown', tippTaste, true); } }, 600);   // nicht vom auslösenden Tipp selbst geschlossen werden
    tippT=setTimeout(tippWeg, 14000);
    return true;
  }
  // Beim Spielstart: Angebot weg, die Einführung gilt als erledigt, dazu einmal der Tipp unter „Erwachsene“
  function hinweis(){ angebotWeg(); setz(GESEHEN); return tipp('start'); }

  window.Einfuehrung={ zeigen:zeigen, hilfe:hilfe, anbieten:anbieten, angebotWeg:angebotWeg, hinweis:hinweis, tipp:tipp, tippWeg:tippWeg, tippOffen:tippOffen, tippMerken:tippMerken, tippsAn:tippsAn, tippsSetzen:tippsSetzen,
    karten:karten, hilfeListe:hilfeListe, gesehen:function(){ return !!lies(GESEHEN); }, ruhig:ruhig };
})();
