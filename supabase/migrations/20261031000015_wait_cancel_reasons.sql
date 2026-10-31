-- Transporteur VTC — attente chez le client et motifs d'annulation.
--  • Le chauffeur signale son arrivée (« Je suis arrivé ») : 6 minutes d'attente offertes, puis 0,50 € par minute commencée.
--    Le supplément est figé au départ de la course (ou quand le chauffeur confirme un paiement par carte) et ajouté au prix final.
--  • L'administrateur peut lire le journal (motifs de désistement des chauffeurs).

alter table bookings add column if not exists arrived_at timestamptz;
alter table bookings add column if not exists wait_fee_cents integer not null default 0;

-- Supplément d'attente (centimes) entre l'arrivée du chauffeur et p_until.
create or replace function wait_fee(p_arrived timestamptz, p_until timestamptz) returns integer
language sql immutable as $$
  select case when p_arrived is null then 0
    else greatest(0, ceil(extract(epoch from (p_until - p_arrived)) / 60.0)::int - 6) * 50 end;
$$;

create or replace function driver_arrived(p_booking_id uuid) returns bookings
language plpgsql security definer set search_path = public as $$
declare b bookings;
begin
  select * into b from bookings where id = p_booking_id for update;
  if not found or b.driver_user_id <> auth.uid() then raise exception 'BOOKING_NOT_FOUND'; end if;
  if b.status not in ('ACCEPTED', 'DRIVER_ARRIVING') then raise exception 'INVALID_TRANSITION'; end if;
  update bookings set status = 'DRIVER_ARRIVING', arrived_at = coalesce(arrived_at, now()) where id = b.id returning * into b;
  return b;
end $$;

create or replace function confirm_prepayment(p_booking_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update bookings set prepaid_at = now(), wait_fee_cents = wait_fee(arrived_at, now())
  where id = p_booking_id and driver_user_id = auth.uid() and onboard_method = 'CARD' and status in ('ACCEPTED', 'DRIVER_ARRIVING') and prepaid_at is null;
  if not found then raise exception 'BOOKING_NOT_FOUND'; end if;
end $$;

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

create or replace function complete_onboard_booking(p_booking_id uuid) returns bookings
language plpgsql security definer set search_path = public as $$
declare b bookings; extra_com integer;
begin
  select * into b from bookings where id = p_booking_id for update;
  if not found or b.driver_user_id <> auth.uid() then raise exception 'BOOKING_NOT_FOUND'; end if;
  if b.payment_method <> 'ON_BOARD' then raise exception 'CARD_BOOKING_USE_RIDE_COMPLETE'; end if;
  if b.status <> 'IN_PROGRESS' then raise exception 'INVALID_TRANSITION'; end if;
  extra_com := round(coalesce(b.wait_fee_cents, 0) * 0.15);
  update bookings set status = 'COMPLETED', payment_status = 'CAPTURED',
    final_fare_cents = quoted_fare_cents + coalesce(wait_fee_cents, 0),
    commission_cents = coalesce(commission_cents, 0) + extra_com,
    driver_earnings_cents = coalesce(driver_earnings_cents, 0) + coalesce(wait_fee_cents, 0) - extra_com,
    completed_at = now()
  where id = b.id returning * into b;
  insert into audit_log (actor_user_id, action, entity, entity_id, data)
  values (auth.uid(), 'RIDE_COMPLETED_ON_BOARD', 'bookings', b.id::text,
          jsonb_build_object('fare_cents', b.final_fare_cents, 'wait_fee_cents', b.wait_fee_cents, 'commission_cents', b.commission_cents));
  return b;
end $$;

alter table audit_log enable row level security;
create policy audit_admin_read on audit_log for select to authenticated using (is_admin());

revoke execute on function driver_arrived(uuid) from public, anon;
grant execute on function driver_arrived(uuid) to authenticated;
