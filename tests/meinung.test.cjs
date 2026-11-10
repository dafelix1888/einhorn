// Feedback zur App (UNICORN-30): 1 bis 5 Sterne und freier Text, gegen ein nachgebautes Supabase
const { chromium } = require('playwright');
const S='https://test.supabase.co', B=''+(process.env.BASIS||'http://localhost:8765')+'/app/';
const meinungen=[]; let serverKaputt=false;
async function mock(route){
  const req=route.request(), u=new URL(req.url()), body=req.postData()?JSON.parse(req.postData()):null;
  const j=(s,o)=>route.fulfill({status:s, contentType:'application/json', body:o===undefined?'':JSON.stringify(o)});
  if(u.pathname==='/rest/v1/rpc/meinung_geben'){
    if(serverKaputt) return j(500,{message:'kaputt'});
    if(!(body.p_sterne>=1 && body.p_sterne<=5)) return j(200,false);
    meinungen.push(body); return j(200,true);
  }
  return j(401,{message:'permission denied'});
}
let fehler=0; function pruefe(ok, t){ console.log((ok?'ok   ':'FEHLER ')+t); if(!ok) fehler++; }
const HINWEIS='Feedback zu Story-Wünschen, Charakteren usw. gerne hier';

(async()=>{
  const b=await chromium.launch(), errs=[];
  async function geraet(mitServer=true){
    const c=await b.newContext({viewport:{width:393,height:852}});
    await c.route('https://efdjomgubucdnvgtuqmp.supabase.co/**', r=>r.abort());
    if(mitServer){ await c.addInitScript(()=>{ window.KONTO_TEST={url:'https://test.supabase.co', key:'anon'}; }); await c.route(S+'/**', mock); }
    else await c.addInitScript(()=>{ window.KONTO_TEST={url:'', key:''}; });
    const p=await c.newPage(); p.on('pageerror',e=>errs.push(e.message)); return p;
  }
  const an=p=>p.locator('.mg-sterne button.an').count();

  // Hauptbereich ohne Party und ohne Anmeldung: Karte mit fünf Sternen
  const a=await geraet(); await a.goto(B+'index.html'); await a.waitForSelector('.handy .meinung-karte');
  pruefe(await a.locator('.handy .mk-sterne button').count()===5 && /Wie gefällt dir Schatzweg/.test(await a.locator('.handy .meinung-karte').innerText()), 'Hauptbereich: Karte mit fünf Sternen');
  await a.locator('.handy [data-meinung="4"]').click(); await a.waitForSelector('dialog.konto-dlg[open] .mg');
  pruefe(await an(a)===4 && /Gut/.test(await a.locator('.mg-wort').innerText()), 'Tipp auf den vierten Stern öffnet das Fenster mit 4 Sternen');
  pruefe(await a.getAttribute('#mg-text','placeholder')===HINWEIS, 'Hinweis im Textfeld wie gewünscht');
  const farbe=()=>a.evaluate(()=>getComputedStyle(document.getElementById('mg-text'), '::placeholder').color);
  await a.locator('.mg h2').click(); const vorher=await farbe();
  await a.click('#mg-text'); const nachher=await farbe();
  pruefe(!/, 0\)$/.test(vorher) && /rgba\(0, 0, 0, 0\)|transparent/.test(nachher), 'Hinweis verschwindet beim Hineintippen ('+vorher+' → '+nachher+')');
  await a.click('.mg-sterne [data-stern="5"]');
  pruefe(await an(a)===5 && /Super/.test(await a.locator('.mg-wort').innerText()), 'Sterne lassen sich im Fenster ändern');
  await a.keyboard.press('ArrowLeft');
  pruefe(await an(a)===4, 'Pfeiltaste ändert die Sterne');
  await a.fill('#mg-text','  Mehr Piraten, bitte!\nUnd ein Drache.  '); await a.click('[data-mg="senden"]'); await a.waitForSelector('.kd-fertig');
  const m=meinungen[0]||{};
  pruefe(meinungen.length===1 && m.p_sterne===4 && m.p_text==='Mehr Piraten, bitte!\nUnd ein Drache.' && m.p_wo==='start' && m.p_stand==='ohne-party', 'Beim Server: Sterne, Text, Stelle und Stand, sonst nichts');
  pruefe(Object.keys(m).sort().join(',')==='p_stand,p_sterne,p_text,p_wo', 'Keine weiteren Angaben im Feedback');
  pruefe(/Danke/.test(await a.locator('.kd-fertig').innerText()), 'Danke-Meldung');
  await a.waitForFunction(()=>!document.querySelector('dialog.konto-dlg[open]'), null, {timeout:5000}).catch(()=>{});
  pruefe(await a.locator('dialog.konto-dlg[open]').count()===0, 'Fenster schließt von selbst');
  pruefe(/Danke für dein Feedback/.test(await a.locator('.handy .meinung-karte').innerText()) && await a.locator('.handy .mk-sterne button.an').count()===4, 'Karte bedankt sich und zeigt die Sterne');

  // Über „Mein Bereich“: ohne Sterne geht nichts raus, nur Sterne ohne Text gehen
  await a.click('#profil'); await a.waitForSelector('.mb'); await a.click('[data-mb="meinung"]'); await a.waitForSelector('.mg');
  pruefe(await an(a)===0, '„Mein Bereich“ öffnet das Feedback ohne Vorauswahl');
  await a.click('[data-mg="senden"]');
  pruefe(/Sterne wählen/.test(await a.locator('.mg .fehler').innerText()) && meinungen.length===1, 'Ohne Sterne wird nichts geschickt');
  await a.click('.mg-sterne [data-stern="2"]'); await a.click('[data-mg="senden"]'); await a.waitForSelector('.kd-fertig');
  pruefe(meinungen.length===2 && meinungen[1].p_sterne===2 && meinungen[1].p_text==='' && meinungen[1].p_wo==='bereich', 'Nur Sterne ohne Text gehen auch');
  await a.waitForFunction(()=>!document.querySelector('dialog.konto-dlg[open]'), null, {timeout:5000}).catch(()=>{});

  // Party-Seite: Einstieg im Überblick, Stand „in Planung“; Server-Fehler bleibt im Fenster
  const d=new Date(Date.now()+9*864e5).toISOString().slice(0,10);
  await a.evaluate(d=>{ localStorage.setItem('sj.party.einhorn', JSON.stringify({format:1,thema:'einhorn',kind:{name:'Mia',alter:5},datum:d,start:'15:00',kinder:6,helfer:2,vorausgeher:true,ort:'draussen',planB:true,ausdrucke:true,erledigt:{},einkauf:{}}));
    localStorage.setItem('sj.plan.einhorn', JSON.stringify({format:1,thema:'einhorn',variante:'a',kinder:6,adresse:'Teststraße 1',strecke:1200,stationen:[{lat:53.5,lng:9.9,name:'Haustür'},{lat:53.501,lng:9.901,name:'Ecke'}]})); }, d);
  await a.goto(B+'party.html?thema=einhorn'); await a.waitForSelector('.held');
  await a.click('[data-meinung-auf="party"]'); await a.waitForSelector('.mg');
  serverKaputt=true; await a.click('.mg-sterne [data-stern="5"]'); await a.fill('#mg-text','Toll'); await a.click('[data-mg="senden"]');
  await a.waitForFunction(()=>/nicht geklappt/.test(document.querySelector('.mg .fehler').textContent), null, {timeout:5000}).catch(()=>{});
  pruefe(/nicht geklappt/.test(await a.locator('.mg .fehler').innerText()) && await a.inputValue('#mg-text')==='Toll' && meinungen.length===2, 'Server-Fehler: Meldung, Text bleibt stehen');
  serverKaputt=false; await a.click('[data-mg="senden"]'); await a.waitForSelector('.kd-fertig');
  pruefe(meinungen.length===3 && meinungen[2].p_wo==='party' && meinungen[2].p_stand==='in-planung', 'Zweiter Versuch klappt, Stelle „party“, Stand „in-planung“');
  // Nach der Party: Knopf in der Karte „Nach der Party“
  await a.evaluate(()=>{ const p=JSON.parse(localStorage.getItem('sj.party.einhorn')); p.datum=new Date(Date.now()-2*864e5).toISOString().slice(0,10); localStorage.setItem('sj.party.einhorn', JSON.stringify(p)); });
  await a.reload(); await a.waitForSelector('.jetzt-karte'); await a.click('[data-meinung-auf="nach-party"]'); await a.waitForSelector('.mg');
  await a.click('.mg-sterne [data-stern="5"]'); await a.click('[data-mg="senden"]'); await a.waitForSelector('.kd-fertig');
  pruefe(meinungen[3] && meinungen[3].p_wo==='nach-party' && meinungen[3].p_stand==='gefeiert', 'Nach der Party: Stelle „nach-party“, Stand „gefeiert“');

  // Ohne Server: keine Einstiege
  const o=await geraet(false); await o.goto(B+'index.html'); await o.waitForSelector('.handy');
  pruefe(await o.locator('.meinung-karte').count()===0, 'Ohne Server: keine Feedback-Karte');
  await o.click('#profil'); await o.waitForSelector('.mb');
  pruefe(await o.locator('[data-mb="meinung"]').count()===0, 'Ohne Server: kein Feedback in „Mein Bereich“');

  pruefe(errs.length===0, 'keine Seitenfehler '+errs.join(' | '));
  console.log(fehler?fehler+' FEHLER':'ALLES OK'); await b.close(); process.exit(fehler?1:0);
})();
