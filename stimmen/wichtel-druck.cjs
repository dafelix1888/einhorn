// UNICORN-137: erzeugt app/themen/wichtel/druckvorlagen.pdf aus druckvorlagen.html.
// Aufruf: python3 -m http.server 8765 &  node stimmen/wichtel-druck.cjs
const { chromium } = require('playwright');
const path=require('path');
const B=process.env.BASIS||'http://localhost:8765';
(async()=>{
  const b=await chromium.launch(), p=await b.newPage();
  await p.goto(B+'/app/themen/wichtel/druckvorlagen.html');
  await p.waitForSelector('body[data-fertig="1"]');
  await p.pdf({ path:path.join(__dirname,'..','app','themen','wichtel','druckvorlagen.pdf'), format:'A4', printBackground:true, preferCSSPageSize:true });
  await b.close(); console.log('druckvorlagen.pdf erzeugt');
})();
