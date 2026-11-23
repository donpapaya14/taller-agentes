// Comprueba en la nube los permisos que PGlite no reproduce: en Supabase el dueño de las tablas es
// postgres, que no es superusuario, y los permisos por defecto no son los de PGlite. Solo usa la
// clave publicable (la que tiene cualquier visitante) y las cuentas de demostración, y no deja
// ningún dato cambiado. Las cuentas son las de la demo recién restablecida. Imprime una línea por
// comprobación, OK o FALLO, y sale con 1 si hay algún FALLO.
//
// Uso: node --env-file=.env.local scripts/comprobar-nube.mjs
// Importa USUARIOS_DEMO del TypeScript de la app: pide Node 24 (.nvmrc), que ejecuta .ts sin
// compilar. El aviso MODULE_TYPELESS_PACKAGE_JSON que imprime Node es inofensivo.
import { createClient } from '@supabase/supabase-js';
import { USUARIOS_DEMO } from '../src/aplicacion/acceso.ts';

const VARIABLES = ['SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'DEMO_PASSWORD'];
// Lo que siembra restablecer_demo: Talleres Vega (jefe y mecánico) y Mecánica Ribera (el otro jefe).
const ORDENES_DE_VEGA = 9;
const RECAMBIOS_DE_VEGA = 10;
const ORDENES_DE_RIBERA = 2;
const PERMISO_DENEGADO = '42501';
const ORDEN_QUE_NO_EXISTE = '00000000-0000-0000-0000-000000000000';
const TABLAS_CON_TALLER = [
  'miembros',
  'clientes',
  'vehiculos',
  'recambios',
  'ordenes',
  'orden_lineas',
];

const esPermisoDenegado = (error) => error?.code === PERMISO_DENEGADO;
const describir = (error) => `${error.code ?? 'sin código'}: ${error.message}`;

function crearCliente(entorno) {
  return createClient(entorno.SUPABASE_URL, entorno.SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function entrar(entorno, email) {
  const cliente = crearCliente(entorno);
  const credenciales = { email, password: entorno.DEMO_PASSWORD };
  const { error } = await cliente.auth.signInWithPassword(credenciales);
  return { cliente, error };
}

// El cliente de una sesión que entró bien. Si no entró, falla la comprobación que lo pida.
function clienteDe({ cliente, error }) {
  if (error) throw new Error(`no pudo entrar: ${describir(error)}`);
  return cliente;
}

// Cuántas filas de la tabla ve la sesión: lo decide RLS y el filtro solo acota.
async function contar(cliente, tabla, acotar = (consulta) => consulta) {
  const consulta = cliente.from(tabla).select('*', { count: 'exact', head: true });
  const { count, error } = await acotar(consulta);
  if (error) throw new Error(`select en ${tabla}: ${describir(error)}`);
  return count;
}

// Las cuentas [qué, obtenido, esperado] que no salen como se esperaba; undefined si salen todas.
function cuentasQueNoSalen(cuentas) {
  const mal = cuentas
    .filter(([, obtenido, esperado]) => obtenido !== esperado)
    .map(([que, obtenido, esperado]) => `${que}: ${obtenido} en vez de ${esperado}`);
  return mal.length > 0 ? mal.join('; ') : undefined;
}

// Una función a la que la sesión no tiene derecho tiene que contestar con error de permiso.
function motivoSiNoHayPermisoDenegado({ error }) {
  if (esPermisoDenegado(error)) return undefined;
  return error ? `error inesperado (${describir(error)})` : 'se ejecutó sin error';
}

// Sin sesión no se lee nada: 0 filas o error de permiso.
function motivoDeLecturaSinSesion({ data, error }) {
  if (esPermisoDenegado(error)) return undefined;
  if (error) return `error inesperado (${describir(error)})`;
  return data.length === 0 ? undefined : `devolvió ${data.length} filas`;
}

// El id del taller de una sesión: la política de talleres solo deja ver el propio.
async function tallerDe(sesion) {
  const { data, error } = await clienteDe(sesion).from('talleres').select('id').single();
  if (error) throw new Error(`no se pudo leer su taller: ${describir(error)}`);
  return data.id;
}

async function motivoDeFilasAjenas(jefe, otro) {
  const [tallerAjeno, tallerPropio] = [await tallerDe(otro), await tallerDe(jefe)];
  // Con el mismo taller en las dos cuentas la comprobación saldría bien sin probar nada.
  if (tallerAjeno === tallerPropio) throw new Error('las dos cuentas son del mismo taller');

  const cliente = clienteDe(jefe);
  const cuentas = [];
  for (const tabla of TABLAS_CON_TALLER) {
    const filas = await contar(cliente, tabla, (consulta) => consulta.eq('taller_id', tallerAjeno));
    cuentas.push([tabla, filas, 0]);
  }
  const talleres = await contar(cliente, 'talleres', (consulta) => consulta.eq('id', tallerAjeno));
  return cuentasQueNoSalen([...cuentas, ['talleres', talleres, 0]]);
}

async function motivoDelStock(sesion) {
  const mecanico = clienteDe(sesion);
  const { data: recambios, error } = await mecanico.from('recambios').select('id, stock').limit(1);
  if (error || recambios.length === 0) throw new Error('no ve ningún recambio con el que probar');

  // Pide el stock que el recambio ya tiene, no cero: si la política fallara, el dato seguiría igual.
  // Hace falta algún filtro: Supabase rechaza un update sin where.
  const [{ id, stock }] = recambios;
  const cambio = await mecanico.from('recambios').update({ stock }).eq('id', id).select('id');
  if (cambio.error) return `error inesperado (${describir(cambio.error)})`;
  return cambio.data.length === 0 ? undefined : `cambió ${cambio.data.length} fila`;
}

async function motivoDeEntregar(sesion) {
  const mecanico = clienteDe(sesion);
  const listas = await mecanico.from('ordenes').select('id').eq('estado', 'listo').limit(1);
  if (listas.error || listas.data.length === 0) {
    throw new Error('no ve ninguna orden en «Listo» con la que probar');
  }

  // Si la barrera fallara, esto entregaría la orden: restablecer_demo deja la demo como estaba.
  const { error } = await mecanico.rpc('cerrar_orden', { p_orden: listas.data[0].id });
  if (error?.message === 'SOLO_JEFE') return undefined;
  return `esperaba SOLO_JEFE y llegó ${error ? describir(error) : 'una entrega sin error'}`;
}

async function motivoDelJefe(sesion) {
  const jefe = clienteDe(sesion);
  return cuentasQueNoSalen([
    ['órdenes', await contar(jefe, 'ordenes'), ORDENES_DE_VEGA],
    ['recambios', await contar(jefe, 'recambios'), RECAMBIOS_DE_VEGA],
  ]);
}

async function motivoDelOtroJefe(sesion) {
  const ordenes = await contar(clienteDe(sesion), 'ordenes');
  return cuentasQueNoSalen([['órdenes', ordenes, ORDENES_DE_RIBERA]]);
}

// Cada comprobación devuelve el motivo del fallo, o undefined si sale bien. Si lanza, también falla.
async function comprobar(nombre, prueba) {
  let motivo;
  try {
    motivo = await prueba();
  } catch (error) {
    motivo = error.message;
  }
  process.stdout.write(motivo ? `FALLO ${nombre}: ${motivo}\n` : `OK    ${nombre}\n`);
  return !motivo;
}

function pruebasSinSesion(anonimo) {
  return [
    [
      '(1) sin sesión, select en ordenes no devuelve filas',
      async () => motivoDeLecturaSinSesion(await anonimo.from('ordenes').select('id')),
    ],
    [
      "(2) sin sesión, rpc('cerrar_orden') da error de permiso",
      async () =>
        motivoSiNoHayPermisoDenegado(
          await anonimo.rpc('cerrar_orden', { p_orden: ORDEN_QUE_NO_EXISTE }),
        ),
    ],
    [
      "(2) sin sesión, rpc('restablecer_demo') da error de permiso",
      async () => motivoSiNoHayPermisoDenegado(await anonimo.rpc('restablecer_demo')),
    ],
  ];
}

function pruebasConSesion({ jefe, mecanico, otro }) {
  return [
    [
      `(3) el jefe entra y ve ${ORDENES_DE_VEGA} órdenes y ${RECAMBIOS_DE_VEGA} recambios`,
      () => motivoDelJefe(jefe),
    ],
    ['(4) el jefe no ve ninguna fila del otro taller', () => motivoDeFilasAjenas(jefe, otro)],
    [
      "(4) el jefe recibe error de permiso en rpc('restablecer_demo')",
      async () => motivoSiNoHayPermisoDenegado(await clienteDe(jefe).rpc('restablecer_demo')),
    ],
    ['(5) el mecánico no cambia el stock de un recambio', () => motivoDelStock(mecanico)],
    ['(5) el mecánico recibe SOLO_JEFE al entregar una orden', () => motivoDeEntregar(mecanico)],
    [`(6) el jefe del otro taller ve ${ORDENES_DE_RIBERA} órdenes`, () => motivoDelOtroJefe(otro)],
  ];
}

async function main(entorno) {
  const faltan = VARIABLES.filter((nombre) => !entorno[nombre]);
  if (faltan.length > 0) {
    throw new Error(`Faltan las variables de entorno: ${faltan.join(', ')}`);
  }

  const sesiones = {
    jefe: await entrar(entorno, USUARIOS_DEMO.jefe),
    mecanico: await entrar(entorno, USUARIOS_DEMO.mecanico),
    otro: await entrar(entorno, USUARIOS_DEMO.otro),
  };
  const pruebas = [...pruebasSinSesion(crearCliente(entorno)), ...pruebasConSesion(sesiones)];
  const salenBien = [];
  for (const [nombre, prueba] of pruebas) {
    salenBien.push(await comprobar(nombre, prueba));
  }
  return salenBien.every(Boolean) ? 0 : 1;
}

main(process.env).then(
  (codigoDeSalida) => {
    process.exitCode = codigoDeSalida;
  },
  (error) => {
    process.stderr.write(`No se pudo comprobar la nube: ${error.message}\n`);
    process.exitCode = 1;
  },
);
