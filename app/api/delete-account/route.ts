import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdminConfig } from "@/lib/supabase-server";
import { clientIp, rateLimit, tooMany } from "@/lib/ratelimit";
import { hasSignificantInvoiceBalance } from "@/lib/invoice-payable";

/**
 * Suppression du compte par le CLIENT lui-même (exigée par Google Play et
 * l'App Store dès qu'une app permet de créer un compte).
 *
 * SERVEUR SEULEMENT : c'est ici, et nulle part ailleurs, que la clé de service
 * Supabase est utilisée. La session du client prouve son identité ; il ne peut
 * supprimer que SON compte.
 *
 * Ce qui est supprimé / anonymisé :
 *  - abonnements push (Web Push + FCM) du client ;
 *  - identité et coordonnées sur sa fiche `clients` (nom, WhatsApp, téléphone,
 *    adresse, pièce d'identité, email, copies chiffrées) ;
 *  - le nom recopié sur ses colis ;
 *  - le compte de connexion (Supabase Auth).
 * Ce qui reste, conformément à la politique de confidentialité (§ durée de
 * conservation) : colis, factures et reçus, rattachés au seul code client, pour
 * nos obligations comptables et douanières.
 *
 * Refusé tant que le client a un colis non livré ou une facture non soldée :
 * on ne supprime pas le compte qui reçoit un colis en route.
 */
const CONFIRMATION = "SUPPRIMER";
const text = (value: unknown) => String(value ?? "").trim();

function bearerToken(req: Request) {
  const header = req.headers.get("authorization") ?? "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() : "";
}
function missingColumn(error: unknown) {
  const message = error && typeof error === "object" && "message" in error ? String((error as { message?: unknown }).message ?? "") : "";
  return /column|schema cache/i.test(message);
}

export async function POST(req: Request) {
  // Action rare et irréversible : très peu d'essais par IP.
  const rl = rateLimit("delete-account:" + clientIp(req), 5, 3_600_000);
  if (!rl.ok) return tooMany(rl.retryAfter);

  try {
    const config = getSupabaseAdminConfig();
    if (!config) return NextResponse.json({ ok: false, reason: "Service indisponible." }, { status: 503 });
    const token = bearerToken(req);
    if (!token) return NextResponse.json({ ok: false, reason: "Session requise." }, { status: 401 });

    const body = await req.json().catch(() => null);
    if (text(body?.confirmation).toUpperCase() !== CONFIRMATION) {
      return NextResponse.json({ ok: false, reason: `Tapez ${CONFIRMATION} pour confirmer.` }, { status: 400 });
    }

    const db: any = createClient(config.url, config.key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: auth } = await db.auth.getUser(token);
    const userId: string = auth?.user?.id ?? "";
    if (!userId) return NextResponse.json({ ok: false, reason: "Session invalide." }, { status: 401 });

    // Un compte du personnel (admin, employé, agent…) n'est jamais supprimé ici.
    const staff = await db.from("staff").select("id").eq("auth_user_id", userId).maybeSingle();
    if (staff.data) return NextResponse.json({ ok: false, reason: "Ce compte n'est pas un compte client." }, { status: 403 });

    const clientResult = await db.from("clients").select("id, customer_code").eq("auth_user_id", userId).maybeSingle();
    if (clientResult.error) throw clientResult.error;
    const client = clientResult.data as { id: string; customer_code: string | null } | null;
    if (!client) return NextResponse.json({ ok: false, reason: "Compte client introuvable." }, { status: 404 });
    const customerCode = text(client.customer_code);

    if (customerCode) {
      const [parcels, invoices] = await Promise.all([
        db.from("packages").select("id, status, archived").eq("customer_code", customerCode).neq("status", "Livré").limit(500),
        db.from("invoices").select("grand_total, total_usd, total_htg, exchange_rate_used, order_deposit, balance_due, payment_paid_usd, payment_paid_htg")
          .eq("customer_code", customerCode).eq("has_pdf", true).limit(1000)
      ]);
      if (parcels.error) throw parcels.error;
      if (invoices.error) throw invoices.error;
      const openParcels = ((parcels.data ?? []) as Array<{ archived: boolean | null }>).filter((parcel) => !parcel.archived).length;
      const unpaid = ((invoices.data ?? []) as Array<Record<string, unknown>>).some((invoice) => hasSignificantInvoiceBalance(invoice));
      if (openParcels > 0 || unpaid) {
        return NextResponse.json({
          ok: false, blocked: true,
          reason: openParcels > 0
            ? "Vous avez encore des colis en cours. Vous pourrez supprimer votre compte une fois qu'ils vous auront été remis. Besoin d'aide ? Contactez-nous sur WhatsApp."
            : "Une facture reste à régler. Vous pourrez supprimer votre compte une fois qu'elle sera soldée. Besoin d'aide ? Contactez-nous sur WhatsApp."
        }, { status: 409 });
      }

      // 1) Notifications : plus aucun téléphone ne doit recevoir d'alerte.
      for (const table of ["push_subscriptions", "fcm_device_tokens"]) {
        const removed = await db.from(table).delete().eq("customer_code", customerCode);
        if (removed.error) throw removed.error;
      }
      // Le nom du client recopié sur ses colis livrés.
      const renamed = await db.from("packages").update({ customer_name: "Compte supprimé" }).eq("customer_code", customerCode);
      if (renamed.error) throw renamed.error;
    }

    // 2) Fiche client anonymisée. On garde `customer_code` (lien comptable) et
    // `auth_user_id` jusqu'à la fin : si la suppression du compte de connexion
    // échoue, le client peut simplement réessayer.
    const anonymised: Record<string, unknown> = {
      fullname: "Compte supprimé", surname: "", whatsapp: "", phone: "", pickup_location: "",
      address: "", city: "", city2: "", country: "", id_number: "", id_type: "",
      email: null, account_status: "Supprimé", must_change_password: false
    };
    let update = await db.from("clients").update({ ...anonymised, phone_encrypted: null, whatsapp_encrypted: null, address_encrypted: null }).eq("id", client.id);
    // Les copies chiffrées n'existent qu'après supabase/pii_encryption_columns.sql.
    if (update.error && missingColumn(update.error)) update = await db.from("clients").update(anonymised).eq("id", client.id);
    if (update.error) throw update.error;

    // 3) Compte de connexion.
    const removedUser = await db.auth.admin.deleteUser(userId);
    if (removedUser.error) throw removedUser.error;
    await db.from("clients").update({ auth_user_id: null, username: null }).eq("id", client.id);

    // Journal : le code client suffit, aucune donnée personnelle.
    const xff = req.headers.get("x-forwarded-for") ?? "";
    await db.from("journal").insert({
      user_name: "Client (self-service)", action: "Compte client supprimé",
      details: customerCode ? `Le client ${customerCode} a supprimé son compte.` : "Un compte non activé a été supprimé.",
      package_ref: "", customer_code: customerCode,
      ip_address: (xff.split(",")[0] || req.headers.get("x-real-ip") || "").trim(),
      user_agent: (req.headers.get("user-agent") ?? "").slice(0, 400)
    }).catch(() => null);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[delete-account]", error);
    return NextResponse.json({ ok: false, reason: "Suppression impossible pour le moment. Contactez-nous sur WhatsApp." }, { status: 500 });
  }
}
