import { NextResponse } from "next/server";
import { z } from "zod";
import { HttpError, jsonError, requireAdminWithSchool } from "@/lib/auth-admin";
import { createServerSupabase } from "@/lib/supabase/server";
import { syncGroupMetricsFromStudents } from "@/lib/services/teacher-evidence";

const schema = z.object({
  status: z.enum(["submitted", "approved", "rejected"]).optional(),
  kgSeparated: z.coerce.number().min(0).max(1000).optional(),
  reusedItems: z.coerce.number().int().min(0).max(10000).optional(),
  recycledItems: z.coerce.number().int().min(0).max(10000).optional()
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAdminWithSchool();
    const { id } = await params;
    const json = await request.json();
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Datos invalidos" }, { status: 400 });
    }
    if (
      parsed.data.status === undefined &&
      parsed.data.kgSeparated === undefined &&
      parsed.data.reusedItems === undefined &&
      parsed.data.recycledItems === undefined
    ) {
      return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });
    }

    const supabase = createServerSupabase();

    const { data: submission } = await supabase
      .from("student_submissions")
      .select("id, group_id, challenge_id, groups(school_id)")
      .eq("id", id)
      .maybeSingle();

    const group = Array.isArray(submission?.groups)
      ? submission?.groups[0]
      : submission?.groups;

    if (!submission || group?.school_id !== session.schoolId) {
      throw new HttpError(404, "Evidencia no encontrada");
    }

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (parsed.data.status !== undefined) patch.status = parsed.data.status;
    if (parsed.data.kgSeparated !== undefined) patch.kg_separated = parsed.data.kgSeparated;
    if (parsed.data.reusedItems !== undefined) patch.reused_items = parsed.data.reusedItems;
    if (parsed.data.recycledItems !== undefined) patch.recycled_items = parsed.data.recycledItems;

    const { error } = await supabase
      .from("student_submissions")
      .update(patch)
      .eq("id", id);
    if (error) throw error;

    // Re-sincroniza la entrega de grupo: participantes y metricas se derivan de
    // las evidencias de alumnos no rechazadas, y se recalcula el score, las
    // insignias y el ranking.
    await syncGroupMetricsFromStudents(
      supabase,
      submission.group_id as string,
      submission.challenge_id as string
    );

    return NextResponse.json({ ok: true, status: parsed.data.status ?? null });
  } catch (error) {
    return jsonError(error);
  }
}
