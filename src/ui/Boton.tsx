import type { ButtonHTMLAttributes } from 'react';

type Variante = 'principal' | 'secundario' | 'peligro';

// Todo botón de acción mide al menos --toque de alto. El secundario es chapa apagada que se
// enciende con la luz de la lámpara al pasar por encima; el principal ya está encendido. Un botón
// desactivado es chapa y acero (acero sobre chapa es un par que mide el test de contraste): sin
// color de acción, con el cursor de «no» y sin encenderse al pasar por encima, que por eso solo
// se aplica a lo que no está desactivado.
const BASE =
  'group inline-flex min-h-toque items-center justify-between gap-e3 rounded-pieza border px-e4 py-e2 text-left font-texto text-base font-seminegra transition-colors motion-reduce:transition-none disabled:cursor-not-allowed disabled:border-raya disabled:bg-chapa disabled:text-acero';

const VARIANTES: Record<Variante, string> = {
  principal:
    'border-lampara bg-lampara text-foso not-disabled:hover:bg-foso not-disabled:hover:text-lampara',
  secundario:
    'border-raya bg-chapa-alta text-hueso not-disabled:hover:border-lampara not-disabled:hover:bg-lampara not-disabled:hover:text-foso',
  peligro: 'border-averia bg-chapa text-averia',
};

/** Clases de un botón de FOSO; sirven también para un enlace que se ve como botón. */
export function clasesDeBoton(variante: Variante): string {
  return `${BASE} ${VARIANTES[variante]}`;
}

export function Boton({
  variante = 'principal',
  className,
  type = 'button',
  ...resto
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante }) {
  const clases = [clasesDeBoton(variante), className].filter(Boolean).join(' ');
  return <button type={type} className={clases} {...resto} />;
}
