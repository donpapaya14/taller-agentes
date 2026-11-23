import { describe, expect, it, vi } from 'vitest';
import { leerEntornoSecreto } from './entorno-secreto';

// `server-only` lanza fuera de un componente de servidor de Next; aquí solo hay que dejarlo pasar.
vi.mock('server-only', () => ({}));

// Cada variable vale algo distinto, para ver en los resultados que cada valor va a su sitio.
const ENTORNO_COMPLETO = {
  SUPABASE_SECRET_KEY: 'clave secreta de prueba',
  CRON_SECRET: 'secreto del cron de prueba',
  DEMO_PASSWORD: 'contraseña de demostración de prueba',
};

type Nombre = keyof typeof ENTORNO_COMPLETO;

const NOMBRES = Object.keys(ENTORNO_COMPLETO) as Nombre[];
const error = (nombre: Nombre) => new Error(`Falta la variable de entorno ${nombre}`);

describe('leerEntornoSecreto', () => {
  it.each(NOMBRES)('[D-2] %s ausente o vacía da error con su nombre', (nombre) => {
    const ausente = { ...ENTORNO_COMPLETO, [nombre]: undefined };
    const vacia = { ...ENTORNO_COMPLETO, [nombre]: '' };

    expect(() => leerEntornoSecreto(ausente)).toThrow(error(nombre));
    expect(() => leerEntornoSecreto(vacia)).toThrow(error(nombre));
  });

  it('[D-2] sin ninguna variable avisa de la primera que falta', () => {
    expect(() => leerEntornoSecreto({})).toThrow(error('SUPABASE_SECRET_KEY'));
  });

  it('devuelve la clave secreta, el secreto del cron y la contraseña de demostración', () => {
    expect(leerEntornoSecreto(ENTORNO_COMPLETO)).toEqual({
      claveSecreta: ENTORNO_COMPLETO.SUPABASE_SECRET_KEY,
      cronSecret: ENTORNO_COMPLETO.CRON_SECRET,
      demoPassword: ENTORNO_COMPLETO.DEMO_PASSWORD,
    });
  });
});
