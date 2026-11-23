import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { leerEntorno } from './entorno';
import { opcionesDeCliente } from './opciones-cliente';

// Un cliente por petición, con la sesión de quien llama: es RLS quien decide qué ve y qué cambia.
// Escribir cookies no se envuelve en un try: solo escribe una renovación de sesión y esa la hace el
// proxy antes de renderizar. Si una página de servidor llegara a escribir, el error debe verse.
// Con un `plazo`, ninguna llamada del cliente sigue una vez vencido: es el de la operación entera.
export async function crearClienteServidor(plazo?: AbortSignal): Promise<SupabaseClient> {
  const { url, clavePublicable } = leerEntorno();
  const almacen = await cookies();
  return createServerClient(url, clavePublicable, {
    ...opcionesDeCliente(plazo),
    cookies: {
      getAll: () => almacen.getAll(),
      setAll: (aEscribir) => {
        aEscribir.forEach(({ name, value, options }) => almacen.set(name, value, options));
      },
    },
  });
}
