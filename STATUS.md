# Zauberspiegel: Status und nächste Schritte

Stand: 7. November 2026 (Konto und geschützte Links). Das Konzept zum Ablauf für Eltern liegt als Doc: [Funkels Regenbogen: Der Weg der Eltern von der Idee bis zur Party](https://claude.ai/artifact/Rv6JHqm9HHZwYvbYvxeJ99). Alle Screens der App als Design-Canvas mit Beispieldaten: [Zauberspiegel Plattform](https://claude.ai/artifact/XNvrQ353tpt5keUtxokatT).

## Worum es geht

Aus der Einhorn-Schnitzeljagd vom Geburtstag wird eine Plattform für Schnitzeljagden mit sprechendem Zauberspiegel (Tablet). Zielgruppe sind Eltern, die einen Kindergeburtstag organisieren. Später sollen Abenteuer verkauft werden, Utensilien laufen über Partnerlinks und Boxen.

- Live: <https://dafelix1888.github.io/einhorn/app/> (GitHub Pages, Repo `dafelix1888/einhorn`, öffentlich)
- Die Startadresse <https://dafelix1888.github.io/einhorn/> leitet zur App weiter; alte Links auf `#tour` landen direkt im Spiel.
- Original vom Geburtstag: `/original.html`, verschlüsselt mit dem Zauberwort (GitHub-Secret `ZAUBERWORT`). Inhalt unverändert, nur umbenannt.

## Was fertig ist (PR #31 bis #42)

| Bereich | Dateien | Stand |
|---|---|---|
| Startseite | `app/index.html` | Katalog im Spotify-Stil: Kacheln (Einhorn spielbar, 6 Platzhalter), Detailseite mit Hörprobe, Stationen, Figuren, Ausrüstung, Merkliste, Spalte „Deine nächste Party“ mit „Jetzt dran“. Charaktere: Reihe auf der Startseite, Filter „Charaktere“ in „Meine Abenteuer“ und eine Seite je Figur (`#/figur/<id>`) mit allen Abenteuern, in denen sie vorkommt; die Suche findet auch Figuren. Figuren kommen aus `tour.json` (`figuren`), bei Themen ohne Tour aus `held`. Auf dem Handy: eigene Party zuerst, dann Einhorn groß, „Bald verfügbar“ als Reihe |
| Party | `app/party.html`, `app/party.js` | Assistent in 3 Schritten (Für wen und wann, Wer und wo, Fertig; Plan B, Ausdrucke, Vorausgeher voreingestellt). Übersicht mit 6 gebündelten Schritten (Einladen, Bestellen, Route + Probelauf, Bastel- und Druckabend, iPad startklar, Partytag), Karte „Jetzt dran“, Kalender-Export, Einkaufsliste, Plan-B-Umschalter, Links zum Teilen. Alte Einzelhaken bleiben als Teilschritte gültig |
| Planer | `app/planer.html`, `planer.js`, `planer-kern.js`, `stil.css` | Dunkel: Karte über den ganzen Bildschirm, unten „Euer Weg“ mit gewählter Station, „Andere Route“ und „Route übernehmen“. Adresse, Richtung, Strecke → Route aus OpenStreetMap mit passenden Orten je Station, Höhenprofil, Rundkurs, Stationen per Finger verschieben (aufklappbar „Alle Stationen, Höhen, Link“) |
| Spiel | `app/spiel.html`, `tour-laden.js` | Zauberspiegel mit allen Funktionen des Originals, jetzt im dunklen Nachthimmel-Stil (Spiegelinneres bleibt hell). Kopfzeile mit Regenbogen und „Station X von 7“, Ablauf, Einrichten und „Zur Übersicht“ hinter dem Knopf „Erwachsene“ (Tour bleibt gespeichert), nach der Tour Knopf „Zur Übersicht“, großer Hauptknopf, Hinweise als Zeile „Für Erwachsene“. Funkel in 3D (`funkel3d.js`), Inhalte aus `tour.json`, Ortsansagen live über den Worker (sobald eingerichtet) |
| Figuren | `app/themen/*/figuren/` | Profilbilder als SVG: Einhorn-Figuren aus dem Spiel übernommen (Funkel, Fridolin, Kakapups, Rudi, Alfonso, Bruno, Charly, Dagobert), neu gezeichnet: Zauberspiegel und die sechs Hauptfiguren der kommenden Abenteuer. Eingetragen in `tour.json` (`figuren[].bild`) und `themen/index.json` (`heldBild`) |
| Druck | `app/druck.html` | Einladung (2 pro Blatt und als Text), Urkunde je Kind, schlafende Wolke |
| Einladung | `app/einladung.html` | Feld „Bitte mitbringen und beachten“ (z. B. Regenhose, Mütze) in der Party-Übersicht und den Druckvorlagen, draußen mit Vorschlag vorbelegt; steht auf Link, Ausdruck und WhatsApp-Text. Seite für Gast-Eltern: Funkel im Goldrand mit Hörprobe, Wann/Wo/Abholen als Kacheln, „Wir kommen!“ (WhatsApp oder Text kopieren), danach Bestätigung mit Kalender. Daten stecken im Link |
| Vorausgeher | `app/vorausgeher.html` | Fokus auf die nächste Station: Entfernung, „Hier hinlegen“ zum Abhaken, „Station steht, weiter“; Countdown bis zum Gruppenstart; Karte und alle Stationen aufklappbar. Haken nur auf dem eigenen Handy |
| Startklar | `app/bereit.html` | Bereit-Check und Partytag auf einer Seite: Stimmen, Offline, GPS, Akku prüfen sich selbst, Ton und Sperre bestätigt man; darunter Uhrzeiten für Kreidespur, Vorausgeher (mit Link) und Start |
| Stimmen | `stimmen/`, `stimmen/pakete/` | Feste Sätze per GitHub Action bei ElevenLabs; `aufteilen.mjs` teilt in Pakete (Geschichte 2,4 MB, je Erzähler etwa 5 MB); das Spiel lädt nur, was fehlt |
| Konto | `app/konto.js`, `server/` | Party geschützt speichern und teilen über Supabase (Frankfurt), ohne Bibliothek. Planen ohne Konto; „Speichern und teilen“ fragt E-Mail und Code (kein Passwort). Links je Rolle mit Zufallsschlüssel (`?k=`): Einladung ohne Route, Vorausgeher und iPad mit Route; „Link sperren“ ersetzt einen Link. Zweites Gerät holt die Party nach dem Anmelden. Löschen nach 30 Tagen. Eingerichtet am 7. November 2026: Supabase-Projekt `zauberspiegel` (Frankfurt, `fsqnzmwuojngopffcxso`), Tabellen, Zugriffsregeln und tägliches Löschen (pg_cron) aktiv, Zugriffsregeln live geprüft. Offen bei Felix: Code in die Mail-Vorlagen, Adresse der App erlauben (`server/README.md`, Schritte 3 und 4) |
| Live-Stimmen | `worker/` | Cloudflare Worker für Ortsansagen, nur Vorlagen-Sätze, mit Cache. **Noch nicht eingerichtet** (siehe unten) |

## Entscheidungen

- Holz-Regenbogen: Grundsatz ist, dass ein ähnliches Produkt ohne Änderung an der Geschichte passt. Nötig sind nur Rot, Gelb, Grün und Blau, die Anzahl der Bögen ist egal. Packlisten nennen nur Farben, keine Stückzahlen oder Zwischentöne. Gesprochene Texte bleiben unverändert (Stimmen kosten Credits).

- Kartendaten von OpenStreetMap (Overpass, Nominatim), Höhen von Open-Meteo, Adressvorschläge beim Tippen über Photon (komoot), alles ohne Schlüssel. Nominatim erlaubt keine Vorschläge beim Tippen, deshalb Photon dafür.
- Architektur vorerst statisch: Jedes Abenteuer ist eine `tour.json`, Daten der Eltern liegen im Gerät (`localStorage`: `sj.party.<thema>`, `sj.plan.<thema>`), Teilen läuft über Links mit eingebetteten Daten.
- Server: Supabase in Frankfurt (Login per E-Mail-Code, Datenbank mit Zugriffsregeln, Daten in der EU). Stimmen bleiben beim Cloudflare Worker.
- Konto nur für die Eltern, die feiern, und erst beim Teilen. Planen und die Route um die eigene Adresse ansehen geht ohne Konto. Gast-Eltern, Vorausgeher und iPad brauchen kein Konto, nur ihren Link. Das iPad bekommt kein Zauberwort, der geheime Link reicht.
- „Einmal gratis“ wird nicht gezählt (ohne Konto nicht sicher möglich); die Grenze ist „Speichern und teilen“.
- Anpassen kostet künftig Geld: Paket mit 3 Neuerzeugungen, ein Prompt zählt als eine Neuerzeugung. Grenze je Prompt: so lang wie eine WhatsApp-Nachricht, höchstens 3 Stationen oder 2 Figuren, höchstens 2.000 gesprochene Zeichen. Höchstens 2 Bonus-Stationen je Party. Fest bleiben Reihenfolge, Rätsel, Utensilien und Sicherheit.
- Funkel nennt das Kind an drei Stellen beim Namen: Begrüßung, Geburtstagsgruß beim Schatz, Abschied (Teil des bezahlten Pakets).
- Einladung für Gast-Eltern: ja, schon gebaut. Vorausgeher mit Live-Ansicht auf dem iPad: ja, braucht aber den Server.

## Nächste Schritte

1. **Echter Test durch Felix:** Party anlegen, Route bei euch planen, Link aufs iPad, Bereit-Check, Einladungs- und Vorausgeher-Link aufs Handy. Bisher ist alles nur mit nachgebauten Kartendaten getestet.
2. **Worker einrichten** (Felix, etwa 10 Minuten): `cd worker && npx wrangler login && npx wrangler secret put ELEVENLABS_API_KEY && npx wrangler deploy`, danach die Worker-Adresse in `app/config.json` bei `liveUrl` eintragen.
3. **Supabase fertig machen** (Felix, etwa 3 Minuten): Code in die Mail-Vorlagen und App-Adresse erlauben, siehe `server/README.md` Schritte 3 und 4. Danach echter Test: Party anlegen, „Speichern und teilen“, Einladung auf einem zweiten Handy öffnen. Vor fremden Nutzern: eigener Mailversand (SMTP) und Datenschutzhinweis. Darauf bauen später: Live-Haken des Vorausgehers, Namens-Sätze, Käufe.
4. **Etappe 2: Funkel kennt das Kind.** Namens-Sätze an den drei Stellen, Probehören, Aussprache-Feld, Grenze für Neuerzeugungen, später hinter einer Bezahlschranke.
5. **Anpassen mit Leitplanken:** Prompt-Eingabe, KI schätzt Umfang und ändert Sätze, Eltern prüfen die Änderungen, dann Vertonung. Braucht Server und Bezahlung.
6. ~~Planer und Spiel im dunklen Stil~~ erledigt in PR #41. Offen: echter Test auf iPad und Handy (dunkle OSM-Karte mit echten Kacheln, Ziehen per Touch).
7. **Zweites Thema**, damit die Engine wirklich generisch ist: Bilder (`PIC`), Regenbogen-Fortschritt und Farben stecken noch in `spiel.html` und müssen ins Thema wandern.
8. **Partnerlinks und Einkauf:** Alle Utensilien außer dem Schuhkarton (hat man zu Hause) haben Amazon-Links mit `asin`, `packung` und `preis` in `tour.json` (Preise von Hand, Stand `preisStand`). Detailseite zeigt Preise und Summe. Die Einkaufsliste hat eine Auswahl je Artikel (Häkchen = in den Warenkorb, „Alle/Keine auswählen“), die Summe der Auswahl und „N Artikel in den Warenkorb“ (Amazon-Formular `gp/aws/cart/add.html`; Amazon verlangt Anmeldung und einen Bestätigungsklick). Danach fragt die Liste „Bei Amazon bestellt?“ und hakt ab. „Hab ich schon“ hakt einzeln ab, Abgehaktes steht aufklappbar darunter. Artikel ohne Preis (`preis: null`) gelten als nicht lieferbar: Hinweis „Nicht gefunden“ mit „Ähnliche suchen“. Ob ein Artikel wirklich lieferbar ist, prüft die App nicht live, das steht von Hand in `tour.json`. Offen: Partner-ID (`AssociateTag` in `Party.warenkorbLink`, `?tag=` an den Einzellinks), Hinweis „Als Amazon-Partner …“ auf beiden Seiten. Achtung: Mit Partner-ID erlaubt Amazon feste Preise nur aus der Product Advertising API mit Aktualisierung alle 24 Stunden; dafür braucht es dann den Server bzw. Worker.

## Erfahrung vom Geburtstag: GPS

Punkte mit dem Handy gesetzt, gespielt mit dem iPad: Stationen öffneten mal zu früh, mal gar nicht (Gruppe lief vorbei). Ursachen: zwei Geräte mit unterschiedlichem Fehler, und ein iPad ohne Mobilfunk hat kein GPS (nur WLAN-Ortung, springt um 20 bis 60 m). Seit PR #42 gilt:

- Die Punkte kommen aus der Karte des Planers statt vom Handy.
- Position geglättet: Mittel der letzten 8 s nach Genauigkeit gewichtet, Sprünge schneller als Gehtempo werden verworfen.
- Von selbst öffnet eine Station nur bei sicherem Signal: höchstens 15 m entfernt, Genauigkeit höchstens ±25 m, 4 s lang.
- Bei ungenauem Signal fragt der Spiegel: „Fast da! Seht ihr die Station?“, ein Erwachsener tippt „Wir sind da“. Bei Vorbeilaufen: „Station hier öffnen“. Beides mit leisem Klang, ohne Pop.
- Simulation (Lauf auf eine Station zu, 1 m/s): Handy mit gutem GPS öffnet 4 bis 8 m vor dem Punkt; iPad mit WLAN-Ortung öffnet nie von selbst, „Fast da“ kommt 18 bis 38 m vorher.
- Der Bereit-Check erklärt das und empfiehlt bei mehr als ±50 m ein Handy oder iPad mit Mobilfunk.

## Offene Fragen

- Preis des Anpassungs-Pakets.
- Preise der Abenteuer (Vorschlag: Einhorn kostenlos, weitere Einzelkauf).

## Arbeitsweise im Repo

- Texte in der App auf Deutsch, kurz und ohne Fachwörter. Kein echter Ort oder Name aus Felix' Umfeld im öffentlichen Repo.
- Änderungen per Branch und Pull Request, Felix möchte, dass PRs direkt in `main` gemergt werden.
- `app/spiel.html` wurde einmalig aus dem entschlüsselten Original erzeugt und wird jetzt direkt bearbeitet.
- Die Stimmen-Action läuft bei Änderungen an `original.html` oder `stimmen/**` und teilt danach die Pakete neu auf. Geänderte Story-Texte kosten ElevenLabs-Credits.
- Testen: lokal `python3 -m http.server` im Repo, dann Playwright. Für den Planer liefern nachgebaute Overpass-, Nominatim- und Open-Meteo-Antworten die Daten, weil diese Dienste aus der Testumgebung oft nicht erreichbar sind.
