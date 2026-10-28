import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { StudentChallenge } from "@/components/students/student-challenge";
import type { CalendarWeek } from "@/lib/services/calendar-52-weeks";

/**
 * Prueba de EXPLORACIÓN de la condición del bug (bugfix: tu-avance-del-ano-enie-fix).
 *
 * Property 1: Bug Condition - Ortografía española correcta en cadenas de interfaz.
 *
 * Esta prueba codifica el COMPORTAMIENTO ESPERADO: el DOM debe contener las cuatro
 * cadenas con su ortografía española correcta (ñ/acentos). Por diseño, DEBE FALLAR
 * contra el código SIN corregir, demostrando que el bug existe. Cuando el arreglo se
 * implemente (tarea 3), esta misma prueba debe PASAR.
 *
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4
 */

// --- Mock de next/navigation: el componente usa useRouter() ---
// IMPORTANTE: el router debe ser un objeto ESTABLE entre renders. El componente
// memoiza `load` con dependencia [router] y re-ejecuta el efecto cuando `load`
// cambia; si useRouter() devolviera un objeto nuevo en cada render, el efecto se
// dispararía en bucle (cargar → render → nuevo router → recargar), dejando la UI
// oscilando en "Cargando..." y nunca mostraría el árbol cargado. Un router estable
// reproduce el comportamiento real (Next.js devuelve una instancia estable).
const { mockRouter } = vi.hoisted(() => ({
  mockRouter: { push: vi.fn(), refresh: vi.fn() }
}));

vi.mock("next/navigation", () => ({
  useRouter: () => mockRouter
}));

type ChallengeView = {
  challenge: {
    id: string;
    weekNumber: number;
    title: string;
    objective: string;
    endDate: string;
  } | null;
  steps: Array<{
    id: string;
    order: number;
    title: string;
    description: string;
    points: number;
    completed: boolean;
  }>;
  game: null;
  student: { alias: string };
};

function makeView(overrides: Partial<ChallengeView> = {}): ChallengeView {
  return {
    challenge: {
      id: "c1",
      weekNumber: 7,
      title: "Reto de reciclaje",
      objective: "Separar residuos durante una semana",
      endDate: "2025-01-10"
    },
    steps: [
      {
        id: "s1",
        order: 1,
        title: "Paso uno",
        description: "Haz esto",
        points: 10,
        completed: false
      }
    ],
    game: null,
    student: { alias: "Hojita" },
    ...overrides
  };
}

function makeCalendarWeeks(): CalendarWeek[] {
  return Array.from({ length: 52 }, (_, i) => ({
    weekNumber: i + 1,
    type: null,
    title: null,
    completed: false,
    isCurrent: false,
    published: false
  }));
}

// fetch mock: el componente hace fetch("/api/alumno/reto") al montar.
function mockFetchWithView(view: ChallengeView) {
  const fetchMock = vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ data: view })
  }));
  // @ts-expect-error - asignamos un mock a global.fetch para el entorno de prueba
  global.fetch = fetchMock;
  return fetchMock;
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe("StudentChallenge - Bug Condition: ortografía española correcta", () => {
  // Property 1 acotada a las cuatro cadenas literales identificadas.
  const bugCases = [
    {
      name: "2.1 encabezado de avance anual contiene 'Tu avance del año'",
      withChallenge: true,
      withCalendar: true,
      expected: /Tu avance del año/
    },
    {
      name: "2.2 aviso de evidencia contiene 'caras de niñas ni niños.'",
      withChallenge: true,
      withCalendar: false,
      expected: /caras de niñas ni niños\./
    },
    {
      name: "2.4 mensaje de la mascota contiene 'Yo te acompaño.'",
      withChallenge: true,
      withCalendar: false,
      expected: /Yo te acompaño\./
    },
    {
      name: "2.3 sin reto asignado, el encabezado es 'Todavía no hay reto'",
      withChallenge: false,
      withCalendar: false,
      expected: /Todavía no hay reto/
    }
  ];

  bugCases.forEach((tc) => {
    it(tc.name, async () => {
      const view = makeView(tc.withChallenge ? {} : { challenge: null });
      mockFetchWithView(view);

      render(
        <StudentChallenge
          calendarWeeks={tc.withCalendar ? makeCalendarWeeks() : null}
        />
      );

      // findByText reintenta hasta el timeout, dando tiempo a que termine la
      // carga inicial (fetch mock) y se renderice la rama correspondiente.
      // En el código SIN corregir, la cadena con ñ/acentos NO existe en el DOM,
      // por lo que esta aserción FALLA (contraejemplo que demuestra el bug).
      expect(await screen.findByText(tc.expected)).toBeInTheDocument();
    });
  });
});
