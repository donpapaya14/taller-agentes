import { useId } from 'react';
import { EstadoVacio } from '../EstadoVacio';
import {
  TarjetaOrden,
  type AccionAvanzar,
  type EstadoOrden,
  type OrdenTablero,
} from './TarjetaOrden';

export type { OrdenTablero } from './TarjetaOrden';

type PropsTablero = {
  ordenes: OrdenTablero[];
  puedeEntregar: boolean;
  accionAvanzar?: AccionAvanzar;
};

type Columna = {
  estado: EstadoOrden;
  titulo: string;
  vacio: string;
  /** Color de la línea pintada bajo el título, como las marcas del suelo del taller. */
  marca: string;
};

// Las cuatro columnas en el orden en que una orden recorre el taller.
const COLUMNAS: Columna[] = [
  { estado: 'recibido', titulo: 'Recibido', vacio: 'Nada recibido hoy', marca: 'bg-acero' },
  {
    estado: 'en_reparacion',
    titulo: 'En reparación',
    vacio: 'Ningún coche en el elevador',
    marca: 'bg-ambar',
  },
  { estado: 'listo', titulo: 'Listo', vacio: 'Nada pendiente de recoger', marca: 'bg-testigo' },
  {
    estado: 'entregado',
    titulo: 'Entregado',
    vacio: 'Aún no se ha entregado nada',
    marca: 'bg-raya',
  },
];

const ordenesEnPalabra = (cantidad: number) => (cantidad === 1 ? 'orden' : 'órdenes');

/**
 * En móvil se ve una columna y este selector, fijo arriba, elige cuál. Son radios sin JavaScript:
 * la columna marcada se enseña con CSS (globals.css). Desde lg se ven las cuatro y el selector se oculta.
 */
function SelectorDeColumna({ nombre, recuentos }: { nombre: string; recuentos: number[] }) {
  return (
    <fieldset className="tablero-selector divide-x divide-raya border-b border-raya bg-chapa">
      <legend className="sr-only">Columna que se ve</legend>
      {COLUMNAS.map(({ estado, titulo, marca }, indice) => (
        <label key={estado} className="tablero-opcion flex flex-col gap-e2 pb-e3">
          <input
            type="radio"
            name={nombre}
            value={estado}
            defaultChecked={indice === 0}
            aria-label={`${titulo}: ${recuentos[indice]} ${ordenesEnPalabra(recuentos[indice])}`}
            className="sr-only"
          />
          <span aria-hidden="true" className={`h-e1 ${marca}`} />
          <span className="px-e2 font-dato text-mayor text-hueso">{recuentos[indice]}</span>
          <span className="px-e2 text-nota font-seminegra hyphens-auto">{titulo}</span>
        </label>
      ))}
    </fieldset>
  );
}

type PropsColumna = PropsTablero & {
  columna: Columna;
  idTitulo: string;
  /** Turno de entrada de la primera tarjeta: cada columna arranca una más tarde que la anterior. */
  turnoInicial: number;
};

function ColumnaDelTablero({ columna, ordenes, idTitulo, turnoInicial, ...accion }: PropsColumna) {
  return (
    <section
      aria-labelledby={idTitulo}
      data-estado={columna.estado}
      className="tablero-columna gap-e5 px-e4 pt-e5 pb-e7 xl:px-e5"
    >
      <header className="flex flex-col gap-e3">
        <div className="flex items-baseline justify-between gap-e3">
          <h2
            id={idTitulo}
            className="font-titular text-columna font-negra tracking-titular uppercase"
          >
            {columna.titulo}
          </h2>
          <p className="font-dato text-mayor text-acero">
            {ordenes.length}
            <span className="sr-only"> {ordenesEnPalabra(ordenes.length)}</span>
          </p>
        </div>
        <span aria-hidden="true" className={`h-e1 ${columna.marca}`} />
      </header>
      {ordenes.length === 0 ? (
        <EstadoVacio texto={columna.vacio} />
      ) : (
        <ol className="flex flex-col gap-e4">
          {ordenes.map((orden, fila) => (
            <li key={orden.id}>
              <TarjetaOrden orden={orden} turno={turnoInicial + fila} {...accion} />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function Tablero({ ordenes, puedeEntregar, accionAvanzar }: PropsTablero) {
  const id = useId();
  const porColumna = COLUMNAS.map(({ estado }) => ordenes.filter((o) => o.estado === estado));

  return (
    <div className="tablero flex flex-1 flex-col">
      <div aria-hidden="true" className="franja-seguridad" />
      <SelectorDeColumna
        nombre={`${id}-columna`}
        recuentos={porColumna.map((lista) => lista.length)}
      />
      <div className="flex-1 lg:grid lg:grid-cols-4 lg:divide-x lg:divide-raya">
        {COLUMNAS.map((columna, indice) => (
          <ColumnaDelTablero
            key={columna.estado}
            columna={columna}
            ordenes={porColumna[indice]}
            idTitulo={`${id}-${columna.estado}`}
            turnoInicial={indice}
            puedeEntregar={puedeEntregar}
            accionAvanzar={accionAvanzar}
          />
        ))}
      </div>
    </div>
  );
}
