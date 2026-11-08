"use client";

import { useCallback, useEffect, useState } from "react";
import { Lightbox, type LightboxItem } from "@/components/ui/lightbox";

type SubmissionStatus = "draft" | "submitted" | "approved" | "rejected";

type Submission = {
  id: string;
  status: SubmissionStatus;
  submittedAt: string | null;
  comments: string;
  participantsCount: number;
  group: { id: string; name: string | null; grade: string | null };
  challenge: {
    id: string;
    startDate: string | null;
    endDate: string | null;
    weekNumber: number | null;
    title: string | null;
    objective: string | null;
  };
  metrics: {
    kgSeparated: number;
    reusedItems: number;
    recycledItems: number;
    wasteReducedEstimate: number;
  };
  score: {
    pointsTotal: number;
    breakdown: Record<string, number>;
  } | null;
  files: Array<{ id: string; path: string; type: string }>;
  /** Conteo real de archivos = archivos del grupo + fotos de alumnos del reto. */
  filesCount: number;
};

type SignedFile = {
  id: string;
  path: string;
  type: string;
  signedUrl: string | null;
};

const FILTERS: Array<{ id: string; label: string; statuses: SubmissionStatus[] | null }> = [
  { id: "pending", label: "Pendientes", statuses: ["submitted"] },
  { id: "approved", label: "Aprobadas", statuses: ["approved"] },
  { id: "rejected", label: "Rechazadas", statuses: ["rejected"] },
  { id: "draft", label: "Borradores", statuses: ["draft"] },
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

function formatDate(value: string | null): string {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("es-MX", {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function isImage(type: string): boolean {
  return type.startsWith("image/");
}

export function AdminReviewQueue() {
  const [filterId, setFilterId] = useState<string>("pending");
  const [data, setData] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filesById, setFilesById] = useState<Record<string, SignedFile[]>>({});
  const [filesLoadingId, setFilesLoadingId] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [lightboxItems, setLightboxItems] = useState<LightboxItem[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const openLightbox = (list: SignedFile[], fileId: string) => {
    const images = list.filter((f) => f.signedUrl && isImage(f.type));
    const items: LightboxItem[] = images.map((f) => ({
      id: f.id,
      url: f.signedUrl as string,
      caption: f.path.split("/").pop() ?? null
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
    const res = await fetch(`/api/admin/evidencias${query}`, { cache: "no-store" });
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

  const loadFiles = async (submissionId: string) => {
    if (filesById[submissionId]) return;
    setFilesLoadingId(submissionId);
    const res = await fetch(
      `/api/admin/evidencias/${submissionId}/archivos`,
      { cache: "no-store" }
    );
    const payload = await res.json();
    if (res.ok) {
      setFilesById((current) => ({ ...current, [submissionId]: payload.data ?? [] }));
    }
    setFilesLoadingId(null);
  };

  const handleExpand = async (submission: Submission) => {
    if (expandedId === submission.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(submission.id);
    if (submission.filesCount > 0) {
      await loadFiles(submission.id);
    }
  };

  const updateStatus = async (
    submission: Submission,
    status: SubmissionStatus
  ) => {
    setActionLoadingId(submission.id);
    setError(null);
    const res = await fetch(`/api/admin/evidencias/${submission.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status })
    });
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      setError(payload.error ?? "No se pudo actualizar");
      setActionLoadingId(null);
      return;
    }
    setActionLoadingId(null);
    await load();
  };

  return (
    <section className="space-y-4">
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
          return (
            <li key={s.id} className="rounded-xl border bg-white">
              <button
                type="button"
                onClick={() => void handleExpand(s)}
                className="flex w-full flex-wrap items-center justify-between gap-3 p-4 text-left"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-sm">
                    {statusBadge(s.status)}
                    <span className="font-semibold text-slate-800">
                      Grupo {s.group.name ?? "?"}{" "}
                      {s.group.grade && (
                        <span className="text-slate-500">({s.group.grade})</span>
                      )}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    Semana {s.challenge.weekNumber ?? "?"} -{" "}
                    {s.challenge.title ?? "Sin reto"} -{" "}
                    Enviado {formatDate(s.submittedAt)}
                  </p>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-600">
                  <span>{s.filesCount} archivo(s)</span>
                  <span>
                    {s.metrics.kgSeparated.toFixed(1)} kg
                  </span>
                  {s.score && (
                    <span className="font-semibold text-emerald-700">
                      {s.score.pointsTotal} pts
                    </span>
                  )}
                  <span className="text-slate-400">
                    {expanded ? "Cerrar" : "Ver"}
                  </span>
                </div>
              </button>

              {expanded && (
                <div className="space-y-4 border-t border-slate-100 p-4 text-sm">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-500">
                        Comentarios
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-slate-800">
                        {s.comments}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-500">
                        Metricas
                      </p>
                      <ul className="mt-1 space-y-0.5 text-slate-700">
                        <li>Participantes: {s.participantsCount}</li>
                        <li>Kg separados: {s.metrics.kgSeparated.toFixed(2)}</li>
                        <li>Reutilizados: {s.metrics.reusedItems}</li>
                        <li>Reciclados: {s.metrics.recycledItems}</li>
                        {s.score && (
                          <li className="font-semibold text-emerald-700">
                            Puntaje calculado: {s.score.pointsTotal}
                          </li>
                        )}
                      </ul>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      Evidencias
                    </p>
                    {filesLoadingId === s.id && (
                      <p className="mt-1 text-xs text-slate-500">Cargando archivos...</p>
                    )}
                    {filesLoadingId !== s.id && files.length === 0 && (
                      <p className="mt-1 text-xs text-slate-500">
                        Sin archivos adjuntos.
                      </p>
                    )}
                    {files.length > 0 && (
                      <div className="mt-2 grid gap-3 sm:grid-cols-3">
                        {files.map((f) => (
                          <div
                            key={f.id}
                            className="overflow-hidden rounded border border-slate-200 bg-slate-50"
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
                                    alt="Evidencia"
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
                            <p className="truncate border-t border-slate-200 px-2 py-1 text-[10px] text-slate-500">
                              {f.path.split("/").pop()}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {(s.status === "submitted" ||
                    s.status === "approved" ||
                    s.status === "rejected") && (
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
                  )}
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
