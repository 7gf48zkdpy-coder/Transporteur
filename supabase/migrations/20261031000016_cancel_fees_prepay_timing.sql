-- Transporteur VTC — frais d'annulation selon le trajet du chauffeur, et moment du paiement par carte.
--  • À l'acceptation : distance chauffeur → client (approach_km, route estimée = vol d'oiseau × 1,3).
--    Paiement par carte : client proche (≤ 8 km) → il paie à l'arrivée du chauffeur ;
--    client loin (> 8 km) → il paie AVANT que le chauffeur parte (départ bloqué sinon).
--  • Au départ du chauffeur (« Partir vers le client ») : heure et position de départ.
--  • Annulation par le client après le départ du chauffeur : gratuite si le chauffeur roule depuis moins de 3 min
--    ET a parcouru moins de 2 km ; sinon 1 € par km parcouru, minimum 5 €, maximum 8 €. Client absent : 8 €.
--    Le détail (minutes, km, frais) est gardé sur la course (cancel_info) et visible dans l'admin.

alter table bookings add column if not exists approach_km numeric(6,1);
alter table bookings add column if not exists departed_at timestamptz;
alter table bookings add column if not exists depart_lat double precision;
alter table bookings add column if not exists depart_lng double precision;
alter table bookings add column if not exists cancel_info jsonb;
alter table bookings add column if not exists cancel_fee_cents integer not null default 0;

create or replace function km_between(a_lat double precision, a_lng double precision, b_lat double precision, b_lng double precision) returns double precision
language sql immutable as $$
  select 2 * 6371 * asin(sqrt(sin(radians(b_lat - a_lat) / 2) ^ 2 + cos(radians(a_lat)) * cos(radians(b_lat)) * sin(radians(b_lng - a_lng) / 2) ^ 2));
$$;

create or replace function track_driver_trip() returns trigger
language plpgsql security definer set search_path = public as $$
declare loc driver_locations;
begin
  if new.driver_user_id is not null and (new.status is distinct from old.status) then
    select * into loc from driver_locations where driver_user_id = new.driver_user_id;
    if new.status = 'ACCEPTED' and old.status in ('REQUESTED', 'OFFERED') then
      new.approach_km := case when loc.lat is null or new.pickup_lat is null then null
        else round((km_between(loc.lat, loc.lng, new.pickup_lat, new.pickup_lng) * 1.3)::numeric, 1) end;
      new.departed_at := null; new.arrived_at := null; new.prepaid_at := null;
    elsif new.status = 'DRIVER_ARRIVING' and old.status = 'ACCEPTED' then
      new.departed_at := now(); new.depart_lat := loc.lat; new.depart_lng := loc.lng;
    end if;
  end if;
  return new;
end $$;
create or replace trigger bookings_track_driver_trip before update on bookings for each row execute function track_driver_trip();

-- Paiement par carte exigé avant le départ du chauffeur ?
create or replace function card_pay_before_departure(b bookings) returns boolean
language sql stable as $$
  select b.payment_method = 'ON_BOARD' and b.onboard_method = 'CARD' and coalesce(b.approach_km, 0) > 8;
$$;

-- Conditions d'annulation pour le client, à l'instant présent.
create or replace function cancel_terms_for(p_booking_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare b bookings; loc driver_locations; mins numeric := 0; km numeric := 0; fee integer := 0;
begin
  select * into b from bookings where id = p_booking_id;
  if not found then return null; end if;
  if b.status = 'DRIVER_ARRIVING' and b.departed_at is not null then
    mins := round(extract(epoch from now() - b.departed_at)::numeric / 60, 1);
    select * into loc from driver_locations where driver_user_id = b.driver_user_id;
    if loc.lat is not null and b.depart_lat is not null then km := round((km_between(b.depart_lat, b.depart_lng, loc.lat, loc.lng) * 1.3)::numeric, 1); end if;
    if b.arrived_at is not null then km := greatest(km, coalesce(b.approach_km, 0)); end if;
    if mins >= 3 or km >= 2 then fee := least(800, greatest(500, round(km)::int * 100)); end if;
  end if;
  fee := least(fee, b.quoted_fare_cents);
  return jsonb_build_object('status', b.status, 'driver_minutes', mins, 'driver_km', km, 'approach_km', b.approach_km,
    'driver_arrived', b.arrived_at is not null, 'free', fee = 0, 'fee_cents', fee, 'at', now());
end $$;

-- Version pour l'appli (client, chauffeur ou admin de la course).
create or replace function cancel_preview(p_booking_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from bookings where id = p_booking_id and (auth.uid() in (client_user_id, driver_user_id) or is_admin())) then
    raise exception 'BOOKING_NOT_FOUND';
  end if;
  return cancel_terms_for(p_booking_id);
end $$;

-- Départ et arrivée du chauffeur : paiement exigé avant de partir quand le client est loin.
create or replace function advance_booking(p_booking_id uuid, p_status booking_status) returns bookings
language plpgsql security definer set search_path = public as $$
declare b bookings;
begin
  select * into b from bookings where id = p_booking_id for update;
  if not found or b.driver_user_id <> auth.uid() then raise exception 'BOOKING_NOT_FOUND'; end if;
  if not ((b.status = 'ACCEPTED' and p_status = 'DRIVER_ARRIVING')
       or (b.status = 'DRIVER_ARRIVING' and p_status = 'IN_PROGRESS')) then
    raise exception 'INVALID_TRANSITION';
  end if;
  if p_status = 'DRIVER_ARRIVING' and card_pay_before_departure(b) and b.prepaid_at is null then
    raise exception 'PAYMENT_REQUIRED_BEFORE_DEPARTURE';
  end if;
  if p_status = 'IN_PROGRESS' and b.payment_method = 'ON_BOARD' and b.onboard_method = 'CARD' and b.prepaid_at is null then
    raise exception 'PAYMENT_NOT_RECEIVED';
  end if;
  update bookings set status = p_status,
    started_at = case when p_status = 'IN_PROGRESS' then now() else started_at end,
    wait_fee_cents = case when p_status = 'IN_PROGRESS' then
      case when prepaid_at is not null then wait_fee_cents else wait_fee(arrived_at, now()) end else wait_fee_cents end
  where id = b.id returning * into b;
  return b;
end $$;

create or replace function driver_arrived(p_booking_id uuid) returns bookings
language plpgsql security definer set search_path = public as $$
declare b bookings;
begin
  select * into b from bookings where id = p_booking_id for update;
  if not found or b.driver_user_id <> auth.uid() then raise exception 'BOOKING_NOT_FOUND'; end if;
  if b.status not in ('ACCEPTED', 'DRIVER_ARRIVING') then raise exception 'INVALID_TRANSITION'; end if;
  if b.status = 'ACCEPTED' and card_pay_before_departure(b) and b.prepaid_at is null then raise exception 'PAYMENT_REQUIRED_BEFORE_DEPARTURE'; end if;
  update bookings set status = 'DRIVER_ARRIVING', arrived_at = coalesce(arrived_at, now()) where id = b.id returning * into b;
  return b;
end $$;

revoke execute on function cancel_terms_for(uuid) from public, anon, authenticated;
grant execute on function cancel_terms_for(uuid) to service_role;
revoke execute on function cancel_preview(uuid) from public, anon;
grant execute on function cancel_preview(uuid) to authenticated;

-- À l'annulation : on fige la situation du chauffeur et les frais dans la course.
create or replace function record_cancel_terms() returns trigger
language plpgsql security definer set search_path = public as $$
declare t jsonb; by_client boolean; fee integer := 0;
begin
  if new.status = 'CANCELLED' and old.status is distinct from 'CANCELLED' then
    t := cancel_terms_for(new.id);  -- lit encore la course avant annulation
    by_client := new.cancelled_by is not null and new.cancelled_by = new.client_user_id;
    if by_client then fee := coalesce((t->>'fee_cents')::int, 0);
    elsif coalesce(new.cancel_reason, '') ilike 'NO_SHOW%' then fee := least(800, new.quoted_fare_cents);
    end if;
    new.cancel_fee_cents := fee;
    new.cancel_info := coalesce(t, '{}'::jsonb) || jsonb_build_object('by', case when by_client then 'CLIENT' when new.cancelled_by = new.driver_user_id then 'DRIVER' else 'OTHER' end,
      'fee_cents', fee, 'free', fee = 0);
  end if;
  return new;
end $$;
create or replace trigger bookings_record_cancel_terms before update on bookings for each row execute function record_cancel_terms();
