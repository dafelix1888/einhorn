const { chromium } = require('playwright');
(async()=>{ const b=await chromium.launch(); let f=0; const ok=(c,t)=>{console.log((c?'ok   ':'FEHLER ')+t); if(!c) f++;};
 async function seite(test){ const c=await b.newContext(); await c.route('https://efdjomgubucdnvgtuqmp.supabase.co/**', r=>r.abort()); if(test) await c.addInitScript(()=>{window.FEHLER_TEST=1;}); const gesendet=[]; await c.route('https://fsqnzmwuojngopffcxso.supabase.co/**', r=>{ if(r.request().url().includes('fehler_melden')) gesendet.push(JSON.parse(r.request().postData())); r.fulfill({status:200,contentType:'application/json',body:'true'}); }); const p=await c.newPage(); return {p,gesendet}; }
 let {p,gesendet}=await seite(true);
 await p.goto(''+(process.env.BASIS||'http://localhost:8765')+'/app/index.html?k=GEHEIMGEHEIMGEHEIMGEHEIM'); await p.waitForTimeout(800);
 await p.evaluate(()=>{ setTimeout(()=>{ throw new Error('Testfehler bei https://x.y/app/spiel.html?k=GEHEIMGEHEIMGEHEIMGEHEIM'); },0); });
 await p.evaluate(()=>{ for(let i=0;i<8;i++) setTimeout(()=>{ throw new Error('Serie '+i); },0); }); await p.waitForTimeout(800);
 ok(gesendet.length===5, 'höchstens 5 Meldungen: '+gesendet.length);
 ok(gesendet[0] && /Testfehler/.test(gesendet[0].meldung) && !JSON.stringify(gesendet).includes('GEHEIM'), 'Schlüssel entfernt');
 ok(gesendet[0] && gesendet[0].seite==='/app/index.html', 'Seite ohne Parameter');
 await p.evaluate(()=>{ Promise.reject(new TypeError('Failed to fetch')); }); await p.waitForTimeout(300);
 ok(!gesendet.some(g=>/Failed to fetch/.test(g.meldung)), 'kein Netz wird nicht gemeldet');
 ({p,gesendet}=await seite(false)); await p.goto(''+(process.env.BASIS||'http://localhost:8765')+'/app/index.html'); await p.evaluate(()=>{ setTimeout(()=>{ throw new Error('lokal'); },0); }); await p.waitForTimeout(500);
 ok(gesendet.length===0, 'lokal wird nichts gemeldet');
 console.log(f?f+' FEHLER':'ALLES OK'); await b.close(); process.exit(f?1:0); })();
