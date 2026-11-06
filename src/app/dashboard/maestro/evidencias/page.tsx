import { RoleGuard } from "@/components/auth/role-guard";
import { TeacherReviewQueue } from "@/components/evidence/teacher-review-queue";
import { StudentEvidenceReview } from "@/components/students/student-evidence-review";

export const dynamic = "force-dynamic";

export default function TeacherEvidencePage() {
  return (
    <RoleGuard allow={["teacher", "admin"]}>
      <div className="space-y-8">
        <header>
          <h1 className="text-2xl font-bold text-emerald-700">Gestionar evidencias</h1>
          <p className="mt-1 text-sm text-slate-600">
            Revisa las evidencias que suben tus alumnos: aprueba o rechaza cada una,
            ajusta los kilos y materiales si hace falta, y valida el total de cada
            grupo.
          </p>
        </header>
        <TeacherReviewQueue />
        <StudentEvidenceReview />
      </div>
    </RoleGuard>
  );
}
