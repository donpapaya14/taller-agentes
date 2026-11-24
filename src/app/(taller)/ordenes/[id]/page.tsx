import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import type { OrdenDetalle, Recambio } from '@/adaptadores/supabase/filas';
import { leerOrden } from '@/adaptadores/supabase/ordenes';
import { listarRecambios } from '@/adaptadores/supabase/recambios';
import { leerSesion, type Sesion } from '@/adaptadores/supabase/sesion';
import { calcularTotales } from '@/nucleo/importe';
import { puede } from '@/nucleo/permisos';
import { enlaceAviso } from '@/nucleo/whatsapp';
import { Aviso } from '@/ui/Aviso';
import { AccionesOrden } from '@/ui/ordenes/AccionesOrden';
import { AnadirRecambio } from '@/ui/ordenes/AnadirRecambio';
import { CabeceraOrden } from '@/ui/ordenes/CabeceraOrden';
import { CambioDeEstado } from '@/ui/ordenes/CambioDeEstado';
import { LineasOrden } from '@/ui/ordenes/LineasOrden';
import { ManoDeObra } from '@/ui/ordenes/ManoDeObra';
import { Totales } from '@/ui/ordenes/Totales';
import { leerAviso } from '../../aviso';
import {
  anadirRecambio,
  cambiarCantidadDeLinea,
  entregarOrden,
  guardarMinutos,
  moverEstado,
  quitarRecambio,
} from './acciones';

export const metadata: Metadata = { title: 'Orden · FOSO' };

const TITULO_DE_SECCION = 'font-titular text-mayor font-negra tracking-titular uppercase';

// Una orden entregada es definitiva: se mira, no se toca.
const admiteCambios = (orden: OrdenDetalle) => orden.estado !== 'entregado';

function SeccionDeRecambios(props: {
  orden: OrdenDetalle;
  recambios: Recambio[];
  verImportes: boolean;
}) {
  const { orden, recambios, verImportes } = props;
  // Una línea por recambio: el que ya está en la orden se cambia de cantidad, no se vuelve a añadir.
  const porAnadir = recambios.filter(
    ({ id }) => !orden.lineas.some(({ recambioId }) => recambioId === id),
  );

  return (
    <section aria-labelledby="titulo-recambios" className="flex flex-col gap-e4">
      <h2 id="titulo-recambios" className={TITULO_DE_SECCION}>
        Recambios
      </h2>
      {admiteCambios(orden) ? (
        <LineasOrden
          lineas={orden.lineas}
          verImportes={verImportes}
          editable
          accionCantidad={cambiarCantidadDeLinea}
          accionQuitar={quitarRecambio}
        />
      ) : (
        <LineasOrden lineas={orden.lineas} verImportes={verImportes} editable={false} />
      )}
      {admiteCambios(orden) && (
        <AnadirRecambio ordenId={orden.id} recambios={porAnadir} accion={anadirRecambio} />
      )}
    </section>
  );
}

function SeccionDeManoDeObra({ orden }: { orden: OrdenDetalle }) {
  return (
    <section aria-labelledby="titulo-mano-de-obra" className="flex flex-col gap-e4">
      <h2 id="titulo-mano-de-obra" className={TITULO_DE_SECCION}>
        Mano de obra
      </h2>
      {admiteCambios(orden) ? (
        <ManoDeObra ordenId={orden.id} minutos={orden.manoObraMinutos} accion={guardarMinutos} />
      ) : (
        <p className="font-dato text-menor text-hueso">{orden.manoObraMinutos} min</p>
      )}
    </section>
  );
}

function ImportesDeLaOrden({ orden }: { orden: OrdenDetalle }) {
  const { baseCentimos, ivaCentimos, totalCentimos } = calcularTotales(
    orden.lineas,
    orden.manoObraMinutos,
    orden.precioHoraCentimos,
  );
  return <Totales base={baseCentimos} iva={ivaCentimos} total={totalCentimos} />;
}

function AccionesDeLaFicha({ orden, sesion }: { orden: OrdenDetalle; sesion: Sesion }) {
  const facturada = orden.estado === 'entregado' && orden.numeroFactura !== null;
  const enlaceWhatsapp = enlaceAviso({
    telefono: orden.clienteTelefono,
    taller: sesion.taller,
    matricula: orden.matricula,
    estado: orden.estado,
  });

  return (
    <AccionesOrden
      ordenId={orden.id}
      enlaceWhatsapp={enlaceWhatsapp}
      tipoDocumento={facturada ? 'factura' : 'presupuesto'}
      puedeVerDocumento={puede(sesion.rol, 'ver_importes')}
      puedeEntregar={puede(sesion.rol, 'entregar_orden') && orden.estado === 'listo'}
      accionEntregar={entregarOrden}
    />
  );
}

// Los recambios del almacén solo hacen falta para añadir uno: una orden entregada no los pide.
async function cargarFicha(id: string) {
  const orden = await leerOrden(id);
  if (orden === null) notFound();

  const [recambios, aviso] = await Promise.all([
    admiteCambios(orden) ? listarRecambios() : Promise.resolve([]),
    leerAviso(),
  ]);
  return { orden, recambios, aviso };
}

export default async function FichaDeLaOrden({ params }: { params: Promise<{ id: string }> }) {
  const sesion = await leerSesion();
  if (sesion === null) redirect('/login');

  const { orden, recambios, aviso } = await cargarFicha((await params).id);

  return (
    <main className="flex flex-1 flex-col gap-e6 px-e4 py-e6 lg:px-e5">
      {aviso !== null && <Aviso tipo={aviso.tipo} texto={aviso.texto} />}
      <div className="grid gap-e6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start">
        <div className="flex flex-col gap-e6">
          <CabeceraOrden
            matricula={orden.matricula}
            estado={orden.estado}
            numeroFactura={orden.numeroFactura}
            vehiculo={orden.vehiculo}
            cliente={orden.cliente}
            clienteTelefono={orden.clienteTelefono}
            descripcion={orden.descripcion}
          />
          {admiteCambios(orden) && (
            <CambioDeEstado ordenId={orden.id} estado={orden.estado} accion={moverEstado} />
          )}
          <SeccionDeRecambios
            orden={orden}
            recambios={recambios}
            verImportes={puede(sesion.rol, 'ver_importes')}
          />
          <SeccionDeManoDeObra orden={orden} />
        </div>
        <aside className="flex flex-col gap-e5">
          {puede(sesion.rol, 'ver_importes') && <ImportesDeLaOrden orden={orden} />}
          <AccionesDeLaFicha orden={orden} sesion={sesion} />
        </aside>
      </div>
    </main>
  );
}
