// Kosten und Zeit von Anfang an sichtbar (UNICORN-72): „Das kommt auf dich zu“ im Assistenten, Schritt „Material besorgen“, gleiche Beträge überall.
const { chromium } = require('playwright');
const S='http://localhost:8765', B=S+'/app/';
let fehler=0; const ok=(b,t)=>{ console.log((b?'ok   ':'FEHL ')+t); if(!b) fehler++; };
const zahl=t=>{ const m=String(t).match(/(\d+),(\d\d)\s*€/); return m ? +(m[1]+'.'+m[2]) : null; };
(async()=>{
  const b=await chromium.launch(), c=await b.newContext({viewport:{width:393,height:852}});
  await c.addInitScript(()=>{ window.KONTO_TEST={url:'',key:''}; });
  await c.route(/^https?:\/\/(?!localhost)/, r=>r.abort());
  const p=await c.newPage(); const pf=[]; p.on('pageerror', e=>pf.push(e.message));
  await p.goto(B);
  const st=[0,1,2,3,4,5,6].map(i=>({lat:53.55+i*0.001, lng:10.0+i*0.001, name:'Ort '+i}));
  const plan={format:1,thema:'einhorn',variante:'a',kinder:8,stationen:st,strecke:1400,heimweg:350};
  const inTagen=n=>new Date(Date.now()+n*864e5).toISOString().slice(0,10);
  const entwurf=(d,vg)=>({format:1,thema:'einhorn',kind:{name:'Mia',alter:5},datum:d,start:'15:00',kinder:8,helfer:2,vorausgeher:vg,ort:'draussen',planB:true,ausdrucke:true,erledigt:{},einkauf:{},erstellt:new Date().toISOString()});
  const zumEnde=async(e)=>{ await p.evaluate(([e,pl])=>{ localStorage.clear(); localStorage.setItem('sj.plan.einhorn', JSON.stringify(pl)); sessionStorage.setItem('sj.entwurf.einhorn', JSON.stringify({e:e, s:3})); }, [e,plan]);
    await p.goto('about:blank'); await p.goto(B+'party.html?thema=einhorn#schritt-4'); await p.waitForSelector('.aufwand'); return p.locator('.aufwand').innerText(); };

  const a=await p.evaluate(async([pl])=>{ const t=await (await fetch('themen/einhorn/tour.json')).json(); return Party.aufwand({kinder:8,ort:'draussen',vorausgeher:true,einkauf:{},thema:'einhorn'}, t, pl); }, [plan]);
  ok(a.alles>a.noetig && a.noetig>0, 'Aufwand: alles > nur das Nötige > 0');
  ok(a.tourMin===35+40 && a.heimMin===10, 'Dauer aus dem Plan: 35 Min. Stationen + 40 Min. Weg, 10 Min. Heimweg');
  ok(a.bastelNoetig<=a.bastelAlle, 'Bastelminuten: nötig bis alles');
  ok(a.mitgebsel>60 && a.mitgebsel<a.alles, 'Mitgebsel (je Kind) als Teil von allem ('+a.mitgebsel.toFixed(2)+' €)');

  let t=await zumEnde(entwurf(inTagen(20), true));
  ok(/Das kommt auf dich zu/.test(t) && /0 € mit Dingen von zu Hause/.test(t), 'Assistent: „Das kommt auf dich zu“ mit 0 € von zu Hause');
  ok(/davon ca\. [\d,]+ € Mitgebsel, die die Kinder behalten/.test(t), 'Assistent: Mitgebsel als Info (Entscheidung B)');
  ok(/Generalprobe ca\. 75 Min/.test(t) && /Tour dauert ca\. 75 Min\. plus 10 Min\. Heimweg/.test(t) && /Eine Stunde vorher/.test(t), 'Assistent: Generalprobe, Dauer und Heimweg aus dem Plan');
  ok(/Dein Plan: 6 Schritte in 3 Wochen/.test(await p.locator('#seite').innerText()), 'Plan-Zeitraum aus dem Datum (20 Tage → 3 Wochen)');

  t=await zumEnde(entwurf(inTagen(2), false));
  ok(/Eineinhalb Stunden vorher/.test(t), 'Ohne Vorausgeher: eineinhalb Stunden vorher');
  ok(/in 2 Tagen/.test(await p.locator('#seite').innerText()) && /Bestellen wird knapp/.test(await p.locator('#seite').innerText()), 'Kurz vor der Party: „Bestellen wird knapp“');

  // Gleiche Beträge im Assistenten und im Schritt „Material besorgen“
  t=await zumEnde(entwurf(inTagen(20), true));
  const m=t.match(/ca\. ([\d.,]+ €) für das Nötige, ca\. ([\d.,]+ €) für alles/);
  await p.evaluate(e=>{ localStorage.setItem('sj.party.einhorn', JSON.stringify(e)); sessionStorage.clear(); }, entwurf(inTagen(20), true));
  await p.goto('about:blank'); await p.goto(B+'party.html?thema=einhorn#s-bestellen'); await p.waitForSelector('.wege');
  const w=await p.locator('.wege').innerText();
  ok(m && w.includes(m[1]) && w.includes(m[2]), 'Assistent und „Material besorgen“ nennen dieselben Beträge'+(m?' ('+m[1]+', '+m[2]+')':''));
  ok(/Material besorgen/.test(await p.locator('#seite').innerText()), 'Schritt heißt „Material besorgen“');

  ok(!pf.length, 'Keine Seitenfehler'+(pf.length?': '+pf.join(' | '):''));
  await b.close(); console.log(fehler?fehler+' FEHLER':'ALLES OK'); process.exit(fehler?1:0);
})();
