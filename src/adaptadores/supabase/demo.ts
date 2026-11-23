import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { crearClienteSecreto } from './cliente-secreto';
import { leerEntornoSecreto } from './entorno-secreto';

const USUARIOS_POR_PAGINA = 200;

const respuestaDeRestablecer = z.string();
const paginaDeUsuarios = z.object({
  users: z.array(z.object({ id: z.string().min(1), email: z.string().optional() })),
});

// Un error de Supabase como excepción de verdad, con su mensaje y el original como causa.
const comoExcepcion = (error: { message: string }) => new Error(error.message, { cause: error });

// Solo la clave secreta puede ejecutar restablecer_demo: ni anon ni authenticated.
export async function rpcRestablecer(): Promise<string> {
  const { data, error } = await crearClienteSecreto().rpc('restablecer_demo');
  if (error) throw comoExcepcion(error);
  return respuestaDeRestablecer.parse(data);
}

// Una página de la lista de usuarios de Auth, ya comprobada.
async function usuariosDeLaPagina(cliente: SupabaseClient, pagina: number) {
  const { data, error } = await cliente.auth.admin.listUsers({
    page: pagina,
    perPage: USUARIOS_POR_PAGINA,
  });
  if (error) throw comoExcepcion(error);
  return paginaDeUsuarios.parse(data).users;
}

// Auth no busca por correo: se recorren sus páginas hasta tener a todos. Devuelve los ids en el
// orden de los correos. Si falta alguien lanza antes de que se cambie ninguna contraseña.
async function buscarIds(cliente: SupabaseClient, correos: readonly string[]): Promise<string[]> {
  const pendientes = new Set(correos);
  const encontrados = new Map<string, string>();
  let pagina = 1;
  let hayMasPaginas = true;
  while (pendientes.size > 0 && hayMasPaginas) {
    const usuarios = await usuariosDeLaPagina(cliente, pagina);
    for (const { id, email } of usuarios) {
      if (email !== undefined && pendientes.delete(email)) encontrados.set(email, id);
    }
    hayMasPaginas = usuarios.length >= USUARIOS_POR_PAGINA;
    pagina += 1;
  }
  return correos.map((correo) => {
    const id = encontrados.get(correo);
    if (id === undefined) throw new Error(`No existe el usuario ${correo}`);
    return id;
  });
}

// Quien probó la demo pudo cambiar una contraseña: tras restablecerla vuelven a ser DEMO_PASSWORD.
// Los correos los pone quien llama: este módulo no importa los casos de uso (regla de capas).
export async function reponerContrasenas(correos: readonly string[]): Promise<void> {
  const cliente = crearClienteSecreto();
  const { demoPassword } = leerEntornoSecreto();
  for (const id of await buscarIds(cliente, correos)) {
    const { error } = await cliente.auth.admin.updateUserById(id, { password: demoPassword });
    if (error) throw comoExcepcion(error);
  }
}
