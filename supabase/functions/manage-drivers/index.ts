// Gestion de l'équipe (compte principal uniquement) : liste, ajout d'un chauffeur,
// modification de sa fiche, mot de passe, activation / désactivation, demandes d'inscription.
// Le nombre maximum de chauffeurs se règle dans l'appli (settings.doc.maxChauffeurs, 4 par défaut).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const MAX_DEFAUT = 4;
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const FIELDS = ["prenom", "nom", "tel", "modele", "plaque", "revtag"] as const;
const clean = (o: Record<string, unknown>) => {
  const r: Record<string, string> = {};
  for (const k of FIELDS) if (typeof o?.[k] === "string") r[k] = (o[k] as string).trim().slice(0, 80);
  if (r.plaque) r.plaque = r.plaque.toUpperCase();
  if (r.revtag) r.revtag = r.revtag.replace(/^@/, "").replace(/^https?:\/\/revolut\.me\//i, "").replace(/[^A-Za-z0-9_.-]/g, "");
  return r;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const asUser = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: u } = await asUser.auth.getUser();
    const uid = u?.user?.id;
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: me } = uid ? await admin.from("drivers").select("is_admin, actif").eq("id", uid).maybeSingle() : { data: null };
    if (!me?.is_admin || !me.actif) return json({ error: "Réservé au compte principal" }, 403);

    const body = await req.json();
    const { action } = body;
    const { data: st } = await admin.from("settings").select("doc").eq("id", 1).maybeSingle();
    const MAX_EQUIPE = Math.max(1, Math.min(50, Number(st?.doc?.maxChauffeurs) || MAX_DEFAUT));
    const actifs = async () => (await admin.from("drivers").select("id", { count: "exact", head: true }).eq("is_admin", false).eq("actif", true)).count ?? 0;

    if (action === "list") {
      const { data: rows } = await admin.from("drivers").select("*").order("is_admin", { ascending: false }).order("created_at");
      const out = [];
      for (const d of rows ?? []) {
        const { data: au } = await admin.auth.admin.getUserById(d.id);
        out.push({ ...d, email: au?.user?.email ?? "" });
      }
      return json({ drivers: out, max: MAX_EQUIPE });
    }

    if (action === "create") {
      const email = String(body.email ?? "").trim().toLowerCase();
      const password = String(body.password ?? "");
      const f = clean(body);
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: "Adresse e-mail invalide" }, 400);
      if (password.length < 8) return json({ error: "Mot de passe : 8 caractères minimum" }, 400);
      if (!f.prenom) return json({ error: "Prénom obligatoire" }, 400);
      if ((await actifs()) >= MAX_EQUIPE) return json({ error: `Maximum ${MAX_EQUIPE} chauffeurs dans l'équipe` }, 400);
      const { data: cu, error: ce } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      if (ce || !cu?.user) {
        const msg = /already|registered|exists/i.test(ce?.message ?? "") ? "Cette adresse e-mail a déjà un compte" : (ce?.message ?? "Erreur");
        return json({ error: msg }, 400);
      }
      const { error: ie } = await admin.from("drivers").insert({ id: cu.user.id, ...f, is_admin: false, actif: true, status: "off" });
      if (ie) return json({ error: ie.message }, 400);
      return json({ ok: true, id: cu.user.id });
    }

    const id = String(body.id ?? "");
    const { data: target } = await admin.from("drivers").select("id, is_admin, actif, demande").eq("id", id).maybeSingle();
    if (!target) return json({ error: "Chauffeur introuvable" }, 404);

    if (action === "update") {
      const f = clean(body);
      const { error } = await admin.from("drivers").update(f).eq("id", id);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }
    if (action === "password") {
      const password = String(body.password ?? "");
      if (password.length < 8) return json({ error: "Mot de passe : 8 caractères minimum" }, 400);
      const { error } = await admin.auth.admin.updateUserById(id, { password });
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }
    if (action === "actif") {
      if (target.is_admin) return json({ error: "Le compte principal reste actif" }, 400);
      const actif = body.actif === true;
      if (actif && !target.actif && (await actifs()) >= MAX_EQUIPE) return json({ error: `Équipe complète (${MAX_EQUIPE} chauffeurs). Augmentez le maximum ou désactivez un chauffeur.` }, 400);
      const { error } = await admin.from("drivers").update(actif ? { actif, demande: false } : { actif, status: "off" }).eq("id", id);
      if (error) return json({ error: error.message }, 400);
      // Un chauffeur désactivé est déconnecté et ne peut plus se reconnecter
      await admin.auth.admin.updateUserById(id, { ban_duration: actif ? "none" : "876000h" });
      return json({ ok: true });
    }
    if (action === "refuse") {
      // Refuser une demande d'inscription : le compte est supprimé (il n'a jamais eu de course)
      if (!target.demande) return json({ error: "Ce n'est pas une demande en attente" }, 400);
      const { error } = await admin.auth.admin.deleteUser(id);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }
    return json({ error: "bad_request" }, 400);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
