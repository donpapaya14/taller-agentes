import type { OrdenTablero } from './Tablero';

// Órdenes ficticias para el tablero de muestra del gate de diseño: clientes, matrículas y
// averías inventados, repartidos 3, 3, 2 y 1 entre las cuatro columnas.
export const MUESTRA: OrdenTablero[] = [
  {
    id: 'muestra-1',
    matricula: '6104 GZT',
    vehiculo: 'Seat León',
    cliente: 'Lucía Ferrer',
    estado: 'recibido',
    descripcion: 'Ruido metálico al frenar',
  },
  {
    id: 'muestra-2',
    matricula: '3388 NBC',
    vehiculo: 'Dacia Sandero',
    cliente: 'Andrés Molina',
    estado: 'recibido',
    descripcion: 'Testigo de motor encendido',
  },
  {
    id: 'muestra-3',
    matricula: '0943 LBZ',
    vehiculo: 'Peugeot 308',
    cliente: 'Rocío Navarro',
    estado: 'recibido',
    descripcion: 'Revisión de los 60.000 km',
  },
  {
    id: 'muestra-4',
    matricula: '2817 HKD',
    vehiculo: 'Renault Clio',
    cliente: 'Manuel Ibáñez',
    estado: 'en_reparacion',
    descripcion: 'Cambio de embrague',
  },
  {
    id: 'muestra-5',
    matricula: '7216 MRX',
    vehiculo: 'Toyota Corolla',
    cliente: 'Elena Castillo',
    estado: 'en_reparacion',
    descripcion: 'El aire acondicionado no enfría',
  },
  {
    id: 'muestra-6',
    matricula: '5530 JMF',
    vehiculo: 'Citroën Berlingo',
    cliente: 'Joaquín Herrera',
    estado: 'en_reparacion',
    descripcion: 'Pastillas y discos delanteros',
  },
  {
    id: 'muestra-7',
    matricula: '1592 KPW',
    vehiculo: 'Volkswagen Golf',
    cliente: 'Marta Soler',
    estado: 'listo',
    descripcion: 'Cambio de aceite y filtros',
  },
  {
    id: 'muestra-8',
    matricula: '8470 DLS',
    vehiculo: 'Ford Focus',
    cliente: 'Ignacio Prieto',
    estado: 'listo',
    descripcion: 'Vibración en el volante a 100 km/h',
  },
  {
    id: 'muestra-9',
    matricula: '4025 FJV',
    vehiculo: 'Kia Sportage',
    cliente: 'Pilar Ortega',
    estado: 'entregado',
    descripcion: 'Neumáticos traseros y alineado',
  },
];
