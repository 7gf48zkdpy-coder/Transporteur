// Envoie une notification au client d'une course (appelé par l'espace chauffeur uniquement).
// kind = "accepted" (course acceptée), "near" (chauffeur à proximité, une seule fois) ou "arrived" (chauffeur arrivé).
// Autorisé pour le chauffeur attribué à la course, ou pour le compte principal.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import webpush from "npm:web-push@3.6.7";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const auth = req.headers.get("Authorization") ?? "";
    const asUser = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: u } = await asUser.auth.getUser();
    const uid = u?.user?.id;
    if (!uid) return json({ error: "forbidden" }, 403);

    const { booking_id, kind, minutes } = await req.json();
    if (!booking_id || !["accepted", "near", "arrived"].includes(kind)) return json({ error: "bad_request" }, 400);

    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: me } = await admin.from("drivers").select("id, is_admin, actif").eq("id", uid).maybeSingle();
    if (!me?.actif) return json({ error: "forbidden" }, 403);
    const { data: b, error: be } = await admin.from("bookings").select("id, client_uid, statut, doc, driver_id").eq("id", booking_id).maybeSingle();
    if (be || !b) return json({ error: "not_found" }, 404);
    if (!me.is_admin && b.driver_id !== uid) return json({ error: "forbidden" }, 403);

    // « Proche » : une seule fois par course
    if (kind === "near") {
      if (b.doc?.notifNear) return json({ sent: 0, skipped: "already" });
      await admin.from("bookings").update({ doc: { ...b.doc, notifNear: Date.now() } }).eq("id", b.id);
    }

    const c = b.doc?.chauffeur || {};
    const qui = c.prenom ? c.prenom : "Votre chauffeur";
    const auto = [c.modele, c.plaque].filter(Boolean).join(" · ");
    const m = Number(minutes) > 0 ? Math.round(Number(minutes)) : null;
    const msg = kind === "accepted"
      ? { title: "Course confirmée ✅", body: `${qui} a accepté votre course${b.doc?.date ? " du " + b.doc.date.split("-").reverse().join("/") + " à " + b.doc.time : ""}.${auto ? " Véhicule : " + auto + "." : ""}` }
      : kind === "near"
      ? { title: `${qui} arrive 🚗`, body: `${m ? "Environ " + m + " min. " : "Tout proche. "}${auto ? auto + ". " : ""}6 minutes d'attente offertes.` }
      : { title: `${qui} est arrivé 📍`, body: `Il vous attend au point de prise en charge.${auto ? " " + auto + "." : ""} 6 minutes d'attente offertes.` };

    const { data: cfg } = await admin.rpc("get_push_config");
    if (!cfg?.vapid_private) return json({ error: "config" }, 500);
    webpush.setVapidDetails(cfg.vapid_subject, cfg.vapid_public, cfg.vapid_private);

    const { data: subs } = await admin.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("user_id", b.client_uid);
    let sent = 0;
    for (const s of subs ?? []) {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify({ ...msg, url: "./", tag: "course-" + b.id + "-" + kind }),
          { TTL: 600, urgency: "high" },
        );
        sent++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) await admin.from("push_subscriptions").delete().eq("id", s.id);
      }
    }
    return json({ sent, devices: subs?.length ?? 0 });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
