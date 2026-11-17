// Startet alle *.test.cjs nacheinander und meldet, welche fehlschlagen.
// Lokal: im Repo `python3 -m http.server 8765` starten, dann `node tests/alle.cjs`.
const { execFileSync } = require('child_process'), fs=require('fs'), path=require('path');
const tests=fs.readdirSync(__dirname).filter(n=>n.endsWith('.test.cjs')).sort();
let rot=[];
for(const t of tests){
  console.log('\n=== '+t);
  const lang={'sprecher-ablauf.test.cjs':480000}[t]||240000;   // spielt die ganze Tour dreimal (UNICORN-126)
  try{ execFileSync(process.execPath, [path.join(__dirname,t)], {stdio:'inherit', timeout:lang}); }
  catch(e){ rot.push(t); }
}
console.log('\n'+(rot.length ? 'Fehlgeschlagen: '+rot.join(', ') : 'Alle '+tests.length+' Tests grün'));
process.exit(rot.length?1:0);
