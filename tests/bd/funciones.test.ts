import { afterAll, describe, expect, it } from 'vitest';
import { crearBd } from './arnes';

// Las únicas funciones con los permisos de su dueño: las que miran quién es el usuario y las dos
// que escriben lo que la API no puede (entregar y restablecer la demo).
const SECURITY_DEFINER = [
  'app.mi_rol',
  'app.mi_taller',
  'public.cerrar_orden',
  'public.restablecer_demo',
];
const DISPARADORES = ['public.orden_lineas_precio', 'public.ordenes_reglas'];

// Quién puede ejecutar cada una: anon, authenticated y PUBLIC (que lo hereda cualquiera).
const QUIEN_EJECUTA = {
  'app.mi_rol': { anon: false, authenticated: true, publico: false },
  'app.mi_taller': { anon: false, authenticated: true, publico: false },
  'app.sembrar_demo': { anon: false, authenticated: false, publico: false },
  'public.cerrar_orden': { anon: false, authenticated: true, publico: false },
  'public.restablecer_demo': { anon: false, authenticated: false, publico: false },
};

const bd = await crearBd();

afterAll(() => bd.cerrar());

const funciones = () =>
  bd.sql(
    `select n.nspname || '.' || p.proname as funcion, p.prosecdef as definer,
            p.prorettype = 'trigger'::regtype as disparador
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname in ('public', 'app')
      order by 1`,
  );

describe('funciones de public y app', () => {
  // Un disparador security definer correría con los permisos de su dueño cada vez que alguien
  // toque la tabla, y se saltaría la RLS en todo lo que consulte.
  it('[D-3] las funciones de disparador no son security definer', async () => {
    const todas = await funciones();
    const disparadores = todas.filter(({ disparador }) => disparador === true);

    expect(disparadores.map(({ funcion }) => funcion)).toEqual(DISPARADORES);
    expect(disparadores.filter(({ definer }) => definer === true)).toEqual([]);
  });

  it('[D-3] solo las funciones previstas son security definer', async () => {
    const todas = await funciones();

    expect(todas.filter(({ definer }) => definer === true).map(({ funcion }) => funcion)).toEqual(
      SECURITY_DEFINER,
    );
  });

  it('[D-3] cada función de gestión solo la ejecutan quienes deben', async () => {
    const filas = await bd.sql(
      `select n.nspname || '.' || p.proname as funcion,
              has_function_privilege('anon', p.oid, 'EXECUTE') as anon,
              has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated,
              exists (
                select 1 from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                 where a.grantee = 0 and a.privilege_type = 'EXECUTE'
              ) as publico
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname || '.' || p.proname = any($1::text[])`,
      [Object.keys(QUIEN_EJECUTA)],
    );
    const ejecucion = Object.fromEntries(
      filas.map(({ funcion, ...quien }) => [String(funcion), quien]),
    );

    expect(ejecucion).toEqual(QUIEN_EJECUTA);
  });
});
