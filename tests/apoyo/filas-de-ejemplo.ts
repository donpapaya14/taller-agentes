import { filaOrdenDetalle, type OrdenDetalle, type OrdenResumen } from '@/adaptadores/supabase/filas';

// Filas como las devuelve PostgREST (columnas en snake_case y tablas relacionadas anidadas) y lo
// que la aplicación espera recibir de ellas. Las comparten los tests de los adaptadores.

export const ID_TALLER = '1b7e4c9a-2d5f-4a3b-8c6d-9e0f1a2b3c4d';
export const ID_ORDEN = '9c1e7d52-0b3a-4f68-8a2d-6e4b1c7f3a90';
export const ID_RECAMBIO = '3f2b8a4e-6c1d-4e7a-9b0f-5d2c8e1a7b64';
export const ID_LINEA = '5d2c8e1a-7b64-4f2b-8a4e-6c1d3e7a9b0f';

export const FILA_RESUMEN = {
  id: ID_ORDEN,
  estado: 'en_reparacion',
  descripcion: 'Cambio de aceite',
  entregada_en: null,
  vehiculos: {
    matricula: '1234BCD',
    marca: 'Seat',
    modelo: 'Ibiza',
    clientes: { nombre: 'Marta Ruiz', telefono: '34612345678' },
  },
};

export const FILA_LINEA = {
  id: ID_LINEA,
  recambio_id: ID_RECAMBIO,
  cantidad: 2,
  precio_unitario_centimos: 1250,
  recambios: { referencia: 'FIL-01', nombre: 'Filtro de aceite' },
};

export const FILA_DETALLE = {
  ...FILA_RESUMEN,
  mano_obra_minutos: 90,
  precio_hora_centimos: 4500,
  numero_factura: null,
  creada_en: '2026-11-23T20:41:00.123456+00:00',
  orden_lineas: [FILA_LINEA],
};

export const FILA_RECAMBIO = {
  id: ID_RECAMBIO,
  referencia: 'FIL-01',
  nombre: 'Filtro de aceite',
  precio_centimos: 1250,
  stock: 5,
  stock_minimo: 2,
};

export const FILA_VEHICULO = { id: ID_ORDEN, matricula: '1234BCD', marca: 'Seat', modelo: 'Ibiza' };

export const ORDEN_RESUMEN: OrdenResumen = {
  id: ID_ORDEN,
  estado: 'en_reparacion',
  descripcion: 'Cambio de aceite',
  matricula: '1234BCD',
  vehiculo: 'Seat Ibiza',
  cliente: 'Marta Ruiz',
  entregadaEn: null,
};

export const RECAMBIO = {
  id: ID_RECAMBIO,
  referencia: 'FIL-01',
  nombre: 'Filtro de aceite',
  precioCentimos: 1250,
  stock: 5,
  stockMinimo: 2,
};

// La orden entera, como la lee `leerOrden`: la fila FILA_DETALLE ya adaptada.
export const ORDEN_DETALLE: OrdenDetalle = filaOrdenDetalle.parse(FILA_DETALLE);
