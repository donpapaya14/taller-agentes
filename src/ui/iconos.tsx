import type { ReactNode } from 'react';

// Iconos propios en SVG, dibujados a trazo recto como las marcas de una herramienta. Toman el
// color del texto que los rodea y son decorativos: el texto del botón ya dice lo que hacen.

type PropsIcono = { className?: string };

function Icono({ className, children }: PropsIcono & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.25}
      strokeLinecap="square"
      className={className}
    >
      {children}
    </svg>
  );
}

/** Flecha de avanzar una orden a su siguiente estado. */
export function IconoAvanzar(props: PropsIcono) {
  return (
    <Icono {...props}>
      <path d="M3 12h15M13 5.5 19.5 12 13 18.5" />
    </Icono>
  );
}

/** Llave del coche: entregar es devolverle las llaves al cliente. */
export function IconoLlave(props: PropsIcono) {
  return (
    <Icono {...props}>
      <circle cx="7" cy="12" r="4" />
      <path d="M11 12h10M17.5 12v3.5M20.5 12v2.5" />
    </Icono>
  );
}

/** Tres columnas de distinta altura: el tablero de órdenes. */
export function IconoTablero(props: PropsIcono) {
  return (
    <Icono {...props}>
      <path d="M4 4h4v16H4zM10 4h4v10h-4zM16 4h4v13h-4z" />
    </Icono>
  );
}

/** Una caja con su cinta: el almacén de recambios. */
export function IconoRecambios(props: PropsIcono) {
  return (
    <Icono {...props}>
      <path d="M3 8l9-5 9 5v9l-9 5-9-5zM3 8l9 5 9-5M12 13v9" />
    </Icono>
  );
}

/** Una puerta con la flecha saliendo. */
export function IconoSalir(props: PropsIcono) {
  return (
    <Icono {...props}>
      <path d="M10 4H4v16h6M14 8l4 4-4 4M18 12H9" />
    </Icono>
  );
}

/** Punta de flecha que indica que algo se despliega; gira al abrirse. */
export function IconoDespliegue(props: PropsIcono) {
  return (
    <Icono {...props}>
      <path d="M9 5l7 7-7 7" />
    </Icono>
  );
}
