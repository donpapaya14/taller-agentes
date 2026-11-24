import { puede, type Rol } from '@/nucleo/permisos';

const SOLO_JEFE = 'SOLO_JEFE';
const PREFIJO_SIN_STOCK = 'STOCK_INSUFICIENTE:';

const NO_SE_PUDO = 'No se pudo entregar la orden. Inténtalo de nuevo';

// Los errores que lanza `cerrar_orden` en Postgres. Es un Map y no un objeto: una clave como
// «constructor» no puede encontrar nada heredado.
const MENSAJES_DEL_CIERRE = new Map([
  [SOLO_JEFE, 'Solo el jefe de taller puede entregar una orden'],
  ['ESTADO_INVALIDO', 'La orden tiene que estar en «Listo» para entregarla'],
  ['ORDEN_NO_ENCONTRADA', 'No encontramos esa orden'],
]);

// Lo que sigue a «STOCK_INSUFICIENTE:» es la referencia a la que le falta stock; vacío si no hay.
function referenciaSinStock(mensaje: string): string {
  if (!mensaje.startsWith(PREFIJO_SIN_STOCK)) return '';
  return mensaje.slice(PREFIJO_SIN_STOCK.length).trim();
}

export function traducirErrorCierre(mensaje: string): string {
  const referencia = referenciaSinStock(mensaje);
  if (referencia !== '') {
    return `No hay stock suficiente de ${referencia}. Revisa el almacén antes de entregar`;
  }
  return MENSAJES_DEL_CIERRE.get(mensaje) ?? NO_SE_PUDO;
}

export async function cerrarOrden(
  d: { id: string; rol: Rol },
  puerto: { rpcCerrar: (id: string) => Promise<{ numero: string } | { error: string }> },
): Promise<{ ok: true; numeroFactura: string } | { ok: false; motivo: string }> {
  // La base de datos también lo impide: esto evita la llamada y da el mismo mensaje.
  if (!puede(d.rol, 'entregar_orden')) {
    return { ok: false, motivo: traducirErrorCierre(SOLO_JEFE) };
  }

  const resultado = await puerto.rpcCerrar(d.id);
  if ('error' in resultado) return { ok: false, motivo: traducirErrorCierre(resultado.error) };

  return { ok: true, numeroFactura: resultado.numero };
}
