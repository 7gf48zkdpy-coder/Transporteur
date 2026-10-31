-- Transporteur VTC — client par carte qui ne paie pas.
--  Le paiement est demandé : à l'acceptation si le client est à plus de 8 km, sinon à l'arrivée du chauffeur.
--  Le chauffeur peut annuler (motif « Paiement non reçu ») quand :
--    • 8 minutes se sont écoulées depuis la demande de paiement, ou
--    • 5 minutes se sont écoulées ET il a appelé le client au moins 2 fois depuis la demande.
--  Les appels sont notés quand le chauffeur appuie sur le bouton « appeler » de l'appli.

alter table bookings add column if not exists driver_call_times timestamptz[] not null default '{}';

create or replace function pay_requested_at(b bookings) returns timestamptz
language sql stable set search_path = public as $$
  select case when card_pay_before_departure(b) then b.accepted_at else b.arrived_at end;
$$;

create or replace function log_driver_call(p_booking_id uuid) returns integer
language plpgsql security definer set search_path = public as $$
declare b bookings;
begin
  update bookings set driver_call_times = driver_call_times || now()
  where id = p_booking_id and driver_user_id = auth.uid() and status in ('ACCEPTED', 'DRIVER_ARRIVING')
  returning * into b;
  if not found then raise exception 'BOOKING_NOT_FOUND'; end if;
  return (select count(*) from unnest(b.driver_call_times) t where t >= coalesce(pay_requested_at(b), 'infinity'));
end $$;

-- État pour l'appli chauffeur : depuis quand le paiement est attendu, appels comptés, annulation possible ?
create or replace function unpaid_status(p_booking_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare b bookings; since timestamptz; mins numeric; calls int;
begin
  select * into b from bookings where id = p_booking_id and driver_user_id = auth.uid();
  if not found then raise exception 'BOOKING_NOT_FOUND'; end if;
  since := pay_requested_at(b);
  if b.onboard_method <> 'CARD' or b.prepaid_at is not null or since is null or b.status not in ('ACCEPTED', 'DRIVER_ARRIVING') then
    return jsonb_build_object('waiting', false);
  end if;
  mins := extract(epoch from now() - since) / 60;
  calls := (select count(*) from unnest(b.driver_call_times) t where t >= since);
  return jsonb_build_object('waiting', true, 'since', since, 'minutes', round(mins, 1), 'calls', calls,
    'can_cancel', mins >= 8 or (mins >= 5 and calls >= 2));
end $$;

create or replace function cancel_unpaid(p_booking_id uuid) returns bookings
language plpgsql security definer set search_path = public as $$
declare b bookings; s jsonb;
begin
  s := unpaid_status(p_booking_id);
  if not coalesce((s->>'can_cancel')::boolean, false) then raise exception 'TOO_EARLY_TO_CANCEL'; end if;
  perform trust();
  update bookings set status = 'CANCELLED', cancelled_at = now(), cancelled_by = auth.uid(), cancel_reason = 'Paiement non reçu'
  where id = p_booking_id returning * into b;
  perform untrust();
  insert into audit_log (actor_user_id, action, entity, entity_id, data)
  values (auth.uid(), 'CANCELLED_UNPAID', 'bookings', b.id::text, s);
  return b;
end $$;

revoke execute on function log_driver_call(uuid) from public, anon;
revoke execute on function unpaid_status(uuid) from public, anon;
revoke execute on function cancel_unpaid(uuid) from public, anon;
grant execute on function log_driver_call(uuid) to authenticated;
grant execute on function unpaid_status(uuid) to authenticated;
grant execute on function cancel_unpaid(uuid) to authenticated;

-- Texte des conditions d'annulation (affiché aux clients) aligné sur les règles actuelles.
update app_settings set doc = jsonb_set(coalesce(doc, '{}'::jsonb), '{annulation}', to_jsonb(
  'Annulation gratuite tant que le chauffeur n''est pas parti, et pendant ses 3 premières minutes de route (moins de 2 km). Ensuite : 1 € par km parcouru par le chauffeur, 3 € minimum, 8 € maximum, jamais plus que le prix de la course. Toujours gratuite si le chauffeur a plus de 5 minutes de retard ou ne se rapproche pas. Attente offerte : 6 minutes à l''arrivée du chauffeur, puis 0,50 € par minute. Client absent après 6 minutes d''attente : 8 €.'::text))
where id = 1;
