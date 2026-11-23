import { z } from 'zod';

export type Entorno = Record<string, string | undefined>;

// Una variable ausente y una vacía son lo mismo, y el error dice cuál falta.
export function obligatoria(nombre: string) {
  const mensaje = `Falta la variable de entorno ${nombre}`;
  return z.string({ error: mensaje }).min(1, { error: mensaje });
}

export function leerConEsquema<T extends z.ZodType>(esquema: T, env: Entorno): z.infer<T> {
  const resultado = esquema.safeParse(env);
  if (!resultado.success) throw new Error(resultado.error.issues[0].message);
  return resultado.data;
}

const esquemaPublico = z.object({
  SUPABASE_URL: obligatoria('SUPABASE_URL'),
  SUPABASE_PUBLISHABLE_KEY: obligatoria('SUPABASE_PUBLISHABLE_KEY'),
});

export function leerEntorno(env: Entorno = process.env): { url: string; clavePublicable: string } {
  const { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } = leerConEsquema(esquemaPublico, env);
  return { url: SUPABASE_URL, clavePublicable: SUPABASE_PUBLISHABLE_KEY };
}
