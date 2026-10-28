import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, waitFor, within } from "@testing-library/react";
import { StudentChallenge } from "@/components/students/student-challenge";
import type { CalendarWeek } from "@/lib/services/calendar-52-weeks";

/**
 * Pruebas de PRESERVACIÓN (bugfix: tu-avance-del-ano-enie-fix).
 *
 * Property 2: Preservation - Resto de la pantalla sin cambios.
 *
 * Metodología "observation-first": estas pruebas capturan el comportamiento BASE del
 * componente para todas las entradas donde la condición del bug NO se cumple
 * (isBugCondition = false). DEBEN PASAR contra el código SIN corregir — codifican la
 * línea base que el arreglo (tarea 3) no debe alterar. Tras el arreglo deben seguir
 * pasando (sin regresiones).
 *
 * Cobertura:
 *  - Cadenas de interfaz ya correctas: "Sube tu evidencia", "Tus pasos",
 *    "Subir mi foto", "Salir", "Cargando tu reto...".
 *  - Valores dinámicos: alias del alumno, número de semana, título/objetivo del reto,
 *    calendario de 52 semanas.
 *  - Interacciones: marcar/desmarcar pasos (toggleStep), minijuego (completeGame),
 *    barra de XP (XpBar) y botón de salir (logout).
 *
 * Enfoque basado en propiedades: se generan múltiples `view` (variando alias, número de
 * semana, títulos y objetivos) y estados con/sin reto asignado, para dar garantías
 * fuertes de que el comportamiento no afectado permanece intacto.
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4
 */

// --- Mock de next/navigation: el componente usa useRouter() ---
// IMPORTANTE: el router debe ser un objeto ESTABLE entre renders. El componente
// memoiza `load` con dependencia [router] y re-ejecuta el efecto cuando `load`
// cambia; si useRouter() devolviera un objeto nuevo en cada render, el efecto se
// dispararía en bucle (cargar → render → nuevo router → recargar), dejando la UI
// oscilando en "Cargando...". Un router estable reproduce el comportamiento real
// (Next.js devuelve una instancia estable).
const { mockPush, mockRefresh, mockRouter } = vi.hoisted(() => {
  const push = vi.fn();
  const refresh = vi.fn();
  return { mockPush: push, mockRefresh: refresh, mockRouter: { push, refresh } };
});

vi.mock("next/navigation", () => ({
  useRouter: () => mockRouter
}));

type GameConfig = {
  pairs: Array<{ left: string; right: string }>;
};

type GameView = {
  id: string;
  type: "relacionar";
  title: string;
  points: number;
  config: GameConfig;
  completed: boolean;
} | null;

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
  game: GameView;
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
// Devuelve siempre `view` para las peticiones GET y una respuesta ok para
// las acciones (pasos/juego/acceso) que disparan las interacciones.
function mockFetchWithView(view: ChallengeView) {
  const fetchMock = vi.fn(async (input: unknown) => {
    const url = typeof input === "string" ? input : String(input);
    if (url.includes("/api/alumno/reto")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ data: view })
      };
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({ data: {} })
    };
  });
  // @ts-expect-error - asignamos un mock a global.fetch para el entorno de prueba
  global.fetch = fetchMock;
  return fetchMock;
}

// Renderiza el componente y espera a que aparezca un ancla estable del árbol ya
// cargado (tras el fetch inicial). Devuelve el resultado de render para hacer
// consultas acotadas al árbol propio y evitar interferencia entre pruebas.
async function renderLoaded(
  calendarWeeks: CalendarWeek[] | null,
  anchor: RegExp | string
) {
  const result = render(<StudentChallenge calendarWeeks={calendarWeeks} />);
  await result.findByText(anchor);
  return result;
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// --- Dominio de entrada generado (variación de valores dinámicos) ---
// Distintos `view` para ejercitar la propiedad de preservación sobre varios inputs.
const dynamicViews: Array<{ name: string; view: ChallengeView }> = [
  {
    name: "alias='Hojita', semana=7",
    view: makeView()
  },
  {
    name: "alias='Sol', semana=1, título/objetivo distintos",
    view: makeView({
      challenge: {
        id: "c2",
        weekNumber: 1,
        title: "Compostaje en casa",
        objective: "Crear una composta con restos de comida",
        endDate: "2025-02-01"
      },
      student: { alias: "Sol" }
    })
  },
  {
    name: "alias='Mar 123', semana=52, varios pasos",
    view: makeView({
      challenge: {
        id: "c3",
        weekNumber: 52,
        title: "Gran cierre del año",
        objective: "Resumir el impacto logrado",
        endDate: "2025-12-20"
      },
      steps: [
        { id: "s1", order: 1, title: "Paso A", description: "Desc A", points: 5, completed: false },
        { id: "s2", order: 2, title: "Paso B", description: "Desc B", points: 15, completed: false }
      ],
      student: { alias: "Mar 123" }
    })
  },
  {
    name: "alias='Río', semana=30, título con acentos",
    view: makeView({
      challenge: {
        id: "c4",
        weekNumber: 30,
        title: "Reducción de plástico",
        objective: "Evitar botellas de un solo uso",
        endDate: "2025-08-15"
      },
      student: { alias: "Río" }
    })
  }
];

describe("StudentChallenge - Preservación: cadenas ya correctas (3.1)", () => {
  // Property 2: cadenas correctas presentes para cualquier `view` con reto asignado.
  dynamicViews.forEach(({ name, view }) => {
    it(`mantiene cadenas correctas con reto asignado [${name}]`, async () => {
      mockFetchWithView(view);
      const { getByText, getByRole } = await renderLoaded(
        makeCalendarWeeks(),
        "Tus pasos"
      );

      expect(getByText("Sube tu evidencia")).toBeInTheDocument();
      expect(getByText("Tus pasos")).toBeInTheDocument();
      expect(getByText("Subir mi foto")).toBeInTheDocument();
      // "Salir" aparece en el header cuando hay reto asignado.
      expect(getByRole("button", { name: /Salir/ })).toBeInTheDocument();
    });
  });

  it("muestra 'Cargando tu reto...' durante la carga inicial", () => {
    // fetch que nunca resuelve: el componente permanece en estado de carga.
    const pending = new Promise(() => {});
    // @ts-expect-error - mock de fetch para el entorno de prueba
    global.fetch = vi.fn(() => pending);

    const { getByText } = render(<StudentChallenge calendarWeeks={null} />);
    expect(getByText("Cargando tu reto...")).toBeInTheDocument();
  });
});

describe("StudentChallenge - Preservación: valores dinámicos (3.3)", () => {
  // Property 2: las interpolaciones dinámicas se renderizan tal cual provienen de datos.
  dynamicViews.forEach(({ name, view }) => {
    it(`renderiza alias, semana, título y objetivo desde datos [${name}]`, async () => {
      mockFetchWithView(view);
      const challenge = view.challenge!;
      const { getByText } = await renderLoaded(makeCalendarWeeks(), challenge.title);

      // Número de semana interpolado en el encabezado.
      expect(getByText(`Semana ${challenge.weekNumber}`)).toBeInTheDocument();
      // Alias interpolado en el saludo de la burbuja de la mascota.
      expect(getByText(`Vamos, ${view.student.alias}!`)).toBeInTheDocument();
      // Título y objetivo del reto vienen de datos.
      expect(getByText(challenge.title)).toBeInTheDocument();
      expect(getByText(challenge.objective)).toBeInTheDocument();
    });
  });

  it("muestra el calendario de 52 semanas cuando calendarWeeks está presente", async () => {
    mockFetchWithView(makeView());
    const { getByText } = await renderLoaded(makeCalendarWeeks(), "Tus pasos");

    // El bloque del calendario solo se renderiza con reto asignado + calendarWeeks.
    // Observamos la línea de ayuda estática del bloque (no afectada por el bug).
    expect(getByText(/Cada cuadrito es una semana/)).toBeInTheDocument();
  });

  it("no renderiza el calendario cuando calendarWeeks es null", async () => {
    mockFetchWithView(makeView());
    const { queryByText } = await renderLoaded(null, "Tus pasos");

    expect(queryByText(/Cada cuadrito es una semana/)).not.toBeInTheDocument();
  });
});

describe("StudentChallenge - Preservación: estado sin reto asignado (3.1/3.3)", () => {
  // Property 2: la rama "sin reto" conserva su texto y acciones (excepto el encabezado,
  // que es una de las cadenas afectadas por el bug y se valida en la prueba de bug).
  dynamicViews.forEach(({ name, view }) => {
    it(`conserva el cuerpo del estado sin reto [${name}]`, async () => {
      mockFetchWithView(makeView({ challenge: null, student: view.student }));
      const { getByText, getByRole } = await renderLoaded(
        null,
        /Pregunta a tu maestra o maestro/
      );

      expect(getByText(/Pregunta a tu maestra o maestro/)).toBeInTheDocument();
      expect(getByRole("button", { name: "Salir" })).toBeInTheDocument();
    });
  });
});

describe("StudentChallenge - Preservación: interacciones (3.2)", () => {
  it("toggleStep: al marcar un paso hace POST a /api/alumno/pasos y recarga", async () => {
    const view = makeView();
    const fetchMock = mockFetchWithView(view);
    const { getByRole } = await renderLoaded(null, "Tus pasos");

    const stepButton = getByRole("button", { name: /Paso uno/ });
    expect(stepButton).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(stepButton);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/alumno/pasos",
        expect.objectContaining({ method: "POST" })
      );
    });

    // El cuerpo enviado refleja el toggle del paso.
    const pasosCall = fetchMock.mock.calls.find((c) => c[0] === "/api/alumno/pasos");
    expect(pasosCall).toBeTruthy();
    const body = JSON.parse((pasosCall![1] as { body: string }).body);
    expect(body).toEqual({ stepId: "s1", completed: true });
  });

  it("XpBar: muestra los puntos de la semana calculados desde datos", async () => {
    // Un paso de 10 puntos sin completar => 0 / 10.
    const view = makeView();
    mockFetchWithView(view);
    const { getByLabelText } = await renderLoaded(null, "Tus pasos");

    const xp = getByLabelText(/Llevas 0 de 10 puntos esta semana/);
    expect(xp).toBeInTheDocument();
    const progress = within(xp).getByRole("progressbar");
    expect(progress).toHaveAttribute("aria-valuenow", "0");
    expect(progress).toHaveAttribute("aria-valuemax", "10");
  });

  it("completeGame: el minijuego se renderiza y permite relacionar parejas", async () => {
    const view = makeView({
      game: {
        id: "g1",
        type: "relacionar",
        title: "Clasifica residuos",
        points: 2,
        config: {
          pairs: [
            { left: "Papel", right: "Azul" },
            { left: "Organico", right: "Verde" }
          ]
        },
        completed: false
      }
    });
    const fetchMock = mockFetchWithView(view);
    const { getByRole, getByText } = await renderLoaded(null, "Tus pasos");

    // El juego aparece con su título.
    expect(getByText(/Juego: Clasifica residuos/)).toBeInTheDocument();

    // Relacionar primera pareja: tocar izquierda y luego su derecha.
    fireEvent.click(getByRole("button", { name: "Papel" }));
    fireEvent.click(getByRole("button", { name: "Azul" }));
    // Segunda pareja.
    fireEvent.click(getByRole("button", { name: "Organico" }));
    fireEvent.click(getByRole("button", { name: "Verde" }));

    // Con todas las parejas unidas, el botón permite terminar.
    const finishButton = await waitFor(() => getByRole("button", { name: "Terminar" }));
    fireEvent.click(finishButton);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/alumno/juego",
        expect.objectContaining({ method: "POST" })
      );
    });
  });

  it("logout: el botón Salir hace DELETE a /api/alumno/acceso y navega", async () => {
    const view = makeView();
    const fetchMock = mockFetchWithView(view);
    const { getByRole } = await renderLoaded(null, "Tus pasos");

    const salir = getByRole("button", { name: /Salir/ });
    fireEvent.click(salir);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/alumno/acceso",
        expect.objectContaining({ method: "DELETE" })
      );
    });
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/alumno");
    });
    expect(mockRefresh).toHaveBeenCalled();
  });
});
