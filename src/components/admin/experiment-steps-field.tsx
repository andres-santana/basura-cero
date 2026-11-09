"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { getErrorMessage } from "@/lib/error-message";

type Step = {
  id: string;
  order: number;
  title: string;
  description: string;
  points: number;
  completedCount: number;
};

type StepEdit = { title: string; description: string; points: string };

type Props = {
  experimentId: string;
  disabled?: boolean;
};

const EMPTY_DRAFT = { title: "", description: "", points: "5" };

export function ExperimentStepsField({ experimentId, disabled = false }: Props) {
  const [steps, setSteps] = useState<Step[]>([]);
  // Solo guarda lo que el admin escribio y aun no se persiste. Si un paso no esta
  // aqui, se muestran los valores del servidor. Recargar la lista nunca pisa esto.
  const [edits, setEdits] = useState<Record<string, StepEdit>>({});
  const editsRef = useRef(edits);
  editsRef.current = edits;
  const stepsRef = useRef(steps);
  stepsRef.current = steps;

  const [maxSteps, setMaxSteps] = useState(6);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState(EMPTY_DRAFT);

  const base = `/api/admin/experimentos/${experimentId}/pasos`;

  const load = useCallback(
    async (showSpinner = true) => {
      if (showSpinner) setLoading(true);
      try {
        const res = await fetch(base, { cache: "no-store" });
        const payload = await res.json();
        if (!res.ok) throw new Error(payload.error ?? "No se pudieron cargar los pasos");
        const loaded: Step[] = payload.data ?? [];
        setSteps(loaded);
        setMaxSteps(payload.maxSteps ?? 6);
        // Descarta ediciones de pasos que ya no existen.
        setEdits((prev) => {
          const ids = new Set(loaded.map((s) => s.id));
          return Object.fromEntries(Object.entries(prev).filter(([id]) => ids.has(id)));
        });
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    },
    [base]
  );

  useEffect(() => {
    void load();
  }, [load]);

  const valuesOf = (step: Step): StepEdit =>
    edits[step.id] ?? {
      title: step.title,
      description: step.description,
      points: String(step.points)
    };

  const isDirty = (step: Step, edit: StepEdit) =>
    edit.title !== step.title ||
    edit.description !== step.description ||
    edit.points !== String(step.points);

  const setEdit = (step: Step, patch: Partial<StepEdit>) =>
    setEdits((prev) => ({
      ...prev,
      [step.id]: {
        ...(prev[step.id] ?? {
          title: step.title,
          description: step.description,
          points: String(step.points)
        }),
        ...patch
      }
    }));

  // Persiste un paso con lo que hay en pantalla. Lanza error si falla.
  const persistStep = useCallback(
    async (step: Step, edit: StepEdit) => {
      const points = Number(edit.points);
      if (!Number.isInteger(points) || points < 0 || points > 100) {
        throw new Error("Los puntos deben ser un entero entre 0 y 100");
      }
      const res = await fetch(`${base}/${step.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: edit.title.trim(),
          description: edit.description.trim(),
          points
        })
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error ?? "No se pudo guardar el paso");

      const saved: Step = {
        ...step,
        title: edit.title.trim(),
        description: edit.description.trim(),
        points
      };
      setSteps((prev) => prev.map((s) => (s.id === step.id ? saved : s)));
      // Quita la edicion solo si el admin no siguio escribiendo mientras se guardaba.
      setEdits((prev) => {
        const current = prev[step.id];
        if (
          current &&
          current.title === edit.title &&
          current.description === edit.description &&
          current.points === edit.points
        ) {
          const { [step.id]: _removed, ...rest } = prev;
          void _removed;
          return rest;
        }
        return prev;
      });
    },
    [base]
  );

  // Guarda todos los pasos con cambios pendientes (antes de agregar/reordenar/borrar).
  const flushDirty = useCallback(async () => {
    for (const step of stepsRef.current) {
      const edit = editsRef.current[step.id];
      if (edit && isDirty(step, edit)) {
        await persistStep(step, edit);
      }
    }
  }, [persistStep]);

  const run = async (action: () => Promise<void>, reload = true) => {
    setError(null);
    setBusy(true);
    try {
      await action();
      if (reload) await load(false);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  // Guardado al salir del campo: el texto escrito no se pierde aunque no se pulse guardar.
  const saveOnBlur = (step: Step) => {
    const edit = editsRef.current[step.id];
    if (!edit || !isDirty(step, edit) || busy) return;
    void run(() => persistStep(step, edit), false);
  };

  const addStep = () =>
    run(async () => {
      const points = Number(draft.points);
      if (draft.title.trim().length < 2 || draft.description.trim().length < 2) {
        throw new Error("Escribe el titulo y la descripcion del paso");
      }
      if (!Number.isInteger(points) || points < 0) {
        throw new Error("Los puntos deben ser un entero mayor o igual a 0");
      }
      await flushDirty();
      const res = await fetch(base, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: draft.title.trim(),
          description: draft.description.trim(),
          points
        })
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error ?? "No se pudo agregar el paso");
      setDraft(EMPTY_DRAFT);
    });

  const moveStep = (index: number, direction: -1 | 1) =>
    run(async () => {
      await flushDirty();
      const ids = stepsRef.current.map((s) => s.id);
      const target = index + direction;
      if (target < 0 || target >= ids.length) return;
      [ids[index], ids[target]] = [ids[target], ids[index]];
      const res = await fetch(base, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stepIds: ids })
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error ?? "No se pudo reordenar");
    });

  const removeStep = (step: Step) =>
    run(async () => {
      if (step.completedCount > 0) {
        const ok = window.confirm(
          `${step.completedCount} alumno(s) ya completaron "${step.title}". ` +
            "Al borrarlo se pierde ese avance y sus puntos. ¿Borrar de todos modos?"
        );
        if (!ok) return;
      }
      // Guarda lo pendiente de los demas pasos antes de borrar y recargar.
      await flushDirty();
      const res = await fetch(`${base}/${step.id}?confirm=1`, { method: "DELETE" });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error ?? "No se pudo eliminar el paso");
    });

  const inputClass = "rounded border border-slate-300 px-2 py-1 text-sm";

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:col-span-2">
      <div>
        <p className="text-sm font-semibold text-slate-700">Pasos del alumno (&quot;Tus pasos&quot;)</p>
        <p className="mt-1 text-xs text-slate-500">
          Define los pasos que vera el alumno en este experimento (1 a {maxSteps}). Los
          cambios de cada paso se guardan al salir del campo (o con el boton de guardar),
          sin depender de &quot;Guardar cambios&quot; del experimento. Los puntos suman al
          puntaje del grupo, asi que cambiarlos afecta el ranking.
        </p>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      {loading ? (
        <p className="flex items-center gap-2 text-xs text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Cargando pasos...
        </p>
      ) : (
        <ol className="space-y-2">
          {steps.length === 0 && (
            <li className="text-xs text-slate-500">Aun no hay pasos definidos.</li>
          )}
          {steps.map((step, index) => {
            const edit = valuesOf(step);
            const dirty = isDirty(step, edit);
            return (
              <li
                key={step.id}
                className="grid gap-2 rounded-lg border border-slate-200 bg-white p-3 sm:grid-cols-[auto_1fr_5rem_auto] sm:items-start"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-800">
                  {index + 1}
                </span>
                <div className="space-y-2">
                  <input
                    type="text"
                    value={edit.title}
                    onChange={(e) => setEdit(step, { title: e.target.value })}
                    onBlur={() => saveOnBlur(step)}
                    maxLength={80}
                    aria-label={`Titulo del paso ${index + 1}`}
                    disabled={disabled}
                    className={`${inputClass} w-full font-semibold`}
                  />
                  <textarea
                    value={edit.description}
                    onChange={(e) => setEdit(step, { description: e.target.value })}
                    onBlur={() => saveOnBlur(step)}
                    maxLength={300}
                    rows={2}
                    aria-label={`Descripcion del paso ${index + 1}`}
                    disabled={disabled}
                    className={`${inputClass} w-full`}
                  />
                  {dirty && (
                    <p className="text-[11px] font-semibold text-amber-600">
                      Cambios sin guardar
                    </p>
                  )}
                  {step.completedCount > 0 && (
                    <p className="text-[11px] text-slate-500">
                      Completado por {step.completedCount} alumno(s)
                    </p>
                  )}
                </div>
                <label className="flex flex-col gap-1 text-xs text-slate-600">
                  Puntos
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    value={edit.points}
                    onChange={(e) => setEdit(step, { points: e.target.value })}
                    onBlur={() => saveOnBlur(step)}
                    disabled={disabled}
                    className={inputClass}
                  />
                </label>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={disabled || busy || !dirty}
                    onClick={() => void run(() => persistStep(step, edit), false)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-emerald-700 hover:bg-emerald-50 disabled:opacity-40"
                    aria-label={`Guardar paso ${index + 1}`}
                  >
                    <Save className="h-4 w-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    disabled={disabled || busy || index === 0}
                    onClick={() => void moveStep(index, -1)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-40"
                    aria-label={`Subir paso ${index + 1}`}
                  >
                    <ArrowUp className="h-4 w-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    disabled={disabled || busy || index === steps.length - 1}
                    onClick={() => void moveStep(index, 1)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-40"
                    aria-label={`Bajar paso ${index + 1}`}
                  >
                    <ArrowDown className="h-4 w-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    disabled={disabled || busy || steps.length <= 1}
                    onClick={() => void removeStep(step)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-red-600 hover:bg-red-50 disabled:opacity-40"
                    aria-label={`Quitar paso ${index + 1}`}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {/* Alta de paso */}
      {!loading && steps.length < maxSteps && (
        <div className="grid gap-2 sm:grid-cols-[1fr_1.6fr_5rem_auto] sm:items-end">
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-slate-600">Titulo</span>
            <input
              type="text"
              value={draft.title}
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
              placeholder="Crear mini compostera"
              maxLength={80}
              disabled={disabled || busy}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-slate-600">Descripcion</span>
            <input
              type="text"
              value={draft.description}
              onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
              placeholder="Arma tu compostera con una botella y tierra."
              maxLength={300}
              disabled={disabled || busy}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-slate-600">Puntos</span>
            <input
              type="number"
              min={0}
              max={100}
              step={1}
              value={draft.points}
              onChange={(e) => setDraft((d) => ({ ...d, points: e.target.value }))}
              disabled={disabled || busy}
              className={inputClass}
            />
          </label>
          <button
            type="button"
            disabled={disabled || busy}
            onClick={() => void addStep()}
            className="inline-flex items-center justify-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" aria-hidden /> Agregar
          </button>
        </div>
      )}
    </div>
  );
}
