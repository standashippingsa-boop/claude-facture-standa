"use client";
import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import { Staff, StaffRole } from "./types";

/** Username -> imèl sentetik (Supabase Auth mande imèl; kliyan pa janm wè sa) */
export const staffEmail = (u: string) => `${u.trim().toLowerCase()}@staff.standacommercialsa.com`;
export const clientEmail = (mc: string) => `${mc.trim().toLowerCase()}@client.standacommercialsa.com`;

export async function getMyStaff(): Promise<Staff | null> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const { data: s } = await supabase.from("staff").select("*")
    .eq("auth_user_id", data.user.id).maybeSingle();
  return (s as Staff) ?? null;
}

/** Hook wòl (pou kache bouton efase yo pou Employé, elatriye) */
export function useRole(): { role: StaffRole | null; loading: boolean; staff: Staff | null } {
  const [role, setRole] = useState<StaffRole | null>(null);
  const [staff, setStaff] = useState<Staff | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    getMyStaff().then((s) => { setStaff(s); setRole(s?.role ?? null); setLoading(false); });
  }, []);
  return { role, loading, staff };
}

/** Rele API admin-auth la ak token sesyon an */
export async function adminApi(action: string, payload: Record<string, unknown> = {}) {
  const { data } = await supabase.auth.getSession();
  const res = await fetch("/api/admin-auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, token: data.session?.access_token ?? "", ...payload })
  });
  return res.json();
}
