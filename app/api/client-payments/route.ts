import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdminConfig } from "@/lib/supabase-server";
import { clientIp, rateLimit, tooMany } from "@/lib/ratelimit";

/**
 * Détail des paiements d'un client, pour SON espace client.
 * ═══════════════════════════════════════════════════════════════════
 * Un règlement peut être fait en plusieurs fois et par plusieurs moyens
 * (gourdes en espèces + dollars par Zelle…) : le client voit chaque montant,
 * sa devise, son moyen de paiement et sa date.
 *
 * SÉCURITÉ : la table `invoice_payments` n'est pas lisible par les clients
 * (RLS). Cette route lit avec la clé de service APRÈS avoir déduit le code
 * client de la session — jamais d'un paramètre envoyé par le navigateur — et
 * ne renvoie que les champs utiles (ni caissier, ni référence de transaction).
 */
export async function POST(req: Request) {
  const rl = rateLimit(`client-payments:${clientIp(req)}`, 40, 60_000);
  if (!rl.ok) return tooMany(rl.retryAfter);

  try {
    const config = getSupabaseAdminConfig();
    if (!config) return NextResponse.json({ ok: false, reason: "Service indisponible." }, { status: 503 });
    const body = await req.json().catch(() => null);
    const token = String(body?.token ?? "").trim() || (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
    if (!token) return NextResponse.json({ ok: false, reason: "Session requise." }, { status: 401 });

    const db: any = createClient(config.url, config.key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: auth } = await db.auth.getUser(token);
    if (!auth.user) return NextResponse.json({ ok: false, reason: "Session invalide." }, { status: 401 });

    const { data: client } = await db.from("clients").select("customer_code")
      .eq("auth_user_id", auth.user.id).maybeSingle();
    const customerCode = String(client?.customer_code ?? "").trim();
    if (!customerCode) return NextResponse.json({ ok: true, payments: [] });

    const invoicesResult = await db.from("invoices").select("id").eq("customer_code", customerCode).limit(2000);
    if (invoicesResult.error) throw invoicesResult.error;
    const invoiceIds = ((invoicesResult.data ?? []) as { id: string }[]).map((invoice) => invoice.id);
    if (!invoiceIds.length) return NextResponse.json({ ok: true, payments: [] });

    const paymentsResult = await db.from("invoice_payments")
      .select("id, invoice_id, amount, currency, payment_method, created_at")
      .in("invoice_id", invoiceIds).order("created_at", { ascending: true }).limit(5000);
    if (paymentsResult.error) throw paymentsResult.error;

    return NextResponse.json({
      ok: true,
      payments: ((paymentsResult.data ?? []) as Array<Record<string, unknown>>).map((payment) => ({
        id: String(payment.id),
        invoice_id: String(payment.invoice_id),
        amount: Number(payment.amount) || 0,
        currency: String(payment.currency ?? "") === "HTG" ? "HTG" : "USD",
        method: String(payment.payment_method ?? "") || "Espèces",
        created_at: String(payment.created_at ?? "")
      }))
    });
  } catch (error) {
    console.error("[client-payments]", error);
    return NextResponse.json({ ok: false, reason: "Paiements indisponibles." }, { status: 500 });
  }
}
