import { afterAll, describe, expect, it } from 'vitest';
import { como, crearBd, sembrarDosTalleres } from './arnes';

// demo_control no tiene políticas a propósito: nadie la lee ni la cambia por la API.
const TABLAS_DE_NEGOCIO = [
  'talleres',
  'miembros',
  'clientes',
  'vehiculos',
  'recambios',
  'ordenes',
  'orden_lineas',
];
const TABLAS = [...TABLAS_DE_NEGOCIO, 'demo_control'];

const COLUMNAS_OBLIGATORIAS = [
  'clientes.nombre',
  'clientes.taller_id',
  'miembros.nombre',
  'miembros.taller_id',
  'orden_lineas.taller_id',
  'ordenes.descripcion',
  'ordenes.taller_id',
  'recambios.nombre',
  'recambios.referencia',
  'recambios.taller_id',
  'talleres.nombre',
  'vehiculos.matricula',
  'vehiculos.taller_id',
];

// Cada cambio choca con una restricción y no deja nada escrito.
const NEGATIVOS = [
  ['recambios_precio_centimos_check', 'recambios set precio_centimos = -1'],
  ['recambios_stock_check', 'recambios set stock = -1'],
  ['recambios_stock_minimo_check', 'recambios set stock_minimo = -1'],
  ['ordenes_mano_obra_minutos_check', 'ordenes set mano_obra_minutos = -1'],
  ['orden_lineas_cantidad_check', 'orden_lineas set cantidad = 0'],
  ['orden_lineas_precio_unitario_centimos_check', 'orden_lineas set precio_unitario_centimos = -1'],
] as const;
const DUPLICADOS = [
  [
    'vehiculos_taller_id_matricula_key',
    `insert into public.vehiculos (taller_id, matricula)
     select taller_id, matricula from public.vehiculos where taller_id = $1`,
  ],
  [
    'recambios_taller_id_referencia_key',
    `insert into public.recambios (taller_id, referencia, nombre)
     select taller_id, referencia, nombre from public.recambios where taller_id = $1`,
  ],
  [
    'orden_lineas_orden_id_recambio_id_key',
    `insert into public.orden_lineas
       (taller_id, orden_id, recambio_id, cantidad, precio_unitario_centimos)
     select taller_id, orden_id, recambio_id, 1, 1 from public.orden_lineas where taller_id = $1`,
  ],
] as const;

const bd = await crearBd();
const semilla = await sembrarDosTalleres(bd);

afterAll(() => bd.cerrar());

describe('arnés', () => {
  it('entra como authenticated con el usuario en auth.uid() y deshace al salir', async () => {
    const usuario = '00000000-0000-4000-8000-000000000001';

    const dentro = await como(bd, usuario, (sql) =>
      sql(
        `select current_user as rol, auth.uid() as usuario,
                set_config('arnes.marca', 'dentro', false) as marca`,
      ),
    );
    const fuera = await bd.sql(
      `select current_user as rol, current_setting('arnes.marca', true) as marca`,
    );

    expect(dentro).toEqual([{ rol: 'authenticated', usuario, marca: 'dentro' }]);
    expect(fuera).toEqual([{ rol: 'postgres', marca: '' }]);
  });

  it('entra como anon sin usuario cuando no hay sesión', async () => {
    const dentro = await como(bd, null, (sql) =>
      sql('select current_user as rol, auth.uid() as usuario'),
    );

    expect(dentro).toEqual([{ rol: 'anon', usuario: null }]);
  });
});

const tablasDePublic = () =>
  bd.sql(
    `select c.relname as tabla, c.relrowsecurity as rls
       from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind in ('r', 'p')`,
  );

describe('catálogo de Postgres', () => {
  it('[D-3] toda tabla de public tiene RLS activado', async () => {
    const tablas = await tablasDePublic();

    expect(tablas.map(({ tabla }) => tabla)).toEqual(expect.arrayContaining(TABLAS));
    expect(tablas.filter(({ rls }) => rls !== true)).toEqual([]);
  });

  it('[D-3] anon no tiene privilegios sobre tablas de public', async () => {
    const privilegios = await bd.sql(
      `select table_schema, table_name, privilege_type
         from information_schema.role_table_grants
        where grantee = 'anon'`,
    );

    expect(privilegios).toEqual([]);
  });

  it('[D-3] toda tabla de negocio tiene política que usa app.mi_taller', async () => {
    const politicasDeTaller = await bd.sql(
      `select distinct tablename as tabla from pg_policies
        where schemaname = 'public'
          and (qual like '%app.mi_taller()%' or with_check like '%app.mi_taller()%')`,
    );
    const conPolitica = politicasDeTaller.map(({ tabla }) => tabla);
    const sinPolitica = (await tablasDePublic())
      .map(({ tabla }) => tabla)
      .filter((tabla) => tabla !== 'demo_control' && !conPolitica.includes(tabla));

    expect(conPolitica).toEqual(expect.arrayContaining(TABLAS_DE_NEGOCIO));
    expect(sinPolitica).toEqual([]);
  });

  it('[D-3] las políticas de public solo se aplican a authenticated', async () => {
    const roles = await bd.sql(
      `select distinct roles::text[] as roles from pg_policies where schemaname = 'public'`,
    );

    expect(roles).toEqual([{ roles: ['authenticated'] }]);
  });

  // Supabase concede de serie todo a authenticated, truncate incluido, y truncate no pasa por RLS.
  it('authenticated solo tiene sobre public los privilegios que usan sus políticas', async () => {
    const concedidos = await bd.sql(
      `select table_name || ' ' || privilege_type as privilegio
         from information_schema.role_table_grants
        where grantee = 'authenticated' and table_schema = 'public'
        order by 1`,
    );
    const usados = await bd.sql(
      `select distinct tablename || ' ' || cmd as privilegio
         from pg_policies
        where schemaname = 'public'
        order by 1`,
    );

    expect(usados).not.toEqual([]);
    expect(concedidos).toEqual(usados);
  });
});

describe('restricciones del esquema', () => {
  it('exige taller, nombre, matrícula, referencia y descripción', async () => {
    const obligatorias = await bd.sql(
      `select table_name || '.' || column_name as columna
         from information_schema.columns
        where table_schema = 'public' and is_nullable = 'NO'
          and column_name in ('taller_id', 'nombre', 'matricula', 'referencia', 'descripcion')`,
    );

    expect(obligatorias.map(({ columna }) => String(columna)).sort()).toEqual(
      COLUMNAS_OBLIGATORIAS,
    );
  });

  it.each(NEGATIVOS)('rechaza lo que viola %s', async (restriccion, cambio) => {
    const intento = bd.sql(`update public.${cambio} where taller_id = $1`, [semilla.tallerA]);

    await expect(intento).rejects.toThrow(`violates check constraint "${restriccion}"`);
  });

  it.each(DUPLICADOS)(
    'dentro de un taller no repite lo que protege %s',
    async (restriccion, texto) => {
      await expect(bd.sql(texto, [semilla.tallerA])).rejects.toThrow(
        `duplicate key value violates unique constraint "${restriccion}"`,
      );
    },
  );

  it('demo_control solo admite la fila con id true', async () => {
    await expect(bd.sql('insert into public.demo_control (id) values (false)')).rejects.toThrow(
      'violates check constraint "demo_control_id_check"',
    );
  });
});
