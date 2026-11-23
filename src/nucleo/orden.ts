export const ESTADOS = ['recibido', 'en_reparacion', 'listo', 'entregado'] as const;

export type Estado = (typeof ESTADOS)[number];

export const ETIQUETA_ESTADO: Record<Estado, string> = {
  recibido: 'Recibido',
  en_reparacion: 'En reparación',
  listo: 'Listo',
  entregado: 'Entregado',
};

export function siguienteEstado(estado: Estado): Estado | null {
  return ESTADOS[ESTADOS.indexOf(estado) + 1] ?? null;
}

// Una orden entregada es definitiva: no retrocede.
export function anteriorEstado(estado: Estado): Estado | null {
  if (estado === 'entregado') return null;
  return ESTADOS[ESTADOS.indexOf(estado) - 1] ?? null;
}

export function puedeTransicionar(de: Estado, a: Estado): boolean {
  return a === siguienteEstado(de) || a === anteriorEstado(de);
}
