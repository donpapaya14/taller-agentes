// Un fallo de Supabase como lo lanzan los adaptadores: un Error cuya causa es la respuesta de error
// de PostgREST o de Auth, con su código. El 42501 es el de «permiso denegado» de Postgres.
export const falloDeSupabase = (mensaje: string, code = '42501') =>
  new Error(mensaje, { cause: { message: mensaje, details: '', hint: '', code } });
