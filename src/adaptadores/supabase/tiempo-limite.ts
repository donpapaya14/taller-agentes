export const LIMITE_MS = 4000;

// Con Supabase caído, supabase-js reintenta unos 25 s antes de fallar. Con este fetch cada llamada
// espera como mucho `ms`. Si quien llama ya trae su señal se respeta: corta lo que ocurra antes.
export function conTiempoLimite(buscar: typeof fetch, ms: number = LIMITE_MS): typeof fetch {
  return (entrada, opciones) => {
    const limite = AbortSignal.timeout(ms);
    const signal = opciones?.signal ? AbortSignal.any([opciones.signal, limite]) : limite;
    return buscar(entrada, { ...opciones, signal });
  };
}

// Lo único que cuenta como «Supabase no contesta»: el corte de arriba y la red que falla. Cualquier
// otro error es un fallo de verdad y quien lo capture debe relanzarlo.
export function esFalloDeRedOTiempo(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const esCorte = error.name === 'TimeoutError' || error.name === 'AbortError';
  return esCorte || (error instanceof TypeError && error.message === 'fetch failed');
}
