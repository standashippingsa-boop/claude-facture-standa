import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { rateLimit, tooMany, clientIp } from "@/lib/ratelimit";
import { getSupabaseAdminConfig } from "@/lib/supabase-server";
import { randomBytes } from "node:crypto";
import { hashToken, newSessionToken, verifyPassword } from "@/lib/affiliate-crypto";
import { buildAffiliateOverview } from "@/lib/affiliate-overview";
import { notifyAdminsOfAffiliateChange } from "@/lib/affiliate-notify";
import { AFFILIATE_PAYOUT_METHODS, SIGNED_CONTRACT_BUCKET, SIGNED_CONTRACT_MAX_BYTES, resolveSignedContractExt } from "@/lib/affiliate-terms";

const CONTRACT_BUCKET = SIGNED_CONTRACT_BUCKET;

/**
 * PÒTAY AFILYE — login/me/logout.
 * ═══════════════════════════════════════════════════════════════════════
 * Afilye yo PA Supabase Auth: sesyon an se yon cookie httpOnly ki gen yon
 * jeton o aza, kont anrejistre (hash) nan `affiliate_sessions`. Wout sa a
 * SÈL kote ki li/ekri tab afilye yo pou aksyon pòtay la — service role,
 * jamè dirèkteman nan navigatè a (RLS pa ka idantifye yon afilye).
 */
const COOKIE = "aff_session";
const SESSION_DAYS = 30;

function cookieValue(req: Request): string {
  const raw = req.headers.get("cookie") ?? "";
  const m = raw.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : "";
}

async function affiliateFromSession(svc: any, token: string) {
  if (!token) return null;
  const { data: session } = await svc.from("affiliate_sessions").select("affiliate_id, expires_at")
    .eq("token_hash", hashToken(token)).maybeSingle();
  if (!session) return null;
  if (new Date(session.expires_at as string).getTime() < Date.now()) return null;
  const { data: aff } = await svc.from("affiliates").select("*").eq("id", session.affiliate_id as string).maybeSingle();
  return aff ?? null;
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const action = String(body.action ?? "");

  // "me" kouri sou CHAK chajman espas afilye a — li pa dwe manje menm
  // bidjè ak tantativ koneksyon yo (sitou dèyè IP Digicel/Natcom pataje).
  const rl = action === "login"
    ? rateLimit("affiliate-login-ip:" + clientIp(req), 40, 600000)
    : rateLimit("affiliate-portal:" + clientIp(req), 300, 600000);
  if (!rl.ok) return tooMany(rl.retryAfter);

  const config = getSupabaseAdminConfig();
  if (!config) return NextResponse.json({ ok: false, reason: "Configuration serveur incomplète." }, { status: 500 });
  const svc: any = createClient(config.url, config.key, { auth: { persistSession: false } });

  if (action === "login") {
    // Idantifyan = kòd afilye a (toujou MAJISKIL, ex: FADONA5391). Klavye
    // telefòn yo ekri "Fadona5391" — se pa yon move modpas, se menm kont lan.
    const username = String(body.username ?? "").trim().toUpperCase();
    const password = String(body.password ?? "").trim();
    if (!username || !password) return NextResponse.json({ ok: false, reason: "Identifiant et mot de passe requis." });

    // Pwoteksyon brute-force REYÈL la: pa kont (kòd la piblik — li nan lyen referans lan).
    const rlUser = rateLimit("affiliate-login-user:" + username, 10, 900000);
    if (!rlUser.ok) return tooMany(rlUser.retryAfter);

    const { data: aff } = await svc.from("affiliates").select("*").eq("username", username).maybeSingle();
    // Modpas jenere yo gen SÈLMAN majiskil + chif: yon modpas tape an miniskil
    // se menm modpas la. Nou eseye egzak la an premye (yon modpas admin chwazi
    // ak miniskil rete valab tèl quel).
    const passwordOk = !!aff && (verifyPassword(password, aff.password_hash as string)
      || (password !== password.toUpperCase() && verifyPassword(password.toUpperCase(), aff.password_hash as string)));
    if (!passwordOk) {
      return NextResponse.json({ ok: false, reason: "Identifiant ou mot de passe incorrect. L’identifiant est votre code affilié (ex. : ABCDEF1234)." });
    }
    if (aff.status !== "active") {
      // Mesaj egzak selon ka a, pou afilye a konnen kisa pou l fè (pa jis "pa aktif").
      if (aff.status === "expired") {
        const { data: successor } = await svc.from("affiliates").select("id")
          .eq("renewed_from_affiliate_id", aff.id).eq("status", "active").limit(1).maybeSingle();
        if (successor) {
          return NextResponse.json({ ok: false, reason: "Ce code a été remplacé lors du renouvellement de votre contrat. Connectez-vous avec votre NOUVEAU code affilié et son mot de passe, reçus par e-mail." });
        }
        return NextResponse.json({ ok: false, reason: "Votre contrat d'affiliation est terminé. Contactez Standa Commercial (+509 4673 8117) pour le renouveler." });
      }
      return NextResponse.json({ ok: false, reason: "Votre compte affilié est suspendu. Contactez Standa Commercial (+509 4673 8117) pour le réactiver." });
    }

    const token = newSessionToken();
    const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400000);
    await svc.from("affiliate_sessions").delete().lt("expires_at", new Date().toISOString());
    await svc.from("affiliate_sessions").insert({
      affiliate_id: aff.id, token_hash: hashToken(token), expires_at: expiresAt.toISOString()
    });

    const res = NextResponse.json({ ok: true });
    res.cookies.set(COOKIE, token, {
      httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax",
      path: "/", maxAge: SESSION_DAYS * 86400
    });
    return res;
  }

  if (action === "me") {
    const aff = await affiliateFromSession(svc, cookieValue(req));
    if (!aff) return NextResponse.json({ ok: false, reason: "Session expirée. Reconnectez-vous." }, { status: 401 });

    const overview = await buildAffiliateOverview(svc, aff);
    if (!overview.ok) return NextResponse.json({ ok: false, reason: overview.reason }, { status: 500 });
    return NextResponse.json({ ok: true, ...overview.data });
  }

  // ── Mòd peman: SÈLMAN goud, MonCash oswa NatCash (kontra atik 6) ──
  if (action === "set_payout") {
    const aff = await affiliateFromSession(svc, cookieValue(req));
    if (!aff) return NextResponse.json({ ok: false, reason: "Session expirée. Reconnectez-vous." }, { status: 401 });
    const method = String(body.method ?? "");
    const phone = String(body.phone ?? "").replace(/[^\d+\s-]/g, "").trim().slice(0, 30);
    if (!(AFFILIATE_PAYOUT_METHODS as readonly string[]).includes(method)) {
      return NextResponse.json({ ok: false, reason: "Choisissez MonCash ou NatCash." }, { status: 400 });
    }
    if (phone.replace(/\D/g, "").length < 8) {
      return NextResponse.json({ ok: false, reason: `Indiquez le numéro ${method} qui recevra vos paiements.` }, { status: 400 });
    }
    const oldMethod = String(aff.payout_method ?? "");
    const oldPhone = String(aff.payout_phone ?? "");
    if (oldMethod === method && oldPhone === phone) {
      return NextResponse.json({ ok: true, payout_method: method, payout_phone: phone, payout_updated_at: aff.payout_updated_at ?? null });
    }
    const payoutUpdatedAt = new Date().toISOString();
    const { error } = await svc.from("affiliates")
      .update({ payout_method: method, payout_phone: phone, payout_updated_at: payoutUpdatedAt }).eq("id", aff.id);
    if (error) return NextResponse.json({ ok: false, reason: "Enregistrement impossible. Réessayez." }, { status: 500 });
    // Chanje kote kòb la ale se aksyon ki pi sansib la: admin yo avèti chak fwa.
    await notifyAdminsOfAffiliateChange(svc, aff, oldMethod
      ? { title: "Affilié : numéro de paiement modifié", message: `${oldMethod} ${oldPhone} → ${method} ${phone}` }
      : { title: "Affilié : mode de paiement choisi", message: `${method} ${phone}` });
    return NextResponse.json({ ok: true, payout_method: method, payout_phone: phone, payout_updated_at: payoutUpdatedAt });
  }

  // ── Kontra siyen: navigatè a voye fichye a DIREK nan Storage ak yon URL
  //    siyen (pa pase nan fonksyon Vercel la — limit 4,5 Mo li ta bloke yon
  //    eskane telefòn). Chemen an toujou anba dosye afilye a li menm. ──
  if (action === "contract_upload_url") {
    const aff = await affiliateFromSession(svc, cookieValue(req));
    if (!aff) return NextResponse.json({ ok: false, reason: "Session expirée. Reconnectez-vous." }, { status: 401 });
    const ext = resolveSignedContractExt(String(body.content_type ?? ""), String(body.filename ?? ""));
    const size = Number(body.size ?? 0);
    if (!ext) return NextResponse.json({ ok: false, reason: "Format non accepté. Envoyez un PDF (ou une photo JPG/PNG)." }, { status: 400 });
    if (!(size > 0) || size > SIGNED_CONTRACT_MAX_BYTES) {
      return NextResponse.json({ ok: false, reason: "Fichier trop volumineux (15 Mo maximum)." }, { status: 400 });
    }
    const path = `${aff.id}/${Date.now()}-${randomBytes(8).toString("hex")}.${ext}`;
    const { data, error } = await svc.storage.from(CONTRACT_BUCKET).createSignedUploadUrl(path);
    if (error || !data?.signedUrl) {
      console.error("[affiliate-portal] upload url", error);
      return NextResponse.json({ ok: false, reason: "Envoi impossible pour le moment. Réessayez." }, { status: 500 });
    }
    return NextResponse.json({ ok: true, signedUrl: data.signedUrl, path });
  }

  if (action === "contract_confirm") {
    const aff = await affiliateFromSession(svc, cookieValue(req));
    if (!aff) return NextResponse.json({ ok: false, reason: "Session expirée. Reconnectez-vous." }, { status: 401 });
    const path = String(body.path ?? "");
    const prefix = `${aff.id}/`;
    const fileName = path.slice(prefix.length);
    // Yon afilye pa ka janm anrejistre fichye yon lòt afilye kòm kontra pa l.
    if (!path.startsWith(prefix) || !/^\d+-[0-9a-f]{16}\.(pdf|jpg|png)$/.test(fileName)) {
      return NextResponse.json({ ok: false, reason: "Fichier invalide." }, { status: 400 });
    }
    const { data: found } = await svc.storage.from(CONTRACT_BUCKET).list(aff.id as string, { search: fileName });
    if (!(found ?? []).some((f: { name: string }) => f.name === fileName)) {
      return NextResponse.json({ ok: false, reason: "Le fichier n'a pas été reçu. Réessayez l'envoi." }, { status: 400 });
    }
    const previous = String(aff.signed_contract_path ?? "");
    const uploadedAt = new Date().toISOString();
    const { error } = await svc.from("affiliates")
      .update({ signed_contract_path: path, signed_contract_uploaded_at: uploadedAt }).eq("id", aff.id);
    if (error) return NextResponse.json({ ok: false, reason: "Enregistrement impossible. Réessayez." }, { status: 500 });
    if (previous && previous !== path) await svc.storage.from(CONTRACT_BUCKET).remove([previous]);
    await notifyAdminsOfAffiliateChange(svc, aff, previous
      ? { title: "Affilié : contrat signé remplacé", message: "Un nouveau contrat signé a été envoyé — à vérifier." }
      : { title: "Affilié : contrat signé reçu", message: "Contrat signé envoyé — à vérifier." });
    return NextResponse.json({ ok: true, signed_contract_uploaded_at: uploadedAt });
  }

  if (action === "contract_view") {
    const aff = await affiliateFromSession(svc, cookieValue(req));
    if (!aff) return NextResponse.json({ ok: false, reason: "Session expirée. Reconnectez-vous." }, { status: 401 });
    if (!aff.signed_contract_path) return NextResponse.json({ ok: false, reason: "Aucun contrat envoyé." }, { status: 404 });
    const { data, error } = await svc.storage.from(CONTRACT_BUCKET).createSignedUrl(aff.signed_contract_path as string, 300);
    if (error || !data?.signedUrl) return NextResponse.json({ ok: false, reason: "Contrat indisponible." }, { status: 500 });
    return NextResponse.json({ ok: true, url: data.signedUrl });
  }

  if (action === "logout") {
    const token = cookieValue(req);
    if (token) await svc.from("affiliate_sessions").delete().eq("token_hash", hashToken(token));
    const res = NextResponse.json({ ok: true });
    res.cookies.set(COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
    return res;
  }

  return NextResponse.json({ ok: false, reason: "Action inconnue." });
}
