// Transporteur : création du compte client (e-mail + mot de passe).
// Le client ouvre l'appli avec une connexion invité (anonyme) ; ce compte invité reçoit
// son e-mail et son mot de passe en gardant le même identifiant (donc ses courses).
// L'e-mail est validé directement : pas de lien de confirmation à cliquer.
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: { user }, error: uerr } = await admin.auth.getUser(token);
    if (uerr || !user) return json({ error: "Connexion expirée, rouvrez l'appli." }, 401);
    if (!user.is_anonymous) return json({ error: "Ce compte a déjà un e-mail." }, 400);

    const body = await req.json().catch(() => ({}));
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) return json({ error: "Adresse e-mail invalide." }, 400);
    if (password.length < 8 || password.length > 72) return json({ error: "Mot de passe : 8 caractères minimum." }, 400);

    const { error } = await admin.auth.admin.updateUserById(user.id, { email, password, email_confirm: true });
    if (error) {
      const taken = /already|registered|exists/i.test(error.message);
      return json({ error: taken ? "Cet e-mail a déjà un compte : utilisez « Se connecter »." : "Création impossible, réessayez." }, 400);
    }
    return json({ ok: true });
  } catch (_e) {
    return json({ error: "Création impossible, réessayez." }, 500);
  }
});
