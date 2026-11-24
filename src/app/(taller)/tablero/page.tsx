import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { listarOrdenes } from '@/adaptadores/supabase/ordenes';
import type { OrdenResumen } from '@/adaptadores/supabase/filas';
import { listarRecambios } from '@/adaptadores/supabase/recambios';
import { leerSesion } from '@/adaptadores/supabase/sesion';
import { puede, type Rol } from '@/nucleo/permisos';
import { bajoMinimo } from '@/nucleo/stock';
import { Aviso } from '@/ui/Aviso';
import { clasesDeBoton } from '@/ui/Boton';
import { IconoAvanzar } from '@/ui/iconos';
import { Tablero, type OrdenTablero } from '@/ui/tablero/Tablero';
import { leerAviso } from '../aviso';
import { avanzarOrden } from './acciones';

export const metadata: Metadata = { title: 'Tablero · FOSO' };

const aTarjeta = ({
  id,
  matricula,
  vehiculo,
  cliente,
  estado,
  descripcion,
}: OrdenResumen): OrdenTablero => ({ id, matricula, vehiculo, cliente, estado, descripcion });

// Solo quien puede editar el almacén necesita saber qué se está acabando: a los demás ni se les
// piden los recambios.
async function recambiosBajoMinimo(rol: Rol): Promise<number> {
  if (!puede(rol, 'editar_recambios')) return 0;
  const recambios = await listarRecambios();
  return recambios.filter((recambio) => bajoMinimo(recambio)).length;
}

function AvisoDeAlmacen({ cantidad }: { cantidad: number }) {
  if (cantidad === 0) return null;
  return (
    <Link
      href="/recambios"
      className="inline-flex min-h-toque items-center rounded-pieza border border-ambar bg-chapa px-e4 text-menor font-seminegra text-ambar"
    >
      {cantidad} {cantidad === 1 ? 'recambio' : 'recambios'} bajo mínimo
    </Link>
  );
}

export default async function PaginaDelTablero() {
  const sesion = await leerSesion();
  if (sesion === null) redirect('/login');

  const [ordenes, enMinimos, aviso] = await Promise.all([
    listarOrdenes(),
    recambiosBajoMinimo(sesion.rol),
    leerAviso(),
  ]);

  return (
    <main className="flex flex-1 flex-col">
      <header className="flex flex-col gap-e5 px-e4 pt-e7 pb-e6 xl:px-e5">
        <h1 className="font-titular text-portada font-supernegra uppercase">Tablero</h1>
        <div className="flex flex-wrap items-center gap-e4">
          <Link href="/ordenes/nueva" className={clasesDeBoton('principal')}>
            Nueva orden
            <IconoAvanzar className="size-e5 shrink-0" />
          </Link>
          <AvisoDeAlmacen cantidad={enMinimos} />
        </div>
      </header>
      {aviso !== null && (
        <div className="px-e4 pb-e5 xl:px-e5">
          <Aviso tipo={aviso.tipo} texto={aviso.texto} />
        </div>
      )}
      <Tablero
        ordenes={ordenes.map(aTarjeta)}
        puedeEntregar={puede(sesion.rol, 'entregar_orden')}
        accionAvanzar={avanzarOrden}
      />
    </main>
  );
}
