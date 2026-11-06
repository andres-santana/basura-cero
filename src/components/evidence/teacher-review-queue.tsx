"use client";

import { useCallback, useEffect, useState } from "react";
import { Lightbox, type LightboxItem } from "@/components/ui/lightbox";

type SubmissionStatus = "draft" | "submitted" | "approved" | "rejected";

type GroupSubmission = {
  id: string;
  status: SubmissionStatus;
  submittedAt: string | null;
  comments: string | null;
  group: { id: string; name: string | null; grade: string | null };
  challenge: {
    id: string;
    weekNumber: number | null;
    title: string | null;
    endDate: string | null;
  };
  participantsCount: number;
  metrics: { kgSeparated: number; reusedItems: number };
  studentTotals: { participants: number; kgSeparated: number; reusedItems: number };
  filesCount: number;
};

type SignedFile = {
  id: string;
  path: string;
  type: string;
  studentAlias: string | null;
  signedUrl: string | null;
};

const FILTERS: Array<{ id: string; label: string; statuses: SubmissionStatus[] | null }> = [
  { id: "pending", label: "Pendientes", statuses: ["submitted"] },
  { id: "approved", label: "Aprobadas", statuses: ["approved"] },
  { id: "rejected", label: "Rechazadas", statuses: ["rejected"] },
  { id: "all", label: "Todas", statuses: null }
];

function statusBadge(status: SubmissionStatus) {
  const map: Record<SubmissionStatus, { label: string; className: string }> = {
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

function isImage(type: string): boolean {
  return type.startsWith("image/");
}

export function TeacherReviewQueue() {
  const [filterId, setFilterId] = useState<string>("pending");
  const [data, setData] = useState<GroupSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filesById, setFilesById] = useState<Record<string, SignedFile[]>>({});
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  // Edicion local de metricas por entrega (kg / materiales).
  const [edits, setEdits] = useState<Record<string, { kg: string; reused: string }>>({});
  // Visor de imagenes: lista de imagenes de la entrega abierta + indice activo.
  const [lightboxItems, setLightboxItems] = useState<LightboxItem[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const openLightbox = (list: SignedFile[], fileId: string) => {
    const images = list.filter((f) => f.signedUrl && isImage(f.type));
    const items: LightboxItem[] = images.map((f) => ({
      id: f.id,
      url: f.signedUrl as string,
      caption: f.studentAlias ?? null
    }));
    const idx = items.findIndex((it) => it.id === fileId);
    setLightboxItems(items);
    setLightboxIndex(idx >= 0 ? idx : 0);
  };

  const filter = FILTERS.find((f) => f.id === filterId) ?? FILTERS[0];

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const query = filter.statuses
      ? `?status=${filter.statuses.join(",")}`
      : "?status=all";
    const res = await fetch(`/api/maestro/evidencias${query}`, { cache: "no-store" });
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
    const res = await fetch(`/api/maestro/evidencias/${id}/archivos`, {
      cache: "no-store"
    });
    const payload = await res.json();
    if (res.ok) setFilesById((cur) => ({ ...cur, [id]: payload.data ?? [] }));
  };

  const handleExpand = async (s: GroupSubmission) => {
    if (expandedId === s.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(s.id);
    setEdits((cur) =>
      cur[s.id]
        ? cur
        : {
            ...cur,
            [s.id]: {
              kg: String(s.metrics.kgSeparated),
              reused: String(s.metrics.reusedItems)
            }
          }
    );
    if (s.filesCount > 0) await loadFiles(s.id);
  };

  const patch = async (s: GroupSubmission, body: Record<string, unknown>) => {
    setActionLoadingId(s.id);
    setError(null);
    const res = await fetch(`/api/maestro/evidencias/${s.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      setError(payload.error ?? "No se pudo actualizar");
      setActionLoadingId(null);
      return false;
    }
    setActionLoadingId(null);
    return true;
  };

  const saveMetrics = async (s: GroupSubmission) => {
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

  const updateStatus = async (s: GroupSubmission, status: SubmissionStatus) => {
    const ok = await patch(s, { status });
    if (ok) await load();
  };

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-emerald-700">
          Evidencias de tus grupos
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Se arman automaticamente con lo que suben los alumnos. Aqui ves el total
          del grupo y puedes aprobarlo o rechazarlo. Para aprobar/rechazar la foto
          de un alumno o corregir sus kilos uno por uno, usa la seccion{" "}
          <span className="font-semibold text-emerald-700">
            Evidencias de alumnos
          </span>{" "}
          de abajo.
        </p>
      </div>

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
        <button
          type="button"
          onClick={() => void load()}
          className="ml-auto rounded border border-slate-300 px-3 py-1 text-xs text-slate-700 hover:bg-slate-50"
        >
          Refrescar
        </button>
      </div>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading && (
        <p className="rounded-xl border bg-white p-4 text-sm text-slate-500">
          Cargando...
        </p>
      )}

      {!loading && data.length === 0 && (
        <p className="rounded-xl border bg-white p-4 text-sm text-slate-500">
          No hay evidencias en este filtro.
        </p>
      )}

      <ul className="space-y-3">
        {data.map((s) => {
          const expanded = expandedId === s.id;
          const files = filesById[s.id] ?? [];
          const edit = edits[s.id] ?? {
            kg: String(s.metrics.kgSeparated),
            reused: String(s.metrics.reusedItems)
          };
          return (
            <li key={s.id} className="rounded-xl border bg-white">
              <button
                type="button"
                onClick={() => void handleExpand(s)}
                className="flex w-full flex-wrap items-center justify-between gap-3 p-4 text-left"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-sm">
                    {statusBadge(s.status)}
                    <span className="font-semibold text-slate-800">
                      {s.group.name ?? "Grupo"}
                    </span>
                    {s.group.grade && (
                      <span className="text-slate-500">· {s.group.grade}</span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    Semana {s.challenge.weekNumber ?? "?"} ·{" "}
                    {s.challenge.title ?? "Sin reto"} · {s.participantsCount}{" "}
                    participante(s) · {s.filesCount} foto(s)
                  </p>
                </div>
              </button>

              {expanded && (
                <div className="space-y-4 border-t border-slate-100 p-4">
                  {s.comments && (
                    <p className="text-sm text-slate-700">{s.comments}</p>
                  )}

                  <dl className="grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3 text-sm sm:grid-cols-4">
                    <div>
                      <dt className="text-xs text-slate-500">Participantes</dt>
                      <dd className="font-semibold text-slate-800">
                        {s.participantsCount}
                      </dd>
                      <dd className="text-[11px] text-slate-400">automatico</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">Kg (alumnos)</dt>
                      <dd className="font-semibold text-slate-800">
                        {s.studentTotals.kgSeparated}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">
                        Reutilizados (alumnos)
                      </dt>
                      <dd className="font-semibold text-slate-800">
                        {s.studentTotals.reusedItems}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">Alumnos que enviaron</dt>
                      <dd className="font-semibold text-slate-800">
                        {s.studentTotals.participants}
                      </dd>
                    </div>
                  </dl>

                  {/* Ajuste de metricas del grupo (override del maestro) */}
                  <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                    <label className="flex flex-col gap-1 text-sm">
                      <span className="text-slate-700">Kg separados (total)</span>
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
                      <span className="text-slate-700">
                        Materiales reutilizados (total)
                      </span>
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
                      disabled={actionLoadingId === s.id}
                      onClick={() => void saveMetrics(s)}
                      className="rounded-lg border border-emerald-300 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                    >
                      Guardar totales
                    </button>
                  </div>

                  {/* Fotos de los alumnos */}
                  {files.length > 0 ? (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {files.map((f) => (
                        <div
                          key={f.id}
                          className="overflow-hidden rounded-lg border border-slate-200"
                        >
                          {f.signedUrl ? (
                            isImage(f.type) ? (
                              <button
                                type="button"
                                onClick={() => openLightbox(files, f.id)}
                                className="block w-full cursor-zoom-in"
                                aria-label="Ver evidencia en grande"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={f.signedUrl}
                                  alt="Evidencia del alumno"
                                  className="h-40 w-full object-cover"
                                />
                              </button>
                            ) : (
                              <a
                                href={f.signedUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="block p-3 text-xs text-emerald-700 hover:underline"
                              >
                                Abrir archivo ({f.type})
                              </a>
                            )
                          ) : (
                            <p className="p-3 text-xs text-red-600">
                              No se pudo firmar la URL
                            </p>
                          )}
                          <p className="truncate border-t border-slate-200 px-2 py-1 text-[11px] text-slate-500">
                            {f.studentAlias ?? "Alumno"}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">
                      Esta evidencia aun no tiene fotos de alumnos.
                    </p>
                  )}

                  {/* Aprobar / rechazar */}
                  <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                    <button
                      type="button"
                      disabled={actionLoadingId === s.id || s.status === "approved"}
                      onClick={() => void updateStatus(s, "approved")}
                      className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      Aprobar
                    </button>
                    <button
                      type="button"
                      disabled={actionLoadingId === s.id || s.status === "rejected"}
                      onClick={() => void updateStatus(s, "rejected")}
                      className="rounded bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
                    >
                      Rechazar
                    </button>
                    {s.status !== "submitted" && (
                      <button
                        type="button"
                        disabled={actionLoadingId === s.id}
                        onClick={() => void updateStatus(s, "submitted")}
                        className="rounded border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50"
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
