"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ExperimentVideoField } from "@/components/admin/experiment-video-field";
import { ExperimentMaterialsField } from "@/components/admin/experiment-materials-field";
import {
  CHALLENGE_TYPES,
  CHALLENGE_TYPE_STYLES,
  challengeTypeLabel,
  type ChallengeType
} from "@/lib/challenge-types";

type ExperimentStatus = "draft" | "published" | "archived";

type Experiment = {
  id: string;
  weekNumber: number;
  title: string;
  objective: string;
  challengeType: ChallengeType | null;
  instructions: string;
  materials: string | null;
  printableUrl: string | null;
  videoUrl: string | null;
  hypothesis: string | null;
  classification: string | null;
  observations: string | null;
  resultsPrompt: string | null;
  drawingPrompt: string | null;
  finalMessage: string | null;
  curiousFact: string;
  conclusion: string;
  status: ExperimentStatus;
};

type FormState = {
  weekNumber: string;
  title: string;
  objective: string;
  challengeType: ChallengeType | "";
  hypothesis: string;
  materials: string;
  classification: string;
  instructions: string;
  observations: string;
  resultsPrompt: string;
  curiousFact: string;
  conclusion: string;
  drawingPrompt: string;
  finalMessage: string;
  printableUrl: string;
  videoUrl: string;
  status: ExperimentStatus;
};

const EMPTY_FORM: FormState = {
  weekNumber: "",
  title: "",
  objective: "",
  challengeType: "",
  hypothesis: "",
  materials: "",
  classification: "",
  instructions: "",
  observations: "",
  resultsPrompt: "",
  curiousFact: "",
  conclusion: "",
  drawingPrompt: "",
  finalMessage: "",
  printableUrl: "",
  videoUrl: "",
  status: "draft"
};

const FILTERS: Array<{ id: string; label: string; status: string | null }> = [
  { id: "all", label: "Todos", status: null },
  { id: "published", label: "Publicados", status: "published" },
  { id: "draft", label: "Borradores", status: "draft" },
  { id: "archived", label: "Archivados", status: "archived" }
];

function statusBadge(status: ExperimentStatus) {
  const map: Record<ExperimentStatus, string> = {
    draft: "bg-slate-200 text-slate-700",
    published: "bg-emerald-100 text-emerald-800",
    archived: "bg-amber-100 text-amber-800"
  };
  const labels: Record<ExperimentStatus, string> = {
    draft: "Borrador",
    published: "Publicado",
    archived: "Archivado"
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${map[status]}`}>
      {labels[status]}
    </span>
  );
}

export function ExperimentsManager() {
  const [filterId, setFilterId] = useState("all");
  const [search, setSearch] = useState("");
  const [data, setData] = useState<Experiment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FormState | null>(null);
  const [createForm, setCreateForm] = useState<FormState>(EMPTY_FORM);
  const [showCreate, setShowCreate] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const filter = FILTERS.find((f) => f.id === filterId) ?? FILTERS[0];

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const query = filter.status ? `?status=${filter.status}` : "";
    const res = await fetch(`/api/admin/experimentos${query}`, { cache: "no-store" });
    const payload = await res.json();
    if (!res.ok) {
      setError(payload.error ?? "No se pudieron cargar los experimentos");
      setData([]);
    } else {
      setData(payload.data ?? []);
    }
    setLoading(false);
  }, [filter.status]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return data;
    return data.filter(
      (e) =>
        e.title.toLowerCase().includes(term) ||
        String(e.weekNumber).includes(term) ||
        e.objective.toLowerCase().includes(term)
    );
  }, [data, search]);

  const openEdit = (experiment: Experiment) => {
    setExpandedId(experiment.id);
    setEditForm({
      weekNumber: String(experiment.weekNumber),
      title: experiment.title,
      objective: experiment.objective,
      challengeType: experiment.challengeType ?? "",
      hypothesis: experiment.hypothesis ?? "",
      materials: experiment.materials ?? "",
      classification: experiment.classification ?? "",
      instructions: experiment.instructions,
      observations: experiment.observations ?? "",
      resultsPrompt: experiment.resultsPrompt ?? "",
      curiousFact: experiment.curiousFact,
      conclusion: experiment.conclusion,
      drawingPrompt: experiment.drawingPrompt ?? "",
      finalMessage: experiment.finalMessage ?? "",
      printableUrl: experiment.printableUrl ?? "",
      videoUrl: experiment.videoUrl ?? "",
      status: experiment.status
    });
  };

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/admin/experimentos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        weekNumber: Number(createForm.weekNumber),
        title: createForm.title,
        objective: createForm.objective,
        challengeType: createForm.challengeType || null,
        instructions: createForm.instructions,
        curiousFact: createForm.curiousFact,
        conclusion: createForm.conclusion,
        materials: createForm.materials || undefined,
        hypothesis: createForm.hypothesis || undefined,
        classification: createForm.classification || undefined,
        observations: createForm.observations || undefined,
        resultsPrompt: createForm.resultsPrompt || undefined,
        drawingPrompt: createForm.drawingPrompt || undefined,
        finalMessage: createForm.finalMessage || undefined,
        printableUrl: createForm.printableUrl || undefined,
        videoUrl: createForm.videoUrl || undefined,
        status: createForm.status
      })
    });
    const payload = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      setError(payload.error ?? "No se pudo crear el experimento");
      return;
    }
    setCreateForm(EMPTY_FORM);
    setShowCreate(false);
    await load();
  };

  const handleUpdate = async (id: string) => {
    if (!editForm) return;
    setSubmitting(true);
    setError(null);
    const res = await fetch(`/api/admin/experimentos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: editForm.title,
        objective: editForm.objective,
        challengeType: editForm.challengeType || null,
        instructions: editForm.instructions,
        curiousFact: editForm.curiousFact,
        conclusion: editForm.conclusion,
        materials: editForm.materials || null,
        hypothesis: editForm.hypothesis || null,
        classification: editForm.classification || null,
        observations: editForm.observations || null,
        resultsPrompt: editForm.resultsPrompt || null,
        drawingPrompt: editForm.drawingPrompt || null,
        finalMessage: editForm.finalMessage || null,
        printableUrl: editForm.printableUrl || null,
        videoUrl: editForm.videoUrl || null,
        status: editForm.status
      })
    });
    const payload = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      setError(payload.error ?? "No se pudo actualizar");
      return;
    }
    setExpandedId(null);
    setEditForm(null);
    await load();
  };

  const handleDelete = async (experiment: Experiment) => {
    if (
      !confirm(
        `Eliminar experimento Semana ${experiment.weekNumber}? Solo funciona si no tiene retos vinculados.`
      )
    ) {
      return;
    }
    setError(null);
    const res = await fetch(`/api/admin/experimentos/${experiment.id}`, {
      method: "DELETE"
    });
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      setError(payload.error ?? "No se pudo eliminar");
      return;
    }
    setExpandedId(null);
    setEditForm(null);
    await load();
  };

  const renderFormFields = (
    form: FormState,
    setForm: (next: FormState) => void,
    options: { includeWeekNumber?: boolean } = {}
  ) => (
    <div className="grid gap-3 sm:grid-cols-2">
      {options.includeWeekNumber && (
        <label className="text-sm sm:col-span-1">
          <span className="block text-slate-600">Semana (1-52)</span>
          <input
            required
            type="number"
            min={1}
            max={52}
            value={form.weekNumber}
            onChange={(e) => setForm({ ...form, weekNumber: e.target.value })}
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
          />
        </label>
      )}
      <label className={`text-sm ${options.includeWeekNumber ? "sm:col-span-1" : "sm:col-span-2"}`}>
        <span className="block text-slate-600">Estado</span>
        <select
          value={form.status}
          onChange={(e) =>
            setForm({ ...form, status: e.target.value as ExperimentStatus })
          }
          className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
        >
          <option value="draft">Borrador</option>
          <option value="published">Publicado</option>
          <option value="archived">Archivado</option>
        </select>
      </label>
      <label className="text-sm sm:col-span-2">
        <span className="block text-slate-600">Titulo</span>
        <input
          required
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
        />
      </label>
      <label className="text-sm sm:col-span-2">
        <span className="block text-slate-600">Objetivo</span>
        <textarea
          required
          rows={2}
          value={form.objective}
          onChange={(e) => setForm({ ...form, objective: e.target.value })}
          className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
        />
      </label>
      <label className="text-sm sm:col-span-2">
        <span className="block text-slate-600">
          Tipo de reto (color del calendario)
        </span>
        <select
          value={form.challengeType}
          onChange={(e) =>
            setForm({ ...form, challengeType: e.target.value as ChallengeType | "" })
          }
          className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
        >
          <option value="">Sin tipo</option>
          {CHALLENGE_TYPES.map((t) => (
            <option key={t} value={t}>
              {CHALLENGE_TYPE_STYLES[t].label}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm sm:col-span-2">
        <span className="block text-slate-600">Hipótesis</span>
        <textarea
          rows={2}
          value={form.hypothesis}
          onChange={(e) => setForm({ ...form, hypothesis: e.target.value })}
          placeholder="Lo que el grupo espera descubrir o comprobar"
          className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
        />
      </label>
      <label className="text-sm sm:col-span-2">
        <span className="block text-slate-600">Materiales</span>
        <textarea
          rows={2}
          value={form.materials}
          onChange={(e) => setForm({ ...form, materials: e.target.value })}
          className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
        />
      </label>
      <label className="text-sm sm:col-span-2">
        <span className="block text-slate-600">Clasificación</span>
        <textarea
          rows={3}
          value={form.classification}
          onChange={(e) => setForm({ ...form, classification: e.target.value })}
          placeholder="Categorias para separar, p. ej. Orgánica, Reciclable, No reciclable (una por linea)"
          className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
        />
      </label>
      <label className="text-sm sm:col-span-2">
        <span className="block text-slate-600">Procedimiento (instrucciones)</span>
        <textarea
          required
          rows={4}
          value={form.instructions}
          onChange={(e) => setForm({ ...form, instructions: e.target.value })}
          placeholder="Pasos del experimento (uno por linea)"
          className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
        />
      </label>
      <label className="text-sm sm:col-span-2">
        <span className="block text-slate-600">Observaciones</span>
        <textarea
          rows={2}
          value={form.observations}
          onChange={(e) => setForm({ ...form, observations: e.target.value })}
          placeholder="Guia de lo que el grupo debe observar y anotar"
          className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
        />
      </label>
      <label className="text-sm sm:col-span-2">
        <span className="block text-slate-600">Resultados (pregunta guía)</span>
        <textarea
          rows={2}
          value={form.resultsPrompt}
          onChange={(e) => setForm({ ...form, resultsPrompt: e.target.value })}
          placeholder="Pregunta que orienta los resultados, p. ej. ¿Qué tipo de basura fue mayor?"
          className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
        />
      </label>
      <label className="text-sm sm:col-span-2">
        <span className="block text-slate-600">Dato impactante</span>
        <textarea
          required
          rows={2}
          value={form.curiousFact}
          onChange={(e) => setForm({ ...form, curiousFact: e.target.value })}
          placeholder="Dato que sorprende o motiva, relacionado con el experimento"
          className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
        />
      </label>
      <label className="text-sm sm:col-span-2">
        <span className="block text-slate-600">Conclusión</span>
        <textarea
          required
          rows={3}
          value={form.conclusion}
          onChange={(e) => setForm({ ...form, conclusion: e.target.value })}
          placeholder="Que aprendio el grupo al completar este experimento"
          className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
        />
      </label>
      <label className="text-sm sm:col-span-2">
        <span className="block text-slate-600">Gráfica o dibujo (instrucción)</span>
        <textarea
          rows={2}
          value={form.drawingPrompt}
          onChange={(e) => setForm({ ...form, drawingPrompt: e.target.value })}
          placeholder="Que debe dibujar o representar el grupo"
          className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
        />
      </label>
      <label className="text-sm sm:col-span-2">
        <span className="block text-slate-600">Mensaje final</span>
        <textarea
          rows={2}
          value={form.finalMessage}
          onChange={(e) => setForm({ ...form, finalMessage: e.target.value })}
          placeholder="Mensaje de cierre que refuerza el aprendizaje"
          className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
        />
      </label>
      <label className="text-sm sm:col-span-2">
        <span className="block text-slate-600">URL ficha imprimible (PDF o enlace)</span>
        <input
          type="text"
          value={form.printableUrl}
          onChange={(e) => setForm({ ...form, printableUrl: e.target.value })}
          placeholder="https://... o /fichas/semana-1.pdf"
          className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
        />
      </label>
      <label className="text-sm sm:col-span-2">
        <span className="block text-slate-600">Enlace de video (YouTube o URL directa)</span>
        <input
          type="text"
          value={form.videoUrl}
          onChange={(e) => setForm({ ...form, videoUrl: e.target.value })}
          placeholder="https://youtube.com/watch?v=... (opcional al crear)"
          className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
        />
      </label>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilterId(f.id)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              filterId === f.id
                ? "bg-emerald-600 text-white"
                : "border border-slate-300 text-slate-700 hover:bg-slate-50"
            }`}
          >
            {f.label}
          </button>
        ))}
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por titulo o semana..."
          className="ml-auto min-w-[200px] rounded border border-slate-300 px-3 py-1 text-sm"
        />
        <button
          type="button"
          onClick={() => setShowCreate((v) => !v)}
          className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
        >
          {showCreate ? "Cancelar" : "Nuevo experimento"}
        </button>
      </div>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {showCreate && (
        <form
          onSubmit={handleCreate}
          className="space-y-3 rounded-xl border bg-white p-4"
        >
          <h3 className="text-sm font-semibold text-slate-700">Crear experimento</h3>
          {renderFormFields(createForm, setCreateForm, { includeWeekNumber: true })}
          <button
            type="submit"
            disabled={submitting}
            className="rounded bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {submitting ? "Guardando..." : "Crear"}
          </button>
        </form>
      )}

      {loading && (
        <p className="rounded-xl border bg-white p-4 text-sm text-slate-500">
          Cargando experimentos...
        </p>
      )}

      {!loading && filtered.length === 0 && (
        <p className="rounded-xl border bg-white p-4 text-sm text-slate-500">
          No hay experimentos en este filtro.
        </p>
      )}

      <ul className="space-y-2">
        {filtered.map((experiment) => {
          const expanded = expandedId === experiment.id;
          return (
            <li key={experiment.id} className="rounded-xl border bg-white">
              <button
                type="button"
                onClick={() =>
                  expanded
                    ? (setExpandedId(null), setEditForm(null))
                    : openEdit(experiment)
                }
                className="flex w-full items-center justify-between gap-3 p-4 text-left"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    {statusBadge(experiment.status)}
                    {experiment.challengeType && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                        <span
                          className={`h-2.5 w-2.5 rounded-full ${CHALLENGE_TYPE_STYLES[experiment.challengeType].swatch}`}
                          aria-hidden
                        />
                        {challengeTypeLabel(experiment.challengeType)}
                      </span>
                    )}
                    <span className="font-semibold text-slate-800">
                      Semana {experiment.weekNumber}: {experiment.title}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-1 text-xs text-slate-500">
                    {experiment.objective}
                  </p>
                </div>
                <span className="text-xs text-slate-400">
                  {expanded ? "Cerrar" : "Editar"}
                </span>
              </button>

              {expanded && editForm && (
                <div className="space-y-3 border-t border-slate-100 p-4">
                  <p className="text-xs text-slate-500">
                    Semana {experiment.weekNumber} (no editable)
                  </p>
                  {renderFormFields(editForm, setEditForm)}
                  <ExperimentVideoField
                    experimentId={experiment.id}
                    videoUrl={editForm.videoUrl}
                    onChange={(videoUrl) =>
                      setEditForm((current) =>
                        current ? { ...current, videoUrl } : current
                      )
                    }
                    disabled={submitting}
                  />
                  <ExperimentMaterialsField
                    experimentId={experiment.id}
                    disabled={submitting}
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => void handleUpdate(experiment.id)}
                      className="rounded bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                    >
                      {submitting ? "Guardando..." : "Guardar cambios"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(experiment)}
                      className="rounded border border-red-300 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
