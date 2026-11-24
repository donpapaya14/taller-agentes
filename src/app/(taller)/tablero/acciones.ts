'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { cambiarEstado } from '@/adaptadores/supabase/ordenes';
import { leerSesion } from '@/adaptadores/supabase/sesion';
import { moverOrden } from '@/aplicacion/mover-orden';
import { ESTADOS, siguienteEstado } from '@/nucleo/orden';
import { puede } from '@/nucleo/permisos';
import { contarResultado, limpiarAviso } from '../aviso';

const SIN_PERMISO = 'No tienes permiso para mover órdenes';
const MOTIVO_SI_LANZA = 'No se pudo mover la orden. Inténtalo de nuevo.';

// La tarjeta manda el estado en que vio la orden: el que sigue lo decide el servidor, no el
// navegador. Un estado que no existe no tiene siguiente, y `moverOrden` lo rechaza.
function destinoDe(de: unknown) {
  const estado = z.enum(ESTADOS).safeParse(de);
  return estado.success ? siguienteEstado(estado.data) : null;
}

export async function avanzarOrden(datos: FormData): Promise<void> {
  const sesion = await leerSesion();
  if (sesion === null) redirect('/login');
  await limpiarAviso();

  const de = datos.get('de');
  await contarResultado(async () => {
    if (!puede(sesion.rol, 'mover_orden')) return { ok: false, motivo: SIN_PERMISO };
    return moverOrden({ id: datos.get('id'), de, a: destinoDe(de) }, { cambiarEstado });
  }, MOTIVO_SI_LANZA);

  revalidatePath('/tablero');
}
