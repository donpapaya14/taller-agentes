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

// Las que el modelo de datos da por obligatorias: un check como cantidad > 0 deja pasar un null.
const COLUMNAS_SIN_NULOS = [
  'miembros.taller_id',
  'miembros.rol',
  'miembros.nombre',
  'clientes.nombre',
  'vehiculos.cliente_id',
  'ordenes.vehiculo_id',
  'orden_lineas.orden_id',
  'orden_lineas.recambio_id',
  'orden_lineas.cantidad',
  'orden_lineas.precio_unitario_centimos',
  'recambios.precio_centimos',
  'recambios.stock',
  'recambios.stock_minimo',
];

// Lo que pone la base de datos cuando la fila no lo trae. Los id con gen_random_uuid() los prueba
// cada insert de los tests.
const VALORES_POR_DEFECTO = {
  'demo_control.id': 'true',
  'ordenes.creada_en': 'now()',
  'ordenes.estado': `'recibido'::estado_orden`,
  'ordenes.mano_obra_minutos': '0',
  'ordenes.precio_hora_centimos': '4500',
  'recambios.stock': '0',
  'recambios.stock_minimo': '0',
  'talleres.siguiente_factura': '1',
};

// En órdenes y líneas, lo único que la API escribe; lo demás lo ponen la base de datos y sus
// funciones.
const COLUMNAS_QUE_ESCRIBE_LA_API = {
  'ordenes INSERT': ['descripcion', 'taller_id', 'vehiculo_id'],
  'ordenes UPDATE': ['descripcion', 'estado', 'mano_obra_minutos'],
  'orden_lineas INSERT': ['cantidad', 'orden_id', 'recambio_id', 'taller_id'],
  'orden_lineas UPDATE': ['cantidad'],
};

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
    `insert into public.vehiculos (taller_id, cliente_id, matricula)
     select taller_id, cliente_id, matricula from public.vehiculos where taller_id = $1`,
  ],
  [
    'recambios_taller_id_referencia_key',
    `insert into public.recambios (taller_id, referencia, nombre, precio_centimos)
     select taller_id, referencia, nombre, precio_centimos from public.recambios where taller_id = $1`,
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

// Clave -> valor, para comparar sin depender del orden en que Postgres devuelve las filas.
const comoMapa = (filas: Record<string, unknown>[], clave: string, valor: string) =>
  Object.fromEntries(filas.map((fila) => [fila[clave], fila[valor]]));

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

// Privilegios de un rol sobre tablas, enteras o solo algunas columnas, en los esquemas que
// encajan con `esquema` (todos, si no se dice).
const privilegiosDe = (rol: string, esquema = '%') =>
  bd.sql(
    `select table_name || ' ' || privilege_type as privilegio
       from information_schema.role_table_grants
      where grantee = $1 and table_schema like $2
     union
     select table_name || ' ' || privilege_type
       from information_schema.column_privileges
      where grantee = $1 and table_schema like $2
     order by 1`,
    [rol, esquema],
  );

describe('catálogo de Postgres', () => {
  it('[D-3] toda tabla de public tiene RLS activado', async () => {
    const tablas = await tablasDePublic();

    expect(tablas.map(({ tabla }) => tabla)).toEqual(expect.arrayContaining(TABLAS));
    expect(tablas.filter(({ rls }) => rls !== true)).toEqual([]);
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

  // Con el search_path vacío y los nombres completos, nadie cambia lo que leen las funciones de
  // las políticas y los disparadores creando objetos con el mismo nombre en otro esquema.
  it('las funciones de public y app fijan el search_path', async () => {
    const funciones = await bd.sql(
      `select n.nspname || '.' || p.proname as funcion, p.proconfig as ajustes
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname in ('public', 'app')`,
    );
    const sinFijar = funciones.filter(
      ({ ajustes }) => !(Array.isArray(ajustes) && ajustes.includes('search_path=""')),
    );

    expect(funciones.map(({ funcion }) => funcion)).toEqual(
      expect.arrayContaining([
        'app.mi_rol',
        'app.mi_taller',
        'public.orden_lineas_precio',
        'public.ordenes_reglas',
      ]),
    );
    expect(sinFijar).toEqual([]);
  });
});

describe('permisos', () => {
  it('[D-3] anon no tiene privilegios sobre tablas de public', async () => {
    expect(await privilegiosDe('anon')).toEqual([]);
  });

  // Supabase concede de serie todo a authenticated, truncate incluido, y truncate no pasa por RLS.
  it('authenticated solo tiene sobre public los privilegios que usan sus políticas', async () => {
    const usados = await bd.sql(
      `select distinct tablename || ' ' || cmd as privilegio
         from pg_policies
        where schemaname = 'public'
        order by 1`,
    );

    expect(usados).not.toEqual([]);
    expect(await privilegiosDe('authenticated', 'public')).toEqual(usados);
  });

  it('en órdenes y líneas authenticated solo escribe las columnas que le tocan', async () => {
    const escribibles = await bd.sql(
      `select table_name || ' ' || privilege_type as permiso,
              array_agg(column_name::text order by column_name::text collate "C") as columnas
         from information_schema.column_privileges
        where grantee = 'authenticated' and table_name in ('ordenes', 'orden_lineas')
          and privilege_type in ('INSERT', 'UPDATE')
        group by 1`,
    );

    expect(comoMapa(escribibles, 'permiso', 'columnas')).toEqual(COLUMNAS_QUE_ESCRIBE_LA_API);
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

  it('[D-3] las columnas obligatorias no admiten nulos', async () => {
    const columnas = await bd.sql(
      `select table_name || '.' || column_name as columna, is_nullable as nulos
         from information_schema.columns
        where table_schema = 'public' and table_name || '.' || column_name = any($1::text[])`,
      [COLUMNAS_SIN_NULOS],
    );

    expect(comoMapa(columnas, 'columna', 'nulos')).toEqual(
      Object.fromEntries(COLUMNAS_SIN_NULOS.map((columna) => [columna, 'NO'])),
    );
  });

  it.each(NEGATIVOS)('rechaza lo que viola %s', async (restriccion, cambio) => {
    const intento = bd.sql(`update public.${cambio} where taller_id = $1`, [semilla.tallerA]);

    await expect(intento).rejects.toThrow(`violates check constraint "${restriccion}"`);
  });

  it('[D-3] un precio por hora negativo se rechaza', async () => {
    const intento = bd.sql('update public.ordenes set precio_hora_centimos = -500');

    await expect(intento).rejects.toThrow(
      'violates check constraint "ordenes_precio_hora_centimos_check"',
    );
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

describe('tipos y valores por defecto', () => {
  it('[D-5] los importes se guardan en céntimos enteros', async () => {
    const importes = await bd.sql(
      `select table_name || '.' || column_name as columna, data_type as tipo
         from information_schema.columns
        where table_schema = 'public'
          and (column_name like '%centimos'
               or data_type in ('numeric', 'real', 'double precision', 'money'))`,
    );

    expect(comoMapa(importes, 'columna', 'tipo')).toEqual({
      'orden_lineas.precio_unitario_centimos': 'integer',
      'ordenes.precio_hora_centimos': 'integer',
      'recambios.precio_centimos': 'integer',
    });
  });

  it('los valores por defecto son los del modelo de datos', async () => {
    const conValor = await bd.sql(
      `select table_name || '.' || column_name as columna, column_default as valor
         from information_schema.columns
        where table_schema = 'public' and column_default <> 'gen_random_uuid()'`,
    );

    expect(comoMapa(conValor, 'columna', 'valor')).toEqual(VALORES_POR_DEFECTO);
  });
});

describe('borrado de un taller', () => {
  // Filas que cuelgan de cada taller, la suya en talleres incluida.
  const filasPorTaller = () =>
    bd.sql(
      `select taller_id::text as taller, count(*)::int as filas from (
         select id as taller_id from public.talleres
         union all select taller_id from public.miembros
         union all select taller_id from public.clientes
         union all select taller_id from public.vehiculos
         union all select taller_id from public.recambios
         union all select taller_id from public.ordenes
         union all select taller_id from public.orden_lineas
       ) filas group by 1`,
    );

  // app.sembrar_demo() borra los talleres de demostración: las claves compuestas no lo frenan.
  it('borrar un taller borra todo lo suyo y nada del otro', async () => {
    await bd.sql('begin');
    const quedan = await bd
      .sql('delete from public.talleres where id = $1', [semilla.tallerA])
      .then(filasPorTaller)
      .finally(() => bd.sql('rollback'));

    expect(quedan).toEqual([{ taller: semilla.tallerB, filas: 8 }]);
  });
});
