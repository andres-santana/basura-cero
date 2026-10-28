"use client";

import { useCallback, useEffect, useState } from "react";
import { AlumnosCargaMasiva } from "@/components/admin/alumnos-carga-masiva";

type Tab = "maestros" | "grupos" | "jurado" | "alumnos";

type Teacher = {
  id: string;
  userId: string;
  fullName: string;
  email: string | null;
  isActive: boolean;
  groups: Array<{ id: string; name: string; grade: string }>;
};

type Group = {
  id: string;
  name: string;
  grade: string;
  teacherId: string | null;
  teacherName: string | null;
};

type Jury = {
  id: string;
  email: string;
  isActive: boolean;
};

type CreatedCredential = {
  email: string;
  temporaryPassword: string;
};

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "maestros", label: "Maestros" },
  { id: "grupos", label: "Grupos" },
  { id: "jurado", label: "Jurado" },
  { id: "alumnos", label: "Alumnos (carga masiva)" }
];

export function UsuariosManager() {
  const [tab, setTab] = useState<Tab>("maestros");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-3 py-2 text-sm font-medium transition ${
              tab === t.id
                ? "border-b-2 border-emerald-600 text-emerald-700"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "maestros" && <MaestrosPanel />}
      {tab === "grupos" && <GruposPanel />}
      {tab === "jurado" && <JuradoPanel />}
      {tab === "alumnos" && <AlumnosCargaMasiva />}
    </div>
  );
}

function CredentialCallout({
  credential,
  onDismiss
}: {
  credential: CreatedCredential;
  onDismiss: () => void;
}) {
  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm">
      <p className="font-semibold text-emerald-800">Usuario creado</p>
      <p className="mt-1 text-emerald-900">
        Entrega estas credenciales temporales una sola vez. En el primer ingreso
        el usuario debera elegir una contrasena personal antes de acceder al panel.
      </p>
      <dl className="mt-3 grid gap-1 sm:grid-cols-[120px_1fr]">
        <dt className="text-emerald-700">Correo</dt>
        <dd className="font-mono text-slate-800">{credential.email}</dd>
        <dt className="text-emerald-700">Contrasena</dt>
        <dd className="font-mono text-slate-800">{credential.temporaryPassword}</dd>
      </dl>
      <button
        type="button"
        onClick={onDismiss}
        className="mt-3 rounded border border-emerald-300 px-3 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
      >
        Cerrar
      </button>
    </div>
  );
}

function ErrorBanner({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
      {message}
    </div>
  );
}

function MaestrosPanel() {
  const [data, setData] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [credential, setCredential] = useState<CreatedCredential | null>(null);
  const [form, setForm] = useState({ email: "", fullName: "", password: "" });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/admin/usuarios/maestros", { cache: "no-store" });
    const payload = await res.json();
    if (!res.ok) {
      setError(payload.error ?? "No se pudieron cargar los maestros");
    } else {
      setData(payload.data ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/admin/usuarios/maestros", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: form.email,
        fullName: form.fullName,
        password: form.password || undefined
      })
    });
    const payload = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      setError(payload.error ?? "No se pudo crear el maestro");
      return;
    }
    setCredential({
      email: payload.email,
      temporaryPassword: payload.temporaryPassword
    });
    setForm({ email: "", fullName: "", password: "" });
    await load();
  };

  const toggleActive = async (teacher: Teacher) => {
    setError(null);
    const res = await fetch(`/api/admin/usuarios/maestros/${teacher.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !teacher.isActive })
    });
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      setError(payload.error ?? "No se pudo actualizar");
      return;
    }
    await load();
  };

  return (
    <div className="space-y-4">
      {credential && (
        <CredentialCallout
          credential={credential}
          onDismiss={() => setCredential(null)}
        />
      )}
      <ErrorBanner message={error} />

      <form
        onSubmit={handleSubmit}
        className="grid gap-3 rounded-xl border bg-white p-4 sm:grid-cols-2"
      >
        <div className="sm:col-span-2 text-sm font-semibold text-slate-700">
          Nuevo maestro
        </div>
        <label className="text-sm">
          <span className="block text-slate-600">Nombre completo</span>
          <input
            required
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
          />
        </label>
        <label className="text-sm">
          <span className="block text-slate-600">Correo</span>
          <input
            required
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
          />
        </label>
        <label className="text-sm sm:col-span-2">
          <span className="block text-slate-600">
            Contrasena (opcional, se genera si lo dejas vacio)
          </span>
          <input
            type="text"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder="min. 8 caracteres"
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
          />
        </label>
        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={submitting}
            className="rounded bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {submitting ? "Creando..." : "Crear maestro"}
          </button>
        </div>
      </form>

      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Nombre</th>
              <th className="px-3 py-2">Correo</th>
              <th className="px-3 py-2">Grupos</th>
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
            {!loading && data.length === 0 && (
              <tr>
                <td className="px-3 py-3 text-slate-500" colSpan={5}>
                  Aun no hay maestros registrados.
                </td>
              </tr>
            )}
            {data.map((t) => (
              <tr key={t.id}>
                <td className="px-3 py-2">{t.fullName}</td>
                <td className="px-3 py-2 font-mono text-xs">{t.email ?? "-"}</td>
                <td className="px-3 py-2">
                  {t.groups.length === 0
                    ? "-"
                    : t.groups
                        .map((g) => `${g.name} (${g.grade})`)
                        .join(", ")}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      t.isActive
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    {t.isActive ? "Activo" : "Inactivo"}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => toggleActive(t)}
                    className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50"
                  >
                    {t.isActive ? "Desactivar" : "Activar"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function GruposPanel() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: "", grade: "", teacherId: "" });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [gRes, tRes] = await Promise.all([
      fetch("/api/admin/usuarios/grupos", { cache: "no-store" }),
      fetch("/api/admin/usuarios/maestros", { cache: "no-store" })
    ]);
    const gPayload = await gRes.json();
    const tPayload = await tRes.json();
    if (!gRes.ok) setError(gPayload.error ?? "No se pudieron cargar los grupos");
    else setGroups(gPayload.data ?? []);
    if (tRes.ok) setTeachers(tPayload.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/admin/usuarios/grupos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        grade: form.grade,
        teacherId: form.teacherId || null
      })
    });
    const payload = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      setError(payload.error ?? "No se pudo crear el grupo");
      return;
    }
    setForm({ name: "", grade: "", teacherId: "" });
    await load();
  };

  const handleAssign = async (group: Group, teacherId: string) => {
    setError(null);
    const res = await fetch(`/api/admin/usuarios/grupos/${group.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teacherId: teacherId || null })
    });
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      setError(payload.error ?? "No se pudo asignar el maestro");
      return;
    }
    await load();
  };

  const handleDelete = async (group: Group) => {
    if (!confirm(`Eliminar grupo "${group.name}"?`)) return;
    setError(null);
    const res = await fetch(`/api/admin/usuarios/grupos/${group.id}`, {
      method: "DELETE"
    });
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      setError(payload.error ?? "No se pudo eliminar el grupo");
      return;
    }
    await load();
  };

  return (
    <div className="space-y-4">
      <ErrorBanner message={error} />

      <form
        onSubmit={handleSubmit}
        className="grid gap-3 rounded-xl border bg-white p-4 sm:grid-cols-3"
      >
        <div className="sm:col-span-3 text-sm font-semibold text-slate-700">
          Nuevo grupo
        </div>
        <label className="text-sm">
          <span className="block text-slate-600">Nombre</span>
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Ej. 3A"
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
          />
        </label>
        <label className="text-sm">
          <span className="block text-slate-600">Grado</span>
          <input
            required
            value={form.grade}
            onChange={(e) => setForm({ ...form, grade: e.target.value })}
            placeholder="Ej. 3o primaria"
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
          />
        </label>
        <label className="text-sm">
          <span className="block text-slate-600">Maestro (opcional)</span>
          <select
            value={form.teacherId}
            onChange={(e) => setForm({ ...form, teacherId: e.target.value })}
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
          >
            <option value="">Sin asignar</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.fullName}
              </option>
            ))}
          </select>
        </label>
        <div className="sm:col-span-3">
          <button
            type="submit"
            disabled={submitting}
            className="rounded bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {submitting ? "Creando..." : "Crear grupo"}
          </button>
        </div>
      </form>

      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Grupo</th>
              <th className="px-3 py-2">Grado</th>
              <th className="px-3 py-2">Maestro</th>
              <th className="px-3 py-2">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && (
              <tr>
                <td className="px-3 py-3 text-slate-500" colSpan={4}>
                  Cargando...
                </td>
              </tr>
            )}
            {!loading && groups.length === 0 && (
              <tr>
                <td className="px-3 py-3 text-slate-500" colSpan={4}>
                  Aun no hay grupos registrados.
                </td>
              </tr>
            )}
            {groups.map((g) => (
              <tr key={g.id}>
                <td className="px-3 py-2">{g.name}</td>
                <td className="px-3 py-2">{g.grade}</td>
                <td className="px-3 py-2">
                  <select
                    value={g.teacherId ?? ""}
                    onChange={(e) => handleAssign(g, e.target.value)}
                    className="rounded border border-slate-300 px-2 py-1 text-xs"
                  >
                    <option value="">Sin asignar</option>
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.fullName}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => handleDelete(g)}
                    className="rounded border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function JuradoPanel() {
  const [data, setData] = useState<Jury[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [credential, setCredential] = useState<CreatedCredential | null>(null);
  const [form, setForm] = useState({ email: "", password: "" });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/admin/usuarios/jurado", { cache: "no-store" });
    const payload = await res.json();
    if (!res.ok) setError(payload.error ?? "No se pudo cargar el jurado");
    else setData(payload.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/admin/usuarios/jurado", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: form.email,
        password: form.password || undefined
      })
    });
    const payload = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      setError(payload.error ?? "No se pudo crear el jurado");
      return;
    }
    setCredential({
      email: payload.email,
      temporaryPassword: payload.temporaryPassword
    });
    setForm({ email: "", password: "" });
    await load();
  };

  const toggleActive = async (jury: Jury) => {
    setError(null);
    const res = await fetch(`/api/admin/usuarios/jurado/${jury.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !jury.isActive })
    });
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      setError(payload.error ?? "No se pudo actualizar");
      return;
    }
    await load();
  };

  return (
    <div className="space-y-4">
      {credential && (
        <CredentialCallout
          credential={credential}
          onDismiss={() => setCredential(null)}
        />
      )}
      <ErrorBanner message={error} />

      <form
        onSubmit={handleSubmit}
        className="grid gap-3 rounded-xl border bg-white p-4 sm:grid-cols-2"
      >
        <div className="sm:col-span-2 text-sm font-semibold text-slate-700">
          Nuevo jurado
        </div>
        <label className="text-sm">
          <span className="block text-slate-600">Correo</span>
          <input
            required
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
          />
        </label>
        <label className="text-sm">
          <span className="block text-slate-600">
            Contrasena (opcional)
          </span>
          <input
            type="text"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder="min. 8 caracteres"
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
          />
        </label>
        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={submitting}
            className="rounded bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {submitting ? "Creando..." : "Crear jurado"}
          </button>
        </div>
      </form>

      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Correo</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && (
              <tr>
                <td className="px-3 py-3 text-slate-500" colSpan={3}>
                  Cargando...
                </td>
              </tr>
            )}
            {!loading && data.length === 0 && (
              <tr>
                <td className="px-3 py-3 text-slate-500" colSpan={3}>
                  Aun no hay miembros del jurado.
                </td>
              </tr>
            )}
            {data.map((j) => (
              <tr key={j.id}>
                <td className="px-3 py-2 font-mono text-xs">{j.email}</td>
                <td className="px-3 py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      j.isActive
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    {j.isActive ? "Activo" : "Inactivo"}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => toggleActive(j)}
                    className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50"
                  >
                    {j.isActive ? "Desactivar" : "Activar"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
