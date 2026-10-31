-- Transporteur VTC — chauffeurs autour du client en temps réel (avant de commander).
-- Comme nearby_drivers, avec une clé anonyme stable par chauffeur (pour animer chaque voiture sans révéler qui c'est)
-- et sans exclure son propre compte (utile pour vérifier sa position en testant).
create or replace function nearby_drivers_live(p_lat double precision, p_lng double precision, p_km double precision default 15)
returns table(k text, lat double precision, lng double precision, heading double precision, vehicle_type vehicle_type, seen_at timestamptz)
language sql stable security definer set search_path = public as $$
  select left(md5(l.driver_user_id::text || current_date::text), 12), round(l.lat::numeric, 5)::float8, round(l.lng::numeric, 5)::float8,
         l.heading, v.vehicle_type, l.updated_at
  from driver_locations l
  join drivers d on d.user_id = l.driver_user_id and d.partner_status = 'VALIDATED' and d.is_available
  left join lateral (select vehicle_type from vehicles where driver_user_id = d.user_id and is_active order by created_at desc limit 1) v on true
  where l.updated_at > now() - interval '10 minutes'
    and not exists (select 1 from bookings b where b.driver_user_id = d.user_id and b.status in ('ACCEPTED', 'DRIVER_ARRIVING', 'IN_PROGRESS'))
    and 2 * 6371 * asin(sqrt(sin(radians(l.lat - p_lat) / 2) ^ 2 + cos(radians(p_lat)) * cos(radians(l.lat)) * sin(radians(l.lng - p_lng) / 2) ^ 2)) <= least(p_km, 50)
  limit 40;
$$;
revoke execute on function nearby_drivers_live(double precision, double precision, double precision) from public, anon;
grant execute on function nearby_drivers_live(double precision, double precision, double precision) to authenticated;
