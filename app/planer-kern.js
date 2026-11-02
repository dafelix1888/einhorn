// Planer-Kern: aus OpenStreetMap-Daten (Overpass) und Höhendaten eine Schnitzeljagd-Route bauen.
// Reine Rechnerei ohne Netz und ohne Oberfläche, damit sie sich auch ohne Karte testen lässt.
// Die Stationen eines Themas sagen über ort.typ, was sie brauchen:
//   start            die eingegebene Adresse
//   weg              irgendein Wegpunkt, gern eine Ecke
//   strassenquerung  Zebrastreifen, Ampel oder eine Stelle, an der ein Fußweg eine Straße kreuzt
//   zaun             Zaun, Hecke oder Mauer direkt am Weg
//   kreuzung         Wegkreuzung (mindestens drei Richtungen)
//   huegel_unten     tiefste Stelle vor dem Anstieg zum Ziel
//   bank             Parkbank (mit ort.oben: möglichst erhöht), sonst Spielplatz, Park, Aussichtspunkt
//   spielplatz       Spielplatz, sonst Park, sonst Bank
(function(root){
  'use strict';
  var RAD=Math.PI/180;
  function meter(a,b){ var dl=(b.lat-a.lat)*RAD, dn=(b.lng-a.lng)*RAD, x=Math.sin(dl/2)*Math.sin(dl/2)+Math.cos(a.lat*RAD)*Math.cos(b.lat*RAD)*Math.sin(dn/2)*Math.sin(dn/2); return 2*6371000*Math.asin(Math.min(1,Math.sqrt(x))); }
  function peilung(a,b){ var y=Math.sin((b.lng-a.lng)*RAD)*Math.cos(b.lat*RAD), x=Math.cos(a.lat*RAD)*Math.sin(b.lat*RAD)-Math.sin(a.lat*RAD)*Math.cos(b.lat*RAD)*Math.cos((b.lng-a.lng)*RAD); return (Math.atan2(y,x)/RAD+360)%360; }
  function winkelDiff(a,b){ var d=Math.abs(a-b)%360; return d>180?360-d:d; }
  var RICHTUNG={N:0, NO:45, O:90, SO:135, S:180, SW:225, W:270, NW:315};

  var FUSS=/^(footway|path|pedestrian|track|steps|bridleway|cycleway|living_street)$/;
  var STRASSE=/^(residential|service|unclassified|tertiary|tertiary_link|secondary|secondary_link|primary|primary_link|living_street)$/;
  var GROSS=/^(primary|primary_link|secondary|secondary_link|trunk)$/;

  // ---------- Overpass-Abfrage ----------
  function overpassAbfrage(lat, lng, radius){
    var a='(around:'+Math.round(radius)+','+lat.toFixed(6)+','+lng.toFixed(6)+')';
    return '[out:json][timeout:40];('+
      'way'+a+'[highway~"^(footway|path|pedestrian|track|steps|bridleway|cycleway|living_street|residential|service|unclassified|tertiary|tertiary_link|secondary|secondary_link|primary|primary_link)$"]["access"!~"^(private|no)$"]["foot"!~"^(no|private)$"];'+
      ')->.w;.w out body geom;'+
      '(node'+a+'[highway~"^(crossing|traffic_signals)$"];node'+a+'[amenity=bench];node'+a+'[leisure=playground];node'+a+'[natural=peak];node'+a+'[tourism=viewpoint];)->.n;.n out body;'+
      '(way'+a+'[barrier~"^(fence|hedge|wall)$"];)->.z;.z out body geom;'+
      '(way'+a+'[leisure~"^(park|playground)$"];way'+a+'[natural=wood];way'+a+'[landuse~"^(forest|meadow|grass|recreation_ground)$"];)->.f;.f out tags center;'+
      'node'+a+'[natural=tree];out skel qt 3000;';
  }

  // ---------- Wegenetz ----------
  function netzBauen(osm){
    var knoten={}, nachbarn={}, wegeAnKnoten={}, nId=0;
    var baenke=[], spielplaetze=[], gipfel=[], querungen={}, zaeune=[], flaechen=[], baeume=[];
    function k(id, lat, lng){ if(!knoten[id]) knoten[id]={id:id, lat:lat, lng:lng}; return knoten[id]; }
    function kante(a,b,f,weg){ var d=meter(knoten[a],knoten[b])*f; (nachbarn[a]=nachbarn[a]||[]).push({n:b,d:d,weg:weg}); (nachbarn[b]=nachbarn[b]||[]).push({n:a,d:d,weg:weg}); }
    (osm.elements||[]).forEach(function(e){
      var t=e.tags||{};
      if(e.type==='way' && t.highway && e.nodes && e.geometry && e.nodes.length===e.geometry.length){
        var hw=t.highway, fuss=FUSS.test(hw), f=fuss?0.9:GROSS.test(hw)?(t.sidewalk==='no'?3:1.6):1.1;
        if(hw==='steps') f=1.8;
        if(hw==='track' && t.tracktype && /grade[45]/.test(t.tracktype)) f=1.3;
        var weg={id:e.id, name:t.name||null, highway:hw, fuss:fuss, strasse:STRASSE.test(hw)&&!fuss, querung:t.footway==='crossing'||t.cycleway==='crossing'};
        for(var i=0;i<e.nodes.length;i++){
          k(e.nodes[i], e.geometry[i].lat, e.geometry[i].lon);
          (wegeAnKnoten[e.nodes[i]]=wegeAnKnoten[e.nodes[i]]||[]).push(weg);
          if(i>0 && e.nodes[i]!==e.nodes[i-1]) kante(e.nodes[i-1], e.nodes[i], f, weg);
        }
        if(weg.querung) e.nodes.forEach(function(id){ querungen[id]=querungen[id]||'Fußgängerüberweg'; });
      } else if(e.type==='way' && t.barrier && e.geometry){
        zaeune.push({art:t.barrier, punkte:e.geometry.map(function(g){ return {lat:g.lat, lng:g.lon}; })});
      } else if(e.type==='way' && e.center){
        flaechen.push({lat:e.center.lat, lng:e.center.lon, name:t.name||null, art:t.leisure||t.natural||t.landuse});
      } else if(e.type==='node'){
        var p={lat:e.lat, lng:e.lon, id:e.id, tags:t};
        if(t.amenity==='bench') baenke.push(p);
        else if(t.leisure==='playground') spielplaetze.push(p);
        else if(t.natural==='peak' || t.tourism==='viewpoint') gipfel.push(p);
        else if(t.highway==='crossing' || t.highway==='traffic_signals') querungen[e.id]=t.highway==='traffic_signals'?'Ampel':(t.crossing==='zebra'||t.crossing_ref==='zebra'?'Zebrastreifen':'Fußgängerüberweg');
        else if(t.natural==='tree') baeume.push(p);
      }
    });
    // Spielplätze, die nur als Fläche eingetragen sind
    flaechen.forEach(function(f){ if(f.art==='playground') spielplaetze.push({lat:f.lat, lng:f.lng, tags:{name:f.name}}); });
    return {knoten:knoten, nachbarn:nachbarn, wegeAnKnoten:wegeAnKnoten, baenke:baenke, spielplaetze:spielplaetze, gipfel:gipfel, querungen:querungen, zaeune:zaeune, flaechen:flaechen, baeume:baeume};
  }

  function naechsterKnoten(netz, p, max){
    var best=null, bd=max||Infinity;
    for(var id in netz.knoten){ if(!netz.nachbarn[id]) continue; var d=meter(p, netz.knoten[id]); if(d<bd){ bd=d; best=id; } }
    return best ? {id:best, d:bd} : null;
  }

  // Dijkstra mit kleinem Binär-Heap
  function kante(a,b){ return a<b ? a+'|'+b : b+'|'+a; }
  function dijkstra(netz, start, ziel, meiden){                 // meiden: Kanten des Hinwegs, kosten sechsfach
    var dist={}, vor={}, heap=[[0,start]]; dist[start]=0;
    function hoch(i){ while(i>0){ var p=(i-1)>>1; if(heap[p][0]<=heap[i][0]) break; var t=heap[p]; heap[p]=heap[i]; heap[i]=t; i=p; } }
    function runter(i){ for(;;){ var l=2*i+1, r=l+1, m=i; if(l<heap.length && heap[l][0]<heap[m][0]) m=l; if(r<heap.length && heap[r][0]<heap[m][0]) m=r; if(m===i) break; var t=heap[m]; heap[m]=heap[i]; heap[i]=t; i=m; } }
    while(heap.length){
      var top=heap[0], last=heap.pop(); if(heap.length){ heap[0]=last; runter(0); }
      var d=top[0], u=top[1]; if(d>dist[u]) continue;
      if(ziel!==undefined && u===ziel) break;
      (netz.nachbarn[u]||[]).forEach(function(e){ var nd=d+(meiden && meiden[kante(u,e.n)] ? e.d*6 : e.d); if(dist[e.n]===undefined || nd<dist[e.n]){ dist[e.n]=nd; vor[e.n]=u; heap.push([nd,e.n]); hoch(heap.length-1); } });
    }
    return {dist:dist, vor:vor};
  }
  function pfad(dj, ziel){ var p=[ziel]; while(dj.vor[p[0]]!==undefined) p.unshift(dj.vor[p[0]]); return p; }

  // echte Gehstrecke (ohne Gewichte) entlang eines Pfads
  function streckeAuf(netz, ids){
    var l=[0];
    for(var i=1;i<ids.length;i++) l.push(l[i-1]+meter(netz.knoten[ids[i-1]], netz.knoten[ids[i]]));
    return l;
  }

  // ---------- Eigenschaften eines Knotens ----------
  function wegeVon(netz, id){ return netz.wegeAnKnoten[id]||[]; }
  function grad(netz, id){ var s={}; (netz.nachbarn[id]||[]).forEach(function(e){ s[e.n]=1; }); return Object.keys(s).length; }
  function abstandZuStrecke(p, a, b){        // Abstand Punkt–Strecke in Metern (lokal eben gerechnet)
    var kx=Math.cos(p.lat*RAD)*111320, ky=110540;
    var ax=(a.lng-p.lng)*kx, ay=(a.lat-p.lat)*ky, bx=(b.lng-p.lng)*kx, by=(b.lat-p.lat)*ky;
    var dx=bx-ax, dy=by-ay, l=dx*dx+dy*dy, t=l?Math.max(0,Math.min(1,-(ax*dx+ay*dy)/l)):0;
    var x=ax+t*dx, y=ay+t*dy; return Math.sqrt(x*x+y*y);
  }
  function zaunNah(netz, p){
    var best=null;
    netz.zaeune.forEach(function(z){ for(var i=1;i<z.punkte.length;i++){ var d=abstandZuStrecke(p, z.punkte[i-1], z.punkte[i]); if(d<12 && (!best || d<best.d)) best={d:d, art:z.art}; } });
    return best;
  }
  function baeumeNah(netz, p, r){ var n=0; netz.baeume.forEach(function(b){ if(meter(p,b)<r) n++; }); return n; }
  function flaecheNah(netz, p, r){ var best=null; netz.flaechen.forEach(function(f){ var d=meter(p,f); if(d<r && (!best || d<best.d)) best={d:d, f:f}; }); return best && best.f; }
  function querungAm(netz, id){
    if(netz.querungen[id]) return netz.querungen[id];
    var w=wegeVon(netz,id), fuss=w.some(function(x){ return x.fuss; }), str=w.filter(function(x){ return x.strasse; });
    if(fuss && str.length) return 'Stelle, an der der Weg die Straße kreuzt';
    if(str.length>=2 && grad(netz,id)>=3) return 'Straßenecke';
    return null;
  }
  function knick(netz, ids, i){
    if(i<=0 || i>=ids.length-1) return 0;
    var a=netz.knoten[ids[i-1]], b=netz.knoten[ids[i]], c=netz.knoten[ids[i+1]];
    return winkelDiff(peilung(a,b), peilung(b,c));
  }

  // ---------- Namen und Sprechbausteine ----------
  var WEIBLICH=/(straße|strasse|allee|chaussee|gasse|promenade|brücke|zeile|wiese|koppel|bahn|aue|heide|treppe|twiete)$/i;
  var SAECHLICH=/(ufer|feld|tal|moor|holz|gehege)$/i;
  function praeposition(name){
    if(!name) return null;
    if(/^(an der|am|auf der|im|in der|zum|zur|beim)\b/i.test(name)) return {an:name, zu:name};
    if(/(park|wald|garten|hain|forst|gehölz)$/i.test(name)) return {an:'im '+name, zu:'in den '+name};
    if(WEIBLICH.test(name)) return {an:'an der '+name, zu:'zur '+name};
    if(SAECHLICH.test(name)) return {an:'am '+name, zu:'zum '+name};
    return {an:'am '+name, zu:'zum '+name};   // Weg, Pfad, Damm, Ring, Platz, Park, Stieg, Kamp, Redder …
  }
  function wegName(netz, id, lieberStrasse){
    var w=wegeVon(netz,id), l=w.filter(function(x){ return x.name && (lieberStrasse ? x.strasse : true); });
    if(!l.length) l=w.filter(function(x){ return x.name; });
    return l.length ? l[0].name : null;
  }

  // ---------- Höhen ----------
  // hoehen(punkte) → Promise<[Meter]>; der Kern fragt nur einmal gebündelt.
  function proben(netz, ids, strecke, abstand){
    var out=[], naechste=0;
    for(var i=0;i<ids.length;i++){ if(strecke[i]>=naechste || i===ids.length-1){ out.push(i); naechste=strecke[i]+abstand; } }
    return out;
  }
  function hoeheBei(probenIdx, probenH, i){        // lineare Zuordnung: Knoten i bekommt die Höhe der nächstgelegenen Probe
    var best=0, bd=Infinity; for(var k=0;k<probenIdx.length;k++){ var d=Math.abs(probenIdx[k]-i); if(d<bd){ bd=d; best=k; } } return probenH[best];
  }

  // ---------- Ziel finden ----------
  function zielKandidaten(netz, dj, start, spec, opt){
    var D=opt.distanz, soll=RICHTUNG[opt.richtung], liste=[];
    function rein(p, art, name, gewicht){
      var n=naechsterKnoten(netz, p, 60); if(!n || dj.dist[n.id]===undefined) return;
      var weg=dj.dist[n.id]+n.d; if(weg<D*0.6 || weg>D*1.45) return;
      var richtungOk=soll===undefined ? 1 : Math.max(0, 1-winkelDiff(peilung(start,p), soll)/75);
      if(soll!==undefined && richtungOk<=0) return;
      var s=gewicht*(1-Math.min(1,Math.abs(weg-D)/D))*(0.4+0.6*richtungOk);
      var baum=baeumeNah(netz,p,25), fl=flaecheNah(netz,p,120);
      if(baum) s*=1+Math.min(0.3,baum*0.05);
      if(fl && /park|wood|forest|playground|recreation/.test(fl.art)) s*=1.2;
      liste.push({punkt:{lat:p.lat,lng:p.lng}, knoten:n.id, art:art, name:name||null, flaeche:fl, weg:weg, score:s});
    }
    var typ=spec.typ;
    if(typ==='bank'){ netz.baenke.forEach(function(b){ rein(b,'Bank',b.tags.name,1); }); netz.gipfel.forEach(function(g){ rein(g,'Aussichtspunkt',g.tags.name,0.7); }); netz.spielplaetze.forEach(function(s){ rein(s,'Spielplatz',s.tags.name,0.6); }); }
    else if(typ==='spielplatz'){ netz.spielplaetze.forEach(function(s){ rein(s,'Spielplatz',s.tags.name,1); }); netz.baenke.forEach(function(b){ rein(b,'Bank',b.tags.name,0.5); }); }
    if(liste.length<6){                        // Ersatz: irgendein Wegpunkt in passender Entfernung und Richtung
      var ids=Object.keys(dj.dist), schritt=Math.max(1,Math.floor(ids.length/400));
      for(var i=0;i<ids.length;i+=schritt){ var kn=netz.knoten[ids[i]]; rein(kn,'Wegpunkt',null,0.35); }
    }
    liste.sort(function(a,b){ return b.score-a.score; });
    var ausgewaehlt=[];                        // nicht zu dicht beieinander, damit „Neu würfeln“ echte Alternativen bringt
    liste.forEach(function(c){ if(ausgewaehlt.length<10 && ausgewaehlt.every(function(x){ return meter(x.punkt,c.punkt)>60; })) ausgewaehlt.push(c); });
    return ausgewaehlt;
  }

  // ---------- Stationen auf der Route verteilen ----------
  function stationenSetzen(netz, ids, strecke, hoehe, stationen, ziel){
    var L=strecke[strecke.length-1], out=[], letzte=0;
    var zielH=hoehe(ids.length-1);
    stationen.forEach(function(st, si){
      var spec=st.ort||{typ:'weg'}, typ=spec.typ;
      if(typ==='start'){ out.push({i:0, gefunden:true, hinweis:'Startadresse'}); return; }
      if(spec.ende){ out.push({i:ids.length-1, gefunden:ziel.art!=='Wegpunkt', hinweis:ziel.art+(ziel.name?' „'+ziel.name+'“':''), ziel:true}); return; }
      var rest=stationen.length-1-si;                       // Platz für die folgenden Stationen lassen
      var soll=(spec.anteil!=null?spec.anteil:si/(stationen.length-1))*L;
      var von=Math.max(letzte+35, soll-0.17*L), bis=Math.min(L-35*rest, soll+0.17*L);
      if(bis<von){ von=letzte+20; bis=Math.max(von, L-20*rest); }
      var best=null;
      for(var i=1;i<ids.length-1;i++){
        if(strecke[i]<von || strecke[i]>bis) continue;
        var id=ids[i], p=netz.knoten[id], s=1-Math.abs(strecke[i]-soll)/(0.17*L+1)*0.5, treffer=null;
        if(typ==='strassenquerung'){ var q=querungAm(netz,id); if(q){ s+=q==='Straßenecke'?1:2; treffer=q; } }
        else if(typ==='zaun'){ var z=zaunNah(netz,p); if(z){ s+=2-z.d/12; treffer={fence:'Zaun',hedge:'Hecke',wall:'Mauer'}[z.art]||'Zaun'; } }
        else if(typ==='kreuzung'){ var g=grad(netz,id); if(g>=3){ var nurFuss=wegeVon(netz,id).every(function(w){ return w.fuss; }); s+=1.5+(g>=4?0.5:0)+(nurFuss?0.5:0); treffer=g>=4?'Kreuzung':'Abzweigung'; } }
        else if(typ==='huegel_unten'){ var anstieg=zielH-hoehe(i); if(anstieg>=3){ s+=Math.min(2.5, anstieg/4); treffer='Hügelfuß, '+Math.round(anstieg)+' m Anstieg bis zum Ziel'; } }
        else if(typ==='spielplatz'){ var sp=null; netz.spielplaetze.forEach(function(x){ if(meter(p,x)<40) sp=x; }); if(sp){ s+=2; treffer='Spielplatz'; } }
        else { var kw=knick(netz,ids,i); if(kw>35){ s+=0.6; treffer='Ecke'; } else treffer=null; }
        if(!best || s>best.s) best={i:i, s:s, treffer:treffer};
      }
      if(!best){ var mitte=0; for(var j=1;j<ids.length-1;j++) if(strecke[j]>letzte+10){ mitte=j; break; } best={i:mitte||Math.max(1,ids.length-2), treffer:null}; }
      letzte=strecke[best.i];
      out.push({i:best.i, gefunden:!!best.treffer || typ==='weg', hinweis:best.treffer || (typ==='weg'?'Wegpunkt':'nicht gefunden, normaler Wegpunkt')});
    });
    return out;
  }

  function stationsName(netz, ids, s, st, ziel){
    var id=ids[s.i], p=netz.knoten[id], typ=(st.ort||{}).typ;
    if(typ==='start') return {name:'Haustür', strasse:wegName(netz,id)};
    if(s.ziel){
      var fl=ziel.flaeche;
      var ort=(fl && fl.name) || wegName(netz,id);
      return {name:(ziel.art==='Wegpunkt'?st.name:ziel.art)+(ort?' '+(praeposition(ort)||{an:'bei '+ort}).an:''), strasse:ort};
    }
    var strasse=typ==='strassenquerung' ? wegName(netz,id,true) : wegName(netz,id);
    var basis=s.gefunden ? ({strassenquerung:'Übergang', zaun:'Zaun', kreuzung:'Kreuzung', huegel_unten:'Hügel', weg:'Ecke', spielplatz:'Spielplatz'}[typ]||st.name) : 'Wegpunkt';
    return {name:basis+(strasse?' '+(praeposition(strasse)||{an:strasse}).an:''), strasse:strasse};
  }

  // ---------- alles zusammen ----------
  // opt: {start:{lat,lng}, richtung:'N'…|'egal', distanz:m, stationen:[…aus tour.json], hoehen:function(punkte)->Promise, versuch:n}
  function planen(osm, opt){
    var netz=netzBauen(osm);
    var s=naechsterKnoten(netz, opt.start, 250);
    if(!s) return Promise.reject(new Error('Rund um die Adresse gibt es in OpenStreetMap keine Wege.'));
    var dj=dijkstra(netz, s.id);
    var zielSpec=(opt.stationen[opt.stationen.length-1].ort)||{typ:'bank'};
    var zielOpt={distanz:opt.rundkurs ? opt.distanz*0.5 : opt.distanz, richtung:opt.richtung};   // Rundkurs: Regler gilt für die ganze Runde
    var kand=zielKandidaten(netz, dj, opt.start, zielSpec, zielOpt);
    if(!kand.length) return Promise.reject(new Error('In dieser Richtung und Entfernung gibt es keine passenden Wege. Andere Richtung oder Strecke versuchen.'));
    // jede Kandidaten-Route bewerten: wie viele Stationen finden ihren Ort?
    var routen=kand.map(function(z){ var ids=pfad(dj, z.knoten); return {ziel:z, ids:ids, strecke:streckeAuf(netz, ids)}; })
      .filter(function(r){ return r.ids.length>=opt.stationen.length; });
    if(!routen.length) return Promise.reject(new Error('Die Wege sind zu kurz für alle Stationen. Längere Strecke wählen.'));
    // Höhen: Proben aller Routen und der Ziele in einem Rutsch
    var alleProben=[], index=[];
    routen.forEach(function(r){ r.proben=proben(netz, r.ids, r.strecke, Math.max(15, r.strecke[r.strecke.length-1]/40)); index.push(alleProben.length); r.proben.forEach(function(i){ alleProben.push(netz.knoten[r.ids[i]]); }); });
    var hoehenHolen=opt.hoehen ? opt.hoehen(alleProben)['catch'](function(){ return null; }) : Promise.resolve(null);
    return hoehenHolen.then(function(H){
      routen.forEach(function(r, ri){
        var ph=H ? H.slice(index[ri], index[ri]+r.proben.length) : r.proben.map(function(){ return 0; });
        r.hoehe=function(i){ return hoeheBei(r.proben, ph, i); };
        r.hoehenProfil=r.proben.map(function(i,k){ return {m:r.strecke[i], h:ph[k]}; });
        r.st=stationenSetzen(netz, r.ids, r.strecke, r.hoehe, opt.stationen, r.ziel);
        var treffer=r.st.filter(function(x){ return x.gefunden; }).length;
        var hoch=zielSpec.oben && H ? Math.max(0, r.hoehe(r.ids.length-1)-r.hoehe(0)) : 0;
        r.wert=treffer*10 + r.ziel.score*8 + Math.min(6, hoch/2);
        r.rueck=rueckweg(netz, r.ids, opt.rundkurs);
        if(opt.rundkurs && r.rueck){
          var runde=r.strecke[r.strecke.length-1]+r.rueck.laenge;
          r.wert+=(1-r.rueck.gleich)*15 - Math.min(10, Math.abs(runde-opt.distanz)/opt.distanz*10);
        }
      });
      routen.sort(function(a,b){ return b.wert-a.wert; });
      var r=routen[(opt.versuch||0)%routen.length];
      var stationen=r.st.map(function(s, si){
        var st=opt.stationen[si], p=netz.knoten[r.ids[s.i]], nm=stationsName(netz, r.ids, s, st, r.ziel);
        var pr=s.gefunden && st.ort && st.ort.typ!=='start' ? praeposition(nm.strasse) : null;   // Ortsansage nur, wenn der Ort wirklich zur Geschichte passt
        var punkt=s.ziel ? r.ziel.punkt : {lat:p.lat, lng:p.lng};
        return {lat:+punkt.lat.toFixed(6), lng:+punkt.lng.toFixed(6), name:nm.name, an:pr&&pr.an, zu:pr&&pr.zu,
                typ:(st.ort||{}).typ, gefunden:s.gefunden, hinweis:s.hinweis, nachMeter:Math.round(r.strecke[s.i]), hoehe:H?Math.round(r.hoehe(s.i)):null};
      });
      stationen[0].lat=+opt.start.lat.toFixed(6); stationen[0].lng=+opt.start.lng.toFixed(6);
      return {
        stationen:stationen,
        route:r.ids.map(function(id){ var k=netz.knoten[id]; return [+k.lat.toFixed(6), +k.lng.toFixed(6)]; }),
        strecke:Math.round(r.strecke[r.strecke.length-1]),
        hoehenProfil:H ? r.hoehenProfil : null,
        heimweg:r.rueck ? r.rueck.laenge : null, heimRoute:r.rueck ? r.rueck.route : null, heimGleich:r.rueck ? Math.round(r.rueck.gleich*100) : null,
        netz:netz,
        varianten:routen.length,
        versuch:(opt.versuch||0)%routen.length
      };
    });
  }



  // ---------- Rückweg: kürzester Weg zurück, beim Rundkurs möglichst nicht auf dem Hinweg ----------
  function rueckweg(netz, hinIds, rundkurs){
    var von=hinIds[hinIds.length-1], zu=hinIds[0], meiden=null;
    if(rundkurs){ meiden={}; for(var i=1;i<hinIds.length;i++) meiden[kante(hinIds[i-1],hinIds[i])]=1; }
    var dj=dijkstra(netz, von, zu, meiden); if(dj.dist[zu]===undefined) return null;
    var ids=pfad(dj, zu), l=streckeAuf(netz, ids), gleich=0;
    var hin={}; for(var k=1;k<hinIds.length;k++) hin[kante(hinIds[k-1],hinIds[k])]=1;
    for(var j=1;j<ids.length;j++) if(hin[kante(ids[j-1],ids[j])]) gleich+=l[j]-l[j-1];
    var laenge=l[l.length-1];
    return {ids:ids, laenge:Math.round(laenge), gleich:laenge?gleich/laenge:0,
            route:ids.map(function(id){ var x=netz.knoten[id]; return [+x.lat.toFixed(6), +x.lng.toFixed(6)]; })};
  }
  // ---------- Route durch feste Punkte (für das Verschieben von Hand) ----------
  // punkte: [{lat,lng}] in Reihenfolge. Jeder Punkt wird auf den nächsten Weg gezogen,
  // zwischen zwei Punkten nimmt die Route den kürzesten Fußweg.
  function routeDurch(netz, punkte){
    var snap=punkte.map(function(p){ return naechsterKnoten(netz, p, 400); });
    if(snap.some(function(x){ return !x; })) return null;
    var ids=[snap[0].id], nach=[0];
    for(var i=1;i<snap.length;i++){
      if(snap[i].id===snap[i-1].id){ nach.push(nach[i-1]); continue; }
      var dj=dijkstra(netz, snap[i-1].id, snap[i].id);
      if(dj.dist[snap[i].id]===undefined) return null;
      var teil=pfad(dj, snap[i].id), l=streckeAuf(netz, teil);
      nach.push(nach[i-1]+l[l.length-1]);
      ids=ids.concat(teil.slice(1));
    }
    return {ids:ids, route:ids.map(function(id){ var k=netz.knoten[id]; return [+k.lat.toFixed(6), +k.lng.toFixed(6)]; }),
            strecke:Math.round(nach[nach.length-1]), nach:nach.map(Math.round),
            knoten:snap.map(function(x){ var k=netz.knoten[x.id]; return {id:x.id, lat:+k.lat.toFixed(6), lng:+k.lng.toFixed(6), abstand:Math.round(x.d)}; })};
  }
  function wegLaenge(netz, a, b){             // kürzester Fußweg zwischen zwei Punkten in Metern (z. B. Heimweg)
    var r=routeDurch(netz, [a,b]); return r ? r.strecke : null;
  }
  function ortAm(netz, id){                    // Straßenname und Sprechbausteine für einen Wegknoten
    var name=wegName(netz, id), pr=praeposition(name);
    return {strasse:name, an:pr&&pr.an, zu:pr&&pr.zu};
  }
  // Dauer: feste Zeit an den Stationen plus Gehzeit im Kindertempo
  function dauer(tour, meter){
    var d=tour.dauer||{}, st=d.stationenMinuten!=null?d.stationenMinuten:35, v=d.meterProMinute||35;
    var gehen=Math.round(meter/v); return {gesamt:st+gehen, gehen:gehen, stationen:st};
  }

  var api={rueckweg:rueckweg, routeDurch:routeDurch, wegLaenge:wegLaenge, ortAm:ortAm, dauer:dauer, planen:planen, overpassAbfrage:overpassAbfrage, netzBauen:netzBauen, praeposition:praeposition, meter:meter, peilung:peilung, RICHTUNG:RICHTUNG};
  if(typeof module!=='undefined' && module.exports) module.exports=api; else root.PlanerKern=api;
})(this);
