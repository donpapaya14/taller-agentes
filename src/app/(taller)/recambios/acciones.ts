'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { guardarRecambio } from '@/adaptadores/supabase/recambios';
import { leerSesion } from '@/adaptadores/supabase/sesion';
import { guardarFormularioDeRecambio } from '@/aplicacion/recambios';
import { puede } from '@/nucleo/permisos';

type Textos = Record<string, string>;

// Lo que ve el formulario tras guardar. Con un fallo, `valores` devuelve lo que se mandó para que no
// se pierda al corregirlo.
type Estado = { ok: true } | { ok: false; motivo: string; errores: Textos; valores: Textos };

const SOLO_JEFE = 'Solo el jefe de taller puede editar el almacén';
const NO_SE_PUDO = 'No se pudo guardar el recambio. Inténtalo de nuevo.';

const CAMPOS_DEL_FORMULARIO = ['id', 'referencia', 'nombre', 'precio', 'stock', 'stockMinimo'];

// Solo los campos del formulario, y solo si son texto: Next añade los suyos (`$ACTION_…`) al
// FormData de una acción y un archivo no es un valor que se pueda validar como un número.
function camposDe(datos: FormData): Textos {
  const campos: Textos = {};
  for (const nombre of CAMPOS_DEL_FORMULARIO) {
    const valor = datos.get(nombre);
    if (typeof valor === 'string') campos[nombre] = valor;
  }
  return campos;
}

const rechazo = (motivo: string, valores: Textos): Estado => ({
  ok: false,
  motivo,
  errores: {},
  valores,
});

// Cualquier excepción del repositorio (la base de datos caída, una respuesta que no se entiende) se
// convierte en un motivo en español: lanzarla dejaría a quien guarda con una pantalla de error y sin
// lo que había escrito, y su texto técnico no es para él.
async function guardarSinLanzar(campos: Textos, tallerId: string): Promise<Estado> {
  try {
    const resultado = await guardarFormularioDeRecambio(campos, tallerId, { guardarRecambio });
    return resultado.ok ? resultado : { ...resultado, valores: campos };
  } catch {
    return rechazo(NO_SE_PUDO, campos);
  }
}

// El primer argumento es el estado anterior del formulario, que la acción no necesita. Como toda
// acción, empieza por la sesión: el proxy orienta, pero no es la barrera. La base de datos también
// impide escribir al mecánico: aquí se evita la llamada y se le dice por qué.
export async function guardar(_estadoPrevio: unknown, datos: FormData): Promise<Estado> {
  const sesion = await leerSesion();
  if (sesion === null) redirect('/login');

  const campos = camposDe(datos);
  if (!puede(sesion.rol, 'editar_recambios')) return rechazo(SOLO_JEFE, campos);

  const estado = await guardarSinLanzar(campos, sesion.tallerId);
  if (estado.ok) revalidatePath('/recambios');
  return estado;
}
