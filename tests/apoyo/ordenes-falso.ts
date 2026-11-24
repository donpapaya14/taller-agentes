import { afterEach, beforeEach, vi } from 'vitest';
import { leerSesion, type Sesion } from '@/adaptadores/supabase/sesion';
import { navegarLanzando } from './next-falso';

// El repositorio de órdenes y la sesión de pega, para probar las acciones de la ficha sin base de
// datos. Un test que los use importa este archivo ANTES que la acción que prueba; así la acción
// encuentra ya puestos los falsos.
const falsos = vi.hoisted(() => ({
  anadirLinea: vi.fn(),
  cambiarCantidad: vi.fn(),
  cambiarEstado: vi.fn(),
  guardarManoObra: vi.fn(),
  quitarLinea: vi.fn(),
  rpcCerrar: vi.fn(),
}));

vi.mock('@/adaptadores/supabase/ordenes', () => falsos);
vi.mock('@/adaptadores/supabase/sesion', () => ({ leerSesion: vi.fn() }));

// Todo sale bien: cada escritura toca una fila y el cierre da su número de factura.
function queTodoSalgaBien(): void {
  falsos.anadirLinea.mockResolvedValue(true);
  falsos.cambiarCantidad.mockResolvedValue(true);
  falsos.cambiarEstado.mockResolvedValue(true);
  falsos.guardarManoObra.mockResolvedValue(true);
  falsos.quitarLinea.mockResolvedValue(true);
  falsos.rpcCerrar.mockResolvedValue({ numero: 'F-2026-0001' });
}

// Para los tests de una acción, que lo pide al principio del archivo: antes de cada test entra
// `sesion` (el módulo de sesión lo mockea el propio test), todo sale bien y redirigir interrumpe;
// después, todo vuelve a empezar.
export function prepararAcciones(sesion: Sesion): void {
  beforeEach(() => {
    vi.mocked(leerSesion).mockResolvedValue(sesion);
    queTodoSalgaBien();
    navegarLanzando();
  });

  afterEach(() => vi.resetAllMocks());
}
