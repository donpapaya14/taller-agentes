import type { Metadata } from 'next';
import Link from 'next/link';
import path from 'node:path';
import { leerProceso, resumir, type ResumenProceso } from '@/adaptadores/proceso/leer-rondas';
import { clasesDeBoton } from '@/ui/Boton';
import { IconoAvanzar } from '@/ui/iconos';
import { LineaDeRondas } from '@/ui/proceso/LineaDeRondas';
import { TresAgentes } from '@/ui/proceso/TresAgentes';

// Estática: las rondas se leen de la carpeta proceso/ al compilar y la página sale ya hecha. Un
// archivo de ronda mal formado rompe el build en vez de enseñar datos a medias.
export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'Cómo se construyó · FOSO',
  description:
    'Quién reparte, quién programa y quién revisa FOSO, con los informes de cada revisión.',
};

const URL_REPO = 'https://github.com/donpapaya14/taller-agentes';

// Cada cifra con su palabra va unida con espacios duros: la línea solo se parte entre cifras.
const ESPACIO_DURO = '\u00A0';

const unidades = (cantidad: number, singular: string, plural: string) =>
  [cantidad, cantidad === 1 ? singular : plural].join(ESPACIO_DURO);

function lineaDeCifras({ features, rondas, fallosCorregidos }: ResumenProceso): string {
  const corregidos = fallosCorregidos === 1 ? 'corregido' : 'corregidos';
  return [
    unidades(features, 'feature', 'features'),
    unidades(rondas, 'ronda', 'rondas'),
    [unidades(fallosCorregidos, 'fallo', 'fallos'), corregidos].join(ESPACIO_DURO),
  ].join(' · ');
}

function Cabecera() {
  return (
    <header className="flex flex-col gap-e6">
      <nav aria-label="Navegación pública" className="flex items-center justify-between gap-e4">
        <Link
          href="/"
          className="font-titular text-mayor font-supernegra tracking-titular uppercase"
        >
          FOSO
        </Link>
        <Link href="/login" className={clasesDeBoton('secundario')}>
          Entrar
          <IconoAvanzar className="size-e5 shrink-0 text-lampara group-hover:text-foso" />
        </Link>
      </nav>
      <h1 className="font-titular text-portada font-supernegra tracking-titular uppercase">
        Cómo se construyó
      </h1>
      <p className="max-w-lectura text-mayor leading-texto text-hueso">
        Un orquestador reparte el trabajo, un agente Develop programa con el test primero y un
        agente Testing revisa sin oír sus explicaciones. Lo de abajo son los informes reales de cada
        revisión, tal como los escribió Testing.
      </p>
    </header>
  );
}

export default function Proceso() {
  const features = leerProceso(path.join(process.cwd(), 'proceso'));

  return (
    <div className="flex min-h-dvh flex-col">
      <div aria-hidden="true" className="franja-seguridad" />
      <main className="flex flex-col gap-e7 px-e4 pt-e5 pb-e8 lg:px-e5">
        <Cabecera />
        <TresAgentes urlRepo={URL_REPO} />
        <section aria-labelledby="rondas" className="flex flex-col gap-e5">
          <h2
            id="rondas"
            className="font-titular text-columna font-negra tracking-titular uppercase"
          >
            Las rondas de revisión
          </h2>
          <p className="border-y border-raya py-e4 font-dato text-menor leading-texto tracking-dato lg:text-mayor">
            {lineaDeCifras(resumir(features))}
          </p>
          <ol className="flex flex-col divide-y divide-raya">
            {features.map((feature) => (
              <li key={feature.id} className="py-e6 first:pt-e4 last:pb-0">
                <LineaDeRondas feature={feature} urlRepo={URL_REPO} />
              </li>
            ))}
          </ol>
        </section>
      </main>
    </div>
  );
}
