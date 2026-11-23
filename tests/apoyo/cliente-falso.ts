import { vi } from 'vitest';

// Un cliente de Supabase de pega para probar los repositorios sin red ni base de datos.
// Cada `from()` o `rpc()` abre una consulta que anota los métodos que se le encadenan y, al
// esperarla (`await`), contesta con la respuesta que se preparó para ella, por orden de apertura.

export type Respuesta = { data: unknown; error: { message: string; code?: string } | null };

// Un método encadenado y sus argumentos: ['eq', 'id', '123'].
export type Llamada = [metodo: string, ...argumentos: unknown[]];

const SIN_RESPUESTA: Respuesta = { data: null, error: { message: 'Sin respuesta preparada' } };

export const bien = (data: unknown): Respuesta => ({ data, error: null });

export const mal = (message: string, code?: string): Respuesta => ({
  data: null,
  error: { message, code },
});

// Lo que responde Postgres (código 23505) al insertar una fila que repite una clave única.
export const claveRepetida = mal('duplicate key value violates unique constraint', '23505');

// El módulo `cliente-servidor` de pega. Cada test de repositorio lo pone en lugar del de verdad
// (su mock devuelve esto mismo, importado desde aquí) y lo rellena con `preparar`.
export const clienteServidorFalso = { crearClienteServidor: vi.fn() };

function fingirCliente(respuestas: Respuesta[]) {
  const consultas: Llamada[][] = [];

  function abrir(primera: Llamada): unknown {
    const llamadas = [primera];
    const respuesta = respuestas[consultas.length] ?? SIN_RESPUESTA;
    consultas.push(llamadas);

    const cadena: unknown = new Proxy(
      {},
      {
        get: (_objetivo, metodo) => {
          if (metodo === 'then')
            return (resolver: (r: Respuesta) => unknown) => resolver(respuesta);
          return (...argumentos: unknown[]) => {
            llamadas.push([String(metodo), ...argumentos]);
            return cadena;
          };
        },
      },
    );
    return cadena;
  }

  const cliente = {
    from: (tabla: string) => abrir(['from', tabla]),
    rpc: (nombre: string, argumentos: unknown) => abrir(['rpc', nombre, argumentos]),
  };

  return { cliente, consultas };
}

// Hace que `crearClienteServidor` devuelva un cliente que contesta con estas respuestas, una por
// consulta, y entrega la lista de consultas, que se va llenando según el repositorio las abre.
export function preparar(...respuestas: Respuesta[]): Llamada[][] {
  const { cliente, consultas } = fingirCliente(respuestas);
  clienteServidorFalso.crearClienteServidor.mockResolvedValue(cliente);
  return consultas;
}
