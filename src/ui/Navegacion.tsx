'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Rol } from '../nucleo/permisos';
import { IconoRecambios, IconoSalir, IconoTablero } from './iconos';

type PropsNavegacion = {
  taller: string;
  nombre: string;
  rol: Rol;
  accionSalir: () => Promise<void>;
};

const ETIQUETA_ROL: Record<Rol, string> = { jefe: 'Jefe de taller', mecanico: 'Mecánico' };

// La ficha y el alta de una orden cuelgan del tablero: ahí se está cuando se las mira.
const SECCIONES = [
  { href: '/tablero', texto: 'Tablero', prefijos: ['/tablero', '/ordenes'], Icono: IconoTablero },
  { href: '/recambios', texto: 'Recambios', prefijos: ['/recambios'], Icono: IconoRecambios },
];

// Una sección empieza en su ruta entera: /recambios-viejos no es /recambios.
const estaEnLaSeccion = (ruta: string, prefijos: string[]) =>
  prefijos.some((prefijo) => ruta === prefijo || ruta.startsWith(`${prefijo}/`));

/**
 * Cabecera del taller: la marca, quién ha entrado y adónde se puede ir. En móvil los enlaces y
 * «Salir» pasan a una barra fija abajo, con el icono sobre el texto, al alcance del pulgar; desde lg
 * la barra desaparece (display: contents) y sus enlaces quedan en la fila de la cabecera.
 */
export function Navegacion({ taller, nombre, rol, accionSalir }: PropsNavegacion) {
  const ruta = usePathname();

  return (
    <header className="flex flex-wrap items-center gap-x-e5 gap-y-e2 border-b border-raya bg-chapa px-e4 py-e3 lg:px-e5">
      <Link
        href="/tablero"
        className="font-titular text-columna font-supernegra tracking-titular uppercase lg:order-1"
      >
        FOSO
      </Link>
      <div className="min-w-0 flex-1 lg:order-3 lg:ml-auto lg:flex-none lg:text-right">
        <p className="text-nota text-acero wrap-anywhere">{taller}</p>
        <p className="flex flex-wrap items-baseline gap-x-e3 text-menor lg:justify-end">
          <span className="font-seminegra text-hueso wrap-anywhere">{nombre}</span>
          <span className="font-dato text-nota tracking-dato text-acero uppercase">
            {ETIQUETA_ROL[rol]}
          </span>
        </p>
      </div>
      <nav
        aria-label="Principal"
        className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-3 border-t border-raya bg-chapa lg:contents"
      >
        {SECCIONES.map(({ href, texto, prefijos, Icono }) => (
          <Link
            key={href}
            href={href}
            aria-current={estaEnLaSeccion(ruta, prefijos) ? 'page' : undefined}
            className="nav-enlace min-h-toque text-nota font-seminegra lg:order-2"
          >
            <Icono className="size-e5 shrink-0" />
            {texto}
          </Link>
        ))}
        <form action={accionSalir} className="flex lg:order-4">
          <button type="submit" className="nav-enlace min-h-toque flex-1 text-nota font-seminegra">
            <IconoSalir className="size-e5 shrink-0" />
            Salir
          </button>
        </form>
      </nav>
    </header>
  );
}
