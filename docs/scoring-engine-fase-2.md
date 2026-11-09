# Motor de puntaje — Fase 2 (kg equivalentes por material)

Diseño de la Fase 2: catálogo de **materiales medibles por experimento** para
convertir los conteos que reporta el alumno en **kilogramos equivalentes**, que
son la base comparable del puntaje de impacto.

> Rama: `feat/materiales-kg-equivalentes` (desde `main` con Fase 1 ya integrada).
> Estado: **diseño** (este doc). La implementación sigue tras validar el diseño.

## Problema que resuelve

Contar "objetos" mezcla unidades: una libreta de 20 hojas reutilizadas dispara
el conteo (500+ objetos) frente a 20 kg separados, aunque su peso real sea
mínimo. Normalizar a **kg equivalentes** hace comparables a los grupos y las
semanas, y evita que el conteo crudo infle el puntaje.

Ejemplo (libreta con hojas usadas): material = "Hoja carta", `kg_per_unit =
0.005`. El alumno reporta 20 hojas → `20 × 0.005 = 0.1 kg` equivalentes.

## Decisiones de diseño (confirmadas)

1. **Nivel B**: catálogo de varios materiales por experimento.
2. Se guarda el **detalle de cantidad por material** reportado por el alumno
   (no solo el total), para auditar y recalcular si cambia un factor.
3. **Opción i** + regla anti doble conteo: cuando un experimento tiene
   catálogo, el puntaje de impacto usa **solo kg equivalentes**; los conteos
   `reused_items`/`recycled_items` quedan como dato informativo. Cuando el
   experimento **no** tiene catálogo, se usa el comportamiento actual (conteos)
   como **fallback**.
4. El kg equivalente se calcula en backend al agregar/recalcular y se
   **persiste** en `impact_metrics.equivalent_kg` para auditoría.

## Modelo de datos (nueva migración, siguiente número disponible)

### `experiment_materials` (catálogo por experimento)

| Columna        | Tipo              | Notas |
|----------------|-------------------|-------|
| id             | uuid pk           | |
| experiment_id  | uuid fk → experiments(id) on delete cascade | |
| label          | text not null     | Nombre visible: "Hoja carta". |
| unit_label     | text not null     | Unidad: "hoja", "botella". |
| kg_per_unit    | numeric(10,4) not null check (>= 0) | Peso equivalente por unidad (ej. 0.005). 4 decimales para gramos. |
| kind           | text not null check (separado\|reutilizado\|reciclado) | Tipo de impacto. |
| display_order  | int not null default 1 | Orden en la UI. |
| is_active      | boolean not null default true | |
| created_at / updated_at | timestamptz default now() | |

Índice: `experiment_materials_experiment_idx` sobre `experiment_id`.
RLS: lectura pública si el experimento está `published` o el caller es `admin`
(mismo patrón que `experiment_steps`/`experiment_games`).

### `student_submission_materials` (detalle por alumno)

| Columna               | Tipo | Notas |
|-----------------------|------|-------|
| id                    | uuid pk | |
| student_submission_id | uuid fk → student_submissions(id) on delete cascade | |
| material_id           | uuid fk → experiment_materials(id) on delete restrict | |
| quantity              | numeric(10,2) not null default 0 check (>= 0) | Cantidad reportada por el alumno. |
| created_at / updated_at | timestamptz default now() | |

Único: `(student_submission_id, material_id)`.
RLS: el alumno escribe vía service role (como el resto del flujo de alumno);
lectura pública no necesaria.

### Columna derivada en `impact_metrics`

- `equivalent_kg numeric(10,2) not null default 0`: suma de kg equivalentes del
  grupo para el reto, derivada de las cantidades por material de sus alumnos.
  Se persiste para auditoría; es la que alimenta el puntaje de impacto cuando
  hay catálogo.

> Las columnas de Fase 1 (`kg_separated`, `reused_items`, `recycled_items`) se
> conservan intactas; `equivalent_kg` se agrega al lado.

## Flujo end-to-end

### 1. Admin define los materiales del experimento
- Nuevo sub-editor en `experiments-manager.tsx` (patrón de
  `experiment-video-field.tsx`): lista de materiales con alta/baja/edición.
- Nuevo endpoint CRUD: `src/app/api/admin/experimentos/[id]/materiales/route.ts`
  (`GET` lista, `POST` crea, `PATCH`/`DELETE` por material o `[materialId]`).
  Validación Zod: `label`, `unitLabel`, `kgPerUnit >= 0`, `kind`, `displayOrder`.
- Es el primer CRUD de colección hija en el admin; se documenta el patrón.

### 2. El alumno reporta cantidades por material
- `getStudentChallengeView` (o el loader de la página de evidencia) entrega la
  lista de materiales activos del experimento, igual que entrega pasos/juegos.
  Nuevo tipo `StudentMaterial` en `student-challenge.ts`.
- `student-evidence-uploader.tsx`: inputs dinámicos "¿Cuántas <unidad> de
  <material>?" por cada material del reto. Si el experimento no tiene
  materiales, se muestran los campos actuales (kg/reutilizados/reciclados).
- `POST /api/alumno/evidencia`: el schema Zod acepta `materials: [{ materialId,
  quantity }]`; se validan contra el catálogo del reto y se hace upsert en
  `student_submission_materials`.

### 3. Agregación del grupo (teacher-evidence.ts)
- Al derivar las métricas del grupo, además de sumar los conteos actuales, se
  suma `Σ (quantity × kg_per_unit)` de todos los alumnos no rechazados y se
  guarda en `impact_metrics.equivalent_kg`.
- El maestro/admin puede seguir ajustando `kg_separated`/conteos; `equivalent_kg`
  se recalcula desde el detalle (no se edita a mano en esta fase).

### 4. Scoring (scoring-service.ts + calculate.ts + rules.ts)
- `recalcGroupSubmissionScore` lee si el experimento del reto tiene materiales.
  - **Con catálogo**: el componente de impacto se calcula sobre `equivalent_kg`
    (un peso por kg equivalente, con su tope). Los conteos de reutilizados/
    reciclados **no** suman puntos (evita doble conteo); siguen como estadística.
  - **Sin catálogo (fallback)**: exactamente la lógica de Fase 1 (kg separados
    0.5 pt/kg + reutilizados + reciclados).
- Se agrega `equivalentKg` y una bandera `usesMaterialCatalog` a
  `SubmissionMetrics`; `calculateScore` decide la rama de impacto según la
  bandera. El `breakdown_json` registra `equivalentKg` y qué rama se usó.
- Pesos en `rules.ts`: nuevo `equivalentKgMax` (presupuesto del bloque de
  impacto cuando hay catálogo). Se define para no alterar el total de 100 del
  bloque base.

## Compatibilidad y migración de datos

- Experimentos existentes sin materiales → fallback (sin cambios de puntaje).
- Al sembrar materiales para un experimento ya jugado y recalcular, su puntaje
  de impacto pasará a basarse en kg equivalentes. Documentar que el recálculo
  (`/api/admin/recalcular`) refleja el cambio.
- Seed idempotente de materiales de ejemplo (patrón `018/020`): al menos el
  experimento de la libreta (hoja carta, 0.005 kg) como referencia.

## Valores definidos (calibrables)

- **Conversión kg equivalentes → puntos**: `0.5 pt por kg equivalente`, con tope
  `equivalentKgMax = 30` (en `rules.ts`). Ese tope reemplaza el presupuesto de
  los tres conteos (waste 10 + reused 10 + recycled 10 = 30) cuando hay
  catálogo, de modo que el puntaje base sigue sumando 100 con o sin catálogo.
- **Factores de peso de referencia** (editables desde el admin):

  | Material | Unidad | kg aprox. |
  |---|---|---|
  | Hoja carta | hoja | 0.005 |
  | Botella PET | botella | 0.025 |
  | Lata de aluminio | lata | 0.015 |
  | Cartón de leche (Tetra Pak) | cartón | 0.030 |
  | Tapa de plástico | tapa | 0.002 |
  | Bolsa de plástico | bolsa | 0.006 |
  | Cono/cartón de huevo | cono | 0.030 |
  | Caja de cartón | caja | 0.050 |

  La migración `030` solo precarga "Hoja carta" en experimentos cuyo título
  mencione "libreta", como ejemplo. El resto los agrega el admin por experimento.

## Cómo quedó implementado (resumen técnico)

- **Migración `030_experiment_materials.sql`**: tablas `experiment_materials` y
  `student_submission_materials`, columna `impact_metrics.equivalent_kg`, RLS de
  lectura pública (patrón pasos/juegos) y seed de ejemplo.
- **Admin**: CRUD en `api/admin/experimentos/[id]/materiales` (+ `[materialId]`)
  y sub-editor `experiment-materials-field.tsx` embebido en el editor. Borrar un
  material con cantidades ya reportadas lo **desactiva** en vez de borrarlo
  (preserva histórico).
- **Alumno**: `GET /api/alumno/evidencia` entrega el catálogo + cantidades
  guardadas; `POST` acepta `materials:[{materialId,quantity}]` validadas contra
  el catálogo del reto. El uploader muestra inputs por material cuando el reto
  tiene catálogo; si no, usa los campos de Fase 1.
- **Agregación**: `teacher-evidence.ts` suma `Σ quantity × kg_per_unit` y lo
  persiste en `impact_metrics.equivalent_kg` (en el alta masiva y en el sync por
  cambios).
- **Scoring**: `calculate.ts` ramifica por `usesMaterialCatalog`. Con catálogo,
  el impacto se puntúa por `equivalentKg` (0.5 pt/kg eq, tope 30) y los conteos
  no suman; sin catálogo, fallback de Fase 1. El `breakdown_json` incluye
  `equivalentKg` y `usesMaterialCatalog`.

## Fase 3 (futuro, fuera de alcance)

Estadísticas por material (kg equivalentes por tipo de residuo a nivel escuela),
aprovechando el detalle guardado en `student_submission_materials`.
