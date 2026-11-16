// Supabase Edge Function „namen“: Funkel spricht das Geburtstagskind mit Namen an.
//
//   POST {aktion:'stand',    party_id}                                   Eltern (angemeldet): Texte, Wahl, übrige Neu-Erzeugungen
//   POST {aktion:'erzeugen', party_id, name, aussprache, alter, art}      Eltern: Sätze vertonen; art = 'neu' | 'betonung' | 'worte'
//   POST {aktion:'holen',    t, hash?}                                    Tablet mit Spiel-Link: Sätze als MP3 (Base64)
//
// Stimmen-Speicher über alle Partys (UNICORN-49, ADR-28): Schlüssel = Hash aus Stimme und gesprochenem Text.
// Ist der Text schon da (auch von einer anderen Familie), kostet er nichts. Je Text höchstens 3 Aufnahmen, beste zuerst.
// Vorlagen aus tour.json des Themas (namenSaetze, UNICORN-50). Erstes Einsprechen frei, danach 3× neu (UNICORN-51).
// Secret: ELEVENLABS_API_KEY oder ELEVENLABS (Dashboard → Edge Functions → Secrets; live heißt es ELEVENLABS, PBIM-27).
// Nur nötig, wenn ein Text noch nicht im Speicher ist.
// Verbrauch je Monat: stimm_verbrauch (STRAT-2), Tagesbremse über alle Partys: stimm_tag.
import { createClient } from 'npm:@supabase/supabase-js@2';
import './namen-kern.js';

const K = (globalThis as any).NamenKern;
const TAG_MAX = 60;   // neue Aufnahmen pro Tag über alle Partys (Schutz der Credits)
const STIMME = {
  voice_id: 'cgSgspJ2msm6clMCkdW9',           // Funkel, wie in stimmen/rollen.json
  modell: 'eleven_multilingual_v2',
  einstellungen: { stability: 0.6, similarity_boost: 0.8, style: 0.2, use_speaker_boost: true },
  vorweg: '<break time="0.3s" /> ',            // kurze Pause vorweg, sonst verschluckt das Tablet die erste Silbe
};
const SEITE = 'https://schatzweg.de/app/themen/';
const ERLAUBT = ['https://schatzweg.de', 'https://www.schatzweg.de', 'https://dafelix1888.github.io', 'https://schnitzeljagd-app.schatzsuche-app.workers.dev', 'http://localhost:8765'];

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
  const { data: p } = await admin.from('parties').select('id, owner, datum, thema').eq('id', partyId).maybeSingle();
  return p && p.owner === u.user.id ? p : null;
}

// Vorlagen aus der veröffentlichten tour.json (eine Quelle für App und Server), 10 Minuten gemerkt
const vorlagenMerk: Record<string, { v: any; bis: number }> = {};
async function vorlagen(thema: string) {
  const m = vorlagenMerk[thema];
  if (m && m.bis > Date.now()) return m.v;
  try {
    const r = await fetch(SEITE + encodeURIComponent(thema) + '/tour.json', { signal: AbortSignal.timeout(6000) });
    if (r.ok) {
      const v = (await r.json())?.namenSaetze;
      if (K.vorlagenOk(v)) { vorlagenMerk[thema] = { v, bis: Date.now() + 6e5 }; return v; }
    }
  } catch (_) { /* unten: alter Stand */ }
  return m ? m.v : null;
}

async function sprechen(text: string, key: string) {
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${STIMME.voice_id}?output_format=mp3_44100_64`, {
    method: 'POST',
    headers: { 'xi-api-key': key, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({ text: STIMME.vorweg + text, model_id: STIMME.modell, voice_settings: STIMME.einstellungen }),
  });
  if (!r.ok) throw new Error('ElevenLabs HTTP ' + r.status);
  return await r.arrayBuffer();
}
const pfad = (s: string, a: number) => `${s}/${a}.mp3`;
async function laden(s: string, a: number) {
  const { data, error } = await admin.storage.from('stimmen').download(pfad(s, a));
  if (error || !data) throw new Error('Datei fehlt ' + pfad(s, a));
  return b64(await data.arrayBuffer());
}
// Gespeicherte Sätze einer Party mit Ton (alte Einträge vor UNICORN-49 tragen b64 noch selbst)
async function mitTon(saetze: Record<string, any>) {
  const r: Record<string, any> = {};
  await Promise.all(Object.entries(saetze || {}).map(async ([k, v]: any) => {
    r[k] = { text: v.text, name: v.name || '', aussprache: v.aussprache || '', variante: v.variante || 0, b64: v.b64 || (v.schluessel ? await laden(v.schluessel, v.aufnahme) : '') };
  }));
  return r;
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
    // Das Tablet übernimmt diese Aufnahmen: sie wurden behalten → Wert +1 (beste kommt beim nächsten gleichen Namen zuerst)
    for (const v of Object.values(n.saetze || {}) as any[]) if (v.schluessel) await admin.rpc('stimm_cache_werten', { s: v.schluessel, a: v.aufnahme, d: 1, n: 1 });
    try { return antwort(200, { hash: n.hash, saetze: await mitTon(n.saetze) }); }
    catch (_) { return antwort(500, { fehler: 'Laden ging nicht.' }); }
  }

  if (typeof b.party_id !== 'string') return antwort(400, { fehler: 'party_id fehlt' });
  const p = await eigeneParty(req, b.party_id);
  if (!p) return antwort(401, { fehler: 'Nicht angemeldet oder fremde Party' });
  const { data: alt } = await admin.from('namen').select('erzeugungen, hash, saetze').eq('party_id', p.id).maybeSingle();
  const genutzt = alt?.erzeugungen || 0, altS = alt?.saetze || null;
  const stand = (extra: Record<string, unknown> = {}) => ({ max: K.MAX_NEU, uebrig: K.uebrig(genutzt), erstes: genutzt === 0, ...extra });
  const wahlAus = (s: any) => s ? Object.fromEntries(Object.entries(s).map(([k, v]: any) => [k, v.variante || 0])) : {};

  if (b.aktion === 'stand') {
    return antwort(200, stand({ hash: alt?.hash || null, texte: altS ? Object.fromEntries(Object.entries(altS).map(([k, v]: any) => [k, v.text])) : null,
      name: altS?.gruss?.name || '', aussprache: altS?.gruss?.aussprache || '', alter: altS?.alter?.alter || null, wahl: wahlAus(altS) }));
  }
  if (b.aktion !== 'erzeugen') return antwort(400, { fehler: 'aktion unbekannt' });

  const name = K.sauber(b.name), aussprache = K.sauber(b.aussprache), alter = K.alterZahl(b.alter);
  const f = K.pruefeName(name) || (aussprache ? K.pruefeName(aussprache, 'die Aussprache') : '');
  if (f) return antwort(400, { fehler: f });
  const v = await vorlagen(p.thema);
  if (!v) return antwort(503, { fehler: 'Die Sätze sind gerade nicht erreichbar. Bitte gleich noch einmal versuchen.' });
  const art = altS && (b.art === 'betonung' || b.art === 'worte') ? b.art : 'neu';
  const wahl = art === 'worte' ? K.naechsteWahl(v, wahlAus(altS)) : wahlAus(altS);
  const satz = K.bilden(v, { name, aussprache, alter, wahl });

  // Je Satz: Schlüssel, vorhandene Aufnahmen, Wahl der Aufnahme
  const plan: Record<string, any> = {};
  for (const [k, s] of Object.entries(satz) as [string, any][]) {
    const schl = await K.schluessel(STIMME, s.sprechen);
    const { data: auf } = await admin.from('stimm_cache').select('aufnahme, wert').eq('schluessel', schl);
    const aktuell = altS?.[k]?.schluessel === schl ? altS[k].aufnahme : null;
    plan[k] = { ...s, schluessel: schl, aktuell, ...K.aufnahmeWaehlen(auf || [], aktuell, art === 'betonung' && k !== 'alter') };
  }
  const gleich = altS && Object.keys(plan).length === Object.keys(altS).length &&
    Object.entries(plan).every(([k, x]: any) => altS[k]?.schluessel === x.schluessel && altS[k]?.aufnahme === x.aufnahme);
  if (gleich) {
    try { return antwort(200, stand({ hash: alt!.hash, saetze: await mitTon(altS), gleich: true })); }
    catch (_) { return antwort(500, { fehler: 'Laden ging nicht.' }); }
  }
  // Nur das Alter geändert (z. B. im Assistenten korrigiert): zählt nicht als Neu-Erzeugung
  const nurAlter = !!altS && Object.entries(plan).every(([k, x]: any) => k === 'alter' || (altS[k]?.schluessel === x.schluessel && altS[k]?.aufnahme === x.aufnahme));
  if (!nurAlter && genutzt > 0 && K.uebrig(genutzt) <= 0) return antwort(402, stand({ fehler: 'Alle ' + K.MAX_NEU + ' Mal neu erzeugen sind verbraucht.' }));

  // Nur was nicht im Speicher ist, geht an ElevenLabs
  const neu = Object.entries(plan).filter(([, x]: any) => x.neu) as [string, any][];
  const ton: Record<string, ArrayBuffer> = {};
  if (neu.length) {
    const key = Deno.env.get('ELEVENLABS_API_KEY') || Deno.env.get('ELEVENLABS');   // beide Namen (PBIM-27)
    if (!key) return antwort(503, { fehler: 'Die Stimme ist noch nicht eingerichtet.' });
    const { data: frei } = await admin.rpc('stimm_tag_buchen', { n: neu.length, grenze: TAG_MAX });
    if (frei !== true) return antwort(429, { fehler: 'Funkel ist für heute heiser. Bitte morgen noch einmal versuchen.' });
    try {
      await Promise.all(neu.map(async ([k, x]) => { ton[k] = await sprechen(x.sprechen, key); }));
    } catch (e) {
      return antwort(502, { fehler: 'Die Stimme hat gerade nicht geantwortet. Bitte gleich noch einmal versuchen.', grund: String(e) });
    }
    for (const [k, x] of neu) {
      const { error: e1 } = await admin.storage.from('stimmen').upload(pfad(x.schluessel, x.aufnahme), ton[k], { contentType: 'audio/mpeg', upsert: true });
      if (e1) return antwort(500, { fehler: 'Speichern ging nicht.' });
      await admin.from('stimm_cache').upsert({ schluessel: x.schluessel, aufnahme: x.aufnahme, text: x.sprechen, datei: pfad(x.schluessel, x.aufnahme) }, { onConflict: 'schluessel,aufnahme', ignoreDuplicates: true });
    }
    const zeichen = neu.reduce((s, [, x]) => s + x.sprechen.length, 0);
    try { await admin.rpc('stimm_verbrauch_zaehlen', { z: zeichen }); } catch (_) { /* Zählen darf das Ergebnis nicht verhindern */ }
  }
  // Andere Betonung: die weggeklickte Aufnahme verliert einen Punkt
  if (art === 'betonung') for (const x of Object.values(plan) as any[]) if (x.aktuell != null && x.aktuell !== x.aufnahme) await admin.rpc('stimm_cache_werten', { s: x.schluessel, a: x.aktuell, d: -1, n: 0 });

  const refs: Record<string, any> = {};
  for (const [k, x] of Object.entries(plan) as [string, any][]) {
    refs[k] = { text: x.zeigen, name: k === 'alter' ? '' : name, aussprache: k === 'alter' ? '' : aussprache, variante: x.variante, schluessel: x.schluessel, aufnahme: x.aufnahme, ...(k === 'alter' ? { alter } : {}) };
  }
  const hash = await sha(JSON.stringify(refs));
  const erzeugungen = nurAlter ? genutzt : genutzt + 1;
  const { error } = await admin.from('namen').upsert({ party_id: p.id, erzeugungen, hash, saetze: refs, aktualisiert: new Date().toISOString() });
  if (error) return antwort(500, { fehler: 'Speichern ging nicht.' });
  const saetze: Record<string, any> = {};
  try {
    for (const [k, r] of Object.entries(refs)) saetze[k] = { text: r.text, name: r.name, aussprache: r.aussprache, variante: r.variante, b64: ton[k] ? b64(ton[k]) : await laden(r.schluessel, r.aufnahme) };
  } catch (_) { return antwort(500, { fehler: 'Laden ging nicht.' }); }
  return antwort(200, { max: K.MAX_NEU, uebrig: K.uebrig(erzeugungen), erstes: false, hash, saetze, aus_speicher: Object.keys(plan).length - neu.length });
});
