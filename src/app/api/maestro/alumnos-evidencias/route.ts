import { NextResponse } from "next/server";
import { jsonError } from "@/lib/auth-admin";
import { requireTeacherWithSchool } from "@/lib/auth-teacher";
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
    const session = await requireTeacherWithSchool();
    const supabase = createServerSupabase();

    const url = new URL(request.url);
    const statuses = parseStatus(url.searchParams.get("status")) ?? (["submitted"] as StudentStatus[]);
    const groupId = url.searchParams.get("groupId");

    let query = supabase
      .from("student_submissions")
      .select(
        `id, comments, status, submitted_at, student_id, group_id, kg_separated, reused_items,
         students!inner(alias, grade),
         groups!inner(name, grade, school_id, teachers(user_id)),
         weekly_challenges(experiments(week_number, title)),
         student_evidence_files(id)`
      )
      .eq("groups.school_id", session.schoolId)
      .order("submitted_at", { ascending: false })
      .limit(100);

    if (statuses) query = query.in("status", statuses);
    if (groupId) query = query.eq("group_id", groupId);

    const { data, error } = await query;
    if (error) throw error;

    const rows = (data ?? []).filter((row) => {
      if (session.role === "admin") return true;
      const group = Array.isArray(row.groups) ? row.groups[0] : row.groups;
      const teacher = Array.isArray(group?.teachers) ? group?.teachers[0] : group?.teachers;
      return teacher?.user_id === session.userId;
    });

    return NextResponse.json({
      data: rows.map((row) => {
        const student = Array.isArray(row.students) ? row.students[0] : row.students;
        const group = Array.isArray(row.groups) ? row.groups[0] : row.groups;
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
          kgSeparated: Number(row.kg_separated ?? 0),
          reusedItems: Number(row.reused_items ?? 0),
          student: { alias: student?.alias ?? "?", grade: student?.grade ?? null },
          group: { id: row.group_id, name: group?.name ?? null },
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
