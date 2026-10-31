-- Transporteur VTC — alertes d'annulation (notifications push, même appli fermée).
--  • Course annulée (par le client, le chauffeur, l'admin ou le système) → notification à l'autre partie.
--  • Chauffeur qui se désiste (« Arrêter ») → notification au client : on cherche un autre chauffeur.
--  • Les clés VAPID et le secret de l'appel sont dans le coffre (vault) : vapid_public, vapid_private, ride_push_hook.
--    L'envoi est fait par la fonction ride-push, appelée en arrière-plan par pg_net (n'interrompt jamais la course).

create extension if not exists pg_net;

create table if not exists push_subscriptions (
  endpoint text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  p256dh text not null,
  auth text not null,
  app text,
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user on push_subscriptions (user_id);
alter table push_subscriptions enable row level security;
create policy push_own_select on push_subscriptions for select to authenticated using (user_id = auth.uid());
create policy push_own_insert on push_subscriptions for insert to authenticated with check (user_id = auth.uid());
create policy push_own_update on push_subscriptions for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy push_own_delete on push_subscriptions for delete to authenticated using (user_id = auth.uid());

-- Clé publique VAPID (pour l'abonnement côté appli).
create or replace function push_public_key() returns text
language sql stable security definer set search_path = public as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'vapid_public';
$$;
grant execute on function push_public_key() to anon, authenticated;

-- Configuration complète, réservée à la fonction ride-push.
create or replace function push_config() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_object_agg(name, decrypted_secret) from vault.decrypted_secrets where name in ('vapid_public', 'vapid_private', 'ride_push_hook');
$$;
revoke execute on function push_config() from public, anon, authenticated;
grant execute on function push_config() to service_role;

create or replace function notify_ride_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare kind text; who uuid[]; by_who text;
begin
  if new.status = 'CANCELLED' and old.status is distinct from 'CANCELLED' then
    kind := 'CANCELLED';
    by_who := case when new.cancelled_by is null then 'SYSTEM' when new.cancelled_by = new.client_user_id then 'CLIENT'
                   when new.cancelled_by = new.driver_user_id then 'DRIVER' else 'ADMIN' end;
    who := array_remove(array_remove(array[new.client_user_id, new.driver_user_id], null), new.cancelled_by);
  elsif old.driver_user_id is not null and new.driver_user_id is null and new.status in ('REQUESTED', 'OFFERED') then
    kind := 'RELEASED'; by_who := 'DRIVER'; who := array[new.client_user_id];
  end if;
  if kind is null or coalesce(array_length(who, 1), 0) = 0 then return new; end if;
  begin
    perform net.http_post(
      url := 'https://zzkxkbvnhfhtdkpeljjz.supabase.co/functions/v1/ride-push',
      body := jsonb_build_object('booking_id', new.id, 'kind', kind, 'by', by_who, 'notify', to_jsonb(who),
        'reason', new.cancel_reason, 'fee_cents', new.cancel_fee_cents, 'pickup', new.pickup_label),
      headers := jsonb_build_object('Content-Type', 'application/json',
        'x-hook-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'ride_push_hook')));
  exception when others then null;   -- une alerte qui échoue ne bloque jamais la course
  end;
  return new;
end $$;
create or replace trigger bookings_notify_ride_change after update on bookings for each row execute function notify_ride_change();
