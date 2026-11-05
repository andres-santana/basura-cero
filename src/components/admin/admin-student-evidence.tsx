"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type StudentStatus = "draft" | "submitted" | "approved" | "rejected";

type StudentSubmission = {
  id: string;
  status: StudentStatus;
  submittedAt: string | null;
  comments: string | null;
  student: { alias: string; grade: string | null };
  group: { id: string; name: string | null; grade: string | null };
  teacher: { id: string | null; name: string | null };
  weekNumber: number | null;
  experimentTitle: string | null;
  filesCount: number;
};

type SignedFile = {
  id: string;
  path: string;
  type: string;
  signedUrl: string | null;
};

const FILTERS: Array<{ id: string; label: string; statuses: StudentStatus[] | null }> = [
  { id: "all", label: "Todas", statuses: null },
  { id: "submitted", label: "Pendientes", statuses: ["submitted"] },
  { id: "approved", label: "Aprobadas", statuses: ["approved"] },
  { id: "rejected", label: "Rechazadas", statuses: ["rejected"] },
  { id: "draft", label: "Borradores", statuses: ["draft"] }
];

function statusBadge(status: StudentStatus) {
  const map: Record<StudentStatus, { label: string; className: string }> = {
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
  return d.toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" });
}

function isImage(type: string): boolean {
  return type.startsWith("image/");
}

type TeacherGroup = {
  key: string;
  teacherName: string;
  groupId: string;
  groupName: string;
  groupGrade: string | null;
  items: StudentSubmission[];
  pending: number;
};

export function AdminStudentEvidence() {
  const [filterId, setFilterId] = useState<string>("all");
  const [data, setData] = useState<StudentSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filesById, setFilesById] = useState<Record<string, SignedFile[]>>({});
  const [filesLoadingId, setFilesLoadingId] = useState<string | null>(null);

  const filter = FILTERS.find((f) => f.id === filterId) ?? FILTERS[0];

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const query = filter.statuses
      ? `?status=${filter.statuses.join(",")}`
      : "?status=all";
    const res = await fetch(`/api/admin/alumnos-evidencias${query}`, {
      cache: "no-store"
    });
    const payload = await res.json();
    if (!res.ok) {
      setError(payload.error ?? "No se pudieron cargar las evidencias de alumnos");
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
    const res = await fetch(`/api/admin/alumnos-evidencias/${submissionId}/archivos`, {
      cache: "no-store"
    });
    const payload = await res.json();
    if (res.ok) {
      setFilesById((current) => ({ ...current, [submissionId]: payload.data ?? [] }));
    }
    setFilesLoadingId(null);
  };

  const handleExpand = async (submission: StudentSubmission) => {
    if (expandedId === submission.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(submission.id);
    if (submission.filesCount > 0) {
      await loadFiles(submission.id);
    }
  };

  // Agrupar por profesor, luego por grupo.
  const grouped = useMemo(() => {
    const byTeacher = new Map<
      string,
      { teacherName: string; groups: Map<string, TeacherGroup> }
    >();

    for (const item of data) {
      const teacherName = item.teacher.name ?? "Sin maestro asignado";
      const teacherKey = item.teacher.id ?? `none:${teacherName}`;
      if (!byTeacher.has(teacherKey)) {
        byTeacher.set(teacherKey, { teacherName, groups: new Map() });
      }
      const teacherEntry = byTeacher.get(teacherKey)!;
      const groupKey = item.group.id;
      if (!teacherEntry.groups.has(groupKey)) {
        teacherEntry.groups.set(groupKey, {
          key: `${teacherKey}:${groupKey}`,
          teacherName,
          groupId: item.group.id,
          groupName: item.group.name ?? "Grupo",
          groupGrade: item.group.grade,
          items: [],
          pending: 0
        });
      }
      const group = teacherEntry.groups.get(groupKey)!;
      group.items.push(item);
      if (item.status === "submitted") group.pending += 1;
    }

    return Array.from(byTeacher.values())
      .map((t) => ({
        teacherName: t.teacherName,
        groups: Array.from(t.groups.values()).sort((a, b) =>
          a.groupName.localeCompare(b.groupName, "es")
        ),
        pending: Array.from(t.groups.values()).reduce((acc, g) => acc + g.pending, 0)
      }))
      .sort((a, b) => a.teacherName.localeCompare(b.teacherName, "es"));
  }, [data]);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
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

      <p className="text-xs text-slate-500">
        Vista de solo lectura para monitorear el avance. La revision y aprobacion de cada
        evidencia la realiza el maestro del grupo.
      </p>

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

      {!loading && grouped.length === 0 && (
        <p className="rounded-xl border bg-white p-4 text-sm text-slate-500">
          No hay evidencias de alumnos en este filtro.
        </p>
      )}

      <div className="space-y-6">
        {grouped.map((teacher) => (
          <div key={teacher.teacherName} className="space-y-3">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-800">
                {teacher.teacherName}
              </h3>
              {teacher.pending > 0 && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                  {teacher.pending} sin revisar
                </span>
              )}
            </div>

            {teacher.groups.map((group) => (
              <div key={group.key} className="rounded-xl border bg-white">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-2">
                  <p className="text-sm font-medium text-slate-700">
                    Grupo {group.groupName}{" "}
                    {group.groupGrade && (
                      <span className="text-slate-500">({group.groupGrade})</span>
                    )}
                  </p>
                  <span className="text-xs text-slate-500">
                    {group.items.length} evidencia(s)
                    {group.pending > 0 && ` - ${group.pending} pendiente(s)`}
                  </span>
                </div>

                <ul className="divide-y divide-slate-100">
                  {group.items.map((s) => {
                    const expanded = expandedId === s.id;
                    const files = filesById[s.id] ?? [];
                    return (
                      <li key={s.id}>
                        <button
                          type="button"
                          onClick={() => void handleExpand(s)}
                          className="flex w-full flex-wrap items-center justify-between gap-3 p-4 text-left"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 text-sm">
                              {statusBadge(s.status)}
                              <span className="font-semibold text-slate-800">
                                {s.student.alias}
                              </span>
                              {s.student.grade && (
                                <span className="text-xs text-slate-500">
                                  ({s.student.grade})
                                </span>
                              )}
                            </div>
                            <p className="mt-1 text-xs text-slate-500">
                              Semana {s.weekNumber ?? "?"} -{" "}
                              {s.experimentTitle ?? "Sin reto"} - Enviado{" "}
                              {formatDate(s.submittedAt)}
                            </p>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-slate-600">
                            <span>{s.filesCount} archivo(s)</span>
                            <span className="text-slate-400">
                              {expanded ? "Cerrar" : "Ver"}
                            </span>
                          </div>
                        </button>

                        {expanded && (
                          <div className="space-y-3 border-t border-slate-100 p-4 text-sm">
                            <div>
                              <p className="text-xs uppercase tracking-wide text-slate-500">
                                Comentarios
                              </p>
                              <p className="mt-1 whitespace-pre-wrap text-slate-800">
                                {s.comments || "Sin comentarios."}
                              </p>
                            </div>

                            <div>
                              <p className="text-xs uppercase tracking-wide text-slate-500">
                                Evidencias
                              </p>
                              {filesLoadingId === s.id && (
                                <p className="mt-1 text-xs text-slate-500">
                                  Cargando archivos...
                                </p>
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
                                          <a
                                            href={f.signedUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="block"
                                          >
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img
                                              src={f.signedUrl}
                                              alt="Evidencia"
                                              className="h-40 w-full object-cover"
                                            />
                                          </a>
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
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
