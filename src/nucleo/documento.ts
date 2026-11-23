import { calcularTotales, formatearEuros } from './importe';
import type { Estado } from './orden';

export const LEYENDA_DEMO = 'Documento de demostración sin validez fiscal';

export type EntradaDocumento = {
  taller: { nombre: string; nif: string; direccion: string; telefono: string };
  cliente: { nombre: string; telefono: string };
  vehiculo: { matricula: string; marca: string; modelo: string };
  orden: {
    estado: Estado;
    descripcion: string;
    numeroFactura: string | null;
    fecha: string;
    manoObraMinutos: number;
    precioHoraCentimos: number;
  };
  lineas: {
    referencia: string;
    nombre: string;
    cantidad: number;
    precioUnitarioCentimos: number;
  }[];
};

export type DocumentoOrden = {
  tipo: 'presupuesto' | 'factura';
  titulo: 'Presupuesto' | 'Factura';
  numero: string | null;
  cabecera: EntradaDocumento['taller'];
  cliente: EntradaDocumento['cliente'];
  vehiculo: EntradaDocumento['vehiculo'];
  fecha: string;
  descripcion: string;
  // Una fila por línea y, si hay minutos, una última de mano de obra.
  filas: { concepto: string; cantidad: string; precio: string; importe: string }[];
  totales: { base: string; iva: string; total: string };
  leyenda: string;
};

type Fila = DocumentoOrden['filas'][number];

const MINUTOS_POR_HORA = 60;

function filaDeLinea(linea: EntradaDocumento['lineas'][number]): Fila {
  return {
    concepto: `${linea.nombre} (${linea.referencia})`,
    cantidad: String(linea.cantidad),
    precio: formatearEuros(linea.precioUnitarioCentimos),
    importe: formatearEuros(linea.cantidad * linea.precioUnitarioCentimos),
  };
}

// La mano de obra se factura por horas: 90 minutos son «1,50 h».
function filaDeManoDeObra(orden: EntradaDocumento['orden'], importeCentimos: number): Fila {
  const horas = (orden.manoObraMinutos / MINUTOS_POR_HORA).toFixed(2).replace('.', ',');

  return {
    concepto: 'Mano de obra',
    cantidad: `${horas} h`,
    precio: formatearEuros(orden.precioHoraCentimos),
    importe: formatearEuros(importeCentimos),
  };
}

export function construirDocumento(entrada: EntradaDocumento): DocumentoOrden {
  const { taller, cliente, vehiculo, orden, lineas } = entrada;
  const totales = calcularTotales(lineas, orden.manoObraMinutos, orden.precioHoraCentimos);
  const esFactura = orden.estado === 'entregado' && orden.numeroFactura !== null;

  const filas = lineas.map(filaDeLinea);
  if (orden.manoObraMinutos > 0) filas.push(filaDeManoDeObra(orden, totales.manoObraCentimos));

  return {
    tipo: esFactura ? 'factura' : 'presupuesto',
    titulo: esFactura ? 'Factura' : 'Presupuesto',
    numero: esFactura ? orden.numeroFactura : null,
    cabecera: taller,
    cliente,
    vehiculo,
    fecha: orden.fecha,
    descripcion: orden.descripcion,
    filas,
    totales: {
      base: formatearEuros(totales.baseCentimos),
      iva: formatearEuros(totales.ivaCentimos),
      total: formatearEuros(totales.totalCentimos),
    },
    leyenda: LEYENDA_DEMO,
  };
}
