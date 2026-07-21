import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * ENDPOINT EKSTANSYON CHROME (V8 Faz 1 — preparasyon)
 * ────────────────────────────────────────────────────
 * Ekstansyon Chrome MCPACK la (pita) ap voye koli yo isit la. Pou kounye a,
 * estrikti a pare men okenn ekstansyon pa deplwaye ankò.
 *
 * Sekirite: chak demann dwe pote yon token valab nan header
 *   Authorization: Bearer <token>
 * Token yo jere nan tab `api_tokens` (admin kreye yo).
 *
 * Anti-doublon: Tracking Number se kle a — koli ki egziste PA re-kreye,
 * se statut/dat/pwa/kontni ki mete ajou sèlman.
 *
 * Chak batch anrejistre nan Journal (received_method = "Extension Chrome").
 */

interface IncomingPkg {
  tracking_number: string;
  guia?: string;
  tracking_id?: string;
  customer_code?: string;
  customer_name?: string;
  weight?: number;
  content?: string;
  created_date?: string;
  status_raw?: string;
}

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

function normalizeMc(raw?: string | null): string {
  const s = String(raw ?? "").trim().replace(/\s+/g, "").toUpperCase();
  if (!s) return "";
  return s.startsWith("MC-") ? s : "MC-" + s.replace(/^MC/, "").replace(/^-+/, "");
}

export async function POST(req: Request) {
  try {
    // 1) Verifikasyon token
    const auth = req.headers.get("authorization") ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
    if (!token) return NextResponse.json({ ok: false, reason: "Token manquant." }, { status: 401 });

    const db = svc();
    const { data: tok } = await db.from("api_tokens")
      .select("id, active").eq("token", token).maybeSingle();
    if (!tok || !tok.active) return NextResponse.json({ ok: false, reason: "Token invalide." }, { status: 403 });
    await db.from("api_tokens").update({ last_used_at: new Date().toISOString() }).eq("id", tok.id);

    // 2) Done yo
    const body = await req.json().catch(() => null);
    const items: IncomingPkg[] = Array.isArray(body?.packages) ? body.packages : [];
    if (!items.length) return NextResponse.json({ ok: false, reason: "Aucun package reçu." }, { status: 400 });

    // 3) Anti-doublon pa Tracking Number
    const trackings = items.map((p) => String(p.tracking_number ?? "").trim()).filter(Boolean);
    const { data: exist } = await db.from("packages")
      .select("tracking_number").in("tracking_number", trackings);
    const existSet = new Set((exist ?? []).map((e: { tracking_number: string }) => e.tracking_number));

    const now = new Date().toISOString();
    let created = 0, updated = 0, ignored = 0;
    const seen = new Set<string>();

    for (const p of items) {
      const tn = String(p.tracking_number ?? "").trim();
      if (!tn || seen.has(tn)) { ignored++; continue; }
      seen.add(tn);
      const code = normalizeMc(p.customer_code);

      if (existSet.has(tn)) {
        // Mete ajou enfo ki chanje sèlman (pa touche statut entèn, pri, tracking manyèl)
        const patch: Record<string, unknown> = { received_at: now, received_method: "Extension Chrome" };
        if (p.status_raw?.trim()) patch.status_mcpack = p.status_raw.trim();
        if (p.weight != null) patch.weight = p.weight;
        if (p.content) patch.content = p.content;
        await db.from("packages").update(patch).eq("tracking_number", tn);
        updated++;
      } else {
        await db.from("packages").insert({
          tracking_number: tn,
          customer_code: code,
          customer_name: p.customer_name ?? code,
          weight: p.weight ?? 0,
          content: p.content ?? "",
          created_date: p.created_date ?? "",
          status: "Reçu à Miami",
          status_mcpack: p.status_raw?.trim() ?? "",
          tracking_manual: "",
          received_at: now,
          received_method: "Extension Chrome",
          mcpack_data: { Guia: p.guia ?? "", TrackingID: p.tracking_id ?? "" }
        });
        created++;
      }
    }

    // 4) Journal
    await db.from("journal").insert({
      user_name: "Extension Chrome", action: "Extension Chrome",
      details: `${created} créés, ${updated} mis à jour, ${ignored} ignorés`,
      package_ref: "", customer_code: ""
    });

    return NextResponse.json({ ok: true, created, updated, ignored, total: items.length });
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, reason: (e as Error)?.message ?? "Erreur serveur." }, { status: 500 });
  }
}
