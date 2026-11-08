import { NextResponse } from "next/server";
import { jsonError, requireAdminWithSchool } from "@/lib/auth-admin";
import { createServerSupabase } from "@/lib/supabase/server";

const VALID_STATUSES = ["draft", "submitted", "approved", "rejected"] as const;
type SubmissionStatus = (typeof VALID_STATUSES)[number];

function parseStatusParam(value: string | null): SubmissionStatus[] | null {
  if (!value || value === "all") return null;
  const parts = value
    .split(",")
    .map((p) => p.trim())
    .filter((p): p is SubmissionStatus =>
      (VALID_STATUSES as readonly string[]).includes(p)
    );
  return parts.length ? parts : null;
}

export async function GET(request: Request) {
  try {
    const session = await requireAdminWithSchool();
    const supabase = createServerSupabase();

    const url = new URL(request.url);
    const statuses =
      parseStatusParam(url.searchParams.get("status")) ?? (["submitted"] as SubmissionStatus[]);

    let query = supabase
      .from("submissions")
      .select(
        `id, comments, participants_count, status, submitted_at, group_id, challenge_id,
         groups!inner(name, grade, school_id),
         weekly_challenges(start_date, end_date, experiments(week_number, title, objective)),
         evidence_files(id, file_path, file_type),
         impact_metrics(kg_separated, reused_items, recycled_items, waste_reduced_estimate),
         scores(points_total, breakdown_json)`
      )
      .eq("groups.school_id", session.schoolId)
      .order("submitted_at", { ascending: false })
      .limit(100);

    if (statuses) {
      query = query.in("status", statuses);
    }

    const { data, error } = await query;
    if (error) throw error;

    // Las fotos de la evidencia del grupo pueden provenir de las evidencias de
    // los alumnos (student_evidence_files). Contamos esas fotos por (grupo,
    // reto) para que el conteo "N archivo(s)" no muestre 0 cuando los alumnos
    // si adjuntaron archivos.
    const groupIds = Array.from(new Set((data ?? []).map((r) => r.group_id)));
    const challengeIds = Array.from(new Set((data ?? []).map((r) => r.challenge_id)));
    const studentFilesByKey = new Map<string, number>();
    if (groupIds.length && challengeIds.length) {
      const { data: studentSubs } = await supabase
        .from("student_submissions")
        .select("group_id, challenge_id, status, student_evidence_files(id)")
        .in("group_id", groupIds)
        .in("challenge_id", challengeIds)
        .in("status", ["submitted", "approved"]);
      for (const sub of studentSubs ?? []) {
        const key = `${sub.group_id}:${sub.challenge_id}`;
        const files = (sub as { student_evidence_files?: { id: string }[] | null })
          .student_evidence_files;
        const count = Array.isArray(files) ? files.length : 0;
        studentFilesByKey.set(key, (studentFilesByKey.get(key) ?? 0) + count);
      }
    }

    return NextResponse.json({
      data: (data ?? []).map((row) => {
        const groups = Array.isArray(row.groups) ? row.groups[0] : row.groups;
        const challenge = Array.isArray(row.weekly_challenges)
          ? row.weekly_challenges[0]
          : row.weekly_challenges;
        const experiment = Array.isArray(challenge?.experiments)
          ? challenge?.experiments[0]
          : challenge?.experiments;
        const metrics = Array.isArray(row.impact_metrics)
          ? row.impact_metrics[0]
          : row.impact_metrics;
        const score = Array.isArray(row.scores) ? row.scores[0] : row.scores;

        return {
          id: row.id,
          status: row.status,
          submittedAt: row.submitted_at,
          comments: row.comments,
          participantsCount: row.participants_count,
          group: {
            id: row.group_id,
            name: groups?.name ?? null,
            grade: groups?.grade ?? null
          },
          challenge: {
            id: row.challenge_id,
            startDate: challenge?.start_date ?? null,
            endDate: challenge?.end_date ?? null,
            weekNumber: experiment?.week_number ?? null,
            title: experiment?.title ?? null,
            objective: experiment?.objective ?? null
          },
          metrics: {
            kgSeparated: Number(metrics?.kg_separated ?? 0),
            reusedItems: Number(metrics?.reused_items ?? 0),
            recycledItems: Number(metrics?.recycled_items ?? 0),
            wasteReducedEstimate: Number(metrics?.waste_reduced_estimate ?? 0)
          },
          score: score
            ? {
                pointsTotal: score.points_total,
                breakdown: score.breakdown_json
              }
            : null,
          files: (row.evidence_files ?? []).map((f) => ({
            id: f.id,
            path: f.file_path,
            type: f.file_type
          })),
          // Conteo real = archivos del grupo + fotos de los alumnos del reto.
          filesCount:
            (row.evidence_files ?? []).length +
            (studentFilesByKey.get(`${row.group_id}:${row.challenge_id}`) ?? 0)
        };
      })
    });
  } catch (error) {
    return jsonError(error);
  }
}
