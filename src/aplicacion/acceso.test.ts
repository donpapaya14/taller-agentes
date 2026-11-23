import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { decidirAcceso, RUTAS_PUBLICAS, USUARIOS_DEMO } from './acceso';

const PASA = { tipo: 'pasa' };
const A_LOGIN = { tipo: 'redirige', a: '/login' };
const A_TABLERO = { tipo: 'redirige', a: '/tablero' };

const decisiones = (rutas: string[], haySesion: boolean) =>
  rutas.map((ruta) => decidirAcceso(ruta, haySesion));

describe('decidirAcceso', () => {
  it('[C-1] sin sesión las rutas privadas van a /login', () => {
    const rutas = ['/tablero', '/ordenes/abc', '/recambios'];

    expect(decisiones(rutas, false)).toEqual(rutas.map(() => A_LOGIN));
  });

  it('[C-1] las públicas pasan sin sesión', () => {
    const rutas = ['/', '/proceso', '/login', '/api/cron/restablecer'];

    expect(decisiones(rutas, false)).toEqual(rutas.map(() => PASA));
  });

  it('[C-1] con sesión /login va al tablero', () => {
    expect(decidirAcceso('/login', true)).toEqual(A_TABLERO);
  });

  it('[C-1] con sesión el resto de rutas pasa', () => {
    const rutas = ['/', '/proceso', '/tablero', '/ordenes/abc', '/recambios', '/api/cron/x'];

    expect(decisiones(rutas, true)).toEqual(rutas.map(() => PASA));
  });

  it('[D-2] una ruta rara o mal escrita sin sesión va a /login', () => {
    const basura = [
      '',
      'tablero',
      '//otro.example',
      '/api/cron',
      '/api/cronjob',
      '/LOGIN',
      '/proceso/x',
    ];

    expect(decisiones(basura, false)).toEqual(basura.map(() => A_LOGIN));
  });
});

describe('decidirAcceso, propiedades', () => {
  const rutaPrivada = fc.string().map((resto) => `/privado/${resto}`);

  it('[C-1] sin sesión, toda ruta fuera de las públicas y del cron va a /login', () => {
    fc.assert(
      fc.property(rutaPrivada, (ruta) => {
        expect(decidirAcceso(ruta, false)).toEqual(A_LOGIN);
      }),
    );
  });

  it('[C-1] sin sesión, todo lo que cuelga de /api/cron/ pasa', () => {
    fc.assert(
      fc.property(fc.string(), (resto) => {
        expect(decidirAcceso(`/api/cron/${resto}`, false)).toEqual(PASA);
      }),
    );
  });

  it('[C-1] con sesión solo /login redirige', () => {
    const otraRuta = fc.string().filter((ruta) => ruta !== '/login');

    fc.assert(
      fc.property(otraRuta, (ruta) => {
        expect(decidirAcceso(ruta, true)).toEqual(PASA);
      }),
    );
  });

  it('[C-1] una redirección nunca lleva a otra redirección', () => {
    fc.assert(
      fc.property(fc.string(), fc.boolean(), (ruta, haySesion) => {
        const decision = decidirAcceso(ruta, haySesion);

        if (decision.tipo === 'redirige') {
          expect(decidirAcceso(decision.a, haySesion)).toEqual(PASA);
        }
      }),
    );
  });
});

describe('constantes de acceso', () => {
  it('las rutas públicas son la portada, el proceso y el login', () => {
    expect(RUTAS_PUBLICAS).toEqual(['/', '/proceso', '/login']);
  });

  it('los usuarios de demostración son el jefe, el mecánico y el jefe de otro taller', () => {
    expect(USUARIOS_DEMO).toEqual({
      jefe: 'jefe@tallerdemo.example',
      mecanico: 'mecanico@tallerdemo.example',
      otro: 'jefe@otrotaller.example',
    });
  });
});
