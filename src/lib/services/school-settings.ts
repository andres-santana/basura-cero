import { createServerSupabase } from "@/lib/supabase/server";

export type SchoolSettings = {
  requirePasswordChange: boolean;
};

/**
 * Lee la configuracion de una escuela. Si la columna/escuela no existe,
 * devuelve valores por defecto seguros (sin forzar cambio de contrasena).
 */
export async function getSchoolSettings(
  schoolId: string
): Promise<SchoolSettings> {
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("schools")
    .select("require_password_change")
    .eq("id", schoolId)
    .maybeSingle();

  if (error) throw error;

  return {
    requirePasswordChange: data?.require_password_change === true
  };
}

/**
 * Indica si los usuarios creados por el admin deben cambiar su contrasena
 * en el primer ingreso, segun la configuracion de la escuela.
 */
export async function shouldRequirePasswordChange(
  schoolId: string
): Promise<boolean> {
  const settings = await getSchoolSettings(schoolId);
  return settings.requirePasswordChange;
}
