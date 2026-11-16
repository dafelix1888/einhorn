// Vorbereitung nach Station (UNICORN-67): eine abhakbare Liste, Nötiges mit Notlösung, Extras markiert, Zähler nur für Nötiges
const { chromium } = require('playwright');
const S='http://localhost:8765';
let fehler=0; const ok=(b,t)=>{ console.log((b?'ok   ':'FEHL ')+t); if(!b) fehler++; };
(async()=>{
  const b=await chromium.launch(), c=await b.newContext({viewport:{width:393,height:852}});
  await c.addInitScript(()=>{ window.KONTO_TEST={url:'',key:''}; });
  await c.route(/^https?:\/\/(?!localhost)/, r=>r.abort());
  const p=await c.newPage(); const pf=[]; p.on('pageerror', e=>pf.push(e.message));
  await p.goto(S+'/app/'); await p.evaluate(()=>localStorage.clear());
  await p.goto(S+'/app/spiel.html?thema=einhorn#einrichten'); await p.waitForSelector('#liste .haken', {state:'attached'});
  await p.evaluate(()=>{ document.getElementById('k-vorbereitung').open=true; document.getElementById('k-vorbereitung').scrollIntoView(); }); await p.waitForTimeout(200);

  // --- Ansicht „Besorgen“ (UNICORN-69): dieselbe Einkaufsliste wie in der Party ---
  ok(await p.locator('[data-vb="besorgen"][aria-pressed="true"]').count()===1, 'Startet mit „Besorgen“');
  const bes=await p.locator('#liste').innerText();
  ok(/Braucht die Tour/.test(bes) && /Ohne Einkauf/.test(bes) && /Extras, die es schöner machen/.test(bes), 'Gruppen wie in der Party: Braucht die Tour, Ohne Einkauf, Extras');
  const hr=await p.locator('#liste .haken:has-text("Haarreif mit Einhorn-Horn")').innerText();
  ok(/[0-9]+×/.test(hr) && /Station 1: Funkel prüft/.test(hr) && /Packung/.test(hr) && /Sonst: Papierhörner/.test(hr), 'Haarreif: Menge, wofür, Packungen und Preis, Notlösung');
  await p.locator('#liste [data-ek="u0"]').check({force:true}); await p.waitForTimeout(150);
  ok(/1 von [0-9]+ nötigen besorgt/.test(await p.locator('#liste-note').innerText()), 'Besorgt zählt');
  await p.click('[data-vb="packen"]'); await p.waitForTimeout(150);
  ok(await p.locator('#liste .haken input:checked').count()===0, '„Besorgt“ hakt nichts beim Packen ab');
  await p.click('[data-vb="besorgen"]'); await p.locator('#liste [data-ek="u0"]').uncheck({force:true}); await p.click('[data-vb="packen"]'); await p.waitForTimeout(150);

  // Gleiche Zahlen wie die Party: mit Party auf diesem Gerät, Haken landen in der Party
  const d=new Date(Date.now()+10*864e5).toISOString().slice(0,10);
  const c2=await b.newContext({viewport:{width:393,height:852}}); await c2.addInitScript(()=>{ window.KONTO_TEST={url:'',key:''}; }); await c2.route(/^https?:\/\/(?!localhost)/, r=>r.abort());
  const q=await c2.newPage();
  await q.goto(S+'/app/'); await q.evaluate((d)=>{ localStorage.clear(); localStorage.setItem('sj.party.einhorn', JSON.stringify({format:1,thema:'einhorn',kind:{name:'Mia',alter:5},datum:d,start:'15:00',kinder:10,helfer:2,vorausgeher:true,ort:'draussen',planB:true,ausdrucke:true,erledigt:{},einkauf:{},einkaufWie:{}})); }, d);
  await q.goto(S+'/app/party.html?thema=einhorn#s-bestellen'); await q.waitForSelector('.wege');
  const wege=await q.locator('.wege').innerText();
  await q.goto(S+'/app/spiel.html?thema=einhorn#einrichten'); await q.waitForSelector('#liste .vb-summen', {state:'attached'}); await q.evaluate(()=>{ document.getElementById('k-vorbereitung').open=true; }); await q.waitForTimeout(150);
  const sum=await q.locator('#liste .vb-summen').innerText();
  const zahl=(t,w)=>(t.match(new RegExp(w+'[^0-9]*([0-9.]+,[0-9]{2})'))||[])[1];
  ok(zahl(wege,'Alles bestellen') && zahl(wege,'Alles bestellen')===zahl(sum,'Alles bestellen') && zahl(wege,'Nur das Nötige')===zahl(sum,'Nur das Nötige'), 'Gleiche Summen wie in der Party ('+zahl(sum,'Alles bestellen')+' € / '+zahl(sum,'Nur das Nötige')+' €)');
  await q.locator('#liste [data-ek="u0"]').check({force:true}); await q.waitForTimeout(150);
  ok((await q.evaluate(()=>JSON.parse(localStorage.getItem('sj.party.einhorn')).einkauf.u0))===true, 'Haken im Spiel = „erledigt“ in der Party');
  await c2.close();

  const gruppen=await p.locator('#liste .vb-gruppe').count();
  ok(gruppen===9, 'Gegliedert: Vorher, 7 Stationen, Mitnehmen ('+gruppen+' Abschnitte)');
  ok(await p.locator('#liste .vb-gruppe .pk-nr').count()===7, 'Jede Station mit farbiger Nummer');
  const st1=await p.locator('#liste .vb-gruppe').nth(1).innerText();
  ok(/Haustür/.test(st1) && /Gruppe/.test(st1) && /Haarreifen/.test(st1) && /Sonst: Papierhörner/.test(st1), 'Station 1: Ort, wer, Haarreifen mit Notlösung');
  const noetig=await p.locator('#liste .haken:not(.extra)').count(), extra=await p.locator('#liste .vb-gruppe .haken.extra').count();
  ok(noetig>=15 && extra>=4, 'Nötiges und Extras getrennt erkennbar ('+noetig+' nötig, '+extra+' Extras)');
  ok(await p.locator('#liste .haken:not(.extra) .notfalls').count()===noetig, 'Jedes nötige Ding hat „Sonst: …“');
  ok(await p.locator('#liste .haken.extra .tag-extra').count()===extra, 'Jedes Extra trägt das Zeichen „Extra“');
  ok(new RegExp('0/'+noetig).test(await p.locator('[data-vb="packen"]').innerText()), 'Umschalter zeigt den Stand beim Packen');
  ok(new RegExp('0 von '+noetig+' nötigen gepackt').test(await p.locator('#liste-note').innerText()), 'Zähler zählt nur das Nötige');

  await p.locator('#liste .vb-gruppe .haken.extra input').first().check({force:true}); await p.waitForTimeout(150);
  ok(new RegExp('0 von '+noetig+' nötigen').test(await p.locator('#liste-note').innerText()), 'Extra abhaken ändert den Zähler nicht');
  await p.locator('#liste .haken:not(.extra) input').first().check({force:true}); await p.waitForTimeout(150);
  ok(new RegExp('1 von '+noetig+' nötigen').test(await p.locator('#liste-note').innerText()), 'Nötiges abhaken zählt');
  await p.reload(); await p.waitForSelector('#liste .haken', {state:'attached'});
  ok(await p.locator('[data-vb="packen"][aria-pressed="true"]').count()===1 && await p.locator('#liste .haken input:checked').count()===2, 'Ansicht und Haken bleiben nach dem Neuladen');

  // Drinnen: eigene Orte und Dinge
  await p.evaluate(()=>{ const s=JSON.parse(localStorage.getItem('sj.einhorn')||'{}'); });
  const drinnen=await p.evaluate(async()=>{ const T=await (await fetch('themen/einhorn/tour.json')).json(); const L=Party.vorbereitungsListe(T,'c',8); return L.gruppen.map(g=>(g.ort||g.titel)+':'+g.items.map(i=>i.x).join('|')).join(' / '); });
  ok(/Flur:Blaues Handtuch als Fluss\|Seil/.test(drinnen) && !/Kreidespur/.test(drinnen), 'Drinnen: Handtuch-Fluss mit Seil, keine Kreidespur');
  const mitExtra=await p.evaluate(async()=>{ const T=await (await fetch('themen/einhorn/tour.json')).json(); return JSON.stringify(Party.vorbereitungsListe(T,'b',8)); });
  ok(/4 bunte Schleifen/.test(mitExtra) && /Weißes Laken als Wolke/.test(mitExtra), 'Mit Extra „Hinweise am Weg“: Schleifen und Laken an ihrer Station');

  // Jedes Ding aus „nötig“ und „Extras“ steht in der Liste jeder Spielart, für die es gilt
  const fehlt=await p.evaluate(async()=>{ const vb=(await (await fetch('themen/einhorn/tour.json')).json()).vorbereitung, r=[];
    ['a','b','c'].forEach(v=>{ const l=vb.liste[v], dinge=new Set([].concat(l.vorher||[], l.mit||[], ...l.stationen.map(s=>s.d)).map(i=>i.ding));
      vb.noetig.concat(vb.extras).forEach(x=>{ if((!x.nur || x.nur.includes(v)) && !dinge.has(x.x)) r.push(v+': '+x.x); }); });
    return r; });
  ok(!fehlt.length, 'Kein Ding fehlt in der Liste'+(fehlt.length?': '+fehlt.join(' | '):''));
  ok(!/funkel-stimme\.json/.test(await p.locator('#liste').innerHTML()), 'Kein Entwickler-Text in der Liste');
  ok(!pf.length, 'Keine Seitenfehler'+(pf.length?': '+pf.join(' | '):''));
  await b.close(); console.log(fehler?fehler+' FEHLER':'ALLES OK'); process.exit(fehler?1:0);
})();
