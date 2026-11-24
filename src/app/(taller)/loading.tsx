// Mientras la pantalla pide sus datos: una plaza del foso vacía y el aviso, sin animación.
export default function CargandoElTaller() {
  return (
    <main className="flex flex-1 items-center justify-center px-e4 py-e8">
      <p
        role="status"
        className="rounded-pieza border border-dashed border-raya px-e5 py-e6 font-dato text-menor tracking-dato text-acero uppercase"
      >
        Cargando el taller…
      </p>
    </main>
  );
}
