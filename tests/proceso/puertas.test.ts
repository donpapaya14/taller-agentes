import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const raiz = resolve(import.meta.dirname, '../..');

const leerJson = <T>(archivo: string): T =>
  JSON.parse(readFileSync(resolve(raiz, archivo), 'utf8')) as T;

const SCRIPTS_DE_LAS_PUERTAS = [
  'check',
  'check:full',
  'cobertura',
  'arquitectura',
  'duplicado',
  'muerto',
  'spec:check',
  'gate:tipos',
  'gate:rls',
  'gate:mutacion',
  'gate:e2e',
  'smoke',
  'checklist',
];

const MINIMO_CARACTERES_DEL_MOTIVO = 20;

describe('puertas de calidad', () => {
  it('[P-1] package.json define los scripts de las puertas', () => {
    const { scripts } = leerJson<{ scripts: Record<string, string> }>('package.json');

    const ausentes = SCRIPTS_DE_LAS_PUERTAS.filter(
      (nombre) => typeof scripts[nombre] !== 'string' || scripts[nombre].trim() === '',
    );

    expect(ausentes).toEqual([]);
  });

  it('[P-1] calidad.json declara tipo web, supabase y las omisiones con motivo', () => {
    const { tipo, supabase, omitir } = leerJson<{
      tipo: string;
      supabase: boolean;
      omitir: Record<string, string>;
    }>('calidad.json');

    expect(tipo).toBe('web');
    expect(supabase).toBe(true);
    expect(Object.keys(omitir)).not.toHaveLength(0);
    const sinMotivo = Object.entries(omitir).filter(
      ([, motivo]) => motivo.length <= MINIMO_CARACTERES_DEL_MOTIVO,
    );
    expect(sinMotivo).toEqual([]);
  });
});
