-- Transporteur : factures, paiement par carte (Stripe), badge Éco sur le suivi, nettoyage
-- À coller dans Supabase > SQL Editor > New query, puis « Run ».

-- 1. Informations d'entreprise de chaque chauffeur (pour ses factures) : nom, SIRET, adresse…
alter table public.drivers add column if not exists entreprise jsonb;

-- 2. Compteur de factures : une suite de numéros par émetteur et par année (2026-0001, 2026-0002…)
create table if not exists public.factures_compteur (
  emetteur uuid not null, annee int not null, n int not null default 0,
  primary key (emetteur, annee));
alter table public.factures_compteur enable row level security;   -- aucun accès direct : seulement via facture_course()

-- 3. Facture d'une course terminée. Le numéro est attribué une seule fois, à la première demande,
--    et toutes les infos (émetteur, prix, trajet) sont figées dans la course.
create or replace function public.facture_course(bid uuid)
 returns json language plpgsql security definer set search_path to 'public'
as $function$
declare b public.bookings; d public.drivers; adm public.drivers; em jsonb; cle uuid; y int; num int; f jsonb;
begin
  select * into b from public.bookings where id = bid for update;
  if b.id is null then raise exception 'Course introuvable'; end if;
  if not (b.client_uid = auth.uid() or b.driver_id = auth.uid() or public.is_admin()) then raise exception 'Accès refusé'; end if;
  if b.doc ? 'facture' then return b.doc->'facture'; end if;
  if b.statut <> 'terminee' then raise exception 'La facture sera disponible quand la course sera terminée.'; end if;
  select * into d from public.drivers where id = b.driver_id;
  -- Émetteur : le chauffeur s'il a renseigné son SIRET, sinon le compte principal
  if coalesce(d.entreprise->>'siret', '') <> '' then
    em := d.entreprise; cle := d.id;
  else
    select * into adm from public.drivers where is_admin order by created_at limit 1;
    em := coalesce(adm.entreprise, (select doc->'entreprise' from public.settings where id = 1));
    cle := adm.id;
  end if;
  if coalesce(em->>'siret', '') = '' then
    raise exception 'Facture pas encore disponible : les informations de l''entreprise (SIRET) ne sont pas renseignées.';
  end if;
  y := extract(year from now() at time zone 'Europe/Paris');
  insert into public.factures_compteur (emetteur, annee, n) values (cle, y, 1)
    on conflict (emetteur, annee) do update set n = public.factures_compteur.n + 1
    returning n into num;
  f := jsonb_build_object(
    'numero', y || '-' || lpad(num::text, 4, '0'),
    'date', to_char(now() at time zone 'Europe/Paris', 'YYYY-MM-DD'),
    'emetteur', em,
    'chauffeur', trim(coalesce(d.prenom, '') || ' ' || coalesce(d.nom, '')),
    'client', trim(coalesce(b.doc->>'clientPrenom', '') || ' ' || coalesce(b.doc->>'clientNom', '')),
    'prix', b.doc->'prix', 'depart', b.doc->'depart'->>'label', 'arrivee', b.doc->'arrivee'->>'label',
    'jour', b.doc->>'date', 'heure', b.doc->>'time', 'km', b.doc->'km', 'categorie', b.doc->>'categorieNom',
    'lignes', b.doc->'tarif'->'lignes', 'paiement', b.doc->>'paiement', 'paye', coalesce((b.doc->>'paye')::boolean, false));
  perform set_config('app.rpc', '1', true);
  update public.bookings set doc = doc || jsonb_build_object('facture', f) where id = bid;
  return f;
end $function$;
revoke all on function public.facture_course(uuid) from public, anon;
grant execute on function public.facture_course(uuid) to authenticated;

-- 4. Un chauffeur ne peut pas modifier une facture ni les infos du paiement par carte
create or replace function public.bookings_guard()
 returns trigger language plpgsql security definer set search_path to 'public'
as $function$
declare attrib_changed boolean; k text;
  locked text[] := array['km','duree','prix','prixTrajet','approcheMin','approcheKm','horsZone','forfait','depart','arrivee','commission','commissionPct',
                         'categorie','categorieNom','options','tarif','longueDistance','facture','stripeSession','payeVia'];
begin
  if auth.uid() is null or public.is_admin() or current_setting('app.rpc', true) = '1' then
    return new;
  end if;
  attrib_changed := new.client_uid is distinct from old.client_uid
    or new.driver_id is distinct from old.driver_id or new.offered_to is distinct from old.offered_to
    or new.offered_at is distinct from old.offered_at or new.refused is distinct from old.refused
    or new.requested_driver is distinct from old.requested_driver;
  if public.is_driver() and old.driver_id = auth.uid() then
    if attrib_changed then raise exception 'Modification non autorisée'; end if;
    foreach k in array locked loop
      if old.doc ? k then new.doc := jsonb_set(new.doc, array[k], old.doc->k);
      else new.doc := new.doc - k; end if;
    end loop;
    return new;
  end if;
  if attrib_changed
     or (new.doc - 'shareToken') is distinct from (old.doc - 'shareToken')
     or (old.doc ? 'shareToken' and new.doc->>'shareToken' is distinct from old.doc->>'shareToken') then
    raise exception 'Modification non autorisée';
  end if;
  return new;
end $function$;

-- 5. Lien de suivi : on ajoute la motorisation (badge 🌿 Éco)
create or replace function public.get_tracking(tok text)
 returns json language plpgsql stable security definer set search_path to 'public'
as $function$
declare b public.bookings; d public.drivers; live boolean;
begin
  if tok is null or length(tok) < 32 then return null; end if;
  select * into b from public.bookings where doc->>'shareToken' = tok limit 1;
  if b.id is null then return null; end if;
  select * into d from public.drivers where id = b.driver_id;
  live := b.statut = 'confirmee' and coalesce(b.doc->>'phase', '') in ('approche', 'arrive', 'abord')
          and d.lat is not null and (extract(epoch from now()) * 1000 - coalesce(d.at, 0)) < 15 * 60 * 1000;
  return json_build_object(
    'statut', b.statut, 'phase', b.doc->>'phase', 'date', b.doc->>'date', 'time', b.doc->>'time',
    'prenom', b.doc->>'clientPrenom', 'depart', b.doc->'depart', 'arrivee', b.doc->'arrivee', 'arriveAt', b.doc->'arriveAt',
    'chauffeur', case when d.id is null then null else json_build_object('prenom', d.prenom, 'modele', d.modele, 'plaque', d.plaque, 'energie', d.energie) end,
    'driver', case when live then json_build_object('lat', d.lat, 'lng', d.lng, 'at', d.at) else null end);
end $function$;

-- 6. Nettoyage : ancienne fonction plus utilisée, réglage de sécurité, index manquant
drop function if exists public.drivers_live();
alter function public.cat_ok(text, text) set search_path to 'public';
create index if not exists bookings_requested_driver_idx on public.bookings (requested_driver);

-- 7. Règles d'accès plus rapides : la connexion est vérifiée une fois par requête au lieu d'une fois par ligne
do $$
declare r record; q text; w text; s text;
begin
  for r in select tablename, policyname, qual, with_check from pg_policies where schemaname = 'public' loop
    q := r.qual; w := r.with_check;
    q := regexp_replace(q, '(?<!SELECT )(auth\.(uid|jwt)\(\)|is_admin\(\)|is_driver\(\))', '(select \1)', 'g');
    w := regexp_replace(w, '(?<!SELECT )(auth\.(uid|jwt)\(\)|is_admin\(\)|is_driver\(\))', '(select \1)', 'g');
    if q is distinct from r.qual or w is distinct from r.with_check then
      s := format('alter policy %I on public.%I', r.policyname, r.tablename);
      if q is not null then s := s || format(' using (%s)', q); end if;
      if w is not null then s := s || format(' with check (%s)', w); end if;
      execute s;
    end if;
  end loop;
end $$;
