import { z } from 'zod';
import { eurosACentimos } from '@/nucleo/importe';
import { SIN_LIMITE, enteroEntre, textoEntre, validar, type Errores } from './nueva-orden';

export type DatosRecambio = {
  referencia: string;
  nombre: string;
  precioCentimos: number;
  stock: number;
  stockMinimo: number;
};

// Sin id es un alta; con el id de un recambio, una edición de ese recambio.
type DatosAGuardar = DatosRecambio & { id?: string };

// Lo más que guarda una columna integer de Postgres: el tope del stock, del mínimo y del precio en
// céntimos (21.474.836,47 €). Un valor mayor no se guarda y el error de la base de datos no dice qué
// corregir, así que el validador lo dice junto al campo.
const TOPE_DE_POSTGRES = 2_147_483_647;

const MENSAJES = {
  referencia: 'La referencia tiene entre 2 y 20 caracteres',
  nombre: 'Falta el nombre del recambio',
  precio: 'Precio no válido. Ejemplo: 12,50',
  entero: 'Tiene que ser un número entero, cero o más',
  stockTope: 'El stock no puede pasar de 2.147.483.647',
  minimoTope: 'El mínimo no puede pasar de 2.147.483.647',
  precioTope: 'El precio no puede pasar de 21.474.836,47 €',
  id: 'No se reconoce el recambio. Recarga la página',
  revisar: 'Revisa los campos con error',
  referenciaRepetida: 'Ya hay un recambio con esa referencia',
  sinPermisoONoExiste:
    'No se pudo guardar el recambio. Puede que ya no exista o que no tengas permiso para editarlo.',
};

// Un entero de cero en adelante, que además no pase del tope: entre el tope y el mayor entero seguro
// el mensaje dice cuál es el tope, que «cero o más» ya cumple y no explicaría nada.
const enteroHastaElTope = (mensajeDelTope: string) =>
  enteroEntre(0, SIN_LIMITE, MENSAJES.entero).pipe(
    z.number().max(TOPE_DE_POSTGRES, mensajeDelTope),
  );

// El precio se escribe en euros y se guarda en céntimos (D-5); `eurosACentimos` da null si no lo
// entiende y `z.int` convierte ese null en el mensaje.
const ESQUEMA_RECAMBIO = z
  .object({
    id: z.guid({ error: MENSAJES.id }).optional(),
    referencia: textoEntre(2, 20, MENSAJES.referencia).transform((texto) => texto.toUpperCase()),
    nombre: textoEntre(2, 80, MENSAJES.nombre),
    precio: z
      .string({ error: MENSAJES.precio })
      .trim()
      .transform(eurosACentimos)
      .pipe(z.int({ error: MENSAJES.precio }).max(TOPE_DE_POSTGRES, MENSAJES.precioTope)),
    stock: enteroHastaElTope(MENSAJES.stockTope),
    stockMinimo: enteroHastaElTope(MENSAJES.minimoTope),
  })
  .transform(({ precio, ...resto }): DatosAGuardar => ({ ...resto, precioCentimos: precio }));

export function validarRecambio(
  entrada: unknown,
): { ok: true; datos: DatosAGuardar } | { ok: false; errores: Errores } {
  return validar(ESQUEMA_RECAMBIO, entrada);
}

type ResultadoDelFormulario = { ok: true } | { ok: false; motivo: string; errores: Errores };

// El repositorio de recambios, como lo necesita el caso de uso. Los motivos son los de
// `guardarRecambio` del adaptador, que no puede importar de esta capa.
type PuertoDeRecambios = {
  guardarRecambio: (
    datos: DatosAGuardar,
    tallerId: string,
  ) => Promise<
    { ok: true } | { ok: false; motivo: 'referencia_repetida' | 'sin_permiso_o_no_encontrado' }
  >;
};

// Los errores van junto a su campo. El motivo es lo que se dice arriba del formulario: un id roto
// no tiene campo donde pintarse, así que su mensaje sube a motivo.
function rechazoDeCampos(errores: Errores): ResultadoDelFormulario {
  return { ok: false, motivo: errores.id ?? MENSAJES.revisar, errores };
}

// Valida lo que manda el formulario de un recambio, lo guarda en el taller y explica por qué no se
// guardó. Si el repositorio falla, el fallo sube: quien lo llama sabe qué decirle a la pantalla.
export async function guardarFormularioDeRecambio(
  entrada: unknown,
  tallerId: string,
  puerto: PuertoDeRecambios,
): Promise<ResultadoDelFormulario> {
  const validacion = validarRecambio(entrada);
  if (!validacion.ok) return rechazoDeCampos(validacion.errores);

  const resultado = await puerto.guardarRecambio(validacion.datos, tallerId);
  if (resultado.ok) return { ok: true };
  if (resultado.motivo === 'referencia_repetida') {
    return rechazoDeCampos({ referencia: MENSAJES.referenciaRepetida });
  }
  return { ok: false, motivo: MENSAJES.sinPermisoONoExiste, errores: {} };
}
