'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { crearClienteServidor } from '@/adaptadores/supabase/cliente-servidor';
import { ErrorDeEntorno } from '@/adaptadores/supabase/entorno';
import { leerEntornoSecreto } from '@/adaptadores/supabase/entorno-secreto';
import { esFalloDeRedOTiempo } from '@/adaptadores/supabase/tiempo-limite';
import { USUARIOS_DEMO } from '@/aplicacion/acceso';

type Estado = { error: string | null };

type Resultado = 'ok' | 'rechazado' | 'sin_servicio';

const DATOS_NO_VALIDOS = 'Escribe un correo y una contraseña válidos';
const CREDENCIALES_INCORRECTAS = 'Correo o contraseña incorrectos';
const SIN_SERVICIO =
  'El servicio no está disponible ahora mismo. Inténtalo de nuevo en unos minutos.';

// La página de acceso enseña el texto de este aviso: el código es todo lo que viaja en la dirección.
const AVISO_DE_DEMO = '/login?error=demo';

// Los límites cortan lo que ningún formulario real manda antes de que llegue a Supabase.
const esquemaCredenciales = z.object({
  correo: z.string().trim().max(254).pipe(z.email()),
  contrasena: z.string().min(1).max(256),
});

// Solo los dos accesos que ofrece el login; los demás usuarios de demostración no se piden desde él.
const esquemaRolDeDemo = z.enum(['jefe', 'mecanico']);

// Auth contesta 4xx cuando rechaza la cuenta. Cualquier otro estado (red, 5xx, límite de peticiones)
// quiere decir que no ha podido decidir, y decir «contraseña incorrecta» sería mentir.
const esRechazo = (estado: number | undefined) =>
  estado !== undefined && estado >= 400 && estado < 500 && estado !== 429;

async function iniciarSesion(correo: string, contrasena: string): Promise<Resultado> {
  try {
    const cliente = await crearClienteServidor();
    const { error } = await cliente.auth.signInWithPassword({
      email: correo,
      password: contrasena,
    });
    if (error === null) return 'ok';
    return esRechazo(error.status) ? 'rechazado' : 'sin_servicio';
  } catch (error) {
    if (error instanceof ErrorDeEntorno || esFalloDeRedOTiempo(error)) return 'sin_servicio';
    throw error;
  }
}

export async function entrar(estadoPrevio: Estado, datos: FormData): Promise<Estado> {
  const credenciales = esquemaCredenciales.safeParse({
    correo: datos.get('correo'),
    contrasena: datos.get('contrasena'),
  });
  if (!credenciales.success) return { error: DATOS_NO_VALIDOS };

  const resultado = await iniciarSesion(credenciales.data.correo, credenciales.data.contrasena);
  if (resultado === 'ok') redirect('/tablero');
  return { error: resultado === 'rechazado' ? CREDENCIALES_INCORRECTAS : SIN_SERVICIO };
}

// null si el entorno no la trae: sin ella no se puede entrar, pero tampoco hay que romper la página.
function contrasenaDeDemo(): string | null {
  try {
    return leerEntornoSecreto().demoPassword;
  } catch (error) {
    if (error instanceof ErrorDeEntorno) return null;
    throw error;
  }
}

async function iniciarSesionDeDemo(rol: 'jefe' | 'mecanico'): Promise<Resultado> {
  const contrasena = contrasenaDeDemo();
  return contrasena === null ? 'sin_servicio' : iniciarSesion(USUARIOS_DEMO[rol], contrasena);
}

// La contraseña de demostración solo existe aquí, en el servidor: el navegador manda el rol y nada más.
export async function entrarComoDemo(datos: FormData): Promise<void> {
  const rol = esquemaRolDeDemo.safeParse(datos.get('rol'));
  const resultado = rol.success ? await iniciarSesionDeDemo(rol.data) : 'rechazado';
  redirect(resultado === 'ok' ? '/tablero' : AVISO_DE_DEMO);
}

// Los usuarios de demostración los comparten varias personas a la vez: un cierre global de sesión
// echaría a todas. Con scope local solo se borra la sesión de este navegador.
export async function salir(): Promise<void> {
  const cliente = await crearClienteServidor();
  await cliente.auth.signOut({ scope: 'local' });
  redirect('/login');
}
