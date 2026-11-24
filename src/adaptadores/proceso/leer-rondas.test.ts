import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import fc from 'fast-check';
import { describe, expect, it, onTestFinished } from 'vitest';
import type { Feature, Ronda } from './esquema';
import {
  huecosDeRondas,
  leerProceso,
  resumir,
  type FeatureConRondas,
  type ResumenProceso,
} from './leer-rondas';

// Una ronda con tantos fallos como se pidan: sin fallos pasa, con fallos falla.
function ronda(feature: string, numero: number, numeroDeFallos = 0): Ronda {
  const fallos = Array.from({ length: numeroDeFallos }, (_, indice) => ({
    directriz: 'D-2',
    archivo: `src/modulo-${indice}.ts`,
    descripcion: `Fallo ${indice + 1} de la ronda ${numero}`,
    evidencia: `El comando sale con 1 en src/modulo-${indice}.ts:${indice + 1}`,
  }));
  return {
    feature,
    ronda: numero,
    fecha: '2026-11-23',
    commitRevisado: 'b2c3d4e',
    veredicto: numeroDeFallos > 0 ? 'FALLA' : 'PASA',
    comandos: [{ comando: 'npm run check', resultado: 'OK', resumen: 'sale con 0' }],
    fallos,
    observaciones: '',
  };
}

const featureDe = (id: string, estado: Feature['estado'] = 'pendiente'): Feature => ({
  id,
  titulo: `Feature ${id}`,
  resumen: `Resumen de ${id}`,
  estado,
});

const conRondas = (feature: Feature, rondas: Ronda[]): FeatureConRondas => ({
  ...feature,
  rondas,
});

const featureConNumeros = (numeros: number[]) =>
  conRondas(
    featureDe('f-a', 'hecha'),
    numeros.map((numero) => ronda('f-a', numero)),
  );

function directorioTemporal(): string {
  const directorio = mkdtempSync(join(tmpdir(), 'foso-proceso-'));
  onTestFinished(() => rmSync(directorio, { recursive: true, force: true }));
  return directorio;
}

function escribir(ruta: string, contenido: unknown): void {
  mkdirSync(dirname(ruta), { recursive: true });
  writeFileSync(ruta, typeof contenido === 'string' ? contenido : JSON.stringify(contenido));
}

// Un directorio de proceso con su features.json y una carpeta por feature con sus rondas.
function procesoCon(features: Feature[], rondas: Ronda[] = []): string {
  const directorio = directorioTemporal();
  escribir(join(directorio, 'features.json'), features);
  for (const unaRonda of rondas) {
    escribir(join(directorio, unaRonda.feature, `ronda-${unaRonda.ronda}.json`), unaRonda);
  }
  return directorio;
}

describe('leerProceso', () => {
  it('[C-12] lee features y rondas ordenadas', () => {
    const directorio = procesoCon(
      [featureDe('f-a'), featureDe('f-b')],
      [ronda('f-a', 2), ronda('f-a', 1, 2)],
    );

    const [primera, segunda] = leerProceso(directorio);

    expect(primera).toEqual(conRondas(featureDe('f-a'), [ronda('f-a', 1, 2), ronda('f-a', 2)]));
    expect(segunda).toEqual(conRondas(featureDe('f-b'), []));
  });

  it('[C-12] ordena las rondas por número y no por el nombre del archivo', () => {
    const rondas = [10, 2, 1, 3].map((numero) => ronda('f-a', numero));

    const [feature] = leerProceso(procesoCon([featureDe('f-a')], rondas));

    expect(feature.rondas.map((unaRonda) => unaRonda.ronda)).toEqual([1, 2, 3, 10]);
  });

  it('[C-12] respeta el orden de features.json', () => {
    const directorio = procesoCon([featureDe('f-b'), featureDe('f-c'), featureDe('f-a')]);

    expect(leerProceso(directorio).map((feature) => feature.id)).toEqual(['f-b', 'f-c', 'f-a']);
  });

  it('[C-12] solo lee los archivos ronda-*.json de la carpeta de la feature', () => {
    const directorio = procesoCon([featureDe('f-a')], [ronda('f-a', 1)]);
    const ajenos = ['notas.txt', 'resumen.json', 'ronda-1.md', 'ronda-1.json.bak'];
    for (const nombre of ajenos) {
      escribir(join(directorio, 'f-a', nombre), 'esto no es una ronda ni es JSON');
    }

    const [feature] = leerProceso(directorio);

    expect(feature.rondas).toHaveLength(1);
  });
});

// Un proceso con la feature f-a cuyo ronda-1.json contiene exactamente lo que se pase.
function procesoConRonda1(contenido: unknown) {
  const directorio = procesoCon([featureDe('f-a')]);
  const ruta = join(directorio, 'f-a', 'ronda-1.json');
  escribir(ruta, contenido);
  return { leer: () => leerProceso(directorio), ruta };
}

// Un directorio de proceso cuyo features.json contiene exactamente lo que se pase.
function procesoConFeatures(contenido: unknown) {
  const directorio = directorioTemporal();
  const ruta = join(directorio, 'features.json');
  escribir(ruta, contenido);
  return { leer: () => leerProceso(directorio), ruta };
}

describe('leerProceso con un archivo de ronda que no vale', () => {
  const quiza = { ...ronda('f-a', 1), veredicto: 'QUIZA' };

  it('[C-12][D-2] un archivo de ronda mal formado lanza error con su ruta', () => {
    const { leer, ruta } = procesoConRonda1(quiza);

    expect(leer).toThrow(`Ronda mal formada: ${ruta}:`);
    expect(leer).toThrow('veredicto');
  });

  it('[C-12][D-2] los mensajes de error salen en español', () => {
    expect(procesoConRonda1(quiza).leer).toThrow('Opción inválida');
  });

  it('[C-12][D-2] un archivo de ronda que no es un objeto lanza error con su ruta', () => {
    const { leer, ruta } = procesoConRonda1('[]');

    expect(leer).toThrow(`Ronda mal formada: ${ruta}: Entrada inválida`);
  });

  it('[C-12][D-2] una ronda que rompe una regla cruzada lanza error con su ruta', () => {
    const { leer, ruta } = procesoConRonda1({ ...ronda('f-a', 1, 1), veredicto: 'PASA' });

    expect(leer).toThrow(
      `Ronda mal formada: ${ruta}: veredicto: Una ronda que pasa no puede tener fallos`,
    );
  });

  it('[C-12][D-2] un archivo de ronda que no es JSON lanza error con su ruta', () => {
    const { leer, ruta } = procesoConRonda1('{ "feature": "f-a", ');

    expect(leer).toThrow(`Ronda mal formada: ${ruta}: no es JSON válido`);
  });
});

describe('leerProceso con un features.json que no vale', () => {
  it('[C-12][D-2] un features.json mal formado lanza error con su ruta', () => {
    const { leer, ruta } = procesoConFeatures([{ ...featureDe('f-a'), estado: 'terminada' }]);

    expect(leer).toThrow(`Features mal formadas: ${ruta}: 0.estado`);
  });

  it('[C-12][D-2] un features.json que no es JSON lanza error con su ruta', () => {
    const { leer, ruta } = procesoConFeatures('no es JSON');

    expect(leer).toThrow(`Features mal formadas: ${ruta}: no es JSON válido`);
  });

  it('[C-12] un directorio sin features.json lanza error en vez de devolver una lista vacía', () => {
    expect(() => leerProceso(directorioTemporal())).toThrow('features.json');
  });
});

describe('resumir', () => {
  it('[C-12] resume fallos corregidos solo de features que acaban en PASA', () => {
    const acabaEnPasa = conRondas(featureDe('f-a', 'hecha'), [ronda('f-a', 1, 3), ronda('f-a', 2)]);
    const acabaEnFalla = conRondas(featureDe('f-b'), [ronda('f-b', 1, 2)]);
    const esperado: ResumenProceso = { features: 2, rondas: 3, fallosCorregidos: 3 };

    expect(resumir([acabaEnPasa, acabaEnFalla])).toEqual(esperado);
  });

  it('[C-12] suma los fallos de todas las rondas FALLA de una feature que acaba en PASA', () => {
    const feature = conRondas(featureDe('f-a', 'hecha'), [
      ronda('f-a', 1, 2),
      ronda('f-a', 2, 1),
      ronda('f-a', 3),
    ]);

    expect(resumir([feature])).toEqual({ features: 1, rondas: 3, fallosCorregidos: 3 });
  });

  it('[C-12] una feature que pasa a la primera no corrige nada', () => {
    const feature = conRondas(featureDe('f-a', 'hecha'), [ronda('f-a', 1)]);

    expect(resumir([feature])).toEqual({ features: 1, rondas: 1, fallosCorregidos: 0 });
  });

  it('[C-12] sin features, o con features sin rondas, no cuenta rondas ni fallos', () => {
    expect(resumir([])).toEqual({ features: 0, rondas: 0, fallosCorregidos: 0 });
    expect(resumir([conRondas(featureDe('f-a'), [])])).toEqual({
      features: 1,
      rondas: 0,
      fallosCorregidos: 0,
    });
  });
});

describe('huecosDeRondas', () => {
  it.each([[[]], [[1]], [[1, 2, 3]], [[3, 1, 2]]])('[P-4] %j no tiene huecos', (numeros) => {
    expect(huecosDeRondas(featureConNumeros(numeros))).toBeNull();
  });

  it.each([
    [[1, 3], /ronda 2\b/],
    [[2, 3], /ronda 1\b/],
    [[2], /ronda 1\b/],
    [[1, 2, 4], /ronda 3\b/],
    [[1, 2, 2], /ronda 3\b/],
  ])('[P-4] con las rondas %j el texto nombra la ronda que falta: %s', (numeros, nombraLaRonda) => {
    const texto = huecosDeRondas(featureConNumeros(numeros));

    expect(texto).toMatch(nombraLaRonda);
    expect(texto).toContain('f-a');
  });

  it('[P-4] rondas de 1 a N, en cualquier orden, no tienen huecos', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 30 }), fc.boolean(), (cuantas, alReves) => {
        const numeros = Array.from({ length: cuantas }, (_, indice) => indice + 1);
        if (alReves) numeros.reverse();

        expect(huecosDeRondas(featureConNumeros(numeros))).toBeNull();
      }),
    );
  });

  it('[P-4] si falta una ronda intermedia o la primera, el texto la nombra', () => {
    const rondasYFalta = fc
      .integer({ min: 1, max: 30 })
      .chain((cuantas) => fc.tuple(fc.constant(cuantas), fc.integer({ min: 1, max: cuantas })));

    fc.assert(
      fc.property(rondasYFalta, ([cuantas, falta]) => {
        const numeros = Array.from({ length: cuantas + 1 }, (_, indice) => indice + 1);
        const conHueco = numeros.filter((numero) => numero !== falta);

        // «ronda 2 en» y no solo «ronda 2»: así «ronda 20» no vale por «ronda 2».
        expect(huecosDeRondas(featureConNumeros(conHueco))).toContain(`ronda ${falta} en `);
      }),
    );
  });
});
