import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHash, createHmac } from "node:crypto";
import { getSupabaseAdminConfig } from "@/lib/supabase-server";
import { clientIp, rateLimit, tooMany } from "@/lib/ratelimit";
import { invoiceRemainingAmounts, paymentStatusFromAmounts } from "@/lib/invoice-payable";
import { SITE_URL, SUPPORT_PHONE } from "@/lib/branding";
import { SITE } from "@/lib/site";
import type { RemiseTicket } from "@/lib/remise-ticket";

/**
 * TICKET DE REMISE — done ti fakti tèmik yon remiz koli.
 *
 * Yon remiz = tout koli « Livré » menm kliyan an ki gen menm `delivered_at`
 * (ajan an oswa admin nan konfime yo ansanm). Nou resevwa id YON koli, sèvè
 * a rekonstwi rès gwoup la — konsa chak reyenpresyon bay egzakteman menm
 * ticket la, ak menm nimewo a, san tab siplemantè.
 *
 * Aksè: admin + employé (tout zòn) · agent_retrait (sèlman kliyan zòn li,
 * menm doub verifikasyon ak /api/pickup-agent). Pa janm pyès idantite,
 * adrès, ni pri acha: telefòn nan maske, sèl 4 dènye chif yo parèt.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f-]{27}$/i;
const text = (value: unknown) => String(value ?? "").trim();
const money = (value: unknown) => Math.round(Number(value ?? 0) * 100) / 100;
const STAFF_ROLES = new Set(["admin", "employe", "agent_retrait"]);
const PACKAGE_COLUMNS = "id, tracking_number, tracking_manual, customer_code, customer_name, quantity, content, weight, status, invoice_id, bon_remise_id, delivered_at";

type Staff = { role: string; prenom: string | null; nom: string | null; username: string | null; pickup_ville_id: string | null };
type Parcel = {
  id: string; tracking_number: string | null; tracking_manual: string | null; customer_code: string; customer_name: string | null;
  quantity: number | null; content: string | null; weight: number | null; status: string; invoice_id: string | null;
  bon_remise_id: string | null; delivered_at: string | null; delivered_by?: string | null;
};

function bearerToken(req: Request) {
  const header = req.headers.get("authorization") ?? "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() : "";
}

function missingColumn(error: unknown, column: string) {
  const message = error && typeof error === "object" && "message" in error ? String((error as { message?: unknown }).message ?? "") : "";
  return message.toLowerCase().includes(column.toLowerCase());
}

function staffName(staff: Staff) {
  return [text(staff.prenom), text(staff.nom)].filter(Boolean).join(" ") || text(staff.username) || "STANDA";
}

/** « ******4338 » — ase pou kliyan an rekonèt nimewo l, pa ase pou l ekspoze. */
function maskPhone(value: unknown) {
  const digits = text(value).replace(/\D/g, "");
  return digits.length >= 4 ? "*".repeat(Math.min(6, Math.max(0, digits.length - 4))) + digits.slice(-4) : "";
}

/** `delivered_by` vini ak yon migrasyon apa: ticket la mache menm anvan li egzekite. */
async function selectParcels(build: (columns: string) => any): Promise<{ data: Parcel[]; error: unknown }> {
  let result = await build(PACKAGE_COLUMNS + ", delivered_by");
  if (missingColumn(result.error, "delivered_by")) result = await build(PACKAGE_COLUMNS);
  return { data: (result.data ?? []) as Parcel[], error: result.error };
}

export async function GET(req: Request) {
  const rl = rateLimit(`remise-ticket:${clientIp(req)}`, 60, 60_000);
  if (!rl.ok) return tooMany(rl.retryAfter);

  try {
    const config = getSupabaseAdminConfig();
    const token = bearerToken(req);
    const packageId = text(new URL(req.url).searchParams.get("package"));
    if (!config) return NextResponse.json({ ok: false, reason: "Service indisponible." }, { status: 503 });
    if (!token) return NextResponse.json({ ok: false, reason: "Session requise." }, { status: 401 });
    if (!UUID.test(packageId)) return NextResponse.json({ ok: false, reason: "Colis invalide." }, { status: 400 });

    const db: any = createClient(config.url, config.key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: auth } = await db.auth.getUser(token);
    if (!auth.user) return NextResponse.json({ ok: false, reason: "Session invalide." }, { status: 401 });
    const staffResult = await db.from("staff").select("role, prenom, nom, username, pickup_ville_id").eq("auth_user_id", auth.user.id).maybeSingle();
    const staff = staffResult.data as Staff | null;
    if (!staff || !STAFF_ROLES.has(text(staff.role))) {
      return NextResponse.json({ ok: false, reason: "Accès non autorisé." }, { status: 403 });
    }

    // ===== Koli referans lan =====
    const anchorResult = await selectParcels((columns) => db.from("packages").select(columns).eq("id", packageId).limit(1));
    if (anchorResult.error) throw anchorResult.error;
    const anchor = anchorResult.data[0];
    if (!anchor) return NextResponse.json({ ok: false, reason: "Colis introuvable." }, { status: 404 });
    if (text(anchor.status) !== "Livré") {
      return NextResponse.json({ ok: false, reason: "Ce colis n'a pas encore été remis au client : aucun ticket de remise n'existe." }, { status: 409 });
    }
    const customerCode = text(anchor.customer_code);

    // ===== Rekonstwi remiz la =====
    // Menm `delivered_at` = menm konfimasyon. Nou pran yon fenèt ±1 s epi
    // konpare egzakteman an JS, pou fòma tan PostgREST pa janm kase gwoup la.
    let parcels: Parcel[];
    if (anchor.delivered_at) {
      const at = Date.parse(anchor.delivered_at);
      const group = await selectParcels((columns) => db.from("packages").select(columns)
        .eq("customer_code", customerCode).eq("status", "Livré")
        .gte("delivered_at", new Date(at - 1000).toISOString()).lte("delivered_at", new Date(at + 1000).toISOString())
        .limit(200));
      if (group.error) throw group.error;
      parcels = group.data.filter((row) => Date.parse(text(row.delivered_at)) === at);
    } else if (anchor.invoice_id) {
      // Ansyen remiz (anvan `delivered_at`): koli livre menm fakti a ansanm.
      const group = await selectParcels((columns) => db.from("packages").select(columns)
        .eq("customer_code", customerCode).eq("status", "Livré").eq("invoice_id", anchor.invoice_id).is("delivered_at", null).limit(200));
      if (group.error) throw group.error;
      parcels = group.data;
    } else {
      parcels = [anchor];
    }
    if (!parcels.some((row) => row.id === anchor.id)) parcels.push(anchor);
    parcels.sort((a, b) => text(a.tracking_number).localeCompare(text(b.tracking_number), "fr"));

    // ===== Kliyan + zòn =====
    const centralResult = await db.from("app_settings").select("value").eq("key", "central_account_code").maybeSingle();
    const centralCode = text(centralResult.data?.value).toUpperCase();
    const isCentral = Boolean(centralCode) && customerCode.toUpperCase() === centralCode;
    const clientResult = await db.from("clients").select("customer_code, fullname, surname, phone, ville_id").eq("customer_code", customerCode).maybeSingle();
    if (clientResult.error) throw clientResult.error;
    const client = clientResult.data as { fullname: string | null; surname: string | null; phone: string | null; ville_id: string | null } | null;

    let point = "";
    if (isCentral) {
      const bonIds = Array.from(new Set(parcels.map((row) => text(row.bon_remise_id)).filter(Boolean)));
      const bons = bonIds.length ? await db.from("bons_remise").select("destination").in("id", bonIds) : { data: [], error: null };
      if (bons.error) throw bons.error;
      point = Array.from(new Set((bons.data ?? []).map((bon: { destination: string }) => text(bon.destination)).filter(Boolean))).join(", ");
    } else if (client?.ville_id) {
      const city = await db.from("villes").select("name").eq("id", client.ville_id).maybeSingle();
      point = text(city.data?.name);
    }

    if (staff.role === "agent_retrait") {
      const zone = staff.pickup_ville_id ? await db.from("villes").select("name").eq("id", staff.pickup_ville_id).maybeSingle() : { data: null };
      const zoneName = text(zone.data?.name);
      const allowed = isCentral
        ? Boolean(zoneName) && point.split(", ").every((destination) => destination.toLowerCase() === zoneName.toLowerCase()) && Boolean(point)
        : Boolean(staff.pickup_ville_id) && client?.ville_id === staff.pickup_ville_id;
      if (!allowed) return NextResponse.json({ ok: false, reason: "Cette remise ne fait pas partie de votre point de retrait." }, { status: 403 });
    }

    // ===== Fakti + peman =====
    const invoiceIds = Array.from(new Set(parcels.map((row) => text(row.invoice_id)).filter(Boolean)));
    const invoicesResult = invoiceIds.length
      ? await db.from("invoices").select("id, invoice_number, created_at, grand_total, total_usd, total_htg, exchange_rate_used, order_deposit, balance_due, payment_status, payment_paid_usd, payment_paid_htg").in("id", invoiceIds).order("created_at", { ascending: true })
      : { data: [], error: null };
    if (invoicesResult.error) throw invoicesResult.error;
    const paymentsResult = invoiceIds.length
      ? await db.from("invoice_payments").select("invoice_id, amount, currency, payment_method, payment_reference, received_by_name, recorded_by_role, created_at").in("invoice_id", invoiceIds).order("created_at", { ascending: true })
      : { data: [], error: null };
    if (paymentsResult.error) throw paymentsResult.error;
    const invoiceRows = (invoicesResult.data ?? []) as any[];
    const invoiceNumberById = new Map(invoiceRows.map((invoice) => [text(invoice.id), text(invoice.invoice_number)]));

    const invoices = invoiceRows.map((invoice) => {
      const amounts = invoiceRemainingAmounts(invoice);
      return {
        invoice_number: text(invoice.invoice_number), created_at: text(invoice.created_at),
        total_usd: amounts.grandTotalUsd, deposit_usd: amounts.depositUsd,
        payable_usd: amounts.payableUsd, payable_htg: amounts.payableHtg,
        paid_usd: amounts.paidUsd, paid_htg: amounts.paidHtg,
        remaining_usd: amounts.remainingUsd, remaining_htg: amounts.remainingHtg,
        payment_status: paymentStatusFromAmounts(invoice),
        payments: ((paymentsResult.data ?? []) as any[]).filter((payment) => text(payment.invoice_id) === text(invoice.id)).map((payment) => ({
          method: text(payment.payment_method) || "Espèces", reference: text(payment.payment_reference),
          amount: money(payment.amount), currency: text(payment.currency) || "USD", created_at: text(payment.created_at),
          received_by: text(payment.received_by_name) || (text(payment.recorded_by_role) === "admin" ? "Administration" : "Point de retrait")
        }))
      };
    });

    // ===== Ajans ki remèt koli yo (adrès, telefòn, lè) — tab `agences`, menm non ak vil la =====
    const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    let agency: RemiseTicket["agency"] = null;
    if (point) {
      const agencesResult = await db.from("agences").select("nom, adresse, telephone, horaire_1, horaire_2").eq("active", true);
      const wanted = normalize(point.split(", ")[0] ?? "");
      const match = ((agencesResult.data ?? []) as Array<{ nom: string; adresse: string; telephone: string; horaire_1: string; horaire_2: string }>)
        .find((row) => normalize(text(row.nom)) === wanted) ?? null;
      if (match) agency = { name: text(match.nom), address: text(match.adresse), phone: text(match.telephone), hours: [text(match.horaire_1), text(match.horaire_2)].filter(Boolean).join(" · ") };
    }

    // ===== Nimewo ticket + kòd sekirite (detèminis) =====
    const deliveredAt = text(anchor.delivered_at);
    const fingerprint = parcels.map((row) => row.id).sort().join(",") + "|" + deliveredAt;
    const digest = createHash("sha256").update(fingerprint).digest("hex").slice(0, 8).toUpperCase();
    const day = (deliveredAt || new Date().toISOString()).slice(0, 10).replaceAll("-", "");
    const ticketNumber = `TR-${day}-${digest}`;
    const signature = createHmac("sha256", config.key).update("remise-ticket|" + ticketNumber + "|" + fingerprint).digest("hex").toUpperCase();
    const securityCode = `${signature.slice(0, 4)}-${signature.slice(4, 8)}`;

    const packages = parcels.map((row) => ({
      id: text(row.id), guia: text(row.tracking_number), tracking: text(row.tracking_manual),
      content: text(row.content).slice(0, 60), quantity: Number(row.quantity ?? 1) || 1,
      weight: money(row.weight), invoice_number: invoiceNumberById.get(text(row.invoice_id)) ?? ""
    }));
    const sum = (values: number[]) => money(values.reduce((total, value) => total + value, 0));
    const customerName = isCentral ? "Compte central STANDA"
      : [text(client?.fullname), text(client?.surname)].filter(Boolean).join(" ") || text(anchor.customer_name);
    const deliveredBy = Array.from(new Set(parcels.map((row) => text(row.delivered_by)).filter(Boolean))).join(", ");

    const ticket: RemiseTicket = {
      ticket_number: ticketNumber,
      security_code: securityCode,
      company: { name: "STANDA COMMERCIAL", phone: SUPPORT_PHONE, website: SITE_URL.replace(/^https?:\/\//, ""), email: SITE.email },
      agency,
      point,
      delivered_at: deliveredAt,
      delivered_by: deliveredBy,
      printed_by: `${staffName(staff)} (${staff.role === "agent_retrait" ? "Point de retrait" : staff.role === "admin" ? "Administration" : "Employé"})`,
      printed_at: new Date().toISOString(),
      customer: { code: customerCode, name: customerName, phone: isCentral ? "" : maskPhone(client?.phone), city: point, is_central: isCentral },
      packages,
      invoices,
      totals: {
        packages: packages.length,
        articles: packages.reduce((total, item) => total + item.quantity, 0),
        weight_lb: sum(packages.map((item) => item.weight)),
        payable_usd: sum(invoices.map((invoice) => invoice.payable_usd)),
        payable_htg: sum(invoices.map((invoice) => invoice.payable_htg)),
        paid_usd: sum(invoices.map((invoice) => invoice.paid_usd)),
        paid_htg: sum(invoices.map((invoice) => invoice.paid_htg)),
        remaining_usd: sum(invoices.map((invoice) => invoice.remaining_usd)),
        remaining_htg: sum(invoices.map((invoice) => invoice.remaining_htg))
      },
      qr_payload: [
        "STANDA COMMERCIAL - Ticket de remise",
        `Ticket: ${ticketNumber}`,
        `Client: ${customerCode}`,
        `Colis: ${packages.length}`,
        `Remis le: ${deliveredAt || "-"}`,
        `Code: ${securityCode}`
      ].join("\n")
    };

    return NextResponse.json({ ok: true, ticket }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[remise-ticket]", error);
    return NextResponse.json({ ok: false, reason: "Ticket de remise indisponible." }, { status: 500 });
  }
}
