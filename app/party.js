// Party: alle Angaben der Eltern an einer Stelle. Daraus folgen Variante, Mengen, Zeitplan, Ausdrucke.
// Gespeichert im Gerät unter sj.party.<thema>; der Tourplan (sj.plan.<thema>) bekommt Variante und Kinderzahl mit,
// damit Spiel und Planer dieselben Werte nutzen.
(function(root){
  'use strict';
  var TAG=864e5;
  function lies(k){ try{ return JSON.parse(localStorage.getItem(k)||'null'); }catch(e){ return null; } }
  function schreib(k,v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }

  function lesen(thema){ var p=lies('sj.party.'+thema); return p && p.thema===thema ? p : null; }
  function plan(thema){ var p=lies('sj.plan.'+thema); return p && p.thema===thema ? p : null; }
  function variante(p){ return !p ? 'a' : p.ort==='drinnen' ? 'c' : (p.ausdrucke===false ? 'b' : 'a'); }

  // Party speichern und den Tourplan angleichen (neuer Stand = Spiel übernimmt Variante und Punkte einmal neu)
  function speichern(p){
    p.geaendert=new Date().toISOString(); schreib('sj.party.'+p.thema, p);
    var pl=plan(p.thema) || {format:1, thema:p.thema, stationen:[], strecke:0};
    if(pl.variante!==variante(p) || pl.kinder!==p.kinder){                 // nur bei echter Änderung: das Spiel übernimmt dann Variante und Punkte neu
      pl.variante=variante(p); pl.kinder=p.kinder; pl.stand=new Date().toISOString();
      schreib('sj.plan.'+p.thema, pl);
    }
    return p;
  }
  function loeschen(thema){ try{ localStorage.removeItem('sj.party.'+thema); }catch(e){} }

  function datum(p){ return p && p.datum ? new Date(p.datum+'T'+(p.start||'15:00')+':00') : null; }
  function tageBis(p){ var d=datum(p); if(!d) return null; var heute=new Date(); heute.setHours(0,0,0,0); var t=new Date(d); t.setHours(0,0,0,0); return Math.round((t-heute)/TAG); }
  function uhr(p, minuten){ var d=datum(p); d=new Date(d.getTime()+minuten*60000); return ('0'+d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2); }
  function plus(p, tage){ var d=datum(p); d.setDate(d.getDate()+tage); return d; }
  function datumText(d){ return d.toLocaleDateString('de-DE',{weekday:'short', day:'numeric', month:'long'}); }

  // Zeitplan der Vorbereitung: Tag relativ zur Party, was zu tun ist, wohin es führt, ob die App es selbst abhaken kann
  function aufgaben(p, tour, pl){
    var draussen=p.ort!=='drinnen', v=variante(p), route=!!(pl && pl.stationen && pl.stationen.length);
    var l=[
      {id:'anlegen', tag:-14, titel:'Party angelegt', auto:true, fertig:true},
      draussen ? {id:'route', tag:-14, titel:'Route planen', text:'Adresse, Richtung und Strecke, die Stationen sucht der Planer.', link:'planer.html?thema='+p.thema, auto:true, fertig:route} : null,
      {id:'bestellen', tag:-14, titel:'Utensilien bestellen', text:'Haarreifen, Holz-Regenbogen, Glückssteine, Zaubertafeln. Mengen stehen in der Einkaufsliste.', link:'#einkauf'},
      {id:'einladen', tag:-12, titel:'Einladungen verschicken', text:'Druckvorlage mit Name, Datum und Abholzeit.', link:'druck.html?thema='+p.thema+'#einladung'},
      {id:'basteln', tag:-7, titel:'Basteln', text:'Schatzkiste bekleben, Fuchsbau grau anmalen, Sticker in '+p.kinder+' Stücke schneiden.', link:'spiel.html?thema='+p.thema+'#einrichten'},
      {id:'drucken', tag:-5, titel:'Ausdrucke vorbereiten', text:v==='a'?'Schlafende Wolke (A3) und Urkunden für alle Kinder.':'Urkunden für alle Kinder.', link:'druck.html?thema='+p.thema},
      draussen ? {id:'wetter', tag:-2, titel:'Wetter prüfen', text:p.planB?'Bei Regen mit einem Tipp auf drinnen umschalten.':'Ohne Plan B: bei Regen Termin oder Ort überlegen.'} : null,
      {id:'probelauf', tag:-1, titel:draussen?'Probelauf: Route abgehen':'Probelauf: Räume festlegen', text:draussen?'Stationen ansehen, im Planer verschieben, wo es nicht passt.':'Küche, Flur, Treppe, Toberaum und Sofa wie in der Liste.', link:draussen?'planer.html?thema='+p.thema:'spiel.html?thema='+p.thema+'#einrichten'},
      {id:'geraet', tag:-1, titel:'Spiel-Gerät vorbereiten', text:'Bereit-Check auf dem iPad: Stimmen laden, Ton, GPS, Sperre aus.', link:'bereit.html?thema='+p.thema},
      draussen && v!=='c' ? {id:'kreide', tag:0, minuten:-60, titel:'Kreidespur malen', text:'Von der Haustür bis Station 2: Hufe, dann kleine Pfoten.'} : null,
      p.vorausgeher ? {id:'vorausgeher', tag:0, minuten:-20, titel:'Vorausgeher startet', text:'Mit der Tasche vorgehen und die Stationen 2 bis 7 aufbauen.'} : null,
      {id:'start', tag:0, minuten:0, titel:'Party! Spiel starten', link:'spiel.html?thema='+p.thema}
    ].filter(Boolean);
    var erledigt=p.erledigt||{};
    l.forEach(function(a){
      a.datum=plus(p, a.tag);
      if(a.minuten!=null) a.uhr=uhr(p, a.minuten);
      if(!a.auto) a.fertig=!!erledigt[a.id];
    });
    return l;
  }
  function naechste(l){ return l.filter(function(a){ return !a.fertig; })[0]||null; }

  function einkauf(p, tour){
    return tour.utensilien.map(function(u, i){
      var m=String(u.menge), n=/je Kind \+ ?(\d+)/.test(m) ? p.kinder+(+RegExp.$1) : /je Kind/.test(m) ? p.kinder : +m||1;
      return {id:'u'+i, name:u.name, menge:n, wann:u.wann, link:u.link, fertig:!!(p.einkauf||{})['u'+i]};
    });
  }

  // Kalender: jede Aufgabe als Termin (ganztägig, am Partytag mit Uhrzeit), dazu die Party selbst
  function ics(p, tour, pl){
    function z(n){ return ('0'+n).slice(-2); }
    function tagS(d){ return d.getFullYear()+z(d.getMonth()+1)+z(d.getDate()); }
    function zeitS(d){ return tagS(d)+'T'+z(d.getHours())+z(d.getMinutes())+'00'; }
    function esc(t){ return String(t||'').replace(/[\\,;]/g,function(c){ return '\\'+c; }).replace(/\n/g,'\\n'); }
    var basis=location.href.replace(/[^/]*$/,'').replace(/[?#].*$/,'');
    var ev=[];
    function termin(id, titel, text, d, mitZeit, dauerMin){
      var e=['BEGIN:VEVENT','UID:'+p.thema+'-'+id+'-'+tagS(datum(p))+'@zauberspiegel','DTSTAMP:'+zeitS(new Date())];
      if(mitZeit){ var bis=new Date(d.getTime()+(dauerMin||30)*60000); e.push('DTSTART:'+zeitS(d),'DTEND:'+zeitS(bis)); }
      else { var n=new Date(d); n.setDate(n.getDate()+1); e.push('DTSTART;VALUE=DATE:'+tagS(d),'DTEND;VALUE=DATE:'+tagS(n)); }
      e.push('SUMMARY:'+esc(titel),'DESCRIPTION:'+esc(text),'END:VEVENT'); ev.push(e.join('\r\n'));
    }
    var name=p.kind && p.kind.name ? (/[sßxz]$/i.test(p.kind.name) ? p.kind.name+'’' : p.kind.name+'s') : 'Unsere';
    termin('party', name+' Einhorn-Party ('+tour.titel+')', 'Spiel öffnen: '+basis+'spiel.html?thema='+p.thema, datum(p), true, (tour.dauer.minuten||50)+30);
    aufgaben(p, tour, pl).forEach(function(a){
      if(a.id==='anlegen' || a.id==='start') return;
      var d=new Date(a.datum); if(a.minuten!=null){ d=new Date(datum(p).getTime()+a.minuten*60000); }
      termin(a.id, tour.titel+': '+a.titel, (a.text||'')+(a.link&&a.link.charAt(0)!=='#'?'\n'+basis+a.link:''), d, a.minuten!=null, 20);
    });
    return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Zauberspiegel//Party//DE','CALSCALE:GREGORIAN'].concat(ev,['END:VCALENDAR']).join('\r\n')+'\r\n';
  }

  root.Party={lesen:lesen, plan:plan, speichern:speichern, loeschen:loeschen, variante:variante, datum:datum, tageBis:tageBis, uhr:uhr, datumText:datumText, aufgaben:aufgaben, naechste:naechste, einkauf:einkauf, ics:ics};
})(this);
