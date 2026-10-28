# Bugfix Requirements Document

## Introduction

En la página de reto del alumno (`/alumno/reto`), dentro de la sección "Tus pasos", al
seleccionar un paso existe un retraso perceptible de entre 3 y 5 segundos antes de que
cambie la apariencia del paso (palomita, animación `animate-pop`, borde/fondo verde y el
contador `completados/total`). Durante ese retraso el alumno no recibe ninguna señal
visual de que su clic funcionó, lo que confunde y hace pensar que el botón no responde.

La causa raíz es que el componente `StudentChallenge`
(`src/components/students/student-challenge.tsx`) no aplica una actualización optimista.
Al tocar un paso, `toggleStep` deshabilita el botón, envía el `POST` a
`/api/alumno/pasos`, espera la respuesta y recién entonces ejecuta `load()`, que vuelve
a pedir `GET /api/alumno/reto` (`cache: "no-store"`) y reemplaza toda la vista con
`setView`. El estado visual del paso solo cambia al terminar ese viaje de ida y vuelta
completo; en conexiones lentas eso tarda varios segundos.

El objetivo del fix es que el cambio de estado del paso se sienta inmediato
(retroalimentación visual al instante / actualización optimista), mientras se sigue
persistiendo en el backend y reconciliando o revirtiendo el estado si la operación falla.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN el alumno toca un paso en "Tus pasos" THEN el sistema no cambia la apariencia del paso (palomita, `animate-pop`, borde/fondo) hasta que el `POST` a `/api/alumno/pasos` y el posterior `load()` (`GET /api/alumno/reto`) terminan, provocando un retraso visible de 3 a 5 segundos en conexiones lentas
1.2 WHEN el alumno toca un paso y la red es lenta THEN el sistema deja el paso con su apariencia anterior y sin ninguna señal de progreso durante todo el viaje de ida y vuelta, dando la impresión de que el clic no funcionó
1.3 WHEN el alumno toca un paso THEN el sistema no actualiza el contador `completados/total`, la barra de XP ni el ánimo de la mascota hasta que el refetch completo reemplaza la vista

### Expected Behavior (Correct)

2.1 WHEN el alumno toca un paso en "Tus pasos" THEN el sistema SHALL invertir de inmediato la apariencia del paso (palomita/círculo, `animate-pop`, borde/fondo) sin esperar la respuesta del backend
2.2 WHEN el alumno toca un paso y la red es lenta THEN el sistema SHALL mostrar al instante el nuevo estado del paso y persistir el cambio en segundo plano enviando el `POST` a `/api/alumno/pasos`
2.3 WHEN el alumno toca un paso THEN el sistema SHALL actualizar de inmediato el contador `completados/total`, la barra de XP y el ánimo de la mascota de forma consistente con el nuevo estado optimista
2.4 WHEN el `POST` a `/api/alumno/pasos` falla THEN el sistema SHALL revertir la apariencia del paso a su estado anterior y mostrar el mensaje de error, de modo que la vista refleje el estado real persistido

### Unchanged Behavior (Regression Prevention)

3.1 WHEN el `POST` a `/api/alumno/pasos` tiene éxito THEN el sistema SHALL CONTINUAR persistiendo el progreso del paso en el backend igual que hoy (upsert al completar, delete al desmarcar)
3.2 WHEN la respuesta de `GET /api/alumno/reto` es `401` THEN el sistema SHALL CONTINUAR redirigiendo al alumno a `/alumno`
3.3 WHEN se completa o desmarca un paso THEN el sistema SHALL CONTINUAR reconciliando la vista con los datos reales del servidor para pasos, contador, barra de XP y mascota
3.4 WHEN el alumno interactúa con el minijuego, la subida de evidencia, el calendario de avance o el botón de salir THEN el sistema SHALL CONTINUAR comportándose igual que antes del fix

## Bug Condition and Properties

### Bug Condition

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type StepToggleInteraction
  OUTPUT: boolean

  // El bug se dispara cuando el alumno alterna un paso: el feedback visual
  // (palomita, animate-pop, contador, XP, mascota) solo ocurre despues de
  // que termina el viaje POST + load(), no al momento del clic.
  RETURN X.action = TOGGLE_STEP
END FUNCTION
```

### Property: Fix Checking

```pascal
// Para toda interaccion de alternar paso, el feedback visual debe ser inmediato.
FOR ALL X WHERE isBugCondition(X) DO
  result ← toggleStep'(X)
  ASSERT visualStateFlips(result) occurs_before backendRoundTripCompletes(result)
  ASSERT countersAndXpAndMascot(result) reflect optimisticState(X)
END FOR

// Al fallar la persistencia, el estado optimista se revierte.
FOR ALL X WHERE isBugCondition(X) AND backendFails(X) DO
  result ← toggleStep'(X)
  ASSERT visualState(result) = stateBefore(X)
  ASSERT errorMessageShown(result)
END FOR
```

### Property: Preservation Checking

```pascal
// Para toda interaccion que no sea alternar un paso, el comportamiento
// de la pagina del reto no cambia respecto al original.
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT F(X) = F'(X)
END FOR
```

**Definiciones:**
- **F**: `toggleStep` / comportamiento de la vista del reto antes del fix (sin actualización optimista).
- **F'**: `toggleStep` / comportamiento después del fix (con actualización optimista, persistencia en segundo plano y reversión en caso de error).
