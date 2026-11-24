import { ZodError } from 'zod';

// El código con el que Postgres, PostgREST o Auth explican un error suyo. Un fallo de red lo trae
// vacío o no lo trae: ahí Supabase no ha contestado y no hay nada que explicar.
function traeCodigo(valor: unknown): boolean {
  if (typeof valor !== 'object' || valor === null || !('code' in valor)) return false;
  return typeof valor.code === 'string' && valor.code !== '';
}

// Los fallos que la aplicación sabe contar a quien los provoca: un dato que zod rechaza (a veces como
// causa de un Error con su mensaje) y una respuesta de error de Supabase con su código, que los
// adaptadores lanzan como causa de un Error. Todo lo demás es inesperado: quien captura lo relanza
// para que Next lo registre y Vercel lo enseñe, en vez de esconderlo detrás de un «No se pudo».
export function esFalloEsperado(error: unknown): boolean {
  if (error instanceof ZodError) return true;
  if (!(error instanceof Error)) return false;
  return error.cause instanceof ZodError || traeCodigo(error) || traeCodigo(error.cause);
}
