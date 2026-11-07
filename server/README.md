# Server: Supabase einrichten (etwa 15 Minuten)

Damit Eltern ihre Party geschützt speichern und teilen können. Ohne diese Schritte läuft die App wie bisher (Daten stecken im Link).

## Was der Server macht

- Planen geht ohne Konto, alles bleibt im Gerät.
- Wer teilen will, meldet sich mit einem Code aus der E-Mail an. Kein Passwort.
- Jede Rolle bekommt einen eigenen Link mit langem Zufallsschlüssel. Der Link zeigt nur, was die Rolle braucht:
  - **Einladung** (`einladung.html?k=…`): Termin, Treffpunkt, Abholen, Hinweis. Keine Route.
  - **Vorausgeher** (`vorausgeher.html?k=…`): Route und Stationen.
  - **iPad** (`spiel.html?k=…`): die ganze Tour. Danach läuft das Spiel offline.
- Gäste, Vorausgeher und iPad brauchen kein Konto. In der Party-Übersicht unter „Link sperren“ ersetzt „Neuer Link“ einen Link. Der alte geht dann nicht mehr.
- 30 Tage nach der Party sind die Links tot, und die Daten werden gelöscht.

## Schritte

1. **Projekt anlegen** auf supabase.com: „New project“, Region **Central EU (Frankfurt)**. Das Datenbank-Passwort sicher ablegen; die App braucht es nicht.
2. **Datenbank:** Database → Extensions → `pg_cron` einschalten (für das Löschen nach 30 Tagen). Dann SQL Editor → Inhalt von `server/supabase.sql` einfügen → Run.
3. **Anmeldung per Code:** Authentication → Emails → Templates. In „Magic Link“ und „Confirm signup“ den Code einfügen, zum Beispiel:
   `<h2>Dein Code für Funkels Regenbogen</h2><p style="font-size:28px;letter-spacing:4px"><b>{{ .Token }}</b></p><p>Oder hier tippen: <a href="{{ .ConfirmationURL }}">Anmelden</a></p>`
   Der Code ist wichtig: Der Link aus der Mail öffnet sich auf dem iPhone oft in einem anderen Browser, dort fehlt die Party.
4. **Adressen erlauben:** Authentication → URL Configuration. Site URL `https://dafelix1888.github.io/einhorn/app/`, bei Redirect URLs `https://dafelix1888.github.io/einhorn/app/**` eintragen.
5. **Schlüssel eintragen:** Project Settings → API. „Project URL“ und den öffentlichen Schlüssel („anon“ bzw. „publishable“) oben in `app/konto.js` bei `SUPABASE_URL` und `SUPABASE_KEY` eintragen. Beide sind nicht geheim, geschützt wird über die Regeln in `supabase.sql`. **Nie** den `service_role`- oder `secret`-Schlüssel eintragen.

## Vor dem Start für fremde Eltern

- **Eigener Mailversand:** Der eingebaute Versand von Supabase schickt nur an Mitglieder des eigenen Supabase-Teams und nur wenige Mails pro Stunde. Für echte Nutzer unter Authentication → Emails → SMTP einen Anbieter eintragen (zum Beispiel Brevo, Resend, Postmark; mit Server in der EU).
- **Datenschutz:** Hinweis zur Speicherung (E-Mail, Party-Daten, Löschung nach 30 Tagen) in die Datenschutzerklärung; Supabase als Auftragsverarbeiter (DPA im Dashboard).

## Testen

`tests/t-konto.cjs` (außerhalb des Repos) spielt alles gegen ein nachgebautes Supabase durch: Anmelden, Links je Rolle, Gast ohne Route, Sperren, zweites Gerät, fremdes Konto, Löschen. `supabase.sql` ist gegen PostgreSQL 16 mit nachgebauten Supabase-Rollen geprüft.
