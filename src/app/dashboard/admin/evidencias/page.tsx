import { RoleGuard } from "@/components/auth/role-guard";
import { AdminReviewQueue } from "@/components/admin/admin-review-queue";
import { AdminStudentEvidence } from "@/components/admin/admin-student-evidence";
import { RecalcScoresButton } from "@/components/admin/recalc-scores-button";

export default async function AdminEvidencePage() {
  return (
    <RoleGuard allow={["admin"]}>
      <div className="space-y-10">
        <section className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-emerald-700">Revision de evidencias</h1>
              <p className="text-sm text-slate-500">
                Evidencias de grupo enviadas por los maestros.
              </p>
            </div>
            <RecalcScoresButton />
          </div>
          <AdminReviewQueue />
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-bold text-emerald-700">
              Evidencias de alumnos por maestro
            </h2>
            <p className="text-sm text-slate-500">
              Avance de las evidencias enviadas por los alumnos, agrupadas por maestro y
              grupo, para dar seguimiento a las revisiones pendientes.
            </p>
          </div>
          <AdminStudentEvidence />
        </section>
      </div>
    </RoleGuard>
  );
}
