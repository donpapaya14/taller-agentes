'use client';

import { Boton } from '@/ui/Boton';

// Next solo enseña el mensaje de un error de servidor en desarrollo: en producción llega vacío y
// con un resumen. Por eso la pantalla no repite el mensaje y deja el camino a seguir. «Reintentar»
// usa `retry`, que vuelve a pedir la pantalla al servidor; `reset` solo repintaría el mismo fallo.
export default function ErrorDelTaller({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <main className="flex flex-1 flex-col items-start justify-center gap-e5 px-e4 py-e8 lg:px-e5">
      <h1 className="font-titular text-columna font-negra tracking-titular uppercase">
        Algo ha fallado al cargar esta pantalla
      </h1>
      <p className="max-w-lectura text-menor text-acero">
        Vuelve a intentarlo. Si sigue pasando, sal y entra de nuevo.
      </p>
      <Boton onClick={retry}>Reintentar</Boton>
    </main>
  );
}
