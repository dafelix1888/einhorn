# Hinweise für Claude

- Zuerst `STATUS.md` lesen: Stand, Entscheidungen, nächste Schritte. Nach größeren Änderungen dort nachtragen.
- Die generische App liegt in `app/`. Das verschlüsselte Original liegt in `/original.html` und wird nicht angefasst. `/index.html` leitet nur zur App weiter.
- Texte für Eltern und Kinder auf Deutsch, kurz und ohne Fachwörter.
- Keine echten Adressen, Straßennamen oder Namen aus Felix' Umfeld ins Repo (es ist öffentlich). Das Zauberwort nie ins Repo schreiben.
- Arbeiten über Branch und Pull Request; PRs direkt in `main` mergen.
- Jira-Tickets in UNICORN nachziehen: Status „Delivery“, sobald gebaut, aber noch etwas von Felix fehlt (Schlüssel, Test, ID); „Done“, sobald live und geprüft. Kommentar mit PR-Link dazu.

## Marketing (Marketer)

- Marketing für diese App kommt aus dem Projekt Marketer (Repo `dafelix1888/Marketer`, Jira-Projekt MAR).
- Aufträge von Marketer stehen als Tickets in UNICORN mit Label „marketer“. Umsetzen wie jedes andere Ticket, PR-Titel mit UNICORN-xx.
- Schnittstelle: `docs/integration.md` im Marketer-Repo.
- Event-Namen (`hoerprobe_played`, `route_planned`, `party_created`) und `app/landing.html` nicht ändern oder umbenennen. Änderungswünsche als Ticket im Projekt MAR anlegen.
- Ändern sich Preis, Bezahlung, Domain oder Themen, ein Ticket im Projekt MAR anlegen, damit Marketer es berücksichtigt.

## Incidents und Problems (ITSM, Jira-Projekt PBIM)

- Alle Incidents und Problems stehen im Jira-Projekt PBIM (https://fepu.atlassian.net/jira/core/projects/PBIM).
- Kommt ein Incident (etwas geht nicht, falsches Verhalten, Fehlermeldung), zuerst in PBIM suchen, ob das Thema schon einmal gelöst wurde (JQL, z. B. `project = PBIM AND text ~ "Stichwort"`), und die frühere Lösung nutzen.
- Neuer Incident: Task mit Label `incident`, Komponente/Bereich im Titel (z. B. „Planer: Karte lädt nicht“). Beschreibung: Was ist passiert, wo, seit wann, Ursache, Lösung, PR-Link.
- Deuten mehrere Incidents auf dieselbe Ursache, ist das ein Problem: Epic mit Label `problem`, die Incidents als Kinder darunter hängen. Im Epic die gemeinsame Ursache und die dauerhafte Lösung festhalten.
- Behobene Incidents auf erledigt setzen; die Lösung muss im Ticket stehen, damit man sie beim nächsten Mal findet.
- Fehler aus der App landen anonym in der Supabase-Tabelle `fehler` (Projekt `zauberspiegel`). Zu Beginn einer Sitzung und auf Nachfrage neue Einträge ansehen (`select * from fehler where ticket is null order by zuletzt desc`), zuerst in PBIM nach der Meldung suchen, sonst einen Incident anlegen und den Schlüssel (z. B. `PBIM-13`) in `fehler.ticket` eintragen. Gleiche Ursache in mehreren Einträgen: Problem anlegen.
