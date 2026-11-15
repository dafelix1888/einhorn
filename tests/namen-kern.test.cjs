// Namens-Sätze: Kern für App und Edge Function (UNICORN-49/50/51/52, ADR-28). Läuft ohne Browser.
const fs=require('fs'), path=require('path');
let fehler=0; const ok=(b,t)=>{ console.log((b?'ok   ':'FEHL ')+t); if(!b) fehler++; };
const wurzel=path.join(__dirname,'..');
require(path.join(wurzel,'app/namen-kern.js'));
const K=globalThis.NamenKern;
const tour=JSON.parse(fs.readFileSync(path.join(wurzel,'app/themen/einhorn/tour.json'),'utf8')), V=tour.namenSaetze;
const STIMME={voice_id:'v', modell:'m', einstellungen:{a:1}, vorweg:'<p> '};

(async()=>{
  ok(fs.readFileSync(path.join(wurzel,'app/namen-kern.js'),'utf8')===fs.readFileSync(path.join(wurzel,'server/functions/namen/namen-kern.js'),'utf8'), 'Kopie für die Edge Function ist gleich');

  // Vorlagen (UNICORN-50)
  ok(K.vorlagenOk(V), 'tour.json: namenSaetze gültig');
  ok(V.stellen.map(s=>s.id).join()==='gruss,schatz,abschied', 'Drei Stellen: gruss, schatz, abschied');
  ok(V.stellen.every(s=>s.varianten.length>=2 && s.varianten.length<=3), 'Je Stelle 2–3 Varianten');
  ok(V.stellen.every(s=>s.varianten.every(t=>!/\{alter\}|Jahre|wirst du/.test(t))), 'Namens-Sätze ohne Alter');
  ok(V.stellen.every(s=>s.varianten.every(t=>!/\b(Held|Heldin|Helfer|Helferin|Junge|Mädchen|lieber|liebe)\b/.test(t))), 'Namens-Sätze neutral (kein Geschlecht)');
  ok(V.alter && V.alter.varianten.every(t=>t.includes('{alter}') && !t.includes('{name}')), 'Eigener Alters-Satz ohne Namen');
  ok(!K.vorlagenOk({stellen:[{id:'gruss',varianten:['Hallo!']}]}), 'Vorlage ohne {name} wird abgelehnt');

  // Zahlwort, jedes Alter (UNICORN-52)
  const z={1:'eins',2:'zwei',6:'sechs',12:'zwölf',13:'dreizehn',21:'einundzwanzig',30:'dreißig',47:'siebenundvierzig',99:'neunundneunzig',100:'einhundert',101:'einhunderteins',117:'einhundertsiebzehn'};
  ok(Object.entries(z).every(([n,w])=>K.zahlwort(+n)===w), 'Zahlwörter 1 bis 117');
  ok(K.zahlwort(2000)==='2000', 'Sehr große Zahl bleibt Ziffer');
  const b6=K.bilden(V,{name:'Leo',alter:6}), b40=K.bilden(V,{name:'Leo',alter:40});
  ok(/wirst du 6!/.test(b6.alter.zeigen) && /wirst du sechs!/.test(b6.alter.sprechen), 'Alters-Satz: Ziffer angezeigt, Wort gesprochen');
  ok(/vierzig/.test(b40.alter.sprechen), 'Alter 40 geht');
  ok(!K.bilden(V,{name:'Leo'}).alter, 'Ohne Alter kein Alters-Satz');
  ok(b6.gruss.sprechen===b40.gruss.sprechen && b6.schatz.sprechen===b40.schatz.sprechen, 'Namens-Sätze hängen nicht am Alter');

  // Angezeigt vs. gesprochen
  const ba=K.bilden(V,{name:'Mia',aussprache:'Mija'});
  ok(ba.gruss.zeigen.includes('Mia') && !ba.gruss.zeigen.includes('Mija') && ba.gruss.sprechen.includes('Mija'), 'Angezeigt der Name, gesprochen die Aussprache');
  const w=K.naechsteWahl(V,{gruss:2}); ok(w.gruss===0 && w.schatz===1, 'Andere Worte: nächste Variante, am Ende wieder die erste');

  // Schlüssel (ADR-28)
  const s1=await K.schluessel(STIMME,b6.gruss.sprechen), s2=await K.schluessel(STIMME,b40.gruss.sprechen), s3=await K.schluessel(STIMME,K.bilden(V,{name:'Lea'}).gruss.sprechen);
  ok(/^[0-9a-f]{40}$/.test(s1) && s1===s2 && s1!==s3, 'Schlüssel: gleich für gleichen Text, anders für anderen Namen');
  ok(s1!==await K.schluessel({...STIMME, voice_id:'x'}, b6.gruss.sprechen), 'Andere Stimme = anderer Schlüssel');

  // Eingabe prüfen (UNICORN-51)
  ok(['Leo','Marie-Luise','Zoë','Ole Jan',"D'Angelo",'Nazim','Killian','Alexander','Charlotte'].every(n=>K.pruefeName(n)===''), 'Echte Namen gehen durch');
  ok(['','Leo3','<b>','x'.repeat(21),'Arschgesicht','Nazi','Kacke'].every(n=>K.pruefeName(n)!==''), 'Leer, Ziffern, Zeichen, zu lang, Beleidigungen abgelehnt');

  // Aufnahme wählen, höchstens 3 je Text
  ok(JSON.stringify(K.aufnahmeWaehlen([],null,false))==='{"aufnahme":1,"neu":true}', 'Leerer Speicher: neue Aufnahme 1');
  ok(JSON.stringify(K.aufnahmeWaehlen([{aufnahme:1,wert:-1},{aufnahme:2,wert:3}],null,false))==='{"aufnahme":2,"neu":false}', 'Treffer: beste Aufnahme zuerst');
  ok(K.aufnahmeWaehlen([{aufnahme:1,wert:0}],1,true).neu && K.aufnahmeWaehlen([{aufnahme:1,wert:0}],1,true).aufnahme===2, 'Andere Betonung: neue Aufnahme 2');
  const drei=[{aufnahme:1,wert:0},{aufnahme:2,wert:0},{aufnahme:3,wert:0}];
  ok(!K.aufnahmeWaehlen(drei,3,true).neu && K.aufnahmeWaehlen(drei,3,true).aufnahme===1, 'Drei Aufnahmen da: reihum, nichts Neues');

  // Zählen: erstes frei, danach 3
  ok(K.uebrig(0)===3 && K.uebrig(1)===3 && K.uebrig(2)===2 && K.uebrig(4)===0, 'Erstes Einsprechen frei, danach 3-mal');

  // Durchspielen wie die Edge Function: zweite Familie mit „Leo“ kostet nichts
  const speicher={}; let anElevenLabs=0;
  async function party(name, alter, alt, art){
    const wahl=art==='worte' ? K.naechsteWahl(V,alt?alt.wahl:{}) : (alt?alt.wahl:{}), b=K.bilden(V,{name,alter,wahl}), r={wahl:{}};
    for(const [k,s] of Object.entries(b)){
      const sl=await K.schluessel(STIMME,s.sprechen), akt=alt&&alt[k]&&alt[k].s===sl?alt[k].a:null;
      const x=K.aufnahmeWaehlen(speicher[sl]||[], akt, art==='betonung'&&k!=='alter');
      if(x.neu){ anElevenLabs++; (speicher[sl]=speicher[sl]||[]).push({aufnahme:x.aufnahme,wert:0}); }
      r[k]={s:sl,a:x.aufnahme}; r.wahl[k]=s.variante;
    }
    return r;
  }
  const p1=await party('Leo',5); const nach1=anElevenLabs;
  ok(nach1===4, 'Familie 1 (Leo, 5): 4 Sätze neu erzeugt');
  await party('Leo',5); ok(anElevenLabs===nach1, 'Familie 2 (Leo, 5): kein ElevenLabs-Aufruf');
  await party('Leo',7); ok(anElevenLabs===nach1+1, 'Familie 3 (Leo, 7): nur der Alters-Satz neu');
  let a=p1; for(let i=0;i<5;i++) a=await party('Leo',5,a,'betonung');
  ok(Object.values(speicher).every(l=>l.length<=3), 'Andere Betonung oft gedrückt: nie mehr als 3 Aufnahmen je Text');

  console.log(fehler?fehler+' Fehler':'Alles grün'); process.exit(fehler?1:0);
})();
