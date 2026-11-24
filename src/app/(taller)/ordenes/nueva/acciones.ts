'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { crearOrden, MatriculaRepetida } from '@/adaptadores/supabase/ordenes';
import { leerSesion } from '@/adaptadores/supabase/sesion';
import { validarNuevaOrden, type DatosOrden, type Errores } from '@/aplicacion/nueva-orden';
import { puede } from '@/nucleo/permisos';
import type { EstadoFormulario } from '@/ui/ordenes/FormularioOrden';

const SIN_PERMISO = 'No tienes permiso para crear órdenes';
const NO_SE_PUDO_CREAR = 'No se pudo crear la orden. Inténtalo de nuevo.';

// Los campos de texto que el formulario vuelve a pintar cuando algo falla.
const CAMPOS_DE_TEXTO = [
  'matricula',
  'marca',
  'modelo',
  'clienteNombre',
  'clienteTelefono',
  'descripcion',
];

function valoresDe(datos: FormData): Record<string, string> {
  const valores: Record<string, string> = {};
  for (const campo of CAMPOS_DE_TEXTO) {
    const valor = datos.get(campo);
    if (typeof valor === 'string') valores[campo] = valor;
  }
  return valores;
}

type Fallo = { errores: Errores; motivo: string | null };

// Una excepción del repositorio no sube a la pantalla de error: se cuenta junto al formulario. La
// matrícula repetida tiene su campo; el resto, un motivo general sin el texto de la excepción, que
// puede venir en inglés o nombrar la base de datos.
async function crear(datos: DatosOrden, tallerId: string): Promise<{ id: string } | Fallo> {
  try {
    return await crearOrden(datos, tallerId);
  } catch (error) {
    if (error instanceof MatriculaRepetida) {
      return { errores: { matricula: error.message }, motivo: null };
    }
    return { errores: {}, motivo: NO_SE_PUDO_CREAR };
  }
}

export async function crearOrdenAccion(
  estadoPrevio: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const sesion = await leerSesion();
  if (sesion === null) redirect('/login');

  const valores = valoresDe(datos);
  if (!puede(sesion.rol, 'crear_orden')) return { errores: {}, motivo: SIN_PERMISO, valores };

  const validacion = validarNuevaOrden(Object.fromEntries(datos));
  if (!validacion.ok) return { errores: validacion.errores, motivo: null, valores };

  const creada = await crear(validacion.datos, sesion.tallerId);
  if (!('id' in creada)) return { ...creada, valores };

  revalidatePath('/tablero');
  redirect(`/ordenes/${creada.id}`);
}
