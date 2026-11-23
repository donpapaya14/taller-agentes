import { NextResponse, type NextRequest } from 'next/server';
import { ErrorDeEntorno } from '@/adaptadores/supabase/entorno';
import { refrescarSesion } from '@/adaptadores/supabase/sesion';
import { decidirAcceso } from '@/aplicacion/acceso';

const SIN_SERVICIO =
  'El servicio no está disponible ahora mismo. Inténtalo de nuevo en unos minutos.';

// null si el entorno de Supabase falta o no vale: sin él no se sabe quién entra. Cualquier otro
// fallo se relanza.
async function renovarSesion(peticion: NextRequest) {
  try {
    return await refrescarSesion(peticion);
  } catch (error) {
    if (error instanceof ErrorDeEntorno) return null;
    throw error;
  }
}

// Lo público sigue sirviéndose. Lo privado responde 503 y no redirige a /login, porque sin Supabase
// tampoco se podría entrar. Las cabeceras de seguridad las añade next.config a toda respuesta.
function responderSinSupabase(peticion: NextRequest) {
  if (decidirAcceso(peticion.nextUrl.pathname, false).tipo === 'pasa') return NextResponse.next();
  return new NextResponse(SIN_SERVICIO, {
    status: 503,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
}

// Refresca la sesión y orienta al visitante. No autoriza nada: eso lo hace RLS en la base de datos.
export async function proxy(peticion: NextRequest) {
  const renovada = await renovarSesion(peticion);
  if (renovada === null) return responderSinSupabase(peticion);

  const { haySesion, cookies, cabeceras } = renovada;
  const decision = decidirAcceso(peticion.nextUrl.pathname, haySesion);
  const respuesta =
    decision.tipo === 'pasa'
      ? NextResponse.next({ request: peticion })
      : NextResponse.redirect(new URL(decision.a, peticion.url));

  cookies.forEach(({ name, value, options }) => respuesta.cookies.set(name, value, options));
  Object.entries(cabeceras).forEach(([nombre, valor]) => respuesta.headers.set(nombre, valor));
  return respuesta;
}

// Todas las rutas menos los archivos estáticos de Next y los que acaban en una extensión estática.
// Una ruta con punto que no es un archivo (/ordenes/a.b) sí pasa por aquí.
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt|xml|woff2)$).*)',
  ],
};
