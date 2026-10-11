import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdminConfig } from "@/lib/supabase-server";
import { clientIp, rateLimit, tooMany } from "@/lib/ratelimit";
import { hasSignificantInvoiceBalance, invoiceRemainingAmounts, type InvoicePayableSource } from "@/lib/invoice-payable";
import { SUPPORT_PHONE } from "@/lib/branding";
import { detectLang, FALLBACK, GREETING, matchMessage, pick, type Lang } from "@/lib/daha-faq";

/**
 * DAHA — asistan /espace-client. AUKENN API AI PEYAN : repons yo soti
 * nan règ + bank kesyon/repons ekri davans (lib/daha-faq.ts), pa nan yon
 * modèl ki "jenere" tèks. Zewo kòb pa mesaj, epi Daha pa ka janm pale de
 * yon bagay ki pa deja ekri nan bank lan — donk li pa gen okenn fason
 * pou yon moun "pyeje" l fè l revele MCPACK oswa nenpòt lòt bagay entèn.
 *
 * SEKIRITE : `customer_code` la soti SÈLMAN nan sesyon kliyan an (jeton
 * Supabase Auth -> auth_user_id -> clients.customer_code). Nou pa janm
 * fè konfyans a yon customer_code kliyan an ta voye nan kò requête a.
 */

const text = (value: unknown) => String(value ?? "").trim();
const MAX_MESSAGE_CHARS = 800;
const STATUS_LABELS: Record<string, string> = {
  "Reçu à Miami": "Reçu à Miami",
  "Départ de Miami": "Départ de Miami",
  "Arrivé en Haïti": "Arrivé en Haïti",
  "En route vers agence": "En route vers l'agence",
  "Disponible": "Disponible au point de retrait",
  "Facturé": "Facturé — en attente de retrait",
  "Livré": "Remis au client",
};

type PkgRow = { tracking_number: string; tracking_manual: string | null; status: string; weight: number; content: string | null; created_date: string | null; invoice_id: string | null; archived: boolean | null };

function bearerToken(req: Request, bodyToken: string) {
  if (bodyToken) return bodyToken;
  const header = req.headers.get("authorization") ?? "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() : "";
}

function money(value: unknown) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

function buildStatusAnswer(lang: Lang, visiblePkgs: PkgRow[], statusCounts: Map<string, number>) {
  if (!visiblePkgs.length) {
    return pick({
      fr: `Vous n'avez aucun colis dans votre compte pour le moment. Écrivez-nous sur WhatsApp au ${SUPPORT_PHONE} si vous attendez un colis.`,
      ht: `Ou pa gen okenn koli nan kont ou kounye a. Ekri nou sou WhatsApp nan ${SUPPORT_PHONE} si w ap tann yon koli.`,
      en: `You don't have any packages in your account right now. Message us on WhatsApp at ${SUPPORT_PHONE} if you're expecting one.`
    }, lang);
  }
  const countsLine = Array.from(statusCounts.entries()).map(([s, n]) => `${STATUS_LABELS[s] ?? s} ×${n}`).join(", ");
  const recent = visiblePkgs.slice(0, 5).map((p) => `• ${p.tracking_manual || p.tracking_number} — ${STATUS_LABELS[p.status] ?? p.status}`).join("\n");
  const intro = pick({
    fr: `Vous avez ${visiblePkgs.length} colis : ${countsLine}.`,
    ht: `Ou gen ${visiblePkgs.length} koli : ${countsLine}.`,
    en: `You have ${visiblePkgs.length} package(s): ${countsLine}.`
  }, lang);
  const recentLabel = pick({ fr: "Les plus récents :", ht: "Dènye yo :", en: "Most recent:" }, lang);
  return `${intro}\n\n${recentLabel}\n${recent}`;
}

function buildBalanceAnswer(lang: Lang, balanceLines: string[], totalRemainingUsd: number, totalRemainingHtg: number) {
  if (!balanceLines.length) {
    return pick({
      fr: "Vous n'avez aucune facture avec un solde impayé actuellement.",
      ht: "Ou pa gen okenn facture ki gen yon balans ki poko peye kounye a.",
      en: "You don't have any invoice with an outstanding balance right now."
    }, lang);
  }
  const intro = pick({
    fr: `Vous devez actuellement ${totalRemainingUsd.toFixed(2)} USD (${totalRemainingHtg.toFixed(2)} HTG) au total :`,
    ht: `Ou dwe kounye a ${totalRemainingUsd.toFixed(2)} USD (${totalRemainingHtg.toFixed(2)} HTG) antou :`,
    en: `You currently owe ${totalRemainingUsd.toFixed(2)} USD (${totalRemainingHtg.toFixed(2)} HTG) in total:`
  }, lang);
  return `${intro}\n${balanceLines.map((l) => l.trim()).join("\n")}`;
}

export async function POST(req: Request) {
  const ip = clientIp(req);
  const rlIp = rateLimit(`daha-chat:ip:${ip}`, 30, 10 * 60_000);
  if (!rlIp.ok) return tooMany(rlIp.retryAfter);

  try {
    const config = getSupabaseAdminConfig();
    if (!config) return NextResponse.json({ ok: false, reason: "Service indisponible." }, { status: 503 });

    const body = await req.json().catch(() => null);
    const token = bearerToken(req, text(body?.token));
    const message = text(body?.message).slice(0, MAX_MESSAGE_CHARS);

    if (!token) return NextResponse.json({ ok: false, reason: "Session expirée. Reconnectez-vous." }, { status: 401 });
    if (!message) return NextResponse.json({ ok: false, reason: "Écrivez une question." }, { status: 400 });

    const db: any = createClient(config.url, config.key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: auth } = await db.auth.getUser(token);
    const userId: string = auth?.user?.id ?? "";
    if (!userId) return NextResponse.json({ ok: false, reason: "Session expirée. Reconnectez-vous." }, { status: 401 });

    // Jamais pour le personnel — cet assistant lit et résume des données
    // CLIENT (colis, factures) ; un compte staff a déjà ses propres écrans.
    const staff = await db.from("staff").select("id").eq("auth_user_id", userId).maybeSingle();
    if (staff.data) return NextResponse.json({ ok: false, reason: "Cet assistant est réservé à l'espace client." }, { status: 403 });

    const clientResult = await db.from("clients").select("customer_code").eq("auth_user_id", userId).maybeSingle();
    if (clientResult.error) throw clientResult.error;
    const client = clientResult.data as { customer_code: string | null } | null;
    if (!client) return NextResponse.json({ ok: false, reason: "Compte client introuvable." }, { status: 404 });
    const customerCode = text(client.customer_code);

    // Deuxième limite, par client cette fois (pas seulement par IP partagée).
    const rlClient = rateLimit(`daha-chat:client:${customerCode || userId}`, 20, 10 * 60_000);
    if (!rlClient.ok) return tooMany(rlClient.retryAfter);

    const lang = detectLang(message);
    const match = matchMessage(message);

    // Les intentions FAQ/salutation n'ont besoin d'aucune donnée client —
    // on évite les requêtes Supabase inutiles dans ce cas.
    if (match.kind === "faq") return NextResponse.json({ ok: true, answer: pick(match.topic.answer, lang) });
    if (match.kind === "greeting") return NextResponse.json({ ok: true, answer: pick(GREETING, lang) });
    if (match.kind === "none") return NextResponse.json({ ok: true, answer: pick(FALLBACK, lang) });

    const [packagesResult, invoicesResult] = await Promise.all([
      customerCode
        ? db.from("packages").select("tracking_number, tracking_manual, status, weight, content, created_date, invoice_id, archived")
            .eq("customer_code", customerCode).order("created_date", { ascending: false }).limit(60)
        : Promise.resolve({ data: [] }),
      customerCode
        ? db.from("invoices").select("invoice_number, created_at, grand_total, total_usd, total_htg, exchange_rate_used, order_deposit, balance_due, payment_status, payment_paid_usd, payment_paid_htg, has_pdf")
            .eq("customer_code", customerCode).order("created_at", { ascending: false }).limit(20)
        : Promise.resolve({ data: [] })
    ]);

    const allPkgs = (packagesResult.data ?? []) as PkgRow[];
    // Même règle que l'espace client : un colis livré reste visible dans
    // son historique même si l'équipe a archivé le dossier opérationnel.
    const visiblePkgs = allPkgs.filter((p) => !p.archived || p.status === "Livré");
    const statusCounts = new Map<string, number>();
    for (const p of visiblePkgs) statusCounts.set(p.status, (statusCounts.get(p.status) ?? 0) + 1);

    if (match.kind === "status") {
      return NextResponse.json({ ok: true, answer: buildStatusAnswer(lang, visiblePkgs, statusCounts) });
    }

    // match.kind === "balance"
    const invoices = (invoicesResult.data ?? []) as InvoicePayableSource[];
    const invoicesWithBalance = invoices.filter((invoice) => (invoice as any).has_pdf && hasSignificantInvoiceBalance(invoice));
    let totalRemainingUsd = 0, totalRemainingHtg = 0;
    const balanceLines = invoicesWithBalance.map((invoice: any) => {
      const remaining = invoiceRemainingAmounts(invoice);
      totalRemainingUsd = money(totalRemainingUsd + remaining.remainingUsd);
      totalRemainingHtg = money(totalRemainingHtg + remaining.remainingHtg);
      return `• ${invoice.invoice_number} (${new Date(invoice.created_at).toLocaleDateString("fr-CA")}) — reste ${remaining.remainingUsd.toFixed(2)} USD (${remaining.remainingHtg.toFixed(2)} HTG)`;
    });
    return NextResponse.json({ ok: true, answer: buildBalanceAnswer(lang, balanceLines, totalRemainingUsd, totalRemainingHtg) });
  } catch (error) {
    console.error("[daha-chat]", error);
    return NextResponse.json({ ok: false, reason: "Une erreur est survenue. Réessayez." }, { status: 500 });
  }
}
