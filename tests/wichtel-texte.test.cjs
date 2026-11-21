// Wichtel Bommi (UNICORN-134): Texte der Geschichten halten die Vorgaben aus STRAT-42 und STRAT-44 ein.
// Läuft ohne Browser.
const fs=require('fs'), path=require('path');
let fehler=0; const ok=(c,t)=>{ console.log((c?'ok   ':'FEHLER ')+t); if(!c) fehler++; };
const ORDNER=path.join(__dirname,'..','app','themen','wichtel');
const g=JSON.parse(fs.readFileSync(path.join(ORDNER,'geschichten.json'),'utf8'));
const stimmen=JSON.parse(fs.readFileSync(path.join(ORDNER,'stimmen.json'),'utf8'));
const R=g.regeln;
const woerter=s=>s.replace(/[„“"…]/g,' ').split(/\s+/).filter(w=>/[A-Za-zÄÖÜäöüß]/.test(w)).length;
// Was Kinder hören: keine Ziffern, keine Kindernamen-Platzhalter, kein Datum, keine Marke, kein Weihnachtsmann oder Christkind.
const VERBOTEN=[/\d/, /Weihnachtsmann|Christkind|Nikolaus/i, /Dezember|Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag/, /Amazon|Lego|Playmobil/i, /Pups|Klo\b|Toilette|pupsen/i, /\{|\}/];
const FIGUREN=Object.keys(stimmen.figuren);

ok(g.geschichten.length===8, '8 Geschichten');
ok(g.geschichten.map(x=>x.nr).join()==='1,2,3,4,5,6,7,8', 'Nummern 1 bis 8 in Reihenfolge');
ok(g.geschichten[0].pflicht && g.geschichten[7].pflicht && g.geschichten.slice(1,7).every(x=>!x.pflicht), 'Nr. 1 und Nr. 8 sind Pflicht, 2 bis 7 frei');
ok(new Set(g.geschichten.map(x=>x.id)).size===8, 'IDs eindeutig');
ok(new Set(g.geschichten.map(x=>x.bommel)).size===8, 'Jede Geschichte hat eine eigene Bommel-Farbe');

for(const x of g.geschichten){
  const n='Nr. '+x.nr+' ';
  const vw=woerter(x.video);
  ok(x.video.startsWith(R.video_anfang), n+'Video beginnt mit „'+R.video_anfang+'“');
  ok(x.video.endsWith(R.video_ende), n+'Video endet mit „'+R.video_ende+'“');
  ok(vw>=R.video_woerter[0] && vw<=R.video_woerter[1], n+'Video hat '+vw+' Wörter ('+R.video_woerter.join(' bis ')+')');
  ok(x.bilder.length===5, n+'5 Bilder');
  const ganz=x.bilder.map(b=>b.text).join(' ');
  const gw=woerter(ganz);
  ok(gw>=R.geschichte_woerter[0] && gw<=R.geschichte_woerter[1], n+'Bildergeschichte hat '+gw+' Wörter ('+R.geschichte_woerter.join(' bis ')+')');
  ok(x.bilder[4].text.endsWith(R.geschichte_ende), n+'Bildergeschichte endet mit „'+R.geschichte_ende+'“');
  ok(ganz.includes('„'+x.oma+'“'), n+'Satz von Oma Mooswinkel steht wörtlich in der Bildergeschichte');
  ok(x.brief.includes(x.oma) && /Deine Oma Mooswinkel$/.test(x.brief), n+'Mini-Brief enthält Omas Satz und ist unterschrieben');
  ok(/Bommel/.test(x.bilder[4].text), n+'Letztes Bild nennt den neuen Bommel');
  ok(!/Und wie das ausging/.test(ganz), n+'Bildergeschichte verweist nicht zurück aufs Video');
  ok(/\bihr\b|\beuch\b|\beuren?\b/i.test(x.video+' '+ganz), n+'Bommi spricht die Kinder mit „ihr“ an');
  ok(x.aufbau.length===3, n+'Aufbau-Anleitung in drei Schritten');
  ok(x.bilder.every(b=>b.bild && b.bild.length>40), n+'Bildbeschreibung je Bild');
  for(const b of x.bilder) for(const s of (b.stimmen||[])){
    ok(FIGUREN.includes(s.figur) && s.figur!=='bommi', n+'Stimme „'+s.figur+'“ steht im Stimmen-Plan');
    ok(b.text.includes(s.satz), n+'Satz von '+s.figur+' steht so im Text');
  }
  const gesprochen=[x.video, ganz, x.brief].join(' ');
  for(const re of VERBOTEN) ok(!re.test(gesprochen), n+'kein '+re.source);
}
// Wiederkehrende Witze aus STRAT-42 kommen vor.
const alles=g.geschichten.map(x=>x.video+' '+x.bilder.map(b=>b.text).join(' ')).join(' ');
ok(/Gibt's was zu essen\?/.test(alles), 'Krümel fragt „Gibt\'s was zu essen?“');
ok(/was wollte ich sagen\?/.test(alles), 'Flitz vergisst mitten im Satz, was er sagen wollte');
ok(/Hrmpf/.test(alles), 'Brummel sagt „Hrmpf“');
ok(/Geradeheraus gesagt:/.test(alles), 'Tiri beginnt mit „Geradeheraus gesagt:“');
ok(/Bommel von meinem Schuh/.test(alles), 'Bommi verliert einen Schuh-Bommel');
// Schluss nennt keine Zahl, sondern „alle Bommel, die ihr gesammelt habt“.
ok(/allen Bommeln, die ihr gesammelt habt/.test(g.geschichten[7].bilder.map(b=>b.text).join(' ')), 'Nr. 8 sagt „alle Bommel, die ihr gesammelt habt“');
// Nachbesserungen aus der Abnahme (UNICORN-134, Strategist 21.11.)
ok(/Wichtelwerkstatt/.test(g.geschichten[0].bilder[0].text) && /Weihnachten/.test(g.geschichten[0].bilder[0].text), 'Nr. 1 nennt Wichtelwerkstatt und Weihnachten in Bild 1');
ok(/nicht zum Essen/.test(g.geschichten[2].aufbau.join(' ')), 'Nr. 3: Nüsse im Aufbau nur zum Suchen, nicht zum Essen');
const material=JSON.parse(fs.readFileSync(path.join(ORDNER,'material.json'),'utf8'));
ok(/Walnüsse/.test(material.kleinteile||'') && /Allergien/.test(material.kleinteile||''), 'Material: Kleinteile-Hinweis nennt Nüsse und Allergien');
ok(!/\bDa\b[^.!?]*[.!?]\s*Da\b/.test(g.geschichten[3].bilder[3].text), 'Nr. 4, Bild 4: kein doppeltes „Da“');
// Trailer
const t=g.trailer, sek=t.szenen.reduce((s,x)=>s+x.sekunden,0);
ok(sek>=20 && sek<=30, 'Trailer dauert '+sek+' Sekunden');
ok(t.szenen[0].spricht===R.video_anfang, 'Trailer beginnt mit „'+R.video_anfang+'“');
ok(/schatzweg\.de/.test(t.szenen[t.szenen.length-1].tafel||''), 'Trailer endet mit Texttafel und schatzweg.de');
ok(/statt 24 Tage Stress/.test(t.szenen[t.szenen.length-1].tafel||''), 'Trailer-Tafel nach STRAT-44 Nr. 45');
ok(t.szenen.some(x=>/zwei Minuten/.test(x.spricht||'') && /morgens/.test(x.spricht||'')), 'Trailer sagt: abends zwei Minuten aufbauen, morgens erzählt Bommi');
// Stimmen-Plan
ok(stimmen.figuren.bommi.proben.length>=2 && stimmen.figuren.bommi.proben.length<=3, 'Zwei bis drei Stimmproben für Bommi');
ok(['kruemel','flitz','brummel','tiri','fina'].every(f=>stimmen.figuren[f] && stimmen.figuren[f].voice_id), 'Jede Freundes-Figur hat eine Stimme');
// Figurenblatt
const fb=fs.readFileSync(path.join(ORDNER,'figurenblatt.md'),'utf8');
for(const f of ['Bommi','Krümel','Flitz','Brummel','Tiri','Fina','Oma Mooswinkel']) ok(new RegExp('## '+f).test(fb), 'Figurenblatt beschreibt '+f);
ok((fb.match(/Erkennungsmerkmale/g)||[]).length>=6, 'Drei Erkennungsmerkmale je Figur');

console.log(fehler?fehler+' FEHLER':'ALLES OK'); process.exit(fehler?1:0);
