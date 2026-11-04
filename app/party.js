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

  // Zeitplan der Vorbereitung: sechs gebündelte Schritte. Jeder Schritt hat Teile; ein Teil ist entweder
  // automatisch erkannt (erkannt; nurAuto = nur automatisch, z. B. Route geplant) oder von Hand abgehakt (p.erledigt[teil.id]).
  // Der Schritt ist fertig, wenn alle Teile fertig sind oder er als Ganzes abgehakt wurde (p.erledigt['schritt.'+id]).
  // Die Teil-IDs entsprechen den früheren Einzelschritten, damit vorhandene Haken erhalten bleiben.
  function aufgaben(p, tour, pl){
    var draussen=p.ort!=='drinnen', v=variante(p), route=!!(pl && pl.stationen && pl.stationen.length), t=p.thema;
    var erledigt=p.erledigt||{};
    var ek=tour && tour.utensilien ? einkauf(p, tour) : [], allesGekauft=ek.length>0 && ek.every(function(x){ return x.fertig; });
    var km=pl && pl.strecke ? (pl.strecke>=1000 ? (pl.strecke/1000).toFixed(1).replace('.',',')+' km' : Math.round(pl.strecke)+' m') : '';
    var wetter=!draussen ? '' : p.planB ? ' Regen gemeldet? Dann schaltest du mit einem Tipp auf drinnen um.' : ' Ohne Plan B: bei Regen Termin oder Ort überlegen.';
    var l=[
      {id:'einladen', tag:-14, titel:'Einladung als Link schicken', kurz:'Per WhatsApp, Eltern sagen mit einem Tipp zu',
        text:'Ein Link für alle Gast-Eltern: Termin, Treffpunkt, Abholzeit und Zusage.', knopf:'Link teilen', aktion:'gast-link',
        link:'einladung.html?e='+code(einladungsDaten(p, pl)), teile:[{id:'einladen', titel:'Einladung geschickt'}]},
      {id:'bestellen', tag:-14, titel:'Alles auf einmal bestellen', kurz:'Eine Liste, Mengen passend zu '+p.kinder+' Kindern',
        text:'Haarreifen, Holz-Regenbogen, Glückssteine und Zaubertafeln. Alle Mengen stehen in der Einkaufsliste.', knopf:'Zur Einkaufsliste', link:'#einkauf',
        teile:[{id:'bestellen', titel:'Alles bestellt', erkannt:allesGekauft}]},
      draussen ?
        {id:'route', tag:-7, titel:'Route planen und einmal ablaufen', kurz:route?'Route steht'+(km?', '+km:'')+'. Jetzt einmal ablaufen':'Der Planer findet die Orte für die Stationen',
          text:route?'Die Route steht'+(km?' ('+km+')':'')+'. Geh sie einmal ab und verschieb Stationen, wo es nicht passt.':'Adresse eingeben, Route prüfen, beim Spaziergang Stationen verschieben, wo es nicht passt.',
          knopf:route?'Route ansehen':'Route planen', link:'planer.html?thema='+t,
          teile:[{id:'route', titel:'Route geplant', nurAuto:true, erkannt:route}, {id:'probelauf', titel:'Einmal abgelaufen'}]} :
        {id:'route', tag:-7, titel:'Räume festlegen', kurz:'Küche, Flur, Treppe, Toberaum und Sofa',
          text:'Leg fest, welche Station in welchem Raum steht. Die Liste im Spiel hilft dabei.', knopf:'Liste öffnen', link:'spiel.html?thema='+t+'#einrichten',
          teile:[{id:'probelauf', titel:'Räume festgelegt'}]},
      {id:'basteln', tag:-7, titel:'Bastel- und Druckabend', kurz:'Schatzkiste, Fuchsbau, Urkunden'+(v==='a'?', Wolke':''),
        text:'Etwa eine Stunde: Schatzkiste bekleben, Fuchsbau grau anmalen, Sticker in '+p.kinder+' Stücke schneiden. '+(v==='a'?'Dazu Urkunden und die schlafende Wolke (A3) drucken.':'Dazu die Urkunden drucken.'),
        knopf:'Druckvorlagen öffnen', link:'druck.html?thema='+t, neben:{text:'Bastelliste im Spiel', link:'spiel.html?thema='+t+'#einrichten'},
        teile:[{id:'basteln', titel:'Gebastelt'}, {id:'drucken', titel:'Gedruckt'}]},
      {id:'geraet', tag:-1, titel:'iPad startklar machen', kurz:'Stimmen laden, Ton'+(draussen?' und GPS':'')+' prüfen',
        text:'Fünf Minuten im WLAN: Stimmen laden, Ton'+(draussen?', GPS':'')+' und Akku prüfen.'+wetter, knopf:'Startklar öffnen', link:'bereit.html?thema='+t,
        teile:[{id:'geraet', titel:'iPad ist startklar'}]},
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
      a.fertig=!!erledigt['schritt.'+a.id] || a.teile.every(function(x){ return x.fertig; });
      a.auto=false;
    });
    return l;
  }
  function naechste(l){ return l.filter(function(a){ return !a.fertig; })[0]||null; }
  // Haken für einen ganzen Schritt setzen oder lösen (alle Teile, die man von Hand abhaken kann)
  function abhaken(p, a, an){
    p.erledigt=p.erledigt||{};
    a.teile.forEach(function(x){ if(!x.nurAuto) p.erledigt[x.id]=!!an; });
    p.erledigt['schritt.'+a.id]=!!an;
    return p;
  }

  function einkauf(p, tour){
    return tour.utensilien.map(function(u, i){
      var m=String(u.menge), n=/je Kind \+ ?(\d+)/.test(m) ? p.kinder+(+RegExp.$1) : /je Kind/.test(m) ? p.kinder : +m||1;
      var id=u.id||'u'+i, packungen=u.asin ? Math.max(1, Math.ceil(n/(u.packung||n))) : 0;
      return {id:id, name:u.name, menge:n, wann:u.wann, link:u.link, asin:u.asin, packung:u.packung, packungen:packungen,
        preis:u.preis, summe:u.preis!=null ? u.preis*packungen : null, zuHause:!!u.zuHause, hinweis:u.hinweis, fertig:!!(p.einkauf||{})[id],
        lieferbar:!!u.asin && u.preis!=null, gewaehlt:!(p.einkaufAus||{})[id]};
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
    return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Zauberspiegel//Party//DE','CALSCALE:GREGORIAN'].concat(ev,['END:VCALENDAR']).join('\r\n')+'\r\n';
  }


  // ---------- Links zum Teilen (ohne Server: die Daten stecken im Link) ----------
  function code(o){ var b=new TextEncoder().encode(JSON.stringify(o)), s=''; for(var i=0;i<b.length;i++) s+=String.fromCharCode(b[i]); return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); }
  function decode(c){ var b=c.replace(/-/g,'+').replace(/_/g,'/'); while(b.length%4) b+='='; var bin=atob(b), a=new Uint8Array(bin.length); for(var i=0;i<bin.length;i++) a[i]=bin.charCodeAt(i); return JSON.parse(new TextDecoder().decode(a)); }
  function basisUrl(){ return location.href.replace(/[?#].*$/,'').replace(/[^/]*$/,''); }
  function partyKern(p){ return {thema:p.thema, kind:p.kind, datum:p.datum, start:p.start, kinder:p.kinder, helfer:p.helfer, vorausgeher:p.vorausgeher, ort:p.ort, planB:p.planB, ausdrucke:p.ausdrucke, treffpunkt:p.treffpunkt, abholen:p.abholen}; }
  function planKern(pl, p){ pl=pl||{}; return {format:1, thema:p.thema, stand:pl.stand, variante:pl.variante||variante(p), kinder:pl.kinder||p.kinder, adresse:pl.adresse,
      stationen:(pl.stationen||[]).map(function(s){ return {lat:s.lat, lng:s.lng, name:s.name, an:s.an, zu:s.zu}; }), party:partyKern(p)}; }
  function spielLink(p, pl){ return basisUrl()+'spiel.html?thema='+p.thema+'&plan='+code(planKern(pl,p)); }
  function vorausgeherLink(p, pl){ return basisUrl()+'vorausgeher.html?thema='+p.thema+'&plan='+code(planKern(pl,p)); }
  function einladungsDaten(p, pl){
    var bis=datum(p); bis.setDate(bis.getDate()-7);
    var treff=p.treffpunkt || (p.ort==='drinnen' || !pl || !pl.adresse || pl.adresse==='Mein Standort' ? 'bei uns zu Hause' : pl.adresse);
    return {t:p.thema, n:p.kind&&p.kind.name, a:p.kind&&p.kind.alter, d:p.datum, s:p.start, w:treff, b:p.abholen||uhr(p,150), o:p.ort, r:bis.toISOString().slice(0,10), tel:p.telefon||''};
  }
  function einladungsLink(p, pl){ return basisUrl()+'einladung.html?e='+code(einladungsDaten(p, pl)); }
  // geteilten Plan (aus einem Link) auf diesem Gerät ablegen; Haken des Geräts bleiben
  function ausLinkUebernehmen(thema, c){
    var o=decode(c); if(!o || o.thema!==thema) return null;
    if(o.party){ var alt=lesen(thema); o.party.erledigt=(alt&&alt.erledigt)||{}; o.party.einkauf=(alt&&alt.einkauf)||{}; o.party.aufgebaut=(alt&&alt.aufgebaut)||{}; schreib('sj.party.'+thema, o.party); }
    delete o.party; schreib('sj.plan.'+thema, o); return o;
  }

  root.Party={imKorb:imKorb, einkaufSumme:einkaufSumme, euro:euro, warenkorbLink:warenkorbLink, lesen:lesen, plan:plan, speichern:speichern, loeschen:loeschen, variante:variante, datum:datum, tageBis:tageBis, uhr:uhr, datumText:datumText, aufgaben:aufgaben, naechste:naechste, abhaken:abhaken, einkauf:einkauf, ics:ics, code:code, decode:decode, spielLink:spielLink, vorausgeherLink:vorausgeherLink, einladungsLink:einladungsLink, einladungsDaten:einladungsDaten, ausLinkUebernehmen:ausLinkUebernehmen};
})(this);
