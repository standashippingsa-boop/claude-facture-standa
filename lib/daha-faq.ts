/**
 * STANDA COMMERCIAL — Baz konesans Daha (asistan /espace-client)
 * ═══════════════════════════════════════════════════════════════
 * AUKENN API AI PEYAN : repons yo soti nan yon bank kesyon/repons ekri
 * davans (FR/HT/EN), chwazi selon mo-kle nan mesaj kliyan an. Zewo kòb
 * pa mesaj, epi zewo risk "jailbreak" — Daha pa ka janm di yon bagay ki
 * pa deja ekri isit la (li pa jenere tèks, li chwazi nan yon lis fèmen).
 *
 * Kontni an reflete EGZAKTEMAN règ ki deja pibliye nan "Guide & Aide"
 * (app/espace-client/page.tsx, vi "infos") — si yon règ chanje la,
 * mete repons ki koresponn isit la ajou tou.
 */

export type Lang = "fr" | "ht" | "en";
export type Localized = { fr: string; ht: string; en: string };

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Mo ki fò disenk pou chak lang (yo eseye pa chevouche youn lòt).
const EN_MARKERS = ["the", "my", "is", "how", "when", "where", "what", "please", "thanks", "hello", "does", "can", "you", "package", "shipping", "cost"];
const HT_MARKERS = ["mwen", "kisa", "konbyen", "kile", "koli", "eske", "souple", "kijan", "dwe", "pako", "genyen", "bonjou", "mesi"];
const FR_MARKERS = ["pourquoi", "combien", "quand", "comment", "mon", "colis", "je", "merci", "bonjour", "vous", "votre"];

/** Èstimasyon lang mesaj la (pa pafè — se yon rapwòchman senp, pa yon AI). */
export function detectLang(message: string): Lang {
  const norm = ` ${normalize(message)} `;
  const score = (markers: string[]) => markers.reduce((s, w) => s + (norm.includes(` ${w} `) ? 1 : 0), 0);
  const scores: Record<Lang, number> = { en: score(EN_MARKERS), ht: score(HT_MARKERS), fr: score(FR_MARKERS) };
  if (scores.en > scores.ht && scores.en > scores.fr) return "en";
  if (scores.ht > scores.fr) return "ht";
  return "fr";
}

export function pick(loc: Localized, lang: Lang): string {
  return loc[lang] ?? loc.fr;
}

export type FaqTopic = { id: string; keywords: string[]; answer: Localized };

export const FAQ_TOPICS: FaqTopic[] = [
  {
    id: "delai",
    keywords: ["delai", "combien de temps", "jours", "duree", "quand", "retard",
      "konbyen tan", "konbyen jou", "dele", "kile", "kilè",
      "how long", "days", "when will", "delay", "arrival time"],
    answer: {
      fr: "Une fois votre colis reçu à notre entrepôt de Miami, comptez généralement entre 3 et 7 jours ouvrables (du lundi au vendredi) pour qu'il arrive à votre agence en Haïti. Ce délai peut varier selon la douane, ou si votre code client ne figurait pas dans l'adresse du colis.",
      ht: "Yon fwa koli w rive nan depo nou Miami, konte apeprè 3 a 7 jou ouvrab (lendi-vandredi) pou l rive nan ajans ou an Ayiti. Dele sa a ka chanje selon douàn, oswa si kòd kliyan w pa t sou adrès koli a.",
      en: "Once your package is received at our Miami warehouse, expect roughly 3 to 7 business days (Monday-Friday) for it to reach your agency in Haiti. This can vary depending on customs, or if your customer code wasn't included on the package address."
    }
  },
  {
    id: "pa-parèt",
    keywords: ["n'apparait pas", "napparait pas", "pas encore", "ne vois pas", "narrive pas",
      "pa parèt", "pa wè", "poko parèt", "pa gen koli",
      "not showing", "don't see", "doesn't appear", "missing", "can't find"],
    answer: {
      fr: "Votre colis apparaît dès que notre entrepôt de Miami l'a reçu et enregistré, pas avant. L'application se met à jour automatiquement ; vous pouvez aussi toucher le bouton ↻ en haut de l'écran. S'il n'apparaît toujours pas, c'est souvent que le code client MC-… n'était pas sur la ligne « Address 2 » lors de l'achat. Écrivez-nous sur WhatsApp avec votre numéro de suivi pour une réclamation.",
      ht: "Koli w parèt depi depo Miami nou an resevwa l epi anrejistre l, pa anvan. App la mete tèt li ajou otomatikman ; ou ka tou peze bouton ↻ anwo ekran an. Si li toujou pa parèt, souvan se paske kòd kliyan MC-... pa t sou liy « Address 2 » lè w te achte a. Ekri nou sou WhatsApp ak nimewo tracking ou pou fè yon reklamasyon.",
      en: "Your package shows up as soon as our Miami warehouse has received and logged it, not before. The app refreshes automatically; you can also tap the ↻ button at the top of the screen. If it still doesn't show, it's usually because the customer code MC-… wasn't on the 'Address 2' line at checkout. Message us on WhatsApp with your tracking number to file a claim."
    }
  },
  {
    id: "plizyè-koli",
    keywords: ["plusieurs colis", "plusieurs boutiques", "plusieurs magasins", "ensemble",
      "plizyè koli", "plizyè boutik", "plizyè magazen",
      "multiple packages", "several packages", "different stores", "combine packages"],
    answer: {
      fr: "Oui. Vous pouvez commander dans plusieurs boutiques : chaque colis est reçu et pesé séparément à Miami, et tous ceux qui portent votre code client sont regroupés dans votre compte. Les colis disponibles en même temps peuvent être réunis sur une seule facture.",
      ht: "Wi. Ou ka kòmande nan plizyè boutik: chak koli resevwa epi peze apa Miami, epi tout sa ki gen kòd kliyan w yo gwoupe nan kont ou. Koli ki disponib an menm tan ka regwoupe sou yon sèl facture.",
      en: "Yes. You can order from several stores: each package is received and weighed separately in Miami, and everything with your customer code is grouped in your account. Packages that become available at the same time can be combined on a single invoice."
    }
  },
  {
    id: "préparer-retrait",
    keywords: ["préparer mon retrait", "preparer mon retrait", "que signifie disponible", "disponible veut dire",
      "preparer retrait", "kisa disponib vle di", "jan pou m retire",
      "prepare my pickup", "what does available mean", "how to pick up"],
    answer: {
      fr: "Quand un colis passe au statut « Disponible », ouvrez « Disponibles », cochez les colis que vous viendrez chercher et touchez « Préparer mon retrait ». Les factures impayées doivent être réglées à l'agence avant la remise. Vous disposez de 15 jours pour retirer un colis disponible ; à partir du 16e jour, des frais d'entreposage de 5 $ US par jour s'appliquent.",
      ht: "Lè yon koli rive sou estati « Disponible », louvri « Disponibles », koche koli ou pral vin chèche yo epi peze « Préparer mon retrait ». Fakti ki pa peye yo dwe regle nan ajans lan anvan remiz la. Ou gen 15 jou pou w retire yon koli disponib ; apati 16yèm jou a, yon frè depo 5$ US pa jou aplike.",
      en: "When a package becomes 'Disponible' (available), open 'Disponibles', check the packages you'll come pick up, and tap 'Préparer mon retrait'. Unpaid invoices must be settled at the agency before handover. You have 15 days to pick up an available package; from day 16 on, a $5 USD/day storage fee applies."
    }
  },
  {
    id: "mot-de-passe",
    keywords: ["mot de passe oublie", "oublié mon mot de passe", "reinitialiser",
      "modpas bliye", "bliye modpas",
      "forgot password", "reset password", "forgot my password"],
    answer: {
      fr: "Écrivez-nous sur WhatsApp : nous vous envoyons un nouveau mot de passe. Connectez-vous avec votre code client MC-XXXXX et ce mot de passe, puis changez-le dans votre profil.",
      ht: "Ekri nou sou WhatsApp: nou voye yon nouvo modpas ba ou. Konekte ak kòd kliyan MC-XXXXX ou ak modpas sa a, epi chanje l nan pwofil ou.",
      en: "Message us on WhatsApp and we'll send you a new password. Log in with your customer code MC-XXXXX and that password, then change it from your profile."
    }
  },
  {
    id: "prix",
    keywords: ["prix peut il changer", "prix change", "comment le prix", "calcul du prix", "tarif",
      "pri ka chanje", "kijan pri a kalkile", "konbyen pri a",
      "price change", "how is the price calculated", "how much does it cost", "pricing"],
    answer: {
      fr: "Le prix correspond au poids du colis × le tarif de votre ville. Un petit colis a un prix fixe selon votre configuration. À partir de 6,5 lb au total, une taxe fixe de 10 $ s'applique. Certains articles (téléphone, ordinateur, caméra…) ont un prix forfaitaire, sans rapport au poids. Le prix affiché dans l'app est une estimation — le prix final est fixé après la pesée réelle à l'entrepôt.",
      ht: "Pri a se pwa koli a × tarif vil ou. Yon ti koli gen yon pri fiks selon konfigirasyon an. Apati 6.5 lb antou, yon taks fiks $10 aplike. Sèten atik (telefòn, òdinatè, kamera...) gen yon pri fòfè, pwa a pa konte. Pri ki afiche nan app la se yon estimasyon — pri final la fikse apre vrè pwa a pran nan depo a.",
      en: "The price is the package's weight × your city's rate. A small package gets a fixed price under your plan. From 6.5 lb total, a fixed $10 tax applies. Some items (phone, laptop, camera…) have a flat price regardless of weight. The price shown in the app is an estimate — the final price is set after the real weight is taken at the warehouse."
    }
  },
  {
    id: "comment-ça-marche",
    keywords: ["comment ça marche", "comment fonctionne", "comment expedier", "adresse miami", "address 2",
      "kijan sa mache", "kijan pou m voye", "adrès miami",
      "how does it work", "how to ship", "miami address", "how do i send"],
    answer: {
      fr: "Achetez en ligne en utilisant l'adresse de notre dépôt à Miami, avec votre code client sur la ligne « Address 2 ». Notre entrepôt enregistre et pèse votre colis à la réception, puis il est acheminé vers Haïti jusqu'à votre agence. Consultez « Mon adresse » dans l'application pour voir l'adresse complète.",
      ht: "Achte sou entènèt lè w itilize adrès depo Miami nou an, ak kòd kliyan w sou liy « Address 2 ». Depo nou anrejistre epi peze koli w lè l rive, epi li voye l an Ayiti rive nan ajans ou. Gade « Mon adresse » nan app la pou wè adrès konplè a.",
      en: "Shop online using our Miami warehouse address, with your customer code on the 'Address 2' line. Our warehouse logs and weighs your package when it arrives, then ships it to Haiti to your agency. Check 'Mon adresse' in the app for the full address."
    }
  },
  {
    id: "agences",
    keywords: ["point de retrait", "nos agences", "ou retirer", "quelle agence",
      "pwen retrè", "ki ajans", "kote pou m retire",
      "pickup point", "which agency", "where to pick up", "agency location"],
    answer: {
      fr: "Retirez votre colis dans le point de retrait le plus proche de vous. La liste complète de nos agences est disponible dans « Guide et aide » de l'application.",
      ht: "Retire koli w nan pwen retrè ki pi pre w la. Lis konplè ajans nou yo disponib nan « Guide & Aide » nan app la.",
      en: "Pick up your package at the pickup point nearest you. The full list of our agencies is available under 'Guide & Aide' in the app."
    }
  },
  {
    id: "articles-interdits",
    keywords: ["articles interdits", "produit interdit", "ne peut pas envoyer",
      "atik entèdi", "sa ki entèdi",
      "forbidden items", "prohibited items", "what can't i ship", "banned items"],
    answer: {
      fr: "Les compagnies aériennes et la douane interdisent : armes et munitions, produits inflammables, explosifs, produits corrosifs, batteries au lithium séparées, drogues, contenu pornographique, animaux vivants, espèces, produits périssables. Vous êtes responsable du contenu de votre colis — en cas de doute, contactez-nous sur WhatsApp avant votre achat.",
      ht: "Konpayi avyon ak douàn entèdi: zam ak minisyon, pwodwi enflamab, eksplozif, pwodwi kowozif, batri lityòm apa, dwòg, kontni pònografik, bèt vivan, lajan likid, pwodwi perisab. Ou responsab sa ki nan koli w — si w gen dout, ekri nou sou WhatsApp anvan ou achte.",
      en: "Airlines and customs prohibit: weapons and ammunition, flammable products, explosives, corrosive products, separated lithium batteries, drugs, pornographic content, live animals, cash, perishable goods. You're responsible for your package's contents — if unsure, message us on WhatsApp before you buy."
    }
  },
];

export const GREETING_KEYWORDS = ["bonjour", "bonsoir", "salut", "bonjou", "bonswa", "alo", "hello", "hi", "hey", "good morning", "good afternoon"];

export const GREETING: Localized = {
  fr: "Bonjour ! Je suis Daha, l'assistant STANDA COMMERCIAL. Je peux vous dire où en sont vos colis, combien vous devez, ou comment fonctionne le service. Posez-moi votre question !",
  ht: "Bonjou ! Mwen se Daha, asistan STANDA COMMERCIAL. Mwen ka di w kote koli w yo ye, konbyen ou dwe, oswa kijan sèvis la mache. Poze m kesyon w !",
  en: "Hello! I'm Daha, the STANDA COMMERCIAL assistant. I can tell you where your packages are, how much you owe, or how the service works. Ask away!"
};

export const FALLBACK: Localized = {
  fr: "Je n'ai pas de réponse toute prête pour cette question précise. Écrivez-nous sur WhatsApp — notre équipe vous répondra directement.",
  ht: "Mwen pa gen yon repons tou pare pou kesyon presi sa a. Ekri nou sou WhatsApp — ekip nou ap reponn ou dirèkteman.",
  en: "I don't have a ready answer for that exact question. Message us on WhatsApp — our team will answer you directly."
};

/** Mo-kle ki di nou kliyan an ap mande sou PWÒP done l yo (pa yon FAQ jeneral). */
export const STATUS_INTENT_KEYWORDS = [
  "ou est mon colis", "où est mon colis", "statut de mon colis", "suivi de mon colis", "mes colis",
  "kote koli mwen", "kote koli m", "estati koli", "koli mwen ye",
  "where is my package", "where are my packages", "my package status", "track my package", "my tracking"
];
export const BALANCE_INTENT_KEYWORDS = [
  "combien je dois", "mon solde", "je dois payer", "reste a payer", "ma facture",
  "konbyen m dwe", "balans mwen", "fòk mwen peye", "sa m dwe peye",
  "how much do i owe", "my balance", "what do i owe", "outstanding balance", "my invoice"
];

function scoreKeywords(norm: string, keywords: string[]): number {
  let score = 0;
  for (const kw of keywords) {
    if (norm.includes(normalize(kw))) score += kw.split(" ").length;
  }
  return score;
}

export type MatchResult =
  | { kind: "greeting" }
  | { kind: "status" }
  | { kind: "balance" }
  | { kind: "faq"; topic: FaqTopic }
  | { kind: "none" };

/** Chwazi sa kliyan an ap mande — done vivan (estati/balans) gen priyorite sou FAQ jeneral. */
export function matchMessage(message: string): MatchResult {
  const norm = normalize(message);
  if (!norm) return { kind: "none" };

  const statusScore = scoreKeywords(norm, STATUS_INTENT_KEYWORDS);
  const balanceScore = scoreKeywords(norm, BALANCE_INTENT_KEYWORDS);
  if (statusScore > 0 || balanceScore > 0) {
    return balanceScore >= statusScore ? { kind: "balance" } : { kind: "status" };
  }

  let best: { topic: FaqTopic; score: number } | null = null;
  for (const topic of FAQ_TOPICS) {
    const score = scoreKeywords(norm, topic.keywords);
    if (score > 0 && (!best || score > best.score)) best = { topic, score };
  }
  if (best) return { kind: "faq", topic: best.topic };

  if (scoreKeywords(norm, GREETING_KEYWORDS) > 0 && norm.split(" ").length <= 4) return { kind: "greeting" };

  return { kind: "none" };
}
