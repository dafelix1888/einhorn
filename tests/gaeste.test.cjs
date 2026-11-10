// Gästeliste (UNICORN-29) und Hauptbereich mit „Mein Bereich“ (UNICORN-28), gegen ein nachgebautes Supabase
const { chromium } = require('playwright');
const S='https://test.supabase.co', B=''+(process.env.BASIS||'http://localhost:8765')+'/app/';
const db={parties:{}, links:{}, antworten:[]};
let ohneAntwortFunktion=false;
function nutzer(req){ const a=req.headers()['authorization']||''; return a.startsWith('Bearer AT-') ? 'U-'+a.slice(10) : null; }
async function mock(route){
  const req=route.request(), u=new URL(req.url()), m=req.method(), body=req.postData()?JSON.parse(req.postData()):null, me=nutzer(req);
  const j=(s,o)=>route.fulfill({status:s, contentType:'application/json', body:o===undefined?'':JSON.stringify(o)});
  if(u.pathname==='/auth/v1/verify'){ if(body.token!=='123456') return j(403,{msg:'falsch'}); return j(200,{access_token:'AT-'+body.email, refresh_token:'RT-'+body.email, expires_in:3600, user:{id:'U-'+body.email, email:body.email}}); }
  if(u.pathname==='/auth/v1/logout') return j(204);
  if(u.pathname==='/rest/v1/rpc/link_lesen'){ const l=db.links[body.t]; return j(200, l?{rolle:l.rolle, daten:l.daten}:null); }
  if(u.pathname==='/rest/v1/rpc/einladung_gesehen'){ const l=db.links[body.t]; if(!l||l.rolle!=='gast') return j(200,false); l.geoeffnet=(l.geoeffnet||0)+1; return j(200,true); }
  if(u.pathname==='/rest/v1/rpc/antwort_geben'){                         // wie server/supabase.sql: nur Einladungs-Link, Name säubern, je Gerät ein Eintrag
    if(ohneAntwortFunktion) return j(404,{message:'function not found'});
    const l=db.links[body.t], n=String(body.n||'').replace(/[<>]/g,'').replace(/\s+/g,' ').trim().slice(0,40);
    if(!l||l.rolle!=='gast'||!/^[A-Za-z0-9_-]{16,40}$/.test(body.k||'')||!n||typeof body.ja!=='boolean') return j(200,false);
    const alt=db.antworten.find(a=>a.party_id===l.party_id&&a.kennung===body.k);
    if(alt){ alt.name=n; alt.kommt=body.ja; } else db.antworten.push({party_id:l.party_id, kennung:body.k, name:n, kommt:body.ja});
    return j(200,true);
  }
  if(!me) return j(401,{message:'permission denied'});
  const eigen=id=>db.parties[id]&&db.parties[id].owner===me;
  if(u.pathname==='/rest/v1/parties'){
    if(m==='POST'){ const alt=db.parties[body.id]; if(alt && alt.owner!==me) return j(403,{message:'rls'}); db.parties[body.id]={...body, owner:me}; return j(201); }
    if(m==='GET') return j(200, Object.values(db.parties).filter(p=>p.owner===me));
  }
  if(u.pathname==='/rest/v1/links'){
    if(m==='POST'){ for(const l of body){ if(!eigen(l.party_id)) return j(403,{message:'rls'}); db.links[l.token]={geoeffnet:0, ...(db.links[l.token]||{}), ...l, owner:me}; } return j(201); }
    if(m==='GET'){ const id=u.searchParams.get('party_id').slice(3); return j(200, Object.values(db.links).filter(l=>l.party_id===id&&l.rolle==='gast'&&eigen(id)).map(l=>({geoeffnet:l.geoeffnet||0}))); }
  }
  if(u.pathname==='/rest/v1/antworten'){
    const id=u.searchParams.get('party_id').slice(3); if(!eigen(id)) return j(200, []);
    if(m==='GET') return j(200, db.antworten.filter(a=>a.party_id===id).map(a=>({kennung:a.kennung, name:a.name, kommt:a.kommt})));
    if(m==='DELETE'){ const k=u.searchParams.get('kennung').slice(3); db.antworten=db.antworten.filter(a=>!(a.party_id===id&&a.kennung===k)); return j(204); }
  }
  return j(404,{message:'?'});
}
let fehler=0; function pruefe(ok, t){ console.log((ok?'ok   ':'FEHLER ')+t); if(!ok) fehler++; }

(async()=>{
  const b=await chromium.launch(), errs=[];
  async function geraet(mitServer=true){
    const c=await b.newContext({viewport:{width:393,height:852}});
    await c.route('https://efdjomgubucdnvgtuqmp.supabase.co/**', r=>r.abort());
    if(mitServer){ await c.addInitScript(()=>{ window.KONTO_TEST={url:'https://test.supabase.co', key:'anon'}; }); await c.route(S+'/**', mock); }
    else await c.addInitScript(()=>{ window.KONTO_TEST={url:'', key:''}; });
    const p=await c.newPage(); p.on('pageerror',e=>errs.push(e.message)); return p;
  }
  const d=new Date(Date.now()+12*864e5).toISOString().slice(0,10);
  const party={format:1,thema:'einhorn',kind:{name:'emma',alter:5},datum:d,start:'15:00',kinder:8,helfer:2,vorausgeher:true,ort:'draussen',planB:true,ausdrucke:true,erledigt:{},einkauf:{},telefon:'01701234567'};
  const plan={format:1,thema:'einhorn',variante:'a',kinder:8,adresse:'Teststraße 1',strecke:1200,stand:'x',stationen:[{lat:53.5,lng:9.9,name:'Haustür'},{lat:53.501,lng:9.901,name:'Ecke'}]};

  // Gastgeber: Party sichern, Links entstehen
  const a=await geraet();
  await a.goto(B+'party.html?thema=einhorn'); await a.evaluate(([p,pl])=>{ localStorage.clear(); localStorage.setItem('sj.party.einhorn',JSON.stringify(p)); localStorage.setItem('sj.plan.einhorn',JSON.stringify(pl)); }, [party, plan]);
  await a.reload(); await a.waitForSelector('.held');
  pruefe(/Emmas Einhorn-Party/.test(await a.locator('.held h1').innerText()), 'Klein getippter Vorname steht groß da');
  await a.evaluate(async()=>{ await Konto.codePruefen('eltern@test.de','123456'); await Konto.sync('einhorn', true); });
  const einladung=await a.evaluate(()=>Party.einladungsLink(Party.lesen('einhorn'), Party.plan('einhorn')));
  const gastLink=()=>Object.values(db.links).find(l=>l.rolle==='gast');
  pruefe(/einladung\.html\?k=/.test(einladung) && gastLink().geoeffnet===0, 'Einladungslink mit Schlüssel, noch nicht geöffnet');
  await a.goto(einladung); await a.waitForSelector('#kind');
  pruefe(gastLink().geoeffnet===0, 'Vorschau der Gastgeber zählt nicht als Öffnung');

  // Gast 1: öffnet, sagt zu, ändert die Antwort
  const g1=await geraet(); await g1.goto(einladung); await g1.waitForSelector('#kind');
  await g1.reload(); await g1.waitForSelector('#kind');
  pruefe(gastLink().geoeffnet===1, 'Gerät zählt einmal, auch nach Neuladen');
  await g1.click('[data-sag="1"]');
  pruefe(/Vornamen eintragen/.test(await g1.locator('#kind-f').innerText()) && db.antworten.length===0, 'Ohne Vornamen keine Antwort');
  await g1.fill('#kind','  mia  '); await g1.click('[data-sag="1"]'); await g1.waitForSelector('.danke.gut');
  pruefe(db.antworten.length===1 && db.antworten[0].name==='Mia' && db.antworten[0].kommt===true, 'Zusage liegt beim Server, Vorname groß');
  pruefe(/Mia ist dabei/.test(await g1.locator('.danke').innerText()) && await g1.locator('.danke .auch').count()===1, 'Bestätigung mit Namen, WhatsApp als Zusatz');
  await g1.reload(); await g1.waitForSelector('.danke.gut');
  pruefe(/Mia ist dabei/.test(await g1.locator('.danke').innerText()), 'Gerät merkt sich die Antwort');
  await g1.click('[data-zurueck]'); await g1.waitForSelector('#kind');
  pruefe(await g1.inputValue('#kind')==='Mia', '„Antwort ändern“ zeigt den Namen wieder');
  await g1.click('[data-sag="0"]'); await g1.waitForSelector('.danke.schade');
  pruefe(db.antworten.length===1 && db.antworten[0].kommt===false, 'Geänderte Antwort überschreibt, kein zweiter Eintrag');
  await g1.click('[data-zurueck]'); await g1.click('[data-sag="1"]'); await g1.waitForSelector('.danke.gut');
  // Gast 2: sagt ab
  const g2=await geraet(); await g2.goto(einladung); await g2.waitForSelector('#kind');
  await g2.fill('#kind','Ben'); await g2.click('[data-sag="0"]'); await g2.waitForSelector('.danke.schade');
  pruefe(db.antworten.length===2 && gastLink().geoeffnet===2, 'Zweites Gerät: zweite Antwort, zweite Öffnung');

  // Gastgeber sieht den Stand im Überblick und die Liste im Schritt
  await a.goto(B+'party.html?thema=einhorn'); await a.waitForSelector('.held');
  await a.waitForFunction(()=>/1 Zusage · 1 Absage/.test((document.getElementById('gaeste-kurz')||{}).textContent||''), null, {timeout:8000}).catch(()=>{});
  pruefe(/1 Zusage · 1 Absage/.test(await a.locator('#gaeste-kurz').innerText()), 'Überblick: Zeile „Gäste einladen“ zeigt Zu- und Absagen');
  await a.click('[data-oeffne="einladen"]'); await a.waitForSelector('.g-liste li');
  const stand=await a.locator('.g-stand').innerText();
  pruefe(/1\s*kommt/.test(stand) && /1\s*kann nicht/.test(stand) && /2\s*-mal geöffnet/.test(stand), 'Schritt: 1 kommt, 1 kann nicht, 2-mal geöffnet');
  pruefe((await a.locator('.g-liste b').allInnerTexts()).join(',')==='Mia,Ben', 'Liste mit Namen, Zusagen zuerst');
  await a.evaluate(()=>{ window.confirm=()=>true; });
  await a.click('.g-liste li.nein [data-gast-weg]'); await a.waitForFunction(()=>document.querySelectorAll('.g-liste li').length===1, null, {timeout:8000}).catch(()=>{});
  pruefe(db.antworten.length===1 && await a.locator('.g-liste li').count()===1, 'Eintrag entfernen löscht ihn beim Server');
  // Fremde sehen keine Antworten
  const f=await geraet(); await f.goto(B+'party.html?thema=einhorn'); await f.evaluate(()=>Konto.codePruefen('fremd@test.de','123456'));
  const fremd=await f.evaluate(async(id)=>{ const s=JSON.parse(localStorage.getItem('sj.konto')); const r=await fetch('https://test.supabase.co/rest/v1/antworten?select=name&party_id=eq.'+id,{headers:{apikey:'anon',Authorization:'Bearer '+s.access_token}}); return r.json(); }, Object.keys(db.parties)[0]);
  pruefe(Array.isArray(fremd) && fremd.length===0, 'Fremdes Konto liest keine Antworten');

  // Hauptbereich: Party als Hauptblock, Abenteuer kompakt, Kreis = Mein Bereich
  await a.goto(B+'index.html'); await a.waitForSelector('.meine');
  const karte=await a.locator('.meine').innerText();
  pruefe(/Deine Party/i.test(karte) && /In Planung/.test(karte) && /Emmas Party/.test(karte) && /Als Nächstes:\s*Alles bestellen/.test(karte), 'Hauptbereich: „Deine Party“ mit Status und nächstem Schritt');
  pruefe(await a.locator('.m-bogen path').count()===6 && await a.locator('.m-weiter').isVisible(), 'Regenbogen und Hauptknopf in der Party-Karte');
  await a.waitForFunction(()=>/1 Zusage/.test((document.getElementById('m-gaeste')||{}).textContent||''), null, {timeout:8000}).catch(()=>{});
  pruefe(/1 Zusage/.test(await a.locator('#m-gaeste').innerText()), 'Party-Karte zeigt den Gäste-Stand');
  pruefe(await a.locator('.buehne').count()===0 && await a.locator('.kompakt').isVisible() && await a.locator('.zahlen').count()===0, 'Mit Party: Abenteuer kompakt statt bildschirmfüllend');
  pruefe(await a.locator('.meine').evaluate(e=>e.getBoundingClientRect().bottom<window.innerHeight*0.6), 'Party-Karte steht ganz oben');
  pruefe((await a.locator('#profil').innerText()).trim()==='E', 'Kreis zeigt den Anfangsbuchstaben der E-Mail');
  await a.click('#profil'); await a.waitForSelector('dialog.konto-dlg[open] .mb');
  const mb=await a.locator('.mb').innerText();
  pruefe(/Mein Bereich/.test(mb) && /Angemeldet als\s*eltern@test\.de/.test(mb) && /Emmas Party/.test(mb), 'Kreis öffnet „Mein Bereich“ mit Konto und Party');
  pruefe(/1 Zusage · Einladung 2-mal geöffnet/.test(mb) && await a.locator('.mb [data-konto-neu]').count()===3 && /löschen wir alles von selbst/.test(mb) && !/Einstellungen/.test(mb), 'Mein Bereich: Gäste, drei Links, Löschdatum, keine Einstellungen');
  await a.click('[data-mb="zu"]'); await a.waitForTimeout(150);
  pruefe(await a.locator('dialog.konto-dlg[open]').count()===0, 'Blatt schließt');
  await a.click('.meine .dran0'); await a.waitForSelector('#einkauf');
  pruefe(/party\.html\?thema=einhorn#einkauf$/.test(a.url()), '„Als Nächstes“ springt direkt in den Schritt');

  // Ohne Party und ohne Anmeldung: Abenteuer groß, Kreis lädt zum Anmelden ein
  const n=await geraet(); await n.goto(B+'index.html'); await n.waitForSelector('.buehne');
  pruefe(await n.locator('.meine').count()===0 && await n.locator('#profil svg').count()===1, 'Ohne Party: Abenteuer groß, Kreis mit Person');
  await n.click('#profil'); await n.waitForSelector('.mb');
  pruefe(/kein Konto/.test(await n.locator('.mb').innerText()) && await n.locator('.mb [data-konto="anmelden"]').count()===1, 'Mein Bereich ohne Anmeldung: erklären und Anmelden anbieten');

  // Server kennt die Funktion nicht (oder kein Netz): alter Weg über WhatsApp bleibt
  ohneAntwortFunktion=true;
  const g3=await geraet(); await g3.goto(einladung); await g3.waitForSelector('#kind');
  await g3.fill('#kind','Lena'); await g3.click('[data-sag="1"]'); await g3.waitForSelector('[data-gewaehlt="ja"]');
  pruefe(await g3.locator('#kind').count()===0 && /wa\.me/.test(await g3.locator('[data-gewaehlt="ja"]').getAttribute('href')), 'Klappt der Server nicht: Antwort über WhatsApp wie bisher');
  ohneAntwortFunktion=false;
  // Ohne Server: Einladung mit Daten im Link wie bisher
  const o=await geraet(false); await o.goto(B); await o.evaluate(([p,pl])=>{ localStorage.setItem('sj.party.einhorn',JSON.stringify(p)); localStorage.setItem('sj.plan.einhorn',JSON.stringify(pl)); }, [party, plan]);
  const alt=await o.evaluate(()=>Party.einladungsLink(Party.lesen('einhorn'), Party.plan('einhorn')));
  await o.goto(alt); await o.waitForSelector('#antwort');
  pruefe(await o.locator('#kind').count()===0 && await o.locator('[data-gewaehlt="ja"]').count()===1, 'Ohne Server: kein Namensfeld, Antwort wie bisher');
  await o.goto(B+'index.html'); await o.waitForSelector('.meine'); await o.click('#profil'); await o.waitForSelector('.mb');
  pruefe(/ohne Anmeldung/.test(await o.locator('.mb').innerText()) && await o.locator('.mb [data-konto="anmelden"]').count()===0, 'Ohne Server: Mein Bereich ohne Anmelde-Knopf');

  pruefe(errs.length===0, 'keine Seitenfehler '+errs.join(' | '));
  console.log(fehler?fehler+' FEHLER':'ALLES OK'); await b.close(); process.exit(fehler?1:0);
})();
