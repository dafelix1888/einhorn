# Zauberspiegel: Status und nächste Schritte

Stand: 2. November 2026 (nach PR #39). Das Konzept zum Ablauf für Eltern liegt als Doc: [Funkels Regenbogen: Der Weg der Eltern von der Idee bis zur Party](https://claude.ai/artifact/Rv6JHqm9HHZwYvbYvxeJ99). Alle Screens der App als Design-Canvas mit Beispieldaten: [Zauberspiegel Plattform](https://claude.ai/artifact/XNvrQ353tpt5keUtxokatT).

## Worum es geht

Aus der Einhorn-Schnitzeljagd vom Geburtstag wird eine Plattform für Schnitzeljagden mit sprechendem Zauberspiegel (Tablet). Zielgruppe sind Eltern, die einen Kindergeburtstag organisieren. Später sollen Abenteuer verkauft werden, Utensilien laufen über Partnerlinks und Boxen.

- Live: <https://dafelix1888.github.io/einhorn/app/> (GitHub Pages, Repo `dafelix1888/einhorn`, öffentlich)
- Original vom Geburtstag: `/index.html`, verschlüsselt mit dem Zauberwort (GitHub-Secret `ZAUBERWORT`). Es bleibt unverändert.

## Was fertig ist (PR #31 bis #39)

| Bereich | Dateien | Stand |
|---|---|---|
| Startseite | `app/index.html` | Katalog im Spotify-Stil: Kacheln (Einhorn spielbar, 6 Platzhalter), Detailseite mit Hörprobe, Stationen, Figuren, Ausrüstung, Merkliste, Spalte „Deine nächste Party“ mit „Jetzt dran“. Auf dem Handy: eigene Party zuerst, dann Einhorn groß, „Bald verfügbar“ als Reihe |
| Party | `app/party.html`, `app/party.js` | Assistent in 3 Schritten (Für wen und wann, Wer und wo, Fertig; Plan B, Ausdrucke, Vorausgeher voreingestellt). Übersicht mit 6 gebündelten Schritten (Einladen, Bestellen, Route + Probelauf, Bastel- und Druckabend, iPad startklar, Partytag), Karte „Jetzt dran“, Kalender-Export, Einkaufsliste, Plan-B-Umschalter, Links zum Teilen. Alte Einzelhaken bleiben als Teilschritte gültig |
| Planer | `app/planer.html`, `planer.js`, `planer-kern.js`, `stil.css` | Dunkel: Karte über den ganzen Bildschirm, unten „Euer Weg“ mit gewählter Station, „Andere Route“ und „Route übernehmen“. Adresse, Richtung, Strecke → Route aus OpenStreetMap mit passenden Orten je Station, Höhenprofil, Rundkurs, Stationen per Finger verschieben (aufklappbar „Alle Stationen, Höhen, Link“) |
| Spiel | `app/spiel.html`, `tour-laden.js` | Zauberspiegel mit allen Funktionen des Originals, jetzt im dunklen Nachthimmel-Stil (Spiegelinneres bleibt hell). Kopfzeile mit Regenbogen und „Station X von 7“, Ablauf und Einrichten hinter dem Knopf „Erwachsene“, großer Hauptknopf, Hinweise als Zeile „Für Erwachsene“. Funkel in 3D (`funkel3d.js`), Inhalte aus `tour.json`, Ortsansagen live über den Worker (sobald eingerichtet) |
| Druck | `app/druck.html` | Einladung (2 pro Blatt und als Text), Urkunde je Kind, schlafende Wolke |
| Einladung | `app/einladung.html` | Seite für Gast-Eltern: Funkel im Goldrand mit Hörprobe, Wann/Wo/Abholen als Kacheln, „Wir kommen!“ (WhatsApp oder Text kopieren), danach Bestätigung mit Kalender. Daten stecken im Link |
| Vorausgeher | `app/vorausgeher.html` | Fokus auf die nächste Station: Entfernung, „Hier hinlegen“ zum Abhaken, „Station steht, weiter“; Countdown bis zum Gruppenstart; Karte und alle Stationen aufklappbar. Haken nur auf dem eigenen Handy |
| Startklar | `app/bereit.html` | Bereit-Check und Partytag auf einer Seite: Stimmen, Offline, GPS, Akku prüfen sich selbst, Ton und Sperre bestätigt man; darunter Uhrzeiten für Kreidespur, Vorausgeher (mit Link) und Start |
| Stimmen | `stimmen/`, `stimmen/pakete/` | Feste Sätze per GitHub Action bei ElevenLabs; `aufteilen.mjs` teilt in Pakete (Geschichte 2,4 MB, je Erzähler etwa 5 MB); das Spiel lädt nur, was fehlt |
| Live-Stimmen | `worker/` | Cloudflare Worker für Ortsansagen, nur Vorlagen-Sätze, mit Cache. **Noch nicht eingerichtet** (siehe unten) |

## Entscheidungen

- Kartendaten von OpenStreetMap (Overpass, Nominatim), Höhen von Open-Meteo, beides ohne Schlüssel.
- Architektur vorerst statisch: Jedes Abenteuer ist eine `tour.json`, Daten der Eltern liegen im Gerät (`localStorage`: `sj.party.<thema>`, `sj.plan.<thema>`), Teilen läuft über Links mit eingebetteten Daten.
- Server kommt später. Offen ist, ob Cloudflare oder Supabase.
- Anpassen kostet künftig Geld: Paket mit 3 Neuerzeugungen, ein Prompt zählt als eine Neuerzeugung. Grenze je Prompt: so lang wie eine WhatsApp-Nachricht, höchstens 3 Stationen oder 2 Figuren, höchstens 2.000 gesprochene Zeichen. Höchstens 2 Bonus-Stationen je Party. Fest bleiben Reihenfolge, Rätsel, Utensilien und Sicherheit.
- Funkel nennt das Kind an drei Stellen beim Namen: Begrüßung, Geburtstagsgruß beim Schatz, Abschied (Teil des bezahlten Pakets).
- Einladung für Gast-Eltern: ja, schon gebaut. Vorausgeher mit Live-Ansicht auf dem iPad: ja, braucht aber den Server.

## Nächste Schritte

1. **Echter Test durch Felix:** Party anlegen, Route bei euch planen, Link aufs iPad, Bereit-Check, Einladungs- und Vorausgeher-Link aufs Handy. Bisher ist alles nur mit nachgebauten Kartendaten getestet.
2. **Worker einrichten** (Felix, etwa 10 Minuten): `cd worker && npx wrangler login && npx wrangler secret put ELEVENLABS_API_KEY && npx wrangler deploy`, danach die Worker-Adresse in `app/config.json` bei `liveUrl` eintragen.
3. **Server wählen** (Cloudflare KV/D1 + R2 oder Supabase). Daran hängen: Live-Haken des Vorausgehers, Party auf mehreren Geräten, Namens-Sätze speichern, später Konten und Käufe.
4. **Etappe 2: Funkel kennt das Kind.** Namens-Sätze an den drei Stellen, Probehören, Aussprache-Feld, Grenze für Neuerzeugungen, später hinter einer Bezahlschranke.
5. **Anpassen mit Leitplanken:** Prompt-Eingabe, KI schätzt Umfang und ändert Sätze, Eltern prüfen die Änderungen, dann Vertonung. Braucht Server und Bezahlung.
6. ~~Planer und Spiel im dunklen Stil~~ erledigt in PR #39. Offen: echter Test auf iPad und Handy (dunkle OSM-Karte mit echten Kacheln, Ziehen per Touch).
7. **Zweites Thema**, damit die Engine wirklich generisch ist: Bilder (`PIC`), Regenbogen-Fortschritt und Farben stecken noch in `spiel.html` und müssen ins Thema wandern.
8. **Partnerlinks** in `tour.json` → `utensilien[].link` eintragen (Partner-ID von Felix nötig).

## Erfahrung vom Geburtstag: GPS

Punkte mit dem Handy gesetzt, gespielt mit dem iPad: Die Stationen öffneten oft nicht, die Gruppe lief vorbei. Ursachen: zwei Geräte mit unterschiedlichem Fehler, und ein iPad ohne Mobilfunk hat kein GPS (nur WLAN-Ortung). Seit PR #39:

- Die Punkte kommen aus der Karte des Planers statt vom Handy.
- Der Öffnungsradius wächst mit der Ungenauigkeit (15 m plus bis zu 20 m), Messungen bis ±60 m zählen.
- Läuft die Gruppe vorbei (erst nah dran, dann wieder 15 m weiter weg), bietet der Spiegel die Station selbst an. Im Protokoll steht dann „vorbeigelaufen“.
- Der Bereit-Check warnt bei mehr als ±50 m und empfiehlt Handy oder iPad mit Mobilfunk als Spiegel.

## Offene Fragen

- Server: Cloudflare oder Supabase?
- Preis des Anpassungs-Pakets.
- Preise der Abenteuer (Vorschlag: Einhorn kostenlos, weitere Einzelkauf).

## Arbeitsweise im Repo

- Texte in der App auf Deutsch, kurz und ohne Fachwörter. Kein echter Ort oder Name aus Felix' Umfeld im öffentlichen Repo.
- Änderungen per Branch und Pull Request, Felix möchte, dass PRs direkt in `main` gemergt werden.
- `app/spiel.html` wurde einmalig aus dem entschlüsselten Original erzeugt und wird jetzt direkt bearbeitet.
- Die Stimmen-Action läuft bei Änderungen an `index.html` oder `stimmen/**` und teilt danach die Pakete neu auf. Geänderte Story-Texte kosten ElevenLabs-Credits.
- Testen: lokal `python3 -m http.server` im Repo, dann Playwright. Für den Planer liefern nachgebaute Overpass-, Nominatim- und Open-Meteo-Antworten die Daten, weil diese Dienste aus der Testumgebung oft nicht erreichbar sind.
