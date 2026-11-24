import { ETIQUETA_ESTADO, type Estado } from '../../nucleo/orden';
import { Matricula } from '../Matricula';

type PropsCabecera = {
  matricula: string;
  estado: Estado;
  numeroFactura: string | null;
  vehiculo: string;
  cliente: string;
  clienteTelefono: string;
  descripcion: string;
};

// Las mismas marcas del suelo que pintan bajo cada columna del tablero.
const MARCA_DEL_ESTADO: Record<Estado, string> = {
  recibido: 'bg-acero',
  en_reparacion: 'bg-ambar',
  listo: 'bg-testigo',
  entregado: 'bg-raya',
};

function Dato({ termino, valor }: { termino: string; valor: string }) {
  return (
    <div className="flex flex-col gap-e1">
      <dt className="text-nota font-seminegra text-acero">{termino}</dt>
      {/* Una palabra sin espacios se parte en vez de ensanchar la pantalla. */}
      <dd className="text-base text-hueso wrap-anywhere">{valor}</dd>
    </div>
  );
}

/** La orden de un vistazo: su placa, en qué punto va y a quién y qué es. */
export function CabeceraOrden(props: PropsCabecera) {
  const { matricula, estado, numeroFactura, vehiculo, cliente, clienteTelefono, descripcion } = props;

  return (
    <header className="flex flex-col gap-e5">
      <h1 className="@container">
        <Matricula texto={matricula} tamano="grande" />
      </h1>
      <p className="flex flex-wrap items-center gap-x-e4 gap-y-e2 font-dato text-menor tracking-dato text-hueso uppercase">
        <span className="flex items-center gap-e3">
          <span aria-hidden="true" className={`h-e1 w-e6 ${MARCA_DEL_ESTADO[estado]}`} />
          <span>{ETIQUETA_ESTADO[estado]}</span>
        </span>
        {numeroFactura !== null && <span className="text-acero">Factura {numeroFactura}</span>}
      </p>
      <dl className="grid gap-e4">
        <Dato termino="Vehículo" valor={vehiculo === '' ? 'Sin marca ni modelo' : vehiculo} />
        <Dato termino="Cliente" valor={cliente} />
        <Dato termino="Teléfono" valor={clienteTelefono === '' ? 'Sin teléfono' : clienteTelefono} />
        <Dato termino="Qué hay que hacer" valor={descripcion} />
      </dl>
    </header>
  );
}
