"use client";

import { Printer } from "lucide-react";

/**
 * Boton para imprimir / guardar como PDF la pagina del manual usando el
 * dialogo nativo del navegador. Se oculta al imprimir (clase print:hidden).
 */
export function PrintButton({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={
        className ??
        "inline-flex items-center gap-2 rounded-lg border border-emerald-300 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 print:hidden"
      }
    >
      <Printer className="h-4 w-4" aria-hidden /> Imprimir
    </button>
  );
}
