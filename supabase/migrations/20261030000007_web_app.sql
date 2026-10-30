-- Transporteur VTC — appli web (client + chauffeur) :
--   * paiement au choix : carte (Stripe, autorisation puis capture) ou à bord (payé au chauffeur) ;
--   * un chauffeur validé peut se rendre disponible sans compte Stripe : il ne reçoit alors que les courses payées à bord ;
--   * fin de course « à bord » sans Stripe ;
--   * les réservations à bord jamais prises en charge sont annulées automatiquement.

alter table bookings add column if not exists payment_method text not null default 'CARD'
  check (payment_method in ('CARD', 'ON_BOARD'));

-- ---------------------------------------------------------------- réservation
create or replace function create_booking_web(
  p_quote_id uuid, p_payment_method text default 'CARD',
  p_scheduled_at timestamptz default null, p_passengers smallint default 1, p_notes text default null
) returns bookings
language plpgsql security definer set search_path = public as $$
declare b bookings;
begin
  if p_payment_method not in ('CARD', 'ON_BOARD') then raise exception 'INVALID_PAYMENT_METHOD'; end if;
  if p_payment_method = 'ON_BOARD' and p_scheduled_at is null and exists (
       select 1 from bookings where client_user_id = auth.uid() and scheduled_at is null
         and status in ('REQUESTED', 'ACCEPTED', 'DRIVER_ARRIVING', 'IN_PROGRESS')
         and (payment_method = 'ON_BOARD' or payment_status <> 'PENDING')) then
    raise exception 'ACTIVE_BOOKING_EXISTS';
  end if;
  b := create_booking(p_quote_id, p_scheduled_at, p_passengers, left(p_notes, 500));
  if p_payment_method = 'ON_BOARD' then
    update bookings set payment_method = 'ON_BOARD' where id = b.id returning * into b;
  end if;
  return b;
end $$;

-- ---------------------------------------------------------------- disponibilité chauffeur
create or replace function guard_driver_update() returns trigger
language plpgsql set search_path = public as $$
begin
  if not (is_admin() or is_service()) then
    if new.partner_status is distinct from old.partner_status
       or new.stripe_account_id is distinct from old.stripe_account_id
       or new.stripe_payouts_enabled is distinct from old.stripe_payouts_enabled
       or new.rating is distinct from old.rating then
      raise exception 'DRIVER_FIELD_FORBIDDEN';
    end if;
  end if;
  if new.partner_status = 'VALIDATED' and old.partner_status <> 'VALIDATED'
     and not driver_documents_complete(new.user_id) then
    raise exception 'DOCUMENTS_INCOMPLETE';
  end if;
  if new.is_available and not old.is_available then
    if new.partner_status <> 'VALIDATED' then raise exception 'DRIVER_NOT_VALIDATED'; end if;
    if not exists (select 1 from vehicles where driver_user_id = new.user_id and is_active) then
      raise exception 'NO_ACTIVE_VEHICLE';
    end if;
  end if;
  if new.partner_status <> 'VALIDATED' then new.is_available := false; end if;
  return new;
end $$;

-- ---------------------------------------------------------------- acceptation
create or replace function accept_booking(p_booking_id uuid) returns bookings
language plpgsql security definer set search_path = public as $$
declare b bookings; d drivers; v vehicles;
begin
  select * into d from drivers where user_id = auth.uid();
  if not found or d.partner_status <> 'VALIDATED' then raise exception 'DRIVER_NOT_VALIDATED'; end if;
  if not d.is_available then raise exception 'DRIVER_NOT_AVAILABLE'; end if;
  if exists (select 1 from bookings where driver_user_id = d.user_id and status in ('ACCEPTED', 'DRIVER_ARRIVING', 'IN_PROGRESS')
             and (scheduled_at is null or scheduled_at < now() + interval '1 hour')) then
    raise exception 'DRIVER_BUSY';
  end if;

  select * into b from bookings where id = p_booking_id for update;
  if not found then raise exception 'BOOKING_NOT_FOUND'; end if;
  if b.status <> 'REQUESTED' or b.driver_user_id is not null then raise exception 'BOOKING_ALREADY_TAKEN'; end if;
  if b.payment_method = 'CARD' then
    if b.payment_status <> 'AUTHORIZED' then raise exception 'PAYMENT_NOT_AUTHORIZED'; end if;
    if not d.stripe_payouts_enabled then raise exception 'PAYOUTS_NOT_ENABLED'; end if;
  end if;

  select * into v from vehicles where driver_user_id = d.user_id and is_active order by created_at desc limit 1;
  if not found then raise exception 'NO_ACTIVE_VEHICLE'; end if;
  if v.vehicle_type <> b.vehicle_type then raise exception 'VEHICLE_TYPE_MISMATCH'; end if;
  if v.passenger_capacity < b.passengers then raise exception 'VEHICLE_TOO_SMALL'; end if;

  update bookings set status = 'ACCEPTED', driver_user_id = d.user_id, vehicle_id = v.id, accepted_at = now()
  where id = b.id returning * into b;
  return b;
end $$;

-- Courses proposées aux chauffeurs : payées par carte (autorisées) ou à bord.
alter policy bookings_select on bookings using (
  client_user_id = auth.uid()
  or driver_user_id = auth.uid()
  or is_admin()
  or (status = 'REQUESTED' and driver_user_id is null
      and (payment_status = 'AUTHORIZED' or payment_method = 'ON_BOARD')
      and is_validated_available_driver())
);

-- ---------------------------------------------------------------- fin de course payée à bord
create or replace function complete_onboard_booking(p_booking_id uuid) returns bookings
language plpgsql security definer set search_path = public as $$
declare b bookings;
begin
  select * into b from bookings where id = p_booking_id for update;
  if not found or b.driver_user_id <> auth.uid() then raise exception 'BOOKING_NOT_FOUND'; end if;
  if b.payment_method <> 'ON_BOARD' then raise exception 'CARD_BOOKING_USE_RIDE_COMPLETE'; end if;
  if b.status <> 'IN_PROGRESS' then raise exception 'INVALID_TRANSITION'; end if;
  update bookings set status = 'COMPLETED', payment_status = 'CAPTURED',
    final_fare_cents = quoted_fare_cents, completed_at = now()
  where id = b.id returning * into b;
  insert into audit_log (actor_user_id, action, entity, entity_id, data)
  values (auth.uid(), 'RIDE_COMPLETED_ON_BOARD', 'bookings', b.id::text,
          jsonb_build_object('fare_cents', b.quoted_fare_cents, 'commission_cents', b.commission_cents));
  return b;
end $$;

-- ---------------------------------------------------------------- maintenance
create or replace function expire_unpaid_bookings() returns integer
language plpgsql security definer set search_path = public as $$
declare n integer; m integer;
begin
  update bookings set status = 'CANCELLED', cancelled_at = now(), cancel_reason = 'PAYMENT_TIMEOUT'
  where status = 'REQUESTED' and payment_method = 'CARD' and payment_status = 'PENDING'
    and created_at < now() - interval '30 minutes';
  get diagnostics n = row_count;
  update bookings set status = 'CANCELLED', payment_status = 'CANCELED', cancelled_at = now(), cancel_reason = 'NO_DRIVER'
  where status = 'REQUESTED' and payment_method = 'ON_BOARD' and driver_user_id is null
    and coalesce(scheduled_at, created_at) < now() - interval '30 minutes';
  get diagnostics m = row_count;
  return n + m;
end $$;

-- ---------------------------------------------------------------- droits
revoke execute on function create_booking_web(uuid, text, timestamptz, smallint, text) from public, anon;
revoke execute on function complete_onboard_booking(uuid) from public, anon;
grant execute on function create_booking_web(uuid, text, timestamptz, smallint, text) to authenticated;
grant execute on function complete_onboard_booking(uuid) to authenticated;
revoke execute on function expire_unpaid_bookings() from public, anon, authenticated;
revoke execute on function guard_driver_update() from public, anon, authenticated;
grant execute on all functions in schema public to service_role;

-- ---------------------------------------------------------------- offre VOLT : Berline, Électrique, Van ; minimum 10 €
update pricing_rules set minimum_fare_cents = 1000 where active = true;
update vehicle_categories set enabled = true, sort_order = 3 where vehicle_type = 'VAN';
update vehicle_categories set enabled = false, sort_order = 4 where vehicle_type = 'SUV';
update vehicle_categories set sort_order = 2 where vehicle_type = 'ELECTRIC';
