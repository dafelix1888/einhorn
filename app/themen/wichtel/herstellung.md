# Wichtel Bommi: So entsteht eine Geschichte

Festgelegt am Muster von Geschichte 1 (UNICORN-135, 21. November 2026). Die Serie (UNICORN-138) wiederholt genau diese Schritte. Ansehen: `app/themen/wichtel/muster/index.html`.

## Arbeitsbereich

Ein Ablauf je Geschichte bei ElevenLabs. Muster: Ablauf `Px4LWwY5Q6AWRMajXAtp` („Wichtel Muster G1“). Darin als erster Baustein das finale Bommi-Bild als Vorlage (Erzeugung `lQkvPIA5INTOIcs8oAHj`, über „Asset-Baustein aus Erzeugung“ in jeden neuen Ablauf holen). Alle Bild-Bausteine hängen an dieser Vorlage, alle Clip-Bausteine an ihrem Bild.

## Schritte

1. **Bilder (5 je Geschichte):** `gemini-3.1-flash-image`, Vorlage angehängt, 9:16, 1K, eine Fassung. Jede Beschreibung beginnt mit demselben Stil-Absatz (siehe Muster-Ablauf, Baustein „G1 Bild 1“), danach die Szene aus `geschichten.json` auf Englisch. Bommels an den Schuhen ausdrücklich nennen, und „auf beiden Füßen Schuhe“. Misslingt ein Bild (im Muster: ein Fuß ohne Schuh), dasselbe Bild einmal mit `gemini-3-pro-image` erzeugen (aus der Reserve).
2. **Sprache:** Stimme „Bommi (Wichtel)“ (`svptHMXByWlhGYcu3wTj`), Modell `eleven_v4`, eine Fassung. Ein Text fürs Video, ein Text je Bild. Sätze anderer Figuren einzeln mit deren Stimme (`stimmen.json`) und mit 0,35 Sekunden Pause zusammensetzen.
3. **Clips (3 je Geschichte):** `veo-3.1-lite-generate-001`, Startbild = Bild 1 bis 3, 9:16, 720p, 8 Sekunden, **ohne Ton** (`generate_audio: false`, spart 40 %). Den Ort festschreiben („keep the location fixed … nothing new appears, no snow indoors“) und die Stimmung festhalten („facial expression stays exactly as in the start image“, Veo zieht die Figur sonst gern ins Lächeln) und eine Liste im `negative_prompt` (Text, zweite Figur, weitere Türen, Weihnachtsmann, Stilwechsel).
4. **Sofort herunterladen** (Links laufen nach etwa 3 Stunden ab). Bilder als JPG (Qualität 4, etwa 150 bis 230 KB), Ton als MP3 mono 64 kbit/s.
5. **Video zusammensetzen** mit ffmpeg (`stimmen/wichtel-video.sh`): 3,5 Sekunden Bild 1 mit leichtem Zoom und Melodie, dann die 3 Clips, am Ende 7,5 Sekunden Standbild aus dem **Original-Bild 3** (nicht dem letzten Bild des Clips, damit die Stimmung zum Text passt) mit Zoom und Ausblende. Bommis Stimme setzt nach 3 Sekunden ein. 35 Sekunden, 720 × 1280, H.264 CRF 27, AAC 96 kbit/s mono, `+faststart`. Ergebnis im Muster: 5,6 MB. Ist Bommis Video-Text länger als 31 Sekunden, das Schlussbild per drittem Wert verlängern (Geschichte 5: `10.5`, Video 38 Sekunden), damit „Blättert weiter!“ nicht abgeschnitten wird.
6. Dateien nach `app/themen/wichtel/<id>/` legen, Test `tests/wichtel-muster.test.cjs` sinngemäß erweitern.

## Kosten (gemessen am Muster)

| Schritt | Punkte |
| --- | --- |
| 5 Bilder günstig | 3.045 |
| Sprache Video und Bildergeschichte | 1.599 |
| 3 Clips ohne Ton | 4.362 |
| **Je Geschichte** | **rund 9.000** |
| Nur im Muster: Stimmen-Entwurf, Melodie, Vergleichsbild teures Modell | rund 2.180 |

Zeit: Bilder etwa 40 Sekunden, Sprache wenige Sekunden, Clips etwa 90 Sekunden (alle drei gleichzeitig), Zusammensetzen 30 Sekunden.
