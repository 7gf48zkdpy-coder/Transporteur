-- Transporteur VTC — frais d'annulation plus justes.
--  • Jamais de frais quand le problème vient du chauffeur :
--      - il a dépassé de plus de 5 min l'heure d'arrivée prévue à son départ ;
--      - il ne se rapproche pas du client (3 min après son départ, pas plus près qu'au départ) ou s'en éloigne.
--  • Sinon, après 3 min de route ou 2 km : 1 € par km parcouru, minimum 3 €, maximum 8 € (jamais plus que la course).

alter table bookings add column if not exists eta_at timestamptz;

-- Heure d'arrivée prévue fixée au départ du chauffeur (≈ 30 km/h en ville, 3 min minimum).
create or replace function track_driver_trip() returns trigger
language plpgsql security definer set search_path = public as $$
declare loc driver_locations;
begin
  if new.driver_user_id is not null and (new.status is distinct from old.status) then
    select * into loc from driver_locations where driver_user_id = new.driver_user_id;
    if new.status = 'ACCEPTED' and old.status in ('REQUESTED', 'OFFERED') then
      new.approach_km := case when loc.lat is null or new.pickup_lat is null then null
        else round((km_between(loc.lat, loc.lng, new.pickup_lat, new.pickup_lng) * 1.3)::numeric, 1) end;
      new.departed_at := null; new.arrived_at := null; new.prepaid_at := null; new.eta_at := null;
    elsif new.status = 'DRIVER_ARRIVING' and old.status = 'ACCEPTED' then
      new.departed_at := now(); new.depart_lat := loc.lat; new.depart_lng := loc.lng;
      new.eta_at := now() + make_interval(mins => greatest(3, ceil(coalesce(
        case when loc.lat is not null and new.pickup_lat is not null then km_between(loc.lat, loc.lng, new.pickup_lat, new.pickup_lng) * 1.3 end,
        new.approach_km, 0) * 2))::int);
    end if;
  end if;
  return new;
end $$;

create or replace function cancel_terms_for(p_booking_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare b bookings; loc driver_locations; mins numeric := 0; km numeric := 0; fee integer := 0;
  d_start numeric; d_now numeric; late_min numeric := 0; waived text;
begin
  select * into b from bookings where id = p_booking_id;
  if not found then return null; end if;
  if b.status = 'DRIVER_ARRIVING' and b.departed_at is not null then
    mins := round(extract(epoch from now() - b.departed_at)::numeric / 60, 1);
    select * into loc from driver_locations where driver_user_id = b.driver_user_id;
    if loc.lat is not null and b.depart_lat is not null then km := round((km_between(b.depart_lat, b.depart_lng, loc.lat, loc.lng) * 1.3)::numeric, 1); end if;
    if b.arrived_at is not null then km := greatest(km, coalesce(b.approach_km, 0)); end if;
    if mins >= 3 or km >= 2 then fee := least(800, greatest(300, round(km)::int * 100)); end if;
    -- Faute du chauffeur → gratuit
    if b.arrived_at is null then
      if b.eta_at is not null and now() > b.eta_at + interval '5 minutes' then
        late_min := round(extract(epoch from now() - b.eta_at)::numeric / 60, 1);
        waived := 'DRIVER_LATE';
      elsif mins >= 3 and loc.lat is not null and b.depart_lat is not null and b.pickup_lat is not null then
        d_start := km_between(b.depart_lat, b.depart_lng, b.pickup_lat, b.pickup_lng);
        d_now := km_between(loc.lat, loc.lng, b.pickup_lat, b.pickup_lng);
        if d_now >= d_start - 0.2 then waived := case when d_now > d_start + 0.3 then 'DRIVER_MOVING_AWAY' else 'DRIVER_NOT_PROGRESSING' end; end if;
      end if;
    end if;
    if waived is not null then fee := 0; end if;
  end if;
  fee := least(fee, b.quoted_fare_cents);
  return jsonb_build_object('status', b.status, 'driver_minutes', mins, 'driver_km', km, 'approach_km', b.approach_km,
    'driver_arrived', b.arrived_at is not null, 'eta_at', b.eta_at, 'late_minutes', late_min, 'waived', waived,
    'free', fee = 0, 'fee_cents', fee, 'at', now());
end $$;
