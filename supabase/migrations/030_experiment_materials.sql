-- 030_experiment_materials.sql
-- Fase 2: catalogo de MATERIALES medibles por experimento + detalle de
-- cantidades reportadas por el alumno + kg equivalentes del grupo.
--
-- Objetivo: convertir los conteos de objetos (hojas, botellas, tapas...) en
-- KILOGRAMOS EQUIVALENTES comparables entre grupos y semanas, usando un factor
-- de peso por material (kg_per_unit) definido por el admin en cada experimento.
--
-- Convivencia con Fase 1: las columnas kg_separated / reused_items /
-- recycled_items se conservan. equivalent_kg se agrega al lado y es la base del
-- puntaje de impacto SOLO cuando el experimento tiene catalogo de materiales;
-- si no lo tiene, el scoring usa el comportamiento de Fase 1 (fallback).

-- 1) Catalogo de materiales por experimento ---------------------------------
create table if not exists experiment_materials (
  id uuid primary key default gen_random_uuid(),
  experiment_id uuid not null references experiments(id) on delete cascade,
  label text not null,
  unit_label text not null,
  kg_per_unit numeric(10,4) not null default 0 check (kg_per_unit >= 0),
  kind text not null check (kind in ('separado','reutilizado','reciclado')),
  display_order int not null default 1 check (display_order >= 1),
  is_active boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists experiment_materials_experiment_idx
  on experiment_materials(experiment_id);

alter table experiment_materials enable row level security;

-- Lectura publica de materiales de experimentos publicados (coherente con
-- experiment_steps_public_read / experiment_games_public_read). La escritura la
-- hace el admin via service role (bypass RLS).
create policy experiment_materials_public_read on experiment_materials
for select
using (
  is_active = true
  and exists (
    select 1 from experiments e
    where e.id = experiment_materials.experiment_id
    and (e.status = 'published' or public.current_role() = 'admin')
  )
);

-- 2) Detalle de cantidades por material reportadas por el alumno -------------
create table if not exists student_submission_materials (
  id uuid primary key default gen_random_uuid(),
  student_submission_id uuid not null
    references student_submissions(id) on delete cascade,
  material_id uuid not null
    references experiment_materials(id) on delete restrict,
  quantity numeric(10,2) not null default 0 check (quantity >= 0),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (student_submission_id, material_id)
);

create index if not exists student_submission_materials_submission_idx
  on student_submission_materials(student_submission_id);
create index if not exists student_submission_materials_material_idx
  on student_submission_materials(material_id);

alter table student_submission_materials enable row level security;

-- 3) Kg equivalentes del grupo (derivado y persistido para auditoria) --------
alter table impact_metrics
  add column if not exists equivalent_kg numeric(10,2) not null default 0;

-- 4) Seed de materiales de referencia ----------------------------------------
-- NO asocia materiales a experimentos automaticamente: el admin elige cuales
-- aplican a cada experimento. Este seed solo documenta pesos de referencia
-- precargandolos en el experimento de la "libreta" si existe por titulo, como
-- ejemplo editable. Idempotente por (experiment_id, label).
--
-- Pesos aproximados (kg por unidad), editables desde el panel admin:
--   Hoja carta 0.005 | Botella PET 0.025 | Lata de aluminio 0.015
--   Carton de leche (Tetra Pak) 0.030 | Tapa de plastico 0.002
--   Bolsa de plastico 0.006 | Cono/carton de huevo 0.030 | Caja de carton 0.050

create unique index if not exists experiment_materials_experiment_label_idx
  on experiment_materials(experiment_id, label);

-- Precarga de ejemplo: materiales de reutilizacion en experimentos cuyo titulo
-- mencione "libreta" (reutilizacion de hojas). Si no hay coincidencias, el seed
-- simplemente no inserta filas; el admin puede crear materiales a mano.
insert into experiment_materials (experiment_id, label, unit_label, kg_per_unit, kind, display_order)
select e.id, 'Hoja carta', 'hoja', 0.005, 'reutilizado', 1
from experiments e
where e.title ilike '%libreta%'
on conflict (experiment_id, label) do nothing;
