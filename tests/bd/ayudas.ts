// Lo que comparten los tests de base de datos además del arnés: cambiar de rol dentro de la
// transacción de `como` y mirar el resultado de un intento que puede fallar.
import type { Sql } from './arnes';

// Dentro de `como`, lo que la API no deja (abrir un permiso, sembrar filas, mirar las de otro
// taller) se hace volviendo un momento al superusuario. Después se vuelve a authenticated con el
// mismo usuario, y `como` deshace todo al salir.
export async function comoSuperusuario<T>(sql: Sql, fn: () => Promise<T>): Promise<T> {
  await sql('reset role');
  const resultado = await fn();
  await sql('set local role authenticated');
  return resultado;
}

// Sigue dentro de `como`, pero con la sesión de otro usuario autenticado.
export async function pasarAUsuario(sql: Sql, usuarioId: string): Promise<void> {
  await sql('reset role');
  await sql(`select set_config('request.jwt.claim.sub', $1, true)`, [usuarioId]);
  await sql('set local role authenticated');
}

// Ejecuta `texto` en un punto de guardado: si falla, deshace solo eso y devuelve el mensaje del
// error (null si salió bien), para mirar después en qué estado quedó todo sin salir de la misma
// transacción.
export async function intentar(
  sql: Sql,
  texto: string,
  parametros: unknown[] = [],
): Promise<string | null> {
  await sql('savepoint intento');
  try {
    await sql(texto, parametros);
    await sql('release savepoint intento');
    return null;
  } catch (error) {
    await sql('rollback to savepoint intento');
    return error instanceof Error ? error.message : String(error);
  }
}

// El primer valor de la primera fila, para las consultas que devuelven una sola cosa.
export async function valor(sql: Sql, texto: string, parametros: unknown[] = []): Promise<unknown> {
  const [fila] = await sql(texto, parametros);
  return fila === undefined ? undefined : Object.values(fila)[0];
}
