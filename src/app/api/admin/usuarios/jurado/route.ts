import { NextResponse } from "next/server";
import { z } from "zod";
import {
  generateTempPassword,
  jsonError,
  requireAdminWithSchool
} from "@/lib/auth-admin";
import { shouldRequirePasswordChange } from "@/lib/services/school-settings";
import { createServerSupabase } from "@/lib/supabase/server";

const createSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).optional()
});

export async function GET() {
  try {
    const session = await requireAdminWithSchool();
    const supabase = createServerSupabase();

    const { data, error } = await supabase
      .from("users")
      .select("id, email, is_active, created_at")
      .eq("role", "jury")
      .eq("school_id", session.schoolId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({
      data: (data ?? []).map((u) => ({
        id: u.id,
        email: u.email,
        isActive: u.is_active
      }))
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAdminWithSchool();
    const json = await request.json();
    const parsed = createSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Datos invalidos" },
        { status: 400 }
      );
    }

    const supabase = createServerSupabase();
    const password = parsed.data.password ?? generateTempPassword();
    const mustChangePassword = await shouldRequirePasswordChange(session.schoolId);

    const { data: created, error: authError } = await supabase.auth.admin.createUser({
      email: parsed.data.email,
      password,
      email_confirm: true
    });

    if (authError || !created.user) {
      return NextResponse.json(
        { error: authError?.message ?? "No se pudo crear el usuario" },
        { status: 400 }
      );
    }

    const { error: insertError } = await supabase.from("users").insert({
      id: created.user.id,
      school_id: session.schoolId,
      email: parsed.data.email,
      role: "jury",
      is_active: true,
      must_change_password: mustChangePassword
    });

    if (insertError) {
      await supabase.auth.admin.deleteUser(created.user.id).catch(() => undefined);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      email: parsed.data.email,
      temporaryPassword: password
    });
  } catch (error) {
    return jsonError(error);
  }
}
