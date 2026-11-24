import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import {
  comprobarQueTodoCabe,
  documentoCon,
  ENTRADA,
  soloTextos,
  textosDe,
  textosPorPagina,
} from '../../../tests/apoyo/lectura-de-pdf';
import { generarPdf } from './generar';

const CLIENTE = ENTRADA.cliente;
const conNombreDeCliente = (nombre: string) => documentoCon({ cliente: { ...CLIENTE, nombre } });

describe('generarPdf: texto que llega raro', () => {
  it('[C-8] un nombre con los acentos escritos como carácter aparte sale con sus acentos', async () => {
    const nombre = 'María José'.normalize('NFC');
    const decompuesto = nombre.normalize('NFD');

    const textos = soloTextos(await textosDe(conNombreDeCliente(decompuesto)));

    expect(decompuesto).not.toBe(nombre);
    expect(textos).toContain(nombre);
  });

  it('[C-8] un nombre de 200.000 letras sin espacios genera el PDF en menos de un segundo', async () => {
    const documento = conNombreDeCliente('M'.repeat(200_000));

    const inicio = performance.now();
    const bytes = await generarPdf(documento);
    const segundos = (performance.now() - inicio) / 1000;

    expect(segundos).toBeLessThan(1);
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
  });
});

// Unos 2.600 caracteres con espacios, como los que se colaron en el nombre del cliente.
const LARGO = 'Zacarías Ferrer '.repeat(163);
const LINEAS_POR_DATO = 3;

const CAMPOS_DE_LA_CABECERA: [string, Parameters<typeof documentoCon>[0]][] = [
  ['el nombre del cliente', { cliente: { ...CLIENTE, nombre: LARGO } }],
  ['el teléfono del cliente', { cliente: { ...CLIENTE, telefono: LARGO } }],
  ['la matrícula', { vehiculo: { ...ENTRADA.vehiculo, matricula: LARGO } }],
  ['la marca', { vehiculo: { ...ENTRADA.vehiculo, marca: LARGO } }],
  ['el modelo', { vehiculo: { ...ENTRADA.vehiculo, modelo: LARGO } }],
  ['el nombre del taller', { taller: { ...ENTRADA.taller, nombre: LARGO } }],
  ['el NIF', { taller: { ...ENTRADA.taller, nif: LARGO } }],
  ['la dirección', { taller: { ...ENTRADA.taller, direccion: LARGO } }],
  ['el teléfono del taller', { taller: { ...ENTRADA.taller, telefono: LARGO } }],
  ['la fecha', { orden: { ...ENTRADA.orden, fecha: LARGO } }],
];

// La cabecera solo está en la primera página y no se parte: un dato sin tope pasaría por encima
// de la leyenda del pie y se perdería lo que sale del papel. Cada dato lleva tres líneas como
// mucho y acaba en «…» si le falta texto, así que el documento sigue siendo de una página.
describe('generarPdf: datos de la cabecera enormes', () => {
  it.each(CAMPOS_DE_LA_CABECERA)(
    '[C-8] %s con 2.600 caracteres no pisa el pie: se corta en tres líneas con «…»',
    async (_campo, cambios) => {
      const paginas = await textosPorPagina(await generarPdf(documentoCon(cambios)));

      await comprobarQueTodoCabe(paginas);
      expect(paginas).toHaveLength(1);
      const lineasDelDato = paginas[0].filter(({ texto }) => texto.includes('Zacar'));
      expect(lineasDelDato).toHaveLength(LINEAS_POR_DATO);
      expect(lineasDelDato[LINEAS_POR_DATO - 1].texto.endsWith('…')).toBe(true);
    },
  );

  it('[C-8] un dato de tres líneas se escribe entero y uno de cuatro pierde la última', async () => {
    const tres = soloTextos(await textosDe(conNombreDeCliente('uno\ndos\ntres')));
    const cuatro = soloTextos(await textosDe(conNombreDeCliente('uno\ndos\ntres\ncuatro')));

    expect(tres).toEqual(expect.arrayContaining(['uno', 'dos', 'tres']));
    expect(cuatro).toEqual(expect.arrayContaining(['uno', 'dos', 'tres…']));
    expect(cuatro).not.toContain('cuatro');
  });
});
