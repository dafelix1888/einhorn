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

  const gruppen=await p.locator('#liste .vb-gruppe').count();
  ok(gruppen===9, 'Gegliedert: Vorher, 7 Stationen, Mitnehmen ('+gruppen+' Abschnitte)');
  ok(await p.locator('#liste .vb-gruppe .pk-nr').count()===7, 'Jede Station mit farbiger Nummer');
  const st1=await p.locator('#liste .vb-gruppe').nth(1).innerText();
  ok(/Haustür/.test(st1) && /Gruppe/.test(st1) && /Haarreifen/.test(st1) && /Sonst: Papierhörner/.test(st1), 'Station 1: Ort, wer, Haarreifen mit Notlösung');
  const noetig=await p.locator('#liste .haken:not(.extra)').count(), extra=await p.locator('#liste .vb-gruppe .haken.extra').count();
  ok(noetig>=15 && extra>=4, 'Nötiges und Extras getrennt erkennbar ('+noetig+' nötig, '+extra+' Extras)');
  ok(await p.locator('#liste .haken:not(.extra) .notfalls').count()===noetig, 'Jedes nötige Ding hat „Sonst: …“');
  ok(await p.locator('#liste .haken.extra .tag-extra').count()===extra, 'Jedes Extra trägt das Zeichen „Extra“');
  ok(new RegExp(noetig+' nötig · '+extra+' Extras').test(await p.locator('#liste h3').innerText()), 'Überschrift nennt beides');
  ok(new RegExp('0 von '+noetig+' nötigen').test(await p.locator('#liste-note').innerText()), 'Zähler zählt nur das Nötige');

  await p.locator('#liste .vb-gruppe .haken.extra input').first().check({force:true}); await p.waitForTimeout(150);
  ok(new RegExp('0 von '+noetig+' nötigen').test(await p.locator('#liste-note').innerText()), 'Extra abhaken ändert den Zähler nicht');
  await p.locator('#liste .haken:not(.extra) input').first().check({force:true}); await p.waitForTimeout(150);
  ok(new RegExp('1 von '+noetig+' nötigen').test(await p.locator('#liste-note').innerText()), 'Nötiges abhaken zählt');
  await p.reload(); await p.waitForSelector('#liste .haken', {state:'attached'});
  ok(await p.locator('#liste .haken input:checked').count()===2, 'Haken bleiben nach dem Neuladen');

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
