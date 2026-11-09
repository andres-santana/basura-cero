"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { getErrorMessage } from "@/lib/error-message";

type MaterialKind = "separado" | "reutilizado" | "reciclado";

type Material = {
  id: string;
  label: string;
  unitLabel: string;
  kgPerUnit: number;
  kind: MaterialKind;
  displayOrder: number;
  isActive: boolean;
};

type Props = {
  experimentId: string;
  disabled?: boolean;
};

const KIND_LABEL: Record<MaterialKind, string> = {
  separado: "Separado",
  reutilizado: "Reutilizado",
  reciclado: "Reciclado"
};

const EMPTY_DRAFT = {
  label: "",
  unitLabel: "",
  kgPerUnit: "",
  kind: "reutilizado" as MaterialKind
};

export function ExperimentMaterialsField({ experimentId, disabled = false }: Props) {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState(EMPTY_DRAFT);

  const base = `/api/admin/experimentos/${experimentId}/materiales`;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(base, { cache: "no-store" });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error ?? "No se pudieron cargar los materiales");
      setMaterials(payload.data ?? []);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [base]);

  useEffect(() => {
    void load();
  }, [load]);

  const addMaterial = async () => {
    setError(null);
    if (draft.label.trim().length < 2 || draft.unitLabel.trim() === "") {
      setError("Escribe el nombre del material y su unidad");
      return;
    }
    const kg = draft.kgPerUnit.trim() === "" ? NaN : Number(draft.kgPerUnit);
    if (Number.isNaN(kg) || kg < 0) {
      setError("El peso por unidad debe ser un numero mayor o igual a 0");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(base, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: draft.label.trim(),
          unitLabel: draft.unitLabel.trim(),
          kgPerUnit: kg,
          kind: draft.kind
        })
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error ?? "No se pudo agregar el material");
      setDraft(EMPTY_DRAFT);
      await load();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const removeMaterial = async (id: string) => {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`${base}/${id}`, { method: "DELETE" });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error ?? "No se pudo eliminar el material");
      await load();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:col-span-2">
      <div>
        <p className="text-sm font-semibold text-slate-700">
          Materiales medibles (kg equivalentes)
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Define los materiales que el alumno contara en este experimento y cuanto
          pesa cada unidad. El puntaje de impacto usara los kilogramos equivalentes
          (cantidad x peso). Si no agregas materiales, se usa el modo anterior
          (kg y conteos sueltos).
        </p>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      {loading ? (
        <p className="flex items-center gap-2 text-xs text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Cargando materiales...
        </p>
      ) : (
        <ul className="space-y-2">
          {materials.length === 0 && (
            <li className="text-xs text-slate-500">Aun no hay materiales definidos.</li>
          )}
          {materials.map((m) => (
            <li
              key={m.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <span className="text-slate-800">
                <strong>{m.label}</strong>{" "}
                <span className="text-slate-500">
                  ({m.kgPerUnit} kg/{m.unitLabel} · {KIND_LABEL[m.kind]})
                </span>
                {!m.isActive && (
                  <span className="ml-2 rounded bg-slate-200 px-1.5 py-0.5 text-[11px] text-slate-600">
                    inactivo
                  </span>
                )}
              </span>
              <button
                type="button"
                disabled={disabled || busy}
                onClick={() => void removeMaterial(m.id)}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-red-600 hover:bg-red-50 disabled:opacity-50"
                aria-label={`Quitar ${m.label}`}
              >
                <Trash2 className="h-4 w-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Alta de material */}
      <div className="grid gap-2 sm:grid-cols-[1.4fr_1fr_0.9fr_1fr_auto] sm:items-end">
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-slate-600">Material</span>
          <input
            type="text"
            value={draft.label}
            onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
            placeholder="Hoja carta"
            disabled={disabled || busy}
            className="rounded border border-slate-300 px-2 py-1"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-slate-600">Unidad</span>
          <input
            type="text"
            value={draft.unitLabel}
            onChange={(e) => setDraft((d) => ({ ...d, unitLabel: e.target.value }))}
            placeholder="hoja"
            disabled={disabled || busy}
            className="rounded border border-slate-300 px-2 py-1"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-slate-600">kg/unidad</span>
          <input
            type="number"
            min={0}
            step={0.0001}
            value={draft.kgPerUnit}
            onChange={(e) => setDraft((d) => ({ ...d, kgPerUnit: e.target.value }))}
            placeholder="0.005"
            disabled={disabled || busy}
            className="rounded border border-slate-300 px-2 py-1"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-slate-600">Tipo</span>
          <select
            value={draft.kind}
            onChange={(e) =>
              setDraft((d) => ({ ...d, kind: e.target.value as MaterialKind }))
            }
            disabled={disabled || busy}
            className="rounded border border-slate-300 px-2 py-1"
          >
            <option value="separado">Separado</option>
            <option value="reutilizado">Reutilizado</option>
            <option value="reciclado">Reciclado</option>
          </select>
        </label>
        <button
          type="button"
          disabled={disabled || busy}
          onClick={() => void addMaterial()}
          className="inline-flex items-center justify-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" aria-hidden /> Agregar
        </button>
      </div>
    </div>
  );
}
