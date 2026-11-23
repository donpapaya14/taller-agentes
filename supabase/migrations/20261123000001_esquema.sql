-- Esquema de FOSO (docs/SPEC.md, «Modelo de datos»). El dinero va en céntimos enteros (D-5).
-- Cada tabla de negocio cuelga de un taller: borrar el taller borra todo lo suyo.

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
  rol public.rol_taller,
  nombre text not null
);

create table public.clientes (
  id uuid primary key default gen_random_uuid(),
  taller_id uuid not null references public.talleres (id) on delete cascade,
  nombre text not null,
  telefono text
);

create table public.vehiculos (
  id uuid primary key default gen_random_uuid(),
  taller_id uuid not null references public.talleres (id) on delete cascade,
  cliente_id uuid references public.clientes (id),
  matricula text not null,
  marca text,
  modelo text,
  unique (taller_id, matricula)
);

create table public.recambios (
  id uuid primary key default gen_random_uuid(),
  taller_id uuid not null references public.talleres (id) on delete cascade,
  referencia text not null,
  nombre text not null,
  precio_centimos integer check (precio_centimos >= 0),
  stock integer check (stock >= 0),
  stock_minimo integer check (stock_minimo >= 0),
  unique (taller_id, referencia)
);

create table public.ordenes (
  id uuid primary key default gen_random_uuid(),
  taller_id uuid not null references public.talleres (id) on delete cascade,
  vehiculo_id uuid references public.vehiculos (id),
  estado public.estado_orden not null default 'recibido',
  descripcion text not null,
  mano_obra_minutos integer not null default 0 check (mano_obra_minutos >= 0),
  precio_hora_centimos integer not null default 4500,
  numero_factura text,
  creada_en timestamptz not null default now(),
  entregada_en timestamptz
);

create table public.orden_lineas (
  id uuid primary key default gen_random_uuid(),
  taller_id uuid not null references public.talleres (id) on delete cascade,
  orden_id uuid references public.ordenes (id) on delete cascade,
  recambio_id uuid references public.recambios (id),
  cantidad integer check (cantidad > 0),
  precio_unitario_centimos integer check (precio_unitario_centimos >= 0),
  unique (orden_id, recambio_id)
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

-- Una sola fila (id siempre true): cuándo se restableció la demo por última vez.
create table public.demo_control (
  id boolean primary key default true check (id),
  ultimo_restablecido timestamptz
);
