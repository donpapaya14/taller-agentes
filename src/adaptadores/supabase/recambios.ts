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

// Una referencia repetida en el taller no es un fallo: no se guarda y se dice con false. Cualquier
// otro error, también el de la política de RLS cuando escribe un mecánico, lanza un mensaje.
function noHuboFallo(error: PostgrestError | null): boolean {
  if (error === null) return true;
  if (error.code === VIOLACION_DE_UNICIDAD) return false;
  throw new Error(MENSAJES.guardar);
}

// Sin id crea el recambio; con id edita ese. Siempre con insert o update y solo las columnas que la
// API deja escribir: un upsert chocaría con los permisos por columna.
export async function guardarRecambio(d: RecambioAGuardar, tallerId: string): Promise<boolean> {
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
    return noHuboFallo(error);
  }

  const { data, error } = await cliente
    .from('recambios')
    .update(columnas)
    .eq('id', d.id)
    .select('id');
  return noHuboFallo(error) && algunaFilaTocada(data);
}
