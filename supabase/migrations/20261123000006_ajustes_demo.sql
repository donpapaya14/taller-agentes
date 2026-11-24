-- Ajustes que salen de la revisión de f05-funciones (proceso/f05-funciones/ronda-1.json): el orden
-- de los bloqueos de cerrar_orden y los datos de partida de la demo. Las migraciones 03 y 04 no se
-- tocan: aquí se reescriben las dos funciones con create or replace, que conserva sus permisos.

-- Entregar una orden (C-5, C-8). Igual que en la 03, salvo que el taller se bloquea el primero.
--
-- restablecer_demo borra la fila del taller y después, en cascada, todo lo que cuelga de ella. Si
-- esta función fuera por la orden y los recambios y dejara el taller para el final, con las dos a
-- la vez cada una esperaría a la otra (deadlock, 40P01) y una de las dos fallaría. Pidiendo el
-- taller antes que nada, la segunda espera a que la primera acabe. Si en ese tiempo se restableció
-- la demo, la orden ya no existe y sale ORDEN_NO_ENCONTRADA.
create or replace function public.cerrar_orden(p_orden uuid) returns text
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

  v_taller := app.mi_taller();
  perform 1 from public.talleres where id = v_taller for update;

  -- for update: dos entregas a la vez de la misma orden se ponen en cola y la segunda la ve ya
  -- entregada.
  select estado into v_estado
    from public.ordenes
   where id = p_orden and taller_id = v_taller
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

  -- El año es el de Madrid, no el de la zona de la sesión (UTC en Supabase): a las 00:30 del 1 de
  -- enero la factura ya es del año nuevo.
  -- lpad recorta por la derecha lo que no cabe: sin el case, el 10000 y el 10001 saldrían los dos
  -- como F-AAAA-1000 y repetirían número. De 10000 en adelante el número va entero.
  v_factura := 'F-' || to_char(now() at time zone 'Europe/Madrid', 'YYYY') || '-'
    || case when v_numero < 10000 then lpad(v_numero::text, 4, '0') else v_numero::text end;

  update public.ordenes
     set estado = 'entregado', numero_factura = v_factura, entregada_en = now()
   where id = p_orden and taller_id = v_taller;

  return v_factura;
end;
$$;

-- Los datos de partida de la demo (C-13). Igual que en la 04, con tres cambios:
--  * la factura de partida lleva el año de hoy en Madrid, el mismo que cerrar_orden pone en los
--    números nuevos, y su fecha de entrega cae en ese año (a principios de enero, «hace seis días»
--    sería de diciembre: se queda en el 1 de enero);
--  * los NIF y los teléfonos ya no son secuencias ni llevan ceros seguidos, que impresos en un PDF
--    parecen relleno. Siguen inventados, con el formato de verdad: el NIF con su dígito de control
--    y el teléfono de taller en grupos de tres.
create or replace function app.sembrar_demo() returns void
  language plpgsql set search_path = ''
as $$
declare
  c_vega constant uuid := '00000000-0000-4000-8000-00000000000a';
  c_ribera constant uuid := '00000000-0000-4000-8000-00000000000b';
  c_anio constant text := to_char(now() at time zone 'Europe/Madrid', 'YYYY');
  c_inicio_del_anio constant timestamptz :=
    date_trunc('year', now() at time zone 'Europe/Madrid') at time zone 'Europe/Madrid';
begin
  -- on delete cascade se lleva todo lo que cuelga de los dos talleres.
  delete from public.talleres where id in (c_vega, c_ribera);

  insert into public.talleres (id, nombre, nif, direccion, telefono, siguiente_factura) values
    (c_vega, 'Talleres Vega', 'B16725376', 'Calle de la Fragua, 14', '969 739 431', 2),
    (c_ribera, 'Mecánica Ribera', 'B44309219', 'Avenida del Molino, 7', '978 691 051', 1);

  insert into public.clientes (taller_id, nombre, telefono) values
    (c_vega, 'Lucía Ferrer Montoya', '34641682845'),
    (c_vega, 'Andrés Calvo Beltrán', '34684507046'),
    (c_vega, 'Marina Pastor Ibáñez', '34656142651'),
    (c_vega, 'Joaquín Nieto Barrera', '34671279167'),
    (c_vega, 'Carmen Roldán Sáez', '34617105204'),
    (c_vega, 'Hugo Lorente Valls', '34697408016'),
    (c_ribera, 'Elena Cano Quiroga', '34639036452'),
    (c_ribera, 'Rubén Gallego Lara', '34608906590');

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

  -- creada y entregada son «hace cuánto». El precio por hora queda en el de por defecto. La entrega
  -- no pasa del 1 de enero de este año, que es el año de la factura. El case: greatest ignora los
  -- null y a las órdenes sin entregar les pondría esa fecha.
  insert into public.ordenes
    (taller_id, vehiculo_id, estado, descripcion, mano_obra_minutos, numero_factura, creada_en,
     entregada_en)
  select o.taller, v.id, o.estado::public.estado_orden, o.descripcion, o.minutos, o.factura,
         now() - o.creada,
         case when o.entregada is not null
           then greatest(now() - o.entregada, c_inicio_del_anio) end
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
        60, 'F-' || c_anio || '-0001', interval '9 days', interval '6 days'),
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
