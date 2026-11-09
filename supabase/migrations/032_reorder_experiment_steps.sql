-- Reordenar pasos de un experimento de forma atomica.
--
-- experiment_steps tiene unique (experiment_id, step_order) no diferible, por lo
-- que intercambiar dos posiciones con un UPDATE directo choca a mitad de
-- sentencia. Esta funcion mueve primero los pasos a un rango temporal y luego
-- asigna el orden final (1..n) segun el arreglo recibido, todo en una sola
-- transaccion. Se invoca desde el servidor (service role) tras requireAdmin().

create or replace function public.reorder_experiment_steps(
  p_experiment_id uuid,
  p_step_ids uuid[]
) returns void
language plpgsql
as $$
declare
  v_total int;
  v_matched int;
begin
  select count(*) into v_total
  from experiment_steps
  where experiment_id = p_experiment_id;

  select count(*) into v_matched
  from experiment_steps
  where experiment_id = p_experiment_id
    and id = any(p_step_ids);

  -- El arreglo debe contener exactamente los pasos del experimento, sin repetidos.
  if v_total <> coalesce(array_length(p_step_ids, 1), 0)
     or v_matched <> v_total then
    raise exception 'La lista de pasos no coincide con los pasos del experimento'
      using errcode = '22023';
  end if;

  -- Fase 1: rango temporal para liberar las posiciones.
  update experiment_steps
  set step_order = step_order + 1000
  where experiment_id = p_experiment_id;

  -- Fase 2: orden final segun la posicion en el arreglo.
  update experiment_steps es
  set step_order = t.ord,
      updated_at = now()
  from unnest(p_step_ids) with ordinality as t(step_id, ord)
  where es.id = t.step_id
    and es.experiment_id = p_experiment_id;
end;
$$;

revoke all on function public.reorder_experiment_steps(uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.reorder_experiment_steps(uuid, uuid[]) to service_role;
