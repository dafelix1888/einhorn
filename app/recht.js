// Kleine Fußzeile mit Impressum und Datenschutz für alle normalen Seiten der App.
(function(){
  'use strict';
  function los(){
    if(document.getElementById('recht-fuss')) return;
    var n=document.createElement('nav'); n.id='recht-fuss'; n.setAttribute('aria-label','Rechtliches');
    n.style.cssText='text-align:center;font-size:.85rem;padding:20px 16px calc(28px + env(safe-area-inset-bottom));color:var(--leise,#B3A9C4)';
    n.innerHTML='<a href="impressum.html" style="color:inherit">Impressum</a> · <a href="datenschutz.html" style="color:inherit">Datenschutz</a>';
    document.body.appendChild(n);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', los); else los();
})();
