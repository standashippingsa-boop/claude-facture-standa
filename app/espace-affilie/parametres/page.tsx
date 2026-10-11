"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Settings, UserRound } from "lucide-react";
import Logo from "@/components/Logo";
import type { AffiliatePayoutMethod } from "@/lib/affiliate-terms";
import { ContractSection, PayoutSection, dateFr, portal } from "@/components/affiliate/AffiliateAccountCards";

import Loader from "@/components/Loader";
/**
 * PÒTAY AFILYE — Paramètres. Kontra siyen + mòd peman rete ISIT pou afilye a
 * ka modifye yo nenpòt ki lè (tablo bò a montre yo sèlman pandan yo poko fèt).
 * Chak chanjman avèti admin yo kote sèvè a (lib/affiliate-notify.ts).
 */
interface Account {
  fullname: string; code: string; contract_start: string; contract_end: string; status: string;
  payout_method: AffiliatePayoutMethod | null; payout_phone: string; payout_updated_at: string | null;
  signed_contract_uploaded_at: string | null;
}

export default function AffiliateSettingsPage() {
  const router = useRouter();
  const [account, setAccount] = useState<Account | null>(null);

  useEffect(() => {
    let active = true;
    portal({ action: "me" }).then((j) => {
      if (!active) return;
      if (!j.ok) { router.replace("/espace-affilie/login"); return; }
      setAccount(j.affiliate as Account);
    });
    return () => { active = false; };
  }, [router]);

  return (
    <div className="min-h-screen bg-[#F4F6F9]">
      <div className="mx-auto max-w-3xl px-5 py-8 sm:px-8">
        <Link href="/espace-affilie" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-mute hover:text-navy">
          <ArrowLeft size={14} /> Retour à mon espace
        </Link>
        <div className="mt-3 flex items-center gap-3">
          <Logo size={40} rounded="rounded-xl" />
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[.18em] text-accent">Espace Affilié</p>
            <h1 className="flex items-center gap-2 text-[20px] font-black text-navy"><Settings size={19} /> Paramètres</h1>
          </div>
        </div>

        {!account ? (
          <div className="mt-8"><Loader inline size={56} /></div>
        ) : (
          <div className="mt-6 space-y-4">
            <section className="rounded-2xl border border-line bg-white p-4 sm:p-5">
              <div className="flex items-center gap-2.5">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-blue-50 text-blue-700"><UserRound size={17} /></span>
                <h2 className="text-[16px] font-bold text-navy">Mon compte</h2>
              </div>
              <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[13px]">
                <dt className="text-mute">Nom</dt><dd className="font-semibold text-navy">{account.fullname}</dd>
                <dt className="text-mute">Code affilié</dt><dd className="font-mono font-semibold text-navy">{account.code}</dd>
                <dt className="text-mute">Contrat</dt><dd className="font-semibold text-navy">{dateFr(account.contract_start)} → {dateFr(account.contract_end)}</dd>
              </dl>
              <p className="mt-3 text-[12px] text-mute">Pour changer votre nom, votre courriel ou votre mot de passe, contactez Standa Commercial (+509 4673 8117).</p>
            </section>

            <PayoutSection
              method={account.payout_method}
              phone={account.payout_phone}
              updatedAt={account.payout_updated_at}
              onSaved={(payout_method, payout_phone, payout_updated_at) => setAccount((cur) => cur ? { ...cur, payout_method, payout_phone, payout_updated_at } : cur)}
            />
            <ContractSection
              uploadedAt={account.signed_contract_uploaded_at}
              onUploaded={(at) => setAccount((cur) => cur ? { ...cur, signed_contract_uploaded_at: at } : cur)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
