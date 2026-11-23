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
  return rol === 'jefe' || ACCIONES_DEL_MECANICO.includes(accion);
}
