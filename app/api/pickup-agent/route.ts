import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdminConfig } from "@/lib/supabase-server";
import { clientIp, rateLimit, tooMany } from "@/lib/ratelimit";

/**
 * API isolée des points de retrait.
 * L'agent n'a aucun droit RLS direct sur les colis, clients, factures ou
 * paiements. Toutes les données sortent d'ici après une double vérification:
 * la session appartient à un agent_retrait ET le client est dans sa zone.
 */
type Agent = {
  id: string; username: string; prenom: string; nom: string;
  role: string; pickup_ville_id: string | null;
};
type Parcel = {
  id: string; tracking_number: string | null; tracking_manual: string | null;
  customer_code: string; quantity: number | null; content: string | null;
  created_date: string | null; received_at: string | null; status: string;
  invoice_id: string | null; conduce_id: string | null;
};
type ZoneInvoice = {
  id: string; invoice_number: string; customer_code: string; package_count: number | null;
  total_usd: number | null; total_htg: number | null; exchange_rate_used: number | null;
  has_pdf: boolean | null; created_at: string; payment_status: string | null;
  payment_paid_usd: number | null; payment_paid_htg: number | null;
};
type ZoneCustomer = { customer_code: string; fullname: string | null; surname: string | null };
type CustomerBalance = { usd: number; htg: number; invoiceId: string; invoiceNumber: string };

const uuid = /^[0-9a-f]{8}-[0-9a-f-]{27}$/i;
const money = (value: unknown) => Math.round(Number(value ?? 0) * 100) / 100;
const code = (value: unknown) => String(value ?? "").trim();
const PAYMENT_METHODS = new Set(["Espèces", "MonCash", "NatCash", "Zelle", "Virement bancaire"]);

function bearerToken(req: Request) {
  const value = req.headers.get("authorization") ?? "";
  return value.startsWith("Bearer ") ? value.slice(7).trim() : "";
}
function agentName(agent: Agent) {
  return [agent.prenom, agent.nom].filter(Boolean).join(" ") || agent.username;
}
function auditRow(req: Request, agent: Agent, action: string, details: string, packageRef = "", customerCode = "") {
  const xff = req.headers.get("x-forwarded-for") ?? "";
  return {
    user_name: `${agentName(agent)} (agent_retrait)`, action, details,
    package_ref: packageRef.slice(0, 120), customer_code: customerCode.slice(0, 60),
    ip_address: (xff.split(",")[0] || req.headers.get("x-real-ip") || "").trim(),
    user_agent: (req.headers.get("user-agent") ?? "").slice(0, 400)
  };
}

async function contextFor(req: Request): Promise<
  | { ok: true; db: any; agent: Agent; zoneName: string }
  | { ok: false; response: NextResponse }
> {
  const config = getSupabaseAdminConfig();
  if (!config) return { ok: false, response: NextResponse.json({ ok: false, reason: "Service indisponible." }, { status: 503 }) };
  const token = bearerToken(req);
  if (!token) return { ok: false, response: NextResponse.json({ ok: false, reason: "Session requise." }, { status: 401 }) };

  // Le client Supabase est utilisé EXCLUSIVEMENT ici, sur le serveur Vercel.
  const db: any = createClient(config.url, config.key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: auth } = await db.auth.getUser(token);
  if (!auth.user) return { ok: false, response: NextResponse.json({ ok: false, reason: "Session invalide." }, { status: 401 }) };

  const result = await db.from("staff").select("id, username, prenom, nom, role, pickup_ville_id")
    .eq("auth_user_id", auth.user.id).maybeSingle();
  const agent = result.data as Agent | null;
  if (!agent || agent.role !== "agent_retrait") {
    return { ok: false, response: NextResponse.json({ ok: false, reason: "Accès réservé aux agents de remise." }, { status: 403 }) };
  }
  if (!agent.pickup_ville_id) {
    return { ok: false, response: NextResponse.json({ ok: false, reason: "Votre zone de remise n'est pas configurée." }, { status: 409 }) };
  }
  const zoneResult = await db.from("villes").select("name").eq("id", agent.pickup_ville_id).maybeSingle();
  if (!zoneResult.data?.name) {
    return { ok: false, response: NextResponse.json({ ok: false, reason: "Votre zone de remise est introuvable." }, { status: 409 }) };
  }
  return { ok: true, db, agent, zoneName: code(zoneResult.data.name) };
}

async function zoneCustomers(db: any, villeId: string): Promise<ZoneCustomer[]> {
  const result = await db.from("clients").select("customer_code, fullname, surname").eq("ville_id", villeId).neq("customer_code", "");
  if (result.error) throw result.error;
  const known = new Map<string, ZoneCustomer>();
  for (const row of (result.data ?? []) as Array<{ customer_code: string | null; fullname: string | null; surname: string | null }>) {
    const customer_code = code(row.customer_code);
    if (customer_code) known.set(customer_code, { customer_code, fullname: row.fullname, surname: row.surname });
  }
  return Array.from(known.values());
}

function customerName(customer?: ZoneCustomer) {
  return [code(customer?.fullname), code(customer?.surname)].filter(Boolean).join(" ");
}

async function customerBelongsToZone(db: any, customerCode: string, villeId: string) {
  const result = await db.from("clients").select("ville_id").eq("customer_code", customerCode).maybeSingle();
  return result.data?.ville_id === villeId;
}

async function writeAudit(db: any, req: Request, agent: Agent, action: string, details: string, packageRef = "", customerCode = "") {
  try {
    const { error } = await db.from("journal").insert(auditRow(req, agent, action, details, packageRef, customerCode));
    if (error) console.error("[pickup-agent:audit]", error);
  } catch (error) { console.error("[pickup-agent:audit]", error); }
}

export async function GET(req: Request) {
  const rl = rateLimit("pickup-agent:read:" + clientIp(req), 120, 60_000);
  if (!rl.ok) return tooMany(rl.retryAfter);
  try {
    const context = await contextFor(req);
    if (!context.ok) return context.response;
    const { db, agent, zoneName } = context;
    const customers = await zoneCustomers(db, agent.pickup_ville_id!);
    const codes = customers.map((customer) => customer.customer_code);
    const customerByCode = new Map(customers.map((customer) => [customer.customer_code, customer]));

    let parcels: Parcel[] = [];
    let invoices: ZoneInvoice[] = [];
    if (codes.length) {
      const [parcelResult, invoiceResult] = await Promise.all([
        db.from("packages").select("id, tracking_number, tracking_manual, customer_code, quantity, content, created_date, received_at, status, invoice_id, conduce_id")
          .eq("archived", false).in("customer_code", codes).order("created_at", { ascending: false }).limit(5000),
        db.from("invoices").select("id, invoice_number, customer_code, package_count, total_usd, total_htg, exchange_rate_used, has_pdf, created_at, payment_status, payment_paid_usd, payment_paid_htg")
          .in("customer_code", codes).order("created_at", { ascending: false }).limit(1000)
      ]);
      if (parcelResult.error) throw parcelResult.error;
      if (invoiceResult.error) throw invoiceResult.error;
      parcels = (parcelResult.data ?? []) as Parcel[];
      invoices = (invoiceResult.data ?? []) as ZoneInvoice[];
    }

    const invoiceMap = new Map(invoices.map((invoice) => [invoice.id, invoice]));
    // Balans lan kalkile sou TOUT fakti kliyan an ki poko peye nèt. Nou kenbe
    // pi ansyen fakti a kòm sa Rony dwe regle an premye anvan nenpòt lòt remis.
    const balanceByCustomer = new Map<string, CustomerBalance>();
    const oldestFirst = [...invoices].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
    for (const invoice of oldestFirst) {
      const remainingUsd = Math.max(0, money(Number(invoice.total_usd) - Number(invoice.payment_paid_usd)));
      const remainingHtg = Math.max(0, money(Number(invoice.total_htg) - Number(invoice.payment_paid_htg)));
      if (remainingUsd <= 0.01) continue;
      const current = balanceByCustomer.get(code(invoice.customer_code));
      balanceByCustomer.set(code(invoice.customer_code), {
        usd: money((current?.usd ?? 0) + remainingUsd), htg: money((current?.htg ?? 0) + remainingHtg),
        invoiceId: current?.invoiceId || code(invoice.id), invoiceNumber: current?.invoiceNumber || code(invoice.invoice_number)
      });
    }
    const conduiteIds = Array.from(new Set(parcels.map((parcel) => code(parcel.conduce_id)).filter(Boolean)));
    let bons: Array<{ id: string; bon_number: string; destination: string; package_count: number; created_at: string; pdf_path: string | null }> = [];
    if (conduiteIds.length) {
      const linksResult = await db.from("bon_remise_conduces").select("bon_remise_id").in("conduce_id", conduiteIds);
      if (linksResult.error && !String(linksResult.error.message ?? "").includes("does not exist")) throw linksResult.error;
      const bonIds = Array.from(new Set(((linksResult.data ?? []) as Array<{ bon_remise_id: string }>).map((row) => code(row.bon_remise_id)).filter(Boolean)));
      if (bonIds.length) {
        const bonsResult = await db.from("bons_remise")
          .select("id, bon_number, destination, package_count, created_at, pdf_path")
          .in("id", bonIds).order("created_at", { ascending: false });
        if (bonsResult.error) throw bonsResult.error;
        bons = (bonsResult.data ?? []) as typeof bons;
      }
    }

    // Un Bon peut contenir le compte central STANDA, donc aucun code client de
    // Gonaïves. Son champ destination reste alors la référence sûre pour que
    // Rony voie aussi ce PDF dans son point de retrait.
    const destinationBons = await db.from("bons_remise")
      .select("id, bon_number, destination, package_count, created_at, pdf_path")
      .ilike("destination", zoneName).order("created_at", { ascending: false });
    if (destinationBons.error && !String(destinationBons.error.message ?? "").includes("does not exist")) throw destinationBons.error;
    const byBonId = new Map(bons.map((bon) => [bon.id, bon]));
    for (const bon of (destinationBons.data ?? []) as typeof bons) byBonId.set(bon.id, bon);
    bons = Array.from(byBonId.values()).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));

    const bonCards = bons.map((bon) => ({
        id: code(bon.id), bon_number: code(bon.bon_number), destination: code(bon.destination),
        package_count: Number(bon.package_count ?? 0), created_at: code(bon.created_at),
        has_pdf: Boolean(bon.pdf_path)
      }));

    // Liste blanche stricte, sans téléphone, adresse, identité ni coûts des colis.
    const packageCards = parcels.map((parcel) => {
      const invoice = parcel.invoice_id ? invoiceMap.get(parcel.invoice_id) : undefined;
      const customer = customerByCode.get(code(parcel.customer_code));
      const balance = balanceByCustomer.get(code(parcel.customer_code));
      return {
        id: code(parcel.id), tracking_number: code(parcel.tracking_number), tracking_manual: code(parcel.tracking_manual),
        customer_code: code(parcel.customer_code), customer_name: customerName(customer), quantity: Number(parcel.quantity ?? 1) || 1,
        content: code(parcel.content), created_date: code(parcel.created_date), received_at: code(parcel.received_at),
        status: code(parcel.status), invoice_id: invoice?.id ?? "", invoice_number: invoice?.invoice_number ?? "",
        invoice_payment_status: invoice?.payment_status ?? "Non facturé", customer_balance_usd: balance?.usd ?? 0,
        customer_balance_htg: balance?.htg ?? 0, balance_invoice_id: balance?.invoiceId ?? "", balance_invoice_number: balance?.invoiceNumber ?? ""
      };
    });
    const invoiceCards = invoices.map((invoice) => {
      const customerCode = code(invoice.customer_code);
      const balance = balanceByCustomer.get(customerCode);
      return {
      id: code(invoice.id), invoice_number: code(invoice.invoice_number), customer_code: customerCode,
      customer_name: customerName(customerByCode.get(customerCode)), customer_balance_usd: balance?.usd ?? 0, customer_balance_htg: balance?.htg ?? 0,
      package_count: Number(invoice.package_count ?? 0), total_usd: money(invoice.total_usd), total_htg: money(invoice.total_htg),
      payment_status: code(invoice.payment_status) || "Non payé", payment_paid_usd: money(invoice.payment_paid_usd),
      payment_paid_htg: money(invoice.payment_paid_htg), has_pdf: Boolean(invoice.has_pdf), created_at: code(invoice.created_at)
    }; });

    return NextResponse.json({ ok: true, agent: { name: agentName(agent), username: agent.username }, zone: { name: zoneName },
      packages: packageCards, invoices: invoiceCards, bons: bonCards });
  } catch (error) {
    console.error("[pickup-agent:get]", error);
    return NextResponse.json({ ok: false, reason: "Impossible de charger les opérations de votre zone." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const rl = rateLimit("pickup-agent:write:" + clientIp(req), 30, 60_000);
  if (!rl.ok) return tooMany(rl.retryAfter);
  try {
    const context = await contextFor(req);
    if (!context.ok) return context.response;
    const { db, agent, zoneName } = context;
    const body = await req.json().catch(() => null);

    if (body?.action === "record_payment") {
      const invoiceId = code(body.invoice_id);
      const amount = money(body.amount);
      const currency = code(body.currency).toUpperCase();
      const paymentMethod = code(body.payment_method) || "Espèces";
      const paymentReference = code(body.payment_reference).slice(0, 120);
      if (!uuid.test(invoiceId) || !["USD", "HTG"].includes(currency) || amount <= 0 || !PAYMENT_METHODS.has(paymentMethod)) {
        return NextResponse.json({ ok: false, reason: "Montant, devise ou méthode de paiement invalide." }, { status: 400 });
      }
      if ((currency === "USD" && amount > 100000) || (currency === "HTG" && amount > 50000000)) {
        return NextResponse.json({ ok: false, reason: "Montant trop élevé: vérifiez votre saisie." }, { status: 400 });
      }
      const invoiceResult = await db.from("invoices")
        .select("id, invoice_number, customer_code, total_usd, total_htg, exchange_rate_used, payment_paid_usd, payment_paid_htg")
        .eq("id", invoiceId).maybeSingle();
      const invoice = invoiceResult.data as {
        id: string; invoice_number: string; customer_code: string; total_usd: number; total_htg: number;
        exchange_rate_used: number; payment_paid_usd: number; payment_paid_htg: number;
      } | null;
      if (!invoice || !(await customerBelongsToZone(db, invoice.customer_code, agent.pickup_ville_id!))) {
        return NextResponse.json({ ok: false, reason: "Cette facture n'appartient pas à votre zone." }, { status: 403 });
      }
      const rate = Number(invoice.exchange_rate_used) > 0 ? Number(invoice.exchange_rate_used) : Number(invoice.total_htg) / Math.max(Number(invoice.total_usd), 1);
      if (!Number.isFinite(rate) || rate <= 0) return NextResponse.json({ ok: false, reason: "Taux de la facture introuvable. Contactez un administrateur." }, { status: 409 });
      const amountUsd = currency === "USD" ? amount : money(amount / rate);
      const amountHtg = currency === "HTG" ? amount : money(amount * rate);
      const priorUsd = money(invoice.payment_paid_usd);
      const priorHtg = money(invoice.payment_paid_htg);
      const remainingUsd = Math.max(0, money(Number(invoice.total_usd) - priorUsd));
      const remainingHtg = Math.max(0, money(Number(invoice.total_htg) - priorHtg));
      // Aksepte yon ti depase lajan (eg. 11 675 pou yon balans 11 673 HTG),
      // men pa kite yon gwo montan pase pa erè. Se sèlman balans la ki aplike.
      const toleranceUsd = currency === "HTG" ? Math.max(0.05, money(5 / rate)) : 0.05;
      if (amountUsd > remainingUsd + toleranceUsd) {
        return NextResponse.json({ ok: false, reason: `Le montant dépasse le reste à payer (${remainingUsd.toFixed(2)} USD).` }, { status: 409 });
      }
      const appliedUsd = Math.min(amountUsd, remainingUsd);
      const appliedHtg = Math.min(amountHtg, remainingHtg);
      const overpaymentAmount = money(currency === "HTG" ? amount - appliedHtg : amount - appliedUsd);
      const newUsd = money(priorUsd + appliedUsd);
      const newHtg = money(priorHtg + appliedHtg);
      const status = newUsd + 0.01 >= money(invoice.total_usd) ? "Payé" : "Payé partiel";
      // Écriture optimiste: une seule caisse peut ajouter un paiement à partir
      // du même solde. Si deux appareils valident au même instant, le second
      // enregistrement est retiré et doit actualiser l'écran.
      const payment = await db.from("invoice_payments").insert({
        invoice_id: invoice.id, amount, currency, amount_usd: amountUsd, amount_htg: amountHtg,
        applied_usd: appliedUsd, applied_htg: appliedHtg, overpayment_amount: overpaymentAmount,
        payment_method: paymentMethod, payment_reference: paymentReference, exchange_rate_used: rate,
        received_by_staff_id: agent.id, received_by_name: agentName(agent), recorded_by_role: "agent_retrait"
      }).select("id").single();
      if (payment.error || !payment.data?.id) throw payment.error ?? new Error("Paiement non enregistré.");
      const update = await db.from("invoices").update({
        payment_status: status, payment_paid_usd: newUsd, payment_paid_htg: newHtg,
        payment_paid_at: status === "Payé" ? new Date().toISOString() : null,
        payment_paid_by: status === "Payé" ? agentName(agent) : null
      }).eq("id", invoice.id).eq("payment_paid_usd", priorUsd).select("id").maybeSingle();
      if (update.error || !update.data) {
        await db.from("invoice_payments").delete().eq("id", payment.data.id);
        if (update.error) throw update.error;
        return NextResponse.json({ ok: false, reason: "Le solde vient de changer. Actualisez avant d'enregistrer ce paiement." }, { status: 409 });
      }
      await writeAudit(db, req, agent, "Paiement client reçu", `${invoice.invoice_number} · ${amount} ${currency} · ${paymentMethod} · ${zoneName}`, invoice.invoice_number, invoice.customer_code);
      return NextResponse.json({ ok: true, payment_status: status, payment_paid_usd: newUsd, payment_paid_htg: newHtg, overpayment_amount: overpaymentAmount, currency });
    }

    if (body?.action === "release") {
      const packageId = code(body.package_id);
      if (!uuid.test(packageId)) return NextResponse.json({ ok: false, reason: "Demande de remise invalide." }, { status: 400 });
      const parcelResult = await db.from("packages")
        .select("id, tracking_number, tracking_manual, customer_code, status, invoice_id")
        .eq("id", packageId).maybeSingle();
      const parcel = parcelResult.data as {
        id: string; tracking_number: string | null; tracking_manual: string | null;
        customer_code: string; status: string; invoice_id: string | null;
      } | null;
      if (!parcel || !["Disponible", "Facturé"].includes(parcel.status)) {
        return NextResponse.json({ ok: false, reason: "Ce colis n'est pas prêt pour une remise." }, { status: 409 });
      }
      if (!(await customerBelongsToZone(db, parcel.customer_code, agent.pickup_ville_id!))) {
        return NextResponse.json({ ok: false, reason: "Ce colis n'appartient pas à votre zone de remise." }, { status: 403 });
      }
      if (!parcel.invoice_id) {
        return NextResponse.json({ ok: false, reason: "Ce colis doit être facturé avant sa remise." }, { status: 409 });
      }
      const invoiceResult = await db.from("invoices").select("payment_status, invoice_number")
        .eq("id", parcel.invoice_id).maybeSingle();
      if (invoiceResult.data?.payment_status !== "Payé") {
        return NextResponse.json({ ok: false, reason: "Enregistrez le paiement complet de la facture avant de remettre ce colis." }, { status: 409 });
      }
      // Règle de caisse: un client doit aussi solder ses anciennes factures.
      // Sinon il pourrait payer uniquement le dernier colis et laisser une
      // dette antérieure, puis continuer les retraits sans contrôle.
      const balances = await db.from("invoices")
        .select("invoice_number, total_usd, payment_paid_usd")
        .eq("customer_code", parcel.customer_code).order("created_at", { ascending: true });
      if (balances.error) throw balances.error;
      const outstanding = (balances.data ?? []).map((row: { invoice_number: string; total_usd: number; payment_paid_usd: number }) => ({
        number: code(row.invoice_number), remaining: Math.max(0, money(Number(row.total_usd) - Number(row.payment_paid_usd)))
      })).filter((row: { remaining: number }) => row.remaining > 0.01);
      if (outstanding.length) {
        const total = money(outstanding.reduce((sum: number, row: { remaining: number }) => sum + row.remaining, 0));
        const refs = outstanding.map((row: { number: string }) => row.number).filter(Boolean).join(", ");
        return NextResponse.json({ ok: false, reason: `Client avec un solde de ${total.toFixed(2)} USD (${refs}). Réglez ce solde avant toute remise.` }, { status: 409 });
      }
      const update = await db.from("packages").update({ status: "Livré" })
        .eq("id", packageId).in("status", ["Disponible", "Facturé"]).select("id").maybeSingle();
      if (update.error) throw update.error;
      if (!update.data) return NextResponse.json({ ok: false, reason: "Ce colis vient déjà d'être traité. Actualisez la liste." }, { status: 409 });
      const ref = code(parcel.tracking_manual || parcel.tracking_number);
      await writeAudit(db, req, agent, "Remise colis", `Colis remis au point de retrait ${zoneName}`, ref, parcel.customer_code);
      return NextResponse.json({ ok: true, package_id: packageId });
    }

    return NextResponse.json({ ok: false, reason: "Action inconnue." }, { status: 400 });
  } catch (error) {
    console.error("[pickup-agent:post]", error);
    return NextResponse.json({ ok: false, reason: "Impossible d'enregistrer l'opération pour le moment." }, { status: 500 });
  }
}
