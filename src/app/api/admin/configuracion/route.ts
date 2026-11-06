import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireAdminWithSchool } from "@/lib/auth-admin";
import { getSchoolSettings } from "@/lib/services/school-settings";
import { createServerSupabase } from "@/lib/supabase/server";

const patchSchema = z.object({
  requirePasswordChange: z.boolean()
});

export async function GET() {
  try {
    const session = await requireAdminWithSchool();
    const settings = await getSchoolSettings(session.schoolId);
    return NextResponse.json({ data: settings });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireAdminWithSchool();
    const json = await request.json();
    const parsed = patchSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Datos invalidos" },
        { status: 400 }
      );
    }

    const supabase = createServerSupabase();
    const { error } = await supabase
      .from("schools")
      .update({
        require_password_change: parsed.data.requirePasswordChange,
        updated_at: new Date().toISOString()
      })
      .eq("id", session.schoolId);

    if (error) throw error;

    return NextResponse.json({
      ok: true,
      data: { requirePasswordChange: parsed.data.requirePasswordChange }
    });
  } catch (error) {
    return jsonError(error);
  }
}
