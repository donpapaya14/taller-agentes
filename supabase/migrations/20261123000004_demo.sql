-- La demostración (C-13, C-6): dos talleres con sus datos de partida y la función que los repone.
-- Todo es inventado: nombres, teléfonos, matrículas y NIF. Las matrículas y los teléfonos se
-- guardan normalizados, como los dejan normalizarMatricula y normalizarTelefono, para que lo que
-- se escriba después en la aplicación encaje con estas filas.
--
-- Las filas entran con su estado final: un insert no pasa por ordenes_reglas (solo vigila update).
-- Las fechas son relativas a ahora, así el tablero siempre parece de hoy.

create function app.sembrar_demo() returns void
  language plpgsql set search_path = ''
as $$
declare
  c_vega constant uuid := '00000000-0000-4000-8000-00000000000a';
  c_ribera constant uuid := '00000000-0000-4000-8000-00000000000b';
begin
  -- on delete cascade se lleva todo lo que cuelga de los dos talleres.
  delete from public.talleres where id in (c_vega, c_ribera);

  insert into public.talleres (id, nombre, nif, direccion, telefono, siguiente_factura) values
    (c_vega, 'Talleres Vega', 'B12345678', 'Calle de la Fragua, 14', '910 000 101', 2),
    (c_ribera, 'Mecánica Ribera', 'B87654321', 'Avenida del Molino, 7', '910 000 202', 1);

  insert into public.clientes (taller_id, nombre, telefono) values
    (c_vega, 'Lucía Ferrer Montoya', '34611203401'),
    (c_vega, 'Andrés Calvo Beltrán', '34622304402'),
    (c_vega, 'Marina Pastor Ibáñez', '34633405403'),
    (c_vega, 'Joaquín Nieto Barrera', '34644506404'),
    (c_vega, 'Carmen Roldán Sáez', '34655607405'),
    (c_vega, 'Hugo Lorente Valls', '34666708406'),
    (c_ribera, 'Elena Cano Quiroga', '34677809407'),
    (c_ribera, 'Rubén Gallego Lara', '34688900408');

  -- Matrículas con las últimas letras de la serie (X, Y, Z), lejos de las que se asignan hoy.
  insert into public.vehiculos (taller_id, cliente_id, matricula, marca, modelo)
  select v.taller, c.id, v.matricula, v.marca, v.modelo
    from (values
      (c_vega, 'Lucía Ferrer Montoya', '3517XGB', 'Seat', 'Ibiza'),
      (c_vega, 'Lucía Ferrer Montoya', '6204XSN', 'Toyota', 'Yaris'),
      (c_vega, 'Andrés Calvo Beltrán', '8842XKD', 'Renault', 'Clio'),
      (c_vega, 'Marina Pastor Ibáñez', '2093YFP', 'Citroën', 'C3'),
      (c_vega, 'Joaquín Nieto Barrera', '7716YLC', 'Volkswagen', 'Golf'),
      (c_vega, 'Joaquín Nieto Barrera', '1450YRT', 'Ford', 'Transit Connect'),
      (c_vega, 'Carmen Roldán Sáez', '9368ZBH', 'Peugeot', '208'),
      (c_vega, 'Hugo Lorente Valls', '5821ZCW', 'Opel', 'Corsa'),
      (c_ribera, 'Elena Cano Quiroga', '4112XZP', 'Kia', 'Picanto'),
      (c_ribera, 'Rubén Gallego Lara', '0679YMV', 'Hyundai', 'i20')
    ) as v(taller, cliente, matricula, marca, modelo)
    join public.clientes c on c.taller_id = v.taller and c.nombre = v.cliente;

  -- En Vega, dos recambios con el stock en el mínimo o por debajo (aceite y correa); la batería
  -- queda justo por encima. Lo que llevan las órdenes listas cabe en el stock: se pueden entregar.
  insert into public.recambios (taller_id, referencia, nombre, precio_centimos, stock, stock_minimo)
  values
    (c_vega, 'FIL-ACE-01', 'Filtro de aceite', 899, 24, 6),
    (c_vega, 'FIL-AIR-02', 'Filtro de aire', 1250, 18, 5),
    (c_vega, 'FIL-HAB-03', 'Filtro de habitáculo', 1490, 12, 4),
    (c_vega, 'PAS-FRE-01', 'Pastillas de freno delanteras', 3490, 9, 4),
    (c_vega, 'DIS-FRE-01', 'Disco de freno delantero', 4850, 6, 2),
    (c_vega, 'BUJ-NGK-04', 'Bujía', 690, 40, 12),
    (c_vega, 'ACE-5W30-5L', 'Aceite 5W-30, 5 litros', 3290, 4, 4),
    (c_vega, 'COR-DIS-01', 'Kit de correa de distribución', 8900, 1, 3),
    (c_vega, 'BAT-70AH-01', 'Batería 70 Ah', 9500, 5, 4),
    (c_vega, 'LIM-PAR-02', 'Escobillas limpiaparabrisas', 1590, 15, 4),
    (c_ribera, 'FIL-ACE-01', 'Filtro de aceite', 950, 14, 4),
    (c_ribera, 'PAS-FRE-01', 'Pastillas de freno delanteras', 3290, 8, 3),
    (c_ribera, 'BUJ-NGK-04', 'Bujía', 720, 30, 10);

  -- creada y entregada son «hace cuánto». El precio por hora queda en el de por defecto.
  insert into public.ordenes
    (taller_id, vehiculo_id, estado, descripcion, mano_obra_minutos, numero_factura, creada_en,
     entregada_en)
  select o.taller, v.id, o.estado::public.estado_orden, o.descripcion, o.minutos, o.factura,
         now() - o.creada, now() - o.entregada
    from (values
      (c_vega, '3517XGB', 'recibido', 'Revisión de los 60.000 km: aceite, filtros y frenos',
        0, null, interval '2 hours', null),
      (c_vega, '8842XKD', 'recibido', 'Ruido metálico al frenar con las ruedas delanteras',
        0, null, interval '5 hours', null),
      (c_vega, '9368ZBH', 'recibido', 'No arranca por las mañanas con frío',
        0, null, interval '1 day', null),
      (c_vega, '2093YFP', 'en_reparacion', 'Cambio de la correa de distribución',
        150, null, interval '1 day 4 hours', null),
      (c_vega, '7716YLC', 'en_reparacion', 'Sustitución de pastillas y discos de freno delanteros',
        90, null, interval '2 days', null),
      (c_vega, '5821ZCW', 'en_reparacion', 'La batería no carga: cambio y revisión del alternador',
        45, null, interval '2 days 6 hours', null),
      (c_vega, '6204XSN', 'listo', 'Cambio de aceite y filtros',
        40, null, interval '3 days', null),
      (c_vega, '1450YRT', 'listo', 'Cambio de escobillas y del filtro del habitáculo',
        20, null, interval '4 days', null),
      (c_vega, '3517XGB', 'entregado', 'Sustitución de las cuatro bujías',
        60, 'F-2026-0001', interval '9 days', interval '6 days'),
      (c_ribera, '4112XZP', 'recibido', 'Pastillas de freno traseras gastadas',
        0, null, interval '3 hours', null),
      (c_ribera, '0679YMV', 'recibido', 'Revisión antes de pasar la ITV',
        0, null, interval '1 day', null)
    ) as o(taller, matricula, estado, descripcion, minutos, factura, creada, entregada)
    join public.vehiculos v on v.taller_id = o.taller and v.matricula = o.matricula;

  -- Sin precio: lo copia del recambio el disparador orden_lineas_precio.
  insert into public.orden_lineas (taller_id, orden_id, recambio_id, cantidad)
  select o.taller_id, o.id, r.id, l.cantidad
    from (values
      ('Cambio de la correa de distribución', 'COR-DIS-01', 1),
      ('Sustitución de pastillas y discos de freno delanteros', 'PAS-FRE-01', 1),
      ('Sustitución de pastillas y discos de freno delanteros', 'DIS-FRE-01', 2),
      ('La batería no carga: cambio y revisión del alternador', 'BAT-70AH-01', 1),
      ('Cambio de aceite y filtros', 'ACE-5W30-5L', 1),
      ('Cambio de aceite y filtros', 'FIL-ACE-01', 1),
      ('Cambio de aceite y filtros', 'FIL-AIR-02', 1),
      ('Cambio de escobillas y del filtro del habitáculo', 'LIM-PAR-02', 1),
      ('Cambio de escobillas y del filtro del habitáculo', 'FIL-HAB-03', 1),
      ('Sustitución de las cuatro bujías', 'BUJ-NGK-04', 4)
    ) as l(orden, referencia, cantidad)
    join public.ordenes o on o.taller_id = c_vega and o.descripcion = l.orden
    join public.recambios r on r.taller_id = c_vega and r.referencia = l.referencia;

  -- Los usuarios los crea Auth, no esta función: se buscan por correo y, si falta alguno, se salta
  -- su fila. on conflict: un usuario de demostración que alguien movió de taller vuelve al suyo.
  insert into public.miembros (usuario_id, taller_id, rol, nombre)
  select u.id, m.taller, m.rol::public.rol_taller, m.nombre
    from (values
      ('jefe@tallerdemo.example', c_vega, 'jefe', 'Marta Vega'),
      ('mecanico@tallerdemo.example', c_vega, 'mecanico', 'Iván Soler'),
      ('jefe@otrotaller.example', c_ribera, 'jefe', 'Raúl Ribera')
    ) as m(correo, taller, rol, nombre)
    join auth.users u on u.email = m.correo
  on conflict (usuario_id) do update
    set taller_id = excluded.taller_id, rol = excluded.rol, nombre = excluded.nombre;
end;
$$;

create function public.restablecer_demo() returns text
  language plpgsql security definer set search_path = ''
as $$
declare
  v_ultimo timestamptz;
begin
  -- La fila de control se crea si falta y se bloquea: dos peticiones a la vez no pasan las dos el
  -- control de los 10 minutos, la segunda espera y ve la marca de la primera.
  insert into public.demo_control (id) values (true) on conflict (id) do nothing;
  select ultimo_restablecido into v_ultimo from public.demo_control where id = true for update;

  if v_ultimo > now() - interval '10 minutes' then
    return 'EN_ESPERA';
  end if;

  perform app.sembrar_demo();
  update public.demo_control set ultimo_restablecido = now() where id = true;
  return 'RESTABLECIDO';
end;
$$;

-- Solo la clave de servicio restablece: ni anon ni authenticated, y nadie llama a sembrar_demo
-- saltándose el control de los 10 minutos.
revoke all on function app.sembrar_demo() from public, anon, authenticated;
revoke all on function public.restablecer_demo() from public, anon, authenticated;
grant execute on function public.restablecer_demo() to service_role;
