# Hinweise für Claude

- Zuerst `STATUS.md` lesen: Stand, Entscheidungen, nächste Schritte. Nach größeren Änderungen dort nachtragen.
- Die generische App liegt in `app/`. Das verschlüsselte Original liegt in `/original.html` und wird nicht angefasst. `/index.html` leitet nur zur App weiter.
- Texte für Eltern und Kinder auf Deutsch, kurz und ohne Fachwörter.
- Keine echten Adressen, Straßennamen oder Namen aus Felix' Umfeld ins Repo (es ist öffentlich). Das Zauberwort nie ins Repo schreiben.
- Arbeiten über Branch und Pull Request; PRs direkt in `main` mergen. GitHub mergt eigene PRs auch von selbst: Sobald der Workflow „Tests“ grün ist, mergt der Job „Von selbst mergen“ per Squash (Commit-Titel = PR-Titel) und startet die Veröffentlichung. Das greift auch dort, wo eine Sitzung nicht selbst mergen darf (geplante Läufe). Was noch nicht live gehen soll, als Entwurf (Draft) öffnen. Neue Workflows, die bei Push auf `main` laufen sollen, im Schritt „Veröffentlichung anstoßen“ in `.github/workflows/tests.yml` nachtragen (AM-2).
- Jira-Tickets in UNICORN nachziehen: Status „Delivery“, sobald gebaut, aber noch etwas von Felix fehlt (Schlüssel, Test, ID); „Done“, sobald live und geprüft. Kommentar mit PR-Link dazu.
- In jedem bearbeiteten Ticket (UNICORN, MAR, STRAT, PBIM, ADR, KM) einen kurzen, präzisen Kommentar hinterlassen: was getan wurde, was festgestellt wurde, was offen ist und bei wem (mit PR-Link). So wissen Strategist, Marketer und andere Sitzungen ohne Rückfrage, wo das Ticket steht.

## Zusammenarbeit

- **Strategist (Projekt STRAT):** Kommentare in unseren Tickets, die mit „Strategist:“ beginnen, sind Vorgaben der Geschäftsführung (Felix, vertreten durch STRAT), keine Vorschläge. Wir setzen sie um oder widersprechen begründet im genannten STRAT-Ticket; stillschweigend abweichen ist nicht vorgesehen. Preise, Kosten > 0 €/Monat und Richtungsentscheidungen werden nur in STRAT entschieden; vor einem Ticket mit laufenden Kosten holen wir dort eine Freigabe. Aktuelle Strategie: STRAT-1 bis STRAT-5 und `claude/STATUS.md`, Abschnitt „Rollen und Jira-Projekte“.

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

## Feedback aus der App (Supabase-Tabelle `meinungen`)

- Eltern geben in der App 1 bis 5 Sterne und freien Text ab (ohne Namen, ohne Bezug zu Konto oder Party). Das landet in der Tabelle `meinungen` (Projekt `zauberspiegel`). Nicht verwechseln mit `feedback`: Das ist die Rückmeldung der Gäste nach der Party.
- Zu Beginn einer Sitzung und auf Nachfrage neue Einträge ansehen (`select id, erstellt, sterne, text, wo, stand from meinungen where ticket is null order by erstellt`) und Felix kurz berichten: Anzahl, Schnitt, Auffälliges.
- Wünsche und Kritik als Ticket in UNICORN bündeln (Label `feedback`). Story- und Charakter-Wünsche zusätzlich als Kommentar in UNICORN-16 (zweites Abenteuer). Danach den Ticket-Schlüssel oder `gelesen` in `meinungen.ticket` eintragen.
- Beschreibt jemand darin einen Fehler: wie einen Incident behandeln (PBIM).
- Bei jedem neuen Eintrag geht eine Mail an Felix (UNICORN-31): Trigger `meinung_melden` → `pg_net` → Brevo-API. Schlüssel (`brevo_api_key`) und Empfänger (`feedback_mail_an`) stehen im Supabase Vault, nie im Repo. Höchstens 20 Mails in 24 Stunden; `meinungen.gemeldet` zeigt, ob eine Mail rausging. Kommt keine Mail an: `select status_code, content, error_msg, created from net._http_response order by created desc limit 5` (201 = von Brevo angenommen, 401 = Schlüssel falsch oder IP bei Brevo gesperrt).

## Architektur und Wissen (Jira-Projekte ADR und KM)

- **ADR** (https://fepu.atlassian.net/browse/ADR): Architektur- und Technik-Entscheidungen, je Bereich ein Epic. Aufbau: Status, Kontext, Entscheidung, Standard-Konfiguration, Alternativen, Folgen, Quelle. Label `standard` = gilt auch für neue Apps.
- **KM** (https://fepu.atlassian.net/browse/KM): Anleitungen mit Direktlinks (Label `anleitung`), Erfahrungen und Stolperfallen (`erfahrung`), Arbeitsweise und Vorlagen (`arbeitsweise`, `vorlage`). Startliste für neue Apps: KM-15.
- Vor technischen Entscheidungen in ADR nachsehen und dem Standard folgen. Weicht etwas ab oder kommt etwas Neues dazu: ADR anlegen oder das bestehende ergänzen (alte Entscheidung als „ersetzt durch ADR-x“ markieren).
- Neue Einrichtungs-Anleitung oder neue Erfahrung (auch aus gelösten PBIM-Incidents): KM-Eintrag anlegen.
