# Publication de l'app CLIENT — Google Play + App Store

Seule l'app **client** (`com.standacommercialsa.app`, « Standa ») va sur les magasins.
Les apps staff (Agence, Admin, Équipe, Partenaire) restent distribuées de main en main.

État du projet (2026-09-21) :

| Élément | État |
|---|---|
| Signature release Android + AAB | Prêt côté code — voir `android/RELEASE.md` (à toi : créer la clé) |
| Suppression de compte dans l'app | Fait (`/api/delete-account`, menu → « Supprimer mon compte ») |
| Politique de confidentialité | `https://www.standacommercialsa.com/confidentialite` |
| URL « suppression de compte » (Play) | `https://www.standacommercialsa.com/confidentialite#suppression-compte` |
| iPhone | Pas de projet iOS. Il faut un Mac (ou Codemagic / GitHub Actions macOS) |

## 1. Google Play Console

1. Créer le compte développeur (frais uniques). Les comptes personnels récents peuvent devoir faire
   un **test fermé** (testeurs pendant ~14 jours) avant la production : vérifier la règle actuelle.
2. **Créer l'application** : nom « Standa », langue par défaut français, App (pas jeu), Gratuite.
3. **Play App Signing** : accepter à la première version, téléverser `app-release.aab`.
4. **Fiche du Store**
   - Titre (30 max) : `Standa – Suivi de colis`
   - Description courte (80 max) : `Suivez vos colis et factures STANDA COMMERCIAL, de Miami à Haïti.`
   - Description complète :

     > STANDA COMMERCIAL vous permet de suivre vos colis envoyés des États-Unis vers Haïti.
     >
     > • Voyez chaque colis : reçu à Miami, arrivé en Haïti, disponible, remis.
     > • Recevez une notification dès qu'un colis est reçu ou prêt à retirer.
     > • Consultez vos factures et ce qu'il reste à payer.
     > • Retrouvez votre adresse de dépôt aux États-Unis.
     > • Estimez le coût d'un envoi avec le calculateur.
     > • Demandez le retrait de vos colis disponibles à votre agence.
     > • Contactez l'équipe sur WhatsApp.
     >
     > Un compte client STANDA COMMERCIAL est nécessaire.

   - Icône 512×512 PNG, image de présentation 1024×500, **au moins 2 captures d'écran** de téléphone
     (espace client, liste de colis, factures). À prendre depuis l'app sur téléphone.
   - Catégorie : *Shopping* ou *Outils / Productivité* (au choix). Contact : e-mail + site + téléphone.
5. **Politique de confidentialité** : URL ci-dessus.
6. **Sécurité des données (Data safety)** — réponses prévues d'après le code :

   | Donnée | Collectée | Partagée | Pourquoi | Facultative |
   |---|---|---|---|---|
   | Nom | Oui | Non* | Fonctionnalité du compte | Non |
   | E-mail | Oui | Non* | Compte, notifications | Non |
   | Téléphone / WhatsApp | Oui | Non* | Compte, livraison | Non |
   | Adresse | Oui | Non* | Livraison / retrait | Non |
   | Pièce d'identité (type + numéro) | Oui | Non | Vérification, douane | Non |
   | Identifiant appareil (jeton de notification) | Oui | Non* | Notifications | Oui |
   | Historique d'achats (colis, factures, paiements) | Oui | Non | Fonctionnalité | Non |

   \* Les prestataires techniques qui traitent les données pour nous (hébergement Supabase, Vercel,
   notifications Firebase, e-mails Resend) sont des **sous-traitants** : ne pas les compter comme
   « partage » si Google demande la distinction service provider. À confirmer en relisant la
   définition dans le formulaire.

   - Données chiffrées en transit : **Oui** (HTTPS).
   - Les utilisateurs peuvent demander la suppression : **Oui** — dans l'app + l'URL ci-dessus.
   - Aucune pub, aucun traceur tiers (voir section 8 de la politique).

7. **Classification du contenu** (questionnaire IARC) : pas de violence, sexe, jeux d'argent ni contenu
   généré par les utilisateurs. **Public cible : 18 ans et plus.**
8. **Accès à l'application** : fournir un compte de test (identifiants) aux relecteurs, avec des colis
   d'exemple. **Créer un compte de démo dédié** (le relecteur pourrait le supprimer en testant).
9. Déclarations : pas de publicités ; l'app ne demande que `INTERNET` et `POST_NOTIFICATIONS`.

## 2. App Store (iPhone) — à faire après Android

Prérequis : compte Apple Developer, **un Mac avec Xcode** (ou service cloud).

1. Ajouter le projet iOS : `npm i @capacitor/ios` puis `npx cap add ios` (sur le Mac / le CI).
2. **Notifications** : créer une clé APNs (developer.apple.com) et l'ajouter à Firebase
   (Cloud Messaging → app iOS), ajouter `GoogleService-Info.plist`. Le serveur envoie déjà via FCM.
3. **Risque de refus (règle 4.2)** : l'app charge le site (`server.url`). Apple refuse souvent les
   simples enveloppes de site web. À présenter dans les *Review Notes* : notifications push natives,
   suivi de colis personnel, compte client. Si refus, ajouter une fonction native visible
   (ex. scan/appareil photo, partage de colis) puis renvoyer.
4. **App Privacy** (étiquettes de confidentialité) : mêmes données que le tableau ci-dessus,
   « liées à l'identité », usage « fonctionnalités de l'app ».
5. **Review Notes** : identifiants du compte de démo, explication du flux (colis Miami → Haïti),
   emplacement de « Supprimer mon compte » (menu en haut à droite).
6. Pas de « Sign in with Apple » requis : l'app n'utilise pas de connexion sociale.
7. Pas d'achat intégré : le service est un transport physique (règles 3.1.3(e)).
