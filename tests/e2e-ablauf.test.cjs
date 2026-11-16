// Aus der E2E-Prüfung, zweite Runde: Dauer aus dem Plan (UNICORN-84), Gäste kommen / Tour startet (108), Erwachsene (89),
// Generalprobe prüft Orte (99), Stand der Party auf dem Tablet (105), Treffpunkt und Abholzeit im Schritt (94),
// Kinderzahl nur in der Party (85), Taschen packen (109), Urkunden mit oder ohne Namen (102)
const { chromium } = require('playwright');
const S='http://localhost:8765';
let fehler=0; const ok=(b,t)=>{ console.log((b?'ok   ':'FEHL ')+t); if(!b) fehler++; };
const ST=[0,1,2,3,4,5,6].map(i=>({lat:53.55+i*0.001, lng:10.0+i*0.001, name:'Ort '+i}));
const PARTY={format:1,thema:'einhorn',kind:{name:'Mia',alter:5},datum:'2030-06-01',start:'15:00',kinder:6,helfer:2,vorausgeher:true,ort:'draussen',planB:true,ausdrucke:true,erledigt:{},einkauf:{}};
const PLAN={format:1,thema:'einhorn',variante:'a',kinder:6,stationen:ST,strecke:910,heimweg:350,adresse:'Musterweg 1'};
(async()=>{
  const b=await chromium.launch(), c=await b.newContext({viewport:{width:393,height:852}});
  await c.addInitScript(()=>{ window.KONTO_TEST={url:'',key:''}; });
  await c.route(/^https?:\/\/(?!localhost)/, r=>r.abort());
  const p=await c.newPage(); const pf=[]; p.on('pageerror', e=>pf.push(e.message));
  await p.goto(S+'/app/');
  const setze=(pa, pl)=>p.evaluate(([pa, pl])=>{ localStorage.clear(); if(pa) localStorage.setItem('sj.party.einhorn', JSON.stringify(pa)); if(pl) localStorage.setItem('sj.plan.einhorn', JSON.stringify(pl)); }, [pa, pl]);
  const tour=await p.evaluate(()=>fetch('themen/einhorn/tour.json').then(r=>r.json()));

  // 84 + 108: Zeiten
  const z=await p.evaluate(([pa, pl, t])=>{
    const a=Party.aufgaben(pa, t, pl).filter(x=>x.id==='partytag')[0], u={}; a.teile.forEach(x=>u[x.id]=x.uhr);
    return {d:Party.dauer(pa, pl, t), u, abh:Party.abholVorschlag(pa, pl, t), b:Party.einladungsDaten(pa, pl).b, ts:Party.tourUhr(pa,0),
      ts2:Party.tourUhr(Object.assign({}, pa, {tourStart:'15:45'}),0), reihe:a.teile.map(x=>x.id).join(',')};
  }, [PARTY, PLAN, tour]);
  ok(z.d.tour===61 && z.d.heim===10 && z.d.ausPlan, 'Dauer aus der Route: 61 Min. Tour, 10 Min. Heimweg ('+JSON.stringify(z.d)+')');
  ok(z.ts==='15:20' && z.ts2==='15:45', 'Tour startet 20 Min. nach den Gästen, oder zur eingestellten Zeit');
  ok(z.u.gaeste==='15:00' && z.u.start==='15:20' && z.u.vorausgeher==='15:00' && z.u.kreide==='14:20', 'Rückwärts-Zeiten hängen am Tourstart ('+JSON.stringify(z.u)+')');
  ok(z.abh==='17:30' && z.b==='17:30', 'Abholzeit aus der Route vorgeschlagen, auch im Einladungslink ('+z.abh+')');
  ok(z.reihe==='packen,kreide,gaeste,vorausgeher,start,urkunden' && z.u.urkunden==='16:30', 'Partytag nach der Uhr: Taschen packen (Vortag), Kreide, Gäste kommen, Vorausgeher, Tour startet, Schatz und Urkunden ('+z.reihe+')');

  // 108 im Assistenten: zwei Felder, „Tour startet“ zieht mit
  await setze(null, PLAN);
  await p.goto(S+'/app/party.html?thema=einhorn'); await p.waitForSelector('#tourstart');
  ok(await p.inputValue('#tourstart')==='15:20' && /Gäste kommen/.test(await p.locator('label:has(#start)').innerText()), 'Assistent: „Gäste kommen“ 15:00, „Tour startet“ 15:20');
  await p.fill('#start','14:00'); await p.dispatchEvent('#start','input');
  ok(await p.inputValue('#tourstart')==='14:20', '„Tour startet“ zieht mit, solange nicht von Hand gesetzt');
  ok(/etwa 60 Minuten, dazu 10 Minuten Heimweg \(aus eurer Route\)/.test(await p.locator('#seite').innerText()), 'Assistent: Dauer aus der Route statt fest 50 Minuten');

  // 89: Hinweis bei zwei Erwachsenen mit Vorausgeher
  const vo=await p.evaluate(t=>{ const s=t.stationen[2]; return [Party.vorOrt({ort:'draussen',vorausgeher:true,helfer:2}, s), Party.vorOrt({ort:'draussen',vorausgeher:true,helfer:3}, s)]; }, tour);
  ok(/Wartet hier, bis der Vorausgeher/.test(vo[0]) && /einer hinten\.$/.test(vo[1]) && !/Wartet/.test(vo[1]), 'Station 3: Text nach Zahl der Erwachsenen');

  // 94 + 109: Party-Seite
  await setze(PARTY, PLAN);
  await p.goto(S+'/app/party.html?thema=einhorn'); await p.waitForSelector('[data-oeffne="einladen"]');
  await p.click('[data-oeffne="einladen"]'); await p.waitForSelector('#ein-treff');
  ok(await p.inputValue('#ein-treff')==='Musterweg 1' && await p.inputValue('#ein-abholen')==='17:30', 'Gäste einladen: Treffpunkt und Abholzeit direkt im Schritt');
  await p.fill('#ein-treff','Spielplatz am Teich'); await p.dispatchEvent('#ein-treff','change');
  await p.fill('#ein-abholen','17:45'); await p.dispatchEvent('#ein-abholen','change');
  const gesp=await p.evaluate(()=>{ const x=JSON.parse(localStorage.getItem('sj.party.einhorn')); return [x.treffpunkt, x.abholen, Party.einladungsDaten(x, Party.plan('einhorn')).w]; });
  ok(gesp[0]==='Spielplatz am Teich' && gesp[1]==='17:45' && gesp[2]==='Spielplatz am Teich', 'Treffpunkt und Abholzeit gespeichert, gehen in den Link');
  await p.goto(S+'/app/party.html?thema=einhorn#partytag'); await p.waitForTimeout(300);
  await p.click('.punkte [data-oeffne="partytag"]').catch(()=>p.click('[data-oeffne="partytag"]')); await p.waitForSelector('#packliste');
  ok(/Taschen packen/.test(await p.locator('#s-partytag, #seite').first().innerText()) && await p.locator('#packliste [data-pack]').count()>5, 'Partytag: „Taschen packen“ mit Packliste in der Party');
  const k1=await p.locator('#packliste [data-pack]').first().getAttribute('data-pack');
  await p.locator('#packliste [data-pack]').first().check();
  const lh=await p.evaluate(()=>JSON.parse(localStorage.getItem('sj.einhorn.liste')||'{}'));
  ok(lh[k1]===true, 'Haken landet in derselben Liste wie im Spiel ('+k1+')');
  ok(/Gäste kommen/.test(await p.locator('#seite').innerText()) && /Schatz und Urkunden/.test(await p.locator('#seite').innerText()), 'Partytag zeigt „Gäste kommen“ und „Schatz und Urkunden“');

  // 85: Planer fragt die Kinderzahl nicht mehr
  await setze(null, null);
  await p.goto(S+'/app/planer.html?thema=einhorn'); await p.waitForTimeout(800);
  ok(!(await p.locator('#sek-kinder').isVisible()), 'Planer: keine Frage „Wie viele Kinder?“');

  // 102: Urkunden ohne und mit Namen
  await setze(PARTY, PLAN);
  await p.goto(S+'/app/druck.html?thema=einhorn'); await p.waitForSelector('.urkunde');
  ok(await p.locator('input[name="urk-art"][value="ohne"]').isChecked() && await p.locator('.urkunde .linie span').count()===0 && await p.locator('.urkunde').count()===6, 'Urkunden: ohne Zusagen erst ohne Namen, 6 Stück zum Reinschreiben');
  await p.check('input[name="urk-art"][value="mit"]'); await p.waitForSelector('#urk-liste:visible');
  ok(await p.inputValue('#urk-liste')==='Mia', 'Mit Namen: das Geburtstagskind steht schon drin');
  await p.fill('#urk-liste','Mia\nLeo\nAyla'); await p.dispatchEvent('#urk-liste','change');
  const nm=await p.locator('.urkunde .linie span').allInnerTexts();
  ok(nm.join(',')==='Mia,Leo,Ayla' && await p.locator('.urkunde').count()===6, 'Namen auf den Urkunden, Rest bleibt zum Reinschreiben');

  // 99: Generalprobe fragt nach dem Ort
  await setze(PARTY, PLAN);
  await p.goto(S+'/app/spiel.html?thema=einhorn'); await p.waitForTimeout(800);
  const pr=await p.evaluate(()=>[__zs.probeFragen(2).join('|'), __zs.probeFragen(4).join('|'), /data-probe-ort/.test(__zs.probeOrtHtml(4))]);
  ok(/sicher rüber/.test(pr[0]) && pr[1]==='Versteck gefunden|Platz für alle' && pr[2], 'Generalprobe: je Station „Versteck gefunden“, „Platz für alle“, an der Straße „sicher rüber“');
  const off=await p.evaluate(()=>{ __zs.state().probeOrte={4:{0:true}}; return __zs.probeOrtOffen(4).join('|'); });
  ok(off==='Platz für alle', 'Auswertung nennt, was an der Station noch offen ist');

  // 105: Stand der Party auf dem Tablet
  const k=await b.newContext({viewport:{width:393,height:852}});
  await k.addInitScript(()=>{ window.KONTO_TEST={url:'https://test.supabase.co',key:'anon'}; });
  let daten=null;
  await k.route(/^https?:\/\/(?!localhost)/, r=>{ const u=r.request().url(); if(/rpc\/link_lesen/.test(u)) return r.fulfill({status:200, contentType:'application/json', body:JSON.stringify({rolle:'spiel', daten})}); return r.abort(); });
  const q=await k.newPage(); q.on('pageerror', e=>pf.push(e.message));
  await q.goto(S+'/app/');
  daten=await q.evaluate(([pa, pl])=>Party.planKern(pl, pa), [PARTY, PLAN]);
  await q.evaluate(d=>{ localStorage.clear(); Party.ausLinkUebernehmen('einhorn', d, 'K'.repeat(24)); localStorage.setItem('sj.link.einhorn', JSON.stringify({k:'K'.repeat(24), rolle:'spiel'})); }, daten);
  await q.goto(S+'/app/bereit.html?thema=einhorn'); await q.waitForFunction(()=>/Stand der Party/.test(document.getElementById('liste').innerText) && !/Wird geprüft/.test(document.getElementById('liste').innerText.split('Stand der Party')[1].split('\n')[1]||''), null, {timeout:8000}).catch(()=>{});
  ok(/Stand der Party\s*Aktuell/.test(await q.locator('#liste').innerText()), 'Startklar auf dem Tablet: Stand der Party aktuell');
  daten=JSON.parse(JSON.stringify(daten)); daten.party.start='16:00';
  await q.reload(); await q.waitForSelector('#stand-holen', {timeout:8000}).catch(()=>{});
  ok(await q.locator('#stand-holen').isVisible(), 'Neuere Fassung auf dem Handy: „Jetzt holen“');
  await q.click('#stand-holen'); await q.waitForLoadState('load'); await q.waitForTimeout(800);
  ok(await q.evaluate(()=>JSON.parse(localStorage.getItem('sj.party.einhorn')).start)==='16:00' && /Aktuell/.test(await q.locator('#liste').innerText()), 'Nach dem Holen: neuer Stand auf dem Tablet');

  ok(!pf.length, 'Keine Seitenfehler'+(pf.length?': '+pf.join(' | '):''));
  await b.close(); process.exit(fehler?1:0);
})();
