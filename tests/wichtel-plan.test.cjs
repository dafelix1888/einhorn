// Wichtel Bommi (UNICORN-141): Pakete, Starttag, „bestellen bis“ und „basteln bis“ stimmen. Läuft ohne Browser.
const fs=require('fs'), path=require('path');
const WK=require('../app/wichtel-kern.js');
const W=path.join(__dirname,'..','app','themen','wichtel');
const M=JSON.parse(fs.readFileSync(path.join(W,'material.json'),'utf8'));
const G=JSON.parse(fs.readFileSync(path.join(W,'geschichten.json'),'utf8'));
let fehler=0; const ok=(c,t)=>{ console.log((c?'ok   ':'FEHLER ')+t); if(!c) fehler++; };
const gleich=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const tage=p=>p.zeilen.map(z=>z.datum.slice(5));
const wahl=(paket, o={})=>Object.assign({ nr:WK.paket(M,paket), szenario:'gemischt', erster:'2026-12-01', letzter:'2026-12-22', sonntage:paket==='advent', eigene:{} }, o);

// Grundlagen
ok(WK.saison('2026-11-21')===2026 && WK.saison('2026-12-28')===2027, 'Saison: bis Heiligabend dieses Jahr');
ok(gleich(WK.advent(2026), ['2026-11-29','2026-12-06','2026-12-13','2026-12-20']), 'Adventssonntage 2026');
ok(gleich(WK.advent(2027), ['2027-11-28','2027-12-05','2027-12-12','2027-12-19']), 'Adventssonntage 2027');
ok(WK.kurz('2026-12-01')==='Di 1.12.', 'Datum kurz: Di 1.12.');
ok(gleich(WK.auswahl([3]), [1,3,8]), 'Nr. 1 und Nr. 8 sind immer dabei');
for(const k of Object.keys(M.pakete)) ok(M.pakete[k].nr[0]===1 && M.pakete[k].nr.slice(-1)[0]===8, 'Paket '+k+' hat Anfang und Schluss');
ok(M.pakete.klein.nr.length===3 && M.pakete.advent.nr.length===4 && M.pakete.ganz.nr.length===8, 'Pakete: 3, 4 und 8 Geschichten');
ok(WK.welchesPaket(M,[8,2,1])==='klein' && WK.welchesPaket(M,[1,3,8])===null, 'Auswahl erkennt Paket oder eigene Auswahl');

// Ganz: Tage aus STRAT-41, Abschnitt 4
const ganz=WK.plan(M,G,wahl('ganz'),'2026-11-21');
ok(gleich(tage(ganz), ['12-01','12-04','12-07','12-10','12-13','12-16','12-19','12-22']), 'Ganz: 1., 4., 7., 10., 13., 16., 19., 22. Dezember');
ok(gleich(ganz.zeilen.map(z=>z.nr), [1,2,3,4,5,6,7,8]), 'Ganz: Reihenfolge 1 bis 8');
ok(ganz.zeilen.every(z=>z.titel && !/^Geschichte \d/.test(z.titel)), 'Titel kommen aus geschichten.json');
ok(ganz.zeilen.every(z=>z.bastelnBis===WK.plus(z.datum,-1)), 'Basteln bis: immer der Vorabend');
ok(ganz.zeilen.every(z=>z.kaufen.length ? z.bestellenBis===WK.plus(z.datum,-4) : z.bestellenBis===null), 'Bestellen bis: 4 Tage vorher, nur wenn etwas gekauft wird');
const g1=ganz.zeilen[0];
ok(g1.bestellenBis==='2026-11-27' && g1.kaufen.map(a=>a.id).join()==='tuer,bommel,papier', 'Gemischt: Tür, Bommel und Papier bis Fr 27.11. bestellen');
ok(ganz.zeilen.find(z=>z.nr===8).kaufen.map(a=>a.id).join()==='lichterkette', 'Gemischt: Lichterkette für Nr. 8, Ski selbst gemacht');
ok(ganz.zeilen.find(z=>z.nr===5).kaufen.length===0 && /Tür-Set/.test(ganz.zeilen.find(z=>z.nr===5).basteln.join()), 'Nr. 5: Baustelle kommt aus dem Tür-Set');
ok(ganz.zeilen.find(z=>z.nr===2).bestellenBis===null, 'Gemischt: Keksdose wird gebastelt, nichts zu bestellen');
ok(ganz.zeilen.every(z=>z.basteln.some(b=>/Brief/.test(b))), 'Jede Geschichte: Brief von Oma Mooswinkel ausdrucken');
ok(!ganz.zeilen.some(z=>z.knapp), 'Am 21. November ist noch nichts knapp');

// Klein und Advent
ok(gleich(tage(WK.plan(M,G,wahl('klein'),'2026-11-21')), ['12-01','12-12','12-22']), 'Klein: 1., 12. und 22. Dezember');
const adv=WK.plan(M,G,wahl('advent'),'2026-11-21');
ok(gleich(tage(adv), ['12-01','12-06','12-13','12-20']), 'Advent: Einzug am 1.12., dann die Adventssonntage');
ok(gleich(adv.zeilen.map(z=>z.nr), [1,2,5,8]), 'Advent: Nr. 1, 2, 5, 8');
ok(adv.zeilen[3].bestellenBis==='2026-12-16', 'Advent: Lichterkette bis Mi 16.12. bestellen');
ok(gleich(tage(WK.plan(M,G,wahl('advent',{erster:'2026-11-29'}),'2026-11-21')), ['11-29','12-06','12-13','12-20']), 'Advent ab 1. Advent: alle vier Sonntage');

// Geänderter Starttag
const spaet=WK.plan(M,G,wahl('ganz',{erster:'2026-12-04'}),'2026-11-21');
ok(spaet.zeilen[0].datum==='2026-12-04' && spaet.zeilen[7].datum==='2026-12-22', 'Starttag 4.12.: erster und letzter Tag stimmen');
ok(spaet.zeilen[0].bestellenBis==='2026-11-30', 'Starttag 4.12.: bestellen bis Mo 30.11.');
ok(spaet.zeilen.every((z,i)=>i===0 || z.datum>spaet.zeilen[i-1].datum), 'Starttag 4.12.: jeden Tag nur eine Geschichte');
const frueh=WK.plan(M,G,wahl('klein',{erster:'2026-11-27',letzter:'2026-12-10'}),'2026-11-26');
ok(frueh.zeilen[0].knapp===true, 'Bestelltag vorbei: als knapp markiert');

// Einzelner Tag geändert
const eigen=WK.plan(M,G,wahl('ganz',{eigene:{3:'2026-12-20'}}),'2026-11-21');
ok(eigen.zeilen.find(z=>z.nr===3).datum==='2026-12-20' && eigen.zeilen.find(z=>z.nr===3).eigen, 'Einzelner Tag lässt sich ändern');
ok(eigen.zeilen.map(z=>z.nr).indexOf(3)===6, 'Geänderter Tag sortiert sich ein');

// Szenarien und Summen (STRAT-41: kaufen ca. 66 bis 74 €, gemischt ca. 23 bis 32 €, selbst 0 €)
const s=k=>WK.plan(M,G,wahl('ganz',{szenario:k}),null);
ok(s('kaufen').summe>=60 && s('kaufen').summe<=74, 'Alles kaufen: '+s('kaufen').summe+' €');
ok(s('gemischt').summe>=20 && s('gemischt').summe<=32, 'Gemischt: '+s('gemischt').summe+' €');
ok(s('selbst').summe===0 && s('selbst').zeilen.every(z=>z.bestellenBis===null), 'Alles selbst: 0 €, nichts zu bestellen');
ok(M.artikel.every(a=>a.selbst), 'Jeder Artikel hat einen Ersatz zum Selbermachen');
ok(M.artikel.every(a=>a.nr==='alle' || G.geschichten.some(g=>g.nr===a.nr)), 'Jeder Artikel gehört zu einer Geschichte');

// Seite: nur über den direkten Link, nicht für Suchmaschinen
const R=path.join(__dirname,'..');
const seite=fs.readFileSync(path.join(R,'app','wichtel.html'),'utf8');
ok(/name="robots" content="noindex/.test(seite), 'Seite hat noindex');
ok(/Disallow: \/wichtel/.test(fs.readFileSync(path.join(R,'robots.txt'),'utf8')), 'robots.txt sperrt /wichtel');
ok(/app\/wichtel\.html/.test(fs.readFileSync(path.join(R,'wichtel','index.html'),'utf8')), '/wichtel leitet zur Seite');
const verlinkt=fs.readdirSync(path.join(R,'app')).filter(f=>f.endsWith('.html') && f!=='wichtel.html').filter(f=>/wichtel/i.test(fs.readFileSync(path.join(R,'app',f),'utf8')));
ok(!verlinkt.length, 'Keine andere Seite verlinkt Wichtel '+verlinkt.join(', '));
ok(!/wichtel/.test(fs.readFileSync(path.join(R,'sitemap.xml'),'utf8')), 'Nicht in der Sitemap');

if(fehler){ console.log(fehler+' Fehler'); process.exit(1); } else console.log('Alles gut.');
