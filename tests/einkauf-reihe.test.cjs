// Einkauf: Artikel nacheinander in den Amazon-Warenkorb (UNICORN-11, statt Sammel-Link)
const { chromium } = require('playwright');
const S='http://localhost:8765';
let fehler=0; const ok=(b,t)=>{ console.log((b?'ok   ':'FEHL ')+t); if(!b) fehler++; };
(async()=>{
  const b=await chromium.launch(), c=await b.newContext({viewport:{width:393,height:852}});
  await c.addInitScript(()=>{ window.KONTO_TEST={url:'',key:''}; });
  await c.route(/^https?:\/\/(?!localhost)/, r=>/amazon\.de/.test(r.request().url()) ? r.fulfill({status:200, contentType:'text/html', body:'<title>Amazon</title>'}) : r.abort());
  const p=await c.newPage(); const fehlerSeite=[]; p.on('pageerror', e=>fehlerSeite.push(e.message));
  await p.goto(S+'/app/');
  const d=new Date(Date.now()+12*864e5).toISOString().slice(0,10);
  await p.evaluate(d=>{ localStorage.clear(); localStorage.setItem('sj.party.einhorn', JSON.stringify({format:1,thema:'einhorn',kind:{name:'Emma',alter:5},datum:d,start:'15:00',kinder:14,helfer:2,vorausgeher:true,ort:'draussen'})); }, d);
  await p.goto(S+'/app/party.html?thema=einhorn#einkauf'); await p.waitForSelector('#in-korb');
  const n=+(await p.locator('#in-korb').innerText()).match(/\d+/)[0];
  ok(n>=10 && /nacheinander in den Warenkorb/.test(await p.locator('#in-korb').innerText()), 'Knopf „'+n+' Artikel nacheinander in den Warenkorb“');
  ok(!(await p.content()).includes('gp/aws/cart'), 'Kein Sammel-Link mehr (Amazon fügt darüber oft nichts hinzu)');
  await p.click('#in-korb');
  let karte=await p.locator('.korb-reihe').innerText();
  ok(/Artikel 1 von /.test(karte) && /Geschenktüten/.test(karte) && /2 Packungen/.test(karte) && /Menge auf 2/.test(karte), 'Schritt 1: Geschenktüten, 2 Packungen für 14 Kinder, Hinweis zur Menge');
  ok(/amazon\.de\/dp\/B0GVMKLS6L/.test(await p.locator('#korb-weiter').getAttribute('href')) && await p.locator('#korb-weiter').getAttribute('target')==='_blank', '„Bei Amazon öffnen“ zeigt die Produktseite in neuem Tab');
  const [neu]=await Promise.all([c.waitForEvent('page'), p.click('#korb-weiter')]); await neu.close(); await p.waitForTimeout(600);
  karte=await p.locator('.korb-reihe').innerText();
  ok(/Artikel 2 von /.test(karte) && /Haarreif/.test(karte), 'Zurück in der App: Artikel 2 (Haarreif)');
  await p.click('#korb-ueberspringen'); karte=await p.locator('.korb-reihe').innerText();
  ok(/Artikel 3 von /.test(karte), 'Überspringen geht zum nächsten Artikel');
  await p.reload(); await p.waitForSelector('.korb-reihe');
  ok(/Artikel 3 von /.test(await p.locator('.korb-reihe').innerText()), 'Stand bleibt nach Neuladen erhalten');
  for(let i=0;i<n;i++){ if(!(await p.locator('#korb-weiter').count())) break; const [t]=await Promise.all([c.waitForEvent('page'), p.click('#korb-weiter')]); await t.close(); await p.waitForTimeout(450); }
  const fertig=await p.locator('#korb-ja').count() ? await p.locator('.karte:has(#korb-ja)').innerText() : '';
  ok(/sind im Warenkorb\. Bei Amazon bestellt\?/.test(fertig) && /Zum Einkaufswagen/.test(fertig) && new RegExp('^'+(n-1)+' Artikel').test(fertig), 'Am Ende: „'+(n-1)+' Artikel sind im Warenkorb. Bei Amazon bestellt?“ (einer übersprungen)');
  await p.click('#korb-ja'); await p.waitForTimeout(300);
  const st=await p.evaluate(()=>{ const pa=Party.lesen('einhorn'); return {haken:Object.keys(pa.einkauf||{}).length, reihe:pa.korbReihe||null}; });
  ok(st.haken===n-1 && !st.reihe, 'Ja, abhaken: '+(n-1)+' Artikel unter „Schon da oder bestellt“, übersprungener bleibt offen');
  ok(await p.locator('#in-korb').count()===1 && /1 Artikel nacheinander/.test(await p.locator('#in-korb').innerText()), 'Der übersprungene Artikel bleibt zum Bestellen');
  await p.click('#in-korb'); await p.click('#korb-stopp');
  ok(!(await p.locator('.korb-reihe').count()) && await p.locator('#in-korb').count()===1, 'Abbrechen beendet die Reihe');
  ok(!fehlerSeite.length, 'Keine Seitenfehler'+(fehlerSeite.length?': '+fehlerSeite.join(' | '):''));
  await b.close(); console.log(fehler?fehler+' FEHLER':'ALLES OK'); process.exit(fehler?1:0);
})();
