import { z } from 'zod';
import type { Errores } from './nueva-orden';
import { enteroEntre, validar } from './nueva-orden';

const ESQUEMA_LINEA = z.object({
  recambioId: z.guid({ error: 'Elige un recambio' }),
  cantidad: enteroEntre(1, 999, 'La cantidad va de 1 a 999'),
});

const ESQUEMA_MANO_DE_OBRA = z.object({
  minutos: enteroEntre(0, 6000, 'Los minutos van de 0 a 6000'),
});

export function validarLinea(entrada: unknown) {
  return validar(ESQUEMA_LINEA, entrada);
}

export function validarManoObra(
  entrada: unknown,
): { ok: true; minutos: number } | { ok: false; errores: Errores } {
  const resultado = validar(ESQUEMA_MANO_DE_OBRA, entrada);
  return resultado.ok ? { ok: true, minutos: resultado.datos.minutos } : resultado;
}
