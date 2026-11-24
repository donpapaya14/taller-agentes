import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { listarVehiculos } from '@/adaptadores/supabase/ordenes';
import { leerSesion } from '@/adaptadores/supabase/sesion';
import { FormularioOrden } from '@/ui/ordenes/FormularioOrden';
import { crearOrdenAccion } from './acciones';

export const metadata: Metadata = { title: 'Nueva orden · FOSO' };

export default async function PaginaDeNuevaOrden() {
  const sesion = await leerSesion();
  if (sesion === null) redirect('/login');

  const vehiculos = await listarVehiculos();

  return (
    <main className="flex flex-1 flex-col gap-e6 px-e4 py-e7 lg:px-e5">
      <h1 className="font-titular text-columna font-negra tracking-titular uppercase">
        Nueva orden
      </h1>
      <FormularioOrden vehiculos={vehiculos} accion={crearOrdenAccion} />
    </main>
  );
}
