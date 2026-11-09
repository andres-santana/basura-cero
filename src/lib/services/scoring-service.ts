import { calculateScore, SubmissionMetrics } from "@/lib/scoring/calculate";
import { evaluateUnlockedBadges } from "@/lib/scoring/badges";
import { createServerSupabase } from "@/lib/supabase/server";

type BadgeInput = {
  totalKgSeparated: number;
  completedWeeks: number;
  consecutiveWeeks: number;
  compostWeeks: number;
  avgParticipation: number;
  onTimeSubmissions: number;
  isTop3Monthly: boolean;
  isTop1Quarterly: boolean;
};

export async function scoreSubmission(submissionId: string, metrics: SubmissionMetrics) {
  const supabase = createServerSupabase();
  const score = calculateScore(metrics);

  await supabase.from("scores").upsert({
    submission_id: submissionId,
    points_total: score.pointsTotal,
    breakdown_json: score.breakdown
  });

  return score;
}

/**
 * Dias calendario transcurridos desde el INICIO del reto (start_date) hasta la
 * entrega. Compara solo fechas (YYYY-MM-DD). 0 = mismo dia de inicio; negativo
 * (entrega antes del inicio, caso raro) se acota a 0.
 */
export function computeDaysElapsed(startDate: string, submittedAt: string | null): number {
  if (!startDate) return 0;
  const submittedDay = (submittedAt ?? new Date().toISOString()).slice(0, 10);
  const start = Date.parse(`${startDate.slice(0, 10)}T00:00:00Z`);
  const got = Date.parse(`${submittedDay}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(got)) return 0;
  const diffDays = Math.round((got - start) / 86_400_000);
  return diffDays > 0 ? diffDays : 0;
}

/**
 * Agrega el progreso de pasos y mini-juego de los alumnos de un grupo para un
 * reto. Devuelve:
 * - stepsCompletionRatio / gamesCompletionRatio: PROMEDIO ACOTADO (0..1) entre
 *   alumnos activos, para el puntaje base del grupo (no premia grupos grandes).
 * - studentPointsTotal: SUMA de los puntos ganados por cada alumno (pasos
 *   completados x experiment_steps.points + mini-juegos completados x
 *   experiment_games.points). Este total crece con el equipo y se agrega al
 *   score del grupo fuera del tope de 100.
 */
export async function aggregateStudentProgress(
  groupId: string,
  challengeId: string,
  experimentId: string
): Promise<{
  stepsCompletionRatio: number;
  gamesCompletionRatio: number;
  studentPointsTotal: number;
}> {
  const supabase = createServerSupabase();

  const [{ data: students }, { data: steps }, { data: games }] = await Promise.all([
    supabase.from("students").select("id").eq("group_id", groupId).eq("is_active", true),
    supabase.from("experiment_steps").select("id, points").eq("experiment_id", experimentId),
    supabase
      .from("experiment_games")
      .select("id, points")
      .eq("experiment_id", experimentId)
      .eq("is_active", true)
  ]);

  const activeStudents = students ?? [];
  const stepRows = steps ?? [];
  const gameRows = games ?? [];
  const totalSteps = stepRows.length;
  const totalGames = gameRows.length;

  if (activeStudents.length === 0 || (totalSteps === 0 && totalGames === 0)) {
    return { stepsCompletionRatio: 0, gamesCompletionRatio: 0, studentPointsTotal: 0 };
  }

  const studentIds = activeStudents.map((s) => s.id);
  const stepPointsById = new Map<string, number>(
    stepRows.map((s) => [s.id as string, Number(s.points ?? 0)])
  );
  const gamePointsById = new Map<string, number>(
    gameRows.map((g) => [g.id as string, Number(g.points ?? 0)])
  );

  const [{ data: stepProgress }, { data: gameProgress }] = await Promise.all([
    supabase
      .from("student_step_progress")
      .select("student_id, step_id")
      .eq("challenge_id", challengeId)
      .in("student_id", studentIds),
    supabase
      .from("student_game_progress")
      .select("student_id, game_id, completed_at")
      .eq("challenge_id", challengeId)
      .in("student_id", studentIds)
  ]);

  // Pasos: promedio del ratio de pasos completados por alumno, y suma de puntos.
  const stepsByStudent = new Map<string, number>();
  let studentPointsTotal = 0;
  (stepProgress ?? []).forEach((row) => {
    stepsByStudent.set(row.student_id, (stepsByStudent.get(row.student_id) ?? 0) + 1);
    studentPointsTotal += stepPointsById.get(row.step_id) ?? 0;
  });
  const stepsRatioSum = studentIds.reduce((sum, id) => {
    if (totalSteps === 0) return sum;
    return sum + Math.min(1, (stepsByStudent.get(id) ?? 0) / totalSteps);
  }, 0);
  const stepsCompletionRatio = totalSteps === 0 ? 0 : stepsRatioSum / activeStudents.length;

  // Juegos: promedio de "completado" (completed_at no nulo) por alumno, y suma
  // de puntos de los juegos completados.
  const completedGamesByStudent = new Map<string, number>();
  (gameProgress ?? []).forEach((row) => {
    if (row.completed_at) {
      completedGamesByStudent.set(
        row.student_id,
        (completedGamesByStudent.get(row.student_id) ?? 0) + 1
      );
      studentPointsTotal += gamePointsById.get(row.game_id) ?? 0;
    }
  });
  const gamesRatioSum = studentIds.reduce((sum, id) => {
    if (totalGames === 0) return sum;
    return sum + Math.min(1, (completedGamesByStudent.get(id) ?? 0) / totalGames);
  }, 0);
  const gamesCompletionRatio = totalGames === 0 ? 0 : gamesRatioSum / activeStudents.length;

  return { stepsCompletionRatio, gamesCompletionRatio, studentPointsTotal };
}

type GroupSubmissionRow = {
  id: string;
  group_id: string;
  challenge_id: string;
  participants_count: number;
  submitted_at: string | null;
  status: string;
  weekly_challenges:
    | { start_date: string; end_date: string; experiment_id: string }
    | { start_date: string; end_date: string; experiment_id: string }[]
    | null;
  impact_metrics:
    | { kg_separated: number; reused_items: number; recycled_items: number; equivalent_kg: number }
    | { kg_separated: number; reused_items: number; recycled_items: number; equivalent_kg: number }[]
    | null;
  evidence_files: { id: string }[] | null;
};

function pickOne<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

/**
 * Recalcula y persiste el score de una entrega de GRUPO desde el estado actual
 * en BD (metricas, archivos, reto y progreso agregado de alumnos). Fuente de
 * verdad unica usada tanto al enviar (maestro) como al aprobar (admin).
 */
export async function recalcGroupSubmissionScore(submissionId: string): Promise<void> {
  const supabase = createServerSupabase();

  const { data, error } = await supabase
    .from("submissions")
    .select(
      "id, group_id, challenge_id, participants_count, submitted_at, status, weekly_challenges(start_date, end_date, experiment_id), impact_metrics(kg_separated, reused_items, recycled_items, equivalent_kg), evidence_files(id)"
    )
    .eq("id", submissionId)
    .maybeSingle();

  if (error) throw error;
  const row = data as GroupSubmissionRow | null;
  if (!row) return;

  const challenge = pickOne(row.weekly_challenges);
  const metrics = pickOne(row.impact_metrics);
  const groupFilesCount = Array.isArray(row.evidence_files) ? row.evidence_files.length : 0;

  // La evidencia del grupo puede estar formada por fotos subidas por los
  // alumnos (student_evidence_files), que no viven en evidence_files. Contamos
  // ambas fuentes para no perder el componente "evidencia" del puntaje cuando
  // la entrega del grupo se deriva de las evidencias de alumnos.
  const studentFilesCount = await countStudentEvidenceFiles(
    row.group_id,
    row.challenge_id
  );
  const filesCount = groupFilesCount + studentFilesCount;

  const daysElapsed = challenge ? computeDaysElapsed(challenge.start_date, row.submitted_at) : 0;

  // Participacion esperada = tamano del grupo (alumnos activos). El bloque de
  // participacion mide que proporcion del grupo participo, por lo que el
  // denominador debe ser el total de alumnos, no los participantes reportados
  // (que, de usarse, darian siempre 100%). Si el grupo no tiene alumnos
  // registrados, se cae al conteo reportado para no romper el calculo.
  const activeStudentsCount = await countActiveStudents(row.group_id);
  const expectedParticipants =
    activeStudentsCount > 0 ? activeStudentsCount : Math.max(row.participants_count ?? 0, 1);

  const progress = challenge
    ? await aggregateStudentProgress(row.group_id, row.challenge_id, challenge.experiment_id)
    : { stepsCompletionRatio: 0, gamesCompletionRatio: 0, studentPointsTotal: 0 };

  // Fase 2: si el experimento tiene catalogo de materiales activos, el impacto
  // se puntua sobre kg equivalentes (equivalent_kg) y NO sobre los conteos
  // sueltos, para no contar doble. Sin catalogo, se usa el fallback de Fase 1.
  const usesMaterialCatalog = challenge
    ? await experimentHasMaterials(challenge.experiment_id)
    : false;

  await scoreSubmission(submissionId, {
    participantsCount: row.participants_count ?? 0,
    expectedParticipants,
    kgSeparated: Number(metrics?.kg_separated ?? 0),
    reusedItems: Number(metrics?.reused_items ?? 0),
    recycledItems: Number(metrics?.recycled_items ?? 0),
    equivalentKg: Number(metrics?.equivalent_kg ?? 0),
    usesMaterialCatalog,
    creativityScore: 0,
    teamworkScore: 0,
    hasEvidenceFile: filesCount > 0,
    daysElapsed,
    isOnTime: daysElapsed === 0,
    stepsCompletionRatio: progress.stepsCompletionRatio,
    gamesCompletionRatio: progress.gamesCompletionRatio,
    studentPointsTotal: progress.studentPointsTotal
  });

  // Tras recalcular el score, reevalua las insignias del grupo para que el
  // ranking y la vista de insignias queden consistentes.
  await assignBadgesForGroup(row.group_id).catch(() => {
    /* las insignias son best-effort: no deben romper el guardado del score */
  });
}

/**
 * Indica si un experimento tiene al menos un material activo en su catalogo
 * (Fase 2). Determina si el impacto se puntua por kg equivalentes o por el
 * fallback de conteos (Fase 1).
 */
/**
 * Cuenta los alumnos activos de un grupo. Se usa como "participacion esperada"
 * (denominador del bloque de participacion), de modo que el puntaje refleje que
 * proporcion del grupo participo en el reto.
 */
async function countActiveStudents(groupId: string): Promise<number> {
  const supabase = createServerSupabase();
  const { count, error } = await supabase
    .from("students")
    .select("id", { count: "exact", head: true })
    .eq("group_id", groupId)
    .eq("is_active", true);
  if (error) return 0;
  return count ?? 0;
}

async function experimentHasMaterials(experimentId: string): Promise<boolean> {
  const supabase = createServerSupabase();
  const { count, error } = await supabase
    .from("experiment_materials")
    .select("id", { count: "exact", head: true })
    .eq("experiment_id", experimentId)
    .eq("is_active", true);
  if (error) return false;
  return (count ?? 0) > 0;
}

/**
 * Cuenta las fotos de alumnos (student_evidence_files) asociadas a un (grupo,
 * reto). Son la evidencia real cuando la entrega del grupo se arma a partir de
 * las evidencias enviadas por los alumnos.
 */
async function countStudentEvidenceFiles(
  groupId: string,
  challengeId: string
): Promise<number> {
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("student_submissions")
    .select("id, student_evidence_files(id)")
    .eq("group_id", groupId)
    .eq("challenge_id", challengeId)
    .in("status", ["submitted", "approved"]);
  if (error || !data) return 0;
  return data.reduce((sum, row) => {
    const files = (row as { student_evidence_files?: { id: string }[] | null })
      .student_evidence_files;
    return sum + (Array.isArray(files) ? files.length : 0);
  }, 0);
}

/**
 * Reevalua y persiste las insignias de un grupo a partir de sus agregados
 * actuales (kg acumulados, semanas completadas y participacion promedio).
 * Se invoca al recalcular el score para que insignias y ranking reflejen el
 * estado mas reciente.
 */
export async function assignBadgesForGroup(groupId: string): Promise<void> {
  const supabase = createServerSupabase();

  const { data: subs } = await supabase
    .from("submissions")
    .select(
      "id, participants_count, status, impact_metrics(kg_separated), scores(breakdown_json)"
    )
    .eq("group_id", groupId)
    .in("status", ["submitted", "approved"]);

  const rows = subs ?? [];
  let totalKgSeparated = 0;
  let onTimeSubmissions = 0;
  let participationSum = 0;
  let participationCount = 0;

  for (const sub of rows) {
    const metrics = pickOne(
      (sub as { impact_metrics: unknown }).impact_metrics as
        | { kg_separated: number | null }
        | { kg_separated: number | null }[]
        | null
    );
    totalKgSeparated += Number(metrics?.kg_separated ?? 0);

    const score = pickOne(
      (sub as { scores: unknown }).scores as
        | { breakdown_json: Record<string, number> | null }
        | { breakdown_json: Record<string, number> | null }[]
        | null
    );
    // Compat: breakdowns nuevos guardan daysElapsed (dias desde el inicio);
    // los antiguos guardaban daysLate (dias tras end_date). Se considera "en
    // tiempo" cuando la entrega ocurrio dentro de los primeros dias del reto
    // (factor temporal alto) o, para datos antiguos, sin retraso.
    const breakdown = score?.breakdown_json ?? {};
    const daysElapsed = Number(
      breakdown.daysElapsed ?? breakdown.daysLate ?? 0
    );
    if (daysElapsed <= 3) onTimeSubmissions += 1;

    const participants = Number((sub as { participants_count: number | null }).participants_count ?? 0);
    if (participants > 0) {
      participationSum += participants;
      participationCount += 1;
    }
  }

  const completedWeeks = rows.length;
  const avgParticipation = participationCount > 0 ? participationSum / participationCount : 0;

  await assignBadges(groupId, {
    totalKgSeparated,
    completedWeeks,
    consecutiveWeeks: completedWeeks,
    compostWeeks: 0,
    avgParticipation,
    onTimeSubmissions,
    isTop3Monthly: false,
    isTop1Quarterly: false
  });
}

export async function assignBadges(groupId: string, input: BadgeInput) {
  const supabase = createServerSupabase();
  const unlockedCodes = evaluateUnlockedBadges(input);

  if (!unlockedCodes.length) {
    return [];
  }

  const { data: badgeRows } = await supabase.from("badges").select("id, code").in("code", unlockedCodes);
  if (!badgeRows?.length) {
    return [];
  }

  const payload = badgeRows.map((badge) => ({
    group_id: groupId,
    badge_id: badge.id
  }));

  await supabase.from("group_badges").upsert(payload, { onConflict: "group_id,badge_id" });
  return unlockedCodes;
}

/**
 * Recalcula el score (y reevalua insignias) de TODAS las entregas de grupo de
 * una escuela. Util tras cambios en la logica de puntaje o para refrescar
 * datos ya cargados sin tener que reaprobar cada evidencia una por una.
 * Devuelve cuantas entregas se recalcularon.
 */
export async function recalcAllScoresForSchool(schoolId: string): Promise<number> {
  const supabase = createServerSupabase();

  const { data, error } = await supabase
    .from("submissions")
    .select("id, groups!inner(school_id)")
    .eq("groups.school_id", schoolId)
    .in("status", ["submitted", "approved"]);

  if (error) throw error;

  const ids = (data ?? []).map((row) => row.id as string);
  for (const id of ids) {
    await recalcGroupSubmissionScore(id);
  }
  return ids.length;
}
