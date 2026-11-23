import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { esquemaFeature, esquemaRonda, type Feature, type Ronda } from './esquema';

export type FeatureConRondas = Feature & { rondas: Ronda[] };

export type ResumenProceso = { features: number; rondas: number; fallosCorregidos: number };

const ARCHIVO_DE_FEATURES = 'features.json';

const esquemaFeatures = z.array(esquemaFeature);

// Quien rompe el build tiene que entender qué arreglar: los mensajes de zod salen en español.
const OPCIONES_DE_ZOD = { error: z.locales.es().localeError };

const esArchivoDeRonda = (nombre: string) =>
  nombre.startsWith('ronda-') && nombre.endsWith('.json');

function describir(error: z.ZodError): string {
  return error.issues
    .map((incidencia) => {
      const campo = incidencia.path.join('.');
      return campo === '' ? incidencia.message : `${campo}: ${incidencia.message}`;
    })
    .join('; ');
}

function parsearJson(texto: string, ruta: string, etiqueta: string): unknown {
  try {
    return JSON.parse(texto);
  } catch (error) {
    const motivo = error instanceof Error ? error.message : String(error);
    throw new Error(`${etiqueta}: ${ruta}: no es JSON válido (${motivo})`, { cause: error });
  }
}

function leerValidado<T>(ruta: string, esquema: z.ZodType<T>, etiqueta: string): T {
  const datos = parsearJson(readFileSync(ruta, 'utf8'), ruta, etiqueta);
  const resultado = esquema.safeParse(datos, OPCIONES_DE_ZOD);
  if (!resultado.success) {
    throw new Error(`${etiqueta}: ${ruta}: ${describir(resultado.error)}`);
  }
  return resultado.data;
}

function leerRondasDe(directorio: string, id: string): Ronda[] {
  const carpeta = join(directorio, id);
  if (!existsSync(carpeta)) {
    return [];
  }
  return readdirSync(carpeta)
    .filter(esArchivoDeRonda)
    .map((nombre) => leerValidado(join(carpeta, nombre), esquemaRonda, 'Ronda mal formada'))
    .sort((a, b) => a.ronda - b.ronda);
}

export function leerProceso(directorio: string): FeatureConRondas[] {
  const rutaDeFeatures = join(directorio, ARCHIVO_DE_FEATURES);
  const features = leerValidado(rutaDeFeatures, esquemaFeatures, 'Features mal formadas');
  return features.map((feature) => ({ ...feature, rondas: leerRondasDe(directorio, feature.id) }));
}

const acabaEnPasa = (feature: FeatureConRondas) => feature.rondas.at(-1)?.veredicto === 'PASA';

export function resumir(features: FeatureConRondas[]): ResumenProceso {
  const fallosCorregidos = features
    .filter(acabaEnPasa)
    .flatMap((feature) => feature.rondas)
    .filter((ronda) => ronda.veredicto === 'FALLA')
    .reduce((total, ronda) => total + ronda.fallos.length, 0);

  return {
    features: features.length,
    rondas: features.reduce((total, feature) => total + feature.rondas.length, 0),
    fallosCorregidos,
  };
}

export function huecosDeRondas(feature: FeatureConRondas): string | null {
  const numeros = new Set(feature.rondas.map((ronda) => ronda.ronda));
  for (let esperada = 1; esperada <= feature.rondas.length; esperada += 1) {
    if (!numeros.has(esperada)) {
      return `Falta la ronda ${esperada} en ${feature.id}: las rondas se numeran desde 1 y sin huecos`;
    }
  }
  return null;
}
