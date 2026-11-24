import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CABECERAS, crearCabeceras } from '@/cabeceras';
import nextConfig from '../../next.config';

type Cabecera = { key: string; value: string };

const valorDe = (cabeceras: Cabecera[], nombre: string) =>
  cabeceras.find(({ key }) => key === nombre)?.value ?? '';

const directivaDe = (politica: string, nombre: string) =>
  politica.split('; ').find((directiva) => directiva.startsWith(`${nombre} `));

// Escrita tal cual en el SPEC, no derivada del código que se prueba.
const POLITICA_DE_CONTENIDO =
  "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; " +
  "img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; " +
  "base-uri 'self'; form-action 'self'";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('cabeceras de seguridad', () => {
  it('[C-18] las cabeceras de seguridad están declaradas', () => {
    const nombres = CABECERAS.map(({ key }) => key).sort();

    expect(nombres).toEqual([
      'Content-Security-Policy',
      'Permissions-Policy',
      'Referrer-Policy',
      'X-Content-Type-Options',
    ]);
    expect(valorDe(CABECERAS, 'Content-Security-Policy')).toContain("frame-ancestors 'none'");
    expect(valorDe(CABECERAS, 'Content-Security-Policy')).not.toContain('*');
    expect(valorDe(CABECERAS, 'X-Content-Type-Options')).toBe('nosniff');
    expect(valorDe(CABECERAS, 'Referrer-Policy')).toBe('strict-origin-when-cross-origin');
  });

  it('[C-18] la política de contenido solo deja cargar lo propio y prohíbe los marcos', () => {
    expect(valorDe(CABECERAS, 'Content-Security-Policy')).toBe(POLITICA_DE_CONTENIDO);
    expect(valorDe(CABECERAS, 'Permissions-Policy')).toBe(
      'camera=(), microphone=(), geolocation=()',
    );
  });

  it('[C-18] en producción la CSP no permite eval', () => {
    expect(valorDe(crearCabeceras(false), 'Content-Security-Policy')).not.toContain('unsafe-eval');
    expect(valorDe(CABECERAS, 'Content-Security-Policy')).not.toContain('unsafe-eval');
  });

  it('[C-18] en desarrollo la CSP permite eval para que arranque next dev', () => {
    const politica = valorDe(crearCabeceras(true), 'Content-Security-Policy');

    expect(directivaDe(politica, 'script-src')).toContain("'unsafe-eval'");
  });

  it('[C-18] desarrollo y producción solo se distinguen en el eval de script-src', () => {
    const desarrollo = crearCabeceras(true);
    const sinEval = desarrollo.map(({ key, value }) => ({
      key,
      value: value.replace(" 'unsafe-eval'", ''),
    }));

    expect(sinEval).toEqual(CABECERAS);
  });
});

describe('next.config', () => {
  it('[C-18] next.config aplica las cabeceras a todas las rutas', async () => {
    vi.stubEnv('NODE_ENV', 'production');

    const reglas = await nextConfig.headers?.();

    expect(reglas).toEqual([{ source: '/(.*)', headers: CABECERAS }]);
  });

  it('[C-18] next.config permite eval en desarrollo y en cualquier entorno que no sea producción', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const enDesarrollo = await nextConfig.headers?.();
    vi.stubEnv('NODE_ENV', 'test');
    const enPruebas = await nextConfig.headers?.();

    expect(enDesarrollo).toEqual([{ source: '/(.*)', headers: crearCabeceras(true) }]);
    expect(enPruebas).toEqual(enDesarrollo);
  });

  it('[C-18] next.config no optimiza imágenes', () => {
    expect(nextConfig.images).toEqual({ unoptimized: true });
  });

  it('[C-18] next.config no anuncia el framework en la cabecera X-Powered-By', () => {
    expect(nextConfig.poweredByHeader).toBe(false);
  });

  it('[C-18] next.config no activa Cache Components', () => {
    const texto = readFileSync(resolve(import.meta.dirname, '../../next.config.ts'), 'utf8');

    expect(texto).not.toContain('cacheComponents');
    expect(texto).not.toContain('partialPrefetching');
  });
});
