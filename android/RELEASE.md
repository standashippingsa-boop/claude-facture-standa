# Publier l'app client (Play Store) — AAB signé

App : `com.standacommercialsa.app` (Standa, espace client). JAMAIS les apps staff.

## 1. Créer la clé d'upload (une seule fois)

Dans PowerShell, en remplaçant rien d'autre que ce que `keytool` te demande
(tes propres mots de passe — ne les partage à personne, pas même dans un chat) :

```powershell
New-Item -ItemType Directory -Force "$env:USERPROFILE\standa-keys" | Out-Null
& "$env:USERPROFILE\.jdks\jbr-21.0.11\bin\keytool.exe" -genkeypair -v `
  -keystore "$env:USERPROFILE\standa-keys\standa-upload.jks" `
  -alias standa-upload -keyalg RSA -keysize 2048 -validity 10000
```

**Sauvegarde le .jks et les mots de passe en 2 endroits sûrs** (clé USB + gestionnaire
de mots de passe). Avec Play App Signing, Google garde la vraie clé ; la clé d'upload
peut être réinitialisée par le support Google, mais c'est long. Ne la perds pas.

## 2. Brancher la clé

Copie `keystore.properties.example` en `keystore.properties` (même dossier) et remplis
les 4 valeurs. Ce fichier est ignoré par git.

## 3. Construire l'AAB

À chaque nouvelle version, monte `versionCode` (+1) dans `app/build.gradle`.

```powershell
# Java 21 (celui d'Android Studio pour ce projet). Le JBR de "Program Files" est
# en Java 25 : trop récent pour Gradle 8.14, il échoue avec "class file version 69".
$env:JAVA_HOME = "$env:USERPROFILE\.jdks\jbr-21.0.11"
cd android
.\gradlew.bat bundleRelease
# Résultat : app\build\outputs\bundle\release\app-release.aab
```

## 4. Envoyer à Google Play Console

Production (ou Test fermé) → Créer une version → téléverser `app-release.aab`.
Coche « Play App Signing » à la première version.
