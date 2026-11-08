import Link from "next/link";
import type { Route } from "next";
import { getRoleFromSession } from "@/lib/auth";
import { LogoutButton } from "./logout-button";

const publicLinks: Array<{ href: Route; label: string }> = [
  { href: "/", label: "Inicio" },
  { href: "/semana-actual", label: "Semana actual" },
  { href: "/experimentos", label: "Experimentos" },
  { href: "/calendario", label: "Calendario" },
  { href: "/ranking", label: "Ranking" },
  { href: "/insignias", label: "Insignias" },
  { href: "/jurado", label: "Jurado" }
];

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin",
  teacher: "Maestro",
  group: "Grupo",
  jury: "Jurado"
};

export async function MainNav() {
  const role = await getRoleFromSession();

  return (
    <header className="border-b border-emerald-100 bg-white/80 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-3 text-sm font-medium">
        {publicLinks.map((link) => (
          <Link key={link.href} href={link.href}>
            {link.label}
          </Link>
        ))}
        {role === "admin" && <Link href="/dashboard/admin">Panel admin</Link>}
        {(role === "teacher" || role === "group") && (
          <Link href="/dashboard/maestro">Mi panel</Link>
        )}

        <div className="ml-auto flex items-center gap-2">
          {role ? (
            <>
              <span className="text-xs text-slate-500">{ROLE_LABEL[role] ?? role}</span>
              <LogoutButton />
            </>
          ) : (
            <>
              <Link
                href="/alumno"
                className="rounded-full border border-emerald-300 px-3 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
              >
                Soy alumno
              </Link>
              <Link
                href="/login"
                className="rounded bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700"
              >
                Acceder
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
