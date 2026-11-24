import type { ReactNode } from 'react';
import { EstadoVacio } from '../EstadoVacio';
import { IconoDespliegue } from '../iconos';
import { FormularioRecambio, type AccionGuardar, type RecambioVista } from './FormularioRecambio';

export type { RecambioVista } from './FormularioRecambio';

type PropsLista = {
  recambios: RecambioVista[];
  puedeEditar: boolean;
  /** Lo que guarda un recambio; solo la usan los formularios, que solo hay con `puedeEditar`. */
  accionGuardar?: AccionGuardar;
};

// Los que están bajo mínimo van primero y, dentro de cada grupo, por referencia. No toca la lista
// que recibe.
function ordenados(recambios: RecambioVista[]): RecambioVista[] {
  return [...recambios].sort(
    (a, b) =>
      Number(b.bajoMinimo) - Number(a.bajoMinimo) || a.referencia.localeCompare(b.referencia, 'es'),
  );
}

// Un formulario plegado en un <details> nativo: se abre con el teclado y sin JavaScript. El detalle
// solo lo lee un lector de pantalla, para distinguir un «Editar» de otro.
function Plegable({
  titulo,
  detalle,
  children,
}: {
  titulo: string;
  detalle?: string;
  children: ReactNode;
}) {
  return (
    <details className="group w-full rounded-pieza border border-raya bg-chapa">
      <summary className="flex min-h-toque cursor-pointer items-center justify-between gap-e3 px-e4 font-seminegra text-hueso">
        <span>
          {titulo}
          {detalle !== undefined && <span className="sr-only"> {detalle}</span>}
        </span>
        <IconoDespliegue className="size-e5 shrink-0 text-acero transition-transform group-open:rotate-90 motion-reduce:transition-none" />
      </summary>
      <div className="border-t border-raya p-e4">{children}</div>
    </details>
  );
}

function Etiqueta({ texto }: { texto: string }) {
  return (
    <p className="rounded-pieza border border-ambar px-e2 font-dato text-nota font-seminegra tracking-dato text-ambar uppercase">
      {texto}
    </p>
  );
}

function FilaDeRecambio({
  recambio,
  accionGuardar,
  puedeEditar,
}: {
  recambio: RecambioVista;
  accionGuardar?: AccionGuardar;
  puedeEditar: boolean;
}) {
  const { referencia, nombre, precio, stock, stockMinimo, bajoMinimo } = recambio;

  return (
    <article className="flex flex-col gap-e4 rounded-pieza border border-raya bg-chapa p-e4">
      <header className="flex flex-wrap items-baseline justify-between gap-x-e3 gap-y-e2">
        <p className="font-dato text-nota tracking-dato text-acero wrap-anywhere">{referencia}</p>
        {bajoMinimo && <Etiqueta texto="Bajo mínimo" />}
      </header>
      <h2 className="font-seminegra text-hueso wrap-anywhere">{nombre}</h2>
      <div className="flex flex-wrap items-baseline justify-between gap-x-e4 gap-y-e1">
        <p className="flex flex-wrap items-baseline gap-x-e3 gap-y-e1">
          <span className={`font-dato text-columna ${bajoMinimo ? 'text-ambar' : 'text-hueso'}`}>
            <span className="sr-only">Stock </span>
            {stock}
          </span>
          <span className="text-menor text-acero">mín. {stockMinimo}</span>
        </p>
        {precio !== null && <p className="font-dato text-menor text-hueso">{precio}</p>}
      </div>
      {puedeEditar && (
        <Plegable titulo="Editar" detalle={referencia}>
          <FormularioRecambio recambio={recambio} accion={accionGuardar} />
        </Plegable>
      )}
    </article>
  );
}

/**
 * El almacén: una fila por recambio con el stock como dato grande y, para quien puede editar,
 * «Añadir recambio» arriba y un formulario plegado («Editar») en cada fila. Quien no puede editar
 * solo lee: no hay ni un campo en la lista.
 */
export function ListaRecambios({ recambios, puedeEditar, accionGuardar }: PropsLista) {
  return (
    <div className="flex flex-col gap-e5">
      {puedeEditar && (
        <div className="max-w-lectura">
          <Plegable titulo="Añadir recambio">
            <FormularioRecambio accion={accionGuardar} />
          </Plegable>
        </div>
      )}
      {recambios.length === 0 ? (
        <EstadoVacio texto="El almacén está vacío" />
      ) : (
        <ul className="grid items-start gap-e4 lg:grid-cols-2 xl:grid-cols-3">
          {ordenados(recambios).map((recambio) => (
            <li key={recambio.id}>
              <FilaDeRecambio
                recambio={recambio}
                accionGuardar={accionGuardar}
                puedeEditar={puedeEditar}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
