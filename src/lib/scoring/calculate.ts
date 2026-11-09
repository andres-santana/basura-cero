import {
  defaultScoreWeights,
  ScoreWeights,
  timeDecayFactor
} from "@/lib/scoring/rules";

export type SubmissionMetrics = {
  participantsCount: number;
  expectedParticipants: number;
  kgSeparated: number;
  reusedItems: number;
  /** Objetos reciclados reportados (conteo). */
  recycledItems?: number;
  creativityScore: number;
  teamworkScore: number;
  hasEvidenceFile: boolean;
  /**
   * Dias calendario transcurridos desde el start_date del reto hasta la
   * entrega (0 = mismo dia de inicio). Si se omite, se deriva de isOnTime
   * (0 cuando en tiempo, 1 cuando tarde) para mantener compatibilidad con
   * llamadores antiguos.
   */
  daysElapsed?: number;
  isOnTime: boolean;
  /** Proporcion de pasos completados por el grupo (0..1). */
  stepsCompletionRatio?: number;
  /** Proporcion de desempeno del mini-juego (0..1). */
  gamesCompletionRatio?: number;
  /**
   * Suma de los puntos de cada alumno del grupo (pasos + mini-juegos
   * completados) para este reto. Se agrega como bloque aparte, fuera del
   * presupuesto de 100 y sin aplicarle el factor de tiempo.
   */
  studentPointsTotal?: number;
  /**
   * Kg equivalentes del grupo (Fase 2), derivados de las cantidades por
   * material × su peso. Solo se usan para el puntaje de impacto cuando
   * usesMaterialCatalog es true.
   */
  equivalentKg?: number;
  /**
   * true si el experimento tiene catalogo de materiales. En ese caso el
   * impacto se puntua sobre equivalentKg y los conteos sueltos (kg/reutilizados/
   * reciclados) NO suman puntos (se evita el doble conteo). Sin catalogo, se usa
   * el comportamiento de Fase 1.
   */
  usesMaterialCatalog?: boolean;
};

export type ScoreResult = {
  pointsTotal: number;
  breakdown: Record<string, number>;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function calculateScore(
  metrics: SubmissionMetrics,
  weights: ScoreWeights = defaultScoreWeights
): ScoreResult {
  const participationPct =
    metrics.expectedParticipants > 0
      ? (metrics.participantsCount / metrics.expectedParticipants) * 100
      : 0;

  const participationPoints = clamp(Math.round(participationPct / 10), 0, weights.participationMax);

  // Bloque de IMPACTO. Dos modos:
  // - Con catalogo de materiales (Fase 2): se puntua sobre kg equivalentes
  //   (0.5 pt/kg eq, hasta equivalentKgMax). Los conteos sueltos NO suman
  //   puntos para no contar doble.
  // - Sin catalogo (fallback Fase 1): kg separados (0.5 pt/kg) + reutilizados
  //   + reciclados, cada uno con su tope.
  const usesCatalog = metrics.usesMaterialCatalog === true;

  const equivalentKgPoints = usesCatalog
    ? clamp(Math.round((metrics.equivalentKg ?? 0) * 0.5 * 10) / 10, 0, weights.equivalentKgMax)
    : 0;
  const wasteReductionPoints = usesCatalog
    ? 0
    : clamp(Math.round(metrics.kgSeparated * 0.5 * 10) / 10, 0, weights.wasteReductionMax);
  const reusePoints = usesCatalog ? 0 : clamp(metrics.reusedItems, 0, weights.reusedItemsMax);
  const recyclePoints = usesCatalog
    ? 0
    : clamp(metrics.recycledItems ?? 0, 0, weights.recycledItemsMax);
  const experimentPoints = weights.experimentCompleted;
  const evidencePoints = metrics.hasEvidenceFile ? weights.evidenceComplete : 0;

  const stepsRatio = clamp(metrics.stepsCompletionRatio ?? 0, 0, 1);
  const gamesRatio = clamp(metrics.gamesCompletionRatio ?? 0, 0, 1);
  const stepsPoints = Math.round(stepsRatio * weights.stepsMax);
  const gamesPoints = Math.round(gamesRatio * weights.gamesMax);

  const subtotal =
    experimentPoints +
    evidencePoints +
    stepsPoints +
    gamesPoints +
    participationPoints +
    equivalentKgPoints +
    wasteReductionPoints +
    reusePoints +
    recyclePoints;

  // Factor por tiempo de respuesta (dias desde el inicio del reto). Solo aplica
  // al puntaje base del grupo (tope 100).
  const daysElapsed = metrics.daysElapsed ?? (metrics.isOnTime ? 0 : 1);
  const factor = timeDecayFactor(daysElapsed);

  const basePoints = clamp(Math.round(subtotal * factor), 0, 100);

  // Puntos de alumnos (pasos + mini-juegos completados): se suman aparte, sin
  // tope de 100 y sin factor de tiempo, para diferenciar el esfuerzo real del
  // equipo. Pueden llevar el total por encima de 100.
  const studentPoints = Math.max(0, Math.round(metrics.studentPointsTotal ?? 0));

  const pointsTotal = basePoints + studentPoints;

  return {
    pointsTotal,
    breakdown: {
      experimentCompleted: experimentPoints,
      evidenceComplete: evidencePoints,
      steps: stepsPoints,
      games: gamesPoints,
      participation: participationPoints,
      equivalentKg: equivalentKgPoints,
      // wasteReduction puntua los KG SEPARADOS reportados (0.5 pt/kg, tope
      // wasteReductionMax). El nombre es historico; no usa
      // waste_reduced_estimate.
      wasteReduction: wasteReductionPoints,
      reusedItems: reusePoints,
      recycledItems: recyclePoints,
      usesMaterialCatalog: usesCatalog ? 1 : 0,
      subtotal,
      daysElapsed,
      timeFactor: factor,
      basePoints,
      studentPoints
    }
  };
}
