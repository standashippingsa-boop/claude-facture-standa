import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdminConfig } from "@/lib/supabase-server";
import { buildHtml, sendViaResend, type NotifyPkg } from "@/lib/customer-mail";
import { customerParcelCopy, type CustomerParcelEvent } from "@/lib/customer-push";
import { sendPushToCustomer } from "@/lib/push-server";
import { sendFcmToCustomer } from "@/lib/push-fcm-server";

/**
 * ENVOI DES NOTIFICATIONS CLIENT DEPUIS LA FILE D'ATTENTE (notification_outbox).
 * ═══════════════════════════════════════════════════════════════════════════
 * Appelé chaque minute par pg_cron (en-tête x-dispatch-secret), ou par un
 * membre du personnel depuis Paramètres (« Envoyer maintenant », « Relancer »).
 *
 * Pour chaque client et chaque étape : UN courriel avec tous ses colis, et UNE
 * alerte push (navigateur + app Android). Résultat noté sur chaque ligne.
 * Échec temporaire (Resend saturé, réseau, domaine pas encore prêt) : nouvel
 * essai plus tard, de plus en plus espacé, 8 essais au maximum.
 */
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const MAX_ATTEMPTS = 8;
const TIME_BUDGET_MS = 45_000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type OutboxRow = {
  id: string; package_id: string; customer_code: string; event: CustomerParcelEvent;
  attempts: number; push_count: number; created_at: string;
};
type PkgRow = { id: string; tracking_number: string | null; tracking_manual: string | null; content: string | null; weight: number | null; status: string | null; mcpack_data: Record<string, string> | null };
type ClientRow = { customer_code: string; fullname: string | null; surname: string | null; email: string | null; city: string | null; ville: { name: string } | { name: string }[] | null };

const sameSecret = (a: string, b: string) => {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && x.length > 0 && timingSafeEqual(x, y);
};

/** Délai avant le prochain essai : 2, 4, 8, 16, 32, 60, 60 minutes. */
const retryDelayMs = (attempts: number) => Math.min(60, 2 ** attempts) * 60_000;

async function isStaffToken(svc: SupabaseClient, token: string): Promise<boolean> {
  if (!token) return false;
  const { data: au } = await svc.auth.getUser(token);
  if (!au?.user) return false;
  const { data: staff } = await svc.from("staff").select("role").eq("auth_user_id", au.user.id).maybeSingle();
  return !!staff;
}

export async function POST(req: Request) {
  const config = getSupabaseAdminConfig();
  if (!config) return NextResponse.json({ ok: false, reason: "SUPABASE_SECRET_KEY manquant sur le serveur." }, { status: 500 });
  const svc = createClient(config.url, config.key, { auth: { persistSession: false } });

  let body: { token?: string; action?: "run" | "retry_failed" } = {};
  try { body = await req.json(); } catch { /* corps vide : appel pg_cron */ }

  // ── Autorisation : secret pg_cron OU session du personnel ──
  const headerSecret = req.headers.get("x-dispatch-secret") ?? "";
  let allowed = false;
  if (headerSecret) {
    const { data } = await svc.from("app_secrets").select("value").eq("key", "notify_dispatch_secret").maybeSingle();
    allowed = sameSecret(headerSecret, String(data?.value ?? ""));
  }
  if (!allowed) allowed = await isStaffToken(svc, String(body.token ?? ""));
  if (!allowed) return NextResponse.json({ ok: false, reason: "Accès refusé." }, { status: 401 });

  // « Relancer les échecs » : les lignes échouées repartent avec de nouveaux essais.
  if (body.action === "retry_failed") {
    const { error } = await svc.from("notification_outbox")
      .update({ state: "pending", attempts: 0, next_attempt_at: new Date().toISOString(), last_error: null })
      .eq("state", "failed");
    if (error) return NextResponse.json({ ok: false, reason: error.message }, { status: 500 });
  }

  const started = Date.now();
  const mailKey = process.env.RESEND_API_KEY ?? "";
  const summary = { groups: 0, emails: 0, pushes: 0, retried: 0, failed: 0, skipped: 0 };
  const errors: string[] = [];

  while (Date.now() - started < TIME_BUDGET_MS) {
    const { data: claimed, error: claimError } = await svc.rpc("claim_notification_outbox", { p_groups: 10 });
    if (claimError) { errors.push("claim: " + claimError.message); break; }
    const rows = (claimed ?? []) as OutboxRow[];
    if (!rows.length) break;

    // Données des colis et des clients concernés.
    const pkgIds = Array.from(new Set(rows.map((r) => r.package_id)));
    const codes = Array.from(new Set(rows.map((r) => r.customer_code)));
    const [{ data: pkgData }, { data: clientData }] = await Promise.all([
      svc.from("packages").select("id, tracking_number, tracking_manual, content, weight, status, mcpack_data").in("id", pkgIds),
      svc.from("clients").select("customer_code, fullname, surname, email, city, ville:villes(name)").in("customer_code", codes),
    ]);
    const pkgById = new Map(((pkgData ?? []) as PkgRow[]).map((p) => [p.id, p]));
    const clientByCode = new Map(((clientData ?? []) as ClientRow[]).map((c) => [c.customer_code, c]));

    const groups = new Map<string, OutboxRow[]>();
    for (const row of rows) {
      const key = row.customer_code + "|" + row.event;
      groups.set(key, [...(groups.get(key) ?? []), row]);
    }

    for (const list of groups.values()) {
      summary.groups++;
      const { customer_code: code, event } = list[0];
      const now = new Date().toISOString();
      // Colis déjà remis au client : plus rien à annoncer.
      const live = list.filter((r) => pkgById.get(r.package_id)?.status !== "Livré");
      const dropped = list.filter((r) => !live.includes(r));
      if (dropped.length) {
        summary.skipped += dropped.length;
        await svc.from("notification_outbox").update({ state: "skipped", last_error: "Colis déjà livré", locked_at: null, sent_at: now })
          .in("id", dropped.map((r) => r.id));
      }
      if (!live.length) continue;

      const client = clientByCode.get(code);
      const packages: NotifyPkg[] = live.map((r) => {
        const p = pkgById.get(r.package_id);
        return {
          tracking_number: p?.tracking_number ?? "", tracking_manual: p?.tracking_manual ?? "",
          content: p?.content ?? "", weight: Number(p?.weight) || 0,
          fournisseur: p?.mcpack_data?.["Proveedor"] ?? p?.mcpack_data?.["proveedor"] ?? "",
        };
      });

      // Push : une seule fois (pas à chaque nouvel essai du courriel).
      let pushCount = 0;
      const firstTry = live.every((r) => r.attempts <= 1 && r.push_count === 0);
      if (firstTry) {
        const copy = customerParcelCopy(event, live.length);
        const results = await Promise.allSettled([sendPushToCustomer(config, code, copy), sendFcmToCustomer(config, code, copy)]);
        for (const r of results) if (r.status === "fulfilled") pushCount += r.value;
        summary.pushes += pushCount;
      }

      // Courriel.
      const to = String(client?.email ?? "").trim();
      let emailState: string; let emailId: string | null = null; let error: string | null = null; let retryable = false;
      if (!client) { emailState = "no_client"; error = "Client introuvable pour ce code."; }
      else if (!EMAIL_RE.test(to)) { emailState = "no_email"; }
      else if (!mailKey) { emailState = "no_key"; error = "RESEND_API_KEY absent sur Vercel."; retryable = true; }
      else {
        const ville = Array.isArray(client.ville) ? client.ville[0]?.name : client.ville?.name;
        const { subject, html } = buildHtml({
          type: event,
          client: { name: [client.fullname, client.surname].filter(Boolean).join(" ") || code, code, ville: ville || client.city || "", email: to },
          packages,
        });
        const r = await sendViaResend(mailKey, to, subject, html);
        if (r.ok) { emailState = "sent"; emailId = r.id; summary.emails++; }
        else {
          emailState = "failed"; error = r.message;
          // Adresse refusée par Resend (422) : inutile de réessayer. Le reste
          // (quota, réseau, domaine en cours de vérification) peut se rétablir.
          retryable = r.code !== "invalid_request";
        }
        // Resend accepte 2 envois par seconde sur l'offre de base.
        await new Promise((resolve) => setTimeout(resolve, 550));
      }

      const ids = live.map((r) => r.id);
      const attempts = Math.max(...live.map((r) => r.attempts));
      const pushTotal = Math.max(...live.map((r) => r.push_count)) + pushCount;
      if (emailState === "sent" || (emailState === "no_email" && pushTotal > 0)) {
        await svc.from("notification_outbox").update({ state: "sent", email_state: emailState, email_id: emailId, push_count: pushTotal, last_error: null, locked_at: null, sent_at: now }).in("id", ids);
      } else if (emailState === "no_email") {
        summary.skipped += ids.length;
        await svc.from("notification_outbox").update({ state: "skipped", email_state: emailState, push_count: pushTotal, last_error: "Pas de courriel et aucun téléphone abonné aux notifications.", locked_at: null, sent_at: now }).in("id", ids);
      } else if (retryable && attempts < MAX_ATTEMPTS) {
        summary.retried += ids.length;
        await svc.from("notification_outbox").update({ state: "pending", email_state: emailState, push_count: pushTotal, last_error: error, locked_at: null, next_attempt_at: new Date(Date.now() + retryDelayMs(attempts)).toISOString() }).in("id", ids);
      } else {
        summary.failed += ids.length;
        errors.push(`${code}: ${error ?? emailState}`);
        await svc.from("notification_outbox").update({ state: "failed", email_state: emailState, push_count: pushTotal, last_error: error, locked_at: null }).in("id", ids);
        await svc.from("journal").insert({
          user_name: "Notifications automatiques", action: "Notification courriel échouée",
          details: `${event === "recu_miami" ? "Reçu à Miami" : "Disponible"} · ${code} · ${ids.length} colis : ${String(error ?? emailState).slice(0, 300)}`,
          package_ref: "", customer_code: code,
        });
      }
      if (Date.now() - started > TIME_BUDGET_MS) break;
    }
  }

  // Dernier passage, affiché dans Paramètres pour voir que l'envoi automatique tourne.
  await svc.from("app_settings").upsert({
    key: "notify_dispatch_last_run",
    value: JSON.stringify({ at: new Date().toISOString(), ...summary, errors: errors.slice(0, 5) }),
  }, { onConflict: "key" });

  return NextResponse.json({ ok: true, ...summary, errors: errors.slice(0, 10) });
}
