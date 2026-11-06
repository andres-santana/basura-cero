import Link from "next/link";
import type { Route } from "next";
import { RoleGuard } from "@/components/auth/role-guard";
import { ProgressRing52Weeks } from "@/components/gamification/progress-ring-52-weeks";
import { BadgeGrid } from "@/components/gamification/badge-grid";
import { getSession } from "@/lib/auth";
import { getCurrentChallengeForSchool } from "@/lib/services/current-challenge";
import { getTeacherDashboardStats } from "@/lib/services/teacher-dashboard";

export const dynamic = "force-dynamic";

export default async function TeacherDashboardPage() {
  const session = await getSession();
  const schoolId = session?.schoolId ?? null;
  const [challenge, stats] = await Promise.all([
    schoolId ? getCurrentChallengeForSchool(schoolId) : Promise.resolve(null),
    getTeacherDashboardStats()
  ]);

  return (
    <RoleGuard allow={["teacher", "admin"]}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-emerald-700">Panel de maestro</h1>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/maestro/alumnos"
              className="rounded-lg border border-emerald-300 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
            >
              Gestionar alumnos
            </Link>
            <Link
              href="/dashboard/maestro/evidencias"
              className="rounded-lg border border-emerald-300 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
            >
              Gestionar evidencias
            </Link>
          </div>
        </div>

        {challenge ? (
          <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
              Reto activo - Semana {challenge.weekNumber}
            </p>
            <h2 className="mt-1 text-xl font-bold text-emerald-900">
              {challenge.title}
            </h2>
            <p className="mt-2 text-sm text-emerald-900">{challenge.objective}</p>
            <p className="mt-2 text-xs text-emerald-700">
              Periodo: {challenge.startDate} a {challenge.endDate}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href={`/experimentos/${challenge.weekNumber}` as Route}
                className="rounded bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                Ver detalle del experimento
              </Link>
              {challenge.printableUrl && (
                <a
                  href={challenge.printableUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded border border-emerald-300 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100"
                >
                  Descargar ficha
                </a>
              )}
            </div>
          </section>
        ) : (
          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <h2 className="text-base font-semibold text-amber-900">
              Aun no hay reto activo
            </h2>
            <p className="mt-2 text-sm text-amber-900">
              Pidele al administrador que active el reto de esta semana desde el
              panel de administracion.
              {session?.role === "admin" && (
                <>
                  {" "}
                  Como admin, puedes hacerlo aqui:{" "}
                  <Link
                    href="/dashboard/admin/semanas"
                    className="font-semibold text-amber-700 underline"
                  >
                    Activacion semanal
                  </Link>
                  .
                </>
              )}
            </p>
          </section>
        )}

        <ProgressRing52Weeks completed={stats.completedWeeks} />
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-emerald-700">Insignias de tus grupos</h2>
          <BadgeGrid badges={stats.badges} />
        </section>
      </div>
    </RoleGuard>
  );
}
