import { describe, expect, it, vi } from 'vitest';
import { ErrorDeEntorno } from './entorno';
import { leerCronSecret, leerEntornoSecreto } from './entorno-secreto';

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
const falta = (nombre: Nombre) => new ErrorDeEntorno(`Falta la variable de entorno ${nombre}`);

describe('leerEntornoSecreto', () => {
  it.each(NOMBRES)('[D-2] %s ausente o en blanco da error con su nombre', (nombre) => {
    const con = (valor?: string) => ({ ...ENTORNO_COMPLETO, [nombre]: valor });

    expect(() => leerEntornoSecreto(con())).toThrow(falta(nombre));
    expect(() => leerEntornoSecreto(con(''))).toThrow(falta(nombre));
    expect(() => leerEntornoSecreto(con('   '))).toThrow(falta(nombre));
  });

  it('[D-2] sin ninguna variable avisa de la primera que falta', () => {
    expect(() => leerEntornoSecreto({})).toThrow(falta('SUPABASE_SECRET_KEY'));
  });

  it('[D-2] el error de entorno es de una clase propia, para distinguirlo de otros fallos', () => {
    expect(() => leerEntornoSecreto({})).toThrow(ErrorDeEntorno);
  });

  it('devuelve la clave secreta, el secreto del cron y la contraseña de demostración', () => {
    expect(leerEntornoSecreto(ENTORNO_COMPLETO)).toEqual({
      claveSecreta: ENTORNO_COMPLETO.SUPABASE_SECRET_KEY,
      cronSecret: ENTORNO_COMPLETO.CRON_SECRET,
      demoPassword: ENTORNO_COMPLETO.DEMO_PASSWORD,
    });
  });

  it('recorta los espacios de los bordes', () => {
    const entorno = {
      SUPABASE_SECRET_KEY: ' clave secreta\n',
      CRON_SECRET: '\tsecreto del cron ',
      DEMO_PASSWORD: ' contraseña de prueba ',
    };

    expect(leerEntornoSecreto(entorno)).toEqual({
      claveSecreta: 'clave secreta',
      cronSecret: 'secreto del cron',
      demoPassword: 'contraseña de prueba',
    });
  });
});

// El cron decide quién es de fiar con este secreto antes de mirar el resto del entorno: leerlo no
// puede exigir las demás variables, o un entorno a medias contaría sus faltas a cualquiera.
describe('leerCronSecret', () => {
  it('[D-2] devuelve el secreto sin pedir ninguna otra variable', () => {
    expect(leerCronSecret({ CRON_SECRET: ENTORNO_COMPLETO.CRON_SECRET })).toBe(
      ENTORNO_COMPLETO.CRON_SECRET,
    );
  });

  it('[D-2] ausente, vacío o en blanco es null: sin secreto no hay quien sea de fiar', () => {
    expect(leerCronSecret({})).toBeNull();
    expect(leerCronSecret({ CRON_SECRET: undefined })).toBeNull();
    expect(leerCronSecret({ CRON_SECRET: '' })).toBeNull();
    expect(leerCronSecret({ CRON_SECRET: '   ' })).toBeNull();
  });

  it('[D-2] recorta los espacios de los bordes y da el mismo valor que leerEntornoSecreto', () => {
    const entorno = { ...ENTORNO_COMPLETO, CRON_SECRET: '\tsecreto del cron ' };

    expect(leerCronSecret(entorno)).toBe('secreto del cron');
    expect(leerCronSecret(entorno)).toBe(leerEntornoSecreto(entorno).cronSecret);
  });
});
