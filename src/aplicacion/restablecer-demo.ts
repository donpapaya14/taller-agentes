import { createHash, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

export type ResultadoRestablecer =
  { estado: 'RESTABLECIDO' | 'EN_ESPERA' } | { estado: 'ERROR'; motivo: string };

type Puerto = {
  rpcRestablecer: () => Promise<string>;
  reponerContrasenas: () => Promise<void>;
};

const MOTIVO_DEL_ERROR = 'No se pudo restablecer la demo';

// Lo único que contesta restablecer_demo. Lo que llegue de la base de datos se comprueba antes de
// decidir nada con ello: un valor que no es ninguno de los dos no se toma por «restablecido».
const respuestaDeLaBase = z.enum(['RESTABLECIDO', 'EN_ESPERA']);

// Las contraseñas se reponen siempre que la base responda bien, también con la espera de 10
// minutos: reponerlas no destruye nada y así se recupera un intento anterior en el que la base ya
// se había restablecido y las contraseñas no. Cualquier fallo, también el de reponerlas, sale con
// el mismo mensaje: el detalle es de quien opera la demo, no de quien la pide.
export async function restablecerDemo(puerto: Puerto): Promise<ResultadoRestablecer> {
  try {
    const estado = respuestaDeLaBase.parse(await puerto.rpcRestablecer());
    await puerto.reponerContrasenas();
    return { estado };
  } catch {
    return { estado: 'ERROR', motivo: MOTIVO_DEL_ERROR };
  }
}

const resumen = (texto: string) => createHash('sha256').update(texto).digest();

// Se comparan los resúmenes y no los textos: timingSafeEqual exige la misma longitud, y mirarla
// antes delataría la del secreto. Con un secreto vacío no se deja pasar a nadie.
export function autorizado(cabecera: string | null, secreto: string): boolean {
  if (cabecera === null || secreto === '') return false;
  return timingSafeEqual(resumen(cabecera), resumen(`Bearer ${secreto}`));
}
