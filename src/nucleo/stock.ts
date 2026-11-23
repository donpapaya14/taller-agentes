export type Existencia = {
  recambioId: string;
  referencia: string;
  stock: number;
  stockMinimo: number;
};

export type Consumo = { recambioId: string; cantidad: number };

export type ResultadoDescuento =
  | { ok: true; existencias: Existencia[] }
  | { ok: false; faltan: { referencia: string; falta: number }[] };

const MENSAJE_CANTIDAD_NO_VALIDA = 'Cantidad no válida';

export function bajoMinimo(existencia: Pick<Existencia, 'stock' | 'stockMinimo'>): boolean {
  return existencia.stock <= existencia.stockMinimo;
}

// Un consumo de -3 subiría el stock en vez de bajarlo: solo valen los enteros de al menos 1.
function comprobarCantidades(consumos: Consumo[]): void {
  const todasValidas = consumos.every(
    ({ cantidad }) => Number.isSafeInteger(cantidad) && cantidad >= 1,
  );

  if (!todasValidas) throw new RangeError(MENSAJE_CANTIDAD_NO_VALIDA);
}

// Suma lo pedido por recambio; el Map conserva el orden en que cada uno se pidió por primera vez.
function sumarPorRecambio(consumos: Consumo[]): Map<string, number> {
  const pedido = new Map<string, number>();
  for (const { recambioId, cantidad } of consumos) {
    pedido.set(recambioId, (pedido.get(recambioId) ?? 0) + cantidad);
  }
  return pedido;
}

// Todo o nada: si algún recambio no alcanza, se devuelve lo que falta y no se descuenta nada.
// No modifica lo que recibe: el resultado es una lista nueva.
// Lanza RangeError si alguna cantidad no es un entero de al menos 1.
export function descontar(existencias: Existencia[], consumos: Consumo[]): ResultadoDescuento {
  comprobarCantidades(consumos);
  const pedido = sumarPorRecambio(consumos);

  const faltan = [...pedido].flatMap(([recambioId, cantidad]) => {
    const existencia = existencias.find((candidata) => candidata.recambioId === recambioId);
    if (existencia === undefined) return [{ referencia: `?${recambioId}`, falta: cantidad }];

    const falta = cantidad - existencia.stock;
    return falta > 0 ? [{ referencia: existencia.referencia, falta }] : [];
  });
  if (faltan.length > 0) return { ok: false, faltan };

  return {
    ok: true,
    existencias: existencias.map((existencia) => ({
      ...existencia,
      stock: existencia.stock - (pedido.get(existencia.recambioId) ?? 0),
    })),
  };
}
