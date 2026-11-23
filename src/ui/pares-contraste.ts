// Los pares de texto y fondo que usa la interfaz, por nombre de token de tokens.css.
// El test [C-14][D-10] mide cada uno con los valores reales del archivo: un color de texto
// que aparezca sobre un fondo que no está aquí no tiene su contraste comprobado.
export const PARES: { texto: string; fondo: string; minimo: 4.5 | 3 }[] = [
  { texto: 'hueso', fondo: 'foso', minimo: 4.5 },
  { texto: 'hueso', fondo: 'chapa', minimo: 4.5 },
  { texto: 'hueso', fondo: 'chapa-alta', minimo: 4.5 },
  { texto: 'acero', fondo: 'foso', minimo: 4.5 },
  { texto: 'acero', fondo: 'chapa', minimo: 4.5 },
  { texto: 'foso', fondo: 'lampara', minimo: 4.5 },
  { texto: 'lampara', fondo: 'foso', minimo: 4.5 },
  // Los enlaces de /proceso (el commit, los archivos de los agentes) van en lámpara sobre la chapa.
  { texto: 'lampara', fondo: 'chapa', minimo: 4.5 },
  { texto: 'ambar', fondo: 'chapa', minimo: 4.5 },
  { texto: 'testigo', fondo: 'chapa', minimo: 4.5 },
  { texto: 'averia', fondo: 'chapa', minimo: 4.5 },
  { texto: 'placa-texto', fondo: 'placa', minimo: 4.5 },
];
