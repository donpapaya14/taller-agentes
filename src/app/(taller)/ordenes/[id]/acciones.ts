'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  anadirLinea,
  cambiarCantidad,
  cambiarEstado,
  guardarManoObra,
  quitarLinea,
  rpcCerrar,
} from '@/adaptadores/supabase/ordenes';
import { leerSesion, type Sesion } from '@/adaptadores/supabase/sesion';
import { cerrarOrden } from '@/aplicacion/cerrar-orden';
import {
  validarCantidadDeLinea,
  validarLinea,
  validarLineaAQuitar,
  validarManoObra,
} from '@/aplicacion/lineas';
import { moverOrden } from '@/aplicacion/mover-orden';
import type { Errores } from '@/aplicacion/nueva-orden';
import { puede } from '@/nucleo/permisos';
import { contarResultado, limpiarAviso, type Resultado } from '../../aviso';

const SIN_PERMISO_PARA_MOVER = 'No tienes permiso para mover órdenes';
const SIN_PERMISO = 'No tienes permiso para cambiar esta orden';
const RECAMBIO_REPETIDO = 'Ese recambio ya está en la orden. Cambia su cantidad en la lista';
const LINEA_PERDIDA = 'Esa línea ya no está en la orden o la orden ya se entregó';
const ORDEN_CERRADA = 'La orden ya no admite cambios: se entregó o no existe';

type Operacion = (sesion: Sesion, datos: FormData) => Promise<Resultado>;

// Las acciones de la ficha empiezan igual: quién es, fuera el aviso anterior, lo suyo y poner al día
// la ficha (cualquier orden) y el tablero. Una excepción del repositorio sale como `motivoSiLanza`.
async function enLaFicha(
  datos: FormData,
  operacion: Operacion,
  motivoSiLanza: string,
): Promise<void> {
  const sesion = await leerSesion();
  if (sesion === null) redirect('/login');
  await limpiarAviso();

  await contarResultado(() => operacion(sesion, datos), motivoSiLanza);

  revalidatePath('/ordenes/[id]', 'page');
  revalidatePath('/tablero');
}

// El repositorio dice con false que no tocó nada: otra persona llegó antes o la política de RLS no
// deja ver la fila (por ejemplo, la orden ya se entregó).
const tocado = (conseguido: boolean, motivoSiNo: string): Resultado =>
  conseguido ? { ok: true } : { ok: false, motivo: motivoSiNo };

// Los errores de un formulario salen todos juntos, cada uno con su frase.
const rechazo = (errores: Errores): Resultado => ({
  ok: false,
  motivo: Object.values(errores).join('. '),
});

const sinPermiso = (): Resultado => ({ ok: false, motivo: SIN_PERMISO });

async function mover({ rol }: Sesion, datos: FormData): Promise<Resultado> {
  if (!puede(rol, 'mover_orden')) return { ok: false, motivo: SIN_PERMISO_PARA_MOVER };

  const orden = { id: datos.get('id'), de: datos.get('de'), a: datos.get('a') };
  return moverOrden(orden, { cambiarEstado });
}

async function entregar({ rol }: Sesion, datos: FormData): Promise<Resultado> {
  const cierre = await cerrarOrden({ id: datos.get('id'), rol }, { rpcCerrar });
  return cierre.ok ? { ok: true, aviso: `Orden entregada. Factura ${cierre.numeroFactura}` } : cierre;
}

async function anadir({ rol, tallerId }: Sesion, datos: FormData): Promise<Resultado> {
  if (!puede(rol, 'anadir_linea')) return sinPermiso();

  const linea = validarLinea(Object.fromEntries(datos));
  if (!linea.ok) return rechazo(linea.errores);
  return tocado(await anadirLinea({ ...linea.datos, tallerId }), RECAMBIO_REPETIDO);
}

async function cambiarLinea({ rol }: Sesion, datos: FormData): Promise<Resultado> {
  if (!puede(rol, 'anadir_linea')) return sinPermiso();

  const cambio = validarCantidadDeLinea(Object.fromEntries(datos));
  if (!cambio.ok) return rechazo(cambio.errores);
  return tocado(await cambiarCantidad(cambio.datos.lineaId, cambio.datos.cantidad), LINEA_PERDIDA);
}

async function quitar({ rol }: Sesion, datos: FormData): Promise<Resultado> {
  if (!puede(rol, 'anadir_linea')) return sinPermiso();

  const linea = validarLineaAQuitar(Object.fromEntries(datos));
  if (!linea.ok) return rechazo(linea.errores);
  return tocado(await quitarLinea(linea.datos.lineaId), LINEA_PERDIDA);
}

async function guardarMano({ rol }: Sesion, datos: FormData): Promise<Resultado> {
  if (!puede(rol, 'anadir_linea')) return sinPermiso();

  const mano = validarManoObra(Object.fromEntries(datos));
  if (!mano.ok) return rechazo(mano.errores);
  return tocado(await guardarManoObra(mano.ordenId, mano.minutos), ORDEN_CERRADA);
}

export async function moverEstado(datos: FormData): Promise<void> {
  await enLaFicha(datos, mover, 'No se pudo mover la orden. Inténtalo de nuevo.');
}

export async function entregarOrden(datos: FormData): Promise<void> {
  await enLaFicha(datos, entregar, 'No se pudo entregar la orden. Inténtalo de nuevo.');
}

export async function anadirRecambio(datos: FormData): Promise<void> {
  await enLaFicha(datos, anadir, 'No se pudo añadir el recambio. Inténtalo de nuevo.');
}

export async function cambiarCantidadDeLinea(datos: FormData): Promise<void> {
  await enLaFicha(datos, cambiarLinea, 'No se pudo cambiar la cantidad. Inténtalo de nuevo.');
}

export async function quitarRecambio(datos: FormData): Promise<void> {
  await enLaFicha(datos, quitar, 'No se pudo quitar el recambio. Inténtalo de nuevo.');
}

export async function guardarMinutos(datos: FormData): Promise<void> {
  await enLaFicha(datos, guardarMano, 'No se pudo guardar la mano de obra. Inténtalo de nuevo.');
}
