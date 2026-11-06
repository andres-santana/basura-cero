-- 027_student_submissions_impact_metrics.sql
-- Metricas de impacto reportadas por el ALUMNO en su evidencia.
--
-- Antes los kg separados y materiales reutilizados solo existian a nivel grupo
-- (tabla impact_metrics, capturados por el maestro). Como el alumno es quien
-- realmente hizo la separacion y tiene el material enfrente, ahora cada alumno
-- reporta su estimacion aqui. El grupo suma automaticamente estos valores en
-- su entrega (impact_metrics) y el maestro puede ajustarlos al revisar.
--
-- kg_separated: estimacion en kilogramos (un decimal en la UI).
-- reused_items: conteo de objetos reutilizados.
alter table student_submissions
  add column if not exists kg_separated numeric(10,2) not null default 0,
  add column if not exists reused_items int not null default 0;
