import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireAdminWithSchool } from "@/lib/auth-admin";
import { createServerSupabase } from "@/lib/supabase/server";

const patchSchema = z.object({
  action: z.enum(["activate", "deactivate"]).optional(),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
});

async function ensureBelongs(supabase: ReturnType<typeof createServerSupabase>, id: string, schoolId: string) {
  const { data, error } = await supabase
    .from("weekly_challenges")
    .select("id, school_id, is_current")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data || data.school_id !== schoolId) return null;
  return data;
}

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
      return NextResponse.json({ error: "Datos invalidos" }, { status: 400 });
    }

    const supabase = createServerSupabase();
    const challenge = await ensureBelongs(supabase, id, session.schoolId);
    if (!challenge) {
      return NextResponse.json({ error: "Reto no encontrado" }, { status: 404 });
    }

    if (parsed.data.action === "activate") {
      const { error: clearError } = await supabase
        .from("weekly_challenges")
        .update({ is_current: false })
        .eq("school_id", session.schoolId)
        .eq("is_current", true);
      if (clearError) throw clearError;

      const { error: setError } = await supabase
        .from("weekly_challenges")
        .update({ is_current: true })
        .eq("id", id);
      if (setError) throw setError;
    }

    if (parsed.data.action === "deactivate") {
      const { error } = await supabase
        .from("weekly_challenges")
        .update({ is_current: false })
        .eq("id", id);
      if (error) throw error;
    }

    const updates: Record<string, unknown> = {};
    if (parsed.data.startDate) updates.start_date = parsed.data.startDate;
    if (parsed.data.endDate) updates.end_date = parsed.data.endDate;
    if (Object.keys(updates).length > 0) {
      const { error } = await supabase
        .from("weekly_challenges")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAdminWithSchool();
    const { id } = await params;
    const supabase = createServerSupabase();

    const challenge = await ensureBelongs(supabase, id, session.schoolId);
    if (!challenge) {
      return NextResponse.json({ error: "Reto no encontrado" }, { status: 404 });
    }

    // Proteccion contra borrado destructivo: submissions y student_submissions
    // tienen ON DELETE CASCADE hacia weekly_challenges, por lo que eliminar el
    // reto borraria TODAS sus evidencias (de grupo y de alumnos) y sus
    // archivos/metricas/scores. Bloqueamos el borrado si hay evidencias.
    const [groupSubs, studentSubs] = await Promise.all([
      supabase
        .from("submissions")
        .select("id", { count: "exact", head: true })
        .eq("challenge_id", id),
      supabase
        .from("student_submissions")
        .select("id", { count: "exact", head: true })
        .eq("challenge_id", id)
    ]);
    if (groupSubs.error) throw groupSubs.error;
    if (studentSubs.error) throw studentSubs.error;

    const groupCount = groupSubs.count ?? 0;
    const studentCount = studentSubs.count ?? 0;
    if (groupCount > 0 || studentCount > 0) {
      return NextResponse.json(
        {
          error:
            `No se puede eliminar: este reto tiene ${studentCount} evidencia(s) de ` +
            `alumnos y ${groupCount} de grupo. Eliminarlo borraria todas ellas de ` +
            `forma permanente. Desactivalo en su lugar.`,
          groupCount,
          studentCount
        },
        { status: 409 }
      );
    }

    const { error } = await supabase.from("weekly_challenges").delete().eq("id", id);
    if (error) {
      return NextResponse.json(
        {
          error:
            "No se pudo eliminar. Probablemente tiene datos asociados; desactivalo en su lugar."
        },
        { status: 409 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
