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
  fullName: z.string().min(2),
  password: z.string().min(8).optional()
});

export async function GET() {
  try {
    const session = await requireAdminWithSchool();
    const supabase = createServerSupabase();

    const { data, error } = await supabase
      .from("teachers")
      .select(
        "id, full_name, created_at, user_id, users(email, is_active), groups(id, name, grade)"
      )
      .eq("school_id", session.schoolId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({
      data: (data ?? []).map((t) => {
        const user = Array.isArray(t.users) ? t.users[0] : t.users;
        return {
          id: t.id,
          userId: t.user_id,
          fullName: t.full_name,
          email: user?.email ?? null,
          isActive: user?.is_active ?? false,
          groups: t.groups ?? []
        };
      })
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
      email_confirm: true,
      user_metadata: { full_name: parsed.data.fullName }
    });

    if (authError || !created.user) {
      return NextResponse.json(
        { error: authError?.message ?? "No se pudo crear el usuario" },
        { status: 400 }
      );
    }

    const userId = created.user.id;

    const { error: userInsertError } = await supabase.from("users").insert({
      id: userId,
      school_id: session.schoolId,
      email: parsed.data.email,
      role: "teacher",
      is_active: true,
      must_change_password: mustChangePassword
    });

    if (userInsertError) {
      await supabase.auth.admin.deleteUser(userId).catch(() => undefined);
      return NextResponse.json(
        { error: userInsertError.message },
        { status: 500 }
      );
    }

    const { error: teacherInsertError } = await supabase.from("teachers").insert({
      user_id: userId,
      school_id: session.schoolId,
      full_name: parsed.data.fullName
    });

    if (teacherInsertError) {
      await supabase.from("users").delete().eq("id", userId);
      await supabase.auth.admin.deleteUser(userId).catch(() => undefined);
      return NextResponse.json(
        { error: teacherInsertError.message },
        { status: 500 }
      );
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
