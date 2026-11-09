import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Firma URLs para archivos de evidencias del bucket privado. Devuelve una URL
 * firmada por archivo (válida `expiresInSeconds`), firmando en lote para evitar
 * N+1 contra Storage.
 *
 * Nota: el plan Free de Supabase NO incluye Image Transformation, así que aquí
 * NO se aplica `transform` (resize/calidad); se sirve el archivo original. El
 * peso de las imágenes nuevas se controla comprimiéndolas en el cliente antes
 * de subir (ver `src/lib/image/compress.ts`).
 */

export type EvidenceFileInput = {
  id: string;
  path: string;
  type: string;
  [extra: string]: unknown;
};

export type SignedEvidenceFile<T extends EvidenceFileInput> = T & {
  signedUrl: string | null;
};

export async function signEvidenceFiles<T extends EvidenceFileInput>(
  supabase: SupabaseClient,
  bucket: string,
  files: T[],
  expiresInSeconds: number
): Promise<SignedEvidenceFile<T>[]> {
  const { data: signed, error } = await supabase.storage
    .from(bucket)
    .createSignedUrls(
      files.map((f) => f.path),
      expiresInSeconds
    );
  if (error) throw error;

  const byPath = new Map<string, string>();
  (signed ?? []).forEach((entry) => {
    if (entry.path && entry.signedUrl) byPath.set(entry.path, entry.signedUrl);
  });

  return files.map((file) => ({
    ...file,
    signedUrl: byPath.get(file.path) ?? null
  }));
}
