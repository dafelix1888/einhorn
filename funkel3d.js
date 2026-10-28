// Funkel in 3D: ein rundliches Comic-Einhorn, das am Spiegelrand hereinlugt.
// Steuerung von außen über window.Funkel3D:
//   start(element)       Funkel in einem Element anzeigen (legt ein Canvas hinein)
//   sprich(pegel)        Funkel spricht; pegel() liefert die aktuelle Lautstärke 0…1
//   hoeren()             ein anderer spricht (der Zauberspiegel); Funkel schaut zu ihm
//   still()              niemand spricht
//   freude()             kleiner Freudenhüpfer
import * as THREE from './three.module.min.js';

const FARBEN = {
  fell: 0xFFF7FC, schnauze: 0xFFE4F0, rosa: 0xFF9EC7, nuester: 0xD9668F,
  maul: 0x6E2346, zunge: 0xFF7AA8, auge: 0x2A1B4D, linie: 0x4E22A0,
  gold: 0xF2C14E, goldDunkel: 0xC8922A,
  maehne: [0xE5484D, 0xF59E0B, 0xF2C94C, 0x3FB950, 0x3B82F6, 0x8B5CF6]
};

function toonVerlauf() {
  const d = new Uint8Array([90, 170, 235, 255]);
  const t = new THREE.DataTexture(d, d.length, 1, THREE.RedFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true;
  return t;
}

function baueFunkel() {
  const verlauf = toonVerlauf();
  const stoff = (farbe, extra) => new THREE.MeshToonMaterial(Object.assign({ color: farbe, gradientMap: verlauf }, extra || {}));
  const linieStoff = new THREE.MeshBasicMaterial({ color: FARBEN.linie, side: THREE.BackSide });
  const kugel = (r, farbe, seg) => new THREE.Mesh(new THREE.SphereGeometry(r, seg || 40, Math.round((seg || 40) * 0.75)), stoff(farbe));
  function umriss(mesh, dicke) {             // Comic-Kontur: dieselbe Form, etwas größer, von innen gezeichnet
    const u = new THREE.Mesh(mesh.geometry, linieStoff);
    u.scale.setScalar(1 + (dicke || 0.045)); u.renderOrder = -1;
    mesh.add(u); return mesh;
  }

  const funkel = new THREE.Group();          // ganze Büste
  const hals = new THREE.Group(); funkel.add(hals);
  const kopf = new THREE.Group(); kopf.position.set(0, 0.35, 0); hals.add(kopf);

  // Hals
  const halsForm = umriss(new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.98, 1.8, 40), stoff(FARBEN.fell)), 0.05);
  halsForm.position.set(0, -1.1, -0.3); halsForm.rotation.x = 0.3; hals.add(halsForm);

  // Schädel
  const schaedel = umriss(kugel(1, FARBEN.fell, 56));
  schaedel.scale.set(0.98, 0.92, 1); kopf.add(schaedel);

  // Schnauze (oben) und Unterkiefer (beweglich)
  const schnauze = umriss(kugel(0.6, FARBEN.schnauze, 48));
  schnauze.scale.set(1.05, 0.72, 1.0); schnauze.position.set(0, -0.36, 0.66); kopf.add(schnauze);
  for (const s of [-1, 1]) {
    const n = kugel(0.075, FARBEN.nuester, 20); n.scale.set(1, 0.6, 0.5);
    n.position.set(0.2 * s, -0.25, 1.24); n.rotation.z = 0.4 * s; kopf.add(n);
  }
  const maulInnen = kugel(0.42, FARBEN.maul, 32);
  maulInnen.scale.set(1.05, 0.55, 0.9); maulInnen.position.set(0, -0.6, 0.72); kopf.add(maulInnen);
  const zunge = kugel(0.22, FARBEN.zunge, 24);
  zunge.scale.set(1.3, 0.4, 1); zunge.position.set(0, -0.72, 0.9); kopf.add(zunge);

  const kiefer = new THREE.Group(); kiefer.position.set(0, -0.5, 0.25); kopf.add(kiefer);
  const unterkiefer = umriss(kugel(0.46, FARBEN.schnauze, 40));
  unterkiefer.scale.set(1.02, 0.42, 1.0); unterkiefer.position.set(0, -0.2, 0.5); kiefer.add(unterkiefer);

  // Wangen
  for (const s of [-1, 1]) {
    const w = new THREE.Mesh(new THREE.SphereGeometry(0.17, 24, 18), new THREE.MeshBasicMaterial({ color: FARBEN.rosa, transparent: true, opacity: 0.55 }));
    w.scale.set(1.2, 0.75, 0.35); w.position.set(0.6 * s, -0.22, 0.74); w.lookAt(w.position.clone().multiplyScalar(2)); kopf.add(w);
  }

  // Augen
  const augen = [];
  for (const s of [-1, 1]) {
    const auge = new THREE.Group(); auge.position.set(0.4 * s, 0.13, 0.78); auge.rotation.y = 0.32 * s; kopf.add(auge);
    const weiss = umriss(kugel(0.28, 0xFFFFFF, 32), 0.06); weiss.scale.set(0.95, 1.15, 0.55); auge.add(weiss);
    const pupille = new THREE.Mesh(new THREE.SphereGeometry(0.19, 32, 24), new THREE.MeshBasicMaterial({ color: FARBEN.auge }));
    pupille.scale.set(0.95, 1.12, 0.5); pupille.position.set(0, -0.01, 0.07); auge.add(pupille);
    const glanz = new THREE.Mesh(new THREE.SphereGeometry(0.055, 16, 12), new THREE.MeshBasicMaterial({ color: 0xFFFFFF }));
    glanz.position.set(-0.05, 0.07, 0.16); auge.add(glanz);
    const glanz2 = glanz.clone(); glanz2.scale.setScalar(0.5); glanz2.position.set(0.05, -0.06, 0.16); auge.add(glanz2);
    for (let i = 0; i < 3; i++) {             // Wimpern
      const w = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.14, 8), new THREE.MeshBasicMaterial({ color: FARBEN.auge }));
      const a = (0.35 + i * 0.32) * s;
      w.position.set(Math.sin(a) * 0.24, 0.26 + Math.cos(a) * 0.04, 0.02); w.rotation.z = -a * 0.9; auge.add(w);
    }
    augen.push(auge);
  }

  // Ohren
  const ohren = [];
  for (const s of [-1, 1]) {
    const ohr = new THREE.Group(); ohr.position.set(0.52 * s, 0.78, -0.12); ohr.rotation.set(-0.15, 0, -0.42 * s); kopf.add(ohr);
    const aussen = umriss(new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.55, 24), stoff(FARBEN.fell)), 0.08); aussen.position.y = 0.22; ohr.add(aussen);
    const innen = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.38, 20), stoff(FARBEN.rosa)); innen.position.set(0, 0.18, 0.1); ohr.add(innen);
    ohren.push(ohr);
  }

  // Horn mit Goldspirale
  const horn = new THREE.Group(); horn.position.set(0, 0.88, 0.42); horn.rotation.x = 0.38; kopf.add(horn);
  const hornH = 0.95;
  const hornForm = umriss(new THREE.Mesh(new THREE.ConeGeometry(0.17, hornH, 32), stoff(FARBEN.gold)), 0.06);
  hornForm.position.y = hornH / 2; horn.add(hornForm);
  const spirale = []; for (let i = 0; i <= 120; i++) {
    const u = i / 120, r = 0.172 * (1 - u) + 0.008, w = u * Math.PI * 2 * 3.2;
    spirale.push(new THREE.Vector3(Math.cos(w) * r, u * hornH * 0.96, Math.sin(w) * r));
  }
  horn.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(spirale), 200, 0.022, 8), stoff(FARBEN.goldDunkel)));

  // Regenbogenmähne: Strähnen hinten über Kopf und Hals, Stirnlocke vorn
  const maehne = new THREE.Group(); kopf.add(maehne);
  const straehnen = [];
  for (let i = 0; i < 14; i++) {              // fällt über die rechte Kopfseite bis auf den Hals
    const u = i / 13, w = 0.35 + u * 2.3;      // Winkel von oben nach hinten-unten
    const r = 0.92 + u * 0.12;
    const st = umriss(kugel(0.36 - u * 0.08, FARBEN.maehne[i % 6], 28), 0.05);
    st.scale.set(0.85, 1.2, 0.85);
    st.position.set(0.42 + (i % 2) * 0.16 - u * 0.05, Math.cos(w) * r + 0.1 - u * 1.25, -Math.sin(w) * r * 0.8 + 0.05);
    st.rotation.set(-w + 0.6, 0, -0.35); maehne.add(st); straehnen.push({ m: st, basis: st.position.clone(), phase: i * 0.7 });
  }
  const locke = new THREE.Group(); locke.position.set(0, 0.84, 0.48); kopf.add(locke);
  [[-0.2, 0.02, 0, 0xF59E0B], [0.2, 0.02, 0, 0x8B5CF6], [0, -0.05, 0.12, 0xE5484D]].forEach(([x, y, z, f], i) => {
    const l = umriss(kugel(0.17, f, 24), 0.06); l.scale.set(1, 0.8, 0.8); l.position.set(x, y, z); locke.add(l);
    straehnen.push({ m: l, basis: l.position.clone(), phase: 3 + i });
  });

  return { funkel, hals, kopf, kiefer, augen, ohren, straehnen };
}

const F = { teile: null, pegel: null, modus: 'still', freudeT: -9, laeuft: false };

function start(el) {
  if (F.teile || !el) return;
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' }); }
  catch (e) { el.hidden = true; return; }    // kein WebGL: Funkel bleibt einfach weg
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));   // Canvas ist so groß wie der Spiegel, 1,5 reicht und schont das iPad
  renderer.setClearColor(0x000000, 0);
  el.appendChild(renderer.domElement);

  const szene = new THREE.Scene();
  const kamera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  kamera.position.set(0.9, 0.35, 7.4); kamera.lookAt(0, 0.05, 0);
  szene.add(new THREE.HemisphereLight(0xFFFFFF, 0xC9B6F2, 1.6));
  const licht = new THREE.DirectionalLight(0xFFFFFF, 2.4); licht.position.set(-2.5, 3.5, 5); szene.add(licht);
  const rand = new THREE.DirectionalLight(0xB79CFF, 1.4); rand.position.set(3, 1, -3); szene.add(rand);

  const t = baueFunkel(); F.teile = t;
  t.funkel.position.set(0, -0.25, 0); t.funkel.rotation.y = -0.38; szene.add(t.funkel);

  function groesse() {
    const w = el.clientWidth || 1, h = el.clientHeight || 1;
    renderer.setSize(w, h, false); kamera.aspect = w / h; kamera.updateProjectionMatrix();
  }
  groesse();
  if (window.ResizeObserver) new ResizeObserver(groesse).observe(el); else window.addEventListener('resize', groesse);

  let sichtbar = true;
  if (window.IntersectionObserver) new IntersectionObserver((e) => { sichtbar = e[0].isIntersecting; if (sichtbar) los(); }).observe(el);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) los(); });

  const uhr = new THREE.Clock();
  let naechstesBlinzeln = 2, blinzelnBis = 0, kiefer = 0, blick = -0.38, nicken = 0, ohrZuck = 0, naechstesZucken = 4;

  function bild() {
    if (!sichtbar || document.hidden) { F.laeuft = false; return; }
    requestAnimationFrame(bild);
    const z = uhr.getElapsedTime();
    if (F.freudeWunsch) { F.freudeWunsch = false; F.freudeT = z; }
    const spricht = F.modus === 'spricht', hoert = F.modus === 'hoert';
    let p = 0; if (spricht && F.pegel) { try { p = Math.max(0, Math.min(1, F.pegel() || 0)); } catch (e) { p = 0; } }
    F.letzterPegel = p; F.bilder = (F.bilder || 0) + 1;

    // Maul folgt der Lautstärke, schnell auf, etwas langsamer zu
    kiefer += ((spricht ? p * 0.55 : 0) - kiefer) * (p * 0.55 > kiefer ? 0.6 : 0.3);
    t.kiefer.rotation.x = kiefer;

    // Blick: beim Sprechen zu den Kindern, beim Zuhören zum Spiegel
    const blickZiel = spricht ? -0.12 : hoert ? -0.62 : -0.38;
    blick += (blickZiel - blick) * 0.06;
    nicken += ((spricht ? p * 0.09 : 0) - nicken) * 0.25;
    t.funkel.rotation.y = blick + Math.sin(z * 0.7) * 0.05;
    t.kopf.rotation.x = Math.sin(z * 0.9) * 0.035 + nicken - (hoert ? 0.06 : 0);
    t.kopf.rotation.z = Math.sin(z * 1.3) * 0.045 + (hoert ? 0.12 : 0);

    // Atmen und Freudenhüpfer
    const f = z - F.freudeT, huepf = f < 0.9 ? Math.sin(f / 0.9 * Math.PI) * 0.35 * (1 - f / 0.9 * 0.3) : 0;
    t.funkel.position.y = -0.25 + Math.sin(z * 2) * 0.025 + huepf;

    // Blinzeln
    if (z > naechstesBlinzeln) { blinzelnBis = z + 0.16; naechstesBlinzeln = z + 2.2 + Math.random() * 3.2; if (Math.random() < 0.2) naechstesBlinzeln = z + 0.35; }
    const b = z < blinzelnBis ? Math.sin((blinzelnBis - z) / 0.16 * Math.PI) : 0;
    for (const a of t.augen) a.scale.y = 1 - b * 0.9 + (spricht ? p * 0.04 : 0);

    // Ohren zucken ab und zu, Mähne wippt
    if (z > naechstesZucken) { ohrZuck = 1; naechstesZucken = z + 3 + Math.random() * 5; }
    ohrZuck *= 0.9;
    t.ohren.forEach((o, i) => { o.rotation.x = -0.15 + Math.sin(z * 30) * 0.12 * ohrZuck * (i ? 1 : 0.4); });
    for (const s of t.straehnen) {
      s.m.position.x = s.basis.x + Math.sin(z * 1.8 + s.phase) * 0.025;
      s.m.position.y = s.basis.y + Math.sin(z * 2.2 + s.phase) * 0.02 + huepf * 0.08 * Math.sin(f * 9 + s.phase);
    }
    renderer.render(szene, kamera);
  }
  function los() { if (!F.laeuft) { F.laeuft = true; uhr.getDelta(); requestAnimationFrame(bild); } }
  los();
}

window.Funkel3D = {
  start,
  sprich(pegel) { F.modus = 'spricht'; F.pegel = pegel; },
  hoeren() { F.modus = 'hoert'; F.pegel = null; },
  still() { F.modus = 'still'; F.pegel = null; },
  freude() { F.freudeWunsch = true; },
  zustand() { return { modus: F.modus, pegel: F.letzterPegel || 0, bilder: F.bilder || 0, aktiv: !!F.teile }; }
};
window.dispatchEvent(new Event('funkel3d-bereit'));
