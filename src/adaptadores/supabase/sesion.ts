import { createServerClient, type CookieOptions } from '@supabase/ssr';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { crearClienteServidor } from './cliente-servidor';
import { leerEntorno } from './entorno';

export type Sesion = {
  usuarioId: string;
  tallerId: string;
  taller: string;
  rol: 'jefe' | 'mecanico';
  nombre: string;
};

const filaDeMiembro = z.object({
  taller_id: z.string().min(1),
  rol: z.enum(['jefe', 'mecanico']),
  nombre: z.string().min(1),
  talleres: z.object({ nombre: z.string().min(1) }),
});

const SIN_TALLER = 'Tu cuenta no está asociada a ningún taller.';
const NO_SE_PUDO_LEER = 'No se pudo cargar tu taller. Inténtalo de nuevo en unos minutos.';
const FILA_INVALIDA =
  'No se entienden los datos de tu taller. Vuelve a entrar o avisa al administrador.';

// null solo significa que nadie ha entrado (también si Auth no responde o el token no vale: se pide
// entrar de nuevo). Un usuario sin taller o con datos rotos es un error con mensaje: devolver null
// aquí lo mandaría a /login, y el proxy lo devolvería a /tablero.
export async function leerSesion(): Promise<Sesion | null> {
  const cliente = await crearClienteServidor();
  const { data: autenticado } = await cliente.auth.getUser();
  if (autenticado.user === null) return null;

  const { data, error } = await cliente
    .from('miembros')
    .select('taller_id, rol, nombre, talleres(nombre)')
    .eq('usuario_id', autenticado.user.id)
    .maybeSingle();
  if (error) throw new Error(NO_SE_PUDO_LEER);
  if (data === null) throw new Error(SIN_TALLER);

  const fila = filaDeMiembro.safeParse(data);
  if (!fila.success) throw new Error(FILA_INVALIDA);
  const { taller_id, rol, nombre, talleres } = fila.data;
  return {
    usuarioId: autenticado.user.id,
    tallerId: taller_id,
    taller: talleres.nombre,
    rol,
    nombre,
  };
}

type CookieARenovar = { name: string; value: string; options: CookieOptions };

// Para el proxy: Supabase renueva el token si hace falta y avisa de las cookies nuevas. Se dejan en
// la petición (para que las páginas lean ya la sesión renovada) y se devuelven para que el proxy
// las ponga en la respuesta, junto con las cabeceras de caché que Supabase exige a su lado.
// Si Auth no responde o la sesión no vale cuenta como sin sesión, no como fallo: las páginas
// públicas siguen abiertas y las privadas piden entrar de nuevo.
export async function refrescarSesion(peticion: NextRequest): Promise<{
  haySesion: boolean;
  cookies: CookieARenovar[];
  cabeceras: Record<string, string>;
}> {
  const { url, clavePublicable } = leerEntorno();
  const cookies: CookieARenovar[] = [];
  const cabeceras: Record<string, string> = {};
  const cliente = createServerClient(url, clavePublicable, {
    cookies: {
      getAll: () => peticion.cookies.getAll(),
      setAll: (aEscribir, cabecerasDeCache) => {
        aEscribir.forEach(({ name, value }) => peticion.cookies.set(name, value));
        cookies.push(...aEscribir);
        Object.assign(cabeceras, cabecerasDeCache);
      },
    },
  });
  const { data } = await cliente.auth.getUser();
  return { haySesion: data.user !== null, cookies, cabeceras };
}
