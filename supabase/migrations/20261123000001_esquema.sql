-- Esquema de FOSO (docs/SPEC.md, «Modelo de datos»). El dinero va en céntimos enteros (D-5).
-- Cada tabla de negocio cuelga de un taller: borrar el taller borra todo lo suyo.
-- Las referencias entre tablas llevan el taller (claves ajenas compuestas): una fila solo apunta a
-- filas de su taller, también cuando escribe quien se salta la RLS, como una función security
-- definer (C-2).

create type public.rol_taller as enum ('jefe', 'mecanico');
create type public.estado_orden as enum ('recibido', 'en_reparacion', 'listo', 'entregado');

create table public.talleres (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  nif text,
  direccion text,
  telefono text,
  siguiente_factura integer not null default 1
);

-- Un taller por usuario: la clave es el usuario.
create table public.miembros (
  usuario_id uuid primary key references auth.users (id) on delete cascade,
  taller_id uuid not null references public.talleres (id) on delete cascade,
  rol public.rol_taller not null,
  nombre text not null
);

create table public.clientes (
  id uuid primary key default gen_random_uuid(),
  taller_id uuid not null references public.talleres (id) on delete cascade,
  nombre text not null,
  telefono text,
  unique (taller_id, id)
);

create table public.vehiculos (
  id uuid primary key default gen_random_uuid(),
  taller_id uuid not null references public.talleres (id) on delete cascade,
  cliente_id uuid not null,
  matricula text not null,
  marca text,
  modelo text,
  unique (taller_id, matricula),
  unique (taller_id, id),
  foreign key (taller_id, cliente_id) references public.clientes (taller_id, id)
);

create table public.recambios (
  id uuid primary key default gen_random_uuid(),
  taller_id uuid not null references public.talleres (id) on delete cascade,
  referencia text not null,
  nombre text not null,
  precio_centimos integer not null check (precio_centimos >= 0),
  stock integer not null default 0 check (stock >= 0),
  stock_minimo integer not null default 0 check (stock_minimo >= 0),
  unique (taller_id, referencia),
  unique (taller_id, id)
);

create table public.ordenes (
  id uuid primary key default gen_random_uuid(),
  taller_id uuid not null references public.talleres (id) on delete cascade,
  vehiculo_id uuid not null,
  estado public.estado_orden not null default 'recibido',
  descripcion text not null,
  mano_obra_minutos integer not null default 0 check (mano_obra_minutos >= 0),
  precio_hora_centimos integer not null default 4500 check (precio_hora_centimos >= 0),
  numero_factura text,
  creada_en timestamptz not null default now(),
  entregada_en timestamptz,
  unique (taller_id, id),
  foreign key (taller_id, vehiculo_id) references public.vehiculos (taller_id, id)
);

create table public.orden_lineas (
  id uuid primary key default gen_random_uuid(),
  taller_id uuid not null references public.talleres (id) on delete cascade,
  orden_id uuid not null,
  recambio_id uuid not null,
  cantidad integer not null check (cantidad > 0),
  precio_unitario_centimos integer not null check (precio_unitario_centimos >= 0),
  unique (orden_id, recambio_id),
  foreign key (taller_id, orden_id) references public.ordenes (taller_id, id) on delete cascade,
  foreign key (taller_id, recambio_id) references public.recambios (taller_id, id)
);

-- Vale para cualquiera que cambie una orden, también para quien se salta la RLS: una orden no
-- cambia de taller, entregada ya no cambia y solo avanza un paso o retrocede uno (C-4).
create function public.ordenes_reglas() returns trigger
  language plpgsql
  set search_path = ''
as $$
begin
  if new.taller_id <> old.taller_id then
    raise exception 'TALLER_INMUTABLE';
  end if;
  if old.estado = 'entregado' then
    raise exception 'ORDEN_CERRADA';
  end if;
  if new.estado <> old.estado and (old.estado, new.estado) not in (
    ('recibido', 'en_reparacion'),
    ('en_reparacion', 'listo'),
    ('listo', 'entregado'),
    ('en_reparacion', 'recibido'),
    ('listo', 'en_reparacion')
  ) then
    raise exception 'TRANSICION_INVALIDA';
  end if;
  return new;
end;
$$;

create trigger ordenes_reglas
  before update on public.ordenes
  for each row execute function public.ordenes_reglas();

-- El precio de una línea es el de su recambio al añadirla, venga lo que venga en la fila: nadie lo
-- elige (C-3). Se busca en el taller de la línea; si el recambio es de otro, queda null y el
-- not null rechaza la fila.
create function public.orden_lineas_precio() returns trigger
  language plpgsql
  set search_path = ''
as $$
begin
  new.precio_unitario_centimos := (
    select precio_centimos from public.recambios
    where id = new.recambio_id and taller_id = new.taller_id
  );
  return new;
end;
$$;

create trigger orden_lineas_precio
  before insert on public.orden_lineas
  for each row execute function public.orden_lineas_precio();

-- Una sola fila (id siempre true): cuándo se restableció la demo por última vez.
create table public.demo_control (
  id boolean primary key default true check (id),
  ultimo_restablecido timestamptz
);
