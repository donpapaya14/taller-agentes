import { reponerContrasenas, rpcRestablecer } from '@/adaptadores/supabase/demo';
import { conPlazoTotal, PlazoVencido } from '@/adaptadores/supabase/tiempo-limite';
import { USUARIOS_DEMO } from '@/aplicacion/acceso';
import {
  restablecerDemo,
  type OpcionesDeRestablecer,
  type ResultadoRestablecer,
} from '@/aplicacion/restablecer-demo';

const CORREOS_DE_LA_DEMO = Object.values(USUARIOS_DEMO);

const MOTIVO_DEL_PLAZO = 'La base de datos no contestó a tiempo';

// Restablecer y reponer las contraseñas es una sola operación con un solo plazo: con Supabase
// caído, las librerías reintentan unos 25 s y el cron (o quien pulsó el enlace del login) se
// quedaría colgado. La señal del plazo va a las dos llamadas, así que al vencer ninguna de las dos
// sigue esperando. Lo comparten el cron y la acción del login; `opciones` dice cuál de los dos pide.
export async function restablecerDentroDelPlazo(
  opciones: OpcionesDeRestablecer,
): Promise<ResultadoRestablecer> {
  try {
    return await conPlazoTotal((plazo) =>
      restablecerDemo(
        {
          rpcRestablecer: () => rpcRestablecer(plazo),
          reponerContrasenas: () => reponerContrasenas(CORREOS_DE_LA_DEMO, plazo),
        },
        opciones,
      ),
    );
  } catch (error) {
    if (error instanceof PlazoVencido) return { estado: 'ERROR', motivo: MOTIVO_DEL_PLAZO };
    throw error;
  }
}
