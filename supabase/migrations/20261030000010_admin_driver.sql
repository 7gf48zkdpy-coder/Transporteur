-- Transporteur VTC — l'administrateur peut aussi activer son propre compte chauffeur (« Mode chauffeur »).
create policy drivers_insert_admin_self on drivers for insert to authenticated with check (user_id = auth.uid() and is_admin());
