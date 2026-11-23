import { NextResponse, type NextRequest } from 'next/server';
import { refrescarSesion } from '@/adaptadores/supabase/sesion';
import { decidirAcceso } from '@/aplicacion/acceso';

// Refresca la sesión y orienta al visitante. No autoriza nada: eso lo hace RLS en la base de datos.
export async function proxy(peticion: NextRequest) {
  const { haySesion, cookies, cabeceras } = await refrescarSesion(peticion);
  const decision = decidirAcceso(peticion.nextUrl.pathname, haySesion);
  const respuesta =
    decision.tipo === 'pasa'
      ? NextResponse.next({ request: peticion })
      : NextResponse.redirect(new URL(decision.a, peticion.url));

  cookies.forEach(({ name, value, options }) => respuesta.cookies.set(name, value, options));
  Object.entries(cabeceras).forEach(([nombre, valor]) => respuesta.headers.set(nombre, valor));
  return respuesta;
}

// Todas las rutas menos los archivos estáticos de Next y los que llevan extensión.
export const config = {
  matcher: ['/((?!_next/static|_next/image|.*\\..*).*)'],
};
