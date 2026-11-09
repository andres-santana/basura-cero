"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Camera, CheckCircle2, Loader2, Trash2, Upload } from "lucide-react";
import { getErrorMessage } from "@/lib/error-message";
import { compressImage } from "@/lib/image/compress";
import { supabaseClient } from "@/lib/supabase/client";
import { Mascot } from "@/components/students/mascot";
import { Confetti } from "@/components/students/confetti";

type ExistingSubmission = {
  id: string;
  status: "draft" | "submitted" | "approved" | "rejected";
  comments: string | null;
  kgSeparated: number;
  reusedItems: number;
  recycledItems: number;
  materialQuantities: Record<string, number>;
  filesCount: number;
};

type ChallengeMaterial = {
  id: string;
  label: string;
  unitLabel: string;
  kind: "separado" | "reutilizado" | "reciclado";
};

const STATUS_LABEL: Record<ExistingSubmission["status"], string> = {
  draft: "Borrador",
  submitted: "Enviada, esperando revision",
  approved: "Aprobada",
  rejected: "Te pidieron volver a intentarlo"
};

export function StudentEvidenceUploader() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [comments, setComments] = useState("");
  const [kgSeparated, setKgSeparated] = useState("");
  const [reusedItems, setReusedItems] = useState("");
  const [recycledItems, setRecycledItems] = useState("");
  const [materials, setMaterials] = useState<ChallengeMaterial[]>([]);
  const [materialQty, setMaterialQty] = useState<Record<string, string>>({});
  const [existing, setExisting] = useState<ExistingSubmission | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const draftId = useMemo(() => {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return crypto.randomUUID();
    }
    return `draft-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }, []);

  const load = useCallback(async () => {
    const res = await fetch("/api/alumno/evidencia", { cache: "no-store" });
    if (res.status === 401) {
      router.push("/alumno");
      return;
    }
    const payload = await res.json();
    if (res.ok) {
      setExisting(payload.data ?? null);
      setMaterials(payload.materials ?? []);
      const saved = payload.data?.materialQuantities as
        | Record<string, number>
        | undefined;
      if (saved) {
        const asStrings: Record<string, string> = {};
        for (const [id, qty] of Object.entries(saved)) {
          if (qty > 0) asStrings[id] = String(qty);
        }
        setMaterialQty(asStrings);
      }
    }
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        await load();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const addFiles = (incoming: FileList | null) => {
    if (!incoming) return;
    const next = [...files];
    for (let i = 0; i < incoming.length; i += 1) next.push(incoming[i]);
    setFiles(next);
  };

  const removeFile = (index: number) => {
    setFiles((cur) => cur.filter((_, i) => i !== index));
  };

  const submit = async () => {
    setError(null);
    setSuccess(false);
    if (!files.length) {
      setError("Agrega al menos una foto");
      return;
    }
    setSubmitting(true);
    try {
      const uploaded: Array<{ path: string; type: string }> = [];
      for (let i = 0; i < files.length; i += 1) {
        setProgress(`Optimizando ${i + 1} de ${files.length}`);
        const file = await compressImage(files[i]);
        const contentType = file.type || "application/octet-stream";
        setProgress(`Subiendo ${i + 1} de ${files.length}`);
        const signRes = await fetch("/api/alumno/storage/upload-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ draftId, filename: file.name })
        });
        const signPayload = await signRes.json();
        if (!signRes.ok) throw new Error(signPayload.error ?? "No se pudo subir");
        const { error: upErr } = await supabaseClient.storage
          .from(signPayload.bucket)
          .uploadToSignedUrl(signPayload.path, signPayload.token, file, {
            contentType
          });
        if (upErr) throw new Error(upErr.message);
        uploaded.push({ path: signPayload.path, type: contentType });
      }

      setProgress("Guardando...");
      const res = await fetch("/api/alumno/evidencia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          comments: comments.trim() || undefined,
          kgSeparated: kgSeparated.trim() === "" ? 0 : Number(kgSeparated),
          reusedItems: reusedItems.trim() === "" ? 0 : Number(reusedItems),
          recycledItems: recycledItems.trim() === "" ? 0 : Number(recycledItems),
          materials: materials.map((m) => ({
            materialId: m.id,
            quantity:
              (materialQty[m.id] ?? "").trim() === ""
                ? 0
                : Number(materialQty[m.id])
          })),
          files: uploaded
        })
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error ?? "No se pudo guardar");

      setSuccess(true);
      setFiles([]);
      setComments("");
      setKgSeparated("");
      setReusedItems("");
      setRecycledItems("");
      setMaterialQty({});
      if (fileInputRef.current) fileInputRef.current.value = "";
      await load();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
      setProgress(null);
    }
  };

  if (loading) {
    return <div className="py-10 text-center text-lg text-slate-500">Cargando...</div>;
  }

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <header className="text-center">
        <Camera className="mx-auto h-12 w-12 text-emerald-600" aria-hidden />
        <h1 className="mt-2 text-2xl font-black text-emerald-700">Sube tu evidencia</h1>
      </header>

      <div className="rounded-2xl border-2 border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
        Recuerda: toma la foto de tu <strong>resultado</strong> (los residuos
        separados o tu manualidad). No subas fotos donde se vea la cara de ninas o ninos.
      </div>

      {existing && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border-2 border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 className="h-5 w-5" aria-hidden />
          Tu evidencia: <strong>{STATUS_LABEL[existing.status]}</strong>
          {existing.filesCount > 0 && <span>({existing.filesCount} foto(s))</span>}
          <span className="text-emerald-700">
            · {existing.kgSeparated} kg · {existing.reusedItems} reutilizadas ·{" "}
            {existing.recycledItems} recicladas
          </span>
        </div>
      )}

      {error && (
        <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {error}
        </p>
      )}
      {success && (
        <div className="relative flex items-center gap-3 overflow-hidden rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          <Confetti />
          <Mascot mood="celebra" size={56} className="shrink-0" />
          <span>Listo! Tu evidencia se envio. Tu maestra o maestro la va a revisar.</span>
        </div>
      )}

      <div className="rounded-3xl border-4 border-emerald-200 bg-white p-5">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex w-full flex-col items-center gap-2 rounded-2xl border-4 border-dashed border-emerald-200 bg-emerald-50 py-8 text-emerald-700 transition hover:border-emerald-400 active:scale-[0.98]"
        >
          <Upload className="h-10 w-10" aria-hidden />
          <span className="text-lg font-bold">Elegir fotos</span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => addFiles(e.target.files)}
        />

        {files.length > 0 && (
          <ul className="mt-4 space-y-2">
            {files.map((f, i) => (
              <li
                key={`${f.name}-${i}`}
                className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
              >
                <span className="truncate text-slate-700">{f.name}</span>
                <button
                  type="button"
                  onClick={() => removeFile(i)}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-coral-500 hover:bg-coral-50 hover:text-coral-600"
                  aria-label={`Quitar ${f.name}`}
                >
                  <Trash2 className="h-5 w-5" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}

        {materials.length > 0 && (
          <div className="mt-4 space-y-3 rounded-2xl border-2 border-emerald-200 bg-emerald-50/50 p-4">
            <p className="text-sm font-semibold text-slate-700">
              Cuenta lo que juntaste
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {materials.map((m) => (
                <label key={m.id} className="flex flex-col gap-1 text-sm">
                  <span className="font-semibold text-slate-700">
                    Cuantas {m.unitLabel} de {m.label}?
                  </span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step={1}
                    value={materialQty[m.id] ?? ""}
                    onChange={(e) =>
                      setMaterialQty((cur) => ({ ...cur, [m.id]: e.target.value }))
                    }
                    className="rounded-xl border border-slate-300 p-2 text-lg"
                    placeholder="0"
                  />
                </label>
              ))}
            </div>
            <p className="text-xs text-slate-500">
              Cuenta cuantas piezas juntaste de cada material. Tu maestra o maestro
              vera el total.
            </p>
          </div>
        )}

        {materials.length === 0 && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-slate-700">
              Cuantos kilos juntaste?
            </span>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step={0.1}
              value={kgSeparated}
              onChange={(e) => setKgSeparated(e.target.value)}
              className="rounded-xl border border-slate-300 p-2 text-lg"
              placeholder="0.5"
            />
            <span className="text-xs text-slate-500">
              En kilogramos (kg). Si no lo pesaste, pon tu mejor calculo. Ej: media
              bolsa es como 0.5 kg.
            </span>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-slate-700">
              Cuantas cosas reutilizaste?
            </span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              value={reusedItems}
              onChange={(e) => setReusedItems(e.target.value)}
              className="rounded-xl border border-slate-300 p-2 text-lg"
              placeholder="3"
            />
            <span className="text-xs text-slate-500">
              Cuenta los objetos que volviste a usar en vez de tirarlos (botellas,
              frascos, cajas...).
            </span>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-slate-700">
              Cuantas cosas reciclaste?
            </span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              value={recycledItems}
              onChange={(e) => setRecycledItems(e.target.value)}
              className="rounded-xl border border-slate-300 p-2 text-lg"
              placeholder="2"
            />
            <span className="text-xs text-slate-500">
              Cuenta los objetos que entregaste para reciclar (latas, papel,
              plastico que ya no sirve para reutilizar...).
            </span>
          </label>
        </div>
        )}

        <label className="mt-4 flex flex-col gap-1 text-sm">
          <span className="text-slate-700">Cuentanos que hiciste (opcional)</span>
          <textarea
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            rows={3}
            maxLength={500}
            className="rounded-xl border border-slate-300 p-2"
            placeholder="Separe el plastico y el papel..."
          />
        </label>

        <button
          type="button"
          onClick={() => void submit()}
          disabled={submitting}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-6 py-4 text-xl font-black text-white transition hover:bg-emerald-700 active:scale-95 disabled:opacity-60 disabled:active:scale-100"
        >
          {submitting ? <Loader2 className="h-6 w-6 animate-spin" aria-hidden /> : <Upload className="h-6 w-6" aria-hidden />}
          {progress ?? "Enviar mi evidencia"}
        </button>
      </div>

      <div className="text-center">
        <Link href="/alumno/reto" className="text-sm font-semibold text-emerald-600 underline">
          Volver a mi reto
        </Link>
      </div>
    </div>
  );
}
