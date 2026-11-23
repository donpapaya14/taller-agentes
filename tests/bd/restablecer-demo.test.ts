import { afterAll, describe, expect, it } from 'vitest';
import { como, crearBd, sembrarDosTalleres, sembrarUsuariosDemo } from './arnes';
import { valor } from './ayudas';

const VEGA = '00000000-0000-4000-8000-00000000000a';
const RIBERA = '00000000-0000-4000-8000-00000000000b';
const RESTABLECER = 'select public.restablecer_demo() as resultado';
const ULTIMA_VEZ = 'select ultimo_restablecido::text from public.demo_control';
const BORRAR_ORDENES_DE_VEGA = 'delete from public.ordenes where taller_id = $1';
const UNA_HORA = 3600;

const bd = await crearBd();
const usuarios = await sembrarUsuariosDemo(bd);
// Dos talleres que no son de demostración: restablecer no debe tocarlos.
const semilla = await sembrarDosTalleres(bd);

afterAll(() => bd.cerrar());

const restablecer = async () => String(await valor(bd.sql, RESTABLECER));

// Deja la última vez en hace `segundos`, como si hubiera pasado ese tiempo.
const ultimaVezHace = (segundos: number) =>
  bd.sql(
    `insert into public.demo_control (id, ultimo_restablecido)
     values (true, now() - $1 * interval '1 second')
     on conflict (id) do update set ultimo_restablecido = excluded.ultimo_restablecido`,
    [segundos],
  );

const contar = (tabla: string, taller: string) =>
  valor(bd.sql, `select count(*)::int from public.${tabla} where taller_id = $1`, [taller]);

async function ordenesPorEstado(taller: string) {
  const filas = await bd.sql(
    'select estado, count(*)::int as n from public.ordenes where taller_id = $1 group by estado',
    [taller],
  );
  return Object.fromEntries(filas.map(({ estado, n }) => [estado, n]));
}

describe('restablecer la demo', () => {
  it('[C-13] restablecer deja los datos de partida', async () => {
    await ultimaVezHace(UNA_HORA);
    await restablecer();
    await bd.sql(BORRAR_ORDENES_DE_VEGA, [VEGA]);
    await bd.sql('update public.recambios set stock = 0 where taller_id = $1', [VEGA]);
    await ultimaVezHace(11 * 60);

    const resultado = await restablecer();

    expect(resultado).toBe('RESTABLECIDO');
    expect(await ordenesPorEstado(VEGA)).toEqual({
      recibido: 3,
      en_reparacion: 3,
      listo: 2,
      entregado: 1,
    });
    expect(await contar('recambios', VEGA)).toBe(10);
    expect(
      await valor(bd.sql, 'select count(*)::int from public.miembros where taller_id in ($1, $2)', [
        VEGA,
        RIBERA,
      ]),
    ).toBe(3);
  });

  it('[C-13] no se repite antes de 10 minutos', async () => {
    await ultimaVezHace(UNA_HORA);
    const primera = await restablecer();
    const marca = await valor(bd.sql, ULTIMA_VEZ);
    await bd.sql(BORRAR_ORDENES_DE_VEGA, [VEGA]);

    const segunda = await restablecer();

    expect([primera, segunda]).toEqual(['RESTABLECIDO', 'EN_ESPERA']);
    expect(await contar('ordenes', VEGA)).toBe(0);
    expect(await valor(bd.sql, ULTIMA_VEZ)).toBe(marca);
  });
});

describe('espera y fila de control', () => {
  it.each([
    [590, 'EN_ESPERA'],
    [610, 'RESTABLECIDO'],
  ])('[C-13] con la última vez hace %i segundos devuelve %s', async (segundos, esperado) => {
    await ultimaVezHace(segundos);

    expect(await restablecer()).toBe(esperado);
  });

  it('[C-13] si falta la fila de control la crea', async () => {
    await bd.sql('delete from public.demo_control');

    const resultado = await restablecer();

    expect(resultado).toBe('RESTABLECIDO');
    expect(
      await valor(
        bd.sql,
        `select count(*)::int from public.demo_control
          where ultimo_restablecido > now() - interval '1 minute'`,
      ),
    ).toBe(1);
  });

  it('[C-6] la demo tiene dos recambios bajo mínimo', async () => {
    await ultimaVezHace(UNA_HORA);
    await restablecer();

    const bajoMinimo = await valor(
      bd.sql,
      'select count(*)::int from public.recambios where taller_id = $1 and stock <= stock_minimo',
      [VEGA],
    );

    expect(bajoMinimo).toBe(2);
  });
});

describe('quién puede restablecer', () => {
  it('[C-13] un usuario normal no puede restablecer', async () => {
    for (const usuario of [semilla.jefeA, usuarios.jefe, usuarios.mecanico, null]) {
      const intento = como(bd, usuario, (sql) => sql(RESTABLECER));

      await expect(intento).rejects.toThrow('permission denied for function restablecer_demo');
    }
  });

  it('[C-13] nadie siembra la demo saltándose el control de los 10 minutos', async () => {
    const intento = como(bd, usuarios.jefe, (sql) => sql('select app.sembrar_demo()'));

    await expect(intento).rejects.toThrow('permission denied for function sembrar_demo');
  });

  it('[C-13] la clave de servicio sí puede restablecer', async () => {
    await ultimaVezHace(UNA_HORA);
    await bd.sql('set role service_role');

    const resultado = await restablecer().finally(() => bd.sql('reset role'));

    expect(resultado).toBe('RESTABLECIDO');
  });
});

describe('qué toca al restablecer', () => {
  it('[C-13] no toca los talleres que no son de demostración', async () => {
    const filas = () =>
      bd.sql(
        `select 'ordenes' as tabla, count(*)::int as filas from public.ordenes
          where taller_id in ($1, $2)
         union all
         select 'miembros', count(*)::int from public.miembros where taller_id in ($1, $2)`,
        [semilla.tallerA, semilla.tallerB],
      );
    const antes = await filas();
    await ultimaVezHace(UNA_HORA);

    await restablecer();

    expect(antes).toEqual([
      { tabla: 'ordenes', filas: 2 },
      { tabla: 'miembros', filas: 3 },
    ]);
    expect(await filas()).toEqual(antes);
  });
});

describe('miembros de demostración', () => {
  it('[C-13] los miembros salen de auth.users por correo', async () => {
    await ultimaVezHace(UNA_HORA);
    await restablecer();

    const miembros = await bd.sql(
      `select usuario_id, taller_id, rol, nombre from public.miembros
        where taller_id in ($1, $2) order by nombre`,
      [VEGA, RIBERA],
    );

    expect(miembros).toEqual([
      { usuario_id: usuarios.mecanico, taller_id: VEGA, rol: 'mecanico', nombre: 'Iván Soler' },
      { usuario_id: usuarios.jefe, taller_id: VEGA, rol: 'jefe', nombre: 'Marta Vega' },
      { usuario_id: usuarios.jefeOtro, taller_id: RIBERA, rol: 'jefe', nombre: 'Raúl Ribera' },
    ]);
  });

  it('[C-13] un usuario de demostración movido a otro taller vuelve al suyo', async () => {
    await ultimaVezHace(UNA_HORA);
    await restablecer();
    await bd.sql(
      `update public.miembros set taller_id = $1, rol = 'mecanico' where usuario_id = $2`,
      [semilla.tallerA, usuarios.jefe],
    );
    await ultimaVezHace(UNA_HORA);

    await restablecer();

    expect(
      await bd.sql('select taller_id, rol from public.miembros where usuario_id = $1', [
        usuarios.jefe,
      ]),
    ).toEqual([{ taller_id: VEGA, rol: 'jefe' }]);
  });

  it('[C-13] si un usuario de demostración no existe se salta su fila', async () => {
    const otra = await crearBd();
    try {
      await otra.sql(
        `insert into auth.users (id, email) values (gen_random_uuid(), 'mecanico@tallerdemo.example')`,
      );

      const resultado = await valor(otra.sql, RESTABLECER);

      expect(resultado).toBe('RESTABLECIDO');
      expect(await otra.sql('select nombre from public.miembros')).toEqual([
        { nombre: 'Iván Soler' },
      ]);
    } finally {
      await otra.cerrar();
    }
  });
});
