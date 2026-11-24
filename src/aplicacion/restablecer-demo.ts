import { createHash, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { esFalloEsperado } from './fallo-esperado';

export type ResultadoRestablecer =
  { estado: 'RESTABLECIDO' | 'EN_ESPERA' } | { estado: 'ERROR'; motivo: string };

type Puerto = {
  rpcRestablecer: () => Promise<string>;
  reponerContrasenas: () => Promise<void>;
};

export type OpcionesDeRestablecer = {
  // Qué hacer con las contraseñas cuando la base contesta que ya se restableció hace poco.
  reponerEnEspera: boolean;
};

const MOTIVO_DEL_ERROR = 'No se pudo restablecer la demo';

// Lo único que contesta restablecer_demo. Lo que llegue de la base de datos se comprueba antes de
// decidir nada con ello: un valor que no es ninguno de los dos no se toma por «restablecido».
const respuestaDeLaBase = z.enum(['RESTABLECIDO', 'EN_ESPERA']);

// Con la base restablecida las contraseñas se reponen siempre. Con la espera de 10 minutos, solo si
// quien pide es de confianza (`reponerEnEspera`): así el cron recupera un intento anterior en el que
// la base se restableció y las contraseñas no, y quien pulsa el enlace del login, que puede ser
// cualquiera, no dispara llamadas de administración a Auth cada vez que pulsa. Un fallo que la
// aplicación sabe contar (una respuesta que no es ninguna de las dos, un error de Supabase con su
// código), también el de reponer las contraseñas, sale con el mismo mensaje: el detalle es de quien
// opera la demo, no de quien la pide. Cualquier otro se relanza: lo registra Vercel.
export async function restablecerDemo(
  puerto: Puerto,
  { reponerEnEspera }: OpcionesDeRestablecer,
): Promise<ResultadoRestablecer> {
  try {
    const estado = respuestaDeLaBase.parse(await puerto.rpcRestablecer());
    if (estado === 'RESTABLECIDO' || reponerEnEspera) await puerto.reponerContrasenas();
    return { estado };
  } catch (error) {
    if (esFalloEsperado(error)) return { estado: 'ERROR', motivo: MOTIVO_DEL_ERROR };
    throw error;
  }
}

const resumen = (texto: string) => createHash('sha256').update(texto).digest();

// Se comparan los resúmenes y no los textos: timingSafeEqual exige la misma longitud, y mirarla
// antes delataría la del secreto. Con un secreto vacío no se deja pasar a nadie.
export function autorizado(cabecera: string | null, secreto: string): boolean {
  if (cabecera === null || secreto === '') return false;
  return timingSafeEqual(resumen(cabecera), resumen(`Bearer ${secreto}`));
}
