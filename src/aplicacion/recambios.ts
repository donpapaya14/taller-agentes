import { z } from 'zod';
import { eurosACentimos } from '@/nucleo/importe';
import { enteroEntre, SIN_LIMITE, textoEntre, validar, type Errores } from './nueva-orden';

export type DatosRecambio = {
  referencia: string;
  nombre: string;
  precioCentimos: number;
  stock: number;
  stockMinimo: number;
};

const MENSAJES = {
  referencia: 'La referencia tiene entre 2 y 20 caracteres',
  nombre: 'Falta el nombre del recambio',
  precio: 'Precio no válido. Ejemplo: 12,50',
  entero: 'Tiene que ser un número entero, cero o más',
};

const ENTERO_NO_NEGATIVO = enteroEntre(0, SIN_LIMITE, MENSAJES.entero);

// El precio se escribe en euros y se guarda en céntimos (D-5); `eurosACentimos` da null si no lo
// entiende y `z.int` convierte ese null en el mensaje.
const ESQUEMA_RECAMBIO = z
  .object({
    referencia: textoEntre(2, 20, MENSAJES.referencia).transform((texto) => texto.toUpperCase()),
    nombre: textoEntre(2, 80, MENSAJES.nombre),
    precio: z
      .string({ error: MENSAJES.precio })
      .trim()
      .transform(eurosACentimos)
      .pipe(z.int({ error: MENSAJES.precio })),
    stock: ENTERO_NO_NEGATIVO,
    stockMinimo: ENTERO_NO_NEGATIVO,
  })
  .transform(({ precio, ...resto }): DatosRecambio => ({ ...resto, precioCentimos: precio }));

export function validarRecambio(
  entrada: unknown,
): { ok: true; datos: DatosRecambio } | { ok: false; errores: Errores } {
  return validar(ESQUEMA_RECAMBIO, entrada);
}
