import { formatearEuros, IVA_PORCENTAJE } from '../../nucleo/importe';

// Los importes llegan ya calculados por el núcleo, en céntimos: aquí solo se escriben.
export function Totales({ base, iva, total }: { base: number; iva: number; total: number }) {
  return (
    <dl className="grid grid-cols-[1fr_auto] gap-x-e5 gap-y-e2 rounded-pieza border border-raya bg-chapa p-e4">
      <dt className="text-menor text-acero">Base imponible</dt>
      <dd className="text-right font-dato text-menor text-hueso">{formatearEuros(base)}</dd>
      <dt className="text-menor text-acero">IVA ({IVA_PORCENTAJE} %)</dt>
      <dd className="text-right font-dato text-menor text-hueso">{formatearEuros(iva)}</dd>
      <dt className="border-t border-raya pt-e2 font-titular text-mayor font-negra tracking-titular uppercase">
        Total
      </dt>
      <dd className="border-t border-raya pt-e2 text-right font-dato text-mayor text-hueso">
        {formatearEuros(total)}
      </dd>
    </dl>
  );
}
