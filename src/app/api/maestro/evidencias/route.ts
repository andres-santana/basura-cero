import { NextResponse } from "next/server";
import { jsonError } from "@/lib/auth-admin";
import { requireTeacherWithSchool } from "@/lib/auth-teacher";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  ensureGroupSubmissionsFromStudents,
  type TeacherGroupSubmission
} from "@/lib/services/teacher-evidence";

const VALID_STATUSES = ["draft", "submitted", "approved", "rejected"] as const;
type SubmissionStatus = (typeof VALID_STATUSES)[number];

function parseStatus(value: string | null): SubmissionStatus[] | null {
  if (!value || value === "all") return null;
  const parts = value
    .split(",")
    .map((p) => p.trim())
    .filter((p): p is SubmissionStatus =>
      (VALID_STATUSES as readonly string[]).includes(p)
    );
  return parts.length ? parts : null;
}

/**
 * Lista las evidencias de GRUPO que el maestro puede revisar. Las evidencias
 * de grupo se derivan de las evidencias que enviaron los alumnos: por cada
 * reto con al menos una evidencia de alumno del grupo, se asegura que exista
 * una entrega de grupo (con participantes contados automaticamente) para que
 * el maestro la revise, apruebe o rechace.
 */
export async function GET(request: Request) {
  try {
    const session = await requireTeacherWithSchool();
    const supabase = createServerSupabase();

    const url = new URL(request.url);
    const statuses =
      parseStatus(url.searchParams.get("status")) ??
      (["submitted"] as SubmissionStatus[]);

    // Deriva/asegura las entregas de grupo a partir de las evidencias de
    // alumnos antes de listar, y devuelve ya el listado normalizado.
    const rows: TeacherGroupSubmission[] = await ensureGroupSubmissionsFromStudents(
      supabase,
      { userId: session.userId, role: session.role, schoolId: session.schoolId }
    );

    const filtered = statuses
      ? rows.filter((row) => statuses.includes(row.status))
      : rows;

    return NextResponse.json({ data: filtered });
  } catch (error) {
    return jsonError(error);
  }
}
