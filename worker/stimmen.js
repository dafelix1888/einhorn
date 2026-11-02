// Cloudflare Worker: POST /sprechen {thema, rolle, text} → audio/mpeg von ElevenLabs.
// Schutz gegen Missbrauch der Credits: nur bekannte Themen und Rollen, nur kurze Sätze,
// nur Sätze, die zu einer Ansage-Vorlage des Themas passen, und alles wird zwischengespeichert,
// damit derselbe Satz nur einmal etwas kostet.
const THEMEN = {
  einhorn: {
    modell: 'eleven_multilingual_v2',
    rollen: {
      spiegel: { voice_id: 'JBFqnCBsd6RMkjVDRZzb', einstellungen: { stability: 0.5, similarity_boost: 0.75, style: 0.4, use_speaker_boost: true } },
    },
    // aus tour.json: stationen[].ansage; {an}/{zu} wird durch einen Ortsnamen ersetzt
    vorlagen: [
      'Die Hufspuren führen {zu}.', 'Die Regenbogenbrücke wartet {an}.', 'Der Zaun beginnt {an}.',
      'Die Kreuzung ist {an}.', 'Der Wolkenberg ist {an}.', 'Die Parkbank steht {an}.',
    ],
  },
};
const ORT = "(?:am|an der|im|in den|zum|zur|bei) [\\p{L}\\p{N} .'\\-]{2,60}";

function passt(thema, text) {
  return thema.vorlagen.some((v) => {
    const muster = v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\{(an|zu)\\\}/g, ORT);
    return new RegExp('^' + muster + '$', 'u').test(text);
  });
}
function cors(req, env) {
  const o = req.headers.get('Origin') || '';
  const ok = (env.ERLAUBTE_URSPRUENGE || '').split(',').map((s) => s.trim()).includes(o);
  return { 'Access-Control-Allow-Origin': ok ? o : 'null', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', Vary: 'Origin' };
}
async function hash(s) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

export default {
  async fetch(req, env, ctx) {
    const h = cors(req, env);
    if (req.method === 'OPTIONS') return new Response(null, { headers: h });
    const url = new URL(req.url);
    if (req.method !== 'POST' || url.pathname !== '/sprechen') return new Response('Nicht gefunden', { status: 404, headers: h });
    if (h['Access-Control-Allow-Origin'] === 'null') return new Response('Herkunft nicht erlaubt', { status: 403, headers: h });
    let b;
    try { b = await req.json(); } catch { return new Response('JSON erwartet', { status: 400, headers: h }); }
    const thema = THEMEN[b.thema], rolle = thema && thema.rollen[b.rolle], text = String(b.text || '').trim();
    if (!thema || !rolle) return new Response('Thema oder Rolle unbekannt', { status: 400, headers: h });
    if (text.length > 140 || !passt(thema, text)) return new Response('Satz nicht erlaubt', { status: 400, headers: h });

    const schluessel = await hash(JSON.stringify([b.thema, b.rolle, text, rolle.voice_id, rolle.einstellungen, thema.modell]));
    const cacheUrl = new URL('https://cache.schnitzeljagd/' + schluessel + '.mp3');
    const cache = caches.default;
    const alt = await cache.match(cacheUrl);
    if (alt) return new Response(alt.body, { headers: { ...h, 'Content-Type': 'audio/mpeg', 'X-Cache': 'hit' } });

    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${rolle.voice_id}?output_format=mp3_44100_64`, {
      method: 'POST',
      headers: { 'xi-api-key': env.ELEVENLABS_API_KEY, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
      body: JSON.stringify({ text, model_id: thema.modell, voice_settings: rolle.einstellungen }),
    });
    if (!r.ok) return new Response('ElevenLabs: HTTP ' + r.status, { status: 502, headers: h });
    const mp3 = await r.arrayBuffer();
    ctx.waitUntil(cache.put(cacheUrl, new Response(mp3, { headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'public, max-age=31536000' } })));
    return new Response(mp3, { headers: { ...h, 'Content-Type': 'audio/mpeg', 'X-Cache': 'miss' } });
  },
};
