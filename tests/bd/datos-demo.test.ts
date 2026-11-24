import { afterAll, describe, expect, it } from 'vitest';
import { como, crearBd, type Sql, sembrarUsuariosDemo } from './arnes';
import { intentar, valor } from './ayudas';

const VEGA = '00000000-0000-4000-8000-00000000000a';
const RIBERA = '00000000-0000-4000-8000-00000000000b';
const ENTREGAR = 'select public.cerrar_orden($1) as numero';
const MATRICULA_ACTUAL = /^\d{4}[BCDFGHJKLMNPRSTVWXYZ]{3}$/;
const TELEFONO_ESPANOL = /^34[6-9]\d{8}$/;
// Los de los talleres se escriben para leerlos, en grupos: «969 739 431».
const TELEFONO_DE_TALLER = /^[89]\d{2} \d{3} \d{3}$/;
// Sociedad limitada: la letra B, siete cifras y un dígito de control.
const NIF_DE_SOCIEDAD = /^B(\d{7})(\d)$/;
const ANIO_DE_MADRID = `select to_char(now() at time zone 'Europe/Madrid', 'YYYY')`;

const bd = await crearBd();
const usuarios = await sembrarUsuariosDemo(bd);
await bd.sql('select public.restablecer_demo()');

afterAll(() => bd.cerrar());

const contar = (tabla: string, taller: string, sql: Sql = bd.sql) =>
  valor(sql, `select count(*)::int from public.${tabla} where taller_id = $1`, [taller]);

const datosDe = async (taller: string) => ({
  clientes: await contar('clientes', taller),
  vehiculos: await contar('vehiculos', taller),
  recambios: await contar('recambios', taller),
  ordenes: await contar('ordenes', taller),
});

// Un dato inventado que parezca relleno no convence a nadie en un PDF. Lo delatan tres cifras
// seguidas que suben, bajan o se repiten de una en una (123, 987, 111) y dos ceros seguidos.
function pareceRelleno(texto: string): boolean {
  const cifras = [...texto.replace(/\D/g, '')].map(Number);
  const trios = cifras.slice(0, -2).map((cifra, i) => [cifra, cifras[i + 1], cifras[i + 2]]);
  const hayProgresion = trios.some(([a, b, c]) => Math.abs(b - a) <= 1 && c - b === b - a);

  return hayProgresion || cifras.join('').includes('00');
}

// La suma de las cifras de un número de dos cifras como mucho: 14 es 1 + 4, es decir, 14 - 9.
const sumaDeCifras = (doble: number) => (doble > 9 ? doble - 9 : doble);

// El dígito de control de un CIF: las cifras en posición impar se duplican y las pares cuentan tal
// cual; el control completa la suma hasta la decena siguiente.
function digitoDeControl(cifras: string): number {
  const suma = [...cifras]
    .map(Number)
    .reduce((total, cifra, i) => total + (i % 2 === 0 ? sumaDeCifras(cifra * 2) : cifra), 0);

  return (10 - (suma % 10)) % 10;
}

describe('talleres de partida', () => {
  it('[C-13] Talleres Vega parte con 6 clientes, 8 vehículos, 10 recambios y 9 órdenes', async () => {
    const taller = await bd.sql(
      'select nombre, siguiente_factura from public.talleres where id = $1',
      [VEGA],
    );

    expect(taller).toEqual([{ nombre: 'Talleres Vega', siguiente_factura: 2 }]);
    expect(await datosDe(VEGA)).toEqual({ clientes: 6, vehiculos: 8, recambios: 10, ordenes: 9 });
  });

  it('[C-13] Mecánica Ribera parte con 2 clientes, 2 vehículos, 3 recambios y 2 órdenes recibidas', async () => {
    const taller = await bd.sql(
      `select t.nombre, t.siguiente_factura, count(o.id) filter (where o.estado = 'recibido')::int as recibidas
         from public.talleres t join public.ordenes o on o.taller_id = t.id
        where t.id = $1 group by t.id`,
      [RIBERA],
    );

    expect(taller).toEqual([{ nombre: 'Mecánica Ribera', siguiente_factura: 1, recibidas: 2 }]);
    expect(await datosDe(RIBERA)).toEqual({ clientes: 2, vehiculos: 2, recambios: 3, ordenes: 2 });
  });
});

describe('órdenes de partida', () => {
  it('[C-13] las órdenes en reparación, listas y entregadas llevan de 1 a 3 líneas; las recibidas, ninguna', async () => {
    const filas = await bd.sql(
      `select o.estado, count(l.id)::int as lineas
         from public.ordenes o left join public.orden_lineas l on l.orden_id = o.id
        where o.taller_id = $1 group by o.id, o.estado`,
      [VEGA],
    );
    const lineasPor = (estado: string) =>
      filas.filter((fila) => fila.estado === estado).map(({ lineas }) => lineas);

    expect(lineasPor('recibido')).toEqual([0, 0, 0]);
    for (const estado of ['en_reparacion', 'listo', 'entregado']) {
      for (const lineas of lineasPor(estado)) {
        expect(lineas).toBeGreaterThanOrEqual(1);
        expect(lineas).toBeLessThanOrEqual(3);
      }
    }
  });

  it('[C-13] solo la orden entregada tiene número de factura, F-<año>-0001, y fecha de entrega', async () => {
    const anio = await valor(bd.sql, ANIO_DE_MADRID);
    const conNumero = await bd.sql(
      `select estado, numero_factura, entregada_en is not null as con_fecha
         from public.ordenes
        where taller_id = $1 and (numero_factura is not null or entregada_en is not null)`,
      [VEGA],
    );

    expect(conNumero).toEqual([
      { estado: 'entregado', numero_factura: `F-${anio}-0001`, con_fecha: true },
    ]);
  });

  it('[C-13] el precio de cada línea es el de su recambio', async () => {
    const distintos = await valor(
      bd.sql,
      `select count(*)::int from public.orden_lineas l
         join public.recambios r on r.id = l.recambio_id
        where l.precio_unitario_centimos is distinct from r.precio_centimos`,
    );

    expect(distintos).toBe(0);
  });
});

describe('datos inventados', () => {
  it('[C-13] las matrículas tienen el formato actual y los teléfonos son españoles', async () => {
    const matriculas = await bd.sql('select matricula from public.vehiculos');
    const telefonos = await bd.sql('select telefono from public.clientes');

    expect(matriculas).toHaveLength(10);
    expect(telefonos).toHaveLength(8);
    for (const { matricula } of matriculas) {
      expect(matricula).toMatch(MATRICULA_ACTUAL);
    }
    for (const { telefono } of telefonos) {
      expect(telefono).toMatch(TELEFONO_ESPANOL);
    }
  });

  it('[C-13] el NIF y el teléfono de cada taller tienen formato válido', async () => {
    const talleres = await bd.sql(
      'select nif, telefono from public.talleres where id in ($1, $2)',
      [VEGA, RIBERA],
    );

    expect(talleres).toHaveLength(2);
    for (const { nif, telefono } of talleres) {
      const [, cuerpo, control] = String(nif).match(NIF_DE_SOCIEDAD) ?? [];
      expect(cuerpo, `NIF ${nif}`).toBeDefined();
      expect(Number(control), `dígito de control de ${nif}`).toBe(digitoDeControl(cuerpo));
      expect(telefono).toMatch(TELEFONO_DE_TALLER);
    }
  });

  it('[C-13] ningún NIF ni teléfono de la demo parece relleno', async () => {
    const nif = await bd.sql('select nif as dato from public.talleres where id in ($1, $2)', [
      VEGA,
      RIBERA,
    ]);
    const telefonosDeTaller = await bd.sql(
      'select telefono as dato from public.talleres where id in ($1, $2)',
      [VEGA, RIBERA],
    );
    const telefonosDeCliente = await bd.sql(
      'select right(telefono, 9) as dato from public.clientes',
    );

    const datos = [...nif, ...telefonosDeTaller, ...telefonosDeCliente].map(({ dato }) =>
      String(dato),
    );

    expect(datos).toHaveLength(12);
    expect(datos.filter(pareceRelleno)).toEqual([]);
  });
});

describe('detector de datos de relleno', () => {
  it.each(['B12345678', 'B87654321', '910 000 101', '910 000 202', '911 111 111', '34600456789'])(
    '[C-13] %s parece relleno',
    (dato) => {
      expect(pareceRelleno(dato)).toBe(true);
    },
  );

  it.each(['B16725376', 'B44309219', '969 739 431', '978 691 051', '34641682845'])(
    '[C-13] %s no parece relleno',
    (dato) => {
      expect(pareceRelleno(dato)).toBe(false);
    },
  );
});

describe('la demo con sus usuarios', () => {
  it('[C-2] cada jefe de demostración solo ve su taller', async () => {
    const ordenesVistas = (usuario: string) =>
      como(bd, usuario, async (sql) => ({
        vega: await contar('ordenes', VEGA, sql),
        ribera: await contar('ordenes', RIBERA, sql),
      }));

    expect(await ordenesVistas(usuarios.jefe)).toEqual({ vega: 9, ribera: 0 });
    expect(await ordenesVistas(usuarios.mecanico)).toEqual({ vega: 9, ribera: 0 });
    expect(await ordenesVistas(usuarios.jefeOtro)).toEqual({ vega: 0, ribera: 2 });
  });

  it('[C-3] el mecánico de la demo no puede entregar', async () => {
    const orden = await valor(
      bd.sql,
      `select id from public.ordenes where taller_id = $1 and estado = 'listo' limit 1`,
      [VEGA],
    );

    const error = await como(bd, usuarios.mecanico, (sql) => intentar(sql, ENTREGAR, [orden]));

    expect(error).toBe('SOLO_JEFE');
  });

  it('[C-5] las dos órdenes listas de la demo se entregan con el stock que tiene', async () => {
    const listas = await bd.sql(
      `select id from public.ordenes where taller_id = $1 and estado = 'listo' order by id`,
      [VEGA],
    );

    const numeros = await como(bd, usuarios.jefe, async (sql) => [
      await valor(sql, ENTREGAR, [listas[0].id]),
      await valor(sql, ENTREGAR, [listas[1].id]),
    ]);

    expect(numeros).toEqual([
      expect.stringMatching(/^F-\d{4}-0002$/),
      expect.stringMatching(/^F-\d{4}-0003$/),
    ]);
  });
});
