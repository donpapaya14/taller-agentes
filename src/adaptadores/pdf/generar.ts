import {
  type Color,
  grayscale,
  PageSizes,
  PDFDocument,
  type PDFFont,
  type PDFPage,
  StandardFonts,
} from 'pdf-lib';
import type { DocumentoOrden } from '@/nucleo/documento';
import { IVA_PORCENTAJE } from '@/nucleo/importe';

// A4 vertical, en puntos. Lo que se dibuja pasa por una sola hoja con un cursor `y` que baja; al no
// caber algo se abre otra página con su pie.
const [ANCHO_DE_PAGINA, ALTO_DE_PAGINA] = PageSizes.A4;
const MARGEN = 48;
const X_DERECHA = ANCHO_DE_PAGINA - MARGEN;
const ANCHO_UTIL = ANCHO_DE_PAGINA - 2 * MARGEN;
// Lo que se deja libre abajo para el pie con la leyenda.
const BORDE_INFERIOR = 84;
const Y_DEL_PIE = 40;
const INTERLINEA = 15;
const SEPARACION = 12;

const TAMANO_TITULO = 28;
const TAMANO_NUMERO = 16;
const TAMANO_TEXTO = 10.5;
const TAMANO_MENUDO = 9;
const TAMANO_TOTAL = 13;

const TINTA = grayscale(0.08);
const TINTA_SUAVE = grayscale(0.42);
const RAYA = grayscale(0.78);
const GROSOR_DE_RAYA = 0.75;

// Taller a la izquierda; cliente, vehículo y fecha a la derecha.
const ANCHO_DE_COLUMNA = (ANCHO_UTIL - 2 * SEPARACION) / 2;
const X_COLUMNA_DERECHA = MARGEN + ANCHO_DE_COLUMNA + 2 * SEPARACION;

// Los números van alineados por la derecha de su columna; el concepto ocupa lo que queda.
const X_IMPORTE = X_DERECHA;
const X_PRECIO = X_IMPORTE - 96;
const X_CANTIDAD = X_PRECIO - 88;
const ANCHO_DE_CONCEPTO = X_CANTIDAD - 56 - MARGEN;
const X_ETIQUETAS_DE_TOTALES = X_CANTIDAD - 24;
const ALTO_DE_TOTALES = SEPARACION + 2 * (TAMANO_TEXTO + 5) + (TAMANO_TOTAL + 5);
// El encabezado de la tabla y una fila: menos que esto y la tabla empieza en la página siguiente.
const ALTO_MINIMO_DE_TABLA = 3 * INTERLINEA;

type Estilo = { fuente: PDFFont; tamano: number; color?: Color };
type Punto = { x: number; y: number };
type Columna = { x: number; ancho: number };
type Bloque = { etiqueta: string; lineas: string[] };
type Fila = DocumentoOrden['filas'][number];

type Hoja = {
  pdf: PDFDocument;
  normal: PDFFont;
  negrita: PDFFont;
  // Los caracteres que Helvetica sabe dibujar (WinAnsi).
  admitidos: ReadonlySet<string>;
  leyenda: string;
  pagina: PDFPage;
  y: number;
};

const ESPACIOS_RAROS = /[\p{Zs}\t]/gu;
const INVISIBLES = /[\p{Cc}\p{Cf}]/gu;
// \p{Zl} y \p{Zp} son los separadores de línea y de párrafo de Unicode (U+2028 y U+2029).
const SALTOS_DE_LINEA = /\r\n|[\r\n\u0085\p{Zl}\p{Zp}]/u;

// Helvetica solo dibuja WinAnsi y pdf-lib lanza con cualquier otra cosa. Los espacios finos o
// irrompibles pasan a espacio normal, lo invisible se quita y lo que no tiene dibujo sale como «?»:
// un nombre con un carácter raro no puede impedir que se descargue la factura.
function limpiar(hoja: Hoja, texto: string): string {
  const visible = texto.replace(ESPACIOS_RAROS, ' ').replace(INVISIBLES, '');
  const dibujable = (caracter: string) => (hoja.admitidos.has(caracter) ? caracter : '?');
  return Array.from(visible, dibujable).join('');
}

const anchoDe = (texto: string, { fuente, tamano }: Estilo) =>
  fuente.widthOfTextAtSize(texto, tamano);

// Una palabra más ancha que la línea se corta en los trozos que quepan.
function trocear(palabra: string, estilo: Estilo, ancho: number): string[] {
  const trozos: string[] = [];
  let resto = palabra;
  while (resto.length > 1 && anchoDe(resto, estilo) > ancho) {
    let corte = 1;
    while (corte < resto.length && anchoDe(resto.slice(0, corte + 1), estilo) <= ancho) corte += 1;
    trozos.push(resto.slice(0, corte));
    resto = resto.slice(corte);
  }
  return [...trozos, resto];
}

function ajustarParrafo(texto: string, estilo: Estilo, ancho: number): string[] {
  const lineas: string[] = [];
  let actual = '';
  for (const palabra of texto.split(' ').filter(Boolean)) {
    const candidata = actual === '' ? palabra : `${actual} ${palabra}`;
    if (anchoDe(candidata, estilo) <= ancho) {
      actual = candidata;
      continue;
    }
    if (actual !== '') lineas.push(actual);
    const trozos = trocear(palabra, estilo, ancho);
    lineas.push(...trozos.slice(0, -1));
    actual = trozos[trozos.length - 1];
  }
  return [...lineas, actual];
}

// El texto partido en las líneas que caben en `ancho`; cada salto de línea del original abre una.
function lineasDe(hoja: Hoja, texto: string, estilo: Estilo, ancho: number): string[] {
  return texto
    .split(SALTOS_DE_LINEA)
    .flatMap((parrafo) => ajustarParrafo(limpiar(hoja, parrafo), estilo, ancho));
}

function dibujar(
  hoja: Hoja,
  texto: string,
  { x, y }: Punto,
  { fuente, tamano, color = TINTA }: Estilo,
): void {
  hoja.pagina.drawText(limpiar(hoja, texto), { x, y, size: tamano, font: fuente, color });
}

// `x` es el borde derecho del texto.
function dibujarADerecha(hoja: Hoja, texto: string, { x, y }: Punto, estilo: Estilo): void {
  const limpio = limpiar(hoja, texto);
  dibujar(hoja, limpio, { x: x - anchoDe(limpio, estilo), y }, estilo);
}

function raya(hoja: Hoja, y: number): void {
  hoja.pagina.drawLine({
    start: { x: MARGEN, y },
    end: { x: X_DERECHA, y },
    thickness: GROSOR_DE_RAYA,
    color: RAYA,
  });
}

// La leyenda va al pie de cada página.
function dibujarPie(hoja: Hoja): void {
  const estilo = { fuente: hoja.normal, tamano: TAMANO_MENUDO, color: TINTA_SUAVE };
  raya(hoja, Y_DEL_PIE + TAMANO_MENUDO + 8);
  lineasDe(hoja, hoja.leyenda, estilo, ANCHO_UTIL).forEach((linea, i) => {
    dibujar(hoja, linea, { x: MARGEN, y: Y_DEL_PIE - i * INTERLINEA }, estilo);
  });
}

function nuevaPagina(hoja: Hoja): void {
  hoja.pagina = hoja.pdf.addPage(PageSizes.A4);
  hoja.y = ALTO_DE_PAGINA - MARGEN;
  dibujarPie(hoja);
}

// Abre otra página si lo que viene, de `alto` puntos, no cabe en esta. Dice si la abrió.
function asegurarEspacio(hoja: Hoja, alto: number): boolean {
  if (hoja.y - alto >= BORDE_INFERIOR) return false;
  nuevaPagina(hoja);
  return true;
}

async function crearHoja(leyenda: string): Promise<Hoja> {
  const pdf = await PDFDocument.create();
  const normal = await pdf.embedFont(StandardFonts.Helvetica);
  const negrita = await pdf.embedFont(StandardFonts.HelveticaBold);
  const hoja: Hoja = {
    pdf,
    normal,
    negrita,
    admitidos: new Set(normal.getCharacterSet().map((punto) => String.fromCodePoint(punto))),
    leyenda,
    pagina: pdf.addPage(PageSizes.A4),
    y: ALTO_DE_PAGINA - MARGEN,
  };
  dibujarPie(hoja);
  return hoja;
}

function dibujarCabecera(hoja: Hoja, { titulo, numero }: DocumentoOrden): void {
  const y = hoja.y - TAMANO_TITULO;
  dibujar(hoja, titulo, { x: MARGEN, y }, { fuente: hoja.negrita, tamano: TAMANO_TITULO });
  if (numero !== null) {
    const estilo = { fuente: hoja.negrita, tamano: TAMANO_NUMERO };
    dibujarADerecha(hoja, numero, { x: X_DERECHA, y }, estilo);
  }
  raya(hoja, y - SEPARACION);
  hoja.y = y - 2.5 * SEPARACION;
}

// Una etiqueta y sus líneas, desde `desde` hacia abajo; la primera línea (el nombre, la matrícula)
// va en negrita y las que no caben se parten. Devuelve por dónde queda el cursor.
function dibujarBloque(
  hoja: Hoja,
  { etiqueta, lineas }: Bloque,
  { x, ancho }: Columna,
  desde: number,
): number {
  const estiloDeEtiqueta = { fuente: hoja.negrita, tamano: TAMANO_MENUDO, color: TINTA_SUAVE };
  dibujar(hoja, etiqueta, { x, y: desde - TAMANO_MENUDO }, estiloDeEtiqueta);

  const lineasConEstilo = lineas
    .filter((texto) => texto.trim() !== '')
    .flatMap((texto, i) => {
      const estilo = { fuente: i === 0 ? hoja.negrita : hoja.normal, tamano: TAMANO_TEXTO };
      return lineasDe(hoja, texto, estilo, ancho).map((linea) => ({ linea, estilo }));
    });
  lineasConEstilo.forEach(({ linea, estilo }, i) => {
    const arriba = desde - (i + 1) * INTERLINEA;
    dibujar(hoja, linea, { x, y: arriba - TAMANO_TEXTO }, estilo);
  });
  return desde - (lineasConEstilo.length + 1) * INTERLINEA - SEPARACION;
}

// Un dato sin valor no se escribe: «NIF » solo no dice nada.
const conPrefijo = (prefijo: string, valor: string) =>
  valor.trim() === '' ? '' : `${prefijo} ${valor}`;

function dibujarPartes(hoja: Hoja, documento: DocumentoOrden): void {
  const { cabecera, cliente, vehiculo, fecha } = documento;
  const taller = {
    etiqueta: 'Taller',
    lineas: [
      cabecera.nombre,
      conPrefijo('NIF', cabecera.nif),
      cabecera.direccion,
      conPrefijo('Tel.', cabecera.telefono),
    ],
  };
  const izquierda = [taller, { etiqueta: 'Fecha', lineas: [fecha] }];
  const derecha = [
    { etiqueta: 'Cliente', lineas: [cliente.nombre, cliente.telefono] },
    {
      etiqueta: 'Vehículo',
      lineas: [vehiculo.matricula, `${vehiculo.marca} ${vehiculo.modelo}`.trim()],
    },
  ];

  const pintar = (bloques: Bloque[], columna: Columna) =>
    bloques.reduce((y, bloque) => dibujarBloque(hoja, bloque, columna, y), hoja.y);
  const finIzquierda = pintar(izquierda, { x: MARGEN, ancho: ANCHO_DE_COLUMNA });
  const finDerecha = pintar(derecha, { x: X_COLUMNA_DERECHA, ancho: ANCHO_DE_COLUMNA });
  hoja.y = Math.min(finIzquierda, finDerecha);
}

// Línea a línea: una descripción larga sigue en la página siguiente sin partir una palabra.
function dibujarDescripcion(hoja: Hoja, descripcion: string): void {
  const etiqueta = { fuente: hoja.negrita, tamano: TAMANO_MENUDO, color: TINTA_SUAVE };
  const estilo = { fuente: hoja.normal, tamano: TAMANO_TEXTO };
  asegurarEspacio(hoja, 2 * INTERLINEA);
  dibujar(hoja, 'Descripción', { x: MARGEN, y: hoja.y - TAMANO_MENUDO }, etiqueta);
  hoja.y -= INTERLINEA;
  for (const linea of lineasDe(hoja, descripcion, estilo, ANCHO_UTIL)) {
    asegurarEspacio(hoja, INTERLINEA);
    dibujar(hoja, linea, { x: MARGEN, y: hoja.y - TAMANO_TEXTO }, estilo);
    hoja.y -= INTERLINEA;
  }
  hoja.y -= SEPARACION;
}

function dibujarEncabezadoDeTabla(hoja: Hoja): void {
  const estilo = { fuente: hoja.negrita, tamano: TAMANO_MENUDO, color: TINTA_SUAVE };
  const y = hoja.y - TAMANO_MENUDO;
  dibujar(hoja, 'Concepto', { x: MARGEN, y }, estilo);
  dibujarADerecha(hoja, 'Cant.', { x: X_CANTIDAD, y }, estilo);
  dibujarADerecha(hoja, 'Precio', { x: X_PRECIO, y }, estilo);
  dibujarADerecha(hoja, 'Importe', { x: X_IMPORTE, y }, estilo);
  raya(hoja, y - 6);
  hoja.y = y - 10;
}

// Los números van con la primera línea del concepto. Si el concepto no cabe en lo que queda de
// página sigue en la siguiente, bajo el encabezado de la tabla.
function dibujarFila(hoja: Hoja, fila: Fila): void {
  const estilo = { fuente: hoja.normal, tamano: TAMANO_TEXTO };
  lineasDe(hoja, fila.concepto, estilo, ANCHO_DE_CONCEPTO).forEach((linea, i) => {
    if (asegurarEspacio(hoja, INTERLINEA)) dibujarEncabezadoDeTabla(hoja);
    const y = hoja.y - TAMANO_TEXTO;
    dibujar(hoja, linea, { x: MARGEN, y }, estilo);
    if (i === 0) {
      dibujarADerecha(hoja, fila.cantidad, { x: X_CANTIDAD, y }, estilo);
      dibujarADerecha(hoja, fila.precio, { x: X_PRECIO, y }, estilo);
      dibujarADerecha(hoja, fila.importe, { x: X_IMPORTE, y }, estilo);
    }
    hoja.y -= INTERLINEA;
  });
  raya(hoja, hoja.y - 3);
  hoja.y -= 8;
}

function dibujarTabla(hoja: Hoja, filas: Fila[]): void {
  asegurarEspacio(hoja, ALTO_MINIMO_DE_TABLA);
  dibujarEncabezadoDeTabla(hoja);
  filas.forEach((fila) => dibujarFila(hoja, fila));
}

function dibujarTotales(hoja: Hoja, totales: DocumentoOrden['totales']): void {
  asegurarEspacio(hoja, ALTO_DE_TOTALES);
  hoja.y -= SEPARACION;
  const normal = { fuente: hoja.normal, tamano: TAMANO_TEXTO };
  const grande = { fuente: hoja.negrita, tamano: TAMANO_TOTAL };
  const lineas = [
    { etiqueta: 'Base imponible', importe: totales.base, estilo: normal },
    { etiqueta: `IVA (${IVA_PORCENTAJE} %)`, importe: totales.iva, estilo: normal },
    { etiqueta: 'Total', importe: totales.total, estilo: grande },
  ];
  for (const { etiqueta, importe, estilo } of lineas) {
    const y = hoja.y - estilo.tamano;
    dibujar(hoja, etiqueta, { x: X_ETIQUETAS_DE_TOTALES, y }, estilo);
    dibujarADerecha(hoja, importe, { x: X_IMPORTE, y }, estilo);
    hoja.y = y - 5;
  }
}

// El PDF de una orden, sin guardarlo en ningún sitio: quien lo pide recibe los bytes.
export async function generarPdf(documento: DocumentoOrden): Promise<Uint8Array> {
  const hoja = await crearHoja(documento.leyenda);
  dibujarCabecera(hoja, documento);
  dibujarPartes(hoja, documento);
  dibujarDescripcion(hoja, documento.descripcion);
  dibujarTabla(hoja, documento.filas);
  dibujarTotales(hoja, documento.totales);
  return hoja.pdf.save();
}
