"use client";

import { usePathname } from "next/navigation";
import { SiteFooter } from "./site-footer";

/**
 * Decide el "chrome" (navegacion + contenedor) segun la ruta.
 *
 * La zona del alumno (`/alumno/*`) tiene su propio layout infantil
 * (barra superior propia, sin la navegacion de adultos), por lo que aqui
 * omitimos el MainNav y el contenedor acotado y dejamos que
 * `src/app/alumno/layout.tsx` controle toda la pantalla.
 */
export function SiteChrome({
  nav,
  children
}: {
  nav: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  // La zona del alumno y el manual del alumno traen su propio chrome infantil.
  const isBareArea =
    (pathname?.startsWith("/alumno") ?? false) ||
    (pathname?.startsWith("/manuales/alumno") ?? false);

  if (isBareArea) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen flex-col">
      {nav}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
      <SiteFooter />
    </div>
  );
}
