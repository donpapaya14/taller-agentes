import { reponerContrasenas, rpcRestablecer } from '@/adaptadores/supabase/demo';
import { ErrorDeEntorno } from '@/adaptadores/supabase/entorno';
import { leerCronSecret, leerEntornoSecreto } from '@/adaptadores/supabase/entorno-secreto';
import { conPlazoTotal, PlazoVencido } from '@/adaptadores/supabase/tiempo-limite';
import { USUARIOS_DEMO } from '@/aplicacion/acceso';
import {
  autorizado,
  restablecerDemo,
  type ResultadoRestablecer,
} from '@/aplicacion/restablecer-demo';

const CORREOS_DE_LA_DEMO = Object.values(USUARIOS_DEMO);

const MOTIVO_DEL_PLAZO = 'La base de datos no contestó a tiempo';

// Restablecer y reponer las contraseñas es una sola operación con un solo plazo: con Supabase
// caído, las librerías reintentan unos 25 s y el cron se quedaría colgado. La señal del plazo va a
// las dos llamadas, así que al vencer ninguna de las dos sigue esperando.
async function restablecerDentroDelPlazo(): Promise<ResultadoRestablecer> {
  try {
    return await conPlazoTotal((plazo) =>
      restablecerDemo({
        rpcRestablecer: () => rpcRestablecer(plazo),
        reponerContrasenas: () => reponerContrasenas(CORREOS_DE_LA_DEMO, plazo),
      }),
    );
  } catch (error) {
    if (error instanceof PlazoVencido) return { estado: 'ERROR', motivo: MOTIVO_DEL_PLAZO };
    throw error;
  }
}

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
