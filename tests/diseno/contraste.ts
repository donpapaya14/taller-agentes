// Contraste WCAG 2.x entre dos colores hex: (L1 + 0,05) / (L2 + 0,05), con L1 la luminancia
// relativa del más claro. Va de 1 (iguales) a 21 (blanco sobre negro).

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

const canales = (hex: string): number[] => {
  if (!HEX.test(hex)) throw new Error(`Color no válido, se espera #rgb o #rrggbb: ${hex}`);
  const cifras = hex.slice(1);
  const largas = cifras.length === 3 ? [...cifras].map((c) => c + c).join('') : cifras;
  return [0, 2, 4].map((inicio) => Number.parseInt(largas.slice(inicio, inicio + 2), 16));
};

// sRGB a lineal; 0,04045 es el umbral de la norma sRGB que recoge WCAG 2.2.
const lineal = (canal: number): number => {
  const c = canal / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

const luminancia = (hex: string): number => {
  const [r, g, b] = canales(hex).map(lineal);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

export function contraste(hexA: string, hexB: string): number {
  const [clara, oscura] = [luminancia(hexA), luminancia(hexB)].sort((a, b) => b - a);
  return (clara + 0.05) / (oscura + 0.05);
}
