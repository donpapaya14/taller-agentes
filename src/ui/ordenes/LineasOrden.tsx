import { calcularTotales, formatearEuros } from '../../nucleo/importe';
import { BotonDeEnvio } from '../BotonDeEnvio';
import { EstadoVacio } from '../EstadoVacio';

export type LineaVista = {
  id: string;
  referencia: string;
  nombre: string;
  cantidad: number;
  precioUnitarioCentimos: number;
};

type AccionDeFormulario = (datos: FormData) => void | Promise<void>;

// Con `editable`, cada línea deja cambiar su cantidad y quitarla, y para eso necesita las dos
// acciones: el componente no sabe de dónde salen, igual que `accionAvanzar` del tablero.
type PropsLineas = { lineas: LineaVista[]; verImportes: boolean } & (
  | { editable: false }
  | { editable: true; accionCantidad: AccionDeFormulario; accionQuitar: AccionDeFormulario }
);

// El importe de una línea lo calcula el núcleo, como el de los totales: en céntimos enteros.
const importeDe = (linea: LineaVista) => calcularTotales([linea], 0, 0).recambiosCentimos;

function DatosDeLinea({ linea, verImportes }: { linea: LineaVista; verImportes: boolean }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-e4 gap-y-e2">
      {/* Una palabra sin espacios se parte en vez de ensanchar la línea. */}
      <div className="flex min-w-0 flex-col gap-e1 wrap-anywhere">
        <p className="font-dato text-nota tracking-dato text-acero">{linea.referencia}</p>
        <p className="font-seminegra text-hueso">{linea.nombre}</p>
      </div>
      {verImportes ? (
        <p className="flex flex-col items-end font-dato text-menor text-hueso">
          <span className="text-acero">
            {linea.cantidad} × {formatearEuros(linea.precioUnitarioCentimos)}
          </span>
          <span>{formatearEuros(importeDe(linea))}</span>
        </p>
      ) : (
        <p className="font-dato text-menor text-hueso">× {linea.cantidad}</p>
      )}
    </div>
  );
}

function ControlesDeLinea({
  linea,
  accionCantidad,
  accionQuitar,
}: {
  linea: LineaVista;
  accionCantidad: AccionDeFormulario;
  accionQuitar: AccionDeFormulario;
}) {
  return (
    <div className="flex flex-wrap items-end gap-e3">
      <form action={accionCantidad} className="flex flex-1 items-end gap-e2">
        <input type="hidden" name="lineaId" value={linea.id} />
        <input
          type="number"
          name="cantidad"
          min={1}
          max={999}
          step={1}
          inputMode="numeric"
          required
          defaultValue={linea.cantidad}
          aria-label={`Cantidad de ${linea.nombre}`}
          className="min-h-toque w-full min-w-0 rounded-pieza border border-raya bg-chapa-alta px-e4 text-base text-hueso"
        />
        <BotonDeEnvio variante="secundario">Guardar</BotonDeEnvio>
      </form>
      <form action={accionQuitar}>
        <input type="hidden" name="lineaId" value={linea.id} />
        <BotonDeEnvio variante="peligro">Quitar</BotonDeEnvio>
      </form>
    </div>
  );
}

/** Los recambios de una orden. Sin importes para quien no los puede ver, con controles si se edita. */
export function LineasOrden(props: PropsLineas) {
  const { lineas, verImportes } = props;
  if (lineas.length === 0) return <EstadoVacio texto="Sin recambios todavía" />;

  return (
    <ul className="flex flex-col divide-y divide-raya rounded-pieza border border-raya bg-chapa">
      {lineas.map((linea) => (
        <li key={linea.id} className="flex flex-col gap-e4 p-e4">
          <DatosDeLinea linea={linea} verImportes={verImportes} />
          {props.editable && (
            <ControlesDeLinea
              linea={linea}
              accionCantidad={props.accionCantidad}
              accionQuitar={props.accionQuitar}
            />
          )}
        </li>
      ))}
    </ul>
  );
}
