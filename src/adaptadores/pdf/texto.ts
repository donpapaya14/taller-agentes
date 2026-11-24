import type { Color, PDFFont } from 'pdf-lib';

// Lo que se hace con un texto antes de dibujarlo: dejarlo en lo que Helvetica dibuja, medirlo y
// partirlo en las líneas que caben.

export type Estilo = { fuente: PDFFont; tamano: number; color?: Color };

const ESPACIOS_RAROS = /[\p{Zs}\t]/gu;
const INVISIBLES = /[\p{Cc}\p{Cf}]/gu;
// \p{Zl} y \p{Zp} son los separadores de línea y de párrafo de Unicode (U+2028 y U+2029).
const SALTOS_DE_LINEA = /\r\n|[\r\n\u0085\p{Zl}\p{Zp}]/u;
const PUNTOS_SUSPENSIVOS = '…';

// Helvetica solo dibuja WinAnsi y pdf-lib lanza con cualquier otra cosa. Los espacios finos o
// irrompibles pasan a espacio normal, lo invisible se quita, el acento escrito como carácter aparte
// (lo que sale de pegar texto de algunas fuentes) se une a su letra y lo que no tiene dibujo sale
// como «?»: un nombre con un carácter raro no puede impedir que se descargue la factura. La unión
// va después de quitar lo invisible, porque algo invisible entre la letra y el acento la impediría.
export function limpiar(admitidos: ReadonlySet<string>, texto: string): string {
  const visible = texto.replace(ESPACIOS_RAROS, ' ').replace(INVISIBLES, '').normalize('NFC');
  const dibujable = (caracter: string) => (admitidos.has(caracter) ? caracter : '?');
  return Array.from(visible, dibujable).join('');
}

export const anchoDe = (texto: string, { fuente, tamano }: Estilo) =>
  fuente.widthOfTextAtSize(texto, tamano);

// Cuántas letras de `palabra`, desde `desde`, caben en `ancho`: al menos una, para que el corte
// siempre avance. El paso se duplica mientras quepa y después se afina a la mitad cada vez, así que
// solo se miden trozos de una línea de largo y nunca el resto de la palabra.
function letrasQueCaben(palabra: string, desde: number, estilo: Estilo, ancho: number): number {
  const restantes = palabra.length - desde;
  const cabe = (letras: number) => anchoDe(palabra.slice(desde, desde + letras), estilo) <= ancho;
  let letras = 0;
  let paso = 1;
  while (letras < restantes && cabe(Math.min(letras + paso, restantes))) {
    letras = Math.min(letras + paso, restantes);
    paso *= 2;
  }
  while (paso > 1) {
    paso /= 2;
    if (letras + paso <= restantes && cabe(letras + paso)) letras += paso;
  }
  return Math.max(letras, 1);
}

// Una palabra más ancha que la línea se corta en los trozos que quepan. El tiempo crece con la
// longitud de la palabra y no con su cuadrado: un nombre de 200.000 letras no cuelga la descarga.
export function trocear(palabra: string, estilo: Estilo, ancho: number): string[] {
  const trozos: string[] = [];
  let desde = 0;
  do {
    const hasta = desde + letrasQueCaben(palabra, desde, estilo, ancho);
    trozos.push(palabra.slice(desde, hasta));
    desde = hasta;
  } while (desde < palabra.length);
  return trozos;
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
export function lineasDe(
  admitidos: ReadonlySet<string>,
  texto: string,
  estilo: Estilo,
  ancho: number,
): string[] {
  return texto
    .split(SALTOS_DE_LINEA)
    .flatMap((parrafo) => ajustarParrafo(limpiar(admitidos, parrafo), estilo, ancho));
}

// Como mucho `maximo` líneas (al menos una). Si sobran, la última se acorta hasta que quepan los
// puntos suspensivos: quien lee el papel sabe que falta texto.
export function recortarLineas(
  lineas: string[],
  maximo: number,
  estilo: Estilo,
  ancho: number,
): string[] {
  if (lineas.length <= maximo) return lineas;
  let ultima = lineas[maximo - 1];
  while (ultima !== '' && anchoDe(`${ultima}${PUNTOS_SUSPENSIVOS}`, estilo) > ancho) {
    ultima = ultima.slice(0, -1);
  }
  return [...lineas.slice(0, maximo - 1), `${ultima.trimEnd()}${PUNTOS_SUSPENSIVOS}`];
}
