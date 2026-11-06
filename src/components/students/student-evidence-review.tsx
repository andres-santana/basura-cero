"use client";

import { useCallback, useEffect, useState } from "react";
import { Lightbox, type LightboxItem } from "@/components/ui/lightbox";

type Status = "draft" | "submitted" | "approved" | "rejected";

type StudentSubmission = {
  id: string;
  status: Status;
  submittedAt: string | null;
  comments: string | null;
  kgSeparated: number;
  reusedItems: number;
  student: { alias: string; grade: string | null };
  group: { id: string; name: string | null };
  weekNumber: number | null;
  experimentTitle: string | null;
  filesCount: number;
};

type SignedFile = { id: string; path: string; type: string; signedUrl: string | null };

const FILTERS: Array<{ id: string; label: string; statuses: Status[] | null }> = [
  { id: "pending", label: "Pendientes", statuses: ["submitted"] },
  { id: "approved", label: "Aprobadas", statuses: ["approved"] },
  { id: "rejected", label: "Rechazadas", statuses: ["rejected"] },
  { id: "all", label: "Todas", statuses: null }
];

function statusBadge(status: Status) {
  const map: Record<Status, { label: string; className: string }> = {
    draft: { label: "Borrador", className: "bg-slate-200 text-slate-700" },
    submitted: { label: "Pendiente", className: "bg-amber-100 text-amber-800" },
    approved: { label: "Aprobada", className: "bg-emerald-100 text-emerald-800" },
    rejected: { label: "Rechazada", className: "bg-red-100 text-red-700" }
  };
  const info = map[status];
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${info.className}`}>
      {info.label}
    </span>
  );
}

function isImage(type: string) {
  return type.startsWith("image/");
}

export function StudentEvidenceReview() {
  const [filterId, setFilterId] = useState("pending");
  const [data, setData] = useState<StudentSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filesById, setFilesById] = useState<Record<string, SignedFile[]>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  // Edicion local de metricas por alumno (kg / materiales).
  const [edits, setEdits] = useState<Record<string, { kg: string; reused: string }>>({});
  // Visor de imagenes.
  const [lightboxItems, setLightboxItems] = useState<LightboxItem[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const openLightbox = (list: SignedFile[], fileId: string, alias: string) => {
    const images = list.filter((f) => f.signedUrl && isImage(f.type));
    const items: LightboxItem[] = images.map((f) => ({
      id: f.id,
      url: f.signedUrl as string,
      caption: alias
    }));
    const idx = items.findIndex((it) => it.id === fileId);
    setLightboxItems(items);
    setLightboxIndex(idx >= 0 ? idx : 0);
  };

  const filter = FILTERS.find((f) => f.id === filterId) ?? FILTERS[0];

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const query = filter.statuses ? `?status=${filter.statuses.join(",")}` : "?status=all";
    const res = await fetch(`/api/maestro/alumnos-evidencias${query}`, { cache: "no-store" });
    const payload = await res.json();
    if (!res.ok) {
      setError(payload.error ?? "No se pudieron cargar las evidencias");
      setData([]);
    } else {
      setData(payload.data ?? []);
    }
    setLoading(false);
  }, [filter.statuses]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadFiles = async (id: string) => {
    if (filesById[id]) return;
    const res = await fetch(`/api/maestro/alumnos-evidencias/${id}/archivos`, {
      cache: "no-store"
    });
    const payload = await res.json();
    if (res.ok) setFilesById((cur) => ({ ...cur, [id]: payload.data ?? [] }));
  };

  const expand = async (s: StudentSubmission) => {
    if (expandedId === s.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(s.id);
    setEdits((cur) =>
      cur[s.id]
        ? cur
        : { ...cur, [s.id]: { kg: String(s.kgSeparated), reused: String(s.reusedItems) } }
    );
    if (s.filesCount > 0) await loadFiles(s.id);
  };

  const patch = async (s: StudentSubmission, body: Record<string, unknown>) => {
    setBusyId(s.id);
    setError(null);
    const res = await fetch(`/api/maestro/alumnos-evidencias/${s.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const ok = res.ok;
    if (!ok) {
      const payload = await res.json().catch(() => ({}));
      setError(payload.error ?? "No se pudo actualizar");
    }
    setBusyId(null);
    return ok;
  };

  const updateStatus = async (s: StudentSubmission, status: Status) => {
    const ok = await patch(s, { status });
    if (ok) await load();
  };

  const saveMetrics = async (s: StudentSubmission) => {
    const edit = edits[s.id];
    if (!edit) return;
    const kg = edit.kg.trim() === "" ? 0 : Number(edit.kg);
    const reused = edit.reused.trim() === "" ? 0 : Number(edit.reused);
    if (Number.isNaN(kg) || Number.isNaN(reused)) {
      setError("Revisa los valores de kg y materiales");
      return;
    }
    const ok = await patch(s, { kgSeparated: kg, reusedItems: reused });
    if (ok) await load();
  };

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-bold text-emerald-700">Evidencias de alumnos</h2>
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilterId(f.id)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              filterId === f.id
                ? "bg-emerald-600 text-white"
                : "border border-slate-300 text-slate-700 hover:bg-slate-50"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
      {loading && <p className="text-sm text-slate-500">Cargando...</p>}
      {!loading && data.length === 0 && (
        <p className="rounded-xl border bg-white p-4 text-sm text-slate-500">
          No hay evidencias de alumnos en este filtro.
        </p>
      )}

      <ul className="space-y-3">
        {data.map((s) => {
          const expanded = expandedId === s.id;
          const files = filesById[s.id] ?? [];
          const edit = edits[s.id] ?? {
            kg: String(s.kgSeparated),
            reused: String(s.reusedItems)
          };
          return (
            <li key={s.id} className="rounded-xl border bg-white">
              <button
                type="button"
                onClick={() => void expand(s)}
                className="flex w-full flex-wrap items-center justify-between gap-3 p-4 text-left"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-sm">
                    {statusBadge(s.status)}
                    <span className="font-semibold text-slate-800">{s.student.alias}</span>
                    {s.group.name && <span className="text-slate-500">· {s.group.name}</span>}
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    Semana {s.weekNumber ?? "?"} · {s.experimentTitle ?? "Sin reto"} ·{" "}
                    {s.filesCount} foto(s) · {s.kgSeparated} kg · {s.reusedItems} reutilizados
                  </p>
                </div>
              </button>

              {expanded && (
                <div className="space-y-3 border-t border-slate-100 p-4">
                  {s.comments && <p className="text-sm text-slate-700">{s.comments}</p>}

                  {/* Metricas reportadas por el alumno, editables por el maestro */}
                  <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                    <label className="flex flex-col gap-1 text-sm">
                      <span className="text-slate-700">Kg separados</span>
                      <input
                        type="number"
                        min={0}
                        step={0.1}
                        value={edit.kg}
                        onChange={(e) =>
                          setEdits((cur) => ({
                            ...cur,
                            [s.id]: { ...edit, kg: e.target.value }
                          }))
                        }
                        className="rounded-lg border border-slate-300 p-2"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-sm">
                      <span className="text-slate-700">Materiales reutilizados</span>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={edit.reused}
                        onChange={(e) =>
                          setEdits((cur) => ({
                            ...cur,
                            [s.id]: { ...edit, reused: e.target.value }
                          }))
                        }
                        className="rounded-lg border border-slate-300 p-2"
                      />
                    </label>
                    <button
                      type="button"
                      disabled={busyId === s.id}
                      onClick={() => void saveMetrics(s)}
                      className="rounded-lg border border-emerald-300 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                    >
                      Guardar datos
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    El alumno reporto {s.kgSeparated} kg y {s.reusedItems} materiales.
                    Ajustalo si el dato no es real. Las evidencias rechazadas no suman
                    al total del grupo.
                  </p>

                  <div className="flex flex-wrap gap-3">
                    {files.map((f) =>
                      f.signedUrl && isImage(f.type) ? (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => openLightbox(files, f.id, s.student.alias)}
                          className="cursor-zoom-in rounded-lg border"
                          aria-label="Ver evidencia en grande"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={f.signedUrl}
                            alt="Evidencia del alumno"
                            className="h-32 w-32 rounded-lg object-cover"
                          />
                        </button>
                      ) : (
                        <a
                          key={f.id}
                          href={f.signedUrl ?? "#"}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded border px-3 py-2 text-xs text-emerald-700 underline"
                        >
                          Ver archivo
                        </a>
                      )
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busyId === s.id || s.status === "approved"}
                      onClick={() => void updateStatus(s, "approved")}
                      className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      Aprobar
                    </button>
                    <button
                      type="button"
                      disabled={busyId === s.id || s.status === "rejected"}
                      onClick={() => void updateStatus(s, "rejected")}
                      className="rounded border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      Rechazar
                    </button>
                    {s.status !== "submitted" && (
                      <button
                        type="button"
                        disabled={busyId === s.id}
                        onClick={() => void updateStatus(s, "submitted")}
                        className="rounded border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                      >
                        Regresar a pendiente
                      </button>
                    )}
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <Lightbox
        items={lightboxItems}
        index={lightboxIndex}
        onClose={() => setLightboxIndex(null)}
        onNavigate={setLightboxIndex}
      />
    </section>
  );
}
