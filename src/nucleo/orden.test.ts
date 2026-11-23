import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  anteriorEstado,
  ESTADOS,
  ETIQUETA_ESTADO,
  puedeTransicionar,
  siguienteEstado,
  type Estado,
} from './orden';

type Par = [Estado, Estado];

// Tres avances y dos retrocesos: las únicas transiciones válidas.
const PERMITIDAS: Par[] = [
  ['recibido', 'en_reparacion'],
  ['en_reparacion', 'listo'],
  ['listo', 'entregado'],
  ['en_reparacion', 'recibido'],
  ['listo', 'en_reparacion'],
];

const TODOS_LOS_PARES: Par[] = ESTADOS.flatMap((de) => ESTADOS.map((a): Par => [de, a]));

const SIGUIENTES: [Estado, Estado | null][] = [
  ['recibido', 'en_reparacion'],
  ['en_reparacion', 'listo'],
  ['listo', 'entregado'],
  ['entregado', null],
];

const ANTERIORES: [Estado, Estado | null][] = [
  ['recibido', null],
  ['en_reparacion', 'recibido'],
  ['listo', 'en_reparacion'],
  ['entregado', null],
];

const cualquierEstado = fc.constantFrom(...ESTADOS);

const esPermitida = (de: Estado, a: Estado): boolean =>
  PERMITIDAS.some(([desde, hasta]) => desde === de && hasta === a);

describe('orden: transiciones', () => {
  it('[C-4] solo se llega al estado siguiente o al anterior', () => {
    // Los 16 pares se prueban siempre; fast-check añade el resto de rondas al azar.
    fc.assert(
      fc.property(cualquierEstado, cualquierEstado, (de, a) => {
        expect(puedeTransicionar(de, a)).toBe(esPermitida(de, a));
      }),
      { examples: TODOS_LOS_PARES },
    );
  });

  it('[C-4] una orden entregada no cambia', () => {
    for (const destino of ESTADOS) {
      expect(puedeTransicionar('entregado', destino)).toBe(false);
    }
  });
});

describe('orden: siguiente y anterior', () => {
  it.each(SIGUIENTES)('[C-4] el siguiente de %s es %s', (estado, esperado) => {
    expect(siguienteEstado(estado)).toBe(esperado);
  });

  it.each(ANTERIORES)('[C-4] el anterior de %s es %s', (estado, esperado) => {
    expect(anteriorEstado(estado)).toBe(esperado);
  });
});

describe('orden: estados y etiquetas', () => {
  it('[C-4] los estados van en el orden del taller', () => {
    expect([...ESTADOS]).toEqual(['recibido', 'en_reparacion', 'listo', 'entregado']);
  });

  it('[C-4] cada estado tiene su etiqueta en español', () => {
    expect(ETIQUETA_ESTADO).toEqual({
      recibido: 'Recibido',
      en_reparacion: 'En reparación',
      listo: 'Listo',
      entregado: 'Entregado',
    });
  });
});
