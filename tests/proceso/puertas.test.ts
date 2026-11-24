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

  it('[P-3] check:full termina en spec:check, que cruza el SPEC y las directrices con los tests', () => {
    const { scripts } = leerJson<{ scripts: Record<string, string> }>('package.json');

    expect(scripts['check:full']).toMatch(/&& npm run spec:check$/);
    expect(scripts['spec:check']).toContain('--specs docs/SPEC.md,DIRECTRICES.md');
    expect(scripts['spec:check']).toContain('--vitest reports/vitest.json');
    expect(scripts['spec:check']).not.toContain('--no-escribir');
  });

  it('[P-1] el job desplegar instala el navegador antes del smoke de producción', () => {
    const gate = readFileSync(resolve(raiz, '.github/workflows/gate.yml'), 'utf8');
    const inicioDelJob = gate.indexOf('\n  desplegar:');
    expect(inicioDelJob).toBeGreaterThan(-1);
    const desplegar = gate.slice(inicioDelJob);

    const instalacion = desplegar.indexOf('npx playwright install --with-deps chromium');
    const smoke = desplegar.indexOf('npm run smoke');

    expect(instalacion).toBeGreaterThan(-1);
    expect(smoke).toBeGreaterThan(instalacion);
  });
});
