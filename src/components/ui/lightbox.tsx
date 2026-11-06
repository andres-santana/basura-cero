"use client";

import { useCallback, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

export type LightboxItem = {
  id: string;
  url: string;
  /** Texto de contexto opcional (ej. apodo del alumno o nombre de archivo). */
  caption?: string | null;
};

type Props = {
  items: LightboxItem[];
  /** Indice activo; null = cerrado. */
  index: number | null;
  onClose: () => void;
  onNavigate: (nextIndex: number) => void;
};

/**
 * Visor de imagenes a pantalla completa, responsive y accesible. Permite
 * navegar entre varias imagenes con flechas (pantalla o teclado), cerrar con
 * Escape o tocando el fondo, y muestra un contador y el pie de foto.
 */
export function Lightbox({ items, index, onClose, onNavigate }: Props) {
  const isOpen = index !== null && index >= 0 && index < items.length;
  const closeRef = useRef<HTMLButtonElement | null>(null);

  const goPrev = useCallback(() => {
    if (index === null) return;
    onNavigate((index - 1 + items.length) % items.length);
  }, [index, items.length, onNavigate]);

  const goNext = useCallback(() => {
    if (index === null) return;
    onNavigate((index + 1) % items.length);
  }, [index, items.length, onNavigate]);

  useEffect(() => {
    if (!isOpen) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "ArrowRight") goNext();
    };
    document.addEventListener("keydown", onKey);

    // Bloquea el scroll del fondo mientras el visor esta abierto.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Enfoca el boton de cerrar para el manejo de foco.
    closeRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, onClose, goPrev, goNext]);

  if (!isOpen || index === null) return null;

  const current = items[index];
  const hasMultiple = items.length > 1;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Visor de evidencia"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 sm:p-8"
      onClick={onClose}
    >
      {/* Boton cerrar */}
      <button
        ref={closeRef}
        type="button"
        onClick={onClose}
        aria-label="Cerrar"
        className="absolute right-3 top-3 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
      >
        <X className="h-6 w-6" aria-hidden />
      </button>

      {/* Anterior */}
      {hasMultiple && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            goPrev();
          }}
          aria-label="Imagen anterior"
          className="absolute left-2 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 sm:left-4"
        >
          <ChevronLeft className="h-7 w-7" aria-hidden />
        </button>
      )}

      {/* Imagen + pie */}
      <figure
        className="flex max-h-full max-w-full flex-col items-center gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={current.url}
          alt={current.caption ?? "Evidencia"}
          className="max-h-[80vh] max-w-full rounded-lg object-contain shadow-2xl"
        />
        <figcaption className="flex items-center gap-3 text-sm text-white/80">
          {current.caption && <span className="truncate">{current.caption}</span>}
          {hasMultiple && (
            <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-xs">
              {index + 1} / {items.length}
            </span>
          )}
        </figcaption>
      </figure>

      {/* Siguiente */}
      {hasMultiple && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            goNext();
          }}
          aria-label="Imagen siguiente"
          className="absolute right-2 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 sm:right-4"
        >
          <ChevronRight className="h-7 w-7" aria-hidden />
        </button>
      )}
    </div>
  );
}
