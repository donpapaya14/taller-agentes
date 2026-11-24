import { ErrorDeEntorno } from '@/adaptadores/supabase/entorno';
import { leerCronSecret, leerEntornoSecreto } from '@/adaptadores/supabase/entorno-secreto';
import { autorizado } from '@/aplicacion/restablecer-demo';
import { restablecerDentroDelPlazo } from '@/app/restablecer-dentro-del-plazo';

// Quien ya mostró el secreto correcto puede saber qué variable de entorno falta; los demás, no.
function entornoIncompleto(): Response | null {
  try {
    leerEntornoSecreto();
    return null;
  } catch (error) {
    if (error instanceof ErrorDeEntorno) {
      return Response.json({ error: error.message }, { status: 500 });
    }
    throw error;
  }
}

// Vercel llama a esta ruta con GET y `Authorization: Bearer <CRON_SECRET>`. Sin ese secreto nadie
// restablece la demo, y sin él en el entorno no pasa nadie: 401 para todos. Quién llama se decide
// antes de leer el resto del entorno, para que un desconocido no reciba un 500 que nombra variables.
export async function GET(peticion: Request): Promise<Response> {
  const cronSecret = leerCronSecret();
  if (cronSecret === null || !autorizado(peticion.headers.get('authorization'), cronSecret)) {
    return Response.json({ error: 'No autorizado' }, { status: 401 });
  }

  const faltaEntorno = entornoIncompleto();
  if (faltaEntorno !== null) return faltaEntorno;

  const resultado = await restablecerDentroDelPlazo();
  return Response.json(resultado, { status: resultado.estado === 'ERROR' ? 500 : 200 });
}
