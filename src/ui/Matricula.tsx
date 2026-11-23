// Cada orden es su matrícula, dibujada como una placa española: banda azul de la UE a la
// izquierda, placa clara con su filete negro y los caracteres en monoespaciada estrecha.

const TAMANOS = {
  normal: 'gap-e2 text-matricula',
  grande: 'gap-e3 text-matricula-grande',
} as const;

const CARACTERES = {
  normal: 'py-e2 pr-e4',
  grande: 'py-e3 pr-e5',
} as const;

// Redondeo a centésimas para que el SVG no arrastre decimales de coma flotante.
const centesimas = (valor: number) => Math.round(valor * 100) / 100;

// Las doce estrellas de la bandera europea, en círculo sobre la «E» de España.
const ESTRELLAS = Array.from({ length: 12 }, (_, indice) => {
  const angulo = (indice * Math.PI) / 6;
  return { cx: centesimas(8 + 5 * Math.sin(angulo)), cy: centesimas(8.5 - 5 * Math.cos(angulo)) };
});

function BandaEuropea() {
  return (
    <svg
      viewBox="0 0 16 26"
      aria-hidden="true"
      focusable="false"
      className="w-banda shrink-0 self-stretch bg-placa-banda fill-current text-placa"
    >
      {ESTRELLAS.map(({ cx, cy }) => (
        <circle key={`${cx},${cy}`} cx={cx} cy={cy} r="0.95" />
      ))}
      <path d="M5 16h6v1.4H6.6v1.65h3.6v1.4H6.6v1.65H11v1.4H5z" />
    </svg>
  );
}

// Una matrícula mal escrita puede ser más larga que la pantalla: la placa no pasa del ancho de su
// contenedor y recorta los caracteres con puntos suspensivos. El texto entero sigue en el DOM.
export function Matricula({
  texto,
  tamano = 'normal',
}: {
  texto: string;
  tamano?: 'normal' | 'grande';
}) {
  return (
    <span
      className={`matricula inline-flex max-w-full overflow-hidden rounded-placa bg-placa text-placa-texto ${TAMANOS[tamano]}`}
    >
      <BandaEuropea />
      <span className="sr-only">Matrícula </span>
      <span
        className={`matricula-caracteres font-dato font-media tracking-placa truncate ${CARACTERES[tamano]}`}
      >
        {texto}
      </span>
    </span>
  );
}
