import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * API Authentication (kouri sou sèvè Vercel — kle sèvis la pa janm rive nan navigatè).
 * Aksyon: bootstrap (premye admin), create_staff, delete_staff,
 *         activate_client (kòd MC -> kont + modpas tanporè), reset_client_password.
 */
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const staffEmail = (u: string) => `${u.trim().toLowerCase()}@staff.standacommercialsa.com`;
const clientEmail = (mc: string) => `${mc.trim().toLowerCase()}@client.standacommercialsa.com`;

/** Modpas tanporè: lèt + chif sèlman, fasil pou tape, san karaktè ki konfonn */
function tempPassword(len = 8): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let out = "";
  const buf = new Uint32Array(len);
  crypto.getRandomValues(buf);
  for (let i = 0; i < len; i++) out += chars[buf[i] % chars.length];
  return out;
}

export async function POST(req: Request) {
  try {
    if (!SERVICE) {
      return NextResponse.json({ ok: false, reason: "SUPABASE_SERVICE_ROLE_KEY pa konfigire nan Vercel (Settings > Environment Variables) + Redeploy." });
    }
    const svc = createClient(URL_, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });
    const body = await req.json();
    const action = String(body.action ?? "");

    // ---------- caller role ----------
    async function callerRole(): Promise<"admin" | "employe" | null> {
      const token = String(body.token ?? "");
      if (!token) return null;
      const { data } = await svc.auth.getUser(token);
      if (!data.user) return null;
      const { data: s } = await svc.from("staff").select("role").eq("auth_user_id", data.user.id).maybeSingle();
      return (s?.role as "admin" | "employe") ?? null;
    }

    // ---------- bootstrap: premye admin (sèlman si staff vid) ----------
    if (action === "bootstrap") {
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
      const newRole = body.role === "admin" ? "admin" : "employe";
      if (!username || password.length < 6) return NextResponse.json({ ok: false, reason: "Username + modpas (6+ karaktè) obligatwa." });
      const { data: u, error } = await svc.auth.admin.createUser({
        email: staffEmail(username), password, email_confirm: true
      });
      if (error) return NextResponse.json({ ok: false, reason: error.message.includes("already") ? "Username sa a egziste deja." : error.message });
      const { error: e2 } = await svc.from("staff").insert({
        auth_user_id: u.user.id, role: newRole, username,
        nom: String(body.nom ?? ""), prenom: String(body.prenom ?? ""),
        email: String(body.email ?? ""), phone: String(body.phone ?? ""),
        id_number: String(body.id_number ?? ""), id_photo_url: String(body.id_photo_url ?? "")
      });
      if (e2) { await svc.auth.admin.deleteUser(u.user.id); return NextResponse.json({ ok: false, reason: e2.message }); }
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

    // ---------- activate_client: kòd MC -> kont + modpas tanporè ----------
    if (action === "activate_client") {
      if (role !== "admin" && role !== "employe") return NextResponse.json({ ok: false, reason: "Accès refusé." });
      const clientId = String(body.client_id ?? "");
      // Nòmalizasyon V7.2: "25487" -> "MC-25487" — kle inik kliyan an
      const rawCode = String(body.mc_code ?? "").trim().replace(/\s+/g, "").toUpperCase();
      const code = rawCode ? (rawCode.startsWith("MC-") ? rawCode : "MC-" + rawCode.replace(/^MC/, "").replace(/^-+/, "")) : "";
      if (!clientId || !code) return NextResponse.json({ ok: false, reason: "Kòd MC obligatwa." });
      const pass = tempPassword();
      const { data: u, error } = await svc.auth.admin.createUser({
        email: clientEmail(code), password: pass, email_confirm: true
      });
      if (error) return NextResponse.json({ ok: false, reason: error.message.includes("already") ? `Kòd "${code}" gen yon kont deja.` : error.message });
      const { error: e2 } = await svc.from("clients").update({
        customer_code: code, username: code, auth_user_id: u.user.id,
        account_status: "Actif", must_change_password: false
      }).eq("id", clientId);
      if (e2) { await svc.auth.admin.deleteUser(u.user.id); return NextResponse.json({ ok: false, reason: e2.message.includes("duplicate") ? `Kòd "${code}" deja sou yon lòt kliyan.` : e2.message }); }
      return NextResponse.json({ ok: true, temp_password: pass, username: code });
    }

    // ---------- reset_client_password ----------
    if (action === "reset_client_password") {
      if (role !== "admin" && role !== "employe") return NextResponse.json({ ok: false, reason: "Accès refusé." });
      const clientId = String(body.client_id ?? "");
      const { data: c } = await svc.from("clients")
        .select("auth_user_id, username, customer_code").eq("id", clientId).maybeSingle();
      if (!c) return NextResponse.json({ ok: false, reason: "Kliyan pa jwenn." });
      const code = String(c.customer_code ?? "").trim();
      if (!code) return NextResponse.json({ ok: false, reason: "Kliyan sa a poko gen kòd MC — sèvi ak 'Créer compte MCPACK' pito." });
      const pass = tempPassword();
      let authId = c.auth_user_id as string | null;
      if (!authId) {
        // Ansyen kliyan (kreye pa sync/admin) — nou kreye kont koneksyon li kounye a
        const { data: nu, error: ce } = await svc.auth.admin.createUser({
          email: clientEmail(code), password: pass, email_confirm: true
        });
        if (ce || !nu?.user) return NextResponse.json({ ok: false, reason: "Kreyasyon kont echwe: " + (ce?.message ?? "") });
        authId = nu.user.id;
        await svc.from("clients").update({
          auth_user_id: authId, username: code, must_change_password: false
        }).eq("id", clientId);
        return NextResponse.json({ ok: true, username: code, temp_password: pass });
      }
      const { error } = await svc.auth.admin.updateUserById(authId, {
        password: pass, email: clientEmail(code), email_confirm: true
      } as any);
      if (error) return NextResponse.json({ ok: false, reason: error.message });
      await svc.from("clients").update({ must_change_password: false, username: code }).eq("id", clientId);
      return NextResponse.json({ ok: true, temp_password: pass, username: code });
    }

    return NextResponse.json({ ok: false, reason: "Aksyon enkoni." });
  } catch (e) {
    return NextResponse.json({ ok: false, reason: e instanceof Error ? e.message : String(e) });
  }
}
