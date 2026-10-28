# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Feedback visual inmediato al alternar un paso
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior (actualización optimista) - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug (feedback acoplado al viaje `POST` + `load()`, sin actualización optimista)
  - **Scoped PBT Approach**: For this deterministic bug, scope the property to concrete failing cases: alternar un paso (marcar y desmarcar) con la red retardada. Opcionalmente generar el estado del reto (número/estado de pasos) y afirmar la misma propiedad para cualquier paso elegido
  - Crear el archivo de prueba del componente (ej. `src/components/students/student-challenge.test.tsx`) con Vitest + React Testing Library (jsdom ya configurado vía `npm run test`)
  - Mockear `fetch` para `POST /api/alumno/pasos` y `GET /api/alumno/reto` con una respuesta RETARDADA (promesa no resuelta de inmediato), y mockear `next/navigation` (`useRouter`)
  - Renderizar `StudentChallenge`, simular clic en un paso y, de forma SÍNCRONA (antes de resolver el fetch), afirmar que la apariencia del paso NO cambió: sigue mostrando `Circle` (no `CheckCircle2`), sin clase `animate-pop`, `aria-pressed` sin invertir y el contador `completados/total` sin cambiar (basado en Bug Condition del diseño: `isBugCondition(input) = input.action = TOGGLE_STEP`)
  - Incluir el caso de desmarcar un paso ya completado y el caso de contador/XP/mascota rezagados al marcar el último paso pendiente
  - Incluir el edge case: forzar que `POST /api/alumno/pasos` responda error y observar que no hay reversión optimista (porque nunca hubo cambio optimista) en el código sin arreglar
  - Ejecutar con `npm run test` sobre el código SIN ARREGLAR
  - **EXPECTED OUTCOME**: Test FAILS (esto es correcto - prueba que el bug existe; en código sin arreglar la aserción "el estado visual cambió al instante" no se cumple)
  - Documentar los contraejemplos encontrados (ej. "al marcar un paso, `CheckCircle2` y `animate-pop` no aparecen hasta que `POST` + `load()` terminan")
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 2.4_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Interacciones no relacionadas sin cambios
  - **IMPORTANT**: Follow observation-first methodology — observar el comportamiento del código SIN ARREGLAR primero, luego escribir pruebas que capturen ese comportamiento
  - Observar y capturar sobre el código sin arreglar:
    - **Persistencia**: al tener éxito el `POST`, el cuerpo enviado a `/api/alumno/pasos` es `{ stepId, completed: !step.completed }` (upsert al completar, delete al desmarcar) y permanece igual
    - **Redirección `401`**: un `401` de `GET /api/alumno/reto` redirige a `/alumno` vía `router.push`
    - **Reconciliación**: tras un toggle exitoso se invoca `load()` (`GET /api/alumno/reto` con `cache: "no-store"`) y la vista se reemplaza con los datos del servidor
    - **Interacciones no relacionadas**: carga inicial (`useEffect` + `load`), minijuego (`completeGame` → `POST /api/alumno/juego`), enlace a `/alumno/evidencia`, calendario (`Calendar52Weeks`) y logout (`DELETE /api/alumno/acceso` + `router.push("/alumno")` + `router.refresh()`)
  - Escribir pruebas basadas en propiedades (recomendado) que generen estados de reto aleatorios (número y estado de pasos, puntos, juego presente/ausente) y afirmen que, para toda interacción donde `isBugCondition` es false, el resultado es idéntico al original (ver Preservation Checking del diseño)
  - Ejecutar con `npm run test` sobre el código SIN ARREGLAR
  - **EXPECTED OUTCOME**: Tests PASS (confirma el comportamiento base a preservar)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 3. Fix for retraso de feedback al seleccionar un paso (actualización optimista en `toggleStep`)

  - [x] 3.1 Implement the fix
    - Archivo: `src/components/students/student-challenge.tsx`, función `toggleStep`
    - Capturar el estado previo antes del `POST`: `const previousView = view;` y calcular `const nextCompleted = !step.completed;`
    - Aplicar la mutación optimista primero con `setView`, invirtiendo `completed` del paso correspondiente en `view.steps` para que lo derivado (palomita/`CheckCircle2` vs `Circle`, `animate-pop`, borde/fondo, contador `completados/total`, barra de XP y ánimo de la mascota) se recalcule al instante
    - Enviar el `POST` a `/api/alumno/pasos` en segundo plano con `completed: nextCompleted` (sin bloquear el feedback visual que ya ocurrió)
    - En éxito (`res.ok`): llamar a `await load()` igual que hoy para reconciliar la vista con los datos reales del servidor
    - En error (respuesta no `ok` o excepción de red): revertir con `setView(previousView)` y mostrar el mensaje con `setError(getErrorMessage(err))`
    - Conservar `setError(null)` al inicio, `setBusyStep(step.id)` al inicio y `setBusyStep(null)` en `finally`
    - No modificar `load`, `completeGame`, `logout`, el `useEffect` de carga inicial, ni el JSX fuera de la lista de pasos. No tocar rutas de API ni scoring. Mantener las cadenas visibles en español
    - _Bug_Condition: isBugCondition(input) = input.action = TOGGLE_STEP (del diseño)_
    - _Expected_Behavior: expectedBehavior(result) — invierte la apariencia del paso y lo derivado al instante antes del viaje al backend; revierte y muestra error si el `POST` falla (del diseño, Property 1)_
    - _Preservation: Preservation Requirements del diseño (persistencia upsert/delete, redirección 401, reconciliación con `load()`, minijuego/evidencia/calendario/logout sin cambios)_
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 3.2 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Feedback visual inmediato al alternar un paso
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior (actualización optimista)
    - When this test passes, it confirms que la apariencia del paso, el contador, la XP y la mascota se invierten al instante, y que al fallar el `POST` el estado revierte y se muestra el error
    - Ejecutar el test de exploración del paso 1 con `npm run test`
    - **EXPECTED OUTCOME**: Test PASSES (confirma que el bug está arreglado)
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 3.3 Verify preservation tests still pass
    - **Property 2: Preservation** - Interacciones no relacionadas sin cambios
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Ejecutar las pruebas de preservación del paso 2 con `npm run test`
    - **EXPECTED OUTCOME**: Tests PASS (confirma que no hay regresiones: persistencia, redirección 401, reconciliación y las interacciones no relacionadas siguen igual)
    - Confirmar que todas las pruebas siguen pasando tras el fix
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 4. Checkpoint - Ensure all tests pass
  - Ejecutar `npm run test` y confirmar que todas las pruebas pasan (exploración, preservación y unitarias)
  - Ejecutar `npm run lint` y `npm run build` para validar el cambio (no hay otra suite configurada)
  - Ensure all tests pass, ask the user if questions arise.
