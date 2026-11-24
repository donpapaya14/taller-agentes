import { z } from 'zod';
import { ESTADOS, puedeTransicionar, type Estado } from '@/nucleo/orden';

export type Resultado = { ok: true } | { ok: false; motivo: string };

const NO_PERMITIDO = 'Ese cambio de estado no está permitido';
const ENTREGAR_DESDE_LA_FICHA = 'Entregar se hace desde la ficha de la orden';
const YA_CAMBIO = 'Otra persona ya movió esta orden. Recarga el tablero';
const ORDEN_NO_ENCONTRADA = 'No encontramos esa orden';

const ESTADO = z.enum(ESTADOS);

// Un uuid de Postgres es cualquier 8-4-4-4-12 en hexadecimal.
const ID = z.guid();

const rechazo = (motivo: string): Resultado => ({ ok: false, motivo });

// El id y los estados vienen de un formulario y pueden ser cualquier cosa: se comprueban aquí antes
// de tocar la base de datos. `puedeTransicionar` da por bueno un estado de partida desconocido si
// el destino es «recibido», así que primero se comprueba que los dos existen.
export async function moverOrden(
  d: { id: unknown; de: unknown; a: unknown },
  puerto: { cambiarEstado: (id: string, de: Estado, a: Estado) => Promise<boolean> },
): Promise<Resultado> {
  const id = ID.safeParse(d.id);
  if (!id.success) return rechazo(ORDEN_NO_ENCONTRADA);

  const de = ESTADO.safeParse(d.de);
  const a = ESTADO.safeParse(d.a);
  if (!de.success || !a.success || !puedeTransicionar(de.data, a.data)) {
    return rechazo(NO_PERMITIDO);
  }
  if (a.data === 'entregado') return rechazo(ENTREGAR_DESDE_LA_FICHA);

  const movida = await puerto.cambiarEstado(id.data, de.data, a.data);
  return movida ? { ok: true } : rechazo(YA_CAMBIO);
}
