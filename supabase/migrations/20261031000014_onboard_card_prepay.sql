-- Transporteur VTC — paiement « à bord » : le client choisit Espèces ou Carte.
-- Carte = le client paie le chauffeur AVANT le départ (lien Revolut ou virement instantané sur son RIB) ;
-- le chauffeur confirme la réception, et la course ne peut pas démarrer avant.

alter table bookings add column if not exists onboard_method text not null default 'CASH' check (onboard_method in ('CASH', 'CARD'));
alter table bookings add column if not exists prepaid_at timestamptz;
alter table drivers add column if not exists pay_revtag text;
alter table drivers add column if not exists pay_iban text;
alter table drivers add column if not exists pay_holder text;

-- Le client choisit Espèces ou Carte (tant que la course n'a pas commencé).
create or replace function set_onboard_method(p_booking_id uuid, p_method text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_method not in ('CASH', 'CARD') then raise exception 'INVALID_METHOD'; end if;
  update bookings set onboard_method = p_method
  where id = p_booking_id and client_user_id = auth.uid() and payment_method = 'ON_BOARD'
    and status in ('REQUESTED', 'ACCEPTED', 'DRIVER_ARRIVING') and prepaid_at is null;
  if not found then raise exception 'BOOKING_NOT_FOUND'; end if;
end $$;

-- Coordonnées de paiement du chauffeur, visibles uniquement par le client de la course en cours.
create or replace function booking_payment_info(p_booking_id uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('revtag', d.pay_revtag, 'iban', d.pay_iban, 'holder', coalesce(nullif(d.pay_holder, ''), p.display_name))
  from bookings b join drivers d on d.user_id = b.driver_user_id join profiles p on p.id = d.user_id
  where b.id = p_booking_id and b.client_user_id = auth.uid() and b.status in ('ACCEPTED', 'DRIVER_ARRIVING', 'IN_PROGRESS');
$$;

-- Le chauffeur confirme avoir reçu le paiement par carte.
create or replace function confirm_prepayment(p_booking_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update bookings set prepaid_at = now()
  where id = p_booking_id and driver_user_id = auth.uid() and onboard_method = 'CARD' and status in ('ACCEPTED', 'DRIVER_ARRIVING') and prepaid_at is null;
  if not found then raise exception 'BOOKING_NOT_FOUND'; end if;
end $$;

-- Démarrage de la course : refusé tant qu'un paiement par carte n'est pas confirmé.
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
    started_at = case when p_status = 'IN_PROGRESS' then now() else started_at end
  where id = b.id returning * into b;
  return b;
end $$;

revoke execute on function set_onboard_method(uuid, text) from public, anon;
revoke execute on function booking_payment_info(uuid) from public, anon;
revoke execute on function confirm_prepayment(uuid) from public, anon;
grant execute on function set_onboard_method(uuid, text) to authenticated;
grant execute on function booking_payment_info(uuid) to authenticated;
grant execute on function confirm_prepayment(uuid) to authenticated;
