"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Experiment = {
  id: string;
  weekNumber: number;
  title: string;
  objective: string;
  status: string;
};

type Challenge = {
  id: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  experimentId: string;
  weekNumber: number | null;
  title: string | null;
  objective: string | null;
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function addDaysIso(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function SemanasManager() {
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDates, setEditDates] = useState<
    Record<string, { startDate: string; endDate: string }>
  >({});
  const [form, setForm] = useState({
    experimentId: "",
    startDate: todayIso(),
    endDate: addDaysIso(todayIso(), 6),
    activateNow: true
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [eRes, cRes] = await Promise.all([
      fetch("/api/admin/experimentos", { cache: "no-store" }),
      fetch("/api/admin/semanas", { cache: "no-store" })
    ]);
    const ePayload = await eRes.json();
    const cPayload = await cRes.json();
    if (!eRes.ok) setError(ePayload.error ?? "No se pudieron cargar experimentos");
    else setExperiments((ePayload.data ?? []).filter((e: Experiment) => e.status === "published"));
    if (!cRes.ok) setError(cPayload.error ?? "No se pudieron cargar los retos");
    else setChallenges(cPayload.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const currentChallenge = useMemo(
    () => challenges.find((c) => c.isCurrent) ?? null,
    [challenges]
  );

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.experimentId) {
      setError("Selecciona un experimento");
      return;
    }
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/admin/semanas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        experimentId: form.experimentId,
        startDate: form.startDate,
        endDate: form.endDate,
        activateNow: form.activateNow
      })
    });
    const payload = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      setError(payload.error ?? "No se pudo crear el reto");
      return;
    }
    setForm({
      experimentId: "",
      startDate: todayIso(),
      endDate: addDaysIso(todayIso(), 6),
      activateNow: true
    });
    await load();
  };

  const handleActivate = async (challenge: Challenge) => {
    setBusyId(challenge.id);
    setError(null);
    const res = await fetch(`/api/admin/semanas/${challenge.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "activate" })
    });
    setBusyId(null);
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      setError(payload.error ?? "No se pudo activar el reto");
      return;
    }
    await load();
  };

  const handleDeactivate = async (challenge: Challenge) => {
    setBusyId(challenge.id);
    setError(null);
    const res = await fetch(`/api/admin/semanas/${challenge.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "deactivate" })
    });
    setBusyId(null);
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      setError(payload.error ?? "No se pudo desactivar el reto");
      return;
    }
    await load();
  };

  const handleSaveDates = async (challenge: Challenge) => {
    const draft = editDates[challenge.id];
    if (!draft) return;
    if (draft.endDate < draft.startDate) {
      setError("La fecha fin no puede ser anterior a la de inicio");
      return;
    }
    setBusyId(challenge.id);
    setError(null);
    const res = await fetch(`/api/admin/semanas/${challenge.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startDate: draft.startDate, endDate: draft.endDate })
    });
    setBusyId(null);
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      setError(payload.error ?? "No se pudieron actualizar las fechas");
      return;
    }
    setEditingId(null);
    setEditDates((prev) => {
      const next = { ...prev };
      delete next[challenge.id];
      return next;
    });
    await load();
  };

  const handleDelete = async (challenge: Challenge) => {
    if (!confirm(`Eliminar reto de la semana ${challenge.weekNumber}?`)) return;
    setBusyId(challenge.id);
    setError(null);
    const res = await fetch(`/api/admin/semanas/${challenge.id}`, {
      method: "DELETE"
    });
    setBusyId(null);
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      setError(payload.error ?? "No se pudo eliminar el reto");
      return;
    }
    await load();
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
        <h2 className="text-sm font-semibold text-emerald-800">Reto activo</h2>
        {loading ? (
          <p className="mt-1 text-sm text-emerald-900">Cargando...</p>
        ) : currentChallenge ? (
          <div className="mt-1 text-sm text-emerald-900">
            <p>
              <span className="font-semibold">
                Semana {currentChallenge.weekNumber}:
              </span>{" "}
              {currentChallenge.title}
            </p>
            <p className="text-emerald-700">
              {currentChallenge.startDate} a {currentChallenge.endDate}
            </p>
          </div>
        ) : (
          <p className="mt-1 text-sm text-emerald-900">
            Sin reto activo. Crea uno abajo o activa uno existente.
          </p>
        )}
      </section>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <form
        onSubmit={handleCreate}
        className="grid gap-3 rounded-xl border bg-white p-4 sm:grid-cols-2"
      >
        <div className="sm:col-span-2">
          <p className="text-sm font-semibold text-slate-700">Programar reto</p>
          <p className="mt-0.5 text-xs text-slate-500">
            Crea un nuevo reto. Para cambiar las fechas de un reto ya programado,
            usa &quot;Editar fechas&quot; en la tabla de abajo (no crees uno nuevo).
          </p>
        </div>
        <label className="text-sm sm:col-span-2">
          <span className="block text-slate-600">Experimento</span>
          <select
            required
            value={form.experimentId}
            onChange={(e) => setForm({ ...form, experimentId: e.target.value })}
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
          >
            <option value="">Selecciona...</option>
            {experiments.map((e) => (
              <option key={e.id} value={e.id}>
                Semana {e.weekNumber} - {e.title}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="block text-slate-600">Inicio</span>
          <input
            required
            type="date"
            value={form.startDate}
            onChange={(e) =>
              setForm({
                ...form,
                startDate: e.target.value,
                endDate:
                  e.target.value > form.endDate
                    ? addDaysIso(e.target.value, 6)
                    : form.endDate
              })
            }
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
          />
        </label>
        <label className="text-sm">
          <span className="block text-slate-600">Fin</span>
          <input
            required
            type="date"
            min={form.startDate}
            value={form.endDate}
            onChange={(e) => setForm({ ...form, endDate: e.target.value })}
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
          />
        </label>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input
            type="checkbox"
            checked={form.activateNow}
            onChange={(e) => setForm({ ...form, activateNow: e.target.checked })}
          />
          <span>Activar este reto inmediatamente (desactiva el anterior)</span>
        </label>
        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={submitting}
            className="rounded bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {submitting ? "Creando..." : "Crear reto"}
          </button>
        </div>
      </form>

      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Semana</th>
              <th className="px-3 py-2">Titulo</th>
              <th className="px-3 py-2">Periodo</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && (
              <tr>
                <td className="px-3 py-3 text-slate-500" colSpan={5}>
                  Cargando...
                </td>
              </tr>
            )}
            {!loading && challenges.length === 0 && (
              <tr>
                <td className="px-3 py-3 text-slate-500" colSpan={5}>
                  Aun no hay retos programados.
                </td>
              </tr>
            )}
            {challenges.map((c) => (
              <tr key={c.id}>
                <td className="px-3 py-2">{c.weekNumber ?? "-"}</td>
                <td className="px-3 py-2">{c.title ?? "-"}</td>
                <td className="px-3 py-2 text-xs">
                  {editingId === c.id ? (
                    <div className="flex flex-col gap-1">
                      <input
                        type="date"
                        value={editDates[c.id]?.startDate ?? c.startDate}
                        onChange={(e) =>
                          setEditDates((prev) => ({
                            ...prev,
                            [c.id]: {
                              startDate: e.target.value,
                              endDate: prev[c.id]?.endDate ?? c.endDate
                            }
                          }))
                        }
                        className="rounded border border-slate-300 px-2 py-1"
                      />
                      <input
                        type="date"
                        min={editDates[c.id]?.startDate ?? c.startDate}
                        value={editDates[c.id]?.endDate ?? c.endDate}
                        onChange={(e) =>
                          setEditDates((prev) => ({
                            ...prev,
                            [c.id]: {
                              startDate: prev[c.id]?.startDate ?? c.startDate,
                              endDate: e.target.value
                            }
                          }))
                        }
                        className="rounded border border-slate-300 px-2 py-1"
                      />
                    </div>
                  ) : (
                    <>
                      {c.startDate} a {c.endDate}
                    </>
                  )}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      c.isCurrent
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    {c.isCurrent ? "Activo" : "Programado"}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-2">
                    {editingId === c.id ? (
                      <>
                        <button
                          type="button"
                          disabled={busyId === c.id}
                          onClick={() => handleSaveDates(c)}
                          className="rounded bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                        >
                          {busyId === c.id ? "Guardando..." : "Guardar"}
                        </button>
                        <button
                          type="button"
                          disabled={busyId === c.id}
                          onClick={() => {
                            setEditingId(null);
                            setEditDates((prev) => {
                              const next = { ...prev };
                              delete next[c.id];
                              return next;
                            });
                          }}
                          className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50 disabled:opacity-60"
                        >
                          Cancelar
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          disabled={busyId === c.id}
                          onClick={() => {
                            setEditingId(c.id);
                            setEditDates((prev) => ({
                              ...prev,
                              [c.id]: { startDate: c.startDate, endDate: c.endDate }
                            }));
                          }}
                          className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50 disabled:opacity-60"
                        >
                          Editar fechas
                        </button>
                        {c.isCurrent ? (
                          <button
                            type="button"
                            disabled={busyId === c.id}
                            onClick={() => handleDeactivate(c)}
                            className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50 disabled:opacity-60"
                          >
                            Desactivar
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={busyId === c.id}
                            onClick={() => handleActivate(c)}
                            className="rounded bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                          >
                            Marcar activo
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={busyId === c.id}
                          onClick={() => handleDelete(c)}
                          className="rounded border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-60"
                        >
                          Eliminar
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
