import { RoleGuard } from "@/components/auth/role-guard";
import { StudentManager } from "@/components/students/student-manager";

export const dynamic = "force-dynamic";

export default function TeacherStudentsPage() {
  return (
    <RoleGuard allow={["teacher", "admin"]}>
      <div className="space-y-8">
        <header>
          <h1 className="text-2xl font-bold text-emerald-700">Mis alumnos</h1>
          <p className="mt-1 text-sm text-slate-600">
            Registra a los alumnos de tus grupos con un apodo y entregales su codigo
            de acceso para que puedan jugar, completar pasos y subir su evidencia.
          </p>
        </header>
        <StudentManager />
      </div>
    </RoleGuard>
  );
}
