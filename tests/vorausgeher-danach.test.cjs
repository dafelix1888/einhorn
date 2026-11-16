// Vorausgeher (UNICORN-70): Nach dem Aufbau zurück zur Gruppe und mitlaufen, mit Überblick, was die Kinder suchen
const { chromium } = require('playwright');
const S='http://localhost:8765';
let fehler=0; const ok=(b,t)=>{ console.log((b?'ok   ':'FEHL ')+t); if(!b) fehler++; };
(async()=>{
  const b=await chromium.launch(), c=await b.newContext({viewport:{width:393,height:852}});
  await c.addInitScript(()=>{ window.KONTO_TEST={url:'',key:''}; });
  await c.route(/^https?:\/\/(?!localhost)/, r=>r.abort());
  const p=await c.newPage(); const pf=[]; p.on('pageerror', e=>pf.push(e.message));
  await p.goto(S+'/app/');
  await p.evaluate(()=>{ localStorage.clear();
    const st=[0,1,2,3,4,5,6].map(i=>({lat:53.55+i*0.001, lng:10.0+i*0.001, name:'Ort '+i}));
    localStorage.setItem('sj.party.einhorn', JSON.stringify({format:1,thema:'einhorn',kind:{name:'Mia',alter:5},datum:'2030-06-01',start:'15:00',kinder:6,helfer:2,vorausgeher:true,ort:'draussen',planB:true,ausdrucke:true,erledigt:{},einkauf:{},aufgebaut:{1:true,2:true,3:true,4:true,5:true,6:true}}));
    localStorage.setItem('sj.plan.einhorn', JSON.stringify({format:1,thema:'einhorn',variante:'a',kinder:6,stationen:st,strecke:900})); });
  await p.goto(S+'/app/vorausgeher.html?thema=einhorn'); await p.waitForSelector('.fertig-karte');
  const t=await p.locator('#fokus').innerText();
  ok(/Alles aufgebaut/.test(t) && /zurück zur Gruppe/.test(t), 'Nach dem Aufbau: zurück zur Gruppe');
  ok(!/versteck dich/.test(t) && !/Bank/.test(t), 'Kein „Warte an der Bank und versteck dich“ mehr');
  ok(/Geh der Gruppe entgegen/.test(t) && /Lauf hinten mit/.test(t) && /Beim Schatz/.test(t), 'Drei klare Schritte');
  ok(/Die Gruppe startet um 15:00 Uhr/.test(t), 'Zeigt, wann die Gruppe startet');
  ok(await p.locator('.danach .such li').count()>=5 && /Rote Bögen|rote/i.test(await p.locator('.danach .such').innerText()), 'Liste: was die Kinder je Station suchen');
  ok(/destination=53\.55,10/.test(await p.locator('.danach a.knopf').getAttribute('href')||''), 'Weg zurück zum Start mit Karte');
  // Schatzkiste: eine Regel (UNICORN-74) – an Station 7 nicht hinlegen, sondern in der Tasche lassen
  ok(/Schatzkiste stellst du hin, während die Kinder kleben/.test(t), 'Beim Schatz: Kiste wird beim Kleben hingestellt');
  await p.evaluate(()=>{ const x=JSON.parse(localStorage.getItem('sj.party.einhorn')); x.aufgebaut={1:true,2:true,3:true,4:true,5:true}; localStorage.setItem('sj.party.einhorn', JSON.stringify(x)); });
  await p.reload(); await p.waitForSelector('.fokus');
  const h7=await p.locator('.hinlegen').innerText();
  ok(!/Schatzkiste/.test(h7.split('Nicht hinlegen')[0]) && /Nicht hinlegen:\s*Schatzkiste/.test(h7), 'Station 7: Schatzkiste nicht unter „Hier hinlegen“, sondern „Nicht hinlegen“');
  ok(!/Ort 6 · |Parkbank|Oben am Berg/.test(await p.locator('.fokus').innerText()), 'Station 7: nur der geplante Ort, keine feste Ortszeile (UNICORN-78)');
  ok(!pf.length, 'Keine Seitenfehler'+(pf.length?': '+pf.join(' | '):''));
  await b.close(); console.log(fehler?fehler+' FEHLER':'ALLES OK'); process.exit(fehler?1:0);
})();
