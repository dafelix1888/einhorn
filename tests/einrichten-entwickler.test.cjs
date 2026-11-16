// UNICORN-118: „Einrichten“ ohne Entwicklungsreste. „Funkels Stimme“ und „Punkte als Code“ nur mit ?entwickler=1, Texte ohne „gedrucktes Bild“
const { chromium } = require('playwright');
const B=process.env.BASIS||'http://localhost:8765/app/';
let fehler=0; const ok=(b,t)=>{ console.log((b?'ok   ':'FEHL ')+t); if(!b) fehler++; };
(async()=>{
  const b=await chromium.launch(), c=await b.newContext({viewport:{width:393,height:852}});
  await c.addInitScript(()=>{ window.KONTO_TEST={url:'',key:''}; });
  await c.route(/^https?:\/\/(?!localhost)/, r=>r.abort());
  const p=await c.newPage(); const pf=[]; p.on('pageerror', e=>pf.push(e.message));

  await p.goto(B+'spiel.html?thema=einhorn#einrichten'); await p.evaluate(()=>localStorage.clear()); await p.reload();
  await p.waitForSelector('#k-punkte', {state:'attached'}); await p.waitForTimeout(300);
  await p.evaluate(()=>document.querySelectorAll('#view-setup details.karte').forEach(d=>d.open=true));
  ok(await p.locator('#k-stimme').isHidden(), 'Ohne Schalter: „Funkels Stimme“ ist nicht zu sehen');
  ok(await p.locator('#punkte-code').isHidden() && await p.locator('#k-punkte').isVisible(), 'Ohne Schalter: GPS-Punkte da, „Punkte als Code“ nicht');
  const text=await p.locator('#view-setup').innerText();
  ok(!/GitHub|gedruckt|sechs Punkte|funkel-stimme\.json|am Pop/.test(text), 'Einrichten nennt kein GitHub, gedrucktes Bild, „sechs Punkte“, „Pop“');
  ok(/Löscht alle GPS-Punkte/.test(text), 'Löschen-Text: „alle GPS-Punkte“');

  await p.goto(B+'spiel.html?thema=einhorn&entwickler=1#einrichten'); await p.waitForSelector('#k-punkte', {state:'attached'}); await p.waitForTimeout(300);
  await p.evaluate(()=>document.querySelectorAll('#view-setup details.karte').forEach(d=>d.open=true));
  ok(await p.locator('#k-stimme').isVisible() && await p.locator('#punkte-code').isVisible(), 'Mit ?entwickler=1: beides sichtbar');
  await p.goto(B+'spiel.html?thema=einhorn#einrichten'); await p.waitForSelector('#k-punkte', {state:'attached'}); await p.waitForTimeout(300);
  ok(await p.locator('#k-stimme').isVisible(), 'Gerät merkt sich den Schalter');
  await p.goto(B+'spiel.html?thema=einhorn&entwickler=0#einrichten'); await p.waitForSelector('#k-punkte', {state:'attached'}); await p.waitForTimeout(300);
  ok(await p.locator('#k-stimme').isHidden(), '?entwickler=0 schaltet wieder ab');

  // Hinweis der Zauberlinse nennt die echte Farbe statt eines gedruckten Bilds
  const src=require('fs').readFileSync(require('path').join(__dirname,'..','app','spiel.html'),'utf8');
  ok(!/gedruckte/.test(src), 'spiel.html enthält kein „gedruckte(s) Bild“ mehr');
  ok(/LINSE_WORT=\{blau:'etwas Blaues'/.test(src), 'Linsen-Hinweis: „Haltet den Spiegel vor etwas Blaues“');

  ok(pf.length===0, 'Keine Seitenfehler '+pf.join(' | '));
  await b.close(); process.exit(fehler?1:0);
})();
