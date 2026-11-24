import { vi } from 'vitest';
import type { Sesion } from '@/adaptadores/supabase/sesion';
import type { Rol } from '@/nucleo/permisos';

// Lo de Next que tocan las acciones y las páginas del taller, de pega: las cookies, la revalidación,
// la redirección y el «no encontrado». Un test que lo use lo importa ANTES que el módulo que
// prueba, para que el módulo encuentre ya puesto el falso.
const falsos = vi.hoisted(() => ({
  almacen: { get: vi.fn(), set: vi.fn(), delete: vi.fn() },
  revalidatePath: vi.fn(),
  redirect: vi.fn(),
  notFound: vi.fn(),
}));
const { notFound } = falsos;
export const { almacen, revalidatePath, redirect } = falsos;

vi.mock('next/headers', () => ({ cookies: async () => almacen }));
vi.mock('next/cache', () => ({ revalidatePath }));
vi.mock('next/navigation', () => ({ redirect, notFound }));

// Como en Next, redirigir y dar un «no encontrado» interrumpen lo que sigue: lanzan, el primero con
// el destino.
export function navegarLanzando(): void {
  redirect.mockImplementation((destino: string) => {
    throw new Error(`REDIRIGE:${destino}`);
  });
  notFound.mockImplementation(() => {
    throw new Error('NO_ENCONTRADO');
  });
}

export const SESION_JEFE: Sesion = {
  usuarioId: 'u-1',
  tallerId: 't-1',
  taller: 'Taller Demo',
  rol: 'jefe',
  nombre: 'Lucía Ferrer',
};

export const SESION_MECANICO: Sesion = { ...SESION_JEFE, rol: 'mecanico', nombre: 'Andrés Molina' };

// Un rol que el tipo no deja escribir: para probar que nadie más tiene permisos.
export const rolFalso = (texto: string) => texto as Rol;

export function formulario(campos: Record<string, string | File>): FormData {
  const datos = new FormData();
  for (const [nombre, valor] of Object.entries(campos)) datos.set(nombre, valor);
  return datos;
}

// El aviso que dejó la acción en su cookie, o null si no dejó ninguno.
export function avisoDejado(): { tipo: string; texto: string } | null {
  const [, valor] = almacen.set.mock.calls[0] ?? [];
  return valor === undefined ? null : JSON.parse(valor);
}
