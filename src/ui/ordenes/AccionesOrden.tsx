import { Boton, clasesDeBoton } from '../Boton';
import { IconoAvanzar, IconoLlave } from '../iconos';

type PropsAcciones = {
  ordenId: string;
  /** Dirección de wa.me con el aviso ya escrito; null si el cliente no tiene un teléfono válido. */
  enlaceWhatsapp: string | null;
  tipoDocumento: 'presupuesto' | 'factura';
  puedeVerDocumento: boolean;
  puedeEntregar: boolean;
  accionEntregar: (datos: FormData) => Promise<void>;
};

const SIN_TELEFONO = 'El cliente no tiene un teléfono válido';
const ID_DEL_MOTIVO = 'sin-telefono';

const ICONO = 'size-e5 shrink-0 text-lampara group-hover:text-foso';

// Un enlace a otra pestaña no deja a la página nueva el control de la ventana que la abrió.
const EN_OTRA_PESTANA = { target: '_blank', rel: 'noopener noreferrer' } as const;

function AvisoPorWhatsapp({ enlace }: { enlace: string | null }) {
  if (enlace === null) {
    return (
      <>
        <button
          type="button"
          disabled
          aria-describedby={ID_DEL_MOTIVO}
          className={clasesDeBoton('secundario')}
        >
          Avisar por WhatsApp
        </button>
        <p id={ID_DEL_MOTIVO} className="text-menor text-acero">
          {SIN_TELEFONO}
        </p>
      </>
    );
  }
  return (
    <a href={enlace} {...EN_OTRA_PESTANA} className={clasesDeBoton('secundario')}>
      Avisar por WhatsApp
      <IconoAvanzar className={ICONO} />
    </a>
  );
}

function Entrega({ ordenId, accion }: { ordenId: string; accion: PropsAcciones['accionEntregar'] }) {
  return (
    <form action={accion} className="flex flex-col gap-e3 border-t border-raya pt-e5">
      <input type="hidden" name="id" value={ordenId} />
      <p className="max-w-lectura text-menor text-acero">
        Se descontarán los recambios del almacén y se emitirá la factura
      </p>
      <Boton type="submit">
        Entregar
        <IconoLlave className="size-e5 shrink-0" />
      </Boton>
    </form>
  );
}

/**
 * Lo que se hace con la orden fuera de las líneas: avisar al cliente, sacar el documento y
 * entregarla. Cada acción aparece solo para quien puede hacerla; la base de datos lo exige igual.
 */
export function AccionesOrden({
  ordenId,
  enlaceWhatsapp,
  tipoDocumento,
  puedeVerDocumento,
  puedeEntregar,
  accionEntregar,
}: PropsAcciones) {
  return (
    <div className="flex flex-col gap-e3">
      <AvisoPorWhatsapp enlace={enlaceWhatsapp} />
      {puedeVerDocumento && (
        <a
          href={`/ordenes/${ordenId}/documento`}
          {...EN_OTRA_PESTANA}
          className={clasesDeBoton('secundario')}
        >
          Descargar {tipoDocumento}
          <IconoAvanzar className={ICONO} />
        </a>
      )}
      {puedeEntregar && <Entrega ordenId={ordenId} accion={accionEntregar} />}
    </div>
  );
}
