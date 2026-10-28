# Step Selection Animation Delay Fix — Bugfix Design

## Overview

En la página de reto del alumno (`/alumno/reto`), al tocar un paso dentro de la sección
"Tus pasos" la apariencia del paso (palomita, animación `animate-pop`, borde/fondo verde,
contador `completados/total`, barra de XP y ánimo de la mascota) no cambia hasta que
termina el viaje completo `POST /api/alumno/pasos` seguido de `load()`
(`GET /api/alumno/reto` con `cache: "no-store"`). En conexiones lentas esto produce un
retraso perceptible de 3 a 5 segundos durante el cual el alumno no recibe ninguna señal
de que su clic funcionó.

La estrategia del fix es introducir una **actualización optimista** en
`StudentChallenge` (`src/components/students/student-challenge.tsx`). Al tocar un paso,
el componente invierte de inmediato el estado del paso en el estado local (`view`),
lo que hace que todo lo derivado (palomita/círculo, `animate-pop`, contador, XP, mascota)
se recalcule al instante. El `POST` a `/api/alumno/pasos` se envía en segundo plano; al
tener éxito, la vista se reconcilia con `load()` igual que hoy; al fallar, el estado
optimista se revierte al estado anterior y se muestra el mensaje de error.

El fix es mínimo y localizado: solo cambia el flujo de `toggleStep` y el manejo de
estado optimista dentro del componente. No se tocan rutas de API, cliente Supabase ni
reglas de scoring. El comportamiento del backend, la redirección `401`, la reconciliación
con el servidor y las funciones no relacionadas (minijuego, subida de evidencia,
calendario, salir) quedan intactos.

## Glossary

- **Bug_Condition (C)**: La condición que dispara el bug — cuando el alumno alterna un
  paso (`action = TOGGLE_STEP`) y el feedback visual solo aparece después de completar el
  viaje `POST` + `load()`, en lugar de al instante.
- **Property (P)**: El comportamiento deseado al alternar un paso — la apariencia del
  paso y todo lo derivado (contador, XP, mascota) deben invertirse de inmediato sin
  esperar la respuesta del backend; si la persistencia falla, el estado se revierte.
- **Preservation**: El comportamiento que debe permanecer sin cambios — persistencia en
  backend (upsert/delete), redirección `401`, reconciliación con el servidor, y el resto
  de las interacciones de la página (minijuego, evidencia, calendario, salir).
- **`StudentChallenge`**: El componente cliente en
  `src/components/students/student-challenge.tsx` que renderiza la página del reto del
  alumno y gestiona el estado `view`, `error` y `busyStep`.
- **`toggleStep`**: La función dentro de `StudentChallenge` que, al tocar un paso, hoy
  deshabilita el botón, envía el `POST` a `/api/alumno/pasos`, espera la respuesta y recién
  entonces llama a `load()`.
- **`load`**: La función que hace `GET /api/alumno/reto` (`cache: "no-store"`), maneja el
  `401` redirigiendo a `/alumno`, y reemplaza toda la vista con `setView`.
- **`view`**: El estado `ChallengeView | null` del componente que contiene `challenge`,
  `steps`, `game` y `student`. De él se derivan `completedSteps`, `totalSteps`, `xpEarned`,
  `xpTotal` y el ánimo de la mascota.
- **`busyStep`**: El estado `string | null` que marca qué paso está en vuelo para
  deshabilitar su botón.

## Bug Details

### Bug Condition

El bug se manifiesta cuando el alumno alterna un paso en "Tus pasos". `toggleStep` envía
el `POST` a `/api/alumno/pasos` y espera a que termine, luego llama a `load()` que vuelve a
pedir `GET /api/alumno/reto` y reemplaza toda la vista con `setView`. El estado visual del
paso (y todo lo derivado de `view`) solo cambia al terminar ese viaje de ida y vuelta
completo, por lo que no existe ninguna actualización optimista antes de la respuesta del
backend.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type StepToggleInteraction
  OUTPUT: boolean

  RETURN input.action = TOGGLE_STEP
         AND visualFeedback(input) occurs_only_after backendRoundTripCompletes(input)
         AND NOT optimisticUpdateApplied(input)
END FUNCTION
```

### Examples

- **Marcar un paso en red lenta**: El alumno toca un paso no completado. Esperado: la
  palomita, `animate-pop` y el borde/fondo verde aparecen al instante y el contador sube
  a `completados+1/total`. Actual: el paso mantiene su círculo gris y apariencia anterior
  durante 3-5 segundos hasta que termina `POST` + `load()`.
- **Desmarcar un paso en red lenta**: El alumno toca un paso ya completado. Esperado: el
  círculo vuelve a gris y el contador baja al instante. Actual: el paso sigue mostrando la
  palomita verde varios segundos hasta que termina el refetch.
- **Contador, XP y mascota rezagados**: Al marcar el último paso pendiente, el contador
  `completados/total`, la barra de XP y el ánimo de la mascota (que pasa a "celebra")
  solo se actualizan tras el refetch completo, no al momento del clic.
- **Fallo de persistencia (edge case)**: El `POST` a `/api/alumno/pasos` falla. Esperado:
  el paso que se mostró optimista debe revertir a su estado anterior y mostrarse el mensaje
  de error, de modo que la vista refleje el estado real persistido.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Al tener éxito el `POST`, el backend SHALL seguir persistiendo el progreso del paso igual
  que hoy (upsert al completar, delete al desmarcar) a través de `/api/alumno/pasos`.
- Ante un `401` de `GET /api/alumno/reto`, el sistema SHALL seguir redirigiendo al alumno a
  `/alumno`.
- Tras completar o desmarcar un paso con éxito, la vista SHALL seguir reconciliándose con
  los datos reales del servidor (pasos, contador, barra de XP y mascota) vía `load()`.
- El minijuego (`completeGame`), la subida de evidencia (enlace a `/alumno/evidencia`), el
  calendario de avance (`Calendar52Weeks`) y el botón de salir (`logout`) SHALL seguir
  comportándose exactamente igual que antes del fix.

**Scope:**
Todas las entradas que NO sean alternar un paso (`action ≠ TOGGLE_STEP`) deben quedar
completamente inalteradas por este fix. Esto incluye:
- La carga inicial de la vista (`useEffect` + `load`).
- Interacción con el minijuego y su persistencia (`completeGame`).
- Navegación a la subida de evidencia y al calendario.
- Cierre de sesión (`logout`) y la redirección/refresh asociada.

**Nota:** El comportamiento correcto esperado al alternar un paso se define en la sección
Correctness Properties (Property 1). Esta sección se centra en lo que NO debe cambiar.

## Hypothesized Root Cause

Según la descripción del bug y el código de `toggleStep`, la causa es clara y única:

1. **Ausencia de actualización optimista**: `toggleStep` es `async` y espera
   secuencialmente el `POST` a `/api/alumno/pasos` y luego `await load()` antes de que
   cualquier estado visible cambie. No hay ninguna mutación local de `view` previa a la
   respuesta del backend.
   - La apariencia del paso (`step.completed`), `animate-pop` y el borde/fondo se derivan
     directamente de `view.steps`, que solo cambia con `setView` dentro de `load()`.
   - El contador `completados/total`, `xpEarned`/`xpTotal` y el ánimo de la mascota también
     se derivan de `view.steps`, por lo que heredan el mismo retraso.

2. **Único indicador durante la espera es `busyStep`**: Mientras el `POST`+`load()` están
   en vuelo, lo único que cambia es `busyStep` (que deshabilita el botón). No existe señal
   visual de progreso ni cambio de estado del paso.

3. **Acoplamiento al refetch completo**: Como el feedback depende de reemplazar toda la
   vista con el `GET /api/alumno/reto` (`cache: "no-store"`), la latencia de red determina
   directamente cuándo el alumno ve el cambio (de ahí los 3-5 segundos en red lenta).

El fix ataca la causa (1): aplicar la mutación optimista a `view.steps` al instante y
revertirla si el backend falla, manteniendo el refetch como reconciliación en el camino de
éxito.

## Correctness Properties

Property 1: Bug Condition - Feedback visual inmediato al alternar un paso

_For any_ input donde la condición de bug se cumple (isBugCondition retorna true, es decir
el alumno alterna un paso), la función `toggleStep` arreglada SHALL invertir de inmediato la
apariencia del paso (palomita/círculo, `animate-pop`, borde/fondo) y actualizar de forma
consistente el contador `completados/total`, la barra de XP y el ánimo de la mascota con el
nuevo estado optimista, antes de que termine el viaje al backend. Si el `POST` a
`/api/alumno/pasos` falla, SHALL revertir la apariencia del paso a su estado anterior y
mostrar el mensaje de error.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

Property 2: Preservation - Interacciones no relacionadas sin cambios

_For any_ input donde la condición de bug NO se cumple (isBugCondition retorna false, es
decir cualquier interacción que no sea alternar un paso: carga inicial, minijuego, subida de
evidencia, calendario, salir), el código arreglado SHALL producir exactamente el mismo
resultado que el código original, preservando la persistencia en backend (upsert/delete), la
redirección `401` a `/alumno`, la reconciliación con `GET /api/alumno/reto` y todo el
comportamiento existente de las funciones no relacionadas.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

## Fix Implementation

### Changes Required

Asumiendo que el análisis de causa raíz es correcto:

**File**: `src/components/students/student-challenge.tsx`

**Function**: `toggleStep`

**Specific Changes**:

1. **Capturar el estado previo y aplicar la mutación optimista primero**: Antes de enviar
   el `POST`, calcular el nuevo estado del paso (`!step.completed`) y actualizar `view`
   localmente con `setView`, invirtiendo `completed` del paso correspondiente en
   `view.steps`. Todo lo derivado (palomita/círculo, `animate-pop`, borde/fondo, contador,
   XP, mascota) se recalcula automáticamente porque depende de `view.steps`. Guardar una
   referencia al `view` previo (o al `completed` previo del paso) para poder revertir.

   ```
   const previousView = view;
   const nextCompleted = !step.completed;
   setView((current) =>
     current
       ? { ...current, steps: current.steps.map((s) =>
           s.id === step.id ? { ...s, completed: nextCompleted } : s) }
       : current
   );
   ```

2. **Enviar el `POST` en segundo plano con el nuevo estado**: Mantener el `fetch` a
   `/api/alumno/pasos` con `completed: nextCompleted` (equivalente a `!step.completed`),
   sin bloquear el feedback visual, que ya ocurrió en el paso 1.

3. **Reconciliar en éxito**: Si la respuesta es `ok`, llamar a `await load()` igual que hoy
   para reemplazar la vista con los datos reales del servidor (pasos, contador, XP, mascota).
   Esto preserva el requisito 3.3.

4. **Revertir en error**: Si el `POST` falla (respuesta no `ok` o excepción de red),
   restaurar el estado previo con `setView(previousView)` y mostrar el mensaje de error con
   `setError(getErrorMessage(err))`, de modo que la vista refleje el estado real persistido
   (requisito 2.4).

5. **Conservar `busyStep` y `setError(null)`**: Seguir marcando `busyStep = step.id` al
   inicio (para evitar toques repetidos sobre el mismo paso en vuelo) y limpiarlo en
   `finally`; limpiar `error` al inicio igual que hoy. No se altera `load`, `completeGame`,
   `logout`, el `useEffect` de carga inicial ni el JSX fuera de la lista de pasos.

**No se modifican**: `/api/alumno/pasos`, `/api/alumno/reto`, `/api/alumno/juego`,
`/api/alumno/acceso`, clientes Supabase, reglas de scoring, ni ningún otro componente. Las
cadenas visibles permanecen en español.

## Testing Strategy

### Validation Approach

La estrategia sigue un enfoque de dos fases: primero, hacer surgir contraejemplos que
demuestren el bug sobre el código sin arreglar (el feedback visual tardío al alternar un
paso); luego, verificar que el fix produce feedback inmediato, reconcilia en éxito, revierte
en error y preserva todo el comportamiento no relacionado.

### Exploratory Bug Condition Checking

**Goal**: Hacer surgir contraejemplos que demuestren el bug ANTES de implementar el fix.
Confirmar o refutar el análisis de causa raíz (ausencia de actualización optimista). Si se
refuta, habrá que re-hipotetizar.

**Test Plan**: Escribir pruebas que rendericen `StudentChallenge` con una respuesta de red
retardada para `POST /api/alumno/pasos` (y `GET /api/alumno/reto`), simular el clic sobre un
paso y aserción inmediata (síncrona, antes de resolver el fetch) de que la apariencia del
paso NO cambió. Ejecutar sobre el código SIN ARREGLAR para observar el fallo.

**Test Cases**:
1. **Marcar paso (red lenta)**: Simular clic en un paso no completado; aserción inmediata de
   que la palomita/`animate-pop`/contador no cambiaron antes de resolver el fetch (fallará en
   código arreglado porque sí cambian; en código sin arreglar confirma el retraso).
2. **Desmarcar paso (red lenta)**: Simular clic en un paso completado; observar que el estado
   visual solo cambia tras el refetch en el código sin arreglar.
3. **Contador/XP/mascota rezagados**: Marcar el último paso pendiente y observar que
   contador, XP y mascota solo se actualizan tras `load()` en el código sin arreglar.
4. **Edge case — fallo de persistencia**: Forzar que `POST /api/alumno/pasos` responda error
   y observar el comportamiento del estado (sin reversión optimista en el código sin
   arreglar, puesto que nunca hubo cambio optimista).

**Expected Counterexamples**:
- La apariencia del paso y los valores derivados no cambian hasta que `POST` + `load()`
  terminan.
- Causa confirmada: ausencia de actualización optimista; el feedback está acoplado al
  refetch completo.

### Fix Checking

**Goal**: Verificar que para toda entrada donde se cumple la condición de bug (alternar un
paso), la función arreglada produce el comportamiento esperado: feedback inmediato y, en
caso de fallo, reversión.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := toggleStep_fixed(input)
  ASSERT visualStateFlips(result) occurs_before backendRoundTripCompletes(result)
  ASSERT countersAndXpAndMascot(result) reflect optimisticState(input)
END FOR

FOR ALL input WHERE isBugCondition(input) AND backendFails(input) DO
  result := toggleStep_fixed(input)
  ASSERT visualState(result) = stateBefore(input)
  ASSERT errorMessageShown(result)
END FOR
```

### Preservation Checking

**Goal**: Verificar que para toda entrada donde NO se cumple la condición de bug, la función
arreglada produce el mismo resultado que la función original.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT toggleStep_original_context(input) = toggleStep_fixed_context(input)
END FOR
```

**Testing Approach**: Las pruebas basadas en propiedades son recomendables para la
verificación de preservación porque:
- Generan muchos casos automáticamente a lo largo del dominio de entrada.
- Capturan casos límite que las pruebas unitarias manuales podrían omitir.
- Dan garantías fuertes de que el comportamiento no cambia para todas las entradas no
  afectadas por el bug.

**Test Plan**: Observar primero el comportamiento del código SIN ARREGLAR para la carga
inicial, el minijuego, la subida de evidencia, el calendario y el logout; luego escribir
pruebas que capturen ese comportamiento y verificar que sigue igual tras el fix.

**Test Cases**:
1. **Preservación de persistencia**: Observar que al tener éxito el `POST` el backend
   sigue haciendo upsert/delete igual; verificar que el cuerpo del `POST`
   (`stepId`, `completed`) no cambia tras el fix.
2. **Preservación de redirección `401`**: Observar que un `401` de `GET /api/alumno/reto`
   redirige a `/alumno`; verificar que sigue ocurriendo tras el fix.
3. **Preservación de reconciliación**: Observar que tras un toggle exitoso la vista se
   reemplaza con los datos reales del servidor; verificar que `load()` sigue invocándose en
   el camino de éxito.
4. **Preservación de interacciones no relacionadas**: Observar minijuego, evidencia,
   calendario y salir; verificar que su comportamiento es idéntico tras el fix.

### Unit Tests

- Alternar (marcar/desmarcar) un paso actualiza de inmediato palomita/círculo, `animate-pop`
  y el contador `completados/total` antes de que resuelva el backend.
- Al marcar el último paso pendiente, la barra de XP y el ánimo de la mascota reflejan el
  estado optimista al instante.
- Cuando el `POST` falla, el paso revierte a su estado anterior y se muestra el mensaje de
  error (`role="alert"`).
- El botón del paso en vuelo (`busyStep`) sigue deshabilitándose durante la operación.

### Property-Based Tests

- Generar estados de reto aleatorios (número y estado de pasos, puntos, juego presente/ausente)
  y verificar que alternar cualquier paso invierte su estado optimista de forma consistente
  con contador/XP/mascota.
- Generar secuencias aleatorias de toggles y, para los que el backend tiene éxito, verificar
  que el estado final tras reconciliación coincide con el servidor; para los que fallan,
  verificar reversión al estado previo.
- Generar entradas que NO alternan un paso (carga inicial, juego, logout) y verificar que el
  resultado es idéntico entre el código original y el arreglado (preservación).

### Integration Tests

- Flujo completo del alumno: cargar reto, marcar varios pasos con red lenta y confirmar
  feedback inmediato y reconciliación posterior con el servidor.
- Alternar un paso con backend caído: confirmar reversión visual y mensaje de error, y que un
  reintento posterior con backend disponible persiste correctamente.
- Confirmar que el minijuego, la subida de evidencia, el calendario y el logout siguen
  funcionando tras varias interacciones con pasos.
