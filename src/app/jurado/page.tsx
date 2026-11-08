import { ImpactCharts } from "@/components/metrics/impact-charts";
import { LeaderboardTable } from "@/components/gamification/leaderboard-table";
import {
  getGroupRanking,
  resolveRankingSchoolId
} from "@/lib/services/group-ranking";
import { getWeeklyImpactChart } from "@/lib/services/admin-reports";

export const dynamic = "force-dynamic";

export default async function JuryPage() {
  // Acceso publico de solo lectura: si hay sesion con escuela, se filtra por
  // ella; si no, se muestra la clasificacion general (igual que /ranking).
  const schoolId = await resolveRankingSchoolId();

  let rows: Awaited<ReturnType<typeof getGroupRanking>> = [];
  let weekly: Awaited<ReturnType<typeof getWeeklyImpactChart>> = [];
  try {
    rows = await getGroupRanking(schoolId ? { schoolId } : {});
  } catch {
    rows = [];
  }
  if (schoolId) {
    try {
      weekly = await getWeeklyImpactChart(schoolId);
    } catch {
      weekly = [];
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-emerald-700">Vista de jurado</h1>
      <p className="text-sm text-slate-600">
        {schoolId
          ? "Consulta de resultados e impacto en modo solo lectura."
          : "Clasificacion general en modo solo lectura. Inicia sesion como jurado para ver el detalle de impacto de tu escuela."}
      </p>
      <LeaderboardTable rows={rows} />
      {schoolId && <ImpactCharts data={weekly} />}
    </div>
  );
}
