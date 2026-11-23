import type { Estado } from './orden';

const PREFIJO_DE_ESPANA = '34';

const SEPARADORES = /[\s.()-]/g;

// Nueve cifras que empiezan por 6, 7, 8 o 9, con el prefijo de España delante o sin él.
const TELEFONO_ESPANOL = /^(?:\+34|0034|34)?[6-9]\d{8}$/;

const FRASE_POR_ESTADO: Record<Estado, (matricula: string) => string> = {
  recibido: (matricula) => `Hemos recibido su vehículo ${matricula}.`,
  en_reparacion: (matricula) => `Ya estamos trabajando en su vehículo ${matricula}.`,
  listo: (matricula) => `Su vehículo ${matricula} ya está listo para recoger.`,
  entregado: (matricula) => `Gracias por confiar en nosotros con su vehículo ${matricula}.`,
};

export function normalizarTelefono(texto: string): string | null {
  const limpio = texto.replace(SEPARADORES, '');
  if (!TELEFONO_ESPANOL.test(limpio)) return null;

  return `${PREFIJO_DE_ESPANA}${limpio.slice(-9)}`;
}

export function mensajeAviso(datos: { taller: string; matricula: string; estado: Estado }): string {
  const frase = FRASE_POR_ESTADO[datos.estado](datos.matricula);

  return `Hola, le escribimos de ${datos.taller}. ${frase}`;
}

export function enlaceAviso(datos: {
  telefono: string;
  taller: string;
  matricula: string;
  estado: Estado;
}): string | null {
  const telefono = normalizarTelefono(datos.telefono);
  if (telefono === null) return null;

  const { taller, matricula, estado } = datos;
  return `https://wa.me/${telefono}?text=${encodeURIComponent(mensajeAviso({ taller, matricula, estado }))}`;
}
