-- 031_retire_unsupported_badges.sql
-- Retira del catalogo las insignias que nunca se pueden otorgar porque su
-- condicion no tiene soporte en la logica de scoring:
--   * equipo_compostero  -> requiere detectar retos de compostaje (compostWeeks)
--   * impacto_dorado      -> requiere ranking mensual (isTop3Monthly)
--   * grupo_eco_lider     -> requiere ranking trimestral (isTop1Quarterly)
--
-- En la capa TS (assignBadgesForGroup) esos campos estan fijados en cero/false,
-- asi que estas 3 insignias jamas se otorgaban. Se eliminan del catalogo hasta
-- que exista soporte real. Las filas de group_badges asociadas se borran por
-- ON DELETE CASCADE (ver 002_tables.sql). La regla de evaluacion
-- correspondiente tambien se retiro de src/lib/scoring/rules.ts.
--
-- Idempotente: si ya no existen, el DELETE simplemente no afecta filas.

delete from public.badges
where code in ('equipo_compostero', 'impacto_dorado', 'grupo_eco_lider');
