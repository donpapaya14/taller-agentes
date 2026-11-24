// El formato actual (cuatro cifras y tres consonantes) y el antiguo con letras de provincia.
const MATRICULA_ACTUAL = /^\d{4}[BCDFGHJKLMNPRSTVWXYZ]{3}$/;
const MATRICULA_ANTIGUA = /^[A-Z]{1,2}\d{4}[A-Z]{1,2}$/;

const ESPACIOS_Y_GUIONES = /[\s-]/g;

export function normalizarMatricula(texto: string): string | null {
  const mayusculas = texto.toUpperCase();
  // Una letra que en mayúsculas ocupa más (la «ß» pasa a «SS», la ligadura «ﬁ» a «FI») no es una
  // letra de matrícula: dejarla pasar daría por buena una matrícula que nadie escribió.
  if (mayusculas.length !== texto.length) return null;

  const normalizada = mayusculas.replace(ESPACIOS_Y_GUIONES, '');
  const esValida = MATRICULA_ACTUAL.test(normalizada) || MATRICULA_ANTIGUA.test(normalizada);

  return esValida ? normalizada : null;
}
