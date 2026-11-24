export const LIMITE_MS = 4000;

// Lo que puede durar una operación entera con Supabase (leer la sesión, renovarla), reintentos
// incluidos. Queda por debajo de los 5 s que se le exigen: lo que tarda en volver el control una
// vez vencido el plazo no cuenta dentro de él.
export const PLAZO_TOTAL_MS = 4500;

// Con Supabase caído, supabase-js reintenta unos 25 s antes de fallar. Con este fetch cada llamada
// espera como mucho `ms`, y ninguna sale ni sigue esperando una vez vencido el `plazo` de la
// operación a la que pertenece. Si quien llama ya trae su señal se respeta: corta lo que ocurra antes.
export function conTiempoLimite(
  buscar: typeof fetch,
  ms: number = LIMITE_MS,
  plazo?: AbortSignal,
): typeof fetch {
  return (entrada, opciones) => {
    const cortes = [AbortSignal.timeout(ms), opciones?.signal, plazo].filter(
      (corte) => corte != null,
    );
    return buscar(entrada, { ...opciones, signal: AbortSignal.any(cortes) });
  };
}

// Lo que lanza conPlazoTotal al agotarse el plazo. Se distingue del corte de una sola llamada
// (`TimeoutError`, que supabase-js devuelve como error suyo) para que quien captura sepa que ya
// no queda tiempo para nada más.
export class PlazoVencido extends Error {
  constructor(ms: number) {
    super(`La operación con Supabase no acabó en ${ms} ms`);
    this.name = 'PlazoVencido';
  }
}

// Acotar cada llamada no acota la operación: auth-js reintenta la renovación del token durante
// unos 30 s y duerme entre intento e intento sin mirar ninguna señal, así que abortar sus llamadas
// no acorta la espera. Aquí la espera acaba al vencer `ms` aunque la librería siga por detrás; la
// señal que recibe `operacion` queda abortada, así que ya no vuelve a llamar a Supabase.
export async function conPlazoTotal<T>(
  operacion: (plazo: AbortSignal) => Promise<T>,
  ms: number = PLAZO_TOTAL_MS,
): Promise<T> {
  const corte = new AbortController();
  const vencido = new PlazoVencido(ms);
  let temporizador: ReturnType<typeof setTimeout> | undefined;
  const sinTiempo = new Promise<never>((_resolver, rechazar) => {
    temporizador = setTimeout(() => {
      rechazar(vencido);
      corte.abort(vencido);
    }, ms);
  });
  try {
    return await Promise.race([operacion(corte.signal), sinTiempo]);
  } finally {
    clearTimeout(temporizador);
  }
}

// Lo único que cuenta como «Supabase no contesta»: el corte de arriba y la red que falla. Cualquier
// otro error es un fallo de verdad y quien lo capture debe relanzarlo.
export function esFalloDeRedOTiempo(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const esCorte = error.name === 'TimeoutError' || error.name === 'AbortError';
  return esCorte || (error instanceof TypeError && error.message === 'fetch failed');
}
