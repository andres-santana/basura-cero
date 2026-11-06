import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ManualContent } from "@/components/manuals/manual-content";
import { PrintButton } from "@/components/manuals/print-button";
import { MAESTRO_MANUAL } from "@/lib/manuals";

export const metadata: Metadata = {
  title: "Manual del maestro - Basura Cero",
  description:
    "Guia de uso de la plataforma para maestros: acceso, gestion de alumnos, revision y registro de evidencias."
};

export default function MaestroManualPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center justify-between gap-3 print:hidden">
        <Link
          href="/dashboard/maestro"
          className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-700 hover:text-emerald-800"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden /> Volver al panel
        </Link>
        <PrintButton />
      </div>
      <ManualContent manual={MAESTRO_MANUAL} />
    </div>
  );
}
