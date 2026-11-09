import { NextResponse } from "next/server";
import { HttpError, jsonError, requireAdminWithSchool } from "@/lib/auth-admin";
import { createServerSupabase } from "@/lib/supabase/server";
import { signEvidenceFiles } from "@/lib/supabase/evidence-urls";

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

    const rawFiles = submission.student_evidence_files ?? [];
    if (!rawFiles.length) return NextResponse.json({ data: [] });

    const signed = await signEvidenceFiles(
      supabase,
      BUCKET,
      rawFiles.map((f) => ({ id: f.id, path: f.file_path, type: f.file_type })),
      EXPIRES_IN_SECONDS
    );

    return NextResponse.json({
      data: signed.map((f) => ({
        id: f.id,
        path: f.path,
        type: f.type,
        signedUrl: f.signedUrl
      })),
      expiresInSeconds: EXPIRES_IN_SECONDS
    });
  } catch (error) {
    return jsonError(error);
  }
}
