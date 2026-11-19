/**
 * Allège une photo AVANT son envoi vers le stockage (navigateur seulement).
 *
 * Pourquoi : chaque visiteur télécharge les images du site et des annonces.
 * Une photo de téléphone (1 à 5 Mo) affichée à des centaines de clients épuise
 * vite le quota de trafic Supabase. Réduite à 1600 px et convertie en WebP,
 * elle pèse en général 100 à 250 Ko, sans perte visible à l'écran.
 *
 * Les vidéos, les GIF et les images déjà légères sont envoyées telles quelles.
 * En cas d'échec (vieux navigateur), le fichier d'origine est renvoyé.
 */
const MAX_SIDE = 1600;
const QUALITY = 0.82;
const SKIP_BELOW = 200 * 1024;

export async function compressImage(file: File): Promise<File> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size <= SKIP_BELOW) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", QUALITY));
    // Safari ancien : pas d'encodeur WebP → il renvoie du PNG ; on garde l'original.
    if (!blob || blob.type !== "image/webp" || blob.size >= file.size) return file;
    const name = file.name.replace(/\.[^.]+$/, "") + ".webp";
    return new File([blob], name, { type: "image/webp", lastModified: Date.now() });
  } catch {
    return file;
  }
}
