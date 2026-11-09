/**
 * Compresión/redimensionado de imágenes en el cliente antes de subirlas a
 * Storage. Las fotos de móvil suelen pesar varios MB; reducirlas a ~1600px y
 * recomprimirlas a WebP baja el peso a cientos de KB, lo que acelera tanto la
 * subida como la descarga posterior en los paneles de maestro/admin.
 *
 * Es defensivo: si el navegador no puede procesar la imagen, si el tipo no es
 * comprimible (GIF animado, no-imagen) o si el resultado no mejora el tamaño,
 * devuelve el archivo original sin tocarlo.
 */

const MAX_DIMENSION = 1600; // lado mayor en px
const WEBP_QUALITY = 0.8; // 0..1
const SKIP_UNDER_BYTES = 300 * 1024; // no vale la pena tocar imágenes ya pequeñas

export async function compressImage(file: File): Promise<File> {
  // Solo imágenes rasterizadas; GIF puede ser animado y perdería la animación.
  if (!file.type.startsWith("image/")) return file;
  if (file.type === "image/gif") return file;
  if (file.size <= SKIP_UNDER_BYTES) return file;

  if (typeof document === "undefined" || typeof createImageBitmap === "undefined") {
    return file;
  }

  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file; // navegador no pudo decodificar: subir original
  }

  try {
    const largestSide = Math.max(bitmap.width, bitmap.height);
    const scale = Math.min(1, MAX_DIMENSION / largestSide);
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", WEBP_QUALITY)
    );
    if (!blob || blob.size >= file.size) return file; // no mejoró: original

    const newName = file.name.replace(/\.[^.]+$/, "") + ".webp";
    return new File([blob], newName, {
      type: "image/webp",
      lastModified: Date.now()
    });
  } catch {
    return file;
  } finally {
    bitmap?.close?.();
  }
}
