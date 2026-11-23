import Link from 'next/link';
import { clasesDeBoton } from '@/ui/Boton';
import { IconoAvanzar } from '@/ui/iconos';

// Next sirve esta pantalla para cualquier dirección que no existe, también las de una orden ajena
// o borrada: sin ella saldría el 404 de fábrica, en inglés y sobre fondo blanco. El titular es corto
// a propósito: en el cuerpo de portada, una palabra de once letras no cabe en un móvil de 320 px.
export default function NoEncontrada() {
  return (
    <main className="flex min-h-dvh flex-col">
      <div aria-hidden="true" className="franja-seguridad" />
      <div className="flex flex-1 flex-col justify-center gap-e5 px-e4 py-e8 lg:px-e5">
        <h1 className="font-titular text-portada font-supernegra tracking-titular uppercase">
          Esa página no existe
        </h1>
        <p className="max-w-lectura text-mayor leading-texto text-acero">
          Puede que la dirección esté mal escrita o que el enlace ya no sirva.
        </p>
        <Link href="/" className={`${clasesDeBoton('principal')} w-full lg:w-auto lg:self-start`}>
          Volver al inicio
          <IconoAvanzar className="size-e5 shrink-0" />
        </Link>
      </div>
    </main>
  );
}
