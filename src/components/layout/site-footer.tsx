import Link from "next/link";
import { BookOpenText, GraduationCap, Leaf } from "lucide-react";

/**
 * Footer global de la zona de adultos. Ofrece acceso a los manuales de usuario
 * desde cualquier seccion, para apoyar a quienes ingresan por primera vez.
 * Se renderiza via SiteChrome (no se muestra en la zona infantil del alumno).
 */
export function SiteFooter() {
  return (
    <footer className="mt-12 border-t border-emerald-100 bg-white/70">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6 text-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-slate-600">
          <Leaf className="h-4 w-4 text-emerald-600" aria-hidden />
          <span>Basura Cero en 52 Semanas</span>
        </div>

        <nav aria-label="Manuales de usuario" className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Ayuda
          </span>
          <Link
            href="/manuales/maestro"
            className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 px-3 py-1.5 font-medium text-emerald-700 hover:bg-emerald-50"
          >
            <GraduationCap className="h-4 w-4" aria-hidden /> Manual del maestro
          </Link>
          <Link
            href="/manuales/alumno"
            className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 px-3 py-1.5 font-medium text-emerald-700 hover:bg-emerald-50"
          >
            <BookOpenText className="h-4 w-4" aria-hidden /> Manual del alumno
          </Link>
        </nav>
      </div>
    </footer>
  );
}
