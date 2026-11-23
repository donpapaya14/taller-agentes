import Link from 'next/link';
import type { CSSProperties } from 'react';
import { Boton, clasesDeBoton } from '../Boton';
import { IconoAvanzar, IconoLlave } from '../iconos';
import { Matricula } from '../Matricula';

export type EstadoOrden = 'recibido' | 'en_reparacion' | 'listo' | 'entregado';

// El tipo vive aquí y Tablero.tsx lo reexporta: así la tarjeta no importa del tablero y no hay ciclo.
export type OrdenTablero = {
  id: string;
  matricula: string;
  vehiculo: string;
  cliente: string;
  estado: EstadoOrden;
  descripcion: string;
};

export type AccionAvanzar = (datos: FormData) => void | Promise<void>;

type PropsTarjeta = {
  orden: OrdenTablero;
  puedeEntregar: boolean;
  accionAvanzar?: AccionAvanzar;
  /** Turno de la tarjeta en la entrada escalonada del tablero. */
  turno: number;
};

// Texto del botón que lleva la orden a su estado siguiente. Una orden lista no avanza desde el
// tablero: se entrega en su ficha. Una entregada ya no cambia.
const AVANCE: Partial<Record<EstadoOrden, string>> = {
  recibido: 'Pasar a en reparación',
  en_reparacion: 'Pasar a listo',
};

const fichaDe = (id: string) => `/ordenes/${id}`;

function AccionDeLaOrden({ orden, puedeEntregar, accionAvanzar }: Omit<PropsTarjeta, 'turno'>) {
  const avance = AVANCE[orden.estado];
  if (avance) {
    return (
      <form action={accionAvanzar}>
        <input type="hidden" name="id" value={orden.id} />
        <input type="hidden" name="de" value={orden.estado} />
        <Boton type="submit" variante="secundario" className="w-full">
          {avance}
          <IconoAvanzar className="size-e5 shrink-0 text-lampara group-hover:text-foso" />
        </Boton>
      </form>
    );
  }
  if (orden.estado === 'listo' && puedeEntregar) {
    return (
      <Link href={fichaDe(orden.id)} className={`${clasesDeBoton('principal')} w-full`}>
        Entregar
        <IconoLlave className="size-e5 shrink-0" />
      </Link>
    );
  }
  return null;
}

export function TarjetaOrden({ orden, puedeEntregar, accionAvanzar, turno }: PropsTarjeta) {
  return (
    <article
      className="entra-del-foso flex flex-col gap-e4 rounded-pieza border border-raya bg-chapa p-e4"
      style={{ '--turno': turno } as CSSProperties}
    >
      <h3>
        {/* El enlace no pasa del ancho de la tarjeta; la placa recorta lo que no cabe. */}
        <Link
          href={fichaDe(orden.id)}
          className="enlace-placa inline-flex max-w-full rounded-placa"
        >
          <Matricula texto={orden.matricula} />
        </Link>
      </h3>
      {/* Una palabra sin espacios (una URL, un correo) se parte en vez de ensanchar la tarjeta. */}
      <div className="flex flex-col gap-e1 wrap-anywhere">
        <p className="font-seminegra text-hueso">{orden.vehiculo}</p>
        <p className="text-menor text-acero">{orden.descripcion}</p>
        <p className="text-menor text-acero">{orden.cliente}</p>
      </div>
      <AccionDeLaOrden orden={orden} puedeEntregar={puedeEntregar} accionAvanzar={accionAvanzar} />
    </article>
  );
}
