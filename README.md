# Schnitzeljagden mit Zauberspiegel

Das Repo enthält zwei Fassungen:

- **`/` (index.html)**: das Original, „Funkels Zauberspiegel“ für den Geburtstag. Es ist verschlüsselt und bleibt unverändert.
- **`/app/`**: die generische Fassung für jeden Ort: <https://dafelix1888.github.io/einhorn/app/>

## Aufbau von `/app/`

| Datei | Zweck |
|---|---|
| `party.html`, `party.js` | Party-Assistent (Kind, Termin, Gäste, Ort mit Plan B) und Party-Übersicht: nächster Schritt, Zeitplan mit Kalender-Export, Einkaufsliste mit Mengen, Link fürs iPad |
| `druck.html` | Druckvorlagen mit Namen und Datum: Einladung (auch als Text für WhatsApp), Urkunden für alle Kinder, schlafende Wolke |
| `einladung.html` | Einladung für Gast-Eltern als Link (Daten stecken im Link): Termin, Treffpunkt, Abholzeit, Zusage per WhatsApp, Kalender, Hörprobe |
| `vorausgeher.html` | Ansicht für den Vorausgeher: Startzeit, Karte mit Stationen und eigenem Standort, was wo hingelegt wird, Haken „aufgebaut“ (bisher nur auf dem eigenen Handy) |
| `bereit.html` | Bereit-Check auf dem Spiel-Gerät: Ton, Stimmen offline, GPS, Akku, Sperre, Offline-Speicher |
| `index.html` | Übersicht je Thema: Dauer, Stationen, Figuren, Varianten, Geschenke, Utensilien (mit Platz für Affiliate-Links) |
| `planer.html`, `planer.js` | Tourplaner: Adresse, grobe Richtung, Strecke und Kinderzahl eingeben, Route wird geplant, Stationen lassen sich auf der Karte verschieben |
| `planer-kern.js` | Planungslogik ohne Oberfläche: Wegenetz aus OpenStreetMap, kürzeste Wege, passende Orte je Station, Höhenprofil |
| `spiel.html`, `tour-laden.js` | Die Spiel-Engine (Zauberspiegel). Sie lädt das Thema und den Plan |
| `themen/<id>/tour.json` | Ein Thema: Geschichte, Stationen, Varianten, Figuren, Vorbereitungsliste, Geschenke, Utensilien, Zeitplan |
| `config.json` | `liveUrl`: Adresse des Stimmen-Workers (leer bedeutet keine Live-Ansagen) |
| `sw.js` | Offline-Vorrat fürs Spielen ohne Empfang |

### Wie der Planer Orte findet

Jede Station in `tour.json` hat `ort.typ`. Daraus sucht der Planer in OpenStreetMap (Overpass) den passenden Ort:

`start` · `weg` (gern eine Ecke) · `strassenquerung` (Zebrastreifen, Ampel, Fußweg über die Straße) · `zaun` (Zaun, Hecke, Mauer) · `kreuzung` · `huegel_unten` (tiefster Punkt vor dem Anstieg, Höhen von Open-Meteo) · `bank` (mit `oben`: möglichst erhöht, sonst Aussichtspunkt oder Spielplatz) · `spielplatz`

`ort.anteil` legt fest, an welcher Stelle der Strecke die Station ungefähr liegen soll. Der Planer prüft bis zu zehn mögliche Ziele und nimmt die Route, auf der die meisten Stationen einen passenden Ort finden. „Andere Route“ blättert durch die übrigen Kandidaten. Findet er für eine Station keinen passenden Ort, setzt er einen normalen Wegpunkt und markiert ihn als Ersatz.

Alle Dienste sind frei und brauchen keinen API-Schlüssel: Nominatim, Overpass, Open-Meteo und die OSM-Kacheln.

### Plan aufs Spiel-Gerät bringen

Der Planer speichert den Plan im Browser. „Link fürs Spiel-Gerät“ erzeugt einen Link der Form `spiel.html?thema=einhorn&plan=…`. Öffnet man ihn auf dem iPad, ist die Tour dort gespeichert.

## Stimmen

- **Pakete:** `stimmen/aufteilen.mjs` teilt `funkel-stimme.json` in `stimmen/pakete/` auf: Geschichte (2,4 MB) und je Erzähler etwa 5 MB. Das Spiel lädt nur die Geschichte und die gewählten Erzähler, und nur, wenn sich laut `einhorn-index.json` etwas geändert hat. Die GitHub Action teilt nach jedem Erzeugen neu auf.

- **Feste Sätze** (Geschichte, Aufgaben) kommen wie bisher aus `funkel-stimme.json`. Die GitHub Action erzeugt sie einmal pro Thema.
- **Ortsansagen** wie „Die Parkbank steht im Wolkenpark.“ werden live erzeugt. Das übernimmt der Cloudflare Worker in `worker/`. Er kennt nur die Vorlagen aus `tour.json` (`stationen[].ansage`), speichert jeden Satz zwischen und lässt nur die eigene Seite zu. Die Spiel-Engine holt die Ansagen beim Öffnen und hält sie offline bereit.

Einrichten (einmalig):

```sh
cd worker
npx wrangler login
npx wrangler secret put ELEVENLABS_API_KEY
npx wrangler deploy
```

Dann die Worker-Adresse (`https://schnitzeljagd-stimmen.<konto>.workers.dev`) in `app/config.json` bei `liveUrl` eintragen.

## Neues Thema anlegen

1. `app/themen/<id>/tour.json` nach dem Vorbild von `einhorn` anlegen und in `app/themen/index.json` eintragen.
2. Ansage-Vorlagen auch in `worker/stimmen.js` unter `THEMEN` eintragen.
3. Die Bilder (`PIC`) und der Regenbogen-Fortschritt stecken noch in `spiel.html`. Ein Thema mit eigener Grafik braucht dort noch eine Erweiterung.
