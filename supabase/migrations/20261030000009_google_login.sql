-- Transporteur VTC — connexion Google : nom et photo repris du compte Google, passage en compte chauffeur
-- quand l'inscription Google a été faite depuis l'espace chauffeur.

create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_role account_role := case when m->>'app' = 'driver' then 'DRIVER' else 'CLIENT' end;
  v_lang text := case when m->>'lang' = 'en' then 'en' else 'fr' end;
begin
  if new.email is null or coalesce(new.is_anonymous, false) then
    return new;
  end if;
  insert into profiles (id, role, email, phone, display_name, preferred_language, avatar_url)
  values (new.id, v_role, new.email, nullif(m->>'phone', ''),
          coalesce(nullif(m->>'display_name', ''), nullif(m->>'full_name', ''), nullif(m->>'name', ''), split_part(new.email, '@', 1)),
          v_lang, nullif(coalesce(m->>'avatar_url', m->>'picture'), ''));
  if v_role = 'DRIVER' then
    insert into drivers (user_id) values (new.id);
  end if;
  return new;
end $$;

-- Un compte tout juste créé via Google depuis l'espace chauffeur devient un compte chauffeur (à valider par l'admin).
create or replace function become_driver() returns void
language plpgsql security definer set search_path = public as $$
declare p profiles;
begin
  select * into p from profiles where id = auth.uid();
  if not found then raise exception 'NOT_FOUND'; end if;
  if p.role = 'DRIVER' then return; end if;
  if p.role <> 'CLIENT' or p.created_at < now() - interval '30 minutes'
     or exists (select 1 from bookings where client_user_id = p.id) then
    raise exception 'ALREADY_CLIENT';
  end if;
  perform trust();
  update profiles set role = 'DRIVER' where id = p.id;
  perform untrust();
  insert into drivers (user_id) values (p.id) on conflict do nothing;
end $$;
revoke execute on function become_driver() from public, anon;
grant execute on function become_driver() to authenticated;
