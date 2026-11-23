import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';

// P-8: antes de entregar, todas las features del plan tienen que estar hechas.
const archivo = resolve(import.meta.dirname, '../proceso/features.json');

const esquemaDeFeatures = z.array(
  z.object({ id: z.string(), titulo: z.string(), estado: z.string() }),
);

function leerFeatures() {
  const resultado = esquemaDeFeatures.safeParse(JSON.parse(readFileSync(archivo, 'utf8')));
  if (!resultado.success) {
    throw new Error('tiene que ser una lista de features con id, titulo y estado');
  }
  return resultado.data;
}

function comprobar() {
  const features = leerFeatures();
  const sinHacer = features.filter((feature) => feature.estado !== 'hecha');
  if (sinHacer.length === 0) {
    process.stdout.write(`Todas las features están hechas (${features.length}).\n`);
    return;
  }
  process.stdout.write(`Features sin hacer: ${sinHacer.length} de ${features.length}\n`);
  for (const feature of sinHacer) {
    process.stdout.write(`- ${feature.id} [${feature.estado}] ${feature.titulo}\n`);
  }
  process.exitCode = 1;
}

try {
  comprobar();
} catch (error) {
  const motivo = error instanceof Error ? error.message : String(error);
  process.stderr.write(`No se puede comprobar ${archivo}: ${motivo}\n`);
  process.exitCode = 1;
}
