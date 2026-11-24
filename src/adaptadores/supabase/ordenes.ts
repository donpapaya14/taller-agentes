import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { Estado } from '@/nucleo/orden';
import { crearClienteServidor } from './cliente-servidor';
import {
  algunaFilaTocada,
  filaId,
  filaOrdenDetalle,
  filaOrdenResumen,
  filaVehiculo,
  leerFilas,
  SELECCION_ORDEN_DETALLE,
  SELECCION_ORDEN_RESUMEN,
  SELECCION_VEHICULO,
  type OrdenDetalle,
  type OrdenResumen,
} from './filas';

type VehiculoNuevo = {
  matricula: string;
  marca: string;
  modelo: string;
  clienteNombre: string;
  clienteTelefono: string;
};

// La misma forma que `DatosOrden` de la capa de aplicación, que un adaptador no puede importar.
type NuevaOrden = { descripcion: string } & ({ vehiculoId: string } | VehiculoNuevo);

const DIAS_DE_ENTREGADAS = 7;
const MS_POR_DIA = 24 * 60 * 60 * 1000;
const VIOLACION_DE_UNICIDAD = '23505';
const INTERBLOQUEO = '40P01';

// Lo que falla por dentro (red, permisos, SQL) no le sirve a quien usa la pantalla: se le dice qué
// no se pudo hacer y que lo reintente.
const MENSAJES = {
  leerOrdenes: 'No se pudieron cargar las órdenes. Inténtalo de nuevo en unos minutos.',
  leerOrden: 'No se pudo cargar la orden. Inténtalo de nuevo en unos minutos.',
  leerVehiculos: 'No se pudieron cargar los vehículos. Inténtalo de nuevo en unos minutos.',
  crear: 'No se pudo crear la orden. Inténtalo de nuevo.',
  matriculaRepetida: 'Ya hay un vehículo con esa matrícula. Elígelo en la lista de vehículos.',
  mover: 'No se pudo mover la orden. Inténtalo de nuevo.',
  manoObra: 'No se pudo guardar la mano de obra. Inténtalo de nuevo.',
  anadir: 'No se pudo añadir el recambio. Inténtalo de nuevo.',
  cantidad: 'No se pudo cambiar la cantidad. Inténtalo de nuevo.',
  quitar: 'No se pudo quitar el recambio. Inténtalo de nuevo.',
  sinNumero: 'La base de datos no devolvió el número de factura',
};

// La pantalla de nueva orden dice este fallo junto al campo de la matrícula, y para eso lo distingue
// de los demás, que no son más que «no se pudo».
export class MatriculaRepetida extends Error {
  constructor() {
    super(MENSAJES.matriculaRepetida);
  }
}

// Lo que Postgres responde por su cuenta al cerrar una orden, con su mensaje en inglés: el
// interbloqueo de dos entregas a la vez y la clave repetida del número de factura (el contador de
// facturas desajustado). Se les da un nombre, como a los errores que lanza `cerrar_orden`, para que
// el caso de uso los traduzca. Es un Map: una clave como «constructor» no encuentra nada heredado.
const ERRORES_DE_POSTGRES_AL_CERRAR = new Map([
  [INTERBLOQUEO, 'INTERBLOQUEO'],
  [VIOLACION_DE_UNICIDAD, 'NUMERO_REPETIDO'],
]);

const NUMERO_DE_FACTURA = z.string().min(1);

const haceUnaSemana = () => new Date(Date.now() - DIAS_DE_ENTREGADAS * MS_POR_DIA).toISOString();

// Las abiertas y las entregadas en los últimos 7 días, las más antiguas primero: son las que
// llevan más tiempo esperando.
export async function listarOrdenes(): Promise<OrdenResumen[]> {
  const cliente = await crearClienteServidor();
  const { data, error } = await cliente
    .from('ordenes')
    .select(SELECCION_ORDEN_RESUMEN)
    .or(`estado.neq.entregado,entregada_en.gte.${haceUnaSemana()}`)
    .order('creada_en', { ascending: true });
  if (error) throw new Error(MENSAJES.leerOrdenes);

  return leerFilas(z.array(filaOrdenResumen), data, 'las órdenes');
}

export async function leerOrden(id: string): Promise<OrdenDetalle | null> {
  // El id viene de la dirección de la página: uno que no es un uuid no es de ninguna orden, y
  // Postgres lo rechazaría con un error en vez de decir que no existe.
  if (!filaId.safeParse({ id }).success) return null;

  const cliente = await crearClienteServidor();
  const { data, error } = await cliente
    .from('ordenes')
    .select(SELECCION_ORDEN_DETALLE)
    .eq('id', id)
    .maybeSingle();
  // El error de Supabase va como causa: quien captura distingue «la base de datos dijo que no» de un
  // fallo de programación, y solo este último hay que relanzarlo.
  if (error) throw new Error(MENSAJES.leerOrden, { cause: error });

  return data === null ? null : leerFilas(filaOrdenDetalle, data, 'la orden');
}

export async function listarVehiculos(): Promise<
  { id: string; matricula: string; etiqueta: string }[]
> {
  const cliente = await crearClienteServidor();
  const { data, error } = await cliente
    .from('vehiculos')
    .select(SELECCION_VEHICULO)
    .order('matricula');
  if (error) throw new Error(MENSAJES.leerVehiculos);

  return leerFilas(z.array(filaVehiculo), data, 'los vehículos');
}

// `repetida` es el error de una clave repetida, si esa tabla tiene alguna que pueda repetirse.
async function insertar(
  cliente: SupabaseClient,
  tabla: string,
  fila: object,
  repetida?: () => Error,
): Promise<string> {
  const { data, error } = await cliente.from(tabla).insert(fila).select('id').single();
  if (error?.code === VIOLACION_DE_UNICIDAD && repetida) throw repetida();
  if (error) throw new Error(MENSAJES.crear);

  return leerFilas(filaId, data, 'lo que se acaba de crear').id;
}

async function crearVehiculoNuevo(
  cliente: SupabaseClient,
  d: VehiculoNuevo,
  tallerId: string,
): Promise<string> {
  // Antes de crear el cliente: con la matrícula repetida no queda un cliente suelto.
  const { data, error } = await cliente
    .from('vehiculos')
    .select('id')
    .eq('matricula', d.matricula)
    .maybeSingle();
  if (error) throw new Error(MENSAJES.crear);
  if (leerFilas(filaId.nullable(), data, 'los vehículos') !== null) throw new MatriculaRepetida();

  const clienteId = await insertar(cliente, 'clientes', {
    taller_id: tallerId,
    nombre: d.clienteNombre,
    telefono: d.clienteTelefono,
  });
  // Otra persona pudo crear la misma matrícula entre la comprobación de arriba y este insert: la
  // clave única de Postgres lo rechaza y se dice lo mismo.
  return insertar(
    cliente,
    'vehiculos',
    {
      taller_id: tallerId,
      cliente_id: clienteId,
      matricula: d.matricula,
      marca: d.marca,
      modelo: d.modelo,
    },
    () => new MatriculaRepetida(),
  );
}

// Con un vehículo nuevo crea también su cliente. Son inserciones sueltas, no una transacción: si
// falla una de las últimas, el cliente (y el vehículo) ya creados se quedan.
export async function crearOrden(d: NuevaOrden, tallerId: string): Promise<{ id: string }> {
  const cliente = await crearClienteServidor();
  const vehiculoId =
    'vehiculoId' in d ? d.vehiculoId : await crearVehiculoNuevo(cliente, d, tallerId);
  const id = await insertar(cliente, 'ordenes', {
    taller_id: tallerId,
    vehiculo_id: vehiculoId,
    descripcion: d.descripcion,
  });

  return { id };
}

// Solo cambia si la orden sigue en el estado `de`: si otra persona la movió antes, no toca nada y
// devuelve false.
export async function cambiarEstado(id: string, de: Estado, a: Estado): Promise<boolean> {
  const cliente = await crearClienteServidor();
  const { data, error } = await cliente
    .from('ordenes')
    .update({ estado: a })
    .eq('id', id)
    .eq('estado', de)
    .select('id');
  if (error) throw new Error(MENSAJES.mover);

  return algunaFilaTocada(data);
}

export async function guardarManoObra(id: string, minutos: number): Promise<boolean> {
  const cliente = await crearClienteServidor();
  const { data, error } = await cliente
    .from('ordenes')
    .update({ mano_obra_minutos: minutos })
    .eq('id', id)
    .select('id');
  if (error) throw new Error(MENSAJES.manoObra);

  return algunaFilaTocada(data);
}

// No envía el precio: lo copia del recambio el disparador `orden_lineas_precio`, y la API no deja
// escribirlo. False si el recambio ya está en la orden (hay una sola línea por recambio).
export async function anadirLinea(d: {
  ordenId: string;
  recambioId: string;
  cantidad: number;
  tallerId: string;
}): Promise<boolean> {
  const cliente = await crearClienteServidor();
  const { error } = await cliente.from('orden_lineas').insert({
    taller_id: d.tallerId,
    orden_id: d.ordenId,
    recambio_id: d.recambioId,
    cantidad: d.cantidad,
  });
  if (error?.code === VIOLACION_DE_UNICIDAD) return false;
  if (error) throw new Error(MENSAJES.anadir);

  return true;
}

// El precio no cambia: es el que tenía el recambio al añadirlo. False si la línea ya no está o la
// orden ya se entregó (la política de RLS no la deja ver para cambiarla).
export async function cambiarCantidad(lineaId: string, cantidad: number): Promise<boolean> {
  const cliente = await crearClienteServidor();
  const { data, error } = await cliente
    .from('orden_lineas')
    .update({ cantidad })
    .eq('id', lineaId)
    .select('id');
  if (error) throw new Error(MENSAJES.cantidad);

  return algunaFilaTocada(data);
}

export async function quitarLinea(lineaId: string): Promise<boolean> {
  const cliente = await crearClienteServidor();
  const { data, error } = await cliente
    .from('orden_lineas')
    .delete()
    .eq('id', lineaId)
    .select('id');
  if (error) throw new Error(MENSAJES.quitar);

  return algunaFilaTocada(data);
}

// El error es el mensaje de la excepción de Postgres tal cual (SOLO_JEFE, STOCK_INSUFICIENTE:…) o,
// para los dos que Postgres da por su cuenta, su nombre (INTERBLOQUEO, NUMERO_REPETIDO): el caso de
// uso es quien lo traduce.
export async function rpcCerrar(id: string): Promise<{ numero: string } | { error: string }> {
  const cliente = await crearClienteServidor();
  const { data, error } = await cliente.rpc('cerrar_orden', { p_orden: id });
  if (error) return { error: ERRORES_DE_POSTGRES_AL_CERRAR.get(error.code) ?? error.message };

  const numero = NUMERO_DE_FACTURA.safeParse(data);
  return numero.success ? { numero: numero.data } : { error: MENSAJES.sinNumero };
}
