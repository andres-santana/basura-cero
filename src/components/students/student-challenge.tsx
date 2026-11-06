"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BookOpenText, Camera, CheckCircle2, Circle, LogOut, Sparkles, Trophy } from "lucide-react";
import { getErrorMessage } from "@/lib/error-message";
import { MiniGame, type MiniGameData } from "@/components/students/mini-game";
import { Mascot } from "@/components/students/mascot";
import { MascotBubble } from "@/components/students/mascot-bubble";
import { XpBar } from "@/components/students/xp-bar";
import { Calendar52Weeks } from "@/components/gamification/calendar-52-weeks";
import type { CalendarWeek } from "@/lib/services/calendar-52-weeks";

type Step = {
  id: string;
  order: number;
  title: string;
  description: string;
  points: number;
  completed: boolean;
};

type ChallengeView = {
  challenge: {
    id: string;
    weekNumber: number;
    title: string;
    objective: string;
    endDate: string;
  } | null;
  steps: Step[];
  game: MiniGameData | null;
  student: { alias: string };
};

export function StudentChallenge({
  calendarWeeks = null
}: {
  calendarWeeks?: CalendarWeek[] | null;
}) {
  const router = useRouter();
  const [view, setView] = useState<ChallengeView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyStep, setBusyStep] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/alumno/reto", { cache: "no-store" });
    if (res.status === 401) {
      router.push("/alumno");
      return;
    }
    const payload = await res.json();
    if (!res.ok) throw new Error(payload.error ?? "No pudimos cargar tu reto");
    setView(payload.data);
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        await load();
      } catch (err) {
        if (!cancelled) setError(getErrorMessage(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const toggleStep = async (step: Step) => {
    setError(null);
    setBusyStep(step.id);
    const previousView = view;
    const nextCompleted = !step.completed;
    // Actualizacion optimista: invertimos el estado del paso al instante para
    // que lo derivado (palomita/circulo, animate-pop, borde/fondo, contador,
    // barra de XP y animo de la mascota) se recalcule sin esperar al backend.
    setView((current) =>
      current
        ? {
            ...current,
            steps: current.steps.map((s) =>
              s.id === step.id ? { ...s, completed: nextCompleted } : s
            )
          }
        : current
    );
    try {
      const res = await fetch("/api/alumno/pasos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stepId: step.id, completed: nextCompleted })
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error ?? "No se pudo guardar");
      await load();
    } catch (err) {
      // Reversion: restauramos la vista previa y mostramos el error.
      setView(previousView);
      setError(getErrorMessage(err));
    } finally {
      setBusyStep(null);
    }
  };

  const completeGame = async (score: number) => {
    if (!view?.game) return;
    const res = await fetch("/api/alumno/juego", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gameId: view.game.id, score })
    });
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      throw new Error(payload.error ?? "No se pudo guardar el juego");
    }
    await load();
  };

  const logout = async () => {
    await fetch("/api/alumno/acceso", { method: "DELETE" });
    router.push("/alumno");
    router.refresh();
  };

  if (loading) {
    return <div className="py-10 text-center text-lg text-slate-500">Cargando tu reto...</div>;
  }

  if (!view?.challenge) {
    return (
      <div className="mx-auto max-w-xl rounded-3xl border-4 border-amber-200 bg-amber-50 p-8 text-center">
        <Mascot mood="animo" size={96} className="mx-auto" />
        <h1 className="mt-3 text-2xl font-black text-amber-800">Todavía no hay reto</h1>
        <p className="mt-2 text-base text-amber-900">
          Pregunta a tu maestra o maestro cuando empiece el reto de esta semana.
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <Link
            href="/manuales/alumno"
            className="inline-flex items-center gap-1.5 rounded-2xl border-2 border-emerald-200 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
          >
            <BookOpenText className="h-4 w-4" aria-hidden /> Ver mi manual
          </Link>
          <button
            type="button"
            onClick={() => void logout()}
            className="rounded-2xl border-2 border-amber-300 px-4 py-2 text-sm font-semibold text-amber-800"
          >
            Salir
          </button>
        </div>
      </div>
    );
  }

  const completedSteps = view.steps.filter((s) => s.completed).length;
  const totalSteps = view.steps.length;

  // XP de la semana a partir de datos reales: puntos de pasos completados
  // mas los puntos del juego si esta completo, sobre el total posible.
  const stepPointsEarned = view.steps
    .filter((s) => s.completed)
    .reduce((sum, s) => sum + (s.points ?? 0), 0);
  const stepPointsTotal = view.steps.reduce((sum, s) => sum + (s.points ?? 0), 0);
  const gamePoints = view.game?.points ?? 0;
  const xpEarned = stepPointsEarned + (view.game?.completed ? gamePoints : 0);
  const xpTotal = stepPointsTotal + gamePoints;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-emerald-600">Tu reto</p>
          <h1 className="text-2xl font-black text-emerald-700">
            Semana {view.challenge.weekNumber}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/manuales/alumno"
            className="inline-flex items-center gap-1 rounded-2xl border-2 border-emerald-200 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
          >
            <BookOpenText className="h-4 w-4" aria-hidden /> Manual
          </Link>
          <button
            type="button"
            onClick={() => void logout()}
            className="inline-flex items-center gap-1 rounded-2xl border-2 border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            <LogOut className="h-4 w-4" aria-hidden /> Salir
          </button>
        </div>
      </header>

      <MascotBubble
        mood={completedSteps === totalSteps && totalSteps > 0 ? "celebra" : "animo"}
        title={`Vamos, ${view.student.alias}!`}
        message={
          totalSteps > 0 && completedSteps === totalSteps
            ? "Terminaste todos tus pasos. Eres genial!"
            : "Completa tus pasos y sube tu foto. Yo te acompaño."
        }
      />

      {xpTotal > 0 && <XpBar earned={xpEarned} total={xpTotal} />}

      {error && (
        <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      <section className="rounded-3xl border-4 border-emerald-200 bg-emerald-50 p-5">
        <div className="flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-emerald-600" aria-hidden />
          <h2 className="text-xl font-black text-emerald-900">{view.challenge.title}</h2>
        </div>
        <p className="mt-2 text-base text-emerald-900">{view.challenge.objective}</p>
      </section>

      <section className="rounded-3xl border-4 border-emerald-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black text-emerald-700">Tus pasos</h2>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-sm font-bold text-emerald-800">
            <Trophy className="h-4 w-4" aria-hidden /> {completedSteps}/{totalSteps}
          </span>
        </div>
        <ul className="mt-4 space-y-2">
          {view.steps.map((step) => (
            <li key={step.id}>
              <button
                type="button"
                onClick={() => void toggleStep(step)}
                disabled={busyStep === step.id}
                aria-pressed={step.completed}
                className={`flex w-full items-start gap-3 rounded-2xl border-2 p-4 text-left transition active:scale-[0.98] ${
                  step.completed
                    ? "animate-pop border-emerald-300 bg-emerald-50"
                    : "border-slate-200 bg-white hover:border-emerald-300"
                }`}
              >
                {step.completed ? (
                  <CheckCircle2 className="mt-0.5 h-7 w-7 shrink-0 text-emerald-600" aria-hidden />
                ) : (
                  <Circle className="mt-0.5 h-7 w-7 shrink-0 text-slate-300" aria-hidden />
                )}
                <span>
                  <span className="block text-lg font-bold text-slate-800">{step.title}</span>
                  <span className="block text-sm text-slate-600">{step.description}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {view.game && <MiniGame game={view.game} onComplete={completeGame} />}

      {calendarWeeks && (
        <section className="rounded-3xl border-4 border-eco-100 bg-white p-5">
          <h2 className="font-display text-xl font-black text-eco-700">
            Tu avance del año
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Cada cuadrito es una semana. Los de palomita ya los lograron!
          </p>
          <div className="mt-4">
            <Calendar52Weeks weeks={calendarWeeks} compact />
          </div>
        </section>
      )}

      <section className="rounded-3xl border-4 border-emerald-200 bg-white p-5 text-center">
        <Camera className="mx-auto h-10 w-10 text-emerald-600" aria-hidden />
        <h2 className="mt-2 text-xl font-black text-emerald-700">Sube tu evidencia</h2>
        <p className="mt-1 text-sm text-slate-600">
          Toma una foto de tu resultado. Importante: que no salgan caras de niñas ni niños.
        </p>
        <Link
          href="/alumno/evidencia"
          className="mt-4 inline-block rounded-2xl bg-emerald-600 px-6 py-3 text-lg font-black text-white transition hover:bg-emerald-700 hover:-translate-y-0.5 active:scale-95"
        >
          Subir mi foto
        </Link>
      </section>
    </div>
  );
}
