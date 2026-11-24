import { redirect } from 'next/navigation';
import type { Recambio } from '@/adaptadores/supabase/filas';
import { listarRecambios } from '@/adaptadores/supabase/recambios';
import { leerSesion } from '@/adaptadores/supabase/sesion';
import { formatearEuros } from '@/nucleo/importe';
import { puede } from '@/nucleo/permisos';
import { bajoMinimo } from '@/nucleo/stock';
import { ListaRecambios, type RecambioVista } from '@/ui/recambios/ListaRecambios';
import { guardar } from './acciones';

// El precio solo se dibuja para quien puede ver importes: al resto le llega null y la lista no lo
// pinta. Si un recambio está bajo mínimo lo decide el núcleo.
function aVista(recambio: Recambio, verImportes: boolean): RecambioVista {
  return {
    id: recambio.id,
    referencia: recambio.referencia,
    nombre: recambio.nombre,
    precio: verImportes ? formatearEuros(recambio.precioCentimos) : null,
    stock: recambio.stock,
    stockMinimo: recambio.stockMinimo,
    bajoMinimo: bajoMinimo(recambio),
  };
}

// Sin sesión no se pide ni se pinta nada: el proxy orienta, pero no es la barrera. Si los recambios
// no se pueden leer, el error sube a la pantalla de error del taller (error.tsx) y mientras tanto
// se ve su loading.tsx.
export default async function PaginaDeRecambios() {
  const sesion = await leerSesion();
  if (sesion === null) redirect('/login');

  const recambios = await listarRecambios();
  const verImportes = puede(sesion.rol, 'ver_importes');

  return (
    <main className="flex flex-1 flex-col gap-e5 px-e4 pt-e5 pb-e7 lg:px-e5">
      <h1 className="font-titular text-columna font-negra tracking-titular uppercase">Almacén</h1>
      <ListaRecambios
        recambios={recambios.map((recambio) => aVista(recambio, verImportes))}
        puedeEditar={puede(sesion.rol, 'editar_recambios')}
        accionGuardar={guardar}
      />
    </main>
  );
}
