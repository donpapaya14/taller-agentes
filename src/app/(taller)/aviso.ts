import { cookies } from 'next/headers';
import { z } from 'zod';

// Lo que una acción de servidor le cuenta a la pantalla que la lanzó. Un formulario sin JavaScript
// del lado cliente no recibe lo que devuelve su acción, así que el aviso viaja en una cookie que
// solo escribe el servidor: el texto nunca sale de la dirección ni del navegador.
export type Aviso = { tipo: 'ok' | 'error'; texto: string };

export type Resultado = { ok: true; aviso?: string } | { ok: false; motivo: string };

const NOMBRE = 'foso-aviso';

// Una página no puede borrar la cookie al leerla (solo las acciones escriben cookies), así que una
// recarga inmediata aún ve el aviso. Vive lo justo para llegar a la pantalla, y cada acción borra
// el anterior antes de hacer lo suyo: no se arrastra.
const VIDA_EN_SEGUNDOS = 10;

const ESQUEMA = z.strictObject({
  tipo: z.enum(['ok', 'error']),
  texto: z.string().min(1).max(300),
});

export async function avisar(aviso: Aviso): Promise<void> {
  const almacen = await cookies();
  almacen.set(NOMBRE, JSON.stringify(aviso), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: VIDA_EN_SEGUNDOS,
  });
}

// Una cookie que no es JSON no la escribió esta aplicación: no hay aviso.
function comoJson(texto: string): unknown {
  try {
    return JSON.parse(texto);
  } catch {
    return null;
  }
}

export async function leerAviso(): Promise<Aviso | null> {
  const almacen = await cookies();
  const valor = almacen.get(NOMBRE)?.value;
  if (valor === undefined) return null;

  const aviso = ESQUEMA.safeParse(comoJson(valor));
  return aviso.success ? aviso.data : null;
}

export async function limpiarAviso(): Promise<void> {
  const almacen = await cookies();
  almacen.delete(NOMBRE);
}

// Cuenta lo que pasó con una operación de la pantalla. Lo que no va bien se dice con su motivo; una
// excepción del repositorio no llega a la pantalla de error, sino a quien lanzó la acción, con un
// texto en español. El texto de la excepción no se usa: puede venir en inglés o nombrar la base de
// datos.
export async function contarResultado(
  operacion: () => Promise<Resultado>,
  motivoSiLanza: string,
): Promise<void> {
  let resultado: Resultado;
  try {
    resultado = await operacion();
  } catch {
    resultado = { ok: false, motivo: motivoSiLanza };
  }

  if (!resultado.ok) await avisar({ tipo: 'error', texto: resultado.motivo });
  else if (resultado.aviso !== undefined) await avisar({ tipo: 'ok', texto: resultado.aviso });
}
