import { Big_Shoulders, Martian_Mono, Schibsted_Grotesk } from 'next/font/google';

// next/font las descarga al compilar y las sirve desde el propio dominio. Cada familia queda en
// una variable CSS que tokens.css registra como font-titular, font-texto y font-dato.

// Rotulación industrial para titulares; el eje opsz afina el dibujo según el tamaño. next/font no
// tiene sus métricas y no puede ajustar un respaldo: se declara uno genérico para que, mientras
// carga, un titular no salga con la letra con serifa del navegador.
const titular = Big_Shoulders({
  subsets: ['latin'],
  axes: ['opsz'],
  variable: '--fuente-titular',
  adjustFontFallback: false,
  fallback: ['sans-serif'],
});

const texto = Schibsted_Grotesk({ subsets: ['latin'], variable: '--fuente-texto' });

// Datos: matrículas, referencias, importes y commits. El eje wdth estrecha las matrículas.
const dato = Martian_Mono({ subsets: ['latin'], axes: ['wdth'], variable: '--fuente-dato' });

/** Clases que declaran las tres variables de fuente; van en <html>. */
export const variablesDeFuente = [titular.variable, texto.variable, dato.variable].join(' ');
