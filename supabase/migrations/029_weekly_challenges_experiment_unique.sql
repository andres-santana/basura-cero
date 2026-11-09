-- Regla de producto: cada experimento debe usarse una sola vez por escuela.
-- weekly_challenges solo tenia el indice parcial de "un is_current por escuela",
-- lo que permitia programar el mismo experimento dos veces y generar
-- retos/semanas duplicados (duplicando puntos en v_group_ranking).
--
-- Esta migracion solo crea la restriccion. NO limpia duplicados de forma
-- automatica: si existieran al momento de aplicarla, el indice fallara y debe
-- resolverse manualmente (consolidando los retos del experimento afectado) para
-- evitar borrados accidentales de evidencias por CASCADE.

create unique index if not exists weekly_challenges_school_experiment_idx
on weekly_challenges (school_id, experiment_id);
