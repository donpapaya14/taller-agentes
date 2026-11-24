import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Suspense } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { entrar, entrarComoDemo, restablecer } from './acciones';
import Login from './page';

vi.mock('./acciones', () => ({
  entrar: vi.fn(),
  entrarComoDemo: vi.fn(),
  restablecer: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

const SIN_PARAMETROS = Promise.resolve({});
const CON_AVISO_DE_DEMO = Promise.resolve({ error: 'demo' });

// El login lee la dirección con use(): React espera a la promesa dentro de un Suspense, y act deja
// que la promesa se resuelva y React vuelva a pintar antes de seguir.
async function dibujar(parametros: Promise<{ error?: string }> = SIN_PARAMETROS) {
  await act(async () => {
    render(
      <Suspense fallback={null}>
        <Login searchParams={parametros} />
      </Suspense>,
    );
  });
}

const escribir = (campo: string, valor: string) =>
  fireEvent.change(screen.getByLabelText(campo), { target: { value: valor } });

describe('login: lo que pide', () => {
  it('[C-1] titula FOSO y pide el correo y la contraseña', async () => {
    await dibujar();

    expect(screen.getByLabelText('Correo').getAttribute('type')).toBe('email');
    expect(screen.getByLabelText('Contraseña').getAttribute('type')).toBe('password');
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeTruthy();
  });

  it('[C-1] debajo hay un acceso de demostración como jefe y otro como mecánico', async () => {
    await dibujar();

    expect(screen.getByRole('button', { name: 'Entrar como jefe' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Entrar como mecánico' })).toBeTruthy();
  });

  it('[D-13] todos los botones de acción miden al menos --toque de alto', async () => {
    await dibujar();

    const botones = screen.getAllByRole('button');

    expect(botones.filter((boton) => ![...boton.classList].includes('min-h-toque'))).toEqual([]);
  });

  it('[C-1] los campos piden lo que se espera de ellos: el correo y la contraseña del navegador', async () => {
    await dibujar();

    const autocompletar = ['Correo', 'Contraseña'].map((campo) =>
      screen.getByLabelText(campo).getAttribute('autocomplete'),
    );

    expect(autocompletar).toEqual(['username', 'current-password']);
  });
});

// Va antes que los tests de entrar: uno de ellos deja una acción que no termina, y React junta las
// acciones asíncronas que siguen en marcha, así que el resultado de una acción posterior no se pintaría.
describe('login: restablecer la demo', () => {
  const ENLACE = '¿No puedes entrar? Restablecer la demo';

  it('[C-13] bajo los accesos de demostración hay un enlace discreto para restablecerla', async () => {
    await dibujar();

    const accesos = screen.getByRole('button', { name: 'Entrar como mecánico' });
    const enlace = screen.getByRole('button', { name: ENLACE });

    expect(accesos.compareDocumentPosition(enlace) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it.each([
    ['restablecida', { tipo: 'ok', texto: 'Demo restablecida. Ya puedes entrar' }, 'status'],
    [
      'en espera',
      { tipo: 'ok', texto: 'La demo se restableció hace menos de 10 minutos. Prueba a entrar' },
      'status',
    ],
    ['con error', { tipo: 'error', texto: 'No se pudo restablecer la demo' }, 'alert'],
  ] as const)(
    '[C-13][D-14] con la demo %s enseña lo que ha pasado',
    async (_caso, resultado, rol) => {
      vi.mocked(restablecer).mockResolvedValue(resultado);
      await dibujar();

      fireEvent.click(screen.getByRole('button', { name: ENLACE }));

      expect((await screen.findByRole(rol)).textContent).toBe(resultado.texto);
      expect(restablecer).toHaveBeenCalledTimes(1);
    },
  );

  it('[C-13][D-13] mientras restablece, el enlace queda desactivado y lo dice', async () => {
    let acabar: () => void = () => undefined;
    vi.mocked(restablecer).mockReturnValue(
      new Promise((resolver) => (acabar = () => resolver({ tipo: 'ok', texto: 'Hecho' }))),
    );
    await dibujar();

    fireEvent.click(screen.getByRole('button', { name: ENLACE }));

    const restableciendo = await screen.findByRole('button', { name: 'Restableciendo la demo…' });
    expect(restableciendo.hasAttribute('disabled')).toBe(true);
    await act(async () => acabar());
    expect(await screen.findByRole('status')).toBeTruthy();
  });
});

describe('login: entrar con correo y contraseña', () => {
  it('[C-1] manda el correo y la contraseña a la acción de entrar', async () => {
    vi.mocked(entrar).mockResolvedValue({ error: null });
    await dibujar();

    escribir('Correo', 'jefe@tallerdemo.example');
    escribir('Contraseña', 'una contraseña');
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    await waitFor(() => expect(entrar).toHaveBeenCalledTimes(1));
    const datos = vi.mocked(entrar).mock.calls[0][1];
    expect([datos.get('correo'), datos.get('contrasena')]).toEqual([
      'jefe@tallerdemo.example',
      'una contraseña',
    ]);
  });

  it('[D-14] el motivo por el que no se pudo entrar se enseña junto al formulario', async () => {
    vi.mocked(entrar).mockResolvedValue({ error: 'Correo o contraseña incorrectos' });
    await dibujar();

    escribir('Correo', 'jefe@tallerdemo.example');
    escribir('Contraseña', 'otra');
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    expect((await screen.findByRole('alert')).textContent).toBe('Correo o contraseña incorrectos');
  });

  it('[D-13] mientras entra, el botón queda desactivado para no enviar dos veces', async () => {
    vi.mocked(entrar).mockReturnValue(new Promise(() => undefined));
    await dibujar();

    escribir('Correo', 'jefe@tallerdemo.example');
    escribir('Contraseña', 'una contraseña');
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Entrar' }).hasAttribute('disabled')).toBe(true),
    );
  });
});

describe('login: acceso de demostración', () => {
  it.each([
    ['Entrar como jefe', 'jefe'],
    ['Entrar como mecánico', 'mecanico'],
  ])('[C-1] «%s» manda el rol «%s» a la acción de demostración', async (boton, rol) => {
    vi.mocked(entrarComoDemo).mockResolvedValue(undefined);
    await dibujar();

    fireEvent.click(screen.getByRole('button', { name: boton }));

    await waitFor(() => expect(entrarComoDemo).toHaveBeenCalledTimes(1));
    expect(vi.mocked(entrarComoDemo).mock.calls[0][0].get('rol')).toBe(rol);
  });

  it('[D-14] si la demostración no entra, el aviso lo explica', async () => {
    await dibujar(CON_AVISO_DE_DEMO);

    expect((await screen.findByRole('alert')).textContent).toBe(
      'No se pudo entrar con la cuenta de demostración. Inténtalo de nuevo en unos minutos.',
    );
  });

  it('[D-2] una dirección con un aviso que no conocemos no escribe nada', async () => {
    await dibujar(Promise.resolve({ error: '<b>hola</b>' }));

    expect(screen.queryByRole('alert')).toBeNull();
    expect(document.body.textContent).not.toContain('hola');
  });
});
