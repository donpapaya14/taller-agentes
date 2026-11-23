import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { ESTADOS, type Estado } from './orden';
import { enlaceAviso, mensajeAviso, normalizarTelefono } from './whatsapp';

const TALLER = 'Talleres Vega';
const MATRICULA = '1234BCD';
const ENLACE_BASE = 'https://wa.me/34612345678?text=';

const MENSAJES: Record<Estado, string> = {
  recibido: 'Hola, le escribimos de Talleres Vega. Hemos recibido su vehículo 1234BCD.',
  en_reparacion:
    'Hola, le escribimos de Talleres Vega. Ya estamos trabajando en su vehículo 1234BCD.',
  listo: 'Hola, le escribimos de Talleres Vega. Su vehículo 1234BCD ya está listo para recoger.',
  entregado:
    'Hola, le escribimos de Talleres Vega. Gracias por confiar en nosotros con su vehículo 1234BCD.',
};

const CASOS_DE_TELEFONO = [
  { texto: '612 345 678', esperado: '34612345678' },
  { texto: '+34 612-345-678', esperado: '34612345678' },
  { texto: '0034612345678', esperado: '34612345678' },
  { texto: '34612345678', esperado: '34612345678' },
  { texto: '(612) 345.678', esperado: '34612345678' },
  { texto: '712345678', esperado: '34712345678' },
  { texto: '812345678', esperado: '34812345678' },
  { texto: '912345678', esperado: '34912345678' },
  { texto: '12345', esperado: null },
  { texto: '512345678', esperado: null },
  { texto: '', esperado: null },
  { texto: 'abc', esperado: null },
  { texto: '+34', esperado: null },
  { texto: '61234567', esperado: null },
  { texto: '6123456789', esperado: null },
  { texto: '+44 612345678', esperado: null },
  { texto: '+612345678', esperado: null },
  { texto: '0034 34612345678', esperado: null },
  { texto: '612 345 67a', esperado: null },
  { texto: 'x612345678', esperado: null },
  { texto: '612345678x', esperado: null },
];

const datosDelAviso = (estado: Estado) => ({ taller: TALLER, matricula: MATRICULA, estado });

describe('whatsapp: teléfono', () => {
  it.each(CASOS_DE_TELEFONO)('[C-9] normaliza teléfonos españoles: "$texto"', (caso) => {
    expect(normalizarTelefono(caso.texto)).toBe(caso.esperado);
  });

  it('[C-9] un teléfono español con cualquier prefijo y separador queda con el 34 delante', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 600_000_000, max: 999_999_999 }),
        fc.constantFrom('', '+34', '0034', '34'),
        fc.constantFrom('', ' ', '-', '.'),
        (numero, prefijo, separador) => {
          const cifras = String(numero);
          const grupos = [cifras.slice(0, 3), cifras.slice(3, 6), cifras.slice(6)];

          expect(normalizarTelefono(prefijo + separador + grupos.join(separador))).toBe(
            `34${cifras}`,
          );
        },
      ),
    );
  });

  it('[C-9] sin nueve cifras que empiecen por 6, 7, 8 o 9 no hay teléfono', () => {
    const empiezaMal = fc.stringMatching(/^[0-5]\d{8}$/);
    const demasiadoCorto = fc.stringMatching(/^[6-9]\d{0,7}$/);
    const demasiadoLargo = fc.stringMatching(/^[6-9]\d{9,12}$/);

    fc.assert(
      fc.property(fc.oneof(empiezaMal, demasiadoCorto, demasiadoLargo), (texto) => {
        expect(normalizarTelefono(texto)).toBeNull();
      }),
    );
  });
});

describe('whatsapp: mensaje y enlace', () => {
  it.each(ESTADOS)('[C-9] el aviso cuando la orden está %s', (estado) => {
    expect(mensajeAviso(datosDelAviso(estado))).toBe(MENSAJES[estado]);
  });

  it('[C-9] construye el enlace con el mensaje codificado', () => {
    const enlace = enlaceAviso({ telefono: '612345678', ...datosDelAviso('listo') });

    expect(enlace).toBe(`${ENLACE_BASE}${encodeURIComponent(MENSAJES.listo)}`);
  });

  it('[C-9] el teléfono se normaliza dentro del enlace', () => {
    const enlace = enlaceAviso({ telefono: '+34 612-345-678', ...datosDelAviso('recibido') });

    expect(enlace).toBe(`${ENLACE_BASE}${encodeURIComponent(MENSAJES.recibido)}`);
  });

  it('[C-9] sin teléfono válido no hay enlace', () => {
    expect(enlaceAviso({ telefono: 'abc', ...datosDelAviso('listo') })).toBeNull();
    expect(enlaceAviso({ telefono: '', ...datosDelAviso('listo') })).toBeNull();
  });

  it('[C-9] el mensaje se lee igual al abrir el enlace, con los caracteres que lleve', () => {
    fc.assert(
      fc.property(
        fc.string({ unit: 'grapheme' }),
        fc.string({ unit: 'grapheme' }),
        fc.constantFrom(...ESTADOS),
        (taller, matricula, estado) => {
          const datos = { taller, matricula, estado };
          const enlace = enlaceAviso({ telefono: '612345678', ...datos });

          expect(new URL(String(enlace)).searchParams.get('text')).toBe(mensajeAviso(datos));
        },
      ),
    );
  });
});
