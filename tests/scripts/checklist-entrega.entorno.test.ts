import { describe, expect, it } from 'vitest';
import {
  COMANDOS,
  CONTRASENA,
  ENTORNO_COMPLETO,
  R,
  REPO,
  URL_BASE,
  correr,
  filaDe,
  mundoEnVerde,
} from '../apoyo/checklist-falso';

describe('checklist de entrega: el entorno', () => {
  it('sin URL_BASE fallan las comprobaciones de la web y no se lanza el smoke', async () => {
    const entorno = { REPO, DEMO_PASSWORD: CONTRASENA };

    const { codigo, filas, llamadas } = await correr(mundoEnVerde(), entorno);

    expect(codigo).toBe(1);
    expect(filaDe(filas, R.publica)?.detalle).toContain('falta URL_BASE');
    expect(filaDe(filas, R.usuario)?.detalle).toContain('falta URL_BASE');
    expect(llamadas).not.toContain(COMANDOS.smoke);
  });

  it('cuando dos comprobaciones de una fila fallan por lo mismo, el motivo sale una vez', async () => {
    const entorno = { REPO, DEMO_PASSWORD: CONTRASENA };

    const { filas } = await correr(mundoEnVerde(), entorno);

    expect(filaDe(filas, R.publica)?.detalle.split('falta URL_BASE')).toHaveLength(2);
  });

  it('sin DEMO_PASSWORD no se lanza el smoke y dice qué falta', async () => {
    const entorno = { URL_BASE, REPO };

    const { filas, llamadas } = await correr(mundoEnVerde(), entorno);

    expect(filaDe(filas, R.usuario)).toMatchObject({ estado: 'FALLO' });
    expect(filaDe(filas, R.usuario)?.detalle).toContain('falta DEMO_PASSWORD');
    expect(llamadas).not.toContain(COMANDOS.smoke);
  });

  it('sin REPO mira donpapaya14/taller-agentes', async () => {
    const entorno = { URL_BASE, DEMO_PASSWORD: CONTRASENA };

    const { codigo, llamadas } = await correr(mundoEnVerde(), entorno);

    expect(codigo).toBe(0);
    expect(llamadas).toContain(COMANDOS.ghRepoView);
  });

  it('una barra al final de URL_BASE no cambia las direcciones que se piden', async () => {
    const entorno = { ...ENTORNO_COMPLETO, URL_BASE: `${URL_BASE}/` };

    const { codigo, llamadas } = await correr(mundoEnVerde(), entorno);

    expect(codigo).toBe(0);
    expect(llamadas).toContain(`GET ${URL_BASE}/proceso`);
    expect(llamadas).toContain(`GET ${URL_BASE}/login`);
  });
});

describe('checklist de entrega: un entorno mal formado', () => {
  it.each(['--help', 'sin-barra', 'a/b/c', '../etc', 'dueño/repo con espacios'])(
    'un REPO como «%s» es un error de uso: sale con 2 y no lanza nada',
    async (repo) => {
      const entorno = { ...ENTORNO_COMPLETO, REPO: repo };

      const { codigo, errores, llamadas } = await correr(mundoEnVerde(), entorno);

      expect(codigo).toBe(2);
      expect(errores).toContain('REPO');
      expect(llamadas).toEqual([]);
    },
  );

  it.each(['foso-taller.vercel.app', 'file:///srv/taller', 'no es una dirección'])(
    'una URL_BASE como «%s» es un error de uso: sale con 2 y no lanza nada',
    async (urlBase) => {
      const entorno = { ...ENTORNO_COMPLETO, URL_BASE: urlBase };

      const { codigo, errores, llamadas } = await correr(mundoEnVerde(), entorno);

      expect(codigo).toBe(2);
      expect(errores).toContain('URL_BASE');
      expect(llamadas).toEqual([]);
    },
  );
});
