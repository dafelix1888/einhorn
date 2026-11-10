-- Zauberspiegel: Datenbank für gespeicherte Partys und geschützte Links.
-- Einmal im Supabase-Projekt ausführen: Dashboard → SQL Editor → einfügen → Run.
-- Kann gefahrlos noch einmal ausgeführt werden.
--
-- Prinzip:
--  * Eltern, die feiern, melden sich per E-Mail-Code an. Nur sie sehen und ändern ihre Partys (Row Level Security).
--  * Gäste, Vorausgeher und iPad brauchen kein Konto. Sie bekommen einen Link mit einem langen Zufallsschlüssel.
--    Der Schlüssel zeigt nur das, was die Rolle braucht (die Daten legt die App beim Speichern pro Rolle ab).
--  * Ein Link lässt sich sperren, indem die Eltern einen neuen erzeugen (alte Zeile wird gelöscht).
--  * 30 Tage nach der Party werden die Daten gelöscht.

create table if not exists public.parties (
  id          uuid primary key,
  owner       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  thema       text not null check (thema ~ '^[a-z0-9-]{1,40}$'),
  party       jsonb not null,
  plan        jsonb,
  datum       date,
  erstellt    timestamptz not null default now(),
  aktualisiert timestamptz not null default now(),
  constraint parties_groesse check (pg_column_size(party) + coalesce(pg_column_size(plan),0) < 400000)
);
create index if not exists parties_owner on public.parties(owner);

create table if not exists public.links (
  token     text primary key check (token ~ '^[A-Za-z0-9_-]{22,64}$'),
  party_id  uuid not null references public.parties(id) on delete cascade,
  owner     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  rolle     text not null check (rolle in ('gast','vorausgeher','spiel')),
  daten     jsonb not null,
  erstellt  timestamptz not null default now(),
  constraint links_groesse check (pg_column_size(daten) < 200000)
);
create index if not exists links_party on public.links(party_id);

-- Zeitstempel bei jeder Änderung
create or replace function public.zeit_setzen() returns trigger language plpgsql set search_path = public as $$
begin new.aktualisiert := now(); return new; end $$;
drop trigger if exists parties_zeit on public.parties;
create trigger parties_zeit before update on public.parties for each row execute function public.zeit_setzen();

-- Zugriff: nur die eigenen Zeilen, und nur für angemeldete Eltern. Ohne Anmeldung (anon) geht nichts direkt.
alter table public.parties enable row level security;
alter table public.links   enable row level security;

drop policy if exists "eigene Partys" on public.parties;
create policy "eigene Partys" on public.parties for all to authenticated
  using (owner = auth.uid()) with check (owner = auth.uid());

drop policy if exists "eigene Links" on public.links;
create policy "eigene Links" on public.links for all to authenticated
  using (owner = auth.uid())
  with check (owner = auth.uid() and exists (select 1 from public.parties p where p.id = party_id and p.owner = auth.uid()));

revoke all on public.parties, public.links from anon;
grant select, insert, update, delete on public.parties, public.links to authenticated;

-- Link einlösen: einziger Weg für Gäste, Vorausgeher und iPad. Gibt nur die Daten dieses einen Links zurück.
create or replace function public.link_lesen(t text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('rolle', l.rolle, 'daten', l.daten)
  from public.links l join public.parties p on p.id = l.party_id
  where l.token = t
    and (p.datum is null or p.datum >= current_date - 30)
  limit 1
$$;
revoke all on function public.link_lesen(text) from public;
grant execute on function public.link_lesen(text) to anon, authenticated;

-- Aufräumen: Partys 30 Tage nach dem Termin löschen (Links gehen mit).
create or replace function public.alte_partys_loeschen() returns integer
language sql security definer set search_path = public as $$
  with weg as (delete from public.parties where datum < current_date - 30 returning 1)
  select count(*)::int from weg
$$;
revoke all on function public.alte_partys_loeschen() from public, anon, authenticated;

-- Täglich um 3:17 Uhr aufräumen, falls pg_cron verfügbar ist (Supabase: Database → Extensions → pg_cron).
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.unschedule(jobid) from cron.job where jobname = 'alte-partys';
    perform cron.schedule('alte-partys', '17 3 * * *', 'select public.alte_partys_loeschen()');
  end if;
end $$;

-- Vorausgeher live: Haken „Station steht“ für iPad und Eltern. Schreiben darf nur der Vorausgeher-Link,
-- lesen dürfen Vorausgeher- und iPad-Link (und die Eltern über ihre Party). Gäste sehen nichts.
create table if not exists public.aufbau (
  party_id     uuid primary key references public.parties(id) on delete cascade,
  stationen    jsonb not null default '{}',
  aktualisiert timestamptz not null default now()
);
alter table public.aufbau enable row level security;
drop policy if exists "eigener Aufbau" on public.aufbau;
create policy "eigener Aufbau" on public.aufbau for select to authenticated
  using (exists (select 1 from public.parties p where p.id = party_id and p.owner = auth.uid()));
revoke all on public.aufbau from anon;
grant select on public.aufbau to authenticated;

create or replace function public.aufbau_setzen(t text, stationen jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare pid uuid; sauber jsonb;
begin
  select l.party_id into pid from public.links l join public.parties p on p.id = l.party_id
    where l.token = t and l.rolle = 'vorausgeher' and (p.datum is null or p.datum >= current_date - 30);
  if pid is null then return null; end if;
  if jsonb_typeof(stationen) is distinct from 'object' then return null; end if;
  select coalesce(jsonb_object_agg(key, true), '{}') into sauber
    from jsonb_each(stationen) where key ~ '^[0-9]{1,2}$' and value = 'true'::jsonb;
  insert into public.aufbau(party_id, stationen, aktualisiert) values (pid, sauber, now())
    on conflict (party_id) do update set stationen = excluded.stationen, aktualisiert = now();
  return jsonb_build_object('stationen', sauber);
end $$;
revoke all on function public.aufbau_setzen(text, jsonb) from public;
grant execute on function public.aufbau_setzen(text, jsonb) to anon, authenticated;

create or replace function public.aufbau_lesen(t text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('stationen', coalesce(a.stationen, '{}'), 'aktualisiert', a.aktualisiert)
  from public.links l join public.parties p on p.id = l.party_id
  left join public.aufbau a on a.party_id = l.party_id
  where l.token = t and l.rolle in ('vorausgeher','spiel') and (p.datum is null or p.datum >= current_date - 30)
  limit 1
$$;
revoke all on function public.aufbau_lesen(text) from public;
grant execute on function public.aufbau_lesen(text) to anon, authenticated;

-- Nach der Party: Gast-Eltern geben mit einem Tipp Rückmeldung (1 = geht so, 2 = gut, 3 = super).
-- Schreiben nur mit dem Einladungs-Link, höchstens 100 je Party; lesen nur die Eltern der Party.
create table if not exists public.feedback (
  id        bigint generated always as identity primary key,
  party_id  uuid not null references public.parties(id) on delete cascade,
  wert      smallint not null check (wert between 1 and 3),
  erstellt  timestamptz not null default now()
);
create index if not exists feedback_party on public.feedback(party_id);
alter table public.feedback enable row level security;
drop policy if exists "eigenes Feedback" on public.feedback;
create policy "eigenes Feedback" on public.feedback for select to authenticated
  using (exists (select 1 from public.parties p where p.id = party_id and p.owner = auth.uid()));
revoke all on public.feedback from anon;
grant select on public.feedback to authenticated;

create or replace function public.feedback_geben(t text, wert int) returns boolean
language plpgsql security definer set search_path = public as $$
declare pid uuid;
begin
  if wert is null or wert < 1 or wert > 3 then return false; end if;
  select l.party_id into pid from public.links l join public.parties p on p.id = l.party_id
    where l.token = t and l.rolle = 'gast' and (p.datum is null or p.datum >= current_date - 30);
  if pid is null then return false; end if;
  if (select count(*) from public.feedback f where f.party_id = pid) >= 100 then return false; end if;
  insert into public.feedback(party_id, wert) values (pid, wert);
  return true;
end $$;
revoke all on function public.feedback_geben(text, int) from public;
grant execute on function public.feedback_geben(text, int) to anon, authenticated;

-- Namens-Sätze (Edge Function „namen“, nur der Server liest und schreibt)
create table if not exists public.namen (
  party_id     uuid primary key references public.parties(id) on delete cascade,
  erzeugungen  int not null default 0,
  hash         text,
  saetze       jsonb,
  aktualisiert timestamptz not null default now(),
  constraint namen_groesse check (saetze is null or pg_column_size(saetze) < 1500000)
);
alter table public.namen enable row level security;
revoke all on public.namen from anon, authenticated;

-- Verbrauch der Stimme je Monat (UNICORN-8, Schwelle STRAT-2: 20 Erzeugungen/Monat). Ohne Namen, ohne Party-Bezug.
-- Ablesen: select * from stimm_verbrauch order by monat desc;
create table if not exists public.stimm_verbrauch (
  monat        date primary key,
  erzeugungen  int not null default 0,
  zeichen      int not null default 0,
  aktualisiert timestamptz not null default now()
);
alter table public.stimm_verbrauch enable row level security;
revoke all on public.stimm_verbrauch from anon, authenticated;
create or replace function public.stimm_verbrauch_zaehlen(z int)
returns void language sql security definer set search_path = public as $$
  insert into public.stimm_verbrauch(monat, erzeugungen, zeichen)
  values (date_trunc('month', now() at time zone 'Europe/Berlin')::date, 1, greatest(z, 0))
  on conflict (monat) do update set erzeugungen = stimm_verbrauch.erzeugungen + 1,
                                    zeichen = stimm_verbrauch.zeichen + excluded.zeichen,
                                    aktualisiert = now();
$$;
revoke all on function public.stimm_verbrauch_zaehlen(int) from public, anon, authenticated;
grant execute on function public.stimm_verbrauch_zaehlen(int) to service_role;

-- Fehlermeldungen aus der App (anonym, technisch). Schreiben über fehler_melden, lesen nur der Server/Dashboard.
-- Gleiche Meldung wird gezählt statt neu angelegt (kennung = md5 aus Seite, Meldung, Datei, Zeile). Löschen nach 90 Tagen.
create table if not exists public.fehler (
  id           bigint generated always as identity primary key,
  kennung      text not null unique,
  seite        text not null,
  meldung      text not null,
  quelle       text,
  zeile        int,
  stapel       text,
  version      text,
  geraet       text,
  anzahl       int not null default 1,
  erstmals     timestamptz not null default now(),
  zuletzt      timestamptz not null default now(),
  ticket       text
);
alter table public.fehler enable row level security;
revoke all on public.fehler from anon, authenticated;

create or replace function public.fehler_melden(seite text, meldung text, quelle text, zeile int, stapel text, version text, geraet text)
returns boolean language plpgsql security definer set search_path = public as $$
declare k text;
begin
  if meldung is null or length(meldung) = 0 then return false; end if;
  seite := left(regexp_replace(coalesce(seite,''), '[?#].*$', ''), 200);
  meldung := left(regexp_replace(meldung, '\?[^\s):''"]*', '', 'g'), 500);
  quelle := left(regexp_replace(coalesce(quelle,''), '[?#].*$', ''), 300);
  stapel := left(regexp_replace(coalesce(stapel,''), '\?[^\s):]*', '', 'g'), 2000);
  version := left(version, 40);
  geraet := left(geraet, 160);
  k := md5(seite || '|' || meldung || '|' || quelle || '|' || coalesce(zeile, 0));
  if (select count(*) from public.fehler) >= 5000 and not exists (select 1 from public.fehler where kennung = k) then return false; end if;
  insert into public.fehler(kennung, seite, meldung, quelle, zeile, stapel, version, geraet)
    values (k, seite, meldung, quelle, zeile, stapel, version, geraet)
  on conflict (kennung) do update set anzahl = public.fehler.anzahl + 1, zuletzt = now(),
    version = excluded.version, geraet = excluded.geraet;
  return true;
end $$;
revoke all on function public.fehler_melden(text, text, text, int, text, text, text) from public;
grant execute on function public.fehler_melden(text, text, text, int, text, text, text) to anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'alte-fehler';
    perform cron.schedule('alte-fehler', '27 3 * * *', $c$delete from public.fehler where zuletzt < now() - interval '90 days'$c$);
  end if;
end $$;

-- Gästeliste (UNICORN-29): Gast-Eltern sagen über den Einladungs-Link zu oder ab. Gespeichert werden nur der Vorname
-- des Kindes und ja/nein. Schreiben nur mit dem Einladungs-Link (höchstens 60 je Party, bis zum Partytag);
-- lesen und entfernen nur die Eltern der Party. Geht mit der Party weg (30 Tage danach).
create table if not exists public.antworten (
  party_id  uuid not null references public.parties(id) on delete cascade,
  kennung   text not null check (kennung ~ '^[A-Za-z0-9_-]{16,40}$'),
  name      text not null check (char_length(name) between 1 and 40),
  kommt     boolean not null,
  erstellt  timestamptz not null default now(),
  geaendert timestamptz not null default now(),
  primary key (party_id, kennung)
);
alter table public.antworten enable row level security;
drop policy if exists "eigene Antworten lesen" on public.antworten;
create policy "eigene Antworten lesen" on public.antworten for select to authenticated
  using (exists (select 1 from public.parties p where p.id = party_id and p.owner = auth.uid()));
drop policy if exists "eigene Antworten entfernen" on public.antworten;
create policy "eigene Antworten entfernen" on public.antworten for delete to authenticated
  using (exists (select 1 from public.parties p where p.id = party_id and p.owner = auth.uid()));
revoke all on public.antworten from anon, authenticated;
grant select, delete on public.antworten to authenticated;

-- t = Schlüssel des Einladungs-Links, k = Kennung des Geräts (damit „Antwort ändern“ denselben Eintrag trifft),
-- n = Vorname des Kindes, ja = kommt oder kommt nicht.
create or replace function public.antwort_geben(t text, k text, n text, ja boolean) returns boolean
language plpgsql security definer set search_path = public as $$
declare pid uuid; sauber text;
begin
  if ja is null or k is null or k !~ '^[A-Za-z0-9_-]{16,40}$' then return false; end if;
  sauber := btrim(left(btrim(regexp_replace(regexp_replace(coalesce(n,''), '[[:cntrl:]<>]', '', 'g'), '\s+', ' ', 'g')), 40));
  if char_length(sauber) < 1 then return false; end if;
  select l.party_id into pid from public.links l join public.parties p on p.id = l.party_id
    where l.token = t and l.rolle = 'gast' and (p.datum is null or p.datum >= current_date);
  if pid is null then return false; end if;
  if not exists (select 1 from public.antworten a where a.party_id = pid and a.kennung = k)
     and (select count(*) from public.antworten a where a.party_id = pid) >= 60 then return false; end if;
  insert into public.antworten(party_id, kennung, name, kommt) values (pid, k, sauber, ja)
    on conflict (party_id, kennung) do update set name = excluded.name, kommt = excluded.kommt, geaendert = now();
  return true;
end $$;
revoke all on function public.antwort_geben(text, text, text, boolean) from public;
grant execute on function public.antwort_geben(text, text, text, boolean) to anon, authenticated;

-- Wie oft die Einladung geöffnet wurde: nur ein Zähler am Einladungs-Link, die App meldet jedes Gerät einmal.
alter table public.links add column if not exists geoeffnet int not null default 0;
create or replace function public.einladung_gesehen(t text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  update public.links set geoeffnet = geoeffnet + 1 where token = t and rolle = 'gast' and geoeffnet < 100000;
  return found;
end $$;
revoke all on function public.einladung_gesehen(text) from public;
grant execute on function public.einladung_gesehen(text) to anon, authenticated;
