export type Rol = 'jefe' | 'mecanico';

export type Accion =
  | 'crear_orden'
  | 'mover_orden'
  | 'anadir_linea'
  | 'entregar_orden'
  | 'borrar_orden'
  | 'editar_recambios'
  | 'ver_importes';

const ACCIONES_DEL_MECANICO: readonly Accion[] = ['crear_orden', 'mover_orden', 'anadir_linea'];

export function puede(rol: Rol, accion: Accion): boolean {
  if (rol === 'jefe') return true;

  // Cualquier otro valor, aunque el tipo no lo deje escribir, no tiene permisos.
  return rol === 'mecanico' && ACCIONES_DEL_MECANICO.includes(accion);
}
