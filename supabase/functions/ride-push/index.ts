// Transporteur VTC — notifications push d'annulation / désistement.
// Appelée uniquement par la base (trigger bookings_notify_ride_change via pg_net) avec l'en-tête x-hook-secret.
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
let cfg: Record<string, string> | null = null;

const short = (s: string | null) => String(s || "").split(",")[0].trim();
const euro = (c: number) => (c / 100).toFixed(2).replace(".", ",") + " €";
const REASON: Record<string, string> = { NO_SHOW: "Client absent", PAYMENT_TIMEOUT: "Paiement non effectué à temps", NO_DRIVER: "Aucun chauffeur disponible" };

function message(p: any, toDriver: boolean) {
  if (p.kind === "RELEASED") return { title: "⚠️ Votre chauffeur s'est désisté", body: "Nous cherchons un autre chauffeur pour vous. Ouvrez l'appli pour suivre votre course." };
  const reason = p.reason ? ` Motif : ${REASON[p.reason] || p.reason}.` : "";
  if (toDriver) {
    const who = p.by === "CLIENT" ? "Le client a annulé" : "Annulation de";
    return { title: "❌ Course annulée", body: `${who} la course ${short(p.pickup)}.${reason}${p.by === "CLIENT" && p.fee_cents ? ` Frais d'annulation : ${euro(p.fee_cents)}.` : ""}` };
  }
  const who = p.by === "DRIVER" ? "Votre chauffeur a annulé la course." : p.by === "ADMIN" ? "Votre course a été annulée par Transporteur." : "Votre course a été annulée.";
  return { title: "❌ Course annulée", body: `${who}${reason}` };
}

Deno.serve(async (req) => {
  try {
    if (!cfg) { const { data, error } = await sb.rpc("push_config"); if (error) throw error; cfg = data; }
    if (!cfg?.ride_push_hook || req.headers.get("x-hook-secret") !== cfg.ride_push_hook) return new Response("forbidden", { status: 403 });
    const p = await req.json();
    const ids: string[] = (p.notify || []).filter(Boolean);
    if (!ids.length) return Response.json({ sent: 0 });
    webpush.setVapidDetails("mailto:simonpro2929@outlook.fr", cfg.vapid_public, cfg.vapid_private);
    const { data: subs } = await sb.from("push_subscriptions").select("*").in("user_id", ids);
    const { data: b } = await sb.from("bookings").select("driver_user_id, client_user_id").eq("id", p.booking_id).maybeSingle();
    let sent = 0;
    await Promise.all((subs || []).map(async (s: any) => {
      const toDriver = s.app === "driver" || (!!b && s.user_id !== b.client_user_id);
      const m = message(p, toDriver);
      const payload = JSON.stringify({ ...m, tag: `ride-${p.booking_id}-${p.kind}`, url: toDriver ? "/chauffeur.html" : "/", kind: p.kind, booking_id: p.booking_id });
      try { await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 3600, urgency: "high" }); sent++; }
      catch (e: any) { if (e?.statusCode === 404 || e?.statusCode === 410) await sb.from("push_subscriptions").delete().eq("endpoint", s.endpoint); }
    }));
    return Response.json({ sent });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});
