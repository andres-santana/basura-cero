import { NextResponse } from "next/server";
import { HttpError, jsonError } from "@/lib/auth-admin";
import { assertGroupOwnership, requireTeacherWithSchool } from "@/lib/auth-teacher";
import { createServerSupabase } from "@/lib/supabase/server";

const BUCKET = "evidencias";
const EXPIRES_IN_SECONDS = 600;

/**
 * Archivos de una evidencia de GRUPO para que el maestro los revise. Como las
 * fotos las suben los alumnos, se recopilan desde las evidencias de alumnos de
 * ese grupo en el mismo reto (student_evidence_files), incluyendo el apodo del
 * alumno para dar contexto al maestro.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireTeacherWithSchool();
    const { id } = await params;
    const supabase = createServerSupabase();

    const { data: submission } = await supabase
      .from("submissions")
      .select("id, group_id, challenge_id, groups(school_id)")
      .eq("id", id)
      .maybeSingle();

    const group = Array.isArray(submission?.groups)
      ? submission?.groups[0]
      : submission?.groups;
    if (!submission || group?.school_id !== session.schoolId) {
      throw new HttpError(404, "Evidencia no encontrada");
    }
    await assertGroupOwnership(session, submission.group_id as string);

    // Fotos de los alumnos del grupo para este reto.
    const { data: studentSubs, error } = await supabase
      .from("student_submissions")
      .select(
        "id, students(alias), student_evidence_files(id, file_path, file_type)"
      )
      .eq("group_id", submission.group_id)
      .eq("challenge_id", submission.challenge_id);
    if (error) throw error;

    type FileEntry = {
      id: string;
      path: string;
      type: string;
      studentAlias: string | null;
    };
    const files: FileEntry[] = [];
    for (const sub of studentSubs ?? []) {
      const student = Array.isArray(sub.students) ? sub.students[0] : sub.students;
      const alias = (student as { alias: string | null } | null)?.alias ?? null;
      for (const f of sub.student_evidence_files ?? []) {
        files.push({
          id: f.id,
          path: f.file_path,
          type: f.file_type,
          studentAlias: alias
        });
      }
    }

    if (!files.length) return NextResponse.json({ data: [] });

    const { data: signed, error: signError } = await supabase.storage
      .from(BUCKET)
      .createSignedUrls(
        files.map((f) => f.path),
        EXPIRES_IN_SECONDS
      );
    if (signError) throw signError;

    const byPath = new Map<string, string>();
    (signed ?? []).forEach((entry) => {
      if (entry.path && entry.signedUrl) byPath.set(entry.path, entry.signedUrl);
    });

    return NextResponse.json({
      data: files.map((f) => ({
        id: f.id,
        path: f.path,
        type: f.type,
        studentAlias: f.studentAlias,
        signedUrl: byPath.get(f.path) ?? null
      })),
      expiresInSeconds: EXPIRES_IN_SECONDS
    });
  } catch (error) {
    return jsonError(error);
  }
}
