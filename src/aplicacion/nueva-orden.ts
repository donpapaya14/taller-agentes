import { z } from 'zod';
import { normalizarMatricula } from '@/nucleo/matricula';
import { normalizarTelefono } from '@/nucleo/whatsapp';

export type DatosOrden = { descripcion: string } & (
  | { vehiculoId: string }
  | {
      matricula: string;
      marca: string;
      modelo: string;
      clienteNombre: string;
      clienteTelefono: string;
    }
);

// Un mensaje por campo, el primero que dio zod: es lo que se pinta junto a cada campo.
export type Errores = Record<string, string>;

type Validacion<T> = { ok: true; datos: T } | { ok: false; errores: Errores };

const MENSAJES = {
  matricula: 'Matrícula no válida. Ejemplo: 1234 BCD',
  clienteTelefono: 'Teléfono no válido. Nueve cifras, por ejemplo 612 345 678',
  descripcion: 'Describe la avería o el trabajo (entre 5 y 500 letras)',
  clienteNombre: 'Falta el nombre del cliente',
  marca: 'Falta la marca',
  modelo: 'Falta el modelo',
  vehiculoId: 'Elige un vehículo',
};

// Los textos del vehículo y del cliente caben en una tarjeta del tablero y en una columna de la
// base de datos: más largos no son una marca, un modelo ni un nombre.
const TOPES = {
  marca: { largo: 40, mensaje: 'La marca tiene como máximo 40 caracteres' },
  modelo: { largo: 40, mensaje: 'El modelo tiene como máximo 40 caracteres' },
  clienteNombre: { largo: 80, mensaje: 'El nombre tiene como máximo 80 caracteres' },
};

const SOLO_CIFRAS = /^\d+$/;

// El tope de un campo al que el bloque no pone ninguno: más allá no habría un entero exacto.
export const SIN_LIMITE = Number.MAX_SAFE_INTEGER;

// Lo que llega de un formulario es un objeto de campos. Cualquier otra cosa se trata como un
// formulario vacío, para que cada campo explique lo que falta en vez de un error general.
const CAMPOS = z.record(z.string(), z.unknown()).catch({});

function erroresDe(error: z.ZodError): Errores {
  const errores: Errores = {};
  for (const { path, message } of error.issues) {
    errores[String(path[0])] ??= message;
  }
  return errores;
}

// Los validadores de formularios de los casos de uso comparten esto: nunca lanza, dice si va bien
// o qué campo falla y por qué.
export function validar<S extends z.ZodType>(
  esquema: S,
  entrada: unknown,
): Validacion<z.output<S>> {
  const resultado = esquema.safeParse(CAMPOS.parse(entrada));
  if (resultado.success) return { ok: true, datos: resultado.data };
  return { ok: false, errores: erroresDe(resultado.error) };
}

// Un mismo mensaje para quedarse corto y pasarse, salvo que se dé otro para pasarse.
export const textoEntre = (
  minimo: number,
  maximo: number,
  mensaje: string,
  mensajeSiSePasa: string = mensaje,
) => z.string({ error: mensaje }).trim().min(minimo, mensaje).max(maximo, mensajeSiSePasa);

// Un entero escrito en un formulario llega como texto: vale el número o el texto de solo cifras.
export const enteroEntre = (minimo: number, maximo: number, mensaje: string) =>
  z.preprocess(
    (valor) =>
      typeof valor === 'string' && SOLO_CIFRAS.test(valor.trim()) ? Number(valor) : valor,
    z.int({ error: mensaje }).min(minimo, mensaje).max(maximo, mensaje),
  );

// Un valor que se normaliza a texto o a null: el null es lo que no se pudo entender.
const normalizado = (normalizar: (texto: string) => string | null, mensaje: string) =>
  z
    .string({ error: mensaje })
    .transform(normalizar)
    .pipe(z.string({ error: mensaje }));

// El navegador manda los saltos de línea de un textarea como \r\n, pero su maxlength cuenta cada uno
// como un carácter: se igualan a \n antes de medir, para no rechazar lo que el formulario dejó
// escribir, y así se guardan.
const descripcion = z
  .string({ error: MENSAJES.descripcion })
  .transform((texto) => texto.replace(/\r\n?/g, '\n'))
  .pipe(textoEntre(5, 500, MENSAJES.descripcion));

const conVehiculoExistente = z.object({
  descripcion,
  vehiculoId: z.guid({ error: MENSAJES.vehiculoId }),
});

const conVehiculoNuevo = z.object({
  descripcion,
  matricula: normalizado(normalizarMatricula, MENSAJES.matricula),
  marca: textoEntre(1, TOPES.marca.largo, MENSAJES.marca, TOPES.marca.mensaje),
  modelo: textoEntre(1, TOPES.modelo.largo, MENSAJES.modelo, TOPES.modelo.mensaje),
  clienteNombre: textoEntre(
    1,
    TOPES.clienteNombre.largo,
    MENSAJES.clienteNombre,
    TOPES.clienteNombre.mensaje,
  ),
  clienteTelefono: normalizado(normalizarTelefono, MENSAJES.clienteTelefono),
});

const CAMPOS_DEL_VEHICULO_NUEVO = [
  'matricula',
  'marca',
  'modelo',
  'clienteNombre',
  'clienteTelefono',
];

const tieneTexto = (valor: unknown) => typeof valor === 'string' && valor.trim() !== '';

// El formulario manda un vehículo elegido o los datos de uno nuevo. Con vehículo elegido, ese
// manda. Sin él, que se haya escrito algo del vehículo nuevo es lo que hace pedir el resto de sus
// campos; si no hay nada, lo que falta es elegir un vehículo.
function esquemaSegun(entrada: unknown) {
  const campos = CAMPOS.parse(entrada);
  const eligioVehiculo = tieneTexto(campos.vehiculoId);
  const escribioVehiculoNuevo = CAMPOS_DEL_VEHICULO_NUEVO.some((campo) =>
    tieneTexto(campos[campo]),
  );

  return !eligioVehiculo && escribioVehiculoNuevo ? conVehiculoNuevo : conVehiculoExistente;
}

export function validarNuevaOrden(entrada: unknown): Validacion<DatosOrden> {
  return validar(esquemaSegun(entrada), entrada);
}
