import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { rateLimit, tooMany, clientIp } from "@/lib/ratelimit";
import { getSupabaseAdminConfig } from "@/lib/supabase-server";
import { createClient } from "@supabase/supabase-js";
import { generateAffiliateCode, generateAffiliatePassword, hashPassword } from "@/lib/affiliate-crypto";
import { buildAffiliateApprovalEmail, sendAffiliateApprovalEmail } from "@/lib/affiliate-mail";
import { SITE_URL } from "@/lib/branding";
import { ensureClientAuthAccount } from "@/lib/client-auth-server";

const PAYOUT_METHODS = new Set(["Espèces", "MonCash", "NatCash", "Virement bancaire", "Zelle"]);

/**
 * API Authentication (kouri sou sèvè Vercel — kle sèvis la pa janm rive nan navigatè).
 * Aksyon: bootstrap (premye admin), create_staff, reset_staff_password, delete_staff,
 *         activate_client (kòd MC -> kont + modpas), reset_client_password.
 */
const SETUP_SECRET = process.env.SETUP_SECRET || "";
const staffEmail = (u: string) => `${u.trim().toLowerCase()}@staff.standacommercialsa.com`;

/** Konparezon konstant nan tan — anpeche atak timing sou SETUP_SECRET. */
function secretOk(provided: string): boolean {
  if (!SETUP_SECRET) return false;
  const a = Buffer.from(String(provided));
  const b = Buffer.from(SETUP_SECRET);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Modpas inisyal: lèt + chif sèlman, fasil pou tape, san karaktè ki konfonn.
 *  Li rete yon modpas nòmal jiskaske kliyan an chwazi chanje li. */
function generatedPassword(len = 12): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let out = "";
  const buf = new Uint32Array(len);
  crypto.getRandomValues(buf);
  for (let i = 0; i < len; i++) out += chars[buf[i] % chars.length];
  return out;
}

export async function POST(req: Request) {
  // Rate limiting — aksyon admin: 20 / 10 min pa IP (anti brute-force)
  const rl = rateLimit("adminauth:" + clientIp(req), 20, 600000);
  if (!rl.ok) return tooMany(rl.retryAfter);

  try {
    const config = getSupabaseAdminConfig();
    if (!config) {
      return NextResponse.json({ ok: false, reason: "SUPABASE_SECRET_KEY pa konfigire sou sèvè a (Settings > Environment Variables) + Redeploy." });
    }
    const svc = createClient(config.url, config.key, { auth: { persistSession: false, autoRefreshToken: false } });
    const body = await req.json();
    const action = String(body.action ?? "");

    // ---------- caller role ----------
    async function callerRole(): Promise<"admin" | "employe" | "agent_retrait" | "agent_reception" | null> {
      const token = String(body.token ?? "");
      if (!token) return null;
      const { data } = await svc.auth.getUser(token);
      if (!data.user) return null;
      const { data: s } = await svc.from("staff").select("role").eq("auth_user_id", data.user.id).maybeSingle();
      return (s?.role as "admin" | "employe" | "agent_retrait" | "agent_reception") ?? null;
    }

    /** Username anplwaye k ap fè aksyon an (piste odit — ex: kilès ki make yon komisyon peye). */
    async function callerUsername(): Promise<string> {
      const token = String(body.token ?? "");
      if (!token) return "";
      const { data } = await svc.auth.getUser(token);
      if (!data.user) return "";
      const { data: s } = await svc.from("staff").select("username").eq("auth_user_id", data.user.id).maybeSingle();
      return String(s?.username ?? "");
    }

    // ---------- bootstrap: premye admin (sèlman si staff vid + SETUP_SECRET) ----------
    if (action === "bootstrap") {
      // SEKIRITE: san sa a, nenpòt moun ki jwenn deplwaman an anvan mèt la —
      // oswa nenpòt lè tab `staff` la vin vid — te ka kreye pwòp kont admin li.
      if (!SETUP_SECRET) {
        return NextResponse.json({ ok: false, reason: "SETUP_SECRET pa konfigire nan Vercel (Settings > Environment Variables). Ajoute l epi Redeploy pou kreye premye admin nan." });
      }
      if (!secretOk(String(body.setup_secret ?? ""))) {
        return NextResponse.json({ ok: false, reason: "Clé d'installation invalide." }, { status: 403 });
      }
      const { count } = await svc.from("staff").select("*", { count: "exact", head: true });
      if ((count ?? 0) > 0) return NextResponse.json({ ok: false, reason: "Sistèm nan deja gen yon administratè." });
      const username = String(body.username ?? "").trim();
      const password = String(body.password ?? "");
      if (!username || password.length < 6) return NextResponse.json({ ok: false, reason: "Username + modpas (6+ karaktè) obligatwa." });
      const { data: u, error } = await svc.auth.admin.createUser({
        email: staffEmail(username), password, email_confirm: true
      });
      if (error) return NextResponse.json({ ok: false, reason: error.message });
      const { error: e2 } = await svc.from("staff").insert({
        auth_user_id: u.user.id, role: "admin", username,
        nom: String(body.nom ?? ""), prenom: String(body.prenom ?? "")
      });
      if (e2) return NextResponse.json({ ok: false, reason: e2.message });
      return NextResponse.json({ ok: true });
    }

    const role = await callerRole();

    // ---------- create_staff (admin sèlman) ----------
    if (action === "create_staff") {
      if (role !== "admin") return NextResponse.json({ ok: false, reason: "Accès refusé." });
      const username = String(body.username ?? "").trim();
      const password = String(body.password ?? "");
      const newRole = body.role === "admin"
        ? "admin"
        : body.role === "agent_retrait" ? "agent_retrait"
        : body.role === "agent_reception" ? "agent_reception" : "employe";
      const pickupVilleId = String(body.pickup_ville_id ?? "").trim();
      if (!username || password.length < 6) return NextResponse.json({ ok: false, reason: "Username + modpas (6+ karaktè) obligatwa." });
      if (newRole === "agent_retrait" && !pickupVilleId) {
        return NextResponse.json({ ok: false, reason: "Chwazi zòn/pwen rekiperasyon ajan an." });
      }
      const { data: u, error } = await svc.auth.admin.createUser({
        email: staffEmail(username), password, email_confirm: true
      });
      if (error) return NextResponse.json({ ok: false, reason: error.message.includes("already") ? "Username sa a egziste deja." : error.message });
      const { error: e2 } = await svc.from("staff").insert({
        auth_user_id: u.user.id, role: newRole, username,
        nom: String(body.nom ?? ""), prenom: String(body.prenom ?? ""),
        email: String(body.email ?? ""), phone: String(body.phone ?? ""),
        id_number: String(body.id_number ?? ""), id_photo_url: String(body.id_photo_url ?? ""),
        pickup_ville_id: newRole === "agent_retrait" ? pickupVilleId : null
      });
      if (e2) { await svc.auth.admin.deleteUser(u.user.id); return NextResponse.json({ ok: false, reason: e2.message }); }
      return NextResponse.json({ ok: true });
    }

    // ---------- reset_staff_password (admin sèlman) ----------
    // Yon admin ka re-bay yon modpas pou yon anplwaye san efase kont li,
    // konsa istorik travay ak referans kont lan rete entak.
    if (action === "reset_staff_password") {
      if (role !== "admin") return NextResponse.json({ ok: false, reason: "Accès refusé." });
      const staffId = String(body.staff_id ?? "");
      const password = String(body.password ?? "");
      if (!staffId || password.length < 6) {
        return NextResponse.json({ ok: false, reason: "Mot de passe (6+ karaktè) obligatwa." });
      }
      const { data: member } = await svc.from("staff").select("auth_user_id").eq("id", staffId).maybeSingle();
      if (!member?.auth_user_id) return NextResponse.json({ ok: false, reason: "Compte employé introuvable." });
      const { error } = await svc.auth.admin.updateUserById(member.auth_user_id, { password });
      if (error) return NextResponse.json({ ok: false, reason: error.message });
      return NextResponse.json({ ok: true });
    }

    // ---------- delete_staff (admin sèlman) ----------
    if (action === "delete_staff") {
      if (role !== "admin") return NextResponse.json({ ok: false, reason: "Accès refusé." });
      const id = String(body.staff_id ?? "");
      const { data: s } = await svc.from("staff").select("auth_user_id").eq("id", id).maybeSingle();
      if (s?.auth_user_id) await svc.auth.admin.deleteUser(s.auth_user_id).catch(() => null);
      await svc.from("staff").delete().eq("id", id);
      return NextResponse.json({ ok: true });
    }

    // ---------- activate_client: kòd MC -> kont + modpas inisyal ----------
    if (action === "activate_client") {
      if (role !== "admin" && role !== "employe") return NextResponse.json({ ok: false, reason: "Accès refusé." });
      const clientId = String(body.client_id ?? "");
      // Nòmalizasyon V7.2: "25487" -> "MC-25487" — kle inik kliyan an
      const rawCode = String(body.mc_code ?? "").trim().replace(/\s+/g, "").toUpperCase();
      const code = rawCode ? (rawCode.startsWith("MC-") ? rawCode : "MC-" + rawCode.replace(/^MC/, "").replace(/^-+/, "")) : "";
      if (!clientId || !code) return NextResponse.json({ ok: false, reason: "Kòd MC obligatwa." });
      const pass = generatedPassword();
      const linked = await ensureClientAuthAccount(svc, clientId, code, pass, { activate: true });
      if (!linked.ok) return NextResponse.json({ ok: false, reason: linked.reason });
      return NextResponse.json({ ok: true, password: pass, username: code });
    }

    // ---------- reset_client_password ----------
    if (action === "reset_client_password") {
      if (role !== "admin" && role !== "employe") return NextResponse.json({ ok: false, reason: "Accès refusé." });
      const clientId = String(body.client_id ?? "");
      const { data: c } = await svc.from("clients")
        .select("customer_code").eq("id", clientId).maybeSingle();
      if (!c) return NextResponse.json({ ok: false, reason: "Kliyan pa jwenn." });
      const code = String(c.customer_code ?? "").trim();
      if (!code) return NextResponse.json({ ok: false, reason: "Kliyan sa a poko gen kòd MC — sèvi ak 'Créer compte MCPACK' pito." });
      const pass = generatedPassword();
      const linked = await ensureClientAuthAccount(svc, clientId, code, pass);
      if (!linked.ok) return NextResponse.json({ ok: false, reason: linked.reason });
      return NextResponse.json({ ok: true, password: pass, username: code });
    }

    // ---------- Kreye/renouvle yon liy afilye + voye imèl (pataje ant approve/renew) ----------
    // Jenere yon kòd/lyen/login TOUNÈF, yon kontra 3 mwa, epi voye yon imèl
    // (kontra PDF STANDA telechaje + lyen + kredansyèl). Retounen { ok:false, reason }
    // si yon bagay echwe, sinon { ok:true, aff, username, password, referralLink, mailSent, mailError }.
    async function createAffiliateAndNotify(basis: {
      application_id: string | null; fullname: string; email: string; phone: string; whatsapp: string;
      renewed_from_affiliate_id: string | null;
    }) {
      const isRenewal = !!basis.renewed_from_affiliate_id;
      const { data: settingsRows } = await svc.from("app_settings").select("*").in("key", ["affiliate_commission_amount", "affiliate_contract_pdf_url"]);
      const settings = Object.fromEntries((settingsRows ?? []).map((s: { key: string; value: string }) => [s.key, s.value]));
      const commissionAmount = Number(settings.affiliate_commission_amount) > 0 ? Number(settings.affiliate_commission_amount) : 10;
      const contractPdfUrl = String(settings.affiliate_contract_pdf_url ?? "").trim() || null;

      let code = generateAffiliateCode(basis.fullname);
      // Kòd dwe inik — reesye kèk fwa si koyensidans (ra men posib).
      for (let i = 0; i < 5; i++) {
        const { data: exists } = await svc.from("affiliates").select("id").eq("code", code).maybeSingle();
        if (!exists) break;
        code = generateAffiliateCode(basis.fullname);
      }
      const password = generateAffiliatePassword();
      const contractStart = new Date();
      const contractEnd = new Date(contractStart);
      contractEnd.setMonth(contractEnd.getMonth() + 3);
      const toISODate = (d: Date) => d.toISOString().slice(0, 10);
      const referralLink = `${SITE_URL}/inscription?ref=${code}`;

      const { data: aff, error: affErr } = await svc.from("affiliates").insert({
        application_id: basis.application_id, fullname: basis.fullname, email: basis.email,
        phone: basis.phone, whatsapp: basis.whatsapp, code, username: code,
        password_hash: hashPassword(password), referral_link: referralLink,
        contract_start: toISODate(contractStart), contract_end: toISODate(contractEnd),
        status: "active", commission_amount: commissionAmount,
        renewed_from_affiliate_id: basis.renewed_from_affiliate_id
      }).select("*").single();
      if (affErr) return { ok: false as const, reason: affErr.message.includes("duplicate") ? "Code déjà utilisé, réessayez." : affErr.message };

      let mailSent = false, mailError = "";
      const key = process.env.RESEND_API_KEY;
      if (key) {
        const { subject, html } = buildAffiliateApprovalEmail({
          fullname: basis.fullname, code, username: code, password, referralLink,
          contractStart: toISODate(contractStart), contractEnd: toISODate(contractEnd), commissionAmount, isRenewal
        });
        const r = await sendAffiliateApprovalEmail(key, basis.email, subject, html, contractPdfUrl);
        mailSent = r.ok;
        if (!r.ok) mailError = r.message;
      } else {
        mailError = "RESEND_API_KEY pa konfigire — imèl la pa voye.";
      }

      return { ok: true as const, aff, username: code, password, referralLink, contractStart: toISODate(contractStart), contractEnd: toISODate(contractEnd), mailSent, mailError };
    }

    // ---------- affiliate_approve (admin sèlman) ----------
    if (action === "affiliate_approve") {
      if (role !== "admin") return NextResponse.json({ ok: false, reason: "Accès refusé." });
      const applicationId = String(body.application_id ?? "");
      const { data: appRow } = await svc.from("affiliate_applications").select("*").eq("id", applicationId).maybeSingle();
      if (!appRow) return NextResponse.json({ ok: false, reason: "Candidature introuvable." });
      if (appRow.status !== "pending") return NextResponse.json({ ok: false, reason: "Cette candidature a déjà été traitée." });

      const r = await createAffiliateAndNotify({
        application_id: appRow.id, fullname: appRow.fullname, email: appRow.email,
        phone: appRow.phone, whatsapp: appRow.whatsapp, renewed_from_affiliate_id: null
      });
      if (!r.ok) return NextResponse.json(r);

      await svc.from("affiliate_applications").update({ status: "approved" }).eq("id", appRow.id);
      return NextResponse.json({ ok: true, affiliate: r.aff, username: r.username, password: r.password, referralLink: r.referralLink, mailSent: r.mailSent, mailError: r.mailError });
    }

    // ---------- affiliate_reject (admin sèlman) ----------
    if (action === "affiliate_reject") {
      if (role !== "admin") return NextResponse.json({ ok: false, reason: "Accès refusé." });
      const applicationId = String(body.application_id ?? "");
      const { error } = await svc.from("affiliate_applications").update({ status: "rejected" }).eq("id", applicationId).eq("status", "pending");
      if (error) return NextResponse.json({ ok: false, reason: error.message });
      return NextResponse.json({ ok: true });
    }

    // ---------- affiliate_revoke (admin sèlman) — bloke lyen an anvan 3 mwa ----------
    if (action === "affiliate_revoke") {
      if (role !== "admin") return NextResponse.json({ ok: false, reason: "Accès refusé." });
      const affiliateId = String(body.affiliate_id ?? "");
      const { error } = await svc.from("affiliates").update({ status: "revoked" }).eq("id", affiliateId);
      if (error) return NextResponse.json({ ok: false, reason: error.message });
      await svc.from("affiliate_sessions").delete().eq("affiliate_id", affiliateId);
      return NextResponse.json({ ok: true });
    }

    // ---------- affiliate_renew (admin sèlman) ----------
    // Renouvèlman = NOUVO liy afilye (nouvo kòd/lyen/login/imèl), JAMÈ yon
    // modifikasyon sou plas — jan STANDA konfime l la. Ansyen liy la pase
    // "expired" epi rete kòm istorik (kliyan ki te enskri anba li kontinye
    // konte pou komisyon sèlman pandan fenèt ANSYEN kontra a, deja ekspire).
    if (action === "affiliate_renew") {
      if (role !== "admin") return NextResponse.json({ ok: false, reason: "Accès refusé." });
      const affiliateId = String(body.affiliate_id ?? "");
      const { data: old } = await svc.from("affiliates").select("*").eq("id", affiliateId).maybeSingle();
      if (!old) return NextResponse.json({ ok: false, reason: "Affilié introuvable." });

      const r = await createAffiliateAndNotify({
        application_id: old.application_id, fullname: old.fullname, email: old.email,
        phone: old.phone, whatsapp: old.whatsapp, renewed_from_affiliate_id: old.id
      });
      if (!r.ok) return NextResponse.json(r);

      // L'ancien lien s'éteint SEULEMENT une fois le nouveau créé avec succès
      // (jamais les deux à la fois inactifs si l'insert échoue plus haut).
      await svc.from("affiliates").update({ status: "expired" }).eq("id", old.id);
      await svc.from("affiliate_sessions").delete().eq("affiliate_id", old.id);

      return NextResponse.json({
        ok: true, affiliate: r.aff, username: r.username, password: r.password, referralLink: r.referralLink,
        contractStart: r.contractStart, contractEnd: r.contractEnd, mailSent: r.mailSent, mailError: r.mailError
      });
    }

    // ---------- affiliate_reset_password (admin sèlman) ----------
    // Menm prensip ak reset_client_password/reset_staff_password: username
    // (kòd/lyen) pa chanje, sèlman modpas la. Ansyen sesyon yo envalide.
    if (action === "affiliate_reset_password") {
      if (role !== "admin") return NextResponse.json({ ok: false, reason: "Accès refusé." });
      const affiliateId = String(body.affiliate_id ?? "");
      const { data: aff } = await svc.from("affiliates").select("id").eq("id", affiliateId).maybeSingle();
      if (!aff) return NextResponse.json({ ok: false, reason: "Affilié introuvable." });
      const password = generateAffiliatePassword();
      const { error } = await svc.from("affiliates").update({ password_hash: hashPassword(password) }).eq("id", affiliateId);
      if (error) return NextResponse.json({ ok: false, reason: error.message });
      await svc.from("affiliate_sessions").delete().eq("affiliate_id", affiliateId);
      return NextResponse.json({ ok: true, password });
    }

    // ---------- affiliate_mark_commission_paid (admin sèlman) ----------
    if (action === "affiliate_mark_commission_paid") {
      if (role !== "admin") return NextResponse.json({ ok: false, reason: "Accès refusé." });
      const commissionId = String(body.commission_id ?? "");
      const method = String(body.payout_method ?? "");
      if (!PAYOUT_METHODS.has(method)) return NextResponse.json({ ok: false, reason: "Mode de paiement invalide." });
      const paidBy = await callerUsername();
      const { error } = await svc.from("affiliate_commissions").update({
        status: "paid", paid_at: new Date().toISOString(), payout_method: method, paid_by: paidBy
      }).eq("id", commissionId).eq("status", "due");
      if (error) return NextResponse.json({ ok: false, reason: error.message });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: false, reason: "Aksyon enkoni." });
  } catch (e) {
    // Pa gen detay entèn (non tab, erè Postgres, stack) ki soti bay kliyan an.
    console.error("[admin-auth]", e);
    return NextResponse.json({ ok: false, reason: "Erreur serveur." }, { status: 500 });
  }
}
