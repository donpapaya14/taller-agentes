type PropsAviso = { tipo: 'ok' | 'error'; texto: string };

// Lo que una acción le cuenta a quien la lanzó. Un error se anuncia como alerta; algo que salió
// bien, como estado, sin interrumpir a quien usa un lector de pantalla.
const ESTILOS = {
  error: { rol: 'alert', clases: 'border-averia text-averia' },
  ok: { rol: 'status', clases: 'border-testigo text-testigo' },
} as const;

export function Aviso({ tipo, texto }: PropsAviso) {
  const { rol, clases } = ESTILOS[tipo];
  return (
    <p role={rol} className={`rounded-pieza border bg-chapa px-e4 py-e3 text-menor ${clases}`}>
      {texto}
    </p>
  );
}
