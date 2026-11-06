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

const schema = z.object({
  comments: z.string().trim().max(500).optional(),
  kgSeparated: z.coerce.number().min(0).max(1000).default(0),
  reusedItems: z.coerce.number().int().min(0).max(10000).default(0),
  files: z.array(fileSchema).min(1, "Sube al menos una foto")
});

export async function GET() {
  try {
    const session = await requireStudentSession();
    const supabase = createServerSupabase();

    const { data: challenge } = await supabase
      .from("weekly_challenges")
      .select("id")
      .eq("school_id", session.schoolId)
      .eq("is_current", true)
      .maybeSingle();
    if (!challenge) return NextResponse.json({ data: null });

    const { data: submission } = await supabase
      .from("student_submissions")
      .select(
        "id, status, comments, kg_separated, reused_items, student_evidence_files(id)"
      )
      .eq("student_id", session.studentId)
      .eq("challenge_id", challenge.id)
      .maybeSingle();

    return NextResponse.json({
      data: submission
        ? {
            id: submission.id,
            status: submission.status,
            comments: submission.comments,
            kgSeparated: Number(submission.kg_separated ?? 0),
            reusedItems: Number(submission.reused_items ?? 0),
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
      .select("id")
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
