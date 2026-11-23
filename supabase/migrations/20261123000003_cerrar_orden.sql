-- Entregar una orden (C-5, C-8): descuenta el stock de cada línea, le da su número de factura y la
-- cierra, todo en la misma transacción. Es la única vía a «entregado»: por la API nadie escribe el
-- estado final, el número ni la fecha (permisos por columna y políticas de 02_rls).
--
-- security definer porque escribe columnas que authenticated no puede tocar. El rol y el taller
-- salen de la sesión (app.mi_rol, app.mi_taller), nunca de un parámetro: lo único que llega de
-- fuera es la orden.
create function public.cerrar_orden(p_orden uuid) returns text
  language plpgsql security definer set search_path = ''
as $$
declare
  v_taller uuid;
  v_estado public.estado_orden;
  v_linea record;
  v_numero integer;
  v_factura text;
begin
  -- is distinct from: quien no es miembro de ningún taller tampoco es jefe.
  if app.mi_rol() is distinct from 'jefe' then
    raise exception 'SOLO_JEFE';
  end if;

  -- for update: dos entregas a la vez de la misma orden se ponen en cola y la segunda la ve ya
  -- entregada.
  select taller_id, estado into v_taller, v_estado
    from public.ordenes
   where id = p_orden and taller_id = app.mi_taller()
     for update;
  if not found then
    raise exception 'ORDEN_NO_ENCONTRADA';
  end if;
  if v_estado <> 'listo' then
    raise exception 'ESTADO_INVALIDO';
  end if;

  -- Por referencia: todas las entregas bloquean los recambios en el mismo orden (sin
  -- interbloqueos) y el error nombra siempre el primero que falta. La unión y el update filtran
  -- también por taller, aunque las claves compuestas ya lo impidan: una línea que apuntara a un
  -- recambio ajeno saldría sin referencia y el update no encontraría fila.
  for v_linea in
    select l.recambio_id, l.cantidad, r.referencia
      from public.orden_lineas l
      left join public.recambios r on r.id = l.recambio_id and r.taller_id = l.taller_id
     where l.orden_id = p_orden and l.taller_id = v_taller
     order by r.referencia
  loop
    update public.recambios
       set stock = stock - v_linea.cantidad
     where id = v_linea.recambio_id and taller_id = v_taller and stock >= v_linea.cantidad;
    if not found then
      raise exception 'STOCK_INSUFICIENTE:%', v_linea.referencia;
    end if;
  end loop;

  -- La numeración es del taller y sigue entre años. Si algo falla después, el contador vuelve
  -- atrás con el resto: no quedan huecos.
  update public.talleres
     set siguiente_factura = siguiente_factura + 1
   where id = v_taller
  returning siguiente_factura - 1 into v_numero;

  -- lpad recorta por la derecha lo que no cabe: sin el case, el 10000 y el 10001 saldrían los dos
  -- como F-AAAA-1000 y repetirían número. De 10000 en adelante el número va entero.
  v_factura := 'F-' || to_char(now(), 'YYYY') || '-'
    || case when v_numero < 10000 then lpad(v_numero::text, 4, '0') else v_numero::text end;

  update public.ordenes
     set estado = 'entregado', numero_factura = v_factura, entregada_en = now()
   where id = p_orden and taller_id = v_taller;

  return v_factura;
end;
$$;

revoke all on function public.cerrar_orden(uuid) from public, anon;
grant execute on function public.cerrar_orden(uuid) to authenticated;
