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
create or replace function public.zeit_setzen() returns trigger language plpgsql as $$
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
