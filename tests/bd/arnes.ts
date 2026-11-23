// Postgres en proceso (PGlite) con lo que Supabase trae de serie y PGlite no: así las migraciones
// de supabase/migrations que se prueban aquí son las mismas que van a la nube.
import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { PGlite, type Transaction } from '@electric-sql/pglite';

export type Sql = (texto: string, parametros?: unknown[]) => Promise<Record<string, unknown>[]>;
export type Bd = { sql: Sql; cerrar: () => Promise<void> };

// PGlite y sus transacciones consultan igual; los tests solo necesitan las filas.
const sqlDe =
  (conexion: Pick<Transaction, 'query'>): Sql =>
  async (texto, parametros) =>
    (await conexion.query<Record<string, unknown>>(texto, parametros)).rows;

const CARPETA_MIGRACIONES = resolve(import.meta.dirname, '../../supabase/migrations');

// Roles de la API, permisos que Supabase concede por defecto sobre public (las migraciones tienen
// que quitarlos) y un esquema auth mínimo. En la nube auth.uid() sale del JWT; aquí, del ajuste
// de sesión que fija `como`.
const ENTORNO_SUPABASE = `
  create role anon nologin noinherit;
  create role authenticated nologin noinherit;
  create role service_role nologin noinherit bypassrls;
  grant usage on schema public to anon, authenticated, service_role;
  alter default privileges in schema public
    grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public
    grant all on sequences to anon, authenticated, service_role;
  alter default privileges in schema public
    grant all on functions to anon, authenticated, service_role;

  create schema auth;
  grant usage on schema auth to anon, authenticated, service_role;
  create table auth.users (id uuid primary key, email text unique);
  create function auth.uid() returns uuid language sql stable
    as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
`;

// `como` necesita la transacción de PGlite, que el tipo Bd no expone.
const conexiones = new WeakMap<Bd, PGlite>();

async function aplicarMigraciones(pg: PGlite): Promise<void> {
  const migraciones = (await readdir(CARPETA_MIGRACIONES))
    .filter((archivo) => archivo.endsWith('.sql'))
    .sort();
  for (const migracion of migraciones) {
    try {
      await pg.exec(await readFile(join(CARPETA_MIGRACIONES, migracion), 'utf8'));
    } catch (error) {
      throw new Error(`No se aplica la migración ${migracion}`, { cause: error });
    }
  }
}

export async function crearBd(): Promise<Bd> {
  const pg = await PGlite.create();
  await pg.exec(ENTORNO_SUPABASE);
  await aplicarMigraciones(pg);
  const bd: Bd = { sql: sqlDe(pg), cerrar: () => pg.close() };
  conexiones.set(bd, pg);
  return bd;
}

export type Semilla = {
  tallerA: string;
  tallerB: string;
  jefeA: string;
  mecanicoA: string;
  jefeB: string;
  ordenA: string;
  ordenB: string;
  recambioA: string;
  recambioB: string;
  clienteB: string;
  vehiculoB: string;
};

async function insertarDevolviendoId(
  sql: Sql,
  texto: string,
  parametros: unknown[],
): Promise<string> {
  const [fila] = await sql(`${texto} returning id`, parametros);
  return String(fila.id);
}

async function crearMiembro(
  sql: Sql,
  tallerId: string,
  rol: 'jefe' | 'mecanico',
  nombre: string,
): Promise<string> {
  const usuarioId = await insertarDevolviendoId(
    sql,
    'insert into auth.users (id) values (gen_random_uuid())',
    [],
  );
  await sql(
    'insert into public.miembros (usuario_id, taller_id, rol, nombre) values ($1, $2, $3, $4)',
    [usuarioId, tallerId, rol, nombre],
  );
  return usuarioId;
}

const crearRecambio = (sql: Sql, tallerId: string, referencia: string, nombre: string) =>
  insertarDevolviendoId(
    sql,
    `insert into public.recambios
       (taller_id, referencia, nombre, precio_centimos, stock, stock_minimo)
     values ($1, $2, $3, 1250, 10, 2)`,
    [tallerId, referencia, nombre],
  );

// Los dos talleres repiten matrícula y referencias: solo son únicas dentro de cada taller.
// La línea de la orden usa el segundo recambio; el primero queda libre para los tests.
async function sembrarTaller(sql: Sql, letra: 'A' | 'B') {
  const taller = await insertarDevolviendoId(
    sql,
    'insert into public.talleres (nombre) values ($1)',
    [`Taller ${letra}`],
  );
  const jefe = await crearMiembro(sql, taller, 'jefe', `Jefe ${letra}`);
  const cliente = await insertarDevolviendoId(
    sql,
    'insert into public.clientes (taller_id, nombre, telefono) values ($1, $2, $3)',
    [taller, `Cliente ${letra}`, '600000000'],
  );
  const vehiculo = await insertarDevolviendoId(
    sql,
    `insert into public.vehiculos (taller_id, cliente_id, matricula, marca, modelo)
     values ($1, $2, '1234 BCD', 'Seat', 'Ibiza')`,
    [taller, cliente],
  );
  const recambio = await crearRecambio(sql, taller, 'FIL-ACE-01', 'Filtro de aceite');
  const recambioDeLaLinea = await crearRecambio(sql, taller, 'PAS-FRE-02', 'Pastillas de freno');
  const orden = await insertarDevolviendoId(
    sql,
    'insert into public.ordenes (taller_id, vehiculo_id, descripcion) values ($1, $2, $3)',
    [taller, vehiculo, 'Revisión de frenos'],
  );
  // Sin precio: lo copia del recambio el disparador, también para el superusuario.
  await sql(
    `insert into public.orden_lineas (taller_id, orden_id, recambio_id, cantidad)
     values ($1, $2, $3, 1)`,
    [taller, orden, recambioDeLaLinea],
  );
  return { taller, jefe, cliente, vehiculo, recambio, orden };
}

// Como superusuario, fuera de `como`: los datos de partida no pasan por la RLS ni por los
// permisos de columna.
export async function sembrarDosTalleres(bd: Bd): Promise<Semilla> {
  const a = await sembrarTaller(bd.sql, 'A');
  const b = await sembrarTaller(bd.sql, 'B');
  const mecanicoA = await crearMiembro(bd.sql, a.taller, 'mecanico', 'Mecánico A');
  return {
    tallerA: a.taller,
    tallerB: b.taller,
    jefeA: a.jefe,
    mecanicoA,
    jefeB: b.jefe,
    ordenA: a.orden,
    ordenB: b.orden,
    recambioA: a.recambio,
    recambioB: b.recambio,
    clienteB: b.cliente,
    vehiculoB: b.vehiculo,
  };
}

// Ejecuta `fn` con la sesión que tendría ese usuario en la API de Supabase (null = visitante sin
// sesión) y deshace todo al terminar. Dentro de `fn` se usa el `sql` que recibe: `bd.sql` se
// quedaría esperando a que acabe la transacción.
export async function como<T>(
  bd: Bd,
  usuarioId: string | null,
  fn: (sql: Sql) => Promise<T>,
): Promise<T> {
  const pg = conexiones.get(bd);
  if (pg === undefined) {
    throw new Error('Esta Bd no sale de crearBd()');
  }
  return pg.transaction(async (tx) => {
    await tx.query(usuarioId === null ? 'set local role anon' : 'set local role authenticated');
    await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [usuarioId ?? '']);
    const resultado = await fn(sqlDe(tx));
    // Si `fn` lanza, PGlite ya deshace la transacción por su cuenta.
    await tx.rollback();
    return resultado;
  });
}
