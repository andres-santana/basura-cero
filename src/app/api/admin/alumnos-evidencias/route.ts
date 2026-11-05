import { NextResponse } from "next/server";
import { jsonError, requireAdminWithSchool } from "@/lib/auth-admin";
import { createServerSupabase } from "@/lib/supabase/server";

const VALID_STATUSES = ["draft", "submitted", "approved", "rejected"] as const;
type StudentStatus = (typeof VALID_STATUSES)[number];

function parseStatus(value: string | null): StudentStatus[] | null {
  if (!value || value === "all") return null;
  const parts = value
    .split(",")
    .map((p) => p.trim())
    .filter((p): p is StudentStatus => (VALID_STATUSES as readonly string[]).includes(p));
  return parts.length ? parts : null;
}

export async function GET(request: Request) {
  try {
    const session = await requireAdminWithSchool();
    const supabase = createServerSupabase();

    const url = new URL(request.url);
    const statuses = parseStatus(url.searchParams.get("status")); // null => todos los estados
    const groupId = url.searchParams.get("groupId");

    let query = supabase
      .from("student_submissions")
      .select(
        `id, comments, status, submitted_at, student_id, group_id,
         students!inner(alias, grade),
         groups!inner(name, grade, school_id, teacher_id, teachers(full_name, user_id)),
         weekly_challenges(experiments(week_number, title)),
         student_evidence_files(id)`
      )
      .eq("groups.school_id", session.schoolId)
      .order("submitted_at", { ascending: false })
      .limit(500);

    if (statuses) query = query.in("status", statuses);
    if (groupId) query = query.eq("group_id", groupId);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({
      data: (data ?? []).map((row) => {
        const student = Array.isArray(row.students) ? row.students[0] : row.students;
        const group = Array.isArray(row.groups) ? row.groups[0] : row.groups;
        const teacher = Array.isArray(group?.teachers)
          ? group?.teachers[0]
          : group?.teachers;
        const challenge = Array.isArray(row.weekly_challenges)
          ? row.weekly_challenges[0]
          : row.weekly_challenges;
        const experiment = Array.isArray(challenge?.experiments)
          ? challenge?.experiments[0]
          : challenge?.experiments;
        return {
          id: row.id,
          status: row.status,
          submittedAt: row.submitted_at,
          comments: row.comments,
          student: { alias: student?.alias ?? "?", grade: student?.grade ?? null },
          group: {
            id: row.group_id,
            name: group?.name ?? null,
            grade: group?.grade ?? null
          },
          teacher: {
            id: group?.teacher_id ?? null,
            name: teacher?.full_name ?? null
          },
          weekNumber: experiment?.week_number ?? null,
          experimentTitle: experiment?.title ?? null,
          filesCount: Array.isArray(row.student_evidence_files)
            ? row.student_evidence_files.length
            : 0
        };
      })
    });
  } catch (error) {
    return jsonError(error);
  }
}
