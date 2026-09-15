import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdminConfig } from "@/lib/supabase-server";
import { clientIp, rateLimit, tooMany } from "@/lib/ratelimit";

/**
 * API isolée de l'agent de réception (arrivée des Conduces).
 * ═══════════════════════════════════════════════════════════════════
 * Rezon dèyè paj sa a: lè yon Conduce (manifest Caribe Tours) rive, moun ki
 * resevwa machandiz la wè kòd kliyan ekri sou chak pakè — men li pa kenbe
 * tout kòd kliyan yo nan tèt li, e souvan li pa konnen nan ki zòn (vil) pou
 * l voye yon pakè. Wout sa a bay LEKTI SÈLMAN (non, zòn, konbyen koli k ap
 * soti Miami) pou yon kòd/non li tape — jamè telefòn/imèl/adrès konplè,
 * jamè fakti, jamè aksè sou lòt tab.
 *
 * Menm prensip ak /api/pickup-agent: agent_reception PA nan is_staff(),
 * donk pa gen RLS dirèk pou li — tout aksè pase pa isit la (kle sèvis),
 * apre verifikasyon wòl la sou sesyon Supabase li.
 */
type Agent = { id: string; username: string; prenom: string; nom: string; role: string };

const money = (v: unknown) => String(v ?? "").trim();
function bearerToken(req: Request) {
  const value = req.headers.get("authorization") ?? "";
  return value.startsWith("Bearer ") ? value.slice(7).trim() : "";
}

async function contextFor(req: Request): Promise<
  | { ok: true; db: any; agent: Agent }
  | { ok: false; response: NextResponse }
> {
  const config = getSupabaseAdminConfig();
  if (!config) return { ok: false, response: NextResponse.json({ ok: false, reason: "Service indisponible." }, { status: 503 }) };
  const token = bearerToken(req);
  if (!token) return { ok: false, response: NextResponse.json({ ok: false, reason: "Session requise." }, { status: 401 }) };

  const db: any = createClient(config.url, config.key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: auth } = await db.auth.getUser(token);
  if (!auth.user) return { ok: false, response: NextResponse.json({ ok: false, reason: "Session invalide." }, { status: 401 }) };

  const result = await db.from("staff").select("id, username, prenom, nom, role")
    .eq("auth_user_id", auth.user.id).maybeSingle();
  const agent = result.data as Agent | null;
  if (!agent || agent.role !== "agent_reception") {
    return { ok: false, response: NextResponse.json({ ok: false, reason: "Accès réservé aux agents de réception." }, { status: 403 }) };
  }
  return { ok: true, db, agent };
}

function agentName(agent: Agent) {
  return [agent.prenom, agent.nom].filter(Boolean).join(" ") || agent.username;
}

/** Statuts qui veulent dire "toujours en route depuis Miami, pas encore arrivé en Haïti". */
const EN_ROUTE_DEPUIS_MIAMI = ["Reçu à Miami", "En préparation", "En transit"];

export async function POST(req: Request) {
  const rl = rateLimit("reception:" + clientIp(req), 60, 60000);
  if (!rl.ok) return tooMany(rl.retryAfter);

  const ctx = await contextFor(req);
  if (!ctx.ok) return ctx.response;
  const { db, agent } = ctx;

  const body = await req.json().catch(() => ({}));
  const action = String(body?.action ?? "");

  // ---------- lookup_client : chèche pa kòd OSWA non (rezilta limite) ----------
  if (action === "lookup_client") {
    const q = money(body.query).slice(0, 60);
    if (q.length < 2) return NextResponse.json({ ok: true, clients: [] });

    const { data: clients, error } = await db.from("clients")
      .select("customer_code, fullname, ville_id")
      .or(`customer_code.ilike.%${q}%,fullname.ilike.%${q}%,username.ilike.%${q}%`)
      .not("customer_code", "is", null).neq("customer_code", "")
      .order("fullname").limit(8);
    if (error) return NextResponse.json({ ok: false, reason: "Recherche impossible." }, { status: 500 });
    const rows = (clients ?? []) as { customer_code: string; fullname: string; ville_id: string | null }[];
    if (!rows.length) return NextResponse.json({ ok: true, clients: [] });

    const villeIds = [...new Set(rows.map((r) => r.ville_id).filter(Boolean))] as string[];
    const villes = villeIds.length
      ? (await db.from("villes").select("id, name").in("id", villeIds)).data ?? []
      : [];
    const villeName = new Map((villes as { id: string; name: string }[]).map((v) => [v.id, v.name]));

    const codes = rows.map((r) => r.customer_code);
    const { data: pkgs } = await db.from("packages")
      .select("customer_code, status").in("customer_code", codes).in("status", EN_ROUTE_DEPUIS_MIAMI);
    const miamiCount = new Map<string, number>();
    for (const p of (pkgs ?? []) as { customer_code: string }[]) {
      miamiCount.set(p.customer_code, (miamiCount.get(p.customer_code) ?? 0) + 1);
    }

    return NextResponse.json({
      ok: true,
      clients: rows.map((r) => ({
        customer_code: r.customer_code,
        fullname: r.fullname,
        ville_name: r.ville_id ? (villeName.get(r.ville_id) ?? "—") : "—",
        miami_count: miamiCount.get(r.customer_code) ?? 0
      }))
    });
  }

  // ---------- create_conduce : anrejistre yon nouvo nimewo Conduce ----------
  if (action === "create_conduce") {
    const conduceNumber = money(body.conduce_number).slice(0, 60);
    const office = money(body.office).slice(0, 80);
    if (!conduceNumber) return NextResponse.json({ ok: false, reason: "Numéro de Conduce requis." }, { status: 400 });

    const existing = await db.from("conduces").select("id, conduce_number").eq("conduce_number", conduceNumber).maybeSingle();
    if (existing.data) return NextResponse.json({ ok: true, conduce: existing.data, alreadyExisted: true });

    const now = new Date().toISOString();
    const { data: created, error } = await db.from("conduces").insert({
      conduce_number: conduceNumber, office, imported_by: `${agentName(agent)} (agent_reception)`, imported_at: now
    }).select("id, conduce_number").single();
    if (error) return NextResponse.json({ ok: false, reason: "Création impossible." }, { status: 500 });

    await db.from("journal").insert({
      user_name: `${agentName(agent)} (agent_reception)`, action: "Création Conduce",
      details: `Conduce ${conduceNumber} créée depuis l'app Réception${office ? ` · ${office}` : ""}`,
      package_ref: "", customer_code: ""
    });

    return NextResponse.json({ ok: true, conduce: created, alreadyExisted: false });
  }

  return NextResponse.json({ ok: false, reason: "Action inconnue." });
}
