import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { getSupabaseAdminConfig } from "@/lib/supabase-server";
import { clientIp, rateLimit, tooMany } from "@/lib/ratelimit";
import { readJsonBody } from "@/lib/validation/request";
import { hasSignificantInvoiceBalance, invoiceRemainingAmounts } from "@/lib/invoice-payable";
import { ergensMatcher } from "@/lib/invoice-brand";

/**
 * ASSISTANT DE CALCUL DE L'ADMINISTRATEUR
 * Les chiffres sont calculés ici, sans IA (tableau de bord MCPACK envoyé par
 * l'écran + soldes clients et colis lus en base). L'IA reçoit ces chiffres et
 * ne fait que répondre à la question avec eux : elle n'invente aucun montant.
 * Réservé à l'administrateur.
 */
const lbs = z.object({ standa: z.number().min(0).max(1e6), dokasav: z.number().min(0).max(1e6), blic: z.number().min(0).max(1e6) });
const schema = z.object({
  token: z.string().min(10).max(5000),
  question: z.string().trim().min(2, "Écrivez votre question.").max(600, "Question trop longue."),
  mcpack: z.object({
    rate: z.number().min(0).max(100),
    lotLbs: lbs,
    nextLotLbs: lbs,
    lotInvoiced: z.boolean(),
    printedLbs: z.number().nullable(),
    printedUsd: z.number().nullable(),
    conduceCount: z.number().int().min(0).max(10000),
    ergensReceived: z.boolean(),
  }).nullable(),
});

const usd = (n: number) => "$" + (Math.round(n * 100) / 100).toFixed(2);
const lb = (n: number) => (Math.round(n * 100) / 100).toFixed(2) + " lb";

export async function POST(req: Request) {
  const rl = rateLimit(`admin-assistant:${clientIp(req)}`, 30, 10 * 60_000);
  if (!rl.ok) return tooMany(rl.retryAfter);
  const read = await readJsonBody(req, schema, 16_000);
  if (!read.ok) return read.response;
  const { token, question, mcpack } = read.data;

  const config = getSupabaseAdminConfig();
  if (!config) return NextResponse.json({ ok: false, reason: "Service indisponible." }, { status: 503 });
  const db = createClient(config.url, config.key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: who } = await db.auth.getUser(token);
  if (!who.user) return NextResponse.json({ ok: false, reason: "Session expirée." }, { status: 401 });
  const { data: staff } = await db.from("staff").select("role").eq("auth_user_id", who.user.id).maybeSingle();
  if (staff?.role !== "admin") return NextResponse.json({ ok: false, reason: "Accès administrateur requis." }, { status: 403 });

  // ── Chiffres calculés sans IA ──────────────────────────────────────────
  const facts: string[] = [];
  if (mcpack) {
    const total = mcpack.lotLbs.standa + mcpack.lotLbs.dokasav + mcpack.lotLbs.blic;
    const ergens = mcpack.lotLbs.dokasav + mcpack.lotLbs.blic;
    const next = mcpack.nextLotLbs.standa + mcpack.nextLotLbs.dokasav + mcpack.nextLotLbs.blic;
    facts.push(
      `MCPACK, lot en cours (${mcpack.conduceCount} conduce(s), ${mcpack.lotInvoiced ? "facture MCPACK reçue" : "pas encore de facture MCPACK"}) :`,
      `  Tarif : ${usd(mcpack.rate)} par livre.`,
      `  Total à payer à MCPACK : ${lb(total)} × ${usd(mcpack.rate)} = ${usd(total * mcpack.rate)}.`,
      `  Part STANDA : ${lb(mcpack.lotLbs.standa)} = ${usd(mcpack.lotLbs.standa * mcpack.rate)}.`,
      `  Part Dokasav : ${lb(mcpack.lotLbs.dokasav)} = ${usd(mcpack.lotLbs.dokasav * mcpack.rate)}.`,
      `  Part Blic Express : ${lb(mcpack.lotLbs.blic)} = ${usd(mcpack.lotLbs.blic * mcpack.rate)}.`,
      `  Part Ergens (Dokasav + Blic) : ${lb(ergens)} = ${usd(ergens * mcpack.rate)}, ${mcpack.ergensReceived ? "déjà reçue" : "pas encore reçue"}.`,
      mcpack.printedLbs !== null && mcpack.printedUsd !== null
        ? `  Facture MCPACK imprimée : ${lb(mcpack.printedLbs)}, ${usd(mcpack.printedUsd)}. Écart avec notre calcul : ${lb(total - mcpack.printedLbs)}, ${usd(total * mcpack.rate - mcpack.printedUsd)}.`
        : `  Pas de total imprimé disponible pour comparer.`,
      `  Prochain lot (conduces arrivées après la facture) : ${lb(next)} = ${usd(next * mcpack.rate)}.`,
    );
  }

  // Soldes clients : même règle que tout le système (moins de 50 HTG = soldé).
  const invoices: Record<string, unknown>[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("invoices")
      .select("customer_code, customer_name, grand_total, total_usd, total_htg, exchange_rate_used, order_deposit, balance_due, payment_paid_usd, payment_paid_htg, payment_status")
      .neq("payment_status", "Payé").order("id").range(from, from + 999);
    if (error) break;
    invoices.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  // Budget STANDA et budget Ergens (Dokasav, Blic, clients Dokasav) comptés à part.
  const { data: ergensRow } = await db.from("app_settings").select("value").eq("key", "mcpack_ergens_codes").maybeSingle();
  const isErgens = ergensMatcher(ergensRow?.value ?? "");
  const owed = { standa: { usd: 0, n: 0, clients: new Set<string>() }, ergens: { usd: 0, n: 0, clients: new Set<string>() } };
  for (const inv of invoices) {
    if (!hasSignificantInvoiceBalance(inv as never)) continue;
    const a = invoiceRemainingAmounts(inv as never);
    const share = Math.min(1, (a.payableUsd ? a.paidUsd / a.payableUsd : 0) + (a.payableHtg ? a.paidHtg / a.payableHtg : 0));
    const bucket = isErgens(inv.customer_code, inv.customer_name) ? owed.ergens : owed.standa;
    bucket.usd += a.payableUsd * (1 - share);
    bucket.n++; bucket.clients.add(String(inv.customer_code ?? ""));
  }
  facts.push(
    `Clients STANDA : ${owed.standa.n} facture(s) non soldée(s), ${owed.standa.clients.size} client(s), reste à encaisser environ ${usd(owed.standa.usd)}.`,
    `Clients Ergens (Dokasav, Blic, clients Dokasav), budget séparé de STANDA : ${owed.ergens.n} facture(s) non soldée(s), ${owed.ergens.clients.size} client(s), environ ${usd(owed.ergens.usd)}.`,
  );

  const statuses = ["Reçu à Miami", "En préparation", "En transit", "Arrivé en Haïti", "En route vers agence", "Disponible", "Facturé"];
  const counts = await Promise.all(statuses.map(async (s) => {
    const { count } = await db.from("packages").select("id", { count: "exact", head: true }).eq("status", s).or("archived.is.null,archived.eq.false");
    return `${s} : ${count ?? 0}`;
  }));
  facts.push(`Colis non livrés par statut : ${counts.join(", ")}.`);

  const factsText = facts.join("\n");
  const apiKey = process.env.GEMINI_API_KEY || process.env.Gemini_API_Key;
  if (!apiKey) return NextResponse.json({ ok: true, answer: factsText, facts: factsText, ai: false });

  try {
    const ai = new GoogleGenAI({ apiKey });
    const interaction = await ai.interactions.create({
      model: "gemini-2.5-flash",
      input: question,
      system_instruction: [
        "Tu es l'assistant de calcul de l'administrateur de STANDA COMMERCIAL.",
        "Réponds en kreyòl ayisyen simple, sauf si la question est posée en français.",
        "Utilise UNIQUEMENT les chiffres du bloc CHIFFRES ci-dessous : ils sont déjà calculés et exacts. N'invente jamais un montant ou un poids.",
        "Si tu dois additionner ou soustraire, fais-le à partir de ces chiffres et montre le calcul en une ligne.",
        "Si la réponse n'est pas dans les chiffres, dis-le simplement.",
        "Réponse courte : 2 à 5 lignes, sans titre, sans emoji, sans tiret.",
        "CHIFFRES :\n" + factsText,
      ].join("\n"),
    });
    const answer = String(interaction.output_text ?? "").trim() || factsText;
    return NextResponse.json({ ok: true, answer, facts: factsText, ai: true });
  } catch (error) {
    console.error("[admin-assistant] Gemini indisponible", error);
    return NextResponse.json({ ok: true, answer: factsText, facts: factsText, ai: false });
  }
}
