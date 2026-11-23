import { EstadoVacio } from '../EstadoVacio';
import { IconoDespliegue } from '../iconos';

// Lo que esta línea dibuja de cada feature y de cada ronda. Son tipos propios porque src/ui no
// importa de los adaptadores; FeatureConRondas, que /proceso lee del disco, los cumple tal cual.
type FalloVista = { directriz: string; archivo: string; descripcion: string; evidencia: string };

type RondaVista = {
  ronda: number;
  fecha: string;
  commitRevisado: string;
  veredicto: 'PASA' | 'FALLA';
  fallos: FalloVista[];
};

type FeatureVista = { titulo: string; resumen: string; rondas: RondaVista[] };

const LARGO_DEL_COMMIT_CORTO = 7;

// El color del veredicto es el del testigo del salpicadero: verde si pasa, rojo si falla.
const VEREDICTO = {
  PASA: { texto: 'text-testigo', banda: 'bg-testigo' },
  FALLA: { texto: 'text-averia', banda: 'bg-averia' },
} as const;

// Una ronda puede fallar por un comando en rojo sin ningún fallo detallado: entonces no cuenta cero.
function textoDelVeredicto({ veredicto, fallos }: RondaVista): string {
  if (veredicto === 'PASA') return 'Pasa';
  if (fallos.length === 0) return 'Falla';
  return fallos.length === 1 ? '1 fallo' : `${fallos.length} fallos`;
}

function FalloDeRonda({ fallo }: { fallo: FalloVista }) {
  return (
    <li className="flex flex-col gap-e3">
      <div className="flex flex-wrap items-baseline gap-x-e3 gap-y-e1">
        <span className="rounded-pieza border border-raya px-e2 font-dato text-nota font-seminegra tracking-dato text-hueso">
          {fallo.directriz}
        </span>
        <span className="font-dato text-nota text-acero wrap-anywhere">{fallo.archivo}</span>
      </div>
      <p className="text-menor text-hueso wrap-anywhere">{fallo.descripcion}</p>
      <p className="rounded-pieza bg-foso p-e3 font-dato text-nota whitespace-pre-wrap text-hueso wrap-anywhere">
        {fallo.evidencia}
      </p>
    </li>
  );
}

type PropsPieza = { ronda: RondaVista; urlRepo: string };

// Cada ronda es un <details> nativo: se abre con el teclado y sin JavaScript. Abierta, ocupa toda
// la fila de su línea (globals.css) para que la evidencia no se apriete en el ancho de una pieza.
function PiezaDeRonda({ ronda, urlRepo }: PropsPieza) {
  const { texto, banda } = VEREDICTO[ronda.veredicto];
  const commit = ronda.commitRevisado;

  return (
    <details className="group rounded-pieza border border-raya bg-chapa open:border-acero hover:border-acero">
      <summary className="flex min-h-toque cursor-pointer items-stretch gap-e3 pr-e3">
        <span aria-hidden="true" className={`w-e2 shrink-0 ${banda}`} />
        <span className="flex min-w-0 flex-1 flex-col justify-center py-e2">
          <span className="font-dato text-nota tracking-dato text-acero uppercase">
            Ronda {ronda.ronda}
          </span>{' '}
          <span
            className={`font-titular text-columna font-negra tracking-titular uppercase ${texto}`}
          >
            {textoDelVeredicto(ronda)}
          </span>
        </span>
        <IconoDespliegue className="size-e5 shrink-0 self-center text-acero transition-transform group-open:rotate-90 motion-reduce:transition-none" />
      </summary>
      <div className="flex flex-col gap-e5 border-t border-raya p-e4">
        {ronda.fallos.length > 0 && (
          <ul className="flex flex-col gap-e5">
            {ronda.fallos.map((fallo, indice) => (
              <FalloDeRonda key={`${fallo.directriz}-${fallo.archivo}-${indice}`} fallo={fallo} />
            ))}
          </ul>
        )}
        <p className="font-dato text-nota text-acero wrap-anywhere">
          Commit revisado{' '}
          <a
            href={`${urlRepo}/commit/${commit}`}
            className="text-lampara underline underline-offset-4"
          >
            {commit.slice(0, LARGO_DEL_COMMIT_CORTO)}
          </a>{' '}
          · {ronda.fecha}
        </p>
      </div>
    </details>
  );
}

/** La feature y, al lado, una pieza por cada ronda de revisión que ha tenido, en orden. */
export function LineaDeRondas({ feature, urlRepo }: { feature: FeatureVista; urlRepo: string }) {
  return (
    <article className="grid gap-e5 lg:grid-cols-3 lg:gap-e6">
      <header className="flex flex-col gap-e2">
        <h3 className="font-titular text-columna font-negra tracking-titular uppercase">
          {feature.titulo}
        </h3>
        <p className="text-menor text-acero">{feature.resumen}</p>
      </header>
      <div className="lg:col-span-2">
        {feature.rondas.length === 0 ? (
          <EstadoVacio texto="Todavía sin revisar" />
        ) : (
          <ol className="rondas">
            {feature.rondas.map((ronda) => (
              <li key={ronda.ronda}>
                <PiezaDeRonda ronda={ronda} urlRepo={urlRepo} />
              </li>
            ))}
          </ol>
        )}
      </div>
    </article>
  );
}
