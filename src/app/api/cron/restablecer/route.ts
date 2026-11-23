import { reponerContrasenas, rpcRestablecer } from '@/adaptadores/supabase/demo';
import { ErrorDeEntorno } from '@/adaptadores/supabase/entorno';
import { leerEntornoSecreto } from '@/adaptadores/supabase/entorno-secreto';
import { USUARIOS_DEMO } from '@/aplicacion/acceso';
import { autorizado, restablecerDemo } from '@/aplicacion/restablecer-demo';

const CORREOS_DE_LA_DEMO = Object.values(USUARIOS_DEMO);

// Vercel llama a esta ruta con GET y `Authorization: Bearer <CRON_SECRET>`. Sin ese secreto nadie
// restablece la demo. Si el entorno no está completo no se deja pasar a nadie y se dice qué falta.
export async function GET(peticion: Request): Promise<Response> {
  let cronSecret: string;
  try {
    ({ cronSecret } = leerEntornoSecreto());
  } catch (error) {
    if (error instanceof ErrorDeEntorno) {
      return Response.json({ error: error.message }, { status: 500 });
    }
    throw error;
  }

  if (!autorizado(peticion.headers.get('authorization'), cronSecret)) {
    return Response.json({ error: 'No autorizado' }, { status: 401 });
  }

  const resultado = await restablecerDemo({
    rpcRestablecer,
    reponerContrasenas: () => reponerContrasenas(CORREOS_DE_LA_DEMO),
  });
  return Response.json(resultado, { status: resultado.estado === 'ERROR' ? 500 : 200 });
}
