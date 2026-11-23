type Agente = { nombre: string; frase: string; archivos: string[] };

const AGENTES: Agente[] = [
  {
    nombre: 'Orquestador',
    frase:
      'Reparte el trabajo en features, encarga cada una y la da por hecha solo cuando Testing la aprueba.',
    archivos: ['CLAUDE.md'],
  },
  {
    nombre: 'Develop',
    frase: 'Escribe primero el test, lo ve fallar y programa lo mínimo para que pase.',
    archivos: ['.claude/agents/develop.md'],
  },
  {
    nombre: 'Testing',
    frase:
      'Revisa el código sin oír a Develop, intenta romperlo y escribe el informe de cada ronda.',
    archivos: ['.claude/agents/testing.md', 'DIRECTRICES.md'],
  },
];

/** Los tres agentes que construyen FOSO, cada uno con una frase y el archivo del repo que lo define. */
export function TresAgentes({ urlRepo }: { urlRepo: string }) {
  return (
    <section aria-labelledby="tres-agentes" className="flex flex-col gap-e5">
      <h2
        id="tres-agentes"
        className="font-titular text-columna font-negra tracking-titular uppercase"
      >
        Los tres agentes
      </h2>
      <ul className="grid gap-e4 lg:grid-cols-3">
        {AGENTES.map(({ nombre, frase, archivos }) => (
          <li key={nombre}>
            <article className="flex h-full flex-col gap-e4 rounded-pieza border border-raya bg-chapa p-e5">
              <span aria-hidden="true" className="h-e1 bg-acero" />
              <h3 className="font-titular text-columna font-negra tracking-titular uppercase">
                {nombre}
              </h3>
              <p className="text-base text-hueso">{frase}</p>
              <ul className="mt-auto flex flex-col gap-e2">
                {archivos.map((archivo) => (
                  <li key={archivo}>
                    <a
                      href={`${urlRepo}/blob/main/${archivo}`}
                      className="font-dato text-nota tracking-dato text-lampara underline underline-offset-4 wrap-anywhere"
                    >
                      {archivo}
                    </a>
                  </li>
                ))}
              </ul>
            </article>
          </li>
        ))}
      </ul>
    </section>
  );
}
