// Paiement par carte avec Stripe (Checkout) : carte bancaire, Apple Pay, Google Pay.
// Aucun abonnement : Stripe prend seulement une commission sur chaque paiement.
// Activation : ajouter le secret STRIPE_SECRET_KEY (Supabase > Edge Functions > Secrets),
// puis cocher « Paiement par carte avec Stripe » dans Réglages de l'espace chauffeur.
//   action "create" : crée la page de paiement Stripe pour une course et renvoie son adresse
//   action "verify" : vérifie auprès de Stripe si la course est payée, et l'enregistre
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

async function stripe(path: string, key: string, form?: Record<string, string>) {
  const r = await fetch("https://api.stripe.com/v1/" + path, {
    method: form ? "POST" : "GET",
    headers: { Authorization: "Bearer " + key, ...(form ? { "Content-Type": "application/x-www-form-urlencoded" } : {}) },
    body: form ? new URLSearchParams(form).toString() : undefined,
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error?.message || "Stripe indisponible");
  return j;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  try {
    const key = Deno.env.get("STRIPE_SECRET_KEY") || "";
    if (!key) return json({ error: "Le paiement par carte n'est pas encore activé." }, 400);
    const url = Deno.env.get("SUPABASE_URL")!;
    const asUser = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: u } = await asUser.auth.getUser();
    const uid = u?.user?.id;
    if (!uid) return json({ error: "Connectez-vous pour payer." }, 401);
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { action, booking_id, origin } = await req.json();
    const { data: b } = await admin.from("bookings").select("*").eq("id", String(booking_id ?? "")).maybeSingle();
    if (!b) return json({ error: "Course introuvable" }, 404);
    const { data: me } = await admin.from("drivers").select("is_admin").eq("id", uid).maybeSingle();
    if (b.client_uid !== uid && b.driver_id !== uid && !me?.is_admin) return json({ error: "Accès refusé" }, 403);
    const doc = b.doc || {};
    const save = async (patch: Record<string, unknown>) => {
      const { error } = await admin.from("bookings").update({ doc: { ...doc, ...patch } }).eq("id", b.id);
      if (error) throw new Error(error.message);
    };

    if (action === "verify") {
      if (doc.paye) return json({ paye: true });
      if (!doc.stripeSession) return json({ paye: false });
      const s = await stripe("checkout/sessions/" + encodeURIComponent(doc.stripeSession), key);
      if (s.payment_status === "paid") {
        await save({ paye: true, payeVia: "carte", payeAt: Date.now(), payeMontant: (s.amount_total || 0) / 100 });
        return json({ paye: true });
      }
      return json({ paye: false });
    }

    if (action === "create") {
      if (b.client_uid !== uid) return json({ error: "Seul le client peut payer sa course." }, 403);
      if (doc.paye) return json({ error: "Cette course est déjà payée." }, 400);
      if (!["confirmee", "terminee"].includes(b.statut)) return json({ error: "Le paiement sera possible dès qu'un chauffeur aura accepté." }, 400);
      // L'argent arrive sur le compte Stripe du compte principal : réservé à ses propres courses
      const { data: drv } = await admin.from("drivers").select("is_admin").eq("id", b.driver_id).maybeSingle();
      if (!drv?.is_admin) return json({ error: "Pour cette course, payez avec le bouton Revolut du chauffeur." }, 400);
      const cents = Math.round(Number(doc.prix) * 100);
      if (!(cents >= 50)) return json({ error: "Montant invalide" }, 400);
      let base = String(origin || "");
      if (!/^https:\/\/[^\s/]+(\/[^\s?#]*)?$/.test(base) && !/^http:\/\/localhost(:\d+)?\//.test(base)) base = "https://transporteur-vtc.netlify.app/";
      const s = await stripe("checkout/sessions", key, {
        mode: "payment",
        "line_items[0][quantity]": "1",
        "line_items[0][price_data][currency]": "eur",
        "line_items[0][price_data][unit_amount]": String(cents),
        "line_items[0][price_data][product_data][name]": "Course VTC " + (doc.ref || ""),
        "line_items[0][price_data][product_data][description]": String((doc.depart?.label || "") + " → " + (doc.arrivee?.label || "")).slice(0, 300),
        success_url: base + "?paye=" + b.id,
        cancel_url: base,
        "metadata[booking_id]": b.id,
        "payment_intent_data[metadata][booking_id]": b.id,
        locale: "fr",
      });
      await save({ stripeSession: s.id });
      return json({ url: s.url });
    }
    return json({ error: "bad_request" }, 400);
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
