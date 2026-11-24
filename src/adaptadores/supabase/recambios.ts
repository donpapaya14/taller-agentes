import type { PostgrestError } from '@supabase/supabase-js';
import { z } from 'zod';
import { crearClienteServidor } from './cliente-servidor';
import {
  algunaFilaTocada,
  filaRecambio,
  leerFilas,
  SELECCION_RECAMBIO,
  type Recambio,
} from './filas';

// La misma forma que `DatosRecambio` de la capa de aplicación, con el id cuando se edita: un
// adaptador no puede importar de esa capa.
type RecambioAGuardar = {
  referencia: string;
  nombre: string;
  precioCentimos: number;
  stock: number;
  stockMinimo: number;
  id?: string;
};

// Por qué no se guardó. Una referencia repetida se corrige en el formulario; el resto es un recambio
// que no se tocó: es de otro taller, ya no existe o lo edita quien no puede (la política de RLS no
// le deja ver la fila y el update no afecta a ninguna).
type Resultado =
  { ok: true } | { ok: false; motivo: 'referencia_repetida' | 'sin_permiso_o_no_encontrado' };

const GUARDADO: Resultado = { ok: true };
const REFERENCIA_REPETIDA: Resultado = { ok: false, motivo: 'referencia_repetida' };
const SIN_PERMISO_O_NO_ENCONTRADO: Resultado = {
  ok: false,
  motivo: 'sin_permiso_o_no_encontrado',
};

const VIOLACION_DE_UNICIDAD = '23505';

const MENSAJES = {
  leer: 'No se pudieron cargar los recambios. Inténtalo de nuevo en unos minutos.',
  guardar: 'No se pudo guardar el recambio. Inténtalo de nuevo.',
};

export async function listarRecambios(): Promise<Recambio[]> {
  const cliente = await crearClienteServidor();
  const { data, error } = await cliente
    .from('recambios')
    .select(SELECCION_RECAMBIO)
    .order('referencia');
  if (error) throw new Error(MENSAJES.leer);

  return leerFilas(z.array(filaRecambio), data, 'los recambios');
}

// Una referencia repetida en el taller no es un fallo: no se guarda y se dice por qué. Sin error es
// que la base de datos aceptó el cambio (null). Cualquier otro error, también el de la política de
// RLS cuando inserta un mecánico, lanza un mensaje.
function rechazoDe(error: PostgrestError | null): Resultado | null {
  if (error === null) return null;
  if (error.code === VIOLACION_DE_UNICIDAD) return REFERENCIA_REPETIDA;
  throw new Error(MENSAJES.guardar);
}

// Sin id crea el recambio; con id edita ese. Siempre con insert o update y solo las columnas que la
// API deja escribir: un upsert chocaría con los permisos por columna.
export async function guardarRecambio(d: RecambioAGuardar, tallerId: string): Promise<Resultado> {
  const cliente = await crearClienteServidor();
  const columnas = {
    referencia: d.referencia,
    nombre: d.nombre,
    precio_centimos: d.precioCentimos,
    stock: d.stock,
    stock_minimo: d.stockMinimo,
  };

  if (d.id === undefined) {
    const { error } = await cliente.from('recambios').insert({ taller_id: tallerId, ...columnas });
    return rechazoDe(error) ?? GUARDADO;
  }

  const { data, error } = await cliente
    .from('recambios')
    .update(columnas)
    .eq('id', d.id)
    .select('id');
  const rechazo = rechazoDe(error);
  if (rechazo !== null) return rechazo;
  return algunaFilaTocada(data) ? GUARDADO : SIN_PERMISO_O_NO_ENCONTRADO;
}
