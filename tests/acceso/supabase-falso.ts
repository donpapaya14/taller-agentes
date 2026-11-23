import { createServer, type IncomingHttpHeaders, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

export type Peticion = {
  metodo: string;
  ruta: string;
  cuerpo: string;
  cabeceras: IncomingHttpHeaders;
};

export type Contestar = (peticion: Peticion, respuesta: ServerResponse) => void;

// Un Supabase falso con HTTP de verdad, en un puerto libre de este equipo. Lo que contesta, o que
// no contesta, lo decide `contestar`: así los tests pasan por las librerías reales, con sus
// reintentos y sus esperas, y no por un mock de ellas.
export async function iniciarServidorFalso(contestar: Contestar) {
  const peticiones: Peticion[] = [];
  const servidor = createServer((entrante, respuesta) => {
    const trozos: Buffer[] = [];
    entrante.on('data', (trozo: Buffer) => trozos.push(trozo));
    entrante.on('end', () => {
      const peticion: Peticion = {
        metodo: entrante.method ?? 'GET',
        ruta: (entrante.url ?? '/').split('?')[0],
        cuerpo: Buffer.concat(trozos).toString('utf8'),
        cabeceras: entrante.headers,
      };
      peticiones.push(peticion);
      contestar(peticion, respuesta);
    });
  });
  await new Promise<void>((listo) => servidor.listen(0, '127.0.0.1', listo));
  const { port } = servidor.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    peticiones,
    // Las conexiones que cuelgan no se cierran solas.
    cerrar: () =>
      new Promise<void>((listo) => {
        servidor.closeAllConnections();
        servidor.close(() => listo());
      }),
  };
}

export function responderJson(respuesta: ServerResponse, estado: number, cuerpo?: unknown): void {
  respuesta.writeHead(estado, { 'content-type': 'application/json' }).end(JSON.stringify(cuerpo));
}
