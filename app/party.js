// Party: alle Angaben der Eltern an einer Stelle. Daraus folgen Variante, Mengen, Zeitplan, Ausdrucke.
// Gespeichert im Gerät unter sj.party.<thema>; der Tourplan (sj.plan.<thema>) bekommt Variante und Kinderzahl mit,
// damit Spiel und Planer dieselben Werte nutzen.
(function(root){
  'use strict';
  var TAG=864e5;
  function lies(k){ try{ return JSON.parse(localStorage.getItem(k)||'null'); }catch(e){ return null; } }
  function schreib(k,v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }

  // Vornamen beginnen groß, auch wenn klein getippt wurde (UNICORN-28)
  function gross(n){ n=String(n||''); return n ? n.charAt(0).toUpperCase()+n.slice(1) : n; }
  function lesen(thema){ var p=lies('sj.party.'+thema); if(p && p.kind && typeof p.kind.name==='string') p.kind.name=gross(p.kind.name); return p && p.thema===thema ? p : null; }
  function plan(thema){ var p=lies('sj.plan.'+thema); return p && p.thema===thema ? p : null; }
  function variante(p){ return !p ? 'a' : p.ort==='drinnen' ? 'c' : (p.ausdrucke===false ? 'b' : 'a'); }

  // Party speichern und den Tourplan angleichen (neuer Stand = Spiel übernimmt Variante und Punkte einmal neu)
  function speichern(p){
    var alt=lies('sj.party.'+p.thema); if(alt && alt.server) p.server=alt.server; else delete p.server;   // „server“ gehört konto.js (Schlüssel der Links)
    if(alt && alt.fremd && !p.fremd){ try{ localStorage.removeItem('sj.link.'+p.thema); }catch(e){} }   // neue eigene Party ersetzt die fremde: deren Link vergessen
    if(!alt && root.marketer){ try{ root.marketer.track('party_created'); }catch(e){} }    // Marketer: nur beim ersten Anlegen, Name nicht ändern
    p.geaendert=new Date().toISOString(); schreib('sj.party.'+p.thema, p);
    if(root.Konto) root.Konto.merken(p.thema);                                // angemeldet: kurz danach geschützt speichern
    var pl=plan(p.thema) || {format:1, thema:p.thema, stationen:[], strecke:0};
    var planNeu=false;
    if(pl.variante!==variante(p) || pl.kinder!==p.kinder){                 // nur bei echter Änderung: das Spiel übernimmt dann Variante und Punkte neu
      pl.variante=variante(p); pl.kinder=p.kinder; pl.stand=new Date().toISOString(); planNeu=true;
    }
    if((p.erz||null)!==(pl.erz||null)){                                    // Erzähler (UNICORN-54): eigener Stand, damit das Spiel nur die Stimme übernimmt und die Punkte bleiben
      if(p.erz) pl.erz=p.erz; else delete pl.erz;
      pl.erzStand=new Date().toISOString(); planNeu=true;
    }
    if(planNeu) schreib('sj.plan.'+p.thema, pl);
    return p;
  }
  function loeschen(thema){ try{ localStorage.removeItem('sj.party.'+thema); }catch(e){} }

  function datum(p){ return p && p.datum ? new Date(p.datum+'T'+(p.start||'15:00')+':00') : null; }
  function tageBis(p){ var d=datum(p); if(!d) return null; var heute=new Date(); heute.setHours(0,0,0,0); var t=new Date(d); t.setHours(0,0,0,0); return Math.round((t-heute)/TAG); }
  function uhr(p, minuten){ var d=datum(p); d=new Date(d.getTime()+minuten*60000); return ('0'+d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2); }
  function plus(p, tage){ var d=datum(p); d.setDate(d.getDate()+tage); return d; }
  function datumText(d){ return d.toLocaleDateString('de-DE',{weekday:'short', day:'numeric', month:'long'}); }

  // Zeitplan der Vorbereitung: sechs gebündelte Schritte. Jeder Schritt hat Teile; ein Teil ist entweder
  // automatisch erkannt (erkannt; nurAuto = nur automatisch, z. B. Route geplant) oder von Hand abgehakt (p.erledigt[teil.id]).
  // Der Schritt ist fertig, wenn alle Teile fertig sind oder er als Ganzes abgehakt wurde (p.erledigt['schritt.'+id]).
  // Die Teil-IDs entsprechen den früheren Einzelschritten, damit vorhandene Haken erhalten bleiben.
  // Generalprobe (UNICORN-76): gilt für die Route, mit der sie gelaufen ist. Ändert sich die Route im Planer, ist der Haken wieder offen.
  function routeSchluessel(pl){ return pl && pl.stationen ? pl.stationen.map(function(s){ return s && typeof s.lat==='number' ? s.lat.toFixed(5)+','+s.lng.toFixed(5) : '-'; }).join(';') : ''; }
  function probeStand(p, pl){
    var e=p.erledigt||{}, gelaufen=!!(e.probelauf || e.generalprobe);   // alte Haken (Route ablaufen, Generalprobe am Vortag) zählen weiter
    var geaendert=gelaufen && !!p.probeRoute && !!pl && p.probeRoute!==routeSchluessel(pl);
    return {gelaufen:gelaufen && !geaendert, geaendert:geaendert};
  }
  function aufgaben(p, tour, pl){
    var draussen=p.ort!=='drinnen', v=variante(p), route=!!(pl && pl.stationen && pl.stationen.length), t=p.thema;
    var erledigt=Object.assign({}, p.erledigt||{}), probe=probeStand(p, pl), selbstAufbau=draussen && !p.vorausgeher;
    if(draussen) erledigt.probelauf=probe.gelaufen;   // alter Haken „Generalprobe am Vortag“ zählt, geänderte Route nicht (UNICORN-76)
    // Namens-Sätze gibt es nur mit Server (Konto) und Vornamen
    var name=p.kind && p.kind.name ? String(p.kind.name) : '', mitNamen=!!(name && root.Konto && root.Konto.aktiv && root.Konto.aktiv());
    var ek=tour && tour.utensilien ? einkauf(p, tour) : [], allesGekauft=ek.length>0 && ek.every(function(x){ return x.fertig; });
    var km=pl && pl.strecke ? (pl.strecke>=1000 ? (pl.strecke/1000).toFixed(1).replace('.',',')+' km' : Math.round(pl.strecke)+' m') : '';
    var wetter=!draussen ? '' : p.planB ? ' Regen gemeldet? Dann schaltest du mit einem Tipp auf drinnen um.' : ' Ohne Plan B: bei Regen Termin oder Ort überlegen.';
    var l=[
      // Reihenfolge (UNICORN-27): zuerst, was Lieferzeit braucht; die Einladung geht, wann man mag. Nichts ist gesperrt.
      {id:'bestellen', tag:-14, titel:'Material besorgen', kurz:'Bestellen oder von zu Hause nehmen',   // UNICORN-72: drängt nicht zum Kauf
        text:'Zwei Wege: Alles bestellen ist am bequemsten, die Mengen passen schon zu '+p.kinder+' Kindern. Oder nur das Nötige kaufen und den Rest weglassen oder mit Dingen von zu Hause lösen. Dann kostet es wenig oder gar nichts.', knopf:'Zum Material', link:'#einkauf',
        teile:[{id:'bestellen', titel:'Alles da oder bestellt', erkannt:allesGekauft}]},
      {id:'einladen', tag:-14, titel:'Gäste einladen', kurz:'Ein Link für alle Eltern, du siehst, wer kommt',
        text:'Ein Link für alle Gast-Eltern. Sie sehen Termin, Treffpunkt und Abholzeit und sagen dort zu oder ab. Wer kommt, siehst du hier.', knopf:'Link teilen', aktion:'gast-link',
        link:einladungsLink(p, pl)||('party.html?thema='+t+'#einladung'), teile:[{id:'einladen', titel:'Einladung geschickt'}]},
      draussen ?
        // Eine Generalprobe statt zwei Läufen (UNICORN-76): Schritt 3 ist die Probe, am Vortag bleibt draußen nichts mehr
        {id:'route', tag:-7, titel:route?'Generalprobe':'Route planen', kurz:route?'Einmal mit dem Tablet ablaufen'+(km?', '+km:''):'Der Planer findet die Orte für die Stationen',
          text:route?(probe.geaendert?'Die Route hat sich seit der Generalprobe geändert. Lauf sie bitte noch einmal ab. ':'')+'Lauf die Tour einmal so ab wie am Partytag, mit dem Gerät, das der Spiegel sein wird. Der Spiegel zeigt den Abstand zur Station. Öffnet eine zu früh oder gar nicht, setzt du den Punkt mit einem Tipp neu.':'Adresse eingeben, Richtung wählen: Der Planer sucht passende Orte für die Stationen. Danach machst du einmal die Generalprobe.',
          knopf:route?'Generalprobe starten':'Route planen', link:route?'spiel.html?thema='+t+'&probe=1':'planer.html?thema='+t,
          teile:[{id:'route', titel:'Route geplant', nurAuto:true, erkannt:route}, {id:'probelauf', titel:'Einmal abgelaufen', ungueltig:probe.geaendert, text:probe.geaendert?'Route geändert, bitte noch einmal ablaufen':''}]} :
        {id:'route', tag:-7, titel:'Räume festlegen', kurz:'Küche, Flur, Treppe, Toberaum und Sofa',
          text:'Leg fest, welche Station in welchem Raum steht. Die Liste im Spiel hilft dabei.', knopf:'Liste öffnen', link:'spiel.html?thema='+t+'#einrichten',
          teile:[{id:'probelauf', titel:'Räume festgelegt'}]},
      {id:'basteln', tag:-7, titel:'Basteln und drucken', kurz:bastelKurz(p, tour),
        text:bastelText(p, tour),
        knopf:'Druckvorlagen öffnen', link:'druck.html?thema='+t, neben:{text:'Packliste im Spiel', link:'spiel.html?thema='+t+'#einrichten'},
        teile:[{id:'basteln', titel:'Gebastelt'}, {id:'drucken', titel:'Gedruckt'}]},
      {id:'geraet', tag:-1, titel:'Tablet startklar machen', kurz:(mitNamen?'Funkel lernt den Namen, ':'')+'Stimmen laden, Ton'+(draussen?' und GPS':'')+' prüfen',
        text:(mitNamen?'Zuerst lernt Funkel den Namen: Er sagt „'+name+'“ an der Haustür, beim Schatz und zum Abschied. Dann ':'')+(mitNamen?'f':'F')+'ünf Minuten im WLAN: Stimmen laden, Ton'+(draussen?', GPS':'')+' und Akku prüfen.'+wetter, knopf:'Startklar öffnen', link:'bereit.html?thema='+t,
        // „Funkel kennt …“ (UNICORN-33) steht sichtbar im Ablauf, zählt aber nicht für den Haken des Schritts (Extra, später bezahlt)
        teile:(mitNamen?[{id:'namen', titel:'Funkel kennt '+name, text:'Einmal einsprechen und anhören', extra:true}]:[]).concat([{id:'geraet', titel:'Tablet ist startklar'}])},
      {id:'partytag', tag:0, titel:'Partytag', kurz:[draussen?'':'Generalprobe am Vortag', draussen&&v!=='c'?'Kreidespur':'', p.vorausgeher?'Vorausgeher':'', 'Spiegel starten'].filter(Boolean).join(', '),
        text:[draussen?'':'Am Tag oder Abend davor: Generalprobe. Du spielst die Tour einmal durch und legst in jedem Raum alles bereit.', 'Am Partytag:', draussen&&v!=='c'?(selbstAufbau?'Eineinhalb Stunden vorher die Kreidespur malen, danach die Stationen aufbauen.':'Eine Stunde vorher die Kreidespur malen.'):'', p.vorausgeher?'20 Minuten vorher geht der Vorausgeher los.':'', draussen?'Dann alle an die Haustür und den Zauberspiegel starten.':'Dann alle zusammenholen und den Zauberspiegel starten.'].filter(Boolean).join(' '),
        knopf:'Startklar öffnen', link:'bereit.html?thema='+t,
        teile:[
          draussen ? null : {id:'generalprobe', titel:'Generalprobe', text:'Einmal durchspielen, Räume prüfen', vortag:true, extra:true},
          draussen && v!=='c' ? {id:'kreide', minuten:selbstAufbau?-90:-60, titel:'Kreidespur malen', text:'Von der Haustür bis Station 2: Hufe, dann kleine Pfoten.'} : null,
          p.vorausgeher ? {id:'vorausgeher', minuten:-20, titel:'Vorausgeher startet', text:'Mit der Tasche vorgehen und die Stationen 2 bis 7 aufbauen.'} : null,
          // Ohne Vorausgeher baust du selbst auf (UNICORN-73): eigener Teilschritt mit Uhrzeit, gleiche Aufbau-Liste wie der Vorausgeher
          selbstAufbau ? {id:'aufbau', minuten:-75, titel:'Stationen aufbauen', text:'Mit der Tasche die Stationen 2 bis 7 aufbauen. Die Schatzkiste bleibt bei dir.', link:'vorausgeher.html?thema='+t+'&modus=selbst'} : null,
          {id:'start', minuten:0, titel:draussen?'Alle an der Haustür':'Alle zusammen', text:'Tattoos verteilen, dann den Zauberspiegel aufwecken.'}
        ].filter(Boolean)}
    ];
    l.forEach(function(a){
      a.datum=plus(p, a.tag);
      a.teile.forEach(function(x){
        x.auto=!!x.nurAuto; x.fertig=!x.ungueltig && (!!x.erkannt || (!x.nurAuto && !!erledigt[x.id]));
        if(x.minuten!=null) x.uhr=uhr(p, x.minuten); else if(x.vortag) x.uhr='Vortag';
      });
      a.fertig=!a.teile.some(function(x){ return x.ungueltig; }) && (!!erledigt['schritt.'+a.id] || a.teile.every(function(x){ return x.fertig || x.extra; }));
      a.auto=false;
    });
    return l;
  }
  function bastelMin(l, nurNoetig){ return l.filter(function(x){ return !nurNoetig || x.noetig; }).reduce(function(s, x){ return s+x.min; }, 0); }
  function bastelKurz(p, tour){ var l=tour?basteln(p, tour):[]; if(!l.length) return 'Schatzkiste, Fuchsbau, Urkunden'; return 'Etwa '+bastelMin(l)+' Minuten, nötig davon nur '+bastelMin(l, true); }
  function bastelText(p, tour){
    var l=tour?basteln(p, tour):[]; if(!l.length) return 'Schatzkiste bekleben, Fuchsbau grau anmalen, Sticker schneiden, Urkunden drucken.';
    return 'Alles zusammen etwa '+bastelMin(l)+' Minuten. Nötig sind davon nur '+bastelMin(l, true)+' Minuten, der Rest ist Extra: Ohne Basteln und Drucken funktioniert die Tour genauso. Unten steht je Aufgabe, was sie bringt und was du sonst machst.';
  }
  function naechste(l){ return l.filter(function(a){ return !a.fertig; })[0]||null; }
  // Haken für einen ganzen Schritt setzen oder lösen (alle Teile, die man von Hand abhaken kann)
  function abhaken(p, a, an){
    p.erledigt=p.erledigt||{};
    a.teile.forEach(function(x){ if(!x.nurAuto && !x.extra) p.erledigt[x.id]=!!an; });
    p.erledigt['schritt.'+a.id]=!!an;
    if(an && p.erledigt.probelauf) p.probeRoute=routeSchluessel(plan(p.thema));
    if(!an && a.id==='route' && p.ort!=='drinnen') p.erledigt.generalprobe=false;   // sonst hielte der alte Haken den Schritt fest   // Generalprobe gilt für diese Route (UNICORN-76)
    return p;
  }

  // Kauflink je Utensil (UNICORN-11): „artikel“ ist eine Liste in fester Rangfolge. Gezeigt wird der erste, der nicht
  // als „verfuegbar: false“ markiert ist – für Eltern ein ganz normaler Link, ohne Hinweis auf Rang oder Ersatz.
  // Alte Form (asin/link/packung/preis direkt am Utensil) gilt als Liste mit einem Eintrag. Sind alle aus: kein Kauflink.
  function artikelWahl(u){
    var liste=Array.isArray(u.artikel) && u.artikel.length ? u.artikel : (u.asin||u.link ? [{asin:u.asin, link:u.link, packung:u.packung, preis:u.preis}] : []);
    for(var i=0;i<liste.length;i++){ var a=liste[i]; if(a && a.verfuegbar!==false && (a.asin||a.link)) return a; }
    return null;
  }
  // Nötig oder Extra (UNICORN-60): dieselbe Einteilung wie „Vorbereitung“ im Spiel (Erwachsene → Einrichten).
  // Ein Artikel ist nötig, wenn ein Eintrag aus vorbereitung.noetig (für diese Spielart) ihn nennt; dessen „Sonst“ ist die Notlösung.
  function rolle(p, tour, id){
    var vb=tour.vorbereitung||{}, v=variante(p), r={noetig:false, notfalls:'', genannt:false};
    function passt(x){ return !x.nur || x.nur.indexOf(v)>=0; }
    (vb.noetig||[]).forEach(function(x){ if((x.u||[]).indexOf(id)<0) return; r.genannt=true; if(passt(x)){ r.noetig=true; r.notfalls=x.notfalls||''; } });
    (vb.extras||[]).forEach(function(x){ if((x.u||[]).indexOf(id)<0) return; r.genannt=true; if(!r.noetig && x.notfalls) r.notfalls=x.notfalls; });
    if(r.genannt && !r.noetig && !r.notfalls && (vb.noetig||[]).some(function(x){ return (x.u||[]).indexOf(id)>=0 && !passt(x); })) r.notfalls='Brauchst du bei dieser Spielart nicht.';
    return r;
  }
  function einkauf(p, tour){
    return tour.utensilien.map(function(u, i){
      var m=String(u.menge), n=/je Kind \+ ?(\d+)/.test(m) ? p.kinder+(+RegExp.$1) : /je Kind/.test(m) ? p.kinder : +m||1;
      var a=artikelWahl(u)||{}, preis=a.asin ? (a.preis!==undefined ? a.preis : null) : undefined;
      var link=a.link || (a.asin ? 'https://www.amazon.de/dp/'+a.asin : undefined);
      var id=u.id||'u'+i, packungen=a.asin ? Math.max(1, Math.ceil(n/(a.packung||n))) : 0;
      var ro=rolle(p, tour, u.id||'u'+i), wie=(p.einkaufWie||{})[u.id||'u'+i]||'';
      return {id:id, noetig:ro.noetig, notfalls:ro.notfalls, wie:wie, name:a.name||u.name, menge:n, wann:u.wann, link:link, asin:a.asin, packung:a.packung, packungen:packungen,
        preis:preis, summe:preis!=null ? preis*packungen : null, zuHause:!!u.zuHause, hinweis:u.hinweis, fertig:!!(p.einkauf||{})[id],
        lieferbar:!!a.asin && preis!=null, gewaehlt:!(p.einkaufAus||{})[id]};
    });
  }
  // Summe der noch offenen Artikel mit bekanntem Preis
  function imKorb(x){ return !x.fertig && x.lieferbar && x.gewaehlt!==false; }   // offen, lieferbar und ausgewählt
  function einkaufSumme(l){ return l.filter(imKorb).reduce(function(s, x){ return s+x.summe; }, 0); }
  // Was alles kosten würde (offen, lieferbar), ganz oder nur das Nötige
  function wegeSummen(l){ var o=l.filter(function(x){ return !x.fertig && x.lieferbar; }); function s(a){ return a.reduce(function(t, x){ return t+x.summe; }, 0); }
    return {alles:s(o), noetig:s(o.filter(function(x){ return x.noetig; })), nAlles:o.length, nNoetig:o.filter(function(x){ return x.noetig; }).length}; }
  // Was auf die Eltern zukommt (UNICORN-72): Material, Vorbereitung, Partytag. Alles aus tour.json und dem Plan gerechnet, nichts fest im Text.
  function aufwand(p, tour, pl){
    var ek=tour && tour.utensilien ? einkauf(p, tour) : [], kauf=ek.filter(function(x){ return x.lieferbar && x.summe!=null; });
    function sum(a){ return a.reduce(function(t, x){ return t+x.summe; }, 0); }
    var b=tour ? basteln(p, tour) : [], d=(tour && tour.dauer)||{}, v=d.meterProMinute||35, st=d.stationenMinuten!=null?d.stationenMinuten:35;
    var tourMin=pl && pl.strecke ? st+Math.round(pl.strecke/v) : (d.minuten||50), heimMin=pl && pl.heimweg ? Math.round(pl.heimweg/v) : 0;
    // Mitgebsel (UNICORN-72, Entscheidung B): was je Kind gekauft wird und die Kinder behalten
    var jeKind={}; ((tour && tour.utensilien) || []).forEach(function(u){ if(u.menge==='je Kind') jeKind[u.id]=1; });
    return {alles:sum(kauf), noetig:sum(kauf.filter(function(x){ return x.noetig; })), mitgebsel:sum(kauf.filter(function(x){ return jeKind[x.id]; })), bastelAlle:bastelMin(b), bastelNoetig:bastelMin(b, true),
      tourMin:tourMin, heimMin:heimMin, vorlaufMin:p.ort!=='drinnen' && !p.vorausgeher ? 90 : 60};
  }
  // Basteln und drucken (UNICORN-60): Aufwand je Aufgabe, was nötig ist und was ohne passiert
  function basteln(p, tour){
    var v=variante(p);
    return ((tour.vorbereitung||{}).basteln||[]).filter(function(x){ return !x.nur || x.nur.indexOf(v)>=0; }).map(function(x){
      return {x:String(x.x).split('{kinder}').join(p.kinder), min:x.min||0, noetig:!!x.noetig, ohne:x.ohne||'', braucht:x.braucht||''};
    });
  }
  function euro(b){ return b.toFixed(2).replace('.', ',')+' €'; }
  // Amazon-Formular „In den Einkaufswagen“: alle offenen, lieferbaren Artikel in einem Schritt
  function warenkorbLink(l, tag){
    var w=l.filter(imKorb);
    if(!w.length) return null;
    return 'https://www.amazon.de/gp/aws/cart/add.html?'+w.map(function(x, i){ return 'ASIN.'+(i+1)+'='+x.asin+'&Quantity.'+(i+1)+'='+x.packungen; }).join('&')+(tag?'&AssociateTag='+encodeURIComponent(tag):'');
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
    var name=p.kind && p.kind.name ? genitiv(p.kind.name) : 'Unsere';
    termin('party', name+' Einhorn-Party ('+tour.titel+')', 'Spiel öffnen: '+basis+'spiel.html?thema='+p.thema, datum(p), true, (tour.dauer.minuten||50)+30);
    aufgaben(p, tour, pl).forEach(function(a){
      if(a.tag===0){                                                      // Partytag: einzelne Termine mit Uhrzeit, ohne den Start (das ist die Party selbst)
        a.teile.forEach(function(x){ if(x.minuten!=null && x.minuten<0) termin(x.id, tour.titel+': '+x.titel, x.text||'', new Date(datum(p).getTime()+x.minuten*60000), true, 20); });
        return;
      }
      termin(a.id, tour.titel+': '+a.titel, (a.text||'')+(a.link&&a.link.charAt(0)!=='#'?'\n'+basis+a.link:''), new Date(a.datum), false, 20);
    });
    return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Schatzweg//Party//DE','CALSCALE:GREGORIAN'].concat(ev,['END:VCALENDAR']).join('\r\n')+'\r\n';
  }


  // ---------- Links zum Teilen ----------
  // Mit Server (konto.js eingerichtet): Link mit Schlüssel je Rolle, null solange die Party nicht gespeichert ist.
  // Ohne Server: die Daten stecken im Link.
  function schluessel(p, rolle){ if(!(root.Konto && root.Konto.aktiv())) return undefined; var a=lesen(p.thema), sv=(a && a.server) || p.server; return (sv && sv.k && sv.k[rolle]) || null; }
  function code(o){ var b=new TextEncoder().encode(JSON.stringify(o)), s=''; for(var i=0;i<b.length;i++) s+=String.fromCharCode(b[i]); return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); }
  function decode(c){ var b=c.replace(/-/g,'+').replace(/_/g,'/'); while(b.length%4) b+='='; var bin=atob(b), a=new Uint8Array(bin.length); for(var i=0;i<bin.length;i++) a[i]=bin.charCodeAt(i); return JSON.parse(new TextDecoder().decode(a)); }
  function basisUrl(){ return location.href.replace(/[?#].*$/,'').replace(/[^/]*$/,''); }
  function partyKern(p){ return {thema:p.thema, kind:p.kind, datum:p.datum, start:p.start, kinder:p.kinder, helfer:p.helfer, vorausgeher:p.vorausgeher, ort:p.ort, planB:p.planB, ausdrucke:p.ausdrucke, erz:p.erz, treffpunkt:p.treffpunkt, abholen:p.abholen, gaesteHinweis:p.gaesteHinweis}; }
  // Hinweis für Gast-Eltern (Mitbringen, bitte beachten); ohne eigenen Text draußen ein Vorschlag
  function gaesteHinweis(p){ if(typeof p.gaesteHinweis==='string') return p.gaesteHinweis.trim(); return p.ort==='drinnen' ? '' : p.planB ? 'Feste Schuhe und Kleidung für draußen. Bei Regen feiern wir drinnen.' : 'Feste Schuhe und Kleidung für draußen, bei Regen Regenjacke und Matschhose.'; }   // mit Plan B (UNICORN-95)
  function planKern(pl, p){ pl=pl||{}; return {format:1, thema:p.thema, stand:pl.stand, variante:pl.variante||variante(p), kinder:pl.kinder||p.kinder, erz:p.erz||pl.erz, erzStand:pl.erzStand, adresse:pl.adresse,
      stationen:(pl.stationen||[]).map(function(s){ return {lat:s.lat, lng:s.lng, name:s.name, an:s.an, zu:s.zu}; }), party:partyKern(p)}; }
  function spielLink(p, pl){ var k=schluessel(p,'spiel'); if(k!==undefined) return k ? basisUrl()+'spiel.html?thema='+p.thema+'&k='+k : null; return basisUrl()+'spiel.html?thema='+p.thema+'&plan='+code(planKern(pl,p)); }
  function vorausgeherLink(p, pl){ var k=schluessel(p,'vorausgeher'); if(k!==undefined) return k ? basisUrl()+'vorausgeher.html?thema='+p.thema+'&k='+k : null; return basisUrl()+'vorausgeher.html?thema='+p.thema+'&plan='+code(planKern(pl,p)); }
  // Antwortfrist (UNICORN-96): 7 Tage vor der Party; ist sie vorbei, nennen Link, Ausdruck und Text keine Frist
  function antwortBis(p, jetzt){ var d=datum(p); d.setDate(d.getDate()-7); d.setHours(23,59,59,0); return d>=(jetzt||new Date()) ? d : null; }
  function einladungsDaten(p, pl){
    var bis=datum(p); bis.setDate(bis.getDate()-7);
    var treff=p.treffpunkt || (p.ort==='drinnen' || !pl || !pl.adresse || pl.adresse==='Mein Standort' ? 'bei uns zu Hause' : pl.adresse);
    return {t:p.thema, n:p.kind&&p.kind.name, a:p.kind&&p.kind.alter, d:p.datum, s:p.start, w:treff, b:p.abholen||uhr(p,150), o:p.ort, r:bis.toISOString().slice(0,10), tel:p.telefon||'', h:gaesteHinweis(p)};
  }
  function einladungsLink(p, pl){ var k=schluessel(p,'gast'); if(k!==undefined) return k ? basisUrl()+'einladung.html?k='+k : null; return basisUrl()+'einladung.html?e='+code(einladungsDaten(p, pl)); }
  // Nach der Party: Danke-Seite für die Gast-Eltern (Urkunde, Rückmeldung), gleicher Schlüssel wie die Einladung
  function dankeLink(p, pl){ var l=einladungsLink(p, pl); return l ? l.replace('/einladung.html?', '/danke.html?') : null; }
  // geteilten Plan (aus einem Link) auf diesem Gerät ablegen; Haken des Geräts bleiben
  // ---------- Party aus einem Link (Tablet, Vorausgeher) übernehmen (PBIM-24) ----------
  // Ein Link kann zur eigenen Party gehören (Schlüssel steckt in server.k) oder zu der von jemand anderem.
  // Fremde Partys bekommen fremd:true und nie die server-Angaben der eigenen Party, sonst würde das Speichern
  // die fremden Daten in die eigene Party auf dem Server schreiben. Die eigene Party wird vorher beiseitegelegt.
  function eigenerSchluessel(p, k){ var s=p && p.server && p.server.k; return !!(s && k && Object.keys(s).some(function(r){ return s[r]===k; })); }
  function ausLinkUebernehmen(thema, c, k){
    var o=typeof c==='string' ? decode(c) : JSON.parse(JSON.stringify(c||null)); if(!o || o.thema!==thema) return null;
    var alt=lesen(thema), eigen=eigenerSchluessel(alt, k), vorher=lies('sj.link.'+thema);
    var gleich=eigen || !!(alt && alt.fremd && (!k || (vorher && vorher.k===k)));     // dieselbe Party wie bisher: Haken behalten
    if(alt && !alt.fremd && !eigen) schreib('sj.eigen.'+thema, {party:alt, plan:plan(thema)});   // eigene Party sichern, nicht überschreiben
    if(o.party){
      o.party.erledigt=(gleich&&alt.erledigt)||{}; o.party.einkauf=(gleich&&alt.einkauf)||{}; o.party.aufgebaut=(gleich&&alt.aufgebaut)||{};
      delete o.party.server; delete o.party.fremd;
      if(eigen) o.party.server=alt.server; else o.party.fremd=true;
      if(gleich&&alt.telefon&&!o.party.telefon) o.party.telefon=alt.telefon;
      schreib('sj.party.'+thema, o.party);
    }
    delete o.party; schreib('sj.plan.'+thema, o); return o;
  }
  function fremd(thema){ var p=lesen(thema); return !!(p && p.fremd); }
  function eigeneGesichert(thema){ var e=lies('sj.eigen.'+thema); return !!(e && e.party && e.party.thema===thema); }
  // Zur eigenen Party zurück: gesicherte Fassung zurücklegen. false = keine da, dann holt konto.js sie vom Server.
  function eigeneZurueck(thema){
    var e=lies('sj.eigen.'+thema);
    ['sj.party.','sj.plan.','sj.link.','sj.eigen.','sj.konto.stand.','sj.gaeste.'].forEach(function(k){ try{ localStorage.removeItem(k+thema); }catch(x){} });
    if(!e || !e.party || e.party.thema!==thema) return false;
    schreib('sj.party.'+thema, e.party); if(e.plan) schreib('sj.plan.'+thema, e.plan);
    return true;
  }
  // Reparatur für Geräte, auf denen eine fremde Party schon mit den eigenen server-Angaben vermischt wurde
  // (alter Stand von ausLinkUebernehmen): Link-Schlüssel gehört nicht zur Party → server entfernen, als fremd markieren.
  // Die eigene Party liegt unverändert auf dem Server und kommt über „Meine Party öffnen“ zurück.
  function reparieren(){
    try{
      var keys=[]; for(var i=0;i<localStorage.length;i++) keys.push(localStorage.key(i));
      keys.forEach(function(key){
        var m=/^sj\.party\.([a-z0-9-]+)$/.exec(key||''); if(!m) return;
        var th=m[1], p=lies(key), l=lies('sj.link.'+th);
        if(p && p.server && !p.fremd && l && l.k && !eigenerSchluessel(p, l.k)){
          delete p.server; p.fremd=true; schreib(key, p);
          localStorage.removeItem('sj.konto.stand.'+th); localStorage.removeItem('sj.gaeste.'+th);
        }
      });
    }catch(e){}
  }
  reparieren();

  // Vorbereitung nach Station (UNICORN-67): eine Liste je Spielart, jedes Ding zeigt auf noetig/extras (Notlösung, Einkauf).
  // Haken-Schlüssel: Spielart (Extra „Hinweise am Weg“ teilt die Haken mit Draußen) + Text, wie bisher.
  function vorbereitungsListe(tour, v, kinder){
    var vb=(tour&&tour.vorbereitung)||{}, l=(vb.liste||{})[v]||(vb.liste||{}).a; if(!l) return {gruppen:[], noetig:0, extras:0, schluessel:[]};
    var hv=v==='b'?'a':v, n={}, e={};
    function f(t){ return String(t||'').replace(/\{kinder\}/g, kinder!=null ? kinder : '{kinder}'); }
    (vb.noetig||[]).forEach(function(x){ n[f(x.x)]=x; n[x.x]=x; }); (vb.extras||[]).forEach(function(x){ e[f(x.x)]=x; e[x.x]=x; });
    var r={gruppen:[], noetig:0, extras:0, schluessel:[]};
    function dinge(d){ return (d||[]).map(function(i){
      var ding=i.ding, extra=!n[ding] && !!e[ding], q=n[ding]||e[ding]||{}, x=f(i.x);
      if(extra) r.extras++; else { r.noetig++; r.schluessel.push(hv+'|'+x); }
      return {x:x, notfalls:i.notfalls||(extra?'':q.notfalls||''), extra:extra, key:hv+'|'+x};
    }); }
    if(l.vorher&&l.vorher.length) r.gruppen.push({art:'vorher', titel:'Vorher', items:dinge(l.vorher)});
    (l.stationen||[]).forEach(function(g){ r.gruppen.push({art:'station', s:g.s, ort:g.ort, wer:g.wer, items:dinge(g.d)}); });
    if(l.mit&&l.mit.length) r.gruppen.push({art:'mit', titel:'Mitnehmen', items:dinge(l.mit)});
    return r;
  }
  // Besorgen (UNICORN-69): dasselbe Material wie in der Party (Artikel, Packungen, Preise, „erledigt“),
  // dazu je Artikel „wofür“ und die nötigen Dinge ohne Einkauf. Eine Quelle für Party und Spiel.
  function wofuerVon(tour, v, id){
    var vb=tour.vorbereitung||{}, w='';
    function passt(x){ return !x.nur || x.nur.indexOf(v)>=0; }
    (vb.noetig||[]).forEach(function(x){ if(!w && passt(x) && (x.u||[]).indexOf(id)>=0) w=x.wofuer||''; });
    (vb.extras||[]).forEach(function(x){ if(!w && (x.u||[]).indexOf(id)>=0) w=x.wofuer||''; });
    return w;
  }
  function preisText(x){                         // gleiche Preiszeile in Party und Spiel
    if(x.zuHause) return 'Hat man meist zu Hause';
    if(!x.asin) return '';
    if(x.preis==null || x.summe==null) return x.preis==null ? 'Gerade nicht lieferbar' : '';
    return (x.packungen>1?x.packungen+' Packungen':'1 Packung')+(x.packung>1?' à '+x.packung+' Stück':'')+' · '+euro(x.summe);
  }
  function besorgen(p, tour){
    var v=variante(p), vb=tour.vorbereitung||{}, ek=einkauf(p, tour);
    ek.forEach(function(x){ x.wofuer=wofuerVon(tour, v, x.id); });
    function f(t){ return String(t||'').split('{kinder}').join(p.kinder); }
    var ohne=(vb.noetig||[]).filter(function(x){ return (!x.nur || x.nur.indexOf(v)>=0) && !(x.u||[]).length; })
      .map(function(x){ return {x:f(x.x), wofuer:f(x.wofuer), notfalls:f(x.notfalls), key:(v==='b'?'a':v)+'|b|'+f(x.x)}; });
    return {noetig:ek.filter(function(x){ return x.noetig; }), extras:ek.filter(function(x){ return !x.noetig; }), ohne:ohne, summen:wegeSummen(ek)};
  }
  // „Jonas’“, „Max’“, „Emmas“ (UNICORN-117): überall dieselbe Regel
  function genitiv(n){ n=String(n||''); return /[sßxz]$/i.test(n) ? n+'’' : n+'s'; }
  root.Party={genitiv:genitiv, antwortBis:antwortBis, besorgen:besorgen, preisText:preisText, wofuerVon:wofuerVon, vorbereitungsListe:vorbereitungsListe, wegeSummen:wegeSummen, basteln:basteln, artikelWahl:artikelWahl, imKorb:imKorb, einkaufSumme:einkaufSumme, euro:euro, warenkorbLink:warenkorbLink, lesen:lesen, plan:plan, fremd:fremd, eigeneGesichert:eigeneGesichert, eigeneZurueck:eigeneZurueck, eigenerSchluessel:eigenerSchluessel, speichern:speichern, loeschen:loeschen, variante:variante, datum:datum, tageBis:tageBis, uhr:uhr, datumText:datumText, aufgaben:aufgaben, naechste:naechste, abhaken:abhaken, einkauf:einkauf, ics:ics, code:code, decode:decode, spielLink:spielLink, vorausgeherLink:vorausgeherLink, einladungsLink:einladungsLink, einladungsDaten:einladungsDaten, dankeLink:dankeLink, planKern:planKern, ausLinkUebernehmen:ausLinkUebernehmen, gaesteHinweis:gaesteHinweis, routeSchluessel:routeSchluessel, probeStand:probeStand, aufwand:aufwand};
})(this);
