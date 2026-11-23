import { z } from 'zod';

export type Entorno = Record<string, string | undefined>;

// Una variable de entorno que falta o no vale. Quien la captura (el proxy) la distingue de
// cualquier otro fallo, que debe seguir viéndose.
export class ErrorDeEntorno extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = 'ErrorDeEntorno';
  }
}

// Una variable ausente, vacía o solo con espacios es lo mismo, y el error dice cuál falta. Los
// espacios de los bordes se recortan: suelen venir de copiar y pegar, y el valor no los lleva.
export function obligatoria(nombre: string) {
  const mensaje = `Falta la variable de entorno ${nombre}`;
  return z.string({ error: mensaje }).trim().min(1, { error: mensaje });
}

// supabase-js solo acepta http y https y, con otra cosa, falla más tarde con un mensaje en inglés.
function direccionHttp(nombre: string) {
  const mensaje = `La variable de entorno ${nombre} no es una URL válida: debe empezar por http:// o https://`;
  return obligatoria(nombre).pipe(z.url({ protocol: /^https?$/, error: mensaje }));
}

export function leerConEsquema<T extends z.ZodType>(esquema: T, env: Entorno): z.infer<T> {
  const resultado = esquema.safeParse(env);
  if (!resultado.success) throw new ErrorDeEntorno(resultado.error.issues[0].message);
  return resultado.data;
}

const esquemaPublico = z.object({
  SUPABASE_URL: direccionHttp('SUPABASE_URL'),
  SUPABASE_PUBLISHABLE_KEY: obligatoria('SUPABASE_PUBLISHABLE_KEY'),
});

export function leerEntorno(env: Entorno = process.env): { url: string; clavePublicable: string } {
  const { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } = leerConEsquema(esquemaPublico, env);
  return { url: SUPABASE_URL, clavePublicable: SUPABASE_PUBLISHABLE_KEY };
}
