import { afterAll, describe, expect, it } from 'vitest';
import { como, crearBd, sembrarDosTalleres } from './arnes';
import { intentar } from './ayudas';

const PRIVILEGIOS_DE_TABLA = [
  'SELECT',
  'INSERT',
  'UPDATE',
  'DELETE',
  'TRUNCATE',
  'REFERENCES',
  'TRIGGER',
];
// Los únicos que se pueden dar solo sobre algunas columnas.
const PRIVILEGIOS_DE_COLUMNA = ['SELECT', 'INSERT', 'UPDATE', 'REFERENCES'];
const SOBRE_DEMO_CONTROL = [
  'select * from public.demo_control',
  'insert into public.demo_control (id) values (true)',
  'update public.demo_control set ultimo_restablecido = now()',
  'delete from public.demo_control',
];
const SIN_PERMISO = 'permission denied for table demo_control';

const bd = await crearBd();
const semilla = await sembrarDosTalleres(bd);

afterAll(() => bd.cerrar());

// Lo que `rol` puede hacer de verdad sobre las tablas de public, venga de donde venga: concedido a
// él, a un rol del que hereda o a PUBLIC. Mirar solo `grantee = rol` no ve esto último.
const privilegiosEfectivos = (rol: string, tabla: string | null = null) =>
  bd.sql(
    `select c.relname || ' ' || p.privilegio as privilegio
       from pg_class c, unnest($2::text[]) as p(privilegio)
      where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p')
        and ($4::text is null or c.relname = $4)
        and has_table_privilege($1, c.oid, p.privilegio)
     union
     select c.relname || ' ' || p.privilegio || ' (alguna columna)'
       from pg_class c, unnest($3::text[]) as p(privilegio)
      where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p')
        and ($4::text is null or c.relname = $4)
        and has_any_column_privilege($1, c.oid, p.privilegio)
      order by 1`,
    [rol, PRIVILEGIOS_DE_TABLA, PRIVILEGIOS_DE_COLUMNA, tabla],
  );

describe('permisos sobre las tablas de public', () => {
  it('[D-3] anon no puede nada sobre ninguna tabla, tampoco por lo que hereda de PUBLIC', async () => {
    expect(await privilegiosEfectivos('anon')).toEqual([]);
  });

  it('[D-3] ninguna tabla ni columna de public concede permisos a PUBLIC', async () => {
    const aPublic = await bd.sql(
      `select c.relname as objeto, a.privilege_type as privilegio
         from pg_class c, aclexplode(c.relacl) a
        where c.relnamespace = 'public'::regnamespace and a.grantee = 0
       union all
       select c.relname || '.' || t.attname, a.privilege_type
         from pg_attribute t join pg_class c on c.oid = t.attrelid, aclexplode(t.attacl) a
        where c.relnamespace = 'public'::regnamespace and a.grantee = 0`,
    );

    expect(aPublic).toEqual([]);
  });
});

describe('demo_control', () => {
  it('[D-3] authenticated no tiene ningún permiso sobre demo_control', async () => {
    expect(await privilegiosEfectivos('authenticated', 'demo_control')).toEqual([]);
  });

  it.each([
    ['authenticated', semilla.jefeA],
    ['anon', null],
  ])('[D-3] %s no lee ni escribe demo_control por la API', async (_rol, usuario) => {
    const errores = await como(bd, usuario, async (sql) => {
      const resultados: (string | null)[] = [];
      for (const texto of SOBRE_DEMO_CONTROL) {
        resultados.push(await intentar(sql, texto));
      }
      return resultados;
    });

    expect(errores).toEqual(SOBRE_DEMO_CONTROL.map(() => SIN_PERMISO));
  });
});
