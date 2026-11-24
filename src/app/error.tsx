'use client';

import { Boton } from '@/ui/Boton';
import { salir } from './login/acciones';

// El error.tsx de un segmento no recoge los fallos de su propio layout: el armazón de (taller) y la
// portada solo tienen esta pantalla por encima. En producción Next no manda el mensaje de un fallo
// de servidor (llega vacío, con un resumen), así que aquí no se repite: se dice qué hacer. «Salir»
// está porque quien tiene cuenta pero ningún taller nunca llega al armazón que trae ese botón, y
// mientras tenga la sesión /login lo devuelve al tablero.
export default function ErrorDeLaApp({ retry }: { error: unknown; retry: () => void }) {
  return (
    <main className="flex min-h-dvh flex-col">
      <div aria-hidden="true" className="franja-seguridad" />
      <div className="flex flex-1 flex-col justify-center gap-e5 px-e4 py-e8 lg:px-e5">
        <h1 className="font-titular text-portada font-supernegra tracking-titular uppercase">
          Algo ha fallado
        </h1>
        <p className="max-w-lectura text-mayor leading-texto text-acero">
          Vuelve a intentarlo. Si sigue pasando, sal y entra de nuevo.
        </p>
        <div className="flex flex-col gap-e3 lg:flex-row">
          <Boton onClick={retry}>Reintentar</Boton>
          <form action={salir} className="flex">
            <Boton type="submit" variante="secundario" className="flex-1">
              Salir
            </Boton>
          </form>
        </div>
      </div>
    </main>
  );
}
