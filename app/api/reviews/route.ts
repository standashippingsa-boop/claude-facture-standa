import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { clientIp, rateLimit, tooMany } from "@/lib/ratelimit";
import { getSupabaseAdminConfig, getSupabasePublishableKey, getSupabaseUrl } from "@/lib/supabase-server";

const PUBLIC_COLUMNS = "id, author_name, rating, message, created_at";

function publicConfig() {
  const url = getSupabaseUrl();
  const key = getSupabasePublishableKey();
  return url && key ? { url, key } : null;
}

function serviceConfig() {
  return getSupabaseAdminConfig();
}

function json(body: object, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: { "Cache-Control": "no-store, max-age=0, must-revalidate", ...init?.headers }
  });
}

export async function GET() {
  const details = publicConfig();
  if (!details) return json({ error: "Le service de commentaires n'est pas configuré." }, { status: 503 });

  const supabase = createClient(details.url, details.key, { auth: { persistSession: false, autoRefreshToken: false } });
  // La politique RLS n'autorise que les avis dont is_visible = true.
  const { data, error } = await supabase
    .from("site_reviews")
    .select(PUBLIC_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(24);
  if (error) return json({ error: "Les commentaires sont temporairement indisponibles." }, { status: 503 });
  return json({ reviews: data ?? [] });
}

export async function POST(request: NextRequest) {
  // L'accès libre ne signifie pas accès illimité : 3 avis par 10 minutes/IP.
  const rate = rateLimit(`review:${clientIp(request)}`, 3, 10 * 60 * 1000);
  if (!rate.ok) return tooMany(rate.retryAfter);

  const details = serviceConfig();
  if (!details) return json({ error: "Le service de commentaires est temporairement indisponible." }, { status: 503 });

  let payload: { name?: unknown; rating?: unknown; message?: unknown; website?: unknown };
  try { payload = await request.json() as typeof payload; } catch { return json({ error: "Le commentaire est invalide." }, { status: 400 }); }

  // Champ invisible rempli principalement par des robots de formulaires.
  if (String(payload.website ?? "").trim()) return json({ error: "La publication n'a pas pu être envoyée." }, { status: 400 });

  const authorName = String(payload.name ?? "").replace(/\s+/g, " ").trim();
  const message = String(payload.message ?? "").replace(/\r\n/g, "\n").trim();
  const rating = Number(payload.rating);
  if (authorName.length < 2 || authorName.length > 80) return json({ error: "Le nom doit contenir entre 2 et 80 caractères." }, { status: 400 });
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return json({ error: "Choisissez une note entre 1 et 5 étoiles." }, { status: 400 });
  if (message.length < 8 || message.length > 600) return json({ error: "Le commentaire doit contenir entre 8 et 600 caractères." }, { status: 400 });

  // La clé de service reste côté serveur : les visiteurs ne reçoivent aucun droit d'écriture SQL.
  const supabase = createClient(details.url, details.key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await supabase
    .from("site_reviews")
    .insert({ author_name: authorName, rating, message })
    .select(PUBLIC_COLUMNS)
    .single();
  if (error) return json({ error: "Impossible de publier votre commentaire pour le moment." }, { status: 503 });
  return json({ review: data }, { status: 201 });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
