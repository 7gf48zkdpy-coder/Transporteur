-- Transporteur VTC — durcissement après diagnostic.
--  • search_path fixé sur les petites fonctions de calcul.
--  • Les fonctions de trigger ne sont pas appelables depuis l'API.
alter function wait_fee(timestamptz, timestamptz) set search_path = public;
alter function km_between(double precision, double precision, double precision, double precision) set search_path = public;
alter function card_pay_before_departure(bookings) set search_path = public;
revoke execute on function notify_ride_change() from public, anon, authenticated;
revoke execute on function record_cancel_terms() from public, anon, authenticated;
revoke execute on function track_driver_trip() from public, anon, authenticated;
