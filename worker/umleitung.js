// Cloudflare Worker „Umleitung“: alle Nebenadressen dauerhaft auf https://schatzweg.de
// (www.schatzweg.de, die Tippfehler-Domain schatzsweg.de und www.schatzsweg.de). Pfad und Parameter bleiben erhalten,
// damit auch geteilte Links mit ?k=… funktionieren.
export default {
  fetch(req) {
    const u = new URL(req.url);
    return Response.redirect('https://schatzweg.de' + u.pathname + u.search + u.hash, 301);
  },
};
