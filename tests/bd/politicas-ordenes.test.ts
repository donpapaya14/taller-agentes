import { afterAll, describe, expect, it } from 'vitest';
import { como, crearBd, type Sql, sembrarDosTalleres } from './arnes';
import { comoSuperusuario } from './ayudas';

const ERROR_DE_POLITICA = 'new row violates row-level security policy for table "ordenes"';

const bd = await crearBd();
const semilla = await sembrarDosTalleres(bd);

afterAll(() => bd.cerrar());

const usuarios = [semilla.jefeA, semilla.mecanicoA];

// Por la API esas columnas no se pueden escribir, y eso tapa a la política: el test pasaría aunque
// la política no dijera nada. Para probarla sola se abre el permiso dentro de la transacción de
// `como`, que se deshace al salir.
const abrirPermiso = (sql: Sql, concesion: string) =>
  comoSuperusuario(sql, () => sql(`grant ${concesion} on public.ordenes to authenticated`));

const crearOrdenCon = (sql: Sql, columna: string, valor: string) =>
  sql(
    `insert into public.ordenes (taller_id, vehiculo_id, descripcion, ${columna})
     select taller_id, vehiculo_id, 'Nueva', ${valor} from public.ordenes where id = $1`,
    [semilla.ordenA],
  );

describe('política de crear una orden', () => {
  it.each([
    ['estado', `'en_reparacion'`],
    ['estado', `'listo'`],
    ['estado', `'entregado'`],
    ['numero_factura', `'F-2026-0001'`],
  ])('[C-3] rechaza %s = %s aunque se abra el permiso de la columna', async (columna, valor) => {
    for (const usuario of usuarios) {
      const intento = como(bd, usuario, async (sql) => {
        await abrirPermiso(sql, `insert (${columna})`);
        return crearOrdenCon(sql, columna, valor);
      });

      await expect(intento).rejects.toThrow(ERROR_DE_POLITICA);
    }
  });

  // Sin esto, los rechazos de arriba podrían venir de otra cosa que no fuera la política.
  it('[C-3] con esos permisos abiertos, una orden recibida y sin número sí se crea', async () => {
    const ordenesDeA = await como(bd, semilla.jefeA, async (sql) => {
      await abrirPermiso(sql, 'insert (estado, numero_factura)');
      await crearOrdenCon(sql, 'estado', `'recibido'`);
      return sql('select id from public.ordenes where taller_id = $1', [semilla.tallerA]);
    });

    expect(ordenesDeA).toHaveLength(2);
  });
});

describe('política de cambiar una orden', () => {
  it('[C-3] rechaza poner número de factura aunque se abra el permiso de la columna', async () => {
    for (const usuario of usuarios) {
      const intento = como(bd, usuario, async (sql) => {
        await abrirPermiso(sql, 'update (numero_factura)');
        return sql(`update public.ordenes set numero_factura = 'F-2026-0001' where id = $1`, [
          semilla.ordenA,
        ]);
      });

      await expect(intento).rejects.toThrow(ERROR_DE_POLITICA);
    }
  });

  it('[C-3] con ese permiso abierto, cambiar otra columna sí se puede', async () => {
    const cambiadas = await como(bd, semilla.jefeA, async (sql) => {
      await abrirPermiso(sql, 'update (numero_factura)');
      return sql(`update public.ordenes set descripcion = 'Otra' where id = $1 returning id`, [
        semilla.ordenA,
      ]);
    });

    expect(cambiadas).toEqual([{ id: semilla.ordenA }]);
  });
});
