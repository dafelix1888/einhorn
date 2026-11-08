// Suchmaschinen: öffentliche Seiten offen, Seiten mit geheimen Links gesperrt.
const fs=require('fs'), path=require('path'); const R=path.join(__dirname,'..');
let fehler=0; const ok=(c,t)=>{ console.log((c?'ok   ':'FEHLER ')+t); if(!c) fehler++; };
const robots=fs.readFileSync(path.join(R,'robots.txt'),'utf8'), kopf=fs.readFileSync(path.join(R,'_headers'),'utf8');
const sitemap=fs.readFileSync(path.join(R,'sitemap.xml'),'utf8');
ok(!/^Disallow:\s*\/\s*$/m.test(robots), 'robots.txt sperrt nicht mehr alles');
for(const s of ['spiel','party','einladung','danke','vorausgeher','bereit','druck']){
  ok(robots.includes('Disallow: /app/'+s+'.html'), s+' in robots.txt gesperrt');
  ok(new RegExp('/app/'+s+'\\.html\\n  X-Robots-Tag: noindex').test(kopf), s+' mit noindex-Header');
}
ok(!/^\/\*\n(?:  .*\n)*  X-Robots-Tag/m.test(kopf), 'kein noindex für alle Seiten');
ok(/Sitemap: https:\/\/schatzweg\.de\/sitemap\.xml/.test(robots) && sitemap.includes('https://schatzweg.de/app/landing.html'), 'Sitemap mit Landingpage');
const ss=[...sitemap.matchAll(/<loc>https:\/\/schatzweg\.de\/(.*?)<\/loc>/g)].map(m=>m[1]);
ok(ss.every(u=>fs.existsSync(path.join(R,u.endsWith('/')?u+'index.html':u))), 'alle Sitemap-Seiten gibt es');
const start=fs.readFileSync(path.join(R,'index.html'),'utf8');
const bild=(start.match(/og:image" content="https:\/\/schatzweg\.de\/(.*?)"/)||[])[1];
ok(bild && fs.existsSync(path.join(R,bild)), 'Startadresse hat Vorschaubild ('+bild+')');
ok(/og:title/.test(start) && /rel="canonical"/.test(start), 'Startadresse mit Titel und Canonical');
for(const s of ['spiel','party','einladung','danke','vorausgeher','bereit'])
  ok(/<meta name="robots" content="noindex">/.test(fs.readFileSync(path.join(R,'app',s+'.html'),'utf8')), s+' mit noindex im Kopf (auch für GitHub Pages)');
// Themenseiten von Marketer (UNICORN-24): alle Pfade auf eigene Dateien gibt es, nichts gesperrt
const ideen=fs.readdirSync(path.join(R,'ideen')).filter(d=>d.endsWith('.html'));
ok(ideen.length===9, '9 Themenseiten unter /ideen/');
ok(!/Disallow:\s*\/ideen/.test(robots), 'robots.txt sperrt /ideen/ nicht');
const fehlend=[];
for(const d of ideen){ const h=fs.readFileSync(path.join(R,'ideen',d),'utf8');
  for(const m of h.matchAll(/(?:href|src|data-src)="(\/[^"#?]*|[a-z0-9-]+\.html)/g)){ let u=m[1]; let f=u.startsWith('/')?path.join(R,u):path.join(R,'ideen',u); if(u.endsWith('/')) f=path.join(f,'index.html'); if(!fs.existsSync(f)) fehlend.push(d+': '+u); }
  ok(sitemap.includes('https://schatzweg.de/ideen/'+(d==='index.html'?'':d)+'<'), 'Sitemap enthält ideen/'+d); }
ok(fehlend.length===0, 'Themenseiten verweisen nur auf vorhandene Dateien '+fehlend.slice(0,5).join(', '));
console.log(fehler?fehler+' FEHLER':'ALLES OK'); process.exit(fehler?1:0);
