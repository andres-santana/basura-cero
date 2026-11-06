import { NextResponse } from "next/server";
import { z } from "zod";
import {
  generateTempPassword,
  jsonError,
  requireAdminWithSchool
} from "@/lib/auth-admin";
import { createServerSupabase } from "@/lib/supabase/server";

const patchSchema = z
  .object({
    isActive: z.boolean().optional(),
    resetPassword: z.boolean().optional(),
    password: z.string().min(8).optional()
  })
  .refine(
    (data) => data.isActive !== undefined || data.resetPassword === true,
    { message: "Nada que actualizar" }
  );

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAdminWithSchool();
    const { id } = await params;
    const json = await request.json();
    const parsed = patchSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Datos invalidos" },
        { status: 400 }
      );
    }

    const supabase = createServerSupabase();

    const { data: user, error: lookupError } = await supabase
      .from("users")
      .select("id, role, school_id")
      .eq("id", id)
      .maybeSingle();
    if (lookupError) throw lookupError;
    if (
      !user ||
      user.role !== "jury" ||
      user.school_id !== session.schoolId
    ) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    if (parsed.data.isActive !== undefined) {
      const { error: updateError } = await supabase
        .from("users")
        .update({ is_active: parsed.data.isActive })
        .eq("id", id);
      if (updateError) throw updateError;
    }

    let temporaryPassword: string | undefined;

    if (parsed.data.resetPassword === true) {
      const newPassword = parsed.data.password ?? generateTempPassword();

      const { error: authError } = await supabase.auth.admin.updateUserById(id, {
        password: newPassword
      });
      if (authError) {
        return NextResponse.json({ error: authError.message }, { status: 400 });
      }

      // Al resetear desde el admin no forzamos cambio de contrasena:
      // la nueva contrasena entregada ya es la definitiva para el usuario.
      const { error: profileError } = await supabase
        .from("users")
        .update({
          must_change_password: false,
          updated_at: new Date().toISOString()
        })
        .eq("id", id);
      if (profileError) throw profileError;

      temporaryPassword = newPassword;
    }

    return NextResponse.json({
      ok: true,
      ...(temporaryPassword ? { temporaryPassword } : {})
    });
  } catch (error) {
    return jsonError(error);
  }
}
