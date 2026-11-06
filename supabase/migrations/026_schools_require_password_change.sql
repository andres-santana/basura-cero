-- 026_schools_require_password_change.sql
-- Configuracion por escuela: controla si los usuarios creados por el admin
-- (maestros/jurado) deben cambiar su contrasena en el primer ingreso.
-- Para la etapa piloto el valor por defecto es false (no se fuerza el cambio).
alter table schools
add column if not exists require_password_change boolean not null default false;
