// Wichtel Bommi (UNICORN-141): Auswahl, Material-Weg und eigener Zeitplan. Ohne Bildschirm, damit Tests es direkt prüfen.
// Daten kommen aus themen/wichtel/material.json und themen/wichtel/geschichten.json. Datum immer als "JJJJ-MM-TT".
(function(wurzel){
  'use strict';
  var TAG=86400000;
  var WOCHE=['So','Mo','Di','Mi','Do','Fr','Sa'];
  function d(iso){ var t=iso.split('-'); return new Date(Date.UTC(+t[0], +t[1]-1, +t[2])); }
  function iso(dt){ return dt.toISOString().slice(0,10); }
  function plus(s, n){ return iso(new Date(d(s).getTime()+n*TAG)); }
  function abstand(a, b){ return Math.round((d(b)-d(a))/TAG); }
  function kurz(s){ var x=d(s); return WOCHE[x.getUTCDay()]+' '+x.getUTCDate()+'.'+(x.getUTCMonth()+1)+'.'; }
  function gueltig(s){ return typeof s==='string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(d(s)); }

  // Saison: bis Heiligabend dieses Jahr, danach das nächste.
  function saison(heute){ var j=+heute.slice(0,4); return heute.slice(5)>'12-24' ? j+1 : j; }

  // Vier Adventssonntage: der vierte ist der letzte Sonntag vor dem 25. Dezember.
  function advent(jahr){
    var w=d(jahr+'-12-24'), vierter=iso(new Date(w.getTime()-w.getUTCDay()*TAG));
    return [plus(vierter,-21), plus(vierter,-14), plus(vierter,-7), vierter];
  }

  function paket(material, name){ var p=material.pakete[name]; return p ? p.nr.slice() : []; }
  // Welches Paket passt genau zur Auswahl (sonst null = eigene Auswahl).
  function welchesPaket(material, nrs){
    var s=nrs.slice().sort(function(a,b){return a-b;}).join(',');
    for(var k in material.pakete) if(material.pakete[k].nr.join(',')===s) return k;
    return null;
  }
  // Nr. 1 und Nr. 8 sind immer dabei.
  function auswahl(nrs){
    var m={1:true,8:true}; (nrs||[]).forEach(function(n){ n=+n; if(n>=1 && n<=8) m[n]=true; });
    return Object.keys(m).map(Number).sort(function(a,b){return a-b;});
  }

  // Tage verteilen: gleichmäßig vom ersten bis zum letzten Tag, oder (Advent) erster Tag und dann die Adventssonntage.
  function tage(nrs, o){
    var n=nrs.length, erg={}, erster=o.erster, letzter=o.letzter;
    if(o.sonntage){
      var so=advent(+erster.slice(0,4)).filter(function(s){ return s>erster; });
      if(so.length>=n-1){ erg[nrs[0]]=erster; for(var i=1;i<n;i++) erg[nrs[i]]=so[so.length-(n-1)+i-1]; return erg; }
    }
    if(letzter<erster) letzter=erster;
    var span=abstand(erster, letzter);
    for(var j=0;j<n;j++) erg[nrs[j]] = n===1 ? erster : plus(erster, Math.round(j*span/(n-1)));
    return erg;
  }

  // Was je Geschichte gekauft und was gebastelt wird.
  function kaufListe(material, szenario){
    if(szenario==='kaufen') return material.artikel.map(function(a){ return a.id; });
    return (material.szenarien[szenario] && material.szenarien[szenario].kauf) || [];
  }

  // Der ganze Plan. wahl = {nr:[...], szenario, erster, letzter, sonntage, eigene:{nr:datum}}
  function plan(material, geschichten, wahl, heute){
    var nrs=auswahl(wahl.nr), szen=material.szenarien[wahl.szenario] ? wahl.szenario : 'gemischt';
    var auto=tage(nrs, wahl), kauf=kaufListe(material, szen), vorher=material.bestellen_tage_vorher||4;
    var titel={}; (geschichten.geschichten||geschichten).forEach(function(g){ titel[g.nr]=g; });
    var zeilen=nrs.map(function(nr){
      var e=wahl.eigene && wahl.eigene[nr];
      return { nr:nr, titel:titel[nr]?titel[nr].titel:'Geschichte '+nr, wert:titel[nr]?titel[nr].wert:'', datum: gueltig(e)?e:auto[nr], eigen: gueltig(e), kaufen:[], basteln:[], material:[] };
    }).sort(function(a,b){ return a.datum<b.datum?-1:a.datum>b.datum?1:a.nr-b.nr; });
    var summe=0, offen=0;
    zeilen.forEach(function(z, i){
      material.artikel.forEach(function(a){
        if(!(a.nr===z.nr || (a.nr==='alle' && i===0))) return;
        if(a.aus){ var ausGekauft=kauf.indexOf(a.aus)>=0; z.basteln.push(ausGekauft ? a.name+' bereitlegen' : a.selbst); z.material.push({ id:a.id, name:a.name, gekauft:ausGekauft, selbst:a.selbst }); return; }
        if(kauf.indexOf(a.id)>=0){ z.kaufen.push(a); if(a.preis==null) offen++; else summe+=a.preis; }
        else z.basteln.push(a.selbst);
        z.material.push({ id:a.id, name:a.name, gekauft:kauf.indexOf(a.id)>=0, selbst:a.selbst, extra:!!a.extra });
      });
      z.basteln.push('Brief von Oma Mooswinkel ausdrucken');
      z.bestellenBis = z.kaufen.length ? plus(z.datum, -vorher) : null;
      z.bastelnBis = plus(z.datum, -1);
      z.knapp = !!(z.bestellenBis && heute && z.bestellenBis<heute);
      z.vorbei = !!(heute && z.datum<heute);
    });
    return { zeilen:zeilen, szenario:szen, summe:Math.round(summe*100)/100, ohnePreis:offen };
  }

  // Dateien einer Geschichte (UNICORN-143). Geschichte 1 liegt noch im Muster-Ordner, die übrigen kommen nach themen/wichtel/g<nr>/ (UNICORN-138).
  var ORDNER={1:'themen/wichtel/muster/'};
  function medien(nr){
    nr=+nr; var o=ORDNER[nr]||('themen/wichtel/g'+nr+'/'), b=[];
    for(var i=1;i<=5;i++) b.push({ bild:o+'g'+nr+'-bild'+i+'.jpg', ton:o+'g'+nr+'-bild'+i+'.mp3' });
    return { video:o+'g'+nr+'-video.mp4', bilder:b, ersatz:'themen/wichtel/einstieg.jpg' };
  }

  // Welche Geschichte ist heute dran: ?nr= gewinnt, sonst die letzte im Zeitplan, deren Tag erreicht ist, sonst die erste.
  function heutige(zeilen, heute, wunsch){
    wunsch=+wunsch; if(wunsch>=1 && wunsch<=8) return wunsch;
    if(!zeilen || !zeilen.length) return 1;
    var nr=zeilen[0].nr; zeilen.forEach(function(z){ if(z.datum<=heute) nr=z.nr; });
    return nr;
  }

  // Material besorgen (UNICORN-137): Kauf-Artikel einmal je Artikel mit Link und frühestem Bestelltag, Basteln je Geschichte.
  function link(a){
    if(a.asin) return 'https://www.amazon.de/dp/'+a.asin;
    return 'https://www.amazon.de/s?k='+encodeURIComponent(a.suche||a.name).replace(/%20/g,'+');
  }
  function einkauf(p){
    var nach={}, kaufen=[], basteln=[];
    p.zeilen.forEach(function(z){
      z.kaufen.forEach(function(a){
        var e=nach[a.id];
        if(!e){ e=nach[a.id]={ id:a.id, name:a.name, preis:a.preis, geschaetzt:!!a.geschaetzt, link:link(a), selbst:a.selbst, extra:!!a.extra, nr:[], bis:z.bestellenBis }; kaufen.push(e); }
        e.nr.push(z.nr); if(z.bestellenBis<e.bis) e.bis=z.bestellenBis;
      });
      basteln.push({ nr:z.nr, titel:z.titel, bis:z.bastelnBis, was:z.basteln.slice() });
    });
    kaufen.sort(function(a,b){ return a.bis<b.bis?-1:a.bis>b.bis?1:0; });
    return { kaufen:kaufen, basteln:basteln, summe:p.summe, ohnePreis:p.ohnePreis };
  }

  // Eltern-Ansicht (UNICORN-142). Gespielt = letztes Bild der Bildergeschichte geöffnet (sj.wichtel.gespielt, UNICORN-143).
  function fortschritt(zeilen, gespielt){
    var g=(gespielt||[]).map(Number), n=zeilen.filter(function(z){ return g.indexOf(z.nr)>=0; }).length, von=zeilen.length;
    return { gespielt:n, von:von, text:n+' von '+von+(von===1?' Bommel':' Bommeln'), fertig: von>0 && n===von };
  }
  // Was heute und morgen dran ist (morgen = heute Abend aufbauen).
  function dran(zeilen, heute){
    var m=plus(heute, 1), r={ heute:null, morgen:null };
    zeilen.forEach(function(z){ if(z.datum===heute && !r.heute) r.heute=z; if(z.datum===m && !r.morgen) r.morgen=z; });
    return r;
  }
  // Vorbereitungs-Seite einer Geschichte: Aufbau in drei Schritten plus fester Bommel-Schritt, Material zum gewählten Weg, Mitmach-Aufgabe, Brief.
  function vorbereitung(zeile, g){
    g=g||{};
    var farbe=g.bommel ? g.bommel+'en ' : '';
    var aufbau=(g.aufbau||[]).slice(0,3);
    aufbau.push('Zum Schluss: einen '+farbe+'Bommel dazulegen, falls er noch fehlt. Wo ein Bommel liegt, war Bommi da.');
    return { nr:zeile.nr, titel:zeile.titel, datum:zeile.datum, bastelnBis:zeile.bastelnBis, aufbau:aufbau,
      material:zeile.material.slice(), mitmachen:g.mitmachen||'', brief:g.brief||'', bommel:g.bommel||'' };
  }

  // Konto ab Geschichte 2 (UNICORN-144): Geschichte 1 ist geschenkt, ab Nr. 2 braucht es die Anmeldung.
  function braucheKonto(nr){ return +nr>=2; }
  // Abgleich Gerät ↔ Konto. lokal und server.daten: { wahl, gespielt:[Nr.], zeit:ms der letzten Änderung }.
  // Die neuere Wahl gewinnt (ohne Wahl auf dem Gerät immer die vom Konto), gespielte Geschichten werden vereinigt.
  // hochladen = das Ergebnis weicht vom Konto ab.
  function abgleich(lokal, server){
    lokal=lokal||{}; var s=(server&&server.daten)||null;
    var lw=lokal.wahl&&lokal.wahl.nr ? lokal.wahl : null, sw=s&&s.wahl&&s.wahl.nr ? s.wahl : null;
    var vomKonto=!!sw && (!lw || (+s.zeit||0)>(+lokal.zeit||0));
    var gesp=[]; (lokal.gespielt||[]).concat(s&&s.gespielt||[]).forEach(function(n){ n=+n; if(n>=1 && n<=8 && gesp.indexOf(n)<0) gesp.push(n); });
    gesp.sort(function(a,b){ return a-b; });
    var daten={ wahl: vomKonto ? sw : lw, gespielt:gesp, zeit: vomKonto ? +s.zeit||0 : +lokal.zeit||0 };
    if(!daten.wahl && !gesp.length) return { daten:daten, hochladen:false, vomKonto:false };
    var gleich=!!s && JSON.stringify({w:s.wahl||null, g:(s.gespielt||[]).slice().sort(function(a,b){ return a-b; }), z:+s.zeit||0})===JSON.stringify({w:daten.wahl||null, g:gesp, z:daten.zeit});
    return { daten:daten, hochladen:!gleich, vomKonto:vomKonto };
  }

  function euro(x){ return x.toFixed(2).replace('.',',').replace(',00','')+' €'; }

  var WK={ saison:saison, advent:advent, paket:paket, welchesPaket:welchesPaket, auswahl:auswahl, tage:tage, plan:plan, kurz:kurz, plus:plus, euro:euro, gueltig:gueltig, medien:medien, heutige:heutige, einkauf:einkauf, link:link, fortschritt:fortschritt, dran:dran, vorbereitung:vorbereitung, braucheKonto:braucheKonto, abgleich:abgleich };
  if(typeof module!=='undefined' && module.exports) module.exports=WK; else wurzel.WichtelKern=WK;
})(this);
