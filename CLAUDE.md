# Hinweise für Claude

- Zuerst `STATUS.md` lesen: Stand, Entscheidungen, nächste Schritte. Nach größeren Änderungen dort nachtragen.
- Die generische App liegt in `app/`. Das verschlüsselte Original liegt in `/original.html` und wird nicht angefasst. `/index.html` leitet nur zur App weiter.
- Texte für Eltern und Kinder auf Deutsch, kurz und ohne Fachwörter.
- Keine echten Adressen, Straßennamen oder Namen aus Felix' Umfeld ins Repo (es ist öffentlich). Das Zauberwort nie ins Repo schreiben.
- Arbeiten über Branch und Pull Request; PRs direkt in `main` mergen.

## Marketing (Marketer)

- Marketing für diese App kommt aus dem Projekt Marketer (Repo `dafelix1888/Marketer`, Jira-Projekt MAR).
- Aufträge von Marketer stehen als Tickets in UNICORN mit Label „marketer“. Umsetzen wie jedes andere Ticket, PR-Titel mit UNICORN-xx.
- Schnittstelle: `docs/integration.md` im Marketer-Repo.
- Event-Namen (`hoerprobe_played`, `route_planned`, `party_created`) und `app/landing.html` nicht ändern oder umbenennen. Änderungswünsche als Ticket im Projekt MAR anlegen.
- Ändern sich Preis, Bezahlung, Domain oder Themen, ein Ticket im Projekt MAR anlegen, damit Marketer es berücksichtigt.
