-- Transporteur VTC — partage de course avec une personne de confiance.
-- Le client crée un lien secret ; la personne qui l'ouvre (sans compte) voit en direct :
-- statut, départ / arrivée, prénom du chauffeur, véhicule et plaque, position du chauffeur.
-- Le lien ne montre plus rien 30 minutes après la fin (ou l'annulation) de la course.

alter table bookings add column if not exists share_token uuid unique;

create or replace function create_share_link(p_booking_id uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare tok uuid;
begin
  update bookings set share_token = coalesce(share_token, gen_random_uuid())
  where id = p_booking_id and client_user_id = auth.uid() and status in ('REQUESTED', 'ACCEPTED', 'DRIVER_ARRIVING', 'IN_PROGRESS')
  returning share_token into tok;
  if tok is null then raise exception 'BOOKING_NOT_FOUND'; end if;
  return tok;
end $$;

create or replace function shared_ride(p_token uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'status', b.status,
    'pickup', b.pickup_label, 'pickup_lat', b.pickup_lat, 'pickup_lng', b.pickup_lng,
    'destination', b.destination_label, 'destination_lat', b.destination_lat, 'destination_lng', b.destination_lng,
    'client', split_part(coalesce(c.display_name, ''), ' ', 1),
    'driver', split_part(coalesce(d.display_name, ''), ' ', 1),
    'vehicle', case when v.id is null then null else jsonb_build_object('make', v.make, 'model', v.model, 'color', v.color, 'plate', v.registration_number) end,
    'driver_lat', case when b.status in ('ACCEPTED', 'DRIVER_ARRIVING', 'IN_PROGRESS') then l.lat end,
    'driver_lng', case when b.status in ('ACCEPTED', 'DRIVER_ARRIVING', 'IN_PROGRESS') then l.lng end,
    'located_at', l.updated_at, 'started_at', b.started_at, 'completed_at', b.completed_at, 'arrived_at', b.arrived_at)
  from bookings b
  left join profiles c on c.id = b.client_user_id
  left join profiles d on d.id = b.driver_user_id
  left join vehicles v on v.id = b.vehicle_id
  left join driver_locations l on l.driver_user_id = b.driver_user_id
  where b.share_token = p_token
    and (b.status in ('REQUESTED', 'ACCEPTED', 'DRIVER_ARRIVING', 'IN_PROGRESS')
         or coalesce(b.completed_at, b.cancelled_at) > now() - interval '30 minutes');
$$;

revoke execute on function create_share_link(uuid) from public, anon;
grant execute on function create_share_link(uuid) to authenticated;
grant execute on function shared_ride(uuid) to anon, authenticated;
