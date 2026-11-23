import { z } from 'zod';
import { ESTADOS, puedeTransicionar, type Estado } from '@/nucleo/orden';

export type Resultado = { ok: true } | { ok: false; motivo: string };

const NO_PERMITIDO = 'Ese cambio de estado no está permitido';
const ENTREGAR_DESDE_LA_FICHA = 'Entregar se hace desde la ficha de la orden';
const YA_CAMBIO = 'Otra persona ya movió esta orden. Recarga el tablero';

const ESTADO = z.enum(ESTADOS);

const rechazo = (motivo: string): Resultado => ({ ok: false, motivo });

// Los estados vienen de un formulario: `puedeTransicionar` da por bueno un estado de partida
// desconocido si el destino es «recibido», así que se comprueba antes que existen.
export async function moverOrden(
  d: { id: string; de: Estado; a: Estado },
  puerto: { cambiarEstado: (id: string, de: Estado, a: Estado) => Promise<boolean> },
): Promise<Resultado> {
  const sonEstados = ESTADO.safeParse(d.de).success && ESTADO.safeParse(d.a).success;
  if (!sonEstados || !puedeTransicionar(d.de, d.a)) return rechazo(NO_PERMITIDO);
  if (d.a === 'entregado') return rechazo(ENTREGAR_DESDE_LA_FICHA);

  const movida = await puerto.cambiarEstado(d.id, d.de, d.a);
  return movida ? { ok: true } : rechazo(YA_CAMBIO);
}
