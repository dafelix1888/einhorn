// Navigation mit Offline-Speicher wie bei Cloudflare: /app/index.html leitet auf /app/ um (PBIM-19).
// Eigener kleiner Server, damit die Umleitung wie live passiert.
const { chromium } = require('playwright');
const http=require('http'), fs=require('fs'), path=require('path');
const R=path.join(__dirname,'..');
let fehler=0; const ok=(c,t)=>{ console.log((c?'ok   ':'FEHLER ')+t); if(!c) fehler++; };
const typ={'.html':'text/html; charset=utf-8','.js':'text/javascript','.json':'application/json','.css':'text/css','.svg':'image/svg+xml','.woff':'font/woff','.webp':'image/webp','.mp3':'audio/mpeg','.jpg':'image/jpeg','.png':'image/png'};
const server=http.createServer((q,a)=>{
  let u=decodeURIComponent(q.url.split('?')[0]);
  if(u.endsWith('/index.html')){ a.writeHead(307,{Location:u.slice(0,-10)}); return a.end(); }   // wie Cloudflare auto-trailing-slash
  let f=path.join(R,u); if(u.endsWith('/')) f=path.join(f,'index.html');
  if(!f.startsWith(R) || !fs.existsSync(f) || fs.statSync(f).isDirectory()){ a.writeHead(404); return a.end(); }
  a.writeHead(200,{'Content-Type':typ[path.extname(f)]||'application/octet-stream'}); fs.createReadStream(f).pipe(a);
});
(async()=>{
  // keine Links mehr auf index.html (außer Marketers Landingpage)
  const dateien=fs.readdirSync(path.join(R,'app')).filter(d=>/\.(html|js)$/.test(d) && d!=='landing.html' && d!=='sw.js');
  const treffer=dateien.filter(d=>/href=["']index\.html|['"]index\.html#/.test(fs.readFileSync(path.join(R,'app',d),'utf8')));
  ok(treffer.length===0, 'keine Links auf index.html '+treffer.join(', '));
  await new Promise(r=>server.listen(8766,r));
  const B='http://localhost:8766/app/';
  const b=await chromium.launch(), c=await b.newContext({viewport:{width:393,height:852}}), errs=[];
  await c.route(/^https?:\/\/(?!localhost)/, r=>r.abort());
  const p=await c.newPage(); p.on('pageerror',e=>errs.push(e.message));
  await p.goto(B);   // live registriert die App den Offline-Speicher nur unter https, hier von Hand
  await p.evaluate(()=>navigator.serviceWorker.register('sw.js').then(()=>navigator.serviceWorker.ready));
  await p.reload();
  await p.waitForFunction(()=>!!navigator.serviceWorker.controller, null, {timeout:15000}).catch(()=>{});
  ok(await p.evaluate(()=>!!navigator.serviceWorker.controller), 'Offline-Speicher aktiv');
  let fehlgeschlagen=null;
  try{ const r=await p.goto(B+'index.html'); fehlgeschlagen = r ? null : 'keine Antwort'; }catch(e){ fehlgeschlagen=e.message.split('\n')[0]; }
  ok(!fehlgeschlagen, 'alte Adresse app/index.html öffnet trotz Umleitung '+(fehlgeschlagen||''));
  ok(/Schatzweg|Abenteuer/.test(await p.title()+await p.locator('body').innerText().catch(()=>'')), 'Übersicht wird angezeigt');
  // Seiten mit Link „Alle Abenteuer“ (./): Party-Übersicht braucht eine Party
  await p.evaluate(()=>localStorage.setItem('sj.party.einhorn', JSON.stringify({format:1,thema:'einhorn',kind:{name:'Mia',alter:5},datum:'2030-06-01',start:'15:00',kinder:6,helfer:2,vorausgeher:true,ort:'draussen',planB:true,ausdrucke:true,erledigt:{},einkauf:{}})));
  for(const s of ['party.html?thema=einhorn']){
    await p.goto(B+s); await p.waitForSelector('a[href="./"]', {timeout:8000}).catch(()=>{});
    const z=p.locator('a[href="./"], a[href^="./#"]').first();
    ok(await z.count()>0, s+': Link „Alle Abenteuer“ vorhanden');
    if(await z.count()){
      let f=null; try{ await Promise.all([p.waitForURL(/\/app\/(#.*)?$/, {timeout:10000}), z.evaluate(a=>a.click())]); await p.waitForSelector('body'); }catch(e){ f=e.message.split('\n')[0]; }
      ok(!f, s+' → Übersicht ohne Fehler '+(f||''));
    }
  }
  ok(errs.length===0, 'keine Seitenfehler '+errs.join(' | '));
  console.log(fehler?fehler+' FEHLER':'ALLES OK'); await b.close(); server.close(); process.exit(fehler?1:0);
})();
