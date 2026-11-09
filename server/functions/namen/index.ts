// Supabase Edge Function „namen“: Funkel spricht das Geburtstagskind mit Namen an.
//
//   POST {aktion:'stand',    party_id}                         Eltern (angemeldet): Texte und übrige Erzeugungen
//   POST {aktion:'erzeugen', party_id, name, aussprache, alter} Eltern: drei Sätze mit ElevenLabs vertonen
//   POST {aktion:'holen',    t, hash?}                          iPad mit Spiel-Link: Sätze als MP3 (Base64)
//
// Schutz der Credits: nur feste Vorlagen (Name und Alter werden eingesetzt), Name geprüft,
// höchstens MAX Erzeugungen je Party, gleicher Text kostet nichts.
// Secret: ELEVENLABS_API_KEY (Dashboard → Edge Functions → Secrets).
// Verbrauch je Monat: Tabelle stimm_verbrauch (Anzahl Erzeugungen, Zeichen), ohne Namen (UNICORN-8, STRAT-2).
import { createClient } from 'npm:@supabase/supabase-js@2';

const MAX = 3;
const STIMME = {
  voice_id: 'cgSgspJ2msm6clMCkdW9',           // Funkel, wie in stimmen/rollen.json
  modell: 'eleven_multilingual_v2',
  einstellungen: { stability: 0.6, similarity_boost: 0.8, style: 0.2, use_speaker_boost: true },
};
const ORDNUNG = ['', 'ersten', 'zweiten', 'dritten', 'vierten', 'fünften', 'sechsten', 'siebten', 'achten', 'neunten', 'zehnten', 'elften', 'zwölften'];
const NAME = /^[\p{L}][\p{L}\p{M} '’-]{0,29}$/u;
const ERLAUBT = ['https://schatzweg.de', 'https://www.schatzweg.de', 'https://dafelix1888.github.io', 'https://schnitzeljagd-app.schatzsuche-app.workers.dev', 'http://localhost:8765'];

function saetze(n: string, alter: number) {
  const a = ORDNUNG[alter] || '';
  return {
    gruss: `Und heute ist ein ganz besonderer Tag: ${n} hat Geburtstag! ${n}, heute bist du mein allerwichtigster Einhorn-Helfer.`,
    schatz: a ? `Alles Liebe zu deinem ${a} Geburtstag, ${n}! Ich wünsche dir ein Jahr, so bunt wie mein Regenbogen.`
              : `Alles Liebe zum Geburtstag, ${n}! Ich wünsche dir ein Jahr, so bunt wie mein Regenbogen.`,
    abschied: `Tschüss, ${n}! Feier schön weiter, du Geburtstags-Einhorn.`,
  };
}

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

function cors(req: Request) {
  const o = req.headers.get('Origin') || '';
  return {
    'Access-Control-Allow-Origin': ERLAUBT.includes(o) ? o : ERLAUBT[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    Vary: 'Origin',
  };
}
async function sha(s: string) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('').slice(0, 24);
}
function b64(buf: ArrayBuffer) {
  let s = ''; const u = new Uint8Array(buf);
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(s);
}
async function eigeneParty(req: Request, partyId: string) {
  const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!jwt) return null;
  const { data: u } = await admin.auth.getUser(jwt);
  if (!u?.user) return null;
  const { data: p } = await admin.from('parties').select('id, owner, datum').eq('id', partyId).maybeSingle();
  return p && p.owner === u.user.id ? p : null;
}
async function sprechen(text: string, key: string) {
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${STIMME.voice_id}?output_format=mp3_44100_64`, {
    method: 'POST',
    headers: { 'xi-api-key': key, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    // kurze Pause vorweg, sonst verschluckt das iPad die erste Silbe
    body: JSON.stringify({ text: '<break time="0.3s" /> ' + text, model_id: STIMME.modell, voice_settings: STIMME.einstellungen }),
  });
  if (!r.ok) throw new Error('ElevenLabs HTTP ' + r.status);
  return b64(await r.arrayBuffer());
}

Deno.serve(async (req) => {
  const h = { ...cors(req), 'Content-Type': 'application/json' };
  const antwort = (status: number, o: unknown) => new Response(JSON.stringify(o), { status, headers: h });
  if (req.method === 'OPTIONS') return new Response(null, { headers: h });
  if (req.method !== 'POST') return antwort(405, { fehler: 'POST erwartet' });
  let b: any;
  try { b = await req.json(); } catch { return antwort(400, { fehler: 'JSON erwartet' }); }

  if (b.aktion === 'holen') {
    if (typeof b.t !== 'string' || !/^[A-Za-z0-9_-]{22,64}$/.test(b.t)) return antwort(400, { fehler: 'Link ungültig' });
    const { data: l } = await admin.from('links').select('party_id, rolle, parties(datum)').eq('token', b.t).maybeSingle();
    const datum = (l as any)?.parties?.datum;
    if (!l || l.rolle !== 'spiel' || (datum && new Date(datum) < new Date(Date.now() - 31 * 864e5))) return antwort(404, { fehler: 'Link geht nicht' });
    const { data: n } = await admin.from('namen').select('hash, saetze').eq('party_id', l.party_id).maybeSingle();
    if (!n?.hash) return antwort(200, { hash: null });
    if (b.hash && b.hash === n.hash) return antwort(200, { hash: n.hash, gleich: true });
    return antwort(200, { hash: n.hash, saetze: n.saetze });
  }

  if (typeof b.party_id !== 'string') return antwort(400, { fehler: 'party_id fehlt' });
  const p = await eigeneParty(req, b.party_id);
  if (!p) return antwort(401, { fehler: 'Nicht angemeldet oder fremde Party' });
  const { data: alt } = await admin.from('namen').select('erzeugungen, hash, saetze').eq('party_id', p.id).maybeSingle();
  const genutzt = alt?.erzeugungen || 0;
  const texte = (s: any) => s ? Object.fromEntries(Object.entries(s).map(([k, v]: any) => [k, v.text])) : null;

  if (b.aktion === 'stand') {
    return antwort(200, { max: MAX, uebrig: Math.max(0, MAX - genutzt), hash: alt?.hash || null, texte: texte(alt?.saetze), name: alt?.saetze?.gruss?.name || '', aussprache: alt?.saetze?.gruss?.aussprache || '' });
  }
  if (b.aktion !== 'erzeugen') return antwort(400, { fehler: 'aktion unbekannt' });

  const name = String(b.name || '').trim().replace(/\s+/g, ' ');
  const aussprache = String(b.aussprache || '').trim().replace(/\s+/g, ' ');
  const alter = Math.round(Number(b.alter) || 0);
  if (!NAME.test(name)) return antwort(400, { fehler: 'Bitte nur einen Vornamen mit Buchstaben eingeben (höchstens 30 Zeichen).' });
  if (aussprache && !NAME.test(aussprache)) return antwort(400, { fehler: 'Die Aussprache bitte nur mit Buchstaben schreiben.' });
  const zeigen = saetze(name, alter), sprech = saetze(aussprache || name, alter);
  const hash = await sha(JSON.stringify([zeigen, sprech, STIMME]));
  if (alt?.hash === hash) return antwort(200, { max: MAX, uebrig: Math.max(0, MAX - genutzt), hash, saetze: alt.saetze, gleich: true });
  if (genutzt >= MAX) return antwort(402, { fehler: 'Alle ' + MAX + ' Erzeugungen sind verbraucht.', uebrig: 0 });
  const key = Deno.env.get('ELEVENLABS_API_KEY');
  if (!key) return antwort(503, { fehler: 'Die Stimme ist noch nicht eingerichtet.' });

  let neu: Record<string, { text: string; name: string; aussprache: string; b64: string }>;
  try {
    const teile = await Promise.all((Object.keys(zeigen) as (keyof typeof zeigen)[]).map(async (k) =>
      [k, { text: zeigen[k], name, aussprache, b64: await sprechen(sprech[k], key) }] as const));
    neu = Object.fromEntries(teile);
  } catch (e) {
    return antwort(502, { fehler: 'Die Stimme hat gerade nicht geantwortet. Bitte gleich noch einmal versuchen.', grund: String(e) });
  }
  const { error } = await admin.from('namen').upsert({ party_id: p.id, erzeugungen: genutzt + 1, hash, saetze: neu, aktualisiert: new Date().toISOString() });
  if (error) return antwort(500, { fehler: 'Speichern ging nicht.' });
  // Verbrauch je Monat zählen (Schwelle STRAT-2): nur Anzahl und gesprochene Zeichen, kein Name, keine Party
  const zeichen = Object.values(sprech).reduce((s, t) => s + t.length, 0);
  try { await admin.rpc('stimm_verbrauch_zaehlen', { z: zeichen }); } catch (_) { /* Zählen darf das Ergebnis nicht verhindern */ }
  return antwort(200, { max: MAX, uebrig: Math.max(0, MAX - genutzt - 1), hash, saetze: neu });
});
