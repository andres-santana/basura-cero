"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QRCodeSVG } from "qrcode.react";
import { FileUp, Loader2, Printer, Upload } from "lucide-react";
import { getErrorMessage } from "@/lib/error-message";

type Group = { id: string; name: string; grade: string };

type ParsedRow = { grupo: string; alias: string; grado?: string };

type RowResult = {
  grupo: string;
  alias: string;
  grado: string | null;
  status: "created" | "skipped" | "error";
  code?: string;
  message?: string;
};

type Summary = { total: number; created: number; skipped: number; errors: number };

const CSV_EXAMPLE = `grupo,alias,grado
4A,4A-01,4
4A,4A-02,4
4B,4B-01,4`;

/** Parsea CSV simple con encabezado grupo,alias,grado. Tolera ; y , y comillas basicas. */
function parseCsv(text: string): { rows: ParsedRow[]; error: string | null } {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) return { rows: [], error: "El archivo esta vacio" };

  const delimiter = lines[0].includes(";") && !lines[0].includes(",") ? ";" : ",";
  const splitLine = (line: string) =>
    line.split(delimiter).map((c) => c.trim().replace(/^"|"$/g, ""));

  const header = splitLine(lines[0]).map((h) => h.toLowerCase());
  const gi = header.indexOf("grupo");
  const ai = header.indexOf("alias");
  const di = header.indexOf("grado");

  if (gi === -1 || ai === -1) {
    return {
      rows: [],
      error: 'El encabezado debe incluir al menos las columnas "grupo" y "alias"'
    };
  }

  const rows: ParsedRow[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cells = splitLine(lines[i]);
    const grupo = cells[gi] ?? "";
    const alias = cells[ai] ?? "";
    const grado = di !== -1 ? cells[di] ?? "" : "";
    if (!grupo && !alias) continue;
    rows.push({ grupo, alias, grado: grado || undefined });
  }

  if (rows.length === 0) return { rows: [], error: "No se encontraron filas de datos" };
  return { rows, error: null };
}

/** URL de acceso embebida en el QR (misma convencion que el resto del proyecto). */
function accessUrl(code: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/alumno?codigo=${encodeURIComponent(code)}`;
}

/** Genera y abre una ventana de impresion (PDF) con las tarjetas de un grupo. */
function printGroupCards(groupName: string, created: RowResult[]) {
  const cards = created
    .map((r) => {
      const url = accessUrl(r.code ?? "");
      const qr = renderToStaticMarkup(
        <QRCodeSVG value={url} size={150} level="M" includeMargin />
      );
      return `
        <div class="card">
          <div class="group">${escapeHtml(groupName)}</div>
          <div class="alias">${escapeHtml(r.alias)}</div>
          <div class="qr">${qr}</div>
          <div class="code">${escapeHtml(r.code ?? "")}</div>
          <div class="hint">Escanea el QR o escribe tu codigo en la pagina del alumno.</div>
        </div>`;
    })
    .join("");

  const html = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Codigos de acceso - ${escapeHtml(groupName)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; margin: 0; padding: 16px; color: #0f172a; }
    h1 { font-size: 18px; margin: 0 0 4px; }
    .subtitle { font-size: 12px; color: #475569; margin: 0 0 16px; }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
    .card { border: 2px solid #a7f3d0; border-radius: 14px; padding: 12px; text-align: center; page-break-inside: avoid; }
    .group { font-size: 12px; font-weight: 700; color: #047857; text-transform: uppercase; letter-spacing: 0.05em; }
    .alias { font-size: 18px; font-weight: 800; margin: 2px 0 8px; color: #0f172a; }
    .qr { display: flex; justify-content: center; }
    .qr svg { width: 150px; height: 150px; }
    .code { margin-top: 8px; font-size: 22px; font-weight: 800; letter-spacing: 0.15em; color: #065f46; }
    .hint { margin-top: 4px; font-size: 9px; color: #64748b; }
    @media print {
      body { padding: 0; }
      .grid { gap: 8px; }
    }
  </style>
</head>
<body>
  <h1>Codigos de acceso - Grupo ${escapeHtml(groupName)}</h1>
  <p class="subtitle">${created.length} alumno(s). Entrega un recuadro a cada quien. El codigo no se vuelve a mostrar en el sistema.</p>
  <div class="grid">${cards}</div>
  <script>window.onload = function () { window.print(); };</script>
</body>
</html>`;

  const win = window.open("", "_blank");
  if (!win) {
    alert(
      "Tu navegador bloqueo la ventana de impresion. Permite ventanas emergentes e intenta de nuevo."
    );
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function AlumnosCargaMasiva() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [csvText, setCsvText] = useState("");
  const [parsed, setParsed] = useState<ParsedRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [results, setResults] = useState<RowResult[]>([]);

  const loadGroups = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/usuarios/grupos", { cache: "no-store" });
      const payload = await res.json();
      if (res.ok) setGroups(payload.data ?? []);
    } catch {
      // No es critico; la carga valida contra el servidor de todos modos.
    }
  }, []);

  useEffect(() => {
    void loadGroups();
  }, [loadGroups]);

  // Re-parsea cuando cambia el texto.
  useEffect(() => {
    if (!csvText.trim()) {
      setParsed([]);
      setParseError(null);
      return;
    }
    const { rows, error: err } = parseCsv(csvText);
    setParsed(rows);
    setParseError(err);
  }, [csvText]);

  const onFile = async (file: File) => {
    const text = await file.text();
    setCsvText(text);
  };

  const knownGroupNames = useMemo(
    () => new Set(groups.map((g) => g.name.trim().toLowerCase().replace(/\s+/g, ""))),
    [groups]
  );

  const unknownGroups = useMemo(() => {
    if (!parsed.length || !groups.length) return [];
    const seen = new Set<string>();
    for (const r of parsed) {
      const key = r.grupo.trim().toLowerCase().replace(/\s+/g, "");
      if (key && !knownGroupNames.has(key)) seen.add(r.grupo.trim());
    }
    return [...seen];
  }, [parsed, groups, knownGroupNames]);

  const createdByGroup = useMemo(() => {
    const map = new Map<string, RowResult[]>();
    for (const r of results) {
      if (r.status !== "created") continue;
      const list = map.get(r.grupo) ?? [];
      list.push(r);
      map.set(r.grupo, list);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [results]);

  const submit = async () => {
    setError(null);
    setSummary(null);
    setResults([]);
    if (!parsed.length) {
      setError("No hay filas para cargar");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/usuarios/alumnos/lote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: parsed })
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error ?? "No se pudo cargar el lote");
      setSummary(payload.summary);
      setResults(payload.results ?? []);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-xs text-emerald-900">
        <strong>Privacidad:</strong> usa solo un apodo (alias) por alumno. No registres
        nombres reales, apellidos, correos ni fotos. El codigo de acceso se muestra una
        sola vez: descarga o imprime los PDF por grupo tras la carga.
      </div>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="rounded-xl border bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-700">
            1. Pega o sube tu CSV
          </h3>
          <label className="inline-flex cursor-pointer items-center gap-1 rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50">
            <FileUp className="h-3.5 w-3.5" /> Subir archivo
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onFile(f);
              }}
            />
          </label>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Columnas: <code>grupo,alias,grado</code> (grado es opcional). El grupo debe
          coincidir con un grupo existente (ej. 4A, 5B).
        </p>
        <textarea
          value={csvText}
          onChange={(e) => setCsvText(e.target.value)}
          placeholder={CSV_EXAMPLE}
          rows={8}
          className="mt-2 w-full rounded-lg border border-slate-300 p-2 font-mono text-xs"
        />

        {parseError && (
          <p className="mt-2 text-xs font-medium text-red-600">{parseError}</p>
        )}

        {parsed.length > 0 && !parseError && (
          <p className="mt-2 text-xs text-slate-600">
            {parsed.length} fila(s) detectada(s).
            {unknownGroups.length > 0 && (
              <span className="text-amber-700">
                {" "}
                Grupos sin coincidencia: {unknownGroups.join(", ")} (esas filas daran
                error).
              </span>
            )}
          </p>
        )}

        <button
          type="button"
          onClick={() => void submit()}
          disabled={submitting || parsed.length === 0 || !!parseError}
          className="mt-3 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          Cargar {parsed.length > 0 ? `${parsed.length} alumno(s)` : "alumnos"}
        </button>
      </div>

      {summary && (
        <div className="rounded-xl border bg-white p-4">
          <h3 className="text-sm font-semibold text-slate-700">2. Resultado</h3>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-800">
              Creados: {summary.created}
            </span>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-800">
              Omitidos (ya existian): {summary.skipped}
            </span>
            <span className="rounded-full bg-red-100 px-2 py-0.5 font-medium text-red-800">
              Errores: {summary.errors}
            </span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
              Total: {summary.total}
            </span>
          </div>

          {createdByGroup.length > 0 && (
            <div className="mt-4">
              <h4 className="text-xs font-semibold text-slate-700">
                3. Imprime los codigos por grupo (PDF)
              </h4>
              <p className="mt-1 text-xs text-amber-700">
                Hazlo ahora: los codigos no se vuelven a mostrar.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {createdByGroup.map(([groupName, list]) => (
                  <button
                    key={groupName}
                    type="button"
                    onClick={() => printGroupCards(groupName, list)}
                    className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
                  >
                    <Printer className="h-3.5 w-3.5" />
                    {groupName} ({list.length})
                  </button>
                ))}
              </div>
            </div>
          )}

          {(summary.skipped > 0 || summary.errors > 0) && (
            <div className="mt-4 overflow-x-auto">
              <h4 className="text-xs font-semibold text-slate-700">
                Filas no creadas
              </h4>
              <table className="mt-1 min-w-full divide-y divide-slate-200 text-xs">
                <thead className="bg-slate-50 text-left uppercase text-slate-500">
                  <tr>
                    <th className="px-2 py-1">Grupo</th>
                    <th className="px-2 py-1">Alias</th>
                    <th className="px-2 py-1">Estado</th>
                    <th className="px-2 py-1">Detalle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {results
                    .filter((r) => r.status !== "created")
                    .map((r, i) => (
                      <tr key={`${r.grupo}-${r.alias}-${i}`}>
                        <td className="px-2 py-1">{r.grupo}</td>
                        <td className="px-2 py-1">{r.alias}</td>
                        <td className="px-2 py-1">
                          <span
                            className={
                              r.status === "skipped"
                                ? "text-amber-700"
                                : "text-red-700"
                            }
                          >
                            {r.status === "skipped" ? "Omitido" : "Error"}
                          </span>
                        </td>
                        <td className="px-2 py-1 text-slate-500">{r.message ?? "-"}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
