import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  construirDocumento,
  LEYENDA_DEMO,
  type DocumentoOrden,
  type EntradaDocumento,
} from './documento';
import { calcularTotales, formatearEuros } from './importe';
import { ESTADOS } from './orden';

const NUMERO_DE_FACTURA = 'F-2026-0001';

const ENTRADA: EntradaDocumento = {
  taller: {
    nombre: 'Talleres Vega',
    nif: 'B12345678',
    direccion: 'Calle Mayor 1, Valencia',
    telefono: '961 000 000',
  },
  cliente: { nombre: 'Marta Pons', telefono: '612 345 678' },
  vehiculo: { matricula: '1234BCD', marca: 'Seat', modelo: 'Ibiza' },
  orden: {
    estado: 'listo',
    descripcion: 'Cambio de filtro y pastillas',
    numeroFactura: null,
    fecha: '2026-11-23',
    manoObraMinutos: 90,
    precioHoraCentimos: 4500,
  },
  lineas: [
    { referencia: 'FIL-01', nombre: 'Filtro de aceite', cantidad: 2, precioUnitarioCentimos: 1250 },
    {
      referencia: 'PAS-02',
      nombre: 'Pastillas de freno',
      cantidad: 1,
      precioUnitarioCentimos: 899,
    },
  ],
};

const FILAS_DEL_EJEMPLO: DocumentoOrden['filas'] = [
  { concepto: 'Filtro de aceite (FIL-01)', cantidad: '2', precio: '12,50 €', importe: '25,00 €' },
  { concepto: 'Pastillas de freno (PAS-02)', cantidad: '1', precio: '8,99 €', importe: '8,99 €' },
  { concepto: 'Mano de obra', cantidad: '1,50 h', precio: '45,00 €', importe: '67,50 €' },
];

const ESTADOS_SIN_ENTREGAR = ESTADOS.filter((estado) => estado !== 'entregado');

const CASOS_DE_HORAS = [
  { minutos: 90, horas: '1,50 h' },
  { minutos: 60, horas: '1,00 h' },
  { minutos: 45, horas: '0,75 h' },
  { minutos: 100, horas: '1,67 h' },
  { minutos: 1, horas: '0,02 h' },
  { minutos: 600, horas: '10,00 h' },
];

const conOrden = (cambios: Partial<EntradaDocumento['orden']>): EntradaDocumento => ({
  ...ENTRADA,
  orden: { ...ENTRADA.orden, ...cambios },
});

const lineaArbitraria = fc.record({
  referencia: fc.constantFrom('FIL-01', 'PAS-02'),
  nombre: fc.constantFrom('Filtro de aceite', 'Pastillas de freno'),
  cantidad: fc.integer({ min: 1, max: 50 }),
  precioUnitarioCentimos: fc.integer({ min: 0, max: 500_000 }),
});

describe('documento: presupuesto o factura', () => {
  it('[C-8] sin entregar es presupuesto sin número', () => {
    const documento = construirDocumento(conOrden({ estado: 'listo' }));

    expect(documento).toMatchObject({
      tipo: 'presupuesto',
      titulo: 'Presupuesto',
      numero: null,
      leyenda: LEYENDA_DEMO,
    });
  });

  it.each(ESTADOS_SIN_ENTREGAR)(
    '[C-8] en estado %s aunque traiga número no es factura',
    (estado) => {
      const documento = construirDocumento(conOrden({ estado, numeroFactura: NUMERO_DE_FACTURA }));

      expect(documento).toMatchObject({ tipo: 'presupuesto', titulo: 'Presupuesto', numero: null });
    },
  );

  it('[C-8] entregada con número es factura', () => {
    const documento = construirDocumento(
      conOrden({ estado: 'entregado', numeroFactura: NUMERO_DE_FACTURA }),
    );

    expect(documento).toMatchObject({
      tipo: 'factura',
      titulo: 'Factura',
      numero: NUMERO_DE_FACTURA,
      leyenda: LEYENDA_DEMO,
    });
  });

  it('[C-8] entregada sin número sigue siendo presupuesto', () => {
    const documento = construirDocumento(conOrden({ estado: 'entregado', numeroFactura: null }));

    expect(documento).toMatchObject({ tipo: 'presupuesto', titulo: 'Presupuesto', numero: null });
  });

  it('[C-8] tipo, título y número coinciden para cualquier estado y número', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ESTADOS),
        fc.option(fc.constant(NUMERO_DE_FACTURA), { nil: null }),
        (estado, numeroFactura) => {
          const documento = construirDocumento(conOrden({ estado, numeroFactura }));
          const esFactura = estado === 'entregado' && numeroFactura !== null;

          expect(documento.tipo).toBe(esFactura ? 'factura' : 'presupuesto');
          expect(documento.titulo).toBe(esFactura ? 'Factura' : 'Presupuesto');
          expect(documento.numero).toBe(esFactura ? numeroFactura : null);
        },
      ),
    );
  });
});

describe('documento: filas y totales', () => {
  it('[C-8] filas y totales salen formateados', () => {
    const documento = construirDocumento(ENTRADA);

    expect(documento.filas).toEqual(FILAS_DEL_EJEMPLO);
    expect(documento.totales).toEqual({ base: '101,49 €', iva: '21,31 €', total: '122,80 €' });
  });

  it.each(CASOS_DE_HORAS)(
    '[C-8] $minutos minutos de mano de obra son $horas',
    ({ minutos, horas }) => {
      const documento = construirDocumento(conOrden({ manoObraMinutos: minutos }));

      expect(documento.filas.at(-1)).toMatchObject({ concepto: 'Mano de obra', cantidad: horas });
    },
  );

  it('[C-8] sin minutos no hay fila de mano de obra', () => {
    const documento = construirDocumento(conOrden({ manoObraMinutos: 0 }));

    expect(documento.filas).toEqual(FILAS_DEL_EJEMPLO.slice(0, 2));
  });

  it('[C-8] sin líneas la mano de obra es la única fila', () => {
    const documento = construirDocumento({ ...ENTRADA, lineas: [] });

    expect(documento.filas).toEqual(FILAS_DEL_EJEMPLO.slice(2));
  });

  it('[C-8] el documento muestra lo que calcula el núcleo', () => {
    fc.assert(
      fc.property(
        fc.array(lineaArbitraria, { maxLength: 6 }),
        fc.integer({ min: 0, max: 2000 }),
        fc.integer({ min: 0, max: 20_000 }),
        (lineas, minutos, precioHora) => {
          const entrada = {
            ...conOrden({ manoObraMinutos: minutos, precioHoraCentimos: precioHora }),
            lineas,
          };
          const documento = construirDocumento(entrada);
          const totales = calcularTotales(lineas, minutos, precioHora);

          expect(documento.totales).toEqual({
            base: formatearEuros(totales.baseCentimos),
            iva: formatearEuros(totales.ivaCentimos),
            total: formatearEuros(totales.totalCentimos),
          });
          expect(documento.filas).toHaveLength(lineas.length + (minutos > 0 ? 1 : 0));
        },
      ),
    );
  });
});

describe('documento: datos que pasan tal cual', () => {
  it('[C-8] la leyenda dice que es una demostración sin validez fiscal', () => {
    expect(LEYENDA_DEMO).toBe('Documento de demostración sin validez fiscal');
  });

  it('[C-8] cabecera, cliente, vehículo, fecha y descripción salen como entran', () => {
    const documento = construirDocumento(ENTRADA);

    expect({
      cabecera: documento.cabecera,
      cliente: documento.cliente,
      vehiculo: documento.vehiculo,
      fecha: documento.fecha,
      descripcion: documento.descripcion,
    }).toEqual({
      cabecera: ENTRADA.taller,
      cliente: ENTRADA.cliente,
      vehiculo: ENTRADA.vehiculo,
      fecha: '2026-11-23',
      descripcion: 'Cambio de filtro y pastillas',
    });
  });

  it('[C-8][D-5] un importe no válido no llega a salir en el documento', () => {
    const lineas = [{ ...ENTRADA.lineas[0], precioUnitarioCentimos: 12.5 }];

    expect(() => construirDocumento({ ...ENTRADA, lineas })).toThrow(
      new RangeError('Importe no válido'),
    );
  });
});
