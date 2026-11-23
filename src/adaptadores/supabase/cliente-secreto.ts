import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { leerEntorno, leerEntornoSecreto } from './entorno';

// Se salta RLS. Solo para restablecer la demo (acción y cron) y el script de usuarios de demo,
// nunca para datos de negocio.
export function crearClienteSecreto(): SupabaseClient {
  const { url } = leerEntorno();
  const { claveSecreta } = leerEntornoSecreto();
  return createClient(url, claveSecreta, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
