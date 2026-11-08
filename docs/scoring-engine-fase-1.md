# Motor de puntaje — Fase 1 (reponderación)

Documento de referencia para el equipo sobre cómo se calcula el puntaje de un
grupo tras la reponderación de Fase 1. Objetivo del cambio: **diferenciar mejor
a los grupos** (evitar empates como 45 vs 45) tomando en cuenta el tiempo de
respuesta, el reciclaje y el esfuerzo real de cada alumno.

> Fuente de verdad en código: `src/lib/scoring/rules.ts` (pesos y curva de
> tiempo), `src/lib/scoring/calculate.ts` (fórmula) y
> `src/lib/services/scoring-service.ts` (orquestación y agregados de alumnos).
> El puntaje se guarda en la tabla `scores` (`points_total`, `breakdown_json`).

## Fórmula general

```
points_total = basePoints + studentPoints
```

- **basePoints**: puntaje del grupo, con tope de 100 y afectado por el factor de
  tiempo.
- **studentPoints**: suma de los puntos ganados por cada alumno del grupo. Se
  agrega **aparte**, sin tope de 100 y **sin** aplicarle el factor de tiempo.

Esto significa que el total de un grupo **puede superar 100**: lo esperado, ya
que `studentPoints` crece con el número de alumnos y la cantidad de actividades
que completan.

## 1. Puntaje base del grupo (tope 100)

Se compone de los siguientes bloques (máximo bruto = 100 antes del factor de
tiempo). Pesos en `defaultScoreWeights`:

| Componente                   | Peso máx. | Cómo se calcula |
|------------------------------|-----------|-----------------|
| Experimento completado       | 20        | Fijo, siempre que haya entrega. |
| Evidencia completa           | 15        | 15 si hay al menos un archivo (del grupo o de alumnos). |
| Pasos (promedio de alumnos)  | 15        | Promedio acotado (0..1) del avance de pasos entre alumnos activos × 15. |
| Mini-juegos (promedio)       | 10        | Promedio acotado (0..1) de juegos completados × 10. |
| Participación                | 10        | `participantes / esperados`, en tramos de 10%. |
| Kg separados                 | 10        | **0.5 pt por kg** (gradiente fino), hasta 10. |
| Reutilizados                 | 10        | 1 pt por objeto reutilizado, hasta 10. |
| **Reciclados** (nuevo)       | 10        | 1 pt por objeto reciclado, hasta 10. |

```
subtotal = suma de los componentes de arriba
basePoints = round(subtotal × factorTiempo), acotado a [0, 100]
```

### Factor de tiempo (días desde el inicio del reto)

Antes se medía el **retraso después de `end_date`**; ahora se mide el **tiempo
de respuesta desde el inicio** (`start_date` del reto). Así dos grupos que
entregaron "en plazo" pero en días distintos ya se diferencian.

`daysElapsed` = días calendario desde `start_date` hasta la fecha de entrega
(0 = mismo día de inicio).

| Días desde el inicio | Factor |
|----------------------|--------|
| 0                    | 1.00   |
| 1                    | 0.97   |
| 2                    | 0.94   |
| 3                    | 0.90   |
| 4–5                  | 0.85   |
| 6–7                  | 0.80   |
| 8–10                 | 0.70   |
| 11–14                | 0.60   |
| 15+                  | 0.50 (mínimo) |

Curva en `timeDecayFactor` (`src/lib/scoring/rules.ts`). El mínimo garantiza que
entregar siempre suma algo.

## 2. Puntos de alumnos (sin tope, sin factor de tiempo)

Para premiar el esfuerzo real del equipo, se suman los puntos que gana cada
alumno del grupo en el reto:

```
studentPoints = Σ (puntos de cada paso completado por cada alumno)
              + Σ (puntos de cada mini-juego completado por cada alumno)
```

- Puntos por paso: columna `experiment_steps.points`.
- Puntos por juego: columna `experiment_games.points` (cuenta solo si el juego
  quedó `completed`).

Se calcula en `aggregateStudentProgress` y se agrega en
`recalcGroupSubmissionScore`. No se le aplica el factor de tiempo: lo que el
alumno ganó con su trabajo se conserva.

## Métricas de impacto y reciclaje

Cada alumno reporta en su evidencia: **kg separados**, **objetos reutilizados** y
**objetos reciclados** (nuevo). El grupo suma automáticamente lo de sus alumnos
en `impact_metrics`; el maestro (o admin) puede ajustar esos totales al revisar.

- `recycled_items` existe ahora en `impact_metrics` (grupo) y
  `student_submissions` (alumno). Migración `028_recycled_items_metric.sql`.
- Las vistas `v_weekly_impact` y `v_school_summary` incluyen `recycled_items` /
  `total_recycled_items` para los reportes.

## `breakdown_json` (auditoría del puntaje)

Cada score guarda un desglose para poder explicar el resultado:

```
experimentCompleted, evidenceComplete, steps, games, participation,
wasteReduction, reusedItems, recycledItems, creativity, teamwork,
subtotal, daysElapsed, timeFactor, basePoints, studentPoints
```

## Cómo aplicar los cambios a datos ya cargados

Los puntajes viejos quedan congelados en la tabla `scores` hasta que se
recalculen. Después de desplegar:

1. Aplicar la migración `supabase/migrations/028_recycled_items_metric.sql` en
   el proyecto Supabase.
2. En el panel admin, pulsar **"Recalcular estadísticas"**
   (`POST /api/admin/recalcular` → `recalcAllScoresForSchool`). Esto recalcula
   todas las entregas de la escuela y refresca puntaje, ranking e insignias.

## Qué viene en la Fase 2

Convertir las métricas de impacto a **kg equivalentes** usando un factor de peso
por material definido en cada experimento (p. ej. hoja carta ≈ 5 g). Así se
evita que conteos crudos de objetos (ej. 500 hojas) inflen las estadísticas, y
todas las métricas quedan comparables entre grupos y semanas. Se diseñará
después de validar la Fase 1.
