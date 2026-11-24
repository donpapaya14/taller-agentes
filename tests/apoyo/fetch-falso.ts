// Como el fetch de verdad: no contesta nunca, salvo que lo aborte su señal (también si ya venía
// abortada). Sirve para probar los límites de tiempo sin esperar a que venzan de verdad.
export const fetchQueNuncaResuelve: typeof fetch = (_entrada, opciones) =>
  new Promise((_resolver, rechazar) => {
    const corte = opciones?.signal;
    if (corte?.aborted) rechazar(corte.reason);
    corte?.addEventListener('abort', () => rechazar(corte.reason));
  });
