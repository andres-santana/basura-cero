export type ScoreWeights = {
  experimentCompleted: number;
  evidenceComplete: number;
  stepsMax: number;
  gamesMax: number;
  participationMax: number;
  wasteReductionMax: number;
  reusedItemsMax: number;
  recycledItemsMax: number;
  creativityMax: number;
  teamworkMax: number;
};

/**
 * Pesos unificados (fuente de verdad en TS). El maximo bruto suma 100 antes
 * de aplicar el factor temporal. Incluye pasos y mini-juegos (aportes del
 * alumno agregados al grupo).
 *
 * Nota: los puntos sumados de cada alumno (pasos + mini-juegos completados,
 * ver studentPointsTotal) se agregan APARTE, fuera de este presupuesto de 100
 * y sin el factor temporal, para diferenciar grupos por esfuerzo real.
 */
export const defaultScoreWeights: ScoreWeights = {
  experimentCompleted: 20,
  evidenceComplete: 15,
  stepsMax: 15,
  gamesMax: 10,
  participationMax: 10,
  wasteReductionMax: 10,
  reusedItemsMax: 10,
  recycledItemsMax: 10,
  creativityMax: 0,
  teamworkMax: 0
};

/**
 * Curva de ponderacion por TIEMPO DE RESPUESTA del grupo.
 *
 * Se mide por dias calendario transcurridos desde el INICIO del reto
 * (start_date) hasta la fecha de entrega. Entregar el mismo dia que arranca el
 * reto = sin penalizacion (factor 1.0); cada dia que pasa reduce el factor,
 * con un minimo garantizado por entregar. Esto diferencia a grupos que
 * entregaron "a tiempo" pero en dias distintos.
 *
 * daysElapsed = dias calendario desde start_date (0 = mismo dia de inicio).
 */
export const MIN_TIME_FACTOR = 0.5;

export function timeDecayFactor(daysElapsed: number): number {
  if (daysElapsed <= 0) return 1.0;
  if (daysElapsed === 1) return 0.97;
  if (daysElapsed === 2) return 0.94;
  if (daysElapsed === 3) return 0.9;
  if (daysElapsed <= 5) return 0.85;
  if (daysElapsed <= 7) return 0.8;
  if (daysElapsed <= 10) return 0.7;
  if (daysElapsed <= 14) return 0.6;
  return MIN_TIME_FACTOR;
}

export type BadgeRuleCode =
  | "guardian_reciclaje"
  | "super_separador"
  | "heroe_cero_basura"
  | "equipo_compostero"
  | "aula_verde"
  | "reto_cumplido"
  | "impacto_dorado"
  | "grupo_eco_lider";

export type BadgeRule = {
  code: BadgeRuleCode;
  label: string;
  description: string;
  evaluate: (input: BadgeEvaluationInput) => boolean;
};

export type BadgeEvaluationInput = {
  totalKgSeparated: number;
  completedWeeks: number;
  consecutiveWeeks: number;
  compostWeeks: number;
  avgParticipation: number;
  onTimeSubmissions: number;
  isTop3Monthly: boolean;
  isTop1Quarterly: boolean;
};

export const badgeRules: BadgeRule[] = [
  {
    code: "guardian_reciclaje",
    label: "Guardian del Reciclaje",
    description: "3 semanas con evidencia completa",
    evaluate: (input) => input.completedWeeks >= 3
  },
  {
    code: "super_separador",
    label: "Super Separador",
    description: "15kg acumulados separados",
    evaluate: (input) => input.totalKgSeparated >= 15
  },
  {
    code: "heroe_cero_basura",
    label: "Heroe Cero Basura",
    description: "8 semanas consecutivas activas",
    evaluate: (input) => input.consecutiveWeeks >= 8
  },
  {
    code: "equipo_compostero",
    label: "Equipo Compostero",
    description: "5 retos de compostaje completados",
    evaluate: (input) => input.compostWeeks >= 5
  },
  {
    code: "aula_verde",
    label: "Aula Verde",
    description: "Participacion promedio >= 85%",
    evaluate: (input) => input.avgParticipation >= 85
  },
  {
    code: "reto_cumplido",
    label: "Reto Cumplido",
    description: "Entrega semanal en tiempo",
    evaluate: (input) => input.onTimeSubmissions >= 1
  },
  {
    code: "impacto_dorado",
    label: "Impacto Dorado",
    description: "Top 3 mensual",
    evaluate: (input) => input.isTop3Monthly
  },
  {
    code: "grupo_eco_lider",
    label: "Grupo Eco-Lider",
    description: "Top 1 trimestral",
    evaluate: (input) => input.isTop1Quarterly
  }
];
