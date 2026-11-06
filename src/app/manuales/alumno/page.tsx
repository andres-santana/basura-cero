import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, BookOpenText } from "lucide-react";
import { ManualContent } from "@/components/manuals/manual-content";
import { PrintButton } from "@/components/manuals/print-button";
import { ALUMNO_MANUAL } from "@/lib/manuals";

export const metadata: Metadata = {
  title: "Manual del alumno - Basura Cero",
  description:
    "Guia facil para alumnos: como entrar con tu codigo, hacer tu reto, jugar y subir tu foto."
};

/**
 * Pagina del manual del alumno con un "chrome" propio y amigable para ninos,
 * coherente con la zona /alumno. `SiteChrome` omite el MainNav de adultos para
 * esta ruta (ver src/components/layout/site-chrome.tsx).
 */
export default function AlumnoManualPage() {
  return (
    <div className="flex min-h-screen flex-col bg-eco-50">
      <header className="sticky top-0 z-10 border-b-4 border-eco-100 bg-white print:static print:border-0">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-eco-100">
            <BookOpenText className="h-6 w-6 text-eco-600" aria-hidden />
          </span>
          <div className="leading-tight">
            <p className="font-display text-lg font-bold text-eco-700">Mi manual</p>
            <p className="text-xs font-semibold text-eco-500">Como usar la plataforma</p>
          </div>
          <div className="ml-auto">
            <PrintButton />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        <ManualContent manual={ALUMNO_MANUAL} />
        <div className="mt-10 text-center print:hidden">
          <Link
            href="/alumno"
            className="inline-flex items-center gap-2 rounded-2xl bg-eco-600 px-6 py-3 text-lg font-black text-white transition hover:bg-eco-700 active:scale-95"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden /> Volver al inicio
          </Link>
        </div>
      </main>
    </div>
  );
}
