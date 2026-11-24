import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BotonDeEnvio } from './BotonDeEnvio';

afterEach(cleanup);

const enviar = () => screen.getByRole('button', { name: 'Enviar' });
const estaDesactivado = () => enviar().hasAttribute('disabled');

// Una acción que no acaba hasta que el test lo decide. Cada test acaba la suya: React junta las
// acciones asíncronas que siguen en marcha, y una que no termina nunca dejaría al botón de los
// tests siguientes sin volver a activarse.
function accionControlada() {
  let acabar: () => void = () => undefined;
  const accion = vi.fn(() => new Promise<void>((resolver) => (acabar = resolver)));
  return { accion, acabar: () => act(async () => acabar()) };
}

function dibujarEnFormulario(accion: () => Promise<void>) {
  render(
    <form action={accion}>
      <BotonDeEnvio>Enviar</BotonDeEnvio>
    </form>,
  );
}

// El formulario en pantalla y ya enviado: el botón está en pleno envío, con la acción en marcha.
async function formularioEnviandose() {
  const controlada = accionControlada();
  dibujarEnFormulario(controlada.accion);
  fireEvent.click(enviar());
  await waitFor(() => expect(estaDesactivado()).toBe(true));
  return controlada;
}

describe('BotonDeEnvio', () => {
  it('[D-13] antes de enviar está activo y mientras la acción se ejecuta queda desactivado', async () => {
    const { accion, acabar } = accionControlada();
    dibujarEnFormulario(accion);
    expect(estaDesactivado()).toBe(false);

    fireEvent.click(enviar());

    await waitFor(() => expect(estaDesactivado()).toBe(true));
    await acabar();
  });

  it('[D-13] un segundo toque mientras envía no lanza la acción otra vez', async () => {
    const { accion, acabar } = await formularioEnviandose();

    fireEvent.click(enviar());

    expect(accion).toHaveBeenCalledTimes(1);
    await acabar();
  });

  it('[D-13] al terminar la acción vuelve a estar activo', async () => {
    const { acabar } = await formularioEnviandose();

    await acabar();

    await waitFor(() => expect(estaDesactivado()).toBe(false));
  });

  it('[D-13] es un botón de FOSO que envía: mide al menos --toque y toma la variante y las clases que se le dan', () => {
    render(
      <form>
        <BotonDeEnvio variante="secundario" className="w-full">
          Enviar
        </BotonDeEnvio>
      </form>,
    );

    expect(enviar().getAttribute('type')).toBe('submit');
    expect([...enviar().classList]).toEqual(
      expect.arrayContaining(['min-h-toque', 'bg-chapa-alta', 'w-full']),
    );
  });
});
