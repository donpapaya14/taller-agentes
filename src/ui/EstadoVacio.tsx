/** Lo que enseña una lista sin elementos: el hueco vacío, como una plaza pintada sin coche. */
export function EstadoVacio({ texto }: { texto: string }) {
  return (
    <p className="rounded-pieza border border-dashed border-raya px-e4 py-e7 text-center text-menor text-acero">
      {texto}
    </p>
  );
}
