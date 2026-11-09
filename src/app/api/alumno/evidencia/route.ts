import { NextResponse } from "next/server";
import { z } from "zod";
import { HttpError, jsonError } from "@/lib/auth-admin";
import { requireStudentSession } from "@/lib/auth-student";
import { createServerSupabase } from "@/lib/supabase/server";
import { recalcGroupSubmissionScore } from "@/lib/services/scoring-service";

const fileSchema = z.object({
  path: z.string().min(3),
  type: z.string().min(1).max(60)
});

const materialQuantitySchema = z.object({
  materialId: z.string().uuid(),
  quantity: z.coerce.number().min(0).max(1_000_000)
});

const schema = z.object({
  comments: z.string().trim().max(500).optional(),
  kgSeparated: z.coerce.number().min(0).max(1000).default(0),
  reusedItems: z.coerce.number().int().min(0).max(10000).default(0),
  recycledItems: z.coerce.number().int().min(0).max(10000).default(0),
  materials: z.array(materialQuantitySchema).optional(),
  files: z.array(fileSchema).min(1, "Sube al menos una foto")
});

export async function GET() {
  try {
    const session = await requireStudentSession();
    const supabase = createServerSupabase();

    const { data: challenge } = await supabase
      .from("weekly_challenges")
      .select("id, experiment_id")
      .eq("school_id", session.schoolId)
      .eq("is_current", true)
      .maybeSingle();
    if (!challenge) return NextResponse.json({ data: null, materials: [] });

    // Catalogo de materiales activos del experimento del reto (Fase 2).
    const { data: materialRows } = await supabase
      .from("experiment_materials")
      .select("id, label, unit_label, kind, display_order")
      .eq("experiment_id", challenge.experiment_id)
      .eq("is_active", true)
      .order("display_order", { ascending: true });
    const materials = (materialRows ?? []).map((m) => ({
      id: m.id,
      label: m.label,
      unitLabel: m.unit_label,
      kind: m.kind
    }));

    const { data: submission } = await supabase
      .from("student_submissions")
      .select(
        "id, status, comments, kg_separated, reused_items, recycled_items, student_evidence_files(id), student_submission_materials(material_id, quantity)"
      )
      .eq("student_id", session.studentId)
      .eq("challenge_id", challenge.id)
      .maybeSingle();

    const savedQuantities: Record<string, number> = {};
    const smRows = (submission as { student_submission_materials?: unknown } | null)
      ?.student_submission_materials;
    if (Array.isArray(smRows)) {
      for (const row of smRows as { material_id: string; quantity: number }[]) {
        savedQuantities[row.material_id] = Number(row.quantity ?? 0);
      }
    }

    return NextResponse.json({
      materials,
      data: submission
        ? {
            id: submission.id,
            status: submission.status,
            comments: submission.comments,
            kgSeparated: Number(submission.kg_separated ?? 0),
            reusedItems: Number(submission.reused_items ?? 0),
            recycledItems: Number(submission.recycled_items ?? 0),
            materialQuantities: savedQuantities,
            filesCount: Array.isArray(submission.student_evidence_files)
              ? submission.student_evidence_files.length
              : 0
          }
        : null
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireStudentSession();
    const json = await request.json();
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Datos invalidos" },
        { status: 400 }
      );
    }

    const supabase = createServerSupabase();

    const { data: challenge } = await supabase
      .from("weekly_challenges")
      .select("id, experiment_id")
      .eq("school_id", session.schoolId)
      .eq("is_current", true)
      .maybeSingle();
    if (!challenge) {
      throw new HttpError(404, "No hay un reto activo ahora mismo");
    }

    const { data: submission, error: subError } = await supabase
      .from("student_submissions")
      .upsert(
        {
          challenge_id: challenge.id,
          student_id: session.studentId,
          group_id: session.groupId,
          comments: parsed.data.comments ?? null,
          kg_separated: parsed.data.kgSeparated,
          reused_items: parsed.data.reusedItems,
          recycled_items: parsed.data.recycledItems,
          status: "submitted",
          submitted_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        { onConflict: "challenge_id,student_id" }
      )
      .select("id")
      .single();
    if (subError) throw subError;

    const submissionId = submission.id;

    await supabase
      .from("student_evidence_files")
      .delete()
      .eq("student_submission_id", submissionId);

    const { error: filesError } = await supabase.from("student_evidence_files").insert(
      parsed.data.files.map((f) => ({
        student_submission_id: submissionId,
        file_path: f.path,
        file_type: f.type
      }))
    );
    if (filesError) throw filesError;

    // Cantidades por material (Fase 2). Solo se aceptan materiales activos que
    // pertenezcan al experimento del reto actual; el resto se ignora.
    if (parsed.data.materials && parsed.data.materials.length > 0) {
      const { data: validMaterials } = await supabase
        .from("experiment_materials")
        .select("id")
        .eq("experiment_id", challenge.experiment_id)
        .eq("is_active", true);
      const validIds = new Set((validMaterials ?? []).map((m) => m.id as string));

      const rows = parsed.data.materials
        .filter((m) => validIds.has(m.materialId))
        .map((m) => ({
          student_submission_id: submissionId,
          material_id: m.materialId,
          quantity: m.quantity,
          updated_at: new Date().toISOString()
        }));

      if (rows.length > 0) {
        const { error: matError } = await supabase
          .from("student_submission_materials")
          .upsert(rows, { onConflict: "student_submission_id,material_id" });
        if (matError) throw matError;
      }
    }

    // Si ya existe la entrega de grupo para este reto, recalcula su score para
    // reflejar el aporte agregado de alumnos (pasos/juegos).
    const { data: groupSub } = await supabase
      .from("submissions")
      .select("id")
      .eq("challenge_id", challenge.id)
      .eq("group_id", session.groupId)
      .maybeSingle();
    if (groupSub?.id) {
      await recalcGroupSubmissionScore(groupSub.id);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
