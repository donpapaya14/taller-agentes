-- Aislamiento por taller y reglas de rol (C-2, C-3, D-3). Lo decide Postgres: la interfaz solo
-- oculta. En las políticas, «del taller» es taller_id = app.mi_taller().

create schema app;

-- security definer porque leen miembros, cuya propia política las llama: con los permisos de
-- quien pregunta, la consulta volvería a pasar por esa política.
create function app.mi_taller() returns uuid
  language sql stable security definer set search_path = ''
  as $$ select taller_id from public.miembros where usuario_id = auth.uid() $$;

create function app.mi_rol() returns public.rol_taller
  language sql stable security definer set search_path = ''
  as $$ select rol from public.miembros where usuario_id = auth.uid() $$;

revoke all on function app.mi_taller() from public, anon;
revoke all on function app.mi_rol() from public, anon;
grant usage on schema app to authenticated;
grant execute on function app.mi_taller() to authenticated;
grant execute on function app.mi_rol() to authenticated;

alter table public.talleres enable row level security;
alter table public.miembros enable row level security;
alter table public.clientes enable row level security;
alter table public.vehiculos enable row level security;
alter table public.recambios enable row level security;
alter table public.ordenes enable row level security;
alter table public.orden_lineas enable row level security;
-- Sin políticas: nadie la lee ni la cambia por la API.
alter table public.demo_control enable row level security;

-- Supabase concede de serie todo sobre public a anon y a authenticated, truncate incluido, que no
-- pasa por RLS. anon se queda sin nada; authenticated, solo con lo que usan sus políticas.
revoke all on all tables in schema public from anon;
revoke all on all tables in schema public from authenticated;
grant select on public.talleres, public.miembros to authenticated;
grant select, insert, update, delete
  on public.clientes, public.vehiculos, public.recambios, public.ordenes, public.orden_lineas
  to authenticated;

create policy talleres_leer on public.talleres for select to authenticated
  using (id = app.mi_taller());

create policy miembros_leer on public.miembros for select to authenticated
  using (taller_id = app.mi_taller());

create policy clientes_leer on public.clientes for select to authenticated
  using (taller_id = app.mi_taller());
create policy clientes_crear on public.clientes for insert to authenticated
  with check (taller_id = app.mi_taller());
create policy clientes_cambiar on public.clientes for update to authenticated
  using (taller_id = app.mi_taller())
  with check (taller_id = app.mi_taller());
create policy clientes_borrar on public.clientes for delete to authenticated
  using (taller_id = app.mi_taller() and app.mi_rol() = 'jefe');

create policy vehiculos_leer on public.vehiculos for select to authenticated
  using (taller_id = app.mi_taller());
create policy vehiculos_crear on public.vehiculos for insert to authenticated
  with check (taller_id = app.mi_taller());
create policy vehiculos_cambiar on public.vehiculos for update to authenticated
  using (taller_id = app.mi_taller())
  with check (taller_id = app.mi_taller());
create policy vehiculos_borrar on public.vehiculos for delete to authenticated
  using (taller_id = app.mi_taller() and app.mi_rol() = 'jefe');

-- Recambios: todos los leen; solo el jefe los crea, les cambia precio o stock y los borra.
create policy recambios_leer on public.recambios for select to authenticated
  using (taller_id = app.mi_taller());
create policy recambios_crear on public.recambios for insert to authenticated
  with check (taller_id = app.mi_taller() and app.mi_rol() = 'jefe');
create policy recambios_cambiar on public.recambios for update to authenticated
  using (taller_id = app.mi_taller() and app.mi_rol() = 'jefe')
  with check (taller_id = app.mi_taller() and app.mi_rol() = 'jefe');
create policy recambios_borrar on public.recambios for delete to authenticated
  using (taller_id = app.mi_taller() and app.mi_rol() = 'jefe');

-- Órdenes: nadie las entrega ni les pone número de factura con un update directo, y una orden
-- entregada ya no se cambia ni se borra.
create policy ordenes_leer on public.ordenes for select to authenticated
  using (taller_id = app.mi_taller());
create policy ordenes_crear on public.ordenes for insert to authenticated
  with check (taller_id = app.mi_taller() and estado = 'recibido' and numero_factura is null);
create policy ordenes_cambiar on public.ordenes for update to authenticated
  using (taller_id = app.mi_taller() and estado <> 'entregado')
  with check (taller_id = app.mi_taller() and estado <> 'entregado' and numero_factura is null);
create policy ordenes_borrar on public.ordenes for delete to authenticated
  using (taller_id = app.mi_taller() and app.mi_rol() = 'jefe' and estado <> 'entregado');

-- Líneas: solo en órdenes del propio taller que aún no se han entregado.
create policy orden_lineas_leer on public.orden_lineas for select to authenticated
  using (taller_id = app.mi_taller());
create policy orden_lineas_crear on public.orden_lineas for insert to authenticated
  with check (
    taller_id = app.mi_taller()
    and exists (
      select 1 from public.ordenes o
      where o.id = orden_lineas.orden_id
        and o.taller_id = app.mi_taller()
        and o.estado <> 'entregado'
    )
  );
create policy orden_lineas_cambiar on public.orden_lineas for update to authenticated
  using (
    taller_id = app.mi_taller()
    and exists (
      select 1 from public.ordenes o
      where o.id = orden_lineas.orden_id
        and o.taller_id = app.mi_taller()
        and o.estado <> 'entregado'
    )
  )
  with check (
    taller_id = app.mi_taller()
    and exists (
      select 1 from public.ordenes o
      where o.id = orden_lineas.orden_id
        and o.taller_id = app.mi_taller()
        and o.estado <> 'entregado'
    )
  );
create policy orden_lineas_borrar on public.orden_lineas for delete to authenticated
  using (
    taller_id = app.mi_taller()
    and exists (
      select 1 from public.ordenes o
      where o.id = orden_lineas.orden_id
        and o.taller_id = app.mi_taller()
        and o.estado <> 'entregado'
    )
  );
