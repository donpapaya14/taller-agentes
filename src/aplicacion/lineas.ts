import { z } from 'zod';
import type { Errores } from './nueva-orden';
import { enteroEntre, validar } from './nueva-orden';

// Los ids de orden, de línea y de recambio llegan de campos ocultos y selectores de un formulario:
// se comprueban como uuid antes de preguntar a la base de datos, que fallaría con un error de SQL.
const ID_DE_ORDEN = z.guid({ error: 'No encontramos esa orden' });
const ID_DE_LINEA = z.guid({ error: 'No encontramos ese recambio en la orden' });
const CANTIDAD = enteroEntre(1, 999, 'La cantidad va de 1 a 999');

const ESQUEMA_LINEA = z.object({
  ordenId: ID_DE_ORDEN,
  recambioId: z.guid({ error: 'Elige un recambio' }),
  cantidad: CANTIDAD,
});

const ESQUEMA_MANO_DE_OBRA = z.object({
  ordenId: ID_DE_ORDEN,
  minutos: enteroEntre(0, 6000, 'Los minutos van de 0 a 6000'),
});

const ESQUEMA_CANTIDAD = z.object({ lineaId: ID_DE_LINEA, cantidad: CANTIDAD });

const ESQUEMA_LINEA_A_QUITAR = z.object({ lineaId: ID_DE_LINEA });

// El formulario de añadir un recambio a una orden.
export function validarLinea(entrada: unknown) {
  return validar(ESQUEMA_LINEA, entrada);
}

export function validarManoObra(
  entrada: unknown,
): { ok: true; ordenId: string; minutos: number } | { ok: false; errores: Errores } {
  const resultado = validar(ESQUEMA_MANO_DE_OBRA, entrada);
  return resultado.ok ? { ok: true, ...resultado.datos } : resultado;
}

// El formulario de cambiar la cantidad de una línea que ya está en la orden.
export function validarCantidadDeLinea(entrada: unknown) {
  return validar(ESQUEMA_CANTIDAD, entrada);
}

export function validarLineaAQuitar(entrada: unknown) {
  return validar(ESQUEMA_LINEA_A_QUITAR, entrada);
}
