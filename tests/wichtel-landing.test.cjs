// Wichtel Bommi, Landingpage (UNICORN-148, MAR-75): Die Seite von Marketer liegt unverändert unter /wichtel/,
// das Vorschaubild zum Teilen ist da, am Handy scrollt nichts seitlich, alle Links zeigen auf vorhandene Dateien.
// Bis zum Start (UNICORN-146) bleibt /wichtel/ für Suchmaschinen gesperrt.
const fs=require('fs'), path=require('path'), crypto=require('crypto');
const { chromium } = require('playwright');
const R=path.join(__dirname,'..');
let fehler=0; const ok=(c,t)=>{ console.log((c?'ok   ':'FEHLER ')+t); if(!c) fehler++; };

const seite=fs.readFileSync(path.join(R,'wichtel','index.html'));
ok(crypto.createHash('sha256').update(seite).digest('hex')==='1d5d9bc69b39d537374c67cb683d31cb70f8cea6f8aee3eb3cfbd166d0ac48e7', 'wichtel/index.html ist die Fassung von Marketer (MAR-75), unverändert');

const bild=fs.readFileSync(path.join(R,'wichtel','teilen.jpg'));
ok(bild[0]===0xFF && bild[1]===0xD8, 'teilen.jpg ist ein JPEG');
// Breite und Höhe aus dem SOF-Block lesen
let b=0,h=0; for(let i=2;i<bild.length-9;){ if(bild[i]!==0xFF){ i++; continue; } const m=bild[i+1], l=bild.readUInt16BE(i+2); if(m>=0xC0&&m<=0xC2){ h=bild.readUInt16BE(i+5); b=bild.readUInt16BE(i+7); break; } i+=2+l; }
ok(b===1200 && h===630, 'teilen.jpg ist 1200 × 630 ('+b+' × '+h+')');
ok(bild.length<300*1024, 'teilen.jpg ist kleiner als 300 KB');

// Alle eigenen Pfade der Seite gibt es
const html=seite.toString('utf8');
const pfade=[...html.matchAll(/(?:href|src|poster)="(\/[^"?#]*)/g)].map(m=>m[1]).filter(p=>p!=='/app/landing');
pfade.forEach(p=>ok(fs.existsSync(path.join(R,p)), 'Datei da: '+p));

// Bis UNICORN-146 gesperrt
ok(/Disallow: \/wichtel/.test(fs.readFileSync(path.join(R,'robots.txt'),'utf8')), 'robots.txt sperrt /wichtel bis zum Start');
ok(/\/wichtel\/\*\s+X-Robots-Tag: noindex/.test(fs.readFileSync(path.join(R,'_headers'),'utf8')), '_headers: noindex für /wichtel/ bis zum Start');

(async()=>{
  const br=await chromium.launch();
  const p=await br.newPage({viewport:{width:360,height:740}});
  await p.route(/supabase\.co/, r=>r.fulfill({status:200, contentType:'text/javascript', body:''}));
  await p.goto('http://localhost:8765/wichtel/');
  ok(await p.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth), 'Handy 360 px: kein seitliches Scrollen');
  ok(await p.locator('a.cta').first().isVisible(), 'Knopf „Los geht\'s“ sichtbar');
  await p.goto('http://localhost:8765/wichtel/?utm_source=whatsapp&utm_campaign=familien');
  ok((await p.locator('a.cta').first().getAttribute('href'))==='/app/wichtel.html?utm_source=whatsapp&utm_campaign=familien', 'Herkunft wird an den Wichtel-Bereich weitergegeben');
  await br.close();
  process.exit(fehler?1:0);
})().catch(e=>{ console.error(e); process.exit(1); });
