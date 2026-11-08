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
  root.Weg={heim:heim, party:party, plan:plan, zurueck:zurueck, vonSeite:vonSeite, verdrahten:verdrahten, themaMitParty:erstesThemaMitParty};
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', function(){ verdrahten(); }); else verdrahten();
})(window);
