import type { CookieOptions } from '@supabase/ssr';
import { conTiempoLimite, LIMITE_MS } from './tiempo-limite';

// Lo que comparten los dos clientes de servidor, el de las páginas y el del proxy. La cookie de
// sesión no la lee el JavaScript del navegador, no viaja por http en producción ni se manda desde
// otros sitios, y ninguna llamada a Supabase espera más del límite de tiempo ni más allá del plazo
// de la operación a la que sirve el cliente.
export function opcionesDeCliente(plazo?: AbortSignal) {
  return {
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    } satisfies CookieOptions,
    global: { fetch: conTiempoLimite(fetch, LIMITE_MS, plazo) },
  };
}
