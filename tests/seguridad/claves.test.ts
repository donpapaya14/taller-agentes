import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const raiz = resolve(import.meta.dirname, '../..');

const leer = (relativa: string) => readFileSync(resolve(raiz, relativa), 'utf8');

const archivosDeSrc = () =>
  readdirSync(resolve(raiz, 'src'), { recursive: true, encoding: 'utf8' })
    .filter((ruta) => /\.(?:tsx?|jsx?|mjs|css)$/.test(ruta))
    .map((ruta) => `src/${ruta}`);

const CLIENTE_SECRETO = 'src/adaptadores/supabase/cliente-secreto.ts';
const NOMBRE_DE_LA_CLAVE = 'SUPABASE_SECRET_KEY';
const MENCIONES_DE_LA_CLAVE = [NOMBRE_DE_LA_CLAVE, 'leerEntornoSecreto', 'cliente-secreto'];
const GUARDA_SERVER_ONLY = "import 'server-only';";

const esTest = (ruta: string) => /\.test\.tsx?$/.test(ruta);

describe('claves', () => {
  it('[C-18][D-4] la clave secreta solo se lee en módulos server-only', () => {
    const archivos = archivosDeSrc();
    const queLaMencionan = archivos.filter((ruta) =>
      MENCIONES_DE_LA_CLAVE.some((mencion) => leer(ruta).includes(mencion)),
    );
    const delNavegador = queLaMencionan.filter((ruta) => /['"]use client['"]/.test(leer(ruta)));
    // Quien lee la variable del entorno entrega el valor a quien lo importe: sin la guarda, un
    // componente de cliente compilaría. Los tests no la llevan: la sustituyen por un mock.
    const queLaLeen = archivos.filter(
      (ruta) => !esTest(ruta) && leer(ruta).includes(NOMBRE_DE_LA_CLAVE),
    );
    const sinGuarda = queLaLeen.filter((ruta) => leer(ruta).split('\n')[0] !== GUARDA_SERVER_ONLY);

    expect(sinGuarda).toEqual([]);
    expect(queLaLeen).not.toEqual([]);
    expect(archivos).toContain(CLIENTE_SECRETO);
    expect(queLaMencionan).toContain(CLIENTE_SECRETO);
    expect(delNavegador).toEqual([]);
    expect(leer(CLIENTE_SECRETO).split('\n')[0]).toBe(GUARDA_SERVER_ONLY);
  });

  it('[C-18][D-4] no hay variables NEXT_PUBLIC', () => {
    const archivos = [...archivosDeSrc(), '.env.example', 'next.config.ts'];

    const conVariablePublica = archivos.filter((ruta) => leer(ruta).includes('NEXT_PUBLIC_'));

    expect(conVariablePublica).toEqual([]);
  });
});
