-- Suppression d'une course par l'administrateur (copie complète gardée dans audit_log).
-- Refusée si la course est en cours ou si un paiement carte est encore bloqué (annuler d'abord).
create or replace function admin_delete_booking(p_booking_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare b bookings;
begin
  if not is_admin() then raise exception 'FORBIDDEN'; end if;
  select * into b from bookings where id = p_booking_id for update;
  if not found then raise exception 'BOOKING_NOT_FOUND'; end if;
  if b.status in ('ACCEPTED', 'DRIVER_ARRIVING', 'IN_PROGRESS') then raise exception 'BOOKING_RUNNING'; end if;
  if b.payment_method = 'CARD' and b.payment_status = 'AUTHORIZED' then raise exception 'PAYMENT_HELD'; end if;
  insert into audit_log(actor_user_id, action, entity, entity_id, data)
  values (auth.uid(), 'REMOVE', 'booking', b.id::text, jsonb_build_object(
    'booking', to_jsonb(b),
    'payments', (select coalesce(jsonb_agg(to_jsonb(p)), '[]') from payments p where p.booking_id = b.id),
    'payouts', (select coalesce(jsonb_agg(to_jsonb(o)), '[]') from payouts o where o.booking_id = b.id)));
  delete from payouts where booking_id = b.id;
  delete from payments where booking_id = b.id;
  delete from bookings where id = b.id; -- messages et historique supprimés en cascade
end $$;
revoke execute on function admin_delete_booking(uuid) from public, anon;
grant execute on function admin_delete_booking(uuid) to authenticated;
