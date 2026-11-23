import { describe, expect, it } from 'vitest';
import { CABECERAS } from '@/cabeceras';
import nextConfig from '../../next.config';

const valorDe = (nombre: string) => CABECERAS.find(({ key }) => key === nombre)?.value;

// Escrita tal cual en el SPEC, no derivada del código que se prueba.
const POLITICA_DE_CONTENIDO =
  "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; " +
  "img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; " +
  "base-uri 'self'; form-action 'self'";

describe('cabeceras de seguridad', () => {
  it('[C-18] las cabeceras de seguridad están declaradas', () => {
    const nombres = CABECERAS.map(({ key }) => key).sort();

    expect(nombres).toEqual([
      'Content-Security-Policy',
      'Permissions-Policy',
      'Referrer-Policy',
      'X-Content-Type-Options',
    ]);
    expect(valorDe('Content-Security-Policy')).toContain("frame-ancestors 'none'");
    expect(valorDe('Content-Security-Policy')).not.toContain('*');
    expect(valorDe('X-Content-Type-Options')).toBe('nosniff');
    expect(valorDe('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
  });

  it('[C-18] la política de contenido solo deja cargar lo propio y prohíbe los marcos', () => {
    expect(valorDe('Content-Security-Policy')).toBe(POLITICA_DE_CONTENIDO);
    expect(valorDe('Permissions-Policy')).toBe('camera=(), microphone=(), geolocation=()');
  });

  it('[C-18] next.config aplica las cabeceras a todas las rutas', async () => {
    const reglas = await nextConfig.headers?.();

    expect(reglas).toEqual([{ source: '/(.*)', headers: CABECERAS }]);
  });

  it('[C-18] next.config no optimiza imágenes', () => {
    expect(nextConfig.images).toEqual({ unoptimized: true });
  });
});
