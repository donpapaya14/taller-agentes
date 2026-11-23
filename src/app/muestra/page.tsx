import type { Metadata } from 'next';
import { Tablero } from '@/ui/tablero/Tablero';
import { MUESTRA } from '@/ui/tablero/muestra';

// Página temporal para el gate de diseño: el tablero con órdenes ficticias dentro del layout
// real. La borra el paso 13, cuando exista /tablero.
export const metadata: Metadata = { title: 'Tablero de muestra · FOSO' };

export default function Muestra() {
  return (
    <main className="flex min-h-dvh flex-col">
      <header className="flex flex-col gap-e2 px-e4 pt-e7 pb-e6 xl:px-e5">
        <h1 className="font-titular text-portada font-supernegra uppercase">Tablero</h1>
        <p className="font-dato text-nota tracking-dato text-acero uppercase">
          Muestra con datos ficticios
        </p>
      </header>
      <Tablero ordenes={MUESTRA} puedeEntregar />
    </main>
  );
}
