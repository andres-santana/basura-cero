import Link from "next/link";
import type { Role } from "@/lib/types";

type Props = {
  role: Extract<Role, "teacher" | "admin">;
};

/**
 * Aviso para maestros/admin en la pagina publica del experimento. Ya no suben
 * evidencia aqui: las fotos las suben los alumnos y la revision (ver, aprobar,
 * rechazar, ajustar kg/materiales) se hace desde el panel.
 */
export function EvidenceTeacherNotice({ role }: Props) {
  const href = role === "admin" ? "/dashboard/admin/evidencias" : "/dashboard/maestro";

  return (
    <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
      <h3 className="text-lg font-bold text-emerald-800">Evidencias del reto</h3>
      <p className="mt-2 text-sm text-emerald-900">
        Las evidencias las suben los alumnos con sus fotos y sus datos (kilos
        separados y materiales reutilizados). Desde tu panel puedes revisarlas,
        aprobarlas o pedir que las corrijan.
      </p>
      <Link
        href={href}
        className="mt-4 inline-flex rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
      >
        Ir a revisar evidencias
      </Link>
    </section>
  );
}
