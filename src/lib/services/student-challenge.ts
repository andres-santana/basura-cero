import { createServerSupabase } from "@/lib/supabase/server";
import type { StudentSession } from "@/lib/auth-student";

export type StudentStep = {
  id: string;
  order: number;
  title: string;
  description: string;
  points: number;
  completed: boolean;
};

export type StudentGame = {
  id: string;
  type: "relacionar" | "clasificar" | "arrastrar";
  title: string;
  points: number;
  config: unknown;
  completed: boolean;
  score: number;
};

export type StudentMaterial = {
  id: string;
  label: string;
  unitLabel: string;
  kind: "separado" | "reutilizado" | "reciclado";
};

export type StudentChallengeView = {
  challenge: {
    id: string;
    startDate: string;
    endDate: string;
    weekNumber: number;
    title: string;
    objective: string;
  } | null;
  experimentId: string | null;
  steps: StudentStep[];
  game: StudentGame | null;
  student: { alias: string };
};

type GameType = StudentGame["type"];

/**
 * Ensambla la vista del reto actual para un alumno: reto del grupo, pasos del
 * experimento con su progreso, y el mini-juego (si existe) con su progreso.
 * Todo server-side con service role tras requireStudentSession().
 */
export async function getStudentChallengeView(
  session: StudentSession
): Promise<StudentChallengeView> {
  const supabase = createServerSupabase();

  const { data: studentRow } = await supabase
    .from("students")
    .select("alias")
    .eq("id", session.studentId)
    .maybeSingle();
  const student = { alias: studentRow?.alias ?? "" };

  const { data: challengeRow } = await supabase
    .from("weekly_challenges")
    .select(
      "id, start_date, end_date, experiment_id, experiments(week_number, title, objective)"
    )
    .eq("school_id", session.schoolId)
    .eq("is_current", true)
    .maybeSingle();

  if (!challengeRow) {
    return { challenge: null, experimentId: null, steps: [], game: null, student };
  }

  const exp = Array.isArray(challengeRow.experiments)
    ? challengeRow.experiments[0]
    : challengeRow.experiments;
  const experimentId = challengeRow.experiment_id as string;
  const challengeId = challengeRow.id as string;

  const [{ data: steps }, { data: games }, { data: stepProgress }, { data: gameProgress }] =
    await Promise.all([
      supabase
        .from("experiment_steps")
        .select("id, step_order, title, description, points")
        .eq("experiment_id", experimentId)
        .order("step_order", { ascending: true }),
      supabase
        .from("experiment_games")
        .select("id, type, title, points, config_json")
        .eq("experiment_id", experimentId)
        .eq("is_active", true)
        .order("created_at", { ascending: true })
        .limit(1),
      supabase
        .from("student_step_progress")
        .select("step_id")
        .eq("student_id", session.studentId)
        .eq("challenge_id", challengeId),
      supabase
        .from("student_game_progress")
        .select("game_id, score, completed_at")
        .eq("student_id", session.studentId)
        .eq("challenge_id", challengeId)
    ]);

  const completedSteps = new Set((stepProgress ?? []).map((r) => r.step_id));
  const stepsView: StudentStep[] = (steps ?? []).map((s) => ({
    id: s.id,
    order: s.step_order,
    title: s.title,
    description: s.description,
    points: s.points,
    completed: completedSteps.has(s.id)
  }));

  const gameRow = (games ?? [])[0] ?? null;
  let game: StudentGame | null = null;
  if (gameRow) {
    const progress = (gameProgress ?? []).find((g) => g.game_id === gameRow.id);
    game = {
      id: gameRow.id,
      type: gameRow.type as GameType,
      title: gameRow.title,
      points: gameRow.points,
      config: gameRow.config_json,
      completed: Boolean(progress?.completed_at),
      score: progress?.score ?? 0
    };
  }

  return {
    challenge: {
      id: challengeId,
      startDate: challengeRow.start_date,
      endDate: challengeRow.end_date,
      weekNumber: exp?.week_number ?? 0,
      title: exp?.title ?? "",
      objective: exp?.objective ?? ""
    },
    experimentId,
    steps: stepsView,
    game,
    student
  };
}
