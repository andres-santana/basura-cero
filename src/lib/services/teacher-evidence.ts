import type { SupabaseClient } from "@supabase/supabase-js";
import type { Role } from "@/lib/types";
import { recalcGroupSubmissionScore } from "@/lib/services/scoring-service";

export type GroupSubmissionStatus = "draft" | "submitted" | "approved" | "rejected";

export type TeacherGroupSubmission = {
  id: string;
  status: GroupSubmissionStatus;
  submittedAt: string | null;
  comments: string | null;
  group: { id: string; name: string | null; grade: string | null };
  challenge: {
    id: string;
    weekNumber: number | null;
    title: string | null;
    endDate: string | null;
  };
  /** Participantes contados automaticamente: alumnos del grupo que enviaron. */
  participantsCount: number;
  /** Metricas del grupo. Por defecto suman lo reportado por los alumnos; el
   *  maestro puede ajustarlas al revisar. */
  metrics: { kgSeparated: number; reusedItems: number };
  /** Totales derivados de alumnos (referencia para el maestro). */
  studentTotals: {
    participants: number;
    kgSeparated: number;
    reusedItems: number;
  };
  /** Numero de fotos de alumnos asociadas al reto en este grupo. */
  filesCount: number;
};

export type TeacherSessionLike = {
  userId: string;
  role: Role;
  schoolId: string;
};

type StudentSubmissionRow = {
  id: string;
  challenge_id: string;
  group_id: string;
  status: GroupSubmissionStatus;
  submitted_at: string | null;
  kg_separated: number | null;
  reused_items: number | null;
  student_evidence_files: { id: string }[] | null;
  groups:
    | { name: string | null; grade: string | null; school_id: string; teachers: { user_id: string } | { user_id: string }[] | null }
    | { name: string | null; grade: string | null; school_id: string; teachers: { user_id: string } | { user_id: string }[] | null }[]
    | null;
  weekly_challenges:
    | { end_date: string | null; experiments: { week_number: number; title: string } | { week_number: number; title: string }[] | null }
    | { end_date: string | null; experiments: { week_number: number; title: string } | { week_number: number; title: string }[] | null }[]
    | null;
};

function pickOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

type DerivedKey = string; // `${groupId}:${challengeId}`

type DerivedAggregate = {
  groupId: string;
  challengeId: string;
  groupName: string | null;
  groupGrade: string | null;
  weekNumber: number | null;
  title: string | null;
  endDate: string | null;
  /** Alumnos que enviaron evidencia (status != draft) = participantes. */
  participants: number;
  kgSeparated: number;
  reusedItems: number;
  filesCount: number;
  /** submitted_at mas reciente entre las evidencias de alumnos. */
  latestSubmittedAt: string | null;
};

/**
 * Agrupa las evidencias de alumnos por (grupo, reto) y suma participantes,
 * kg separados, materiales reutilizados y fotos. Solo cuentan evidencias
 * efectivamente enviadas (no borradores) para los totales de impacto.
 */
function aggregateStudentRows(rows: StudentSubmissionRow[]): Map<DerivedKey, DerivedAggregate> {
  const map = new Map<DerivedKey, DerivedAggregate>();

  for (const row of rows) {
    const group = pickOne(row.groups);
    const challenge = pickOne(row.weekly_challenges);
    const experiment = pickOne(challenge?.experiments ?? null);
    const key = `${row.group_id}:${row.challenge_id}`;

    const existing =
      map.get(key) ??
      ({
        groupId: row.group_id,
        challengeId: row.challenge_id,
        groupName: group?.name ?? null,
        groupGrade: group?.grade ?? null,
        weekNumber: experiment?.week_number ?? null,
        title: experiment?.title ?? null,
        endDate: challenge?.end_date ?? null,
        participants: 0,
        kgSeparated: 0,
        reusedItems: 0,
        filesCount: 0,
        latestSubmittedAt: null
      } satisfies DerivedAggregate);

    const counts = row.status !== "draft";
    if (counts) {
      existing.participants += 1;
      existing.kgSeparated += Number(row.kg_separated ?? 0);
      existing.reusedItems += Number(row.reused_items ?? 0);
    }
    existing.filesCount += Array.isArray(row.student_evidence_files)
      ? row.student_evidence_files.length
      : 0;

    if (row.submitted_at) {
      if (!existing.latestSubmittedAt || row.submitted_at > existing.latestSubmittedAt) {
        existing.latestSubmittedAt = row.submitted_at;
      }
    }

    map.set(key, existing);
  }

  return map;
}

/**
 * Asegura que exista una entrega de GRUPO por cada (grupo, reto) con evidencia
 * de alumnos, derivando participantes y metricas de impacto a partir de lo que
 * reportaron los alumnos. Devuelve el listado normalizado para el panel del
 * maestro. No sobre-escribe metricas ni estado si el maestro ya ajusto la
 * entrega de grupo (status approved/rejected o metricas ya guardadas).
 */
export async function ensureGroupSubmissionsFromStudents(
  supabase: SupabaseClient,
  session: TeacherSessionLike
): Promise<TeacherGroupSubmission[]> {
  // 1. Trae todas las evidencias de alumnos de la escuela (filtradas por
  //    maestro si no es admin).
  const { data: studentData, error: studentError } = await supabase
    .from("student_submissions")
    .select(
      `id, challenge_id, group_id, status, submitted_at, kg_separated, reused_items,
       student_evidence_files(id),
       groups!inner(name, grade, school_id, teachers(user_id)),
       weekly_challenges(end_date, experiments(week_number, title))`
    )
    .eq("groups.school_id", session.schoolId);
  if (studentError) throw studentError;

  const rows = (studentData ?? []) as unknown as StudentSubmissionRow[];
  const scoped = rows.filter((row) => {
    if (session.role === "admin") return true;
    const group = pickOne(row.groups);
    const teacher = pickOne(group?.teachers ?? null);
    return teacher?.user_id === session.userId;
  });

  const aggregates = aggregateStudentRows(scoped);
  if (aggregates.size === 0) return [];

  // 2. Carga las entregas de grupo ya existentes para esos (grupo, reto).
  const groupIds = Array.from(new Set(Array.from(aggregates.values()).map((a) => a.groupId)));
  const challengeIds = Array.from(
    new Set(Array.from(aggregates.values()).map((a) => a.challengeId))
  );

  const { data: existingSubs, error: existingError } = await supabase
    .from("submissions")
    .select(
      "id, group_id, challenge_id, status, comments, submitted_at, participants_count, impact_metrics(kg_separated, reused_items)"
    )
    .in("group_id", groupIds)
    .in("challenge_id", challengeIds);
  if (existingError) throw existingError;

  const existingByKey = new Map<
    DerivedKey,
    {
      id: string;
      status: GroupSubmissionStatus;
      comments: string | null;
      submitted_at: string | null;
      participants_count: number | null;
      metrics: { kg_separated: number | null; reused_items: number | null } | null;
    }
  >();
  for (const sub of existingSubs ?? []) {
    const metrics = pickOne(
      (sub as { impact_metrics: unknown }).impact_metrics as
        | { kg_separated: number | null; reused_items: number | null }
        | { kg_separated: number | null; reused_items: number | null }[]
        | null
    );
    existingByKey.set(`${sub.group_id}:${sub.challenge_id}`, {
      id: sub.id,
      status: sub.status,
      comments: sub.comments,
      submitted_at: sub.submitted_at,
      participants_count: sub.participants_count,
      metrics
    });
  }

  const result: TeacherGroupSubmission[] = [];

  // 3. Por cada agregado, crea o actualiza la entrega de grupo derivada.
  for (const agg of aggregates.values()) {
    const key: DerivedKey = `${agg.groupId}:${agg.challengeId}`;
    const existing = existingByKey.get(key);

    // El maestro ya decidio sobre esta entrega: respetamos su estado y metricas.
    const teacherLocked =
      existing && (existing.status === "approved" || existing.status === "rejected");

    if (teacherLocked) {
      result.push(toTeacherSubmission(existing, agg));
      continue;
    }

    // Upsert de la entrega de grupo con participantes automaticos. Metricas:
    // si el maestro aun no ajusto, se siembran con la suma de alumnos.
    const { data: upserted, error: upsertError } = await supabase
      .from("submissions")
      .upsert(
        {
          challenge_id: agg.challengeId,
          group_id: agg.groupId,
          submitted_by: session.userId,
          comments: existing?.comments ?? null,
          participants_count: agg.participants,
          status: existing?.status ?? "submitted",
          submitted_at: agg.latestSubmittedAt ?? new Date().toISOString()
        },
        { onConflict: "challenge_id,group_id" }
      )
      .select("id, status, comments, submitted_at, participants_count")
      .single();
    if (upsertError) throw upsertError;

    // Metricas del grupo: sembrar con la suma de alumnos (el maestro puede
    // ajustarlas despues via PATCH, que las marca como override).
    await supabase.from("impact_metrics").upsert(
      {
        submission_id: upserted.id,
        kg_separated: agg.kgSeparated,
        reused_items: agg.reusedItems,
        waste_reduced_estimate: agg.kgSeparated
      },
      { onConflict: "submission_id" }
    );

    // Recalcula el score con los nuevos participantes/metricas.
    await recalcGroupSubmissionScore(upserted.id);

    result.push(
      toTeacherSubmission(
        {
          id: upserted.id,
          status: upserted.status as GroupSubmissionStatus,
          comments: upserted.comments,
          submitted_at: upserted.submitted_at,
          participants_count: upserted.participants_count,
          metrics: { kg_separated: agg.kgSeparated, reused_items: agg.reusedItems }
        },
        agg
      )
    );
  }

  // Orden: mas reciente primero.
  result.sort((a, b) => {
    const av = a.submittedAt ?? "";
    const bv = b.submittedAt ?? "";
    return av < bv ? 1 : av > bv ? -1 : 0;
  });

  return result;
}

function toTeacherSubmission(
  existing: {
    id: string;
    status: GroupSubmissionStatus;
    comments: string | null;
    submitted_at: string | null;
    participants_count: number | null;
    metrics: { kg_separated: number | null; reused_items: number | null } | null;
  },
  agg: DerivedAggregate
): TeacherGroupSubmission {
  return {
    id: existing.id,
    status: existing.status,
    submittedAt: existing.submitted_at,
    comments: existing.comments,
    group: { id: agg.groupId, name: agg.groupName, grade: agg.groupGrade },
    challenge: {
      id: agg.challengeId,
      weekNumber: agg.weekNumber,
      title: agg.title,
      endDate: agg.endDate
    },
    participantsCount: existing.participants_count ?? agg.participants,
    metrics: {
      kgSeparated: Number(existing.metrics?.kg_separated ?? agg.kgSeparated),
      reusedItems: Number(existing.metrics?.reused_items ?? agg.reusedItems)
    },
    studentTotals: {
      participants: agg.participants,
      kgSeparated: agg.kgSeparated,
      reusedItems: agg.reusedItems
    },
    filesCount: agg.filesCount
  };
}
