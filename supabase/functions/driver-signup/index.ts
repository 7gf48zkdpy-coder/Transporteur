// Inscription d'un chauffeur par lui-même.
// Le compte est créé « en attente » : il ne voit rien tant que le compte principal ne l'a pas accepté.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const MAX_DEMANDES = 10; // demandes en attente en même temps (protection contre les abus)
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const s = (v: unknown, n = 80) => (typeof v === "string" ? v.trim().slice(0, n) : "");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  try {
    const b = await req.json();
    const email = s(b.email, 200).toLowerCase(), password = String(b.password ?? "");
    const f = {
      prenom: s(b.prenom), nom: s(b.nom), tel: s(b.tel, 30), modele: s(b.modele), plaque: s(b.plaque, 20).toUpperCase(),
      revtag: s(b.revtag, 40).replace(/^@/, "").replace(/^https?:\/\/revolut\.me\//i, "").replace(/[^A-Za-z0-9_.-]/g, ""),
    };
    if (!f.prenom || !f.nom) return json({ error: "Indiquez votre prénom et votre nom." }, 400);
    if (f.tel.replace(/\D/g, "").length < 9) return json({ error: "Indiquez un numéro de téléphone valide." }, 400);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: "Adresse e-mail invalide." }, 400);
    if (password.length < 8) return json({ error: "Mot de passe : 8 caractères minimum." }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { count } = await admin.from("drivers").select("id", { count: "exact", head: true }).eq("demande", true);
    if ((count ?? 0) >= MAX_DEMANDES) return json({ error: "Trop de demandes en attente. Réessayez plus tard." }, 429);

    const { data: cu, error: ce } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (ce || !cu?.user) {
      const msg = /already|registered|exists/i.test(ce?.message ?? "") ? "Cette adresse e-mail a déjà un compte. Connectez-vous." : "Inscription impossible. Réessayez.";
      return json({ error: msg }, 400);
    }
    const { error: ie } = await admin.from("drivers").insert({ id: cu.user.id, ...f, is_admin: false, actif: false, demande: true, status: "off" });
    if (ie) { await admin.auth.admin.deleteUser(cu.user.id); return json({ error: "Inscription impossible. Réessayez." }, 400); }
    return json({ ok: true });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
