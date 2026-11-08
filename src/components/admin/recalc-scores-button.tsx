"use client";

import { useState } from "react";

export function RecalcScoresButton() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    setLoading(true);
    setMessage(null);
    setError(null);
    const res = await fetch("/api/admin/recalcular", { method: "POST" });
    const payload = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(payload.error ?? "No se pudo recalcular");
      return;
    }
    setMessage(
      `Listo. Se recalcularon ${payload.recalculated ?? 0} entrega(s). ` +
        "Actualiza la pagina para ver los puntajes, el ranking y las insignias."
    );
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={() => void handleClick()}
        disabled={loading}
        className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
      >
        {loading ? "Recalculando..." : "Recalcular estadisticas"}
      </button>
      {message && <span className="text-xs text-emerald-700">{message}</span>}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
