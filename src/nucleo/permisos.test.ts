import { describe, expect, it } from 'vitest';
import { puede, type Accion, type Rol } from './permisos';

// Record obliga a decidir cada acción: si el contrato gana una, este archivo no compila.
const PERMISOS_DEL_MECANICO: Record<Accion, boolean> = {
  crear_orden: true,
  mover_orden: true,
  anadir_linea: true,
  entregar_orden: false,
  borrar_orden: false,
  editar_recambios: false,
  ver_importes: false,
};

const ACCIONES = Object.keys(PERMISOS_DEL_MECANICO) as Accion[];

const accionesDelMecanico = (permitidas: boolean): Accion[] =>
  ACCIONES.filter((accion) => PERMISOS_DEL_MECANICO[accion] === permitidas);

const JEFE: Rol = 'jefe';
const MECANICO: Rol = 'mecanico';

describe('permisos por rol', () => {
  it('[C-3] el mecánico no entrega, no borra, no edita recambios ni ve importes', () => {
    const prohibidas = accionesDelMecanico(false);

    expect(prohibidas).toEqual([
      'entregar_orden',
      'borrar_orden',
      'editar_recambios',
      'ver_importes',
    ]);
    for (const accion of prohibidas) {
      expect(puede(MECANICO, accion)).toBe(false);
    }
  });

  it('[C-3] el mecánico crea órdenes, las mueve y añade líneas', () => {
    const permitidas = accionesDelMecanico(true);

    expect(permitidas).toEqual(['crear_orden', 'mover_orden', 'anadir_linea']);
    for (const accion of permitidas) {
      expect(puede(MECANICO, accion)).toBe(true);
    }
  });

  it('[C-3] el jefe puede las siete acciones', () => {
    expect(ACCIONES).toHaveLength(7);
    for (const accion of ACCIONES) {
      expect(puede(JEFE, accion)).toBe(true);
    }
  });
});
