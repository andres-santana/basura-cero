-- 028_recycled_items_metric.sql
-- Nueva metrica de impacto: materiales RECICLADOS.
--
-- Hasta ahora el impacto se media con dos metricas: kg_separated (kilos
-- separados) y reused_items (objetos reutilizados). El programa tambien
-- distingue el RECICLAJE (entregar material a un flujo de reciclaje) de la
-- REUTILIZACION (volver a usar el objeto tal cual). Agregamos recycled_items
-- como conteo de objetos reciclados, tanto a nivel ALUMNO (lo reporta cada
-- alumno en su evidencia) como a nivel GRUPO (impact_metrics, que suma lo de
-- los alumnos y el maestro puede ajustar).
--
-- recycled_items: conteo de objetos reciclados (entero, >= 0).

alter table impact_metrics
  add column if not exists recycled_items int not null default 0;

alter table student_submissions
  add column if not exists recycled_items int not null default 0;

-- Recrear vistas de impacto para incluir recycled_items. Se preservan las
-- columnas existentes para no romper los consumidores actuales; solo se agregan
-- las nuevas columnas de reciclaje.

create or replace view v_weekly_impact as
select
  wc.school_id,
  e.week_number,
  sum(coalesce(im.kg_separated, 0)) as kg_separated,
  sum(coalesce(im.reused_items, 0)) as reused_items,
  sum(coalesce(im.recycled_items, 0)) as recycled_items,
  sum(coalesce(im.waste_reduced_estimate, 0)) as waste_reduced_estimate,
  sum(coalesce(s.participants_count, 0)) as participants,
  count(distinct s.id) as submissions_count
from weekly_challenges wc
join experiments e on e.id = wc.experiment_id
left join submissions s on s.challenge_id = wc.id and s.status in ('submitted','approved')
left join impact_metrics im on im.submission_id = s.id
group by wc.school_id, e.week_number;

create or replace view v_school_summary as
select
  sc.id as school_id,
  sc.name as school_name,
  coalesce(sum(wi.kg_separated), 0) as total_kg_separated,
  coalesce(sum(wi.reused_items), 0) as total_reused_items,
  coalesce(sum(wi.recycled_items), 0) as total_recycled_items,
  coalesce(sum(wi.participants), 0) as total_participants,
  coalesce(sum(wi.submissions_count), 0) as total_submissions
from schools sc
left join v_weekly_impact wi on wi.school_id = sc.id
group by sc.id;
