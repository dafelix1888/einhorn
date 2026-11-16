// Genitiv bei Namen (UNICORN-117): „Jonas’ Einhorn-Party“, nie „Jonass“ oder „Maxs“, an allen Stellen.
const { chromium } = require('playwright');
const fs=require('fs'), path=require('path');
const B=(process.env.BASIS||'http://localhost:8765')+'/app/';
let fehler=0; const ok=(c,t)=>{ console.log((c?'ok   ':'FEHLER ')+t); if(!c) fehler++; };
const lies=n=>fs.readFileSync(path.join(__dirname,'..','app',n),'utf8');
const PARTY=n=>({format:1,thema:'einhorn',kind:{name:n,alter:5},datum:'2030-06-01',start:'15:00',kinder:6,helfer:2,vorausgeher:true,ort:'draussen',planB:true,erledigt:{},einkauf:{}});

(async()=>{
  // Keine Stelle hängt mehr selbst ein „s“ an den Namen
  ['druck.html','einladung.html','vorausgeher.html','party.html','index.html','party.js','danke.html','bereit.html'].forEach(f=>{
    ok(!/name\)?\+'s[ ']/.test(lies(f)), f+': Genitiv nur über Party.genitiv');
  });
  const b=await chromium.launch(), p=await b.newPage({viewport:{width:420,height:900}});
  const fehlerSeite=[]; p.on('pageerror',e=>fehlerSeite.push(e.message));
  await p.goto(B+'party.html?thema=einhorn'); await p.waitForFunction(()=>window.Party);
  const g=await p.evaluate(()=>['Jonas','Max','Fritz','Mia','Paul','Grete',' Lars '].map(Party.genitiv));
  ok(g.join('|')==='Jonas’|Max’|Fritz’|Mias|Pauls|Gretes|Lars’', 'Party.genitiv: '+g.join(', '));

  for(const [name,soll] of [['Jonas','Jonas’'],['Max','Max’'],['Mia','Mias']]){
    await p.evaluate(x=>localStorage.setItem('sj.party.einhorn', JSON.stringify(x)), PARTY(name));
    const ics=await p.evaluate(async()=>{ const T=await (await fetch('themen/einhorn/tour.json')).json(); return Party.ics(JSON.parse(localStorage.getItem('sj.party.einhorn')), T, {}); });
    ok(ics.includes('SUMMARY:'+soll+' Einhorn-Party') && !/Jonass|Maxs/.test(ics), name+': Kalender der Eltern');
    const daten=await p.evaluate(()=>location.href.replace(/party\.html.*/,'')+'einladung.html?e='+Party.code(Party.einladungsDaten(JSON.parse(localStorage.getItem('sj.party.einhorn')), {})));
    await p.goto(daten); await p.waitForTimeout(400);
    const antwort=await p.evaluate(()=>document.body.innerText+' '+[...document.querySelectorAll('a[href]')].map(a=>{ try{ return decodeURIComponent(a.href); }catch(e){ return a.href; } }).join(' '));
    ok(!/Jonass|Maxs/.test(antwort), name+': Einladung und Antwort der Gäste ohne falschen Genitiv');
    await p.goto(B+'vorausgeher.html?thema=einhorn'); await p.waitForTimeout(600);
    const kopf=await p.locator('body').innerText();
    ok(!/Jonass|Maxs/.test(kopf), name+': Aufbau-Seite');
    await p.goto(B+'party.html?thema=einhorn'); await p.waitForTimeout(600);
    const seite=await p.locator('body').innerText();
    ok(!/Jonass|Maxs/.test(seite), name+': Party-Seite');
  }
  ok(!fehlerSeite.length, 'Keine Fehler auf den Seiten'+(fehlerSeite.length?': '+fehlerSeite[0]:''));
  await b.close();
  console.log(fehler?fehler+' FEHLER':'ALLES OK'); process.exit(fehler?1:0);
})();
