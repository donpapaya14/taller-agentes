export const IVA_PORCENTAJE = 21;

export type Linea = { cantidad: number; precioUnitarioCentimos: number };

export type Totales = {
  recambiosCentimos: number;
  manoObraCentimos: number;
  baseCentimos: number;
  ivaCentimos: number;
  totalCentimos: number;
};

const MENSAJE_IMPORTE_NO_VALIDO = 'Importe no válido';

const MINUTOS_POR_HORA = 60;

// Euros escritos por una persona: coma o punto decimal y como mucho dos decimales.
const EUROS_ESCRITOS = /^\d+(?:[.,]\d{1,2})?$/;

// Por encima de 2^53 un entero ya no es exacto y el dinero no puede perder céntimos.
const esEnteroSinSigno = (numero: number): boolean => Number.isSafeInteger(numero) && numero >= 0;

function comprobarImportes(
  lineas: Linea[],
  manoObraMinutos: number,
  precioHoraCentimos: number,
): void {
  const lineasValidas = lineas.every(
    ({ cantidad, precioUnitarioCentimos }) =>
      esEnteroSinSigno(cantidad) && cantidad > 0 && esEnteroSinSigno(precioUnitarioCentimos),
  );

  if (
    !lineasValidas ||
    !esEnteroSinSigno(manoObraMinutos) ||
    !esEnteroSinSigno(precioHoraCentimos)
  ) {
    throw new RangeError(MENSAJE_IMPORTE_NO_VALIDO);
  }
}

export function calcularTotales(
  lineas: Linea[],
  manoObraMinutos: number,
  precioHoraCentimos: number,
): Totales {
  comprobarImportes(lineas, manoObraMinutos, precioHoraCentimos);

  const recambiosCentimos = lineas.reduce(
    (suma, { cantidad, precioUnitarioCentimos }) => suma + cantidad * precioUnitarioCentimos,
    0,
  );
  const manoObraCentimos = Math.round((manoObraMinutos * precioHoraCentimos) / MINUTOS_POR_HORA);
  const baseCentimos = recambiosCentimos + manoObraCentimos;
  const ivaCentimos = Math.round((baseCentimos * IVA_PORCENTAJE) / 100);

  return {
    recambiosCentimos,
    manoObraCentimos,
    baseCentimos,
    ivaCentimos,
    totalCentimos: baseCentimos + ivaCentimos,
  };
}

// Los tres últimos dígitos van detrás de un punto y el resto se agrupa igual.
const agruparMiles = (entero: string): string =>
  entero.length <= 3 ? entero : `${agruparMiles(entero.slice(0, -3))}.${entero.slice(-3)}`;

// Sin Intl.NumberFormat: mete espacios que el PDF no sabe dibujar.
export function formatearEuros(centimos: number): string {
  const signo = centimos < 0 ? '-' : '';
  const absolutos = Math.abs(centimos);
  const euros = agruparMiles(String(Math.floor(absolutos / 100)));
  const resto = String(absolutos % 100).padStart(2, '0');

  return `${signo}${euros},${resto} €`;
}

export function eurosACentimos(texto: string): number | null {
  if (!EUROS_ESCRITOS.test(texto)) return null;

  const [euros, decimales = ''] = texto.split(/[.,]/);
  // Un solo decimal son décimas: «0,1» son 10 céntimos, no 1.
  const centimos = Number(euros) * 100 + Number(decimales.padEnd(2, '0'));

  return esEnteroSinSigno(centimos) ? centimos : null;
}
