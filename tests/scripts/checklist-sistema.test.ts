import { once } from 'node:events';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { describe, expect, it } from 'vitest';
import { sistemaReal } from '../../scripts/checklist-sistema.mjs';

type Atencion = { estado: number; cabeceras?: Record<string, string>; cuerpo?: string };

// Un servidor de verdad en un puerto libre mientras dura `usar`.
async function conServidor<T>(
  atender: (url: string) => Atencion,
  usar: (direccion: string) => Promise<T>,
): Promise<T> {
  const servidor = createServer((peticion, respuesta) => {
    const { estado, cabeceras, cuerpo } = atender(peticion.url ?? '/');
    respuesta.writeHead(estado, cabeceras);
    respuesta.end(cuerpo ?? '');
  });
  servidor.listen(0, '127.0.0.1');
  await once(servidor, 'listening');
  try {
    return await usar(`http://127.0.0.1:${(servidor.address() as AddressInfo).port}`);
  } finally {
    servidor.closeAllConnections();
    servidor.close();
  }
}

describe('checklist de entrega: el sistema de verdad', () => {
  it('pedir no sigue las redirecciones: da el 307 y no la página a la que lleva', async () => {
    const respuesta = await conServidor(
      (url) =>
        url === '/destino'
          ? { estado: 200, cuerpo: 'la página de acceso' }
          : { estado: 307, cabeceras: { Location: '/destino' } },
      (direccion) => sistemaReal.pedir(`${direccion}/login`),
    );

    expect(respuesta.estado).toBe(307);
  });

  it('pedir devuelve el estado y el cuerpo de una página', async () => {
    const respuesta = await conServidor(
      () => ({ estado: 200, cuerpo: '<h1>Proceso</h1>' }),
      (direccion) => sistemaReal.pedir(`${direccion}/proceso`),
    );

    expect(respuesta).toEqual({ estado: 200, cuerpo: '<h1>Proceso</h1>' });
  });

  it('ejecutar da el código de salida y lo que escribió el comando', () => {
    const resultado = sistemaReal.ejecutar(process.execPath, [
      '-e',
      'process.stdout.write("hola"); process.exit(3)',
    ]);

    expect(resultado).toEqual({ codigo: 3, salida: 'hola' });
  });

  it('ejecutar un comando que no existe sale con un código distinto de 0 y dice por qué', () => {
    const resultado = sistemaReal.ejecutar('comando-que-no-existe-foso', []);

    expect(resultado.codigo).not.toBe(0);
    expect(resultado.salida).toContain('ENOENT');
  });

  it('existe y leer miran el repo', () => {
    expect(sistemaReal.existe('package.json')).toBe(true);
    expect(sistemaReal.existe('no-existe.json')).toBe(false);
    expect(JSON.parse(sistemaReal.leer('package.json'))).toHaveProperty('name', 'taller-agentes');
  });
});
