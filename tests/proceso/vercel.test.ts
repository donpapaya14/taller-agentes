import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

type ConfiguracionDeVercel = {
  framework?: string;
  regions?: string[];
  crons?: { path: string; schedule: string }[];
};

const vercel: ConfiguracionDeVercel = JSON.parse(
  readFileSync(resolve(import.meta.dirname, '../../vercel.json'), 'utf8'),
);

describe('vercel.json', () => {
  // La base de datos está en eu-west-1 (Irlanda). Con la región por defecto de Vercel, Washington,
  // cada consulta de cada petición cruzaría el Atlántico de ida y vuelta.
  it('las funciones corren en Dublín, junto a la base de datos', () => {
    expect(vercel.regions).toEqual(['dub1']);
  });

  // Sin `framework`, un proyecto creado por CLI puede quedar con el preset «Other» y dar 404 en todo.
  it('sigue declarando Next.js y el cron que restablece la demo', () => {
    expect(vercel.framework).toBe('nextjs');
    expect(vercel.crons).toEqual([{ path: '/api/cron/restablecer', schedule: '0 4 * * *' }]);
  });
});
