import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ErrorDeEntorno } from '@/adaptadores/supabase/entorno';
import { leerSesion } from '@/adaptadores/supabase/sesion';
import { clasesDeBoton } from '@/ui/Boton';
import { IconoAvanzar } from '@/ui/iconos';

// La portada depende de quién la pide. Sin esto, un build sin las variables de Supabase la dejaría
// hecha para todos: el error de entorno se traga más abajo antes de leer las cookies y Next no la
// marcaría como dinámica.
export const dynamic = 'force-dynamic';

// Sin las variables de Supabase no se sabe quién entra, pero la portada es pública y el proxy ya la
// deja pasar en ese caso: se sirve igual, como a cualquier visitante. Cualquier otro fallo se ve: lo
// recoge src/app/error.tsx.
async function hayUsuario(): Promise<boolean> {
  try {
    return (await leerSesion()) !== null;
  } catch (error) {
    if (error instanceof ErrorDeEntorno) return false;
    throw error;
  }
}

export default async function Inicio() {
  if (await hayUsuario()) redirect('/tablero');

  return (
    <main className="flex min-h-dvh flex-col">
      <div aria-hidden="true" className="franja-seguridad" />
      <div className="flex flex-1 flex-col justify-end gap-e6 px-e4 pt-e8 pb-e7 lg:px-e5">
        <h1 className="font-titular text-marca font-supernegra tracking-titular uppercase">FOSO</h1>
        <p className="max-w-lectura text-mayor leading-texto text-hueso">
          Gestión de taller: órdenes, recambios y facturas. La construyeron tres agentes.
        </p>
        <div className="flex flex-col gap-e3 lg:flex-row">
          <Link href="/login" className={clasesDeBoton('principal')}>
            Entrar
            <IconoAvanzar className="size-e5 shrink-0" />
          </Link>
          <Link href="/proceso" className={clasesDeBoton('secundario')}>
            Cómo se construyó
            <IconoAvanzar className="size-e5 shrink-0 text-lampara group-hover:text-foso" />
          </Link>
        </div>
      </div>
    </main>
  );
}
