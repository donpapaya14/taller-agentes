// El formato actual (cuatro cifras y tres consonantes) y el antiguo con letras de provincia.
const MATRICULA_ACTUAL = /^\d{4}[BCDFGHJKLMNPRSTVWXYZ]{3}$/;
const MATRICULA_ANTIGUA = /^[A-Z]{1,2}\d{4}[A-Z]{1,2}$/;

const ESPACIOS_Y_GUIONES = /[\s-]/g;

// Una letra que no es de la A a la Z: un acento, otro alfabeto, la «ß». Se busca antes de pasar a
// mayúsculas, que convierte la «ß» en «SS», la «ſ» (s larga) en «S», la «ı» (i sin punto) en «I» y
// la ligadura «ﬁ» en «FI»: dejarlas pasar daría por buena una matrícula que nadie escribió.
const LETRA_FUERA_DE_LA_A_A_LA_Z = /(?![A-Za-z])\p{L}/u;

export function normalizarMatricula(texto: string): string | null {
  if (LETRA_FUERA_DE_LA_A_A_LA_Z.test(texto)) return null;

  const normalizada = texto.toUpperCase().replace(ESPACIOS_Y_GUIONES, '');
  const esValida = MATRICULA_ACTUAL.test(normalizada) || MATRICULA_ANTIGUA.test(normalizada);

  return esValida ? normalizada : null;
}
