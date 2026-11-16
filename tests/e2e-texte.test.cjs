// Aus der E2E-Prüfung vom 16.11.: Genitiv (UNICORN-117), Antwortfrist (96), Stationen zählen (83), Name-Satz (88),
// „iPad“ (107), Urkunde neutral (103), Entwickler-Teile (118), „Party gesichert“ im Startklar (104), Horn-Texte (111), Plan B (95)
const { chromium } = require('playwright');
const fs=require('fs'), path=require('path');
const S='http://localhost:8765';
let fehler=0; const ok=(b,t)=>{ console.log((b?'ok   ':'FEHL ')+t); if(!b) fehler++; };
(async()=>{
  const b=await chromium.launch(), c=await b.newContext({viewport:{width:393,height:852}});
  await c.addInitScript(()=>{ window.KONTO_TEST={url:'',key:''}; });
  await c.route(/^https?:\/\/(?!localhost)/, r=>r.abort());
  const p=await c.newPage(); const pf=[]; p.on('pageerror', e=>pf.push(e.message));
  await p.goto(S+'/app/');
  const party=(x)=>p.evaluate((x)=>{ localStorage.clear();
    const st=[0,1,2,3,4,5,6].map(i=>({lat:53.55+i*0.001, lng:10.0+i*0.001, name:'Ort '+i}));
    localStorage.setItem('sj.party.einhorn', JSON.stringify(Object.assign({format:1,thema:'einhorn',kind:{name:'Jonas',alter:5},datum:'2030-06-01',start:'15:00',kinder:6,helfer:2,vorausgeher:true,ort:'draussen',planB:true,ausdrucke:true,erledigt:{},einkauf:{}}, x||{})));
    localStorage.setItem('sj.plan.einhorn', JSON.stringify({format:1,thema:'einhorn',variante:'a',kinder:6,stationen:st,strecke:900})); }, x);

  // 117: eine Regel für den Genitiv
  const g=await p.evaluate(()=>['Jonas','Max','Fritz','Emma','Luiß'].map(Party.genitiv).join('|'));
  ok(g==='Jonas’|Max’|Fritz’|Emmas|Luiß’', 'Genitiv: '+g);
  // 96: Frist vorbei → keine Frist
  const fr=await p.evaluate(()=>{ const n=new Date(); const morgen=new Date(n.getTime()+864e5).toISOString().slice(0,10), weit=new Date(n.getTime()+20*864e5).toISOString().slice(0,10);
    return [Party.antwortBis({datum:morgen,start:'15:00'}), !!Party.antwortBis({datum:weit,start:'15:00'})]; });
  ok(fr[0]===null && fr[1]===true, 'Antwortfrist: vorbei → keine, in 20 Tagen → 7 Tage vorher');
  // 95: Hinweis für Gäste mit Plan B
  const h=await p.evaluate(()=>[Party.gaesteHinweis({ort:'draussen',planB:true}), Party.gaesteHinweis({ort:'draussen',planB:false})]);
  ok(/Bei Regen feiern wir drinnen/.test(h[0]) && /Matschhose/.test(h[1]), 'Gäste-Hinweis passt zu Plan B');

  // Einladung mit Namen auf s, Druck mit vorbeigegangener Frist
  await party({datum:new Date(Date.now()+3*864e5).toISOString().slice(0,10)});
  await p.goto(S+'/app/druck.html?thema=einhorn'); await p.waitForTimeout(800);
  const dr=await p.locator('body').innerText();
  ok(/Jonas’ 5\. Geburtstag/.test(dr) && !/Jonass/.test(dr), 'Druck: „Jonas’“, nie „Jonass“');
  ok(!/Bitte sagt bis/.test(dr) && /Bitte sagt kurz Bescheid/.test(dr), 'Druck: keine Frist in der Vergangenheit');
  ok(/<b>Funkel<\/b>das Einhorn/.test(await p.content()) && !/Hüter/.test(await p.content()), 'Urkunde: neutral „Funkel, das Einhorn“');
  await p.goto(S+'/app/vorausgeher.html?thema=einhorn'); await p.waitForTimeout(800);
  ok(/Jonas’ Party/.test(await p.locator('body').innerText()), 'Vorausgeher-Kopf: „Jonas’ Party“');

  // 104 + 107: Startklar ohne „iPad“, mit „Party gesichert“, wenn ein Konto möglich ist
  await party();
  await p.goto(S+'/app/bereit.html?thema=einhorn'); await p.waitForSelector('.check');
  const be=await p.locator('body').innerText();
  ok(!/iPad/.test(be) && /Apple:/.test(be), 'Startklar: „Apple“ statt „iPad“');
  ok(!/Party gesichert/.test(be), 'Startklar ohne Konto-Dienst: kein Punkt „Party gesichert“');
  const k=await b.newContext({viewport:{width:393,height:852}});
  await k.addInitScript(()=>{ window.KONTO_TEST={url:'https://test.supabase.co',key:'anon'}; });
  await k.route(/^https?:\/\/(?!localhost)/, r=>r.abort());
  const q=await k.newPage(); q.on('pageerror', e=>pf.push(e.message));
  await q.goto(S+'/app/'); await q.evaluate(()=>{ localStorage.setItem('sj.party.einhorn', JSON.stringify({format:1,thema:'einhorn',kind:{name:'Mia',alter:5},datum:'2030-06-01',start:'15:00',kinder:6,helfer:2,ort:'draussen',erledigt:{},einkauf:{}})); });
  await q.goto(S+'/app/bereit.html?thema=einhorn'); await q.waitForSelector('.check');
  ok(/Party gesichert/.test(await q.locator('#liste').innerText()) && await q.locator('#sichern').isVisible(), 'Startklar mit Konto-Dienst: „Party gesichert“ mit „Jetzt sichern“');
  await q.click('#sichern'); ok(await q.locator('dialog.konto-dlg #kd-mail').isVisible(), '„Jetzt sichern“ öffnet die Anmeldung');
  await q.evaluate(()=>localStorage.setItem('sj.konto', JSON.stringify({access_token:'a',refresh_token:'r',ablauf:Date.now()+3e6,email:'x@example.org'})));
  await q.reload(); await q.waitForSelector('.check');
  ok(/Party gesichert/.test(await q.locator('#liste').innerText()) && await q.locator('#sichern').count()===0, 'Angemeldet: „Party gesichert“ ist grün');

  // 118: Entwickler-Teile nur mit ?entwickler=1
  await party();
  await p.goto(S+'/app/spiel.html?thema=einhorn#einrichten'); await p.waitForTimeout(1000);
  ok(!(await p.locator('#k-stimme').isVisible()) && !(await p.locator('#btn-copy').isVisible()), 'Einrichten: „Funkels Stimme“ und „Punkte als Code“ ausgeblendet');
  await p.evaluate(()=>document.querySelectorAll('#view-setup details.karte').forEach(d=>d.open=true));
  ok(!/gedruckte Bild|GitHub|sechs Punkte|Punkte als Code/.test(await p.locator('#view-setup').innerText()), 'Einrichten: keine Entwicklungsreste im sichtbaren Text');
  await p.goto(S+'/app/spiel.html?thema=einhorn&entwickler=1#einrichten'); await p.waitForTimeout(800);
  ok(await p.locator('#k-stimme').isVisible(), 'Mit ?entwickler=1 wieder da');
  await p.goto(S+'/app/spiel.html?thema=einhorn&entwickler=0'); await p.waitForTimeout(500);

  // 83, 88: Texte
  const ph=fs.readFileSync(path.join(__dirname,'..','app/party.html'),'utf8');
  ok(!/Der Name bleibt auf diesem Gerät/.test(ph) && /Bis du die Party sicherst/.test(ph), 'Assistent: „Bis du die Party sicherst, bleibt alles auf diesem Gerät“');
  ok(/st\.length\+' Stationen'/.test(ph), 'Übergabekarte zählt alle 7 Stationen');
  // 111: Horn
  const t=JSON.parse(fs.readFileSync(path.join(__dirname,'..','app/themen/einhorn/tour.json'),'utf8'));
  ok(!/ob alle ein Horn tragen/.test(JSON.stringify(t.vorbereitung)) && /Nach der Einhorn-Prüfung bekommt jedes Kind sein Horn/.test(JSON.stringify(t)), 'Horn: nach der Prüfung bekommt jedes Kind sein Horn');
  // 117: kein „+'s “ mehr an Namen
  const quellen=['einladung.html','druck.html','vorausgeher.html','party.html','konto.js','index.html'].map(f=>fs.readFileSync(path.join(__dirname,'..','app',f),'utf8')).join('\n');
  ok(!/name\+'s /.test(quellen) && !/\+'s Namen/.test(quellen), 'Keine Stelle hängt einfach „s“ an den Namen');

  ok(!pf.length, 'Keine Seitenfehler'+(pf.length?': '+pf.join(' | '):''));
  await b.close(); process.exit(fehler?1:0);
})();
