import { describe, expect, it } from 'vitest';
import { documentoCon, ENTRADA, type Texto, textosDe } from '../../../tests/apoyo/lectura-de-pdf';

const de = (textos: Texto[], texto: string) => textos.find((t) => t.texto === texto) as Texto;

describe('generarPdf: las etiquetas y la línea del vehículo', () => {
  it('[C-8] cada etiqueta de la cabecera va justo encima de su dato', async () => {
    const textos = await textosDe(documentoCon({}));

    for (const [etiqueta, dato] of [
      ['Taller', 'Talleres Vega'],
      ['Fecha', '2026-11-23'],
      ['Cliente', 'Lucía Ferrer Montoya'],
      ['Vehículo', '3517XGB'],
      ['Descripción', 'Sustitución de las cuatro bujías'],
    ]) {
      expect(de(textos, etiqueta).x, etiqueta).toBe(de(textos, dato).x);
      expect(de(textos, etiqueta).y, etiqueta).toBeGreaterThan(de(textos, dato).y);
    }
  });

  it('[C-8] la marca y el modelo van juntos en la línea que sigue a la matrícula', async () => {
    const textos = await textosDe(documentoCon({}));

    const matricula = de(textos, '3517XGB');
    const marcaYModelo = de(textos, 'Seat Ibiza');
    expect(marcaYModelo.x).toBe(matricula.x);
    expect(marcaYModelo.y).toBeLessThan(matricula.y);
  });

  it('[C-8] sin marca ni modelo no queda una línea vacía bajo la matrícula', async () => {
    const sinMarca = documentoCon({ vehiculo: { ...ENTRADA.vehiculo, marca: '', modelo: ' ' } });

    const textos = await textosDe(sinMarca);

    const matricula = de(textos, '3517XGB');
    expect(textos.filter(({ x, y }) => x === matricula.x && y < matricula.y)).toEqual([]);
  });
});

describe('generarPdf: datos en blanco y estilo de la cabecera', () => {
  it('[C-8] los datos en blanco no dejan líneas vacías ni textos de más', async () => {
    const completo = await textosDe(documentoCon({}));
    const enBlanco = documentoCon({
      taller: { ...ENTRADA.taller, nif: '  ', telefono: '' },
      cliente: { ...ENTRADA.cliente, telefono: '   ' },
      vehiculo: { ...ENTRADA.vehiculo, marca: ' ', modelo: '' },
    });

    const textos = await textosDe(enBlanco);

    expect(textos.filter(({ texto }) => texto.trim() === '')).toEqual([]);
    // Faltan justo el NIF y el teléfono del taller, el teléfono del cliente y «Seat Ibiza».
    expect(textos).toHaveLength(completo.length - 4);
  });

  it('[C-8] la primera línea de cada bloque va en negrita y las demás, no', async () => {
    const textos = await textosDe(documentoCon({}));

    for (const primera of ['Talleres Vega', '2026-11-23', 'Lucía Ferrer Montoya', '3517XGB']) {
      expect(de(textos, primera).fuente, primera).toContain('Bold');
    }
    for (const otra of [
      'NIF B16725376',
      'Calle de la Fragua, 14',
      'Tel. 969 739 431',
      '34641682845',
      'Seat Ibiza',
    ]) {
      expect(de(textos, otra).fuente, otra).not.toContain('Bold');
    }
  });
});
