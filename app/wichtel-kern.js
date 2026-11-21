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
      return { nr:nr, titel:titel[nr]?titel[nr].titel:'Geschichte '+nr, wert:titel[nr]?titel[nr].wert:'', datum: gueltig(e)?e:auto[nr], eigen: gueltig(e), kaufen:[], basteln:[] };
    }).sort(function(a,b){ return a.datum<b.datum?-1:a.datum>b.datum?1:a.nr-b.nr; });
    var summe=0, offen=0;
    zeilen.forEach(function(z, i){
      material.artikel.forEach(function(a){
        if(!(a.nr===z.nr || (a.nr==='alle' && i===0))) return;
        if(a.aus){ z.basteln.push(kauf.indexOf(a.aus)>=0 ? a.name+' bereitlegen' : a.selbst); return; }
        if(kauf.indexOf(a.id)>=0){ z.kaufen.push(a); if(a.preis==null) offen++; else summe+=a.preis; }
        else z.basteln.push(a.selbst);
      });
      z.basteln.push('Brief von Oma Mooswinkel ausdrucken');
      z.bestellenBis = z.kaufen.length ? plus(z.datum, -vorher) : null;
      z.bastelnBis = plus(z.datum, -1);
      z.knapp = !!(z.bestellenBis && heute && z.bestellenBis<heute);
      z.vorbei = !!(heute && z.datum<heute);
    });
    return { zeilen:zeilen, szenario:szen, summe:Math.round(summe*100)/100, ohnePreis:offen };
  }

  function euro(x){ return x.toFixed(2).replace('.',',').replace(',00','')+' €'; }

  var WK={ saison:saison, advent:advent, paket:paket, welchesPaket:welchesPaket, auswahl:auswahl, tage:tage, plan:plan, kurz:kurz, plus:plus, euro:euro, gueltig:gueltig };
  if(typeof module!=='undefined' && module.exports) module.exports=WK; else wurzel.WichtelKern=WK;
})(this);
