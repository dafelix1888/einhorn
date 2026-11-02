// Lädt das Thema (tour.json) und den Tourplan aus dem Planer, dann startet das Spiel.
//   spiel.html?thema=einhorn            Plan aus diesem Gerät (vom Planer gespeichert)
//   spiel.html?thema=einhorn&plan=…     Plan als geteilter Link, wird auf dem Gerät gespeichert
(function(){
  'use strict';
  var q=new URLSearchParams(location.search);
  var thema=(q.get('thema')||'einhorn').replace(/[^a-z0-9-]/gi,'');
  var PLAN_KEY='sj.plan.'+thema;

  function planAusCode(code){                // base64url → JSON (siehe planer.js: planCode)
    var b=code.replace(/-/g,'+').replace(/_/g,'/'); while(b.length%4) b+='=';
    var bin=atob(b), a=new Uint8Array(bin.length); for(var i=0;i<bin.length;i++) a[i]=bin.charCodeAt(i);
    return JSON.parse(new TextDecoder().decode(a));
  }
  function planLesen(){
    var p=null;
    if(q.get('plan')){
      try{ p=planAusCode(q.get('plan')); localStorage.setItem(PLAN_KEY, JSON.stringify(p)); }catch(e){ p=null; }
      try{ q.delete('plan'); history.replaceState(null,'',location.pathname+'?'+q.toString()+location.hash); }catch(e){}
    }
    if(!p){ try{ p=JSON.parse(localStorage.getItem(PLAN_KEY)||'null'); }catch(e){ p=null; } }
    return p && p.thema===thema ? p : null;
  }
  function fuellen(t, w){ return String(t).replace(/\{(\w+)\}/g, function(m,k){ return w[k]!=null ? w[k] : m; }); }

  function anwenden(tour, plan, config){
    var tp={stand:'', punkteCode:null, variante:null, liveUrl:config.liveUrl||''};
    var kinder=(plan && plan.kinder) || tour.kinder.standard;
    function liste(l){ return l.map(function(g){ return {t:g.t, items:g.items.map(function(x){ return fuellen(x,{kinder:kinder}); })}; }); }
    tour.vorbereitung.gemeinsam=liste(tour.vorbereitung.gemeinsam);
    Object.keys(tour.vorbereitung.variante).forEach(function(k){ tour.vorbereitung.variante[k]=liste(tour.vorbereitung.variante[k]); });
    tour.gaben.forEach(function(g){ g.wie=fuellen(g.wie,{kinder:kinder}); });
    if(plan){
      tp.stand=plan.stand||''; tp.variante=plan.variante||null; if(plan.liveUrl) tp.liveUrl=plan.liveUrl;
      var st=plan.stationen||[], code=[];
      tour.stationen.forEach(function(s,i){
        var p=st[i]; if(i===0) return;
        code.push(p && typeof p.lat==='number' ? [p.lat,p.lng] : null);
        if(!p) return;
        if(p.name) s.name=p.name;
        if(p.wo) s.wo=p.wo;
        if(s.ansage && (p.an || p.zu)) s.ansageText=fuellen(s.ansage,{an:p.an||p.zu, zu:p.zu||p.an});
      });
      if(code.some(Boolean)) tp.punkteCode=JSON.stringify(code);
    }
    return tp;
  }
  function fehler(t){
    document.body.innerHTML='<main style="font:19px/1.45 system-ui,sans-serif;padding:32px;max-width:32rem;margin:auto"><h1>Das Spiel lässt sich nicht laden</h1><p>'+t+'</p><p><a href="index.html">Zur Übersicht</a></p></main>';
  }
  function json(u){ return fetch(u,{cache:'no-cache'}).then(function(r){ if(!r.ok) throw new Error(u+': HTTP '+r.status); return r.json(); }); }

  try{ if('serviceWorker' in navigator && location.protocol==='https:') navigator.serviceWorker.register('sw.js'); }catch(e){}
  Promise.all([
    json('themen/'+thema+'/tour.json'),
    json('config.json')['catch'](function(){ return {}; })
  ]).then(function(r){
    var tour=r[0], plan=planLesen();
    var tp=anwenden(tour, plan, r[1]||{});
    window.__TOUR=tour; window.__TPLAN=tp;
    window.__START(tour, tp);
  })['catch'](function(e){ fehler('Thema „'+thema+'“ nicht gefunden oder ohne Netz noch nie geöffnet. ('+String(e.message||e)+')'); });
})();
