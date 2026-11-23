// Crea los tres usuarios de demostración (o les pone de nuevo la contraseña si ya existen) y deja
// la demo como al principio. Los usuarios se pueden repetir las veces que haga falta; si la base
// de datos se niega a restablecer la demo (por ejemplo, por la espera de 10 minutos), sale con 1.
//
// Uso: SUPABASE_URL=... SUPABASE_SECRET_KEY=... DEMO_PASSWORD=... node scripts/crear-usuarios-demo.mjs
// Importa USUARIOS_DEMO del TypeScript de la app: pide Node 24 (.nvmrc), que ejecuta .ts sin
// compilar. El aviso MODULE_TYPELESS_PACKAGE_JSON que imprime Node es inofensivo.
import { createClient } from '@supabase/supabase-js';
import { USUARIOS_DEMO } from '../src/aplicacion/acceso.ts';

const VARIABLES = ['SUPABASE_URL', 'SUPABASE_SECRET_KEY', 'DEMO_PASSWORD'];
// Los dos códigos con los que Supabase Auth avisa de que el correo ya está registrado.
const CODIGOS_DE_USUARIO_EXISTENTE = ['email_exists', 'user_already_exists'];
const USUARIOS_POR_PAGINA = 200;

async function buscarIdDe(cliente, email) {
  let pagina = 1;
  for (;;) {
    const { data, error } = await cliente.auth.admin.listUsers({
      page: pagina,
      perPage: USUARIOS_POR_PAGINA,
    });
    if (error) throw error;
    const encontrado = data.users.find((usuario) => usuario.email === email);
    if (encontrado) return encontrado.id;
    if (data.users.length < USUARIOS_POR_PAGINA) throw new Error(`No existe el usuario ${email}`);
    pagina += 1;
  }
}

async function asegurarUsuario(cliente, email, password) {
  const { error } = await cliente.auth.admin.createUser({ email, password, email_confirm: true });
  if (!error) return `Usuario creado: ${email}`;
  if (!CODIGOS_DE_USUARIO_EXISTENTE.includes(error.code)) throw error;

  const id = await buscarIdDe(cliente, email);
  const cambios = { password, email_confirm: true };
  const { error: errorAlActualizar } = await cliente.auth.admin.updateUserById(id, cambios);
  if (errorAlActualizar) throw errorAlActualizar;
  return `Contraseña puesta de nuevo: ${email}`;
}

async function main(entornoCrudo) {
  // Igual que leerEntornoSecreto: los espacios de los bordes se recortan y una contraseña solo con
  // espacios cuenta como ausente. Si no, los usuarios se crearían con una contraseña distinta de la
  // que la app manda al entrar, y nadie podría iniciar sesión.
  const entorno = { ...entornoCrudo, DEMO_PASSWORD: entornoCrudo.DEMO_PASSWORD?.trim() };
  const faltan = VARIABLES.filter((nombre) => !entorno[nombre]);
  if (faltan.length > 0) {
    const avisos = faltan.map((nombre) => `Falta la variable de entorno ${nombre}`);
    process.stderr.write(`${avisos.join('\n')}\n`);
    return 1;
  }

  const cliente = createClient(entorno.SUPABASE_URL, entorno.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  for (const email of Object.values(USUARIOS_DEMO)) {
    process.stdout.write(`${await asegurarUsuario(cliente, email, entorno.DEMO_PASSWORD)}\n`);
  }
  const { error } = await cliente.rpc('restablecer_demo');
  if (error) throw error;
  process.stdout.write('Demo restablecida.\n');
  return 0;
}

main(process.env).then(
  (codigoDeSalida) => {
    process.exitCode = codigoDeSalida;
  },
  (error) => {
    process.stderr.write(`No se pudo preparar la demo: ${error.message}\n`);
    process.exitCode = 1;
  },
);
