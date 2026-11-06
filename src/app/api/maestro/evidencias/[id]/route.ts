import { NextResponse } from "next/server";
import { z } from "zod";
import { HttpError, jsonError } from "@/lib/auth-admin";
import { assertGroupOwnership, requireTeacherWithSchool } from "@/lib/auth-teacher";
import { createServerSupabase } from "@/lib/supabase/server";
import { recalcGroupSubmissionScore } from "@/lib/services/scoring-service";

const schema = z.object({
  status: z.enum(["submitted", "approved", "rejected"]).optional(),
  // Ajuste opcional del maestro sobre las metricas derivadas de los alumnos.
  kgSeparated: z.coerce.number().min(0).max(100000).optional(),
  reusedItems: z.coerce.number().int().min(0).max(1000000).optional(),
  comments: z.string().trim().max(1000).optional()
});

/**
 * Revision de una evidencia de GRUPO por el maestro: aprobar/rechazar y, si
 * hace falta, ajustar los kg separados / materiales reutilizados que vienen
 * sumados de los alumnos. El numero de participantes NO se edita aqui: se
 * deriva automaticamente del numero de alumnos que enviaron evidencia.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireTeacherWithSchool();
    const { id } = await params;
    const json = await request.json();
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Datos invalidos" },
        { status: 400 }
      );
    }
    if (
      parsed.data.status === undefined &&
      parsed.data.kgSeparated === undefined &&
      parsed.data.reusedItems === undefined &&
      parsed.data.comments === undefined
    ) {
      return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });
    }

    const supabase = createServerSupabase();

    const { data: submission } = await supabase
      .from("submissions")
      .select("id, group_id, groups(school_id)")
      .eq("id", id)
      .maybeSingle();

    const group = Array.isArray(submission?.groups)
      ? submission?.groups[0]
      : submission?.groups;

    if (!submission || group?.school_id !== session.schoolId) {
      throw new HttpError(404, "Evidencia no encontrada");
    }

    // El maestro debe tener asignado el grupo (admin pasa libre).
    await assertGroupOwnership(session, submission.group_id as string);

    // Actualiza estado y/o comentario de la entrega de grupo.
    const submissionPatch: Record<string, unknown> = {
      updated_at: new Date().toISOString()
    };
    if (parsed.data.status !== undefined) submissionPatch.status = parsed.data.status;
    if (parsed.data.comments !== undefined) submissionPatch.comments = parsed.data.comments;

    if (Object.keys(submissionPatch).length > 1) {
      const { error: updateError } = await supabase
        .from("submissions")
        .update(submissionPatch)
        .eq("id", id);
      if (updateError) throw updateError;
    }

    // Ajuste manual de metricas (override del maestro sobre la suma de alumnos).
    if (parsed.data.kgSeparated !== undefined || parsed.data.reusedItems !== undefined) {
      const metricsPatch: Record<string, unknown> = {
        updated_at: new Date().toISOString()
      };
      if (parsed.data.kgSeparated !== undefined) {
        metricsPatch.kg_separated = parsed.data.kgSeparated;
        metricsPatch.waste_reduced_estimate = parsed.data.kgSeparated;
      }
      if (parsed.data.reusedItems !== undefined) {
        metricsPatch.reused_items = parsed.data.reusedItems;
      }
      const { error: metricsError } = await supabase
        .from("impact_metrics")
        .update(metricsPatch)
        .eq("submission_id", id);
      if (metricsError) throw metricsError;
    }

    // Mantener el score coherente: limpiar si se rechaza, recalcular en el resto.
    if (parsed.data.status === "rejected") {
      await supabase.from("scores").delete().eq("submission_id", id);
    } else {
      await recalcGroupSubmissionScore(id);
    }

    return NextResponse.json({ ok: true, status: parsed.data.status ?? null });
  } catch (error) {
    return jsonError(error);
  }
}
