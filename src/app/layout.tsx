import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { MainNav } from "@/components/layout/main-nav";
import { SiteChrome } from "@/components/layout/site-chrome";

// Fuentes autohospedadas (next/font/local) para evitar la descarga desde
// Google Fonts en tiempo de build, que fallaba en Vercel (next/font google
// loader). Fredoka y Nunito son fuentes variables: un woff2 por subset cubre
// todo el rango de pesos.

// Fuente display redondeada (titulos y botones) con soporte de espanol.
const displayFont = localFont({
  src: [
    { path: "./fonts/fredoka-latin.woff2", style: "normal" },
    { path: "./fonts/fredoka-latin-ext.woff2", style: "normal" }
  ],
  weight: "500 700",
  variable: "--font-display",
  display: "swap"
});

// Fuente de cuerpo legible para lectores noveles.
const bodyFont = localFont({
  src: [
    { path: "./fonts/nunito-latin.woff2", style: "normal" },
    { path: "./fonts/nunito-latin-ext.woff2", style: "normal" }
  ],
  weight: "400 800",
  variable: "--font-body",
  display: "swap"
});

export const metadata: Metadata = {
  title: "Basura Cero en 52 Semanas",
  description: "Plataforma escolar de retos ecologicos"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${displayFont.variable} ${bodyFont.variable}`}>
      <body>
        <SiteChrome nav={<MainNav />}>{children}</SiteChrome>
      </body>
    </html>
  );
}
