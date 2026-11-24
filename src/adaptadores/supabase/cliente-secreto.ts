import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { leerEntorno } from './entorno';
import { leerEntornoSecreto } from './entorno-secreto';
import { conTiempoLimite, LIMITE_MS } from './tiempo-limite';

// Se salta RLS. Solo para restablecer la demo (acción y cron) y el script de usuarios de demo,
// nunca para datos de negocio. Ninguna llamada espera más del límite de tiempo ni más allá del
// `plazo` de la operación a la que sirve el cliente: con Supabase caído, supabase-js reintenta unos
// 25 s y el cron se quedaría colgado.
export function crearClienteSecreto(plazo?: AbortSignal): SupabaseClient {
  const { url } = leerEntorno();
  const { claveSecreta } = leerEntornoSecreto();
  return createClient(url, claveSecreta, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: conTiempoLimite(fetch, LIMITE_MS, plazo) },
  });
}
