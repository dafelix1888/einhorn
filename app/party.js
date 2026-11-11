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
    if(!alt && root.marketer){ try{ root.marketer.track('party_created'); }catch(e){} }    // Marketer: nur beim ersten Anlegen, Name nicht ändern
    p.geaendert=new Date().toISOString(); schreib('sj.party.'+p.thema, p);
    if(root.Konto) root.Konto.merken(p.thema);                                // angemeldet: kurz danach geschützt speichern
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

  // Zeitplan der Vorbereitung: sechs gebündelte Schritte. Jeder Schritt hat Teile; ein Teil ist entweder
  // automatisch erkannt (erkannt; nurAuto = nur automatisch, z. B. Route geplant) oder von Hand abgehakt (p.erledigt[teil.id]).
  // Der Schritt ist fertig, wenn alle Teile fertig sind oder er als Ganzes abgehakt wurde (p.erledigt['schritt.'+id]).
  // Die Teil-IDs entsprechen den früheren Einzelschritten, damit vorhandene Haken erhalten bleiben.
  function aufgaben(p, tour, pl){
    var draussen=p.ort!=='drinnen', v=variante(p), route=!!(pl && pl.stationen && pl.stationen.length), t=p.thema;
    var erledigt=p.erledigt||{};
    // Namens-Sätze gibt es nur mit Server (Konto) und Vornamen
    var name=p.kind && p.kind.name ? String(p.kind.name) : '', mitNamen=!!(name && root.Konto && root.Konto.aktiv && root.Konto.aktiv());
    var ek=tour && tour.utensilien ? einkauf(p, tour) : [], allesGekauft=ek.length>0 && ek.every(function(x){ return x.fertig; });
    var km=pl && pl.strecke ? (pl.strecke>=1000 ? (pl.strecke/1000).toFixed(1).replace('.',',')+' km' : Math.round(pl.strecke)+' m') : '';
    var wetter=!draussen ? '' : p.planB ? ' Regen gemeldet? Dann schaltest du mit einem Tipp auf drinnen um.' : ' Ohne Plan B: bei Regen Termin oder Ort überlegen.';
    var l=[
      // Reihenfolge (UNICORN-27): zuerst, was Lieferzeit braucht; die Einladung geht, wann man mag. Nichts ist gesperrt.
      {id:'bestellen', tag:-14, titel:'Alles bestellen', kurz:'Eine Liste, passend für '+p.kinder+' Kinder',
        text:'Haarreifen, Holz-Regenbogen, Glückssteine und Zaubertafeln: Die Mengen passen schon zu '+p.kinder+' Kindern.', knopf:'Zur Einkaufsliste', link:'#einkauf',
        teile:[{id:'bestellen', titel:'Alles bestellt', erkannt:allesGekauft}]},
      {id:'einladen', tag:-14, titel:'Gäste einladen', kurz:'Ein Link für alle Eltern, du siehst, wer kommt',
        text:'Ein Link für alle Gast-Eltern. Sie sehen Termin, Treffpunkt und Abholzeit und sagen dort zu oder ab. Wer kommt, siehst du hier.', knopf:'Link teilen', aktion:'gast-link',
        link:einladungsLink(p, pl)||('party.html?thema='+t+'#einladung'), teile:[{id:'einladen', titel:'Einladung geschickt'}]},
      draussen ?
        {id:'route', tag:-7, titel:route?'Route ablaufen':'Route planen', kurz:route?'Steht schon'+(km?', '+km:'')+'. Einmal zur Probe gehen':'Der Planer findet die Orte für die Stationen',
          text:route?'Eure Route steht'+(km?' ('+km+')':'')+'. Geh sie einmal ab. Passt ein Ort nicht, verschiebst du die Station im Planer mit dem Finger.':'Adresse eingeben, Richtung wählen: Der Planer sucht passende Orte für die Stationen. Danach einmal ablaufen.',
          knopf:route?'Route ansehen':'Route planen', link:'planer.html?thema='+t,
          teile:[{id:'route', titel:'Route geplant', nurAuto:true, erkannt:route}, {id:'probelauf', titel:'Einmal abgelaufen'}]} :
        {id:'route', tag:-7, titel:'Räume festlegen', kurz:'Küche, Flur, Treppe, Toberaum und Sofa',
          text:'Leg fest, welche Station in welchem Raum steht. Die Liste im Spiel hilft dabei.', knopf:'Liste öffnen', link:'spiel.html?thema='+t+'#einrichten',
          teile:[{id:'probelauf', titel:'Räume festgelegt'}]},
      {id:'basteln', tag:-7, titel:'Basteln und drucken', kurz:'Schatzkiste, Fuchsbau, Urkunden'+(v==='a'?', Wolke':''),
        text:'Etwa eine Stunde: Schatzkiste bekleben, Fuchsbau grau anmalen, Sticker in '+p.kinder+' Stücke schneiden. '+(v==='a'?'Dazu Urkunden und die schlafende Wolke (A3) drucken.':'Dazu die Urkunden drucken.'),
        knopf:'Druckvorlagen öffnen', link:'druck.html?thema='+t, neben:{text:'Bastelliste im Spiel', link:'spiel.html?thema='+t+'#einrichten'},
        teile:[{id:'basteln', titel:'Gebastelt'}, {id:'drucken', titel:'Gedruckt'}]},
      {id:'geraet', tag:-1, titel:'iPad startklar machen', kurz:(mitNamen?'Funkel lernt den Namen, ':'')+'Stimmen laden, Ton'+(draussen?' und GPS':'')+' prüfen',
        text:(mitNamen?'Zuerst lernt Funkel den Namen: Er sagt „'+name+'“ an der Haustür, beim Schatz und zum Abschied. Dann ':'')+(mitNamen?'f':'F')+'ünf Minuten im WLAN: Stimmen laden, Ton'+(draussen?', GPS':'')+' und Akku prüfen.'+wetter, knopf:'Startklar öffnen', link:'bereit.html?thema='+t,
        // „Funkel kennt …“ (UNICORN-33) steht sichtbar im Ablauf, zählt aber nicht für den Haken des Schritts (Extra, später bezahlt)
        teile:(mitNamen?[{id:'namen', titel:'Funkel kennt '+name, text:'Einmal einsprechen und anhören', extra:true}]:[]).concat([{id:'geraet', titel:'iPad ist startklar'}])},
      {id:'partytag', tag:0, titel:'Partytag', kurz:[draussen&&v!=='c'?'Kreidespur':'', p.vorausgeher?'Vorausgeher':'', 'Spiegel starten'].filter(Boolean).join(', '),
        text:[draussen&&v!=='c'?'Eine Stunde vorher die Kreidespur malen.':'', p.vorausgeher?'20 Minuten vorher geht der Vorausgeher los.':'', draussen?'Dann alle an die Haustür und den Zauberspiegel starten.':'Dann alle zusammenholen und den Zauberspiegel starten.'].filter(Boolean).join(' '),
        knopf:'Startklar öffnen', link:'bereit.html?thema='+t,
        teile:[
          draussen && v!=='c' ? {id:'kreide', minuten:-60, titel:'Kreidespur malen', text:'Von der Haustür bis Station 2: Hufe, dann kleine Pfoten.'} : null,
          p.vorausgeher ? {id:'vorausgeher', minuten:-20, titel:'Vorausgeher startet', text:'Mit der Tasche vorgehen und die Stationen 2 bis 7 aufbauen.'} : null,
          {id:'start', minuten:0, titel:draussen?'Alle an der Haustür':'Alle zusammen', text:'Tattoos verteilen, dann den Zauberspiegel aufwecken.'}
        ].filter(Boolean)}
    ];
    l.forEach(function(a){
      a.datum=plus(p, a.tag);
      a.teile.forEach(function(x){
        x.auto=!!x.nurAuto; x.fertig=!!x.erkannt || (!x.nurAuto && !!erledigt[x.id]);
        if(x.minuten!=null) x.uhr=uhr(p, x.minuten);
      });
      a.fertig=!!erledigt['schritt.'+a.id] || a.teile.every(function(x){ return x.fertig || x.extra; });
      a.auto=false;
    });
    return l;
  }
  function naechste(l){ return l.filter(function(a){ return !a.fertig; })[0]||null; }
  // Haken für einen ganzen Schritt setzen oder lösen (alle Teile, die man von Hand abhaken kann)
  function abhaken(p, a, an){
    p.erledigt=p.erledigt||{};
    a.teile.forEach(function(x){ if(!x.nurAuto && !x.extra) p.erledigt[x.id]=!!an; });
    p.erledigt['schritt.'+a.id]=!!an;
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
  function einkauf(p, tour){
    return tour.utensilien.map(function(u, i){
      var m=String(u.menge), n=/je Kind \+ ?(\d+)/.test(m) ? p.kinder+(+RegExp.$1) : /je Kind/.test(m) ? p.kinder : +m||1;
      var a=artikelWahl(u)||{}, preis=a.asin ? (a.preis!==undefined ? a.preis : null) : undefined;
      var link=a.link || (a.asin ? 'https://www.amazon.de/dp/'+a.asin : undefined);
      var id=u.id||'u'+i, packungen=a.asin ? Math.max(1, Math.ceil(n/(a.packung||n))) : 0;
      return {id:id, name:a.name||u.name, menge:n, wann:u.wann, link:link, asin:a.asin, packung:a.packung, packungen:packungen,
        preis:preis, summe:preis!=null ? preis*packungen : null, zuHause:!!u.zuHause, hinweis:u.hinweis, fertig:!!(p.einkauf||{})[id],
        lieferbar:!!a.asin && preis!=null, gewaehlt:!(p.einkaufAus||{})[id]};
    });
  }
  // Summe der noch offenen Artikel mit bekanntem Preis
  function imKorb(x){ return !x.fertig && x.lieferbar && x.gewaehlt!==false; }   // offen, lieferbar und ausgewählt
  function einkaufSumme(l){ return l.filter(imKorb).reduce(function(s, x){ return s+x.summe; }, 0); }
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
    var name=p.kind && p.kind.name ? (/[sßxz]$/i.test(p.kind.name) ? p.kind.name+'’' : p.kind.name+'s') : 'Unsere';
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
  function partyKern(p){ return {thema:p.thema, kind:p.kind, datum:p.datum, start:p.start, kinder:p.kinder, helfer:p.helfer, vorausgeher:p.vorausgeher, ort:p.ort, planB:p.planB, ausdrucke:p.ausdrucke, treffpunkt:p.treffpunkt, abholen:p.abholen, gaesteHinweis:p.gaesteHinweis}; }
  // Hinweis für Gast-Eltern (Mitbringen, bitte beachten); ohne eigenen Text draußen ein Vorschlag
  function gaesteHinweis(p){ if(typeof p.gaesteHinweis==='string') return p.gaesteHinweis.trim(); return p.ort==='drinnen' ? '' : 'Feste Schuhe und Kleidung für draußen, bei Regen Regenjacke und Matschhose.'; }
  function planKern(pl, p){ pl=pl||{}; return {format:1, thema:p.thema, stand:pl.stand, variante:pl.variante||variante(p), kinder:pl.kinder||p.kinder, adresse:pl.adresse,
      stationen:(pl.stationen||[]).map(function(s){ return {lat:s.lat, lng:s.lng, name:s.name, an:s.an, zu:s.zu}; }), party:partyKern(p)}; }
  function spielLink(p, pl){ var k=schluessel(p,'spiel'); if(k!==undefined) return k ? basisUrl()+'spiel.html?thema='+p.thema+'&k='+k : null; return basisUrl()+'spiel.html?thema='+p.thema+'&plan='+code(planKern(pl,p)); }
  function vorausgeherLink(p, pl){ var k=schluessel(p,'vorausgeher'); if(k!==undefined) return k ? basisUrl()+'vorausgeher.html?thema='+p.thema+'&k='+k : null; return basisUrl()+'vorausgeher.html?thema='+p.thema+'&plan='+code(planKern(pl,p)); }
  function einladungsDaten(p, pl){
    var bis=datum(p); bis.setDate(bis.getDate()-7);
    var treff=p.treffpunkt || (p.ort==='drinnen' || !pl || !pl.adresse || pl.adresse==='Mein Standort' ? 'bei uns zu Hause' : pl.adresse);
    return {t:p.thema, n:p.kind&&p.kind.name, a:p.kind&&p.kind.alter, d:p.datum, s:p.start, w:treff, b:p.abholen||uhr(p,150), o:p.ort, r:bis.toISOString().slice(0,10), tel:p.telefon||'', h:gaesteHinweis(p)};
  }
  function einladungsLink(p, pl){ var k=schluessel(p,'gast'); if(k!==undefined) return k ? basisUrl()+'einladung.html?k='+k : null; return basisUrl()+'einladung.html?e='+code(einladungsDaten(p, pl)); }
  // Nach der Party: Danke-Seite für die Gast-Eltern (Urkunde, Rückmeldung), gleicher Schlüssel wie die Einladung
  function dankeLink(p, pl){ var l=einladungsLink(p, pl); return l ? l.replace('/einladung.html?', '/danke.html?') : null; }
  // geteilten Plan (aus einem Link) auf diesem Gerät ablegen; Haken des Geräts bleiben
  function ausLinkUebernehmen(thema, c){
    var o=typeof c==='string' ? decode(c) : JSON.parse(JSON.stringify(c||null)); if(!o || o.thema!==thema) return null;
    if(o.party){ var alt=lesen(thema); o.party.erledigt=(alt&&alt.erledigt)||{}; o.party.einkauf=(alt&&alt.einkauf)||{}; o.party.aufgebaut=(alt&&alt.aufgebaut)||{};
      if(alt&&alt.server) o.party.server=alt.server; if(alt&&alt.telefon&&!o.party.telefon) o.party.telefon=alt.telefon; schreib('sj.party.'+thema, o.party); }
    delete o.party; schreib('sj.plan.'+thema, o); return o;
  }

  root.Party={artikelWahl:artikelWahl, imKorb:imKorb, einkaufSumme:einkaufSumme, euro:euro, warenkorbLink:warenkorbLink, lesen:lesen, plan:plan, speichern:speichern, loeschen:loeschen, variante:variante, datum:datum, tageBis:tageBis, uhr:uhr, datumText:datumText, aufgaben:aufgaben, naechste:naechste, abhaken:abhaken, einkauf:einkauf, ics:ics, code:code, decode:decode, spielLink:spielLink, vorausgeherLink:vorausgeherLink, einladungsLink:einladungsLink, einladungsDaten:einladungsDaten, dankeLink:dankeLink, planKern:planKern, ausLinkUebernehmen:ausLinkUebernehmen, gaesteHinweis:gaesteHinweis};
})(this);
