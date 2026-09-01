# STANDA COMMERCIAL v3 — Logiciel de gestion de colis & facturation

Aplikasyon entèn (san login) — Next.js 15 · TypeScript · Tailwind · Supabase (DB + Storage) ·
React Hook Form · Zod · SheetJS (Excel MCPACK) · jsPDF (factures).

## Installation (yon sèl fwa)

### 1. Bazdone Supabase (3 minit)
1. https://supabase.com → pwojè ou a (oswa kreye youn gratis).
2. **SQL Editor** → New query → kouri fichye sa yo **NAN LÒD SA A** :
   1. `supabase/migration.sql`          — tab yo + bucket Storage
   2. `supabase/security-hardening.sql` — **OBLIGATWA** : RLS staff / kliyan / piblik
   3. `supabase/20260831_public_reviews.sql` — kòmantè piblik yo
   > ⚠️ San etap 2, RLS ap bloke tout lekti (se espre — « fail-closed »).
   > PA JANM refè yon politik « anon all » : sa louvri tout done yo bay tout entènèt la.
3. **Project Settings → API** → kopye `Project URL`, `anon public key`, `service_role`.
4. **Authentication → Sign In / Up → Email** → dezaktive « Confirm email ».

### 2. Aplikasyon an
```bash
cp .env.local.example .env.local   # mete URL + anon key + service_role + SETUP_SECRET
npm install
npm run dev                        # http://localhost:3000
npm run verify                     # typecheck + isolation + build (anvan chak livrezon)
```

> `SUPABASE_SERVICE_ROLE_KEY` ak `SETUP_SECRET` = **sèvè sèlman**. Yo pa janm ale nan
> navigatè a. `npm run check:isolation` verifye pa gen fwit nan paj piblik yo.

## Workflow chak jou

1. **Synchronisation MCPACK** — sou MCPACK klike *Exportar XLS* → isit la chwazi fichye a.
   - Sistèm nan rekonèt kolòn yo (Cliente, Guia, Peso, Cant, Contenido, Estatus, Creado, FOB...).
   - **Doublon:** nenpòt Guia/Tracking ki deja nan bazdone a pa janm ajoute 2 fwa —
     ou ka enpòte Excel chak jou san pwoblèm.
   - Rezime: lignes analysées / nouveaux colis / existants / nouveaux clients / erreurs →
     **Valider Importation**.
   - Kliyan ki pa egziste yo kreye otomatikman (kòd + non) — konplete WhatsApp/pickup nan Clients.
   - Si tarification aktive: pri + tax kalkile otomatikman sou nouvo koli yo.

2. **Packages** — tablo estil MCPACK: filtre pa code/nom/tracking/date/status, rechèch enstantane,
   pagination, Price/Tax modifyab dirèk nan tablo a (Total kalkile otomatikman),
   bouton **Appliquer tarification**. Make checkbox koli yo → **Générer Facture**:
   - PDF pwofesyonèl (logo, No facture, client, tablo, sous-total/tax/grand total)
   - PDF a monte nan Supabase Storage (pdf_url) epi telechaje lokalman
   - Koli yo pase **Disponible → Facturé** (yo pa janm efase)
   - WhatsApp ouvri otomatikman ak mesaj la + lyen PDF la → peze Send sèlman.

3. **Invoices** — tout facture: Voir / Télécharger / Ré-imprimer / Envoyer sur WhatsApp, nenpòt kilè.

4. **Historique** — tout koli Facturé/Livré ak No facture yo; bouton **Marquer Livré**.

5. **Settings** — règ **Tarification** (prix/lb, frais fixe, tax % pa tranche pwa),
   pied de page facture, tarification otomatik on/off.

## Nòt WhatsApp
WhatsApp pa pèmèt yon sit web atache yon fichye pou kont li. Solisyon an: PDF a estoke sou
Supabase Storage epi **lyen piblik la mete dirèk nan mesaj WhatsApp la** — kliyan an klike lyen an
epi li wè fakti a. Ou sèlman peze Send. (PDF a telechaje lokalman tou si w prefere atache l manyèlman.)

## Estrikti
```
app/            paj yo (dashboard, clients, packages, invoices, historique, sync, settings)
components/     Sidebar, StatusBadge, Pagination
lib/db.ts       tout operasyon Supabase
lib/xlsx.ts     lekti Excel MCPACK + deteksyon kolòn otomatik
lib/pricing.ts  motè tarification
lib/pdf.ts      jenerasyon PDF + upload Storage
lib/whatsapp.ts lyen wa.me + mesaj
supabase/migration.sql   schema konplè
```

## Nouveautés v5

### Logo
Mete logo ofisyèl la nan **`public/logo.png`** (PNG, fon transparan si posib, minimòm 256×256).
Li parèt otomatikman nan Sidebar, Dashboard ak sou PDF fakti yo an bòn rezolisyon.
Si fichye a pa la, monogram "SC" a sèvi kòm ranplasman — anyen pa kraze.

### Comptes Personnel / Business
Chak kliyan gen yon **Type de compte** obligatwa (Personnel oswa Business).
Chak vil gen 4 tarif an **USD**: Prix Personnel/lb, Prix Business/lb, Tax Personnel/lb, Tax Business/lb
(+ Frais fixe opsyonèl).

### Règle spéciale petits colis
Nenpòt koli **0.01 – 0.99 lb = 3.70 USD fiks** (Personnel kou Business, kèlkeswa vil la).
Apati **1.00 lb**, tarif vil la aplike otomatikman. Pri fiks la modifiab nan Paramètres > Général.
Tax pou ti koli yo = 0 pa defo; administratè a antre l manyèlman si sa nesesè.

### Taux de change
Paramètres > **Taux de change**: 1 USD = X HTG, modifiab nenpòt lè.
Tout nouvo fakti itilize nouvo taux la. **Taux ki te itilize a rete anrejistre sou chak fakti**
(`exchange_rate_used`) — ansyen fakti yo pa janm chanje.

### Facture PDF
Anba tablo a: **Nombre de colis** + **Poids total (LB)**, answit Sous-total, Tax,
**Grand Total USD**, Taux USD→HTG, ak **GRAND TOTAL HTG** (kliyan an wè toude sou menm fakti a).

### Simulation Facture
Anvan jenerasyon an, yon fenèt preview montre: kantite koli, pwa total, Sous-total/Tax/Total USD,
taux itilize a ak Total HTG. Ou verifye anvan w peze **Confirmer & Générer PDF**.

### Migration
`supabase/migration.sql` la san pèdi done: li rename/ajoute kolòn ki nesesè yo sou baz v4 ou a
(pri v4 ki te an HTG yo konvèti an USD otomatikman ak taux aktyèl la), epi li mache tou sou yon baz vid.


## Déploiement — GitHub + Vercel

### Etap 1 — Mete pwojè a sou GitHub (yon sèl fwa)

```bash
cd standa-commercial        # dosye pwojè a (kote package.json la ye)
git init
git add .
git commit -m "STANDA COMMERCIAL v5.1"
```

Kreye repo a sou https://github.com/new (non: `standa-commercial`, **Private**
paske se sistèm entèn ou), answit:

```bash
git remote add origin https://github.com/TON-USERNAME/standa-commercial.git
git branch -M main
git push -u origin main
```

> `.gitignore` la deja anpeche `.env.local` (kle Supabase ou yo) monte sou GitHub.

### Etap 2 — Deplwaye sou Vercel

1. Ale sou https://vercel.com > **Add New > Project** > **Import** repo `standa-commercial` la.
2. Vercel detekte Next.js otomatikman — pa chanje anyen nan build settings.
3. Nan **Environment Variables**, ajoute (kopye valè yo nan Supabase > Project Settings > API):

   | Name | Value | Ekspoze? |
   |---|---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://XXXX.supabase.co` | navigatè |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...` | navigatè |
   | `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` (service_role) | **sèvè sèlman** |
   | `SETUP_SECRET` | valè long o aza (kreye premye admin) | **sèvè sèlman** |
   | `RESEND_API_KEY` | `re_...` (opsyonèl — imèl) | **sèvè sèlman** |

4. Klike **Deploy**. Answit ale sou `https://TON-URL/setup` yon sèl fwa pou kreye
   premye kont admin lan (l ap mande `SETUP_SECRET` lan).

### Mizajou pita

Chak fwa ou pouse yon chanjman (`git push`), Vercel redeplwaye otomatikman.

### Nòt sekirite

Wè **`SECURITY.md`** pou detay yo. Rezime :

- Otantifikasyon Supabase Auth (Admin / Employé / Client). Aksè kontwole pa **RLS**
  (`security-hardening.sql`) — se pa URL la ki sekrè, se politik yo.
- **Kle `service_role` ak `SETUP_SECRET`** = sèvè sèlman (wout `app/api/*`). Yo pa janm
  nan navigatè a ni nan yon paj piblik (`npm run check:isolation` fè respekte sa).
- **Pa janm** kreye politik RLS « anon all » — sa ta louvri tout done kliyan yo
  (non, adrès, pyès idantite, montan) bay nenpòt moun sou entènèt.
- Si yon kle Supabase te janm pataje / komèt / voye pa imèl : **rejenere l touswit**
  nan Supabase → Project Settings → API.


## Enskripsyon kliyan + aktivasyon MCPACK (v6)

Workflow la:
1. Kliyan an enskri sou **/inscription** (non, siyati, imèl, telefòn, WhatsApp, peyi,
   1-2 vil, adrès, idantifikasyon, modpas). Kont li rete **En attente d'activation**.
2. Admin: nan **Clients**, kliyan annatant yo gen bouton **Créer compte MCPACK** —
   li ouvri yon fenèt ak tout enfòmasyon yo (fasil pou kopye sou MCPACK) + yon chan
   **Code MC** (ex: MC-2547).
3. Lè w sove kòd la: kont lan vin **Actif** otomatikman, epi bouton **📲 Voye adrès depo**
   a parèt — li ouvri WhatsApp ak mesaj adrès depo Miami an (non + kòd MC ranplase otomatikman).
4. Kliyan an konekte sou **/login** → **/espace-client**: adrès depo li, koli li yo, fakti li yo (PDF).

Adrès depo a nan `lib/depot.ts` — chanje l la si li ta chanje.

### Konfigirasyon Supabase Auth (yon sèl fwa)
Nan Supabase Dashboard → **Authentication → Sign In / Up → Email**:
desaktive **"Confirm email"** (sinon kliyan yo ap oblije klike yon lyen imèl anvan yo ka konekte,
epi imèl sa yo pa toujou rive an Ayiti). Apre sa enskripsyon an mache imedyatman.
