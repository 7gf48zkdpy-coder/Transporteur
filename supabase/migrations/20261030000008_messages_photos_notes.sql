-- Transporteur VTC — messagerie client/chauffeur, photos de profil, note des clients, informations de l'entreprise.

alter table profiles add column if not exists avatar_url text;
alter table profiles add column if not exists client_rating numeric(2,1);
alter table profiles add column if not exists client_rating_count integer not null default 0;
alter table bookings add column if not exists client_rating smallint check (client_rating between 1 and 5);

-- Un utilisateur ne peut changer ni son rôle, ni son e-mail, ni sa note.
create or replace function guard_profile_update() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.role is distinct from old.role and not (is_admin() or is_service()) then raise exception 'ROLE_CHANGE_FORBIDDEN'; end if;
  if new.email is distinct from old.email and not is_service() then raise exception 'EMAIL_CHANGE_VIA_AUTH_ONLY'; end if;
  if (new.client_rating is distinct from old.client_rating or new.client_rating_count is distinct from old.client_rating_count) and not is_service() then
    raise exception 'RATING_FORBIDDEN';
  end if;
  return new;
end $$;

-- Le chauffeur note le client après la course.
create or replace function rate_client(p_booking_id uuid, p_rating smallint) returns void
language plpgsql security definer set search_path = public as $$
declare b bookings;
begin
  select * into b from bookings where id = p_booking_id;
  if not found or b.driver_user_id <> auth.uid() or b.status <> 'COMPLETED' then raise exception 'BOOKING_NOT_FOUND'; end if;
  if p_rating not between 1 and 5 then raise exception 'INVALID_RATING'; end if;
  update bookings set client_rating = p_rating where id = b.id;
  perform trust();
  update profiles set
    client_rating = (select round(avg(client_rating)::numeric, 1) from bookings where client_user_id = b.client_user_id and client_rating is not null),
    client_rating_count = (select count(*) from bookings where client_user_id = b.client_user_id and client_rating is not null)
  where id = b.client_user_id;
  perform untrust();
end $$;

-- Messagerie : uniquement entre le client et le chauffeur de la course, une fois la course acceptée (et 24 h après la fin).
create table if not exists messages (
  id bigint generated always as identity primary key,
  booking_id uuid not null references bookings(id) on delete cascade,
  sender_id uuid not null default auth.uid() references profiles(id),
  body text not null check (length(trim(body)) between 1 and 1000),
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists messages_booking_idx on messages(booking_id, created_at);
alter table messages enable row level security;

create or replace function is_booking_party(p_booking uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from bookings b where b.id = p_booking and auth.uid() in (b.client_user_id, b.driver_user_id));
$$;

create policy messages_select on messages for select to authenticated using (is_booking_party(booking_id) or is_admin());
create policy messages_insert on messages for insert to authenticated with check (
  sender_id = auth.uid() and is_booking_party(booking_id)
  and exists (select 1 from bookings b where b.id = booking_id and b.driver_user_id is not null
              and (b.status in ('ACCEPTED','DRIVER_ARRIVING','IN_PROGRESS') or (b.status = 'COMPLETED' and b.completed_at > now() - interval '24 hours'))));

create or replace function mark_messages_read(p_booking_id uuid) returns void
language sql security definer set search_path = public as $$
  update messages set read_at = now() where booking_id = p_booking_id and sender_id <> auth.uid() and read_at is null and is_booking_party(p_booking_id);
$$;
alter publication supabase_realtime add table messages;

-- Informations de l'entreprise (mentions légales, CGV, reçus), modifiables par l'admin.
create table if not exists app_settings (id smallint primary key default 1 check (id = 1), doc jsonb not null default '{}'::jsonb, updated_at timestamptz not null default now());
insert into app_settings (id, doc) values (1, jsonb_build_object('nom', 'Transporteur VTC', 'annulation',
  'Annulation gratuite tant que le chauffeur n''est pas en route. Une fois le chauffeur en route, des frais d''annulation de 10 € s''appliquent.'))
  on conflict (id) do nothing;
alter table app_settings enable row level security;
create policy app_settings_read on app_settings for select to anon, authenticated using (true);
create policy app_settings_admin on app_settings for update to authenticated using (is_admin()) with check (is_admin());
grant select on app_settings to anon;

-- Photos de profil : dossier public « avatars/<id utilisateur>/ ».
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 3145728, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
create policy "avatars upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- Droits
revoke execute on function rate_client(uuid, smallint) from public, anon;
revoke execute on function is_booking_party(uuid) from public, anon;
revoke execute on function mark_messages_read(uuid) from public, anon;
revoke execute on function guard_profile_update() from public, anon, authenticated;
grant execute on function rate_client(uuid, smallint) to authenticated;
grant execute on function is_booking_party(uuid) to authenticated;
grant execute on function mark_messages_read(uuid) to authenticated;

-- Reçu : noms du client, du chauffeur et véhicule, lisibles par les deux parties même après 24 h.
create or replace function get_receipt(p_booking_id uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'client_name', c.display_name, 'client_email', c.email,
    'driver_name', d.display_name, 'vehicle', case when v.id is null then null else jsonb_build_object('make', v.make, 'model', v.model, 'plate', v.registration_number) end)
  from bookings b
  join profiles c on c.id = b.client_user_id
  left join profiles d on d.id = b.driver_user_id
  left join vehicles v on v.id = b.vehicle_id
  where b.id = p_booking_id and b.status = 'COMPLETED' and (auth.uid() in (b.client_user_id, b.driver_user_id) or is_admin());
$$;
revoke execute on function get_receipt(uuid) from public, anon;
grant execute on function get_receipt(uuid) to authenticated;
