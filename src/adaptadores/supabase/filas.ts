import { z } from 'zod';
import { ESTADOS, type Estado } from '@/nucleo/orden';

// Los tipos que leen los repositorios son de este adaptador: las pantallas los adaptan a lo que
// pinten, y los adaptadores no pueden importar de `ui`.
export type OrdenResumen = {
  id: string;
  estado: Estado;
  descripcion: string;
  matricula: string;
  vehiculo: string;
  cliente: string;
  entregadaEn: string | null;
};

type LineaDeOrden = {
  id: string;
  recambioId: string;
  referencia: string;
  nombre: string;
  cantidad: number;
  precioUnitarioCentimos: number;
};

export type OrdenDetalle = OrdenResumen & {
  clienteTelefono: string;
  marca: string;
  modelo: string;
  manoObraMinutos: number;
  precioHoraCentimos: number;
  numeroFactura: string | null;
  creadaEn: string;
  lineas: LineaDeOrden[];
};

export type Recambio = {
  id: string;
  referencia: string;
  nombre: string;
  precioCentimos: number;
  stock: number;
  stockMinimo: number;
};

type VehiculoDeLista = { id: string; matricula: string; etiqueta: string };

// Cada selección pide justo las columnas de su esquema, más abajo: si cambia una, cambia la otra.
const VEHICULO_Y_CLIENTE = 'vehiculos(matricula, marca, modelo, clientes(nombre, telefono))';
const RECAMBIO = 'recambios(referencia, nombre)';
const LINEAS = `orden_lineas(id, recambio_id, cantidad, precio_unitario_centimos, ${RECAMBIO})`;

export const SELECCION_ORDEN_RESUMEN = [
  'id, estado, descripcion, entregada_en',
  VEHICULO_Y_CLIENTE,
].join(', ');

export const SELECCION_ORDEN_DETALLE = [
  SELECCION_ORDEN_RESUMEN,
  'mano_obra_minutos, precio_hora_centimos, numero_factura, creada_en',
  LINEAS,
].join(', ');

export const SELECCION_VEHICULO = 'id, matricula, marca, modelo';

export const SELECCION_RECAMBIO = 'id, referencia, nombre, precio_centimos, stock, stock_minimo';

// Un uuid de Postgres es cualquier 8-4-4-4-12 en hexadecimal; `z.uuid()` exigiría además versión y
// variante de la RFC, que unos datos de demostración escritos a mano pueden no cumplir.
const id = z.guid();
const centimos = z.int().min(0);
const fecha = z.iso.datetime({ offset: true });

// En la base de datos marca y modelo pueden faltar; la aplicación los quiere como texto.
const nullableATexto = (texto: string | null) => texto ?? '';

const nombreDelVehiculo = (marca: string | null, modelo: string | null) =>
  `${nullableATexto(marca)} ${nullableATexto(modelo)}`.trim();

const filaDeVehiculo = z.strictObject({
  matricula: z.string(),
  marca: z.string().nullable(),
  modelo: z.string().nullable(),
  clientes: z.strictObject({ nombre: z.string(), telefono: z.string().nullable() }),
});

const filaDeOrden = z.strictObject({
  id,
  estado: z.enum(ESTADOS),
  descripcion: z.string(),
  entregada_en: fecha.nullable(),
  vehiculos: filaDeVehiculo,
});

const filaDeLinea = z.strictObject({
  id,
  recambio_id: id,
  cantidad: z.int().min(1),
  precio_unitario_centimos: centimos,
  recambios: z.strictObject({ referencia: z.string(), nombre: z.string() }),
});

const filaDeOrdenCompleta = filaDeOrden.extend({
  mano_obra_minutos: z.int().min(0),
  precio_hora_centimos: centimos,
  numero_factura: z.string().nullable(),
  creada_en: fecha,
  orden_lineas: z.array(filaDeLinea),
});

function aResumen(fila: z.output<typeof filaDeOrden>): OrdenResumen {
  const { vehiculos } = fila;
  return {
    id: fila.id,
    estado: fila.estado,
    descripcion: fila.descripcion,
    matricula: vehiculos.matricula,
    vehiculo: nombreDelVehiculo(vehiculos.marca, vehiculos.modelo),
    cliente: vehiculos.clientes.nombre,
    entregadaEn: fila.entregada_en,
  };
}

function aLinea(fila: z.output<typeof filaDeLinea>): LineaDeOrden {
  return {
    id: fila.id,
    recambioId: fila.recambio_id,
    referencia: fila.recambios.referencia,
    nombre: fila.recambios.nombre,
    cantidad: fila.cantidad,
    precioUnitarioCentimos: fila.precio_unitario_centimos,
  };
}

const porReferencia = (a: LineaDeOrden, b: LineaDeOrden) =>
  a.referencia.localeCompare(b.referencia, 'es') || a.id.localeCompare(b.id);

function aDetalle(fila: z.output<typeof filaDeOrdenCompleta>): OrdenDetalle {
  const { vehiculos } = fila;
  return {
    ...aResumen(fila),
    clienteTelefono: nullableATexto(vehiculos.clientes.telefono),
    marca: nullableATexto(vehiculos.marca),
    modelo: nullableATexto(vehiculos.modelo),
    manoObraMinutos: fila.mano_obra_minutos,
    precioHoraCentimos: fila.precio_hora_centimos,
    numeroFactura: fila.numero_factura,
    creadaEn: fila.creada_en,
    lineas: fila.orden_lineas.map(aLinea).sort(porReferencia),
  };
}

export const filaOrdenResumen: z.ZodType<OrdenResumen> = filaDeOrden.transform(aResumen);

export const filaOrdenDetalle: z.ZodType<OrdenDetalle> = filaDeOrdenCompleta.transform(aDetalle);

export const filaRecambio: z.ZodType<Recambio> = z
  .strictObject({
    id,
    referencia: z.string(),
    nombre: z.string(),
    precio_centimos: centimos,
    stock: z.int().min(0),
    stock_minimo: z.int().min(0),
  })
  .transform((fila) => ({
    id: fila.id,
    referencia: fila.referencia,
    nombre: fila.nombre,
    precioCentimos: fila.precio_centimos,
    stock: fila.stock,
    stockMinimo: fila.stock_minimo,
  }));

export const filaVehiculo: z.ZodType<VehiculoDeLista> = z
  .strictObject({
    id,
    matricula: z.string(),
    marca: z.string().nullable(),
    modelo: z.string().nullable(),
  })
  .transform((fila) => ({
    id: fila.id,
    matricula: fila.matricula,
    etiqueta: nombreDelVehiculo(fila.marca, fila.modelo),
  }));

// Lo que devuelve un insert o un update con `.select('id')`: las filas que tocó.
export const filaId = z.strictObject({ id });

// Cada fila que llega de la base de datos pasa por aquí antes de usarse. Si no es lo esperado se
// lanza un mensaje para quien usa la pantalla («los recambios», «la orden»…) y la causa de zod
// queda en `cause`.
export function leerFilas<T>(esquema: z.ZodType<T>, datos: unknown, queLee: string): T {
  const resultado = esquema.safeParse(datos);
  if (!resultado.success) {
    throw new Error(`No se entienden los datos de ${queLee}. Avisa al administrador.`, {
      cause: resultado.error,
    });
  }
  return resultado.data;
}

const FILAS_TOCADAS = z.array(filaId);

// Un update o un delete con `.select('id')` devuelve las filas que cambió: ninguna es que no
// cambió nada (otra persona llegó antes, o la política de RLS no deja ver la fila).
export function algunaFilaTocada(datos: unknown): boolean {
  return leerFilas(FILAS_TOCADAS, datos, 'la respuesta de la base de datos').length > 0;
}
