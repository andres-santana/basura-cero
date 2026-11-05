import { NextResponse } from "next/server";
import { HttpError, jsonError, requireAdminWithSchool } from "@/lib/auth-admin";
import { createServerSupabase } from "@/lib/supabase/server";

const BUCKET = "evidencias";
const EXPIRES_IN_SECONDS = 600;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAdminWithSchool();
    const { id } = await params;
    const supabase = createServerSupabase();

    const { data: submission } = await supabase
      .from("student_submissions")
      .select(
        "id, group_id, groups(school_id), student_evidence_files(id, file_path, file_type)"
      )
      .eq("id", id)
      .maybeSingle();

    const group = Array.isArray(submission?.groups)
      ? submission?.groups[0]
      : submission?.groups;
    if (!submission || group?.school_id !== session.schoolId) {
      throw new HttpError(404, "Evidencia no encontrada");
    }

    const files = submission.student_evidence_files ?? [];
    if (!files.length) return NextResponse.json({ data: [] });

    const { data: signed, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrls(
        files.map((f) => f.file_path),
        EXPIRES_IN_SECONDS
      );
    if (error) throw error;

    const byPath = new Map<string, string>();
    (signed ?? []).forEach((entry) => {
      if (entry.path && entry.signedUrl) byPath.set(entry.path, entry.signedUrl);
    });

    return NextResponse.json({
      data: files.map((f) => ({
        id: f.id,
        path: f.file_path,
        type: f.file_type,
        signedUrl: byPath.get(f.file_path) ?? null
      })),
      expiresInSeconds: EXPIRES_IN_SECONDS
    });
  } catch (error) {
    return jsonError(error);
  }
}
