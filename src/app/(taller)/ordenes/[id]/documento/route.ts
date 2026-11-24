import { redirect } from 'next/navigation';
import { z } from 'zod';
import { generarPdf } from '@/adaptadores/pdf/generar';
import { crearClienteServidor } from '@/adaptadores/supabase/cliente-servidor';
import type { OrdenDetalle } from '@/adaptadores/supabase/filas';
import { leerOrden } from '@/adaptadores/supabase/ordenes';
import { leerSesion, type Sesion } from '@/adaptadores/supabase/sesion';
import { construirDocumento, type DocumentoOrden, type EntradaDocumento } from '@/nucleo/documento';
import { puede } from '@/nucleo/permisos';

const MENSAJES = {
  sesion: 'No se pudo comprobar tu sesión. Inténtalo de nuevo.',
  soloElJefe: 'Solo el jefe de taller puede descargar este documento',
  noEncontrada: 'No encontramos esa orden',
  noSePudo: 'No se pudo generar el documento. Inténtalo de nuevo.',
  taller: 'No se pudo leer el taller',
};

const texto = (mensaje: string, estado: number) => new Response(mensaje, { status: estado });

// En la base de datos el NIF, la dirección y el teléfono del taller pueden faltar.
const FILA_DE_TALLER = z.strictObject({
  nombre: z.string(),
  nif: z.string().nullable(),
  direccion: z.string().nullable(),
  telefono: z.string().nullable(),
});

// Los datos del taller van en la cabecera del documento; los que faltan, en blanco. Los lee quien
// descarga, con su sesión: RLS solo le deja ver el taller en el que trabaja.
async function leerTaller(tallerId: string): Promise<EntradaDocumento['taller']> {
  const cliente = await crearClienteServidor();
  const { data, error } = await cliente
    .from('talleres')
    .select('nombre, nif, direccion, telefono')
    .eq('id', tallerId)
    .maybeSingle();
  if (error) throw new Error(MENSAJES.taller, { cause: error });

  const taller = FILA_DE_TALLER.parse(data);
  return {
    nombre: taller.nombre,
    nif: taller.nif ?? '',
    direccion: taller.direccion ?? '',
    telefono: taller.telefono ?? '',
  };
}

const FECHA = new Intl.DateTimeFormat('es-ES', {
  timeZone: 'Europe/Madrid',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

// Una factura lleva el día de la entrega; un presupuesto, el de la orden.
const fechaDe = (orden: OrdenDetalle) => FECHA.format(new Date(orden.entregadaEn ?? orden.creadaEn));

function entradaDe(orden: OrdenDetalle, taller: EntradaDocumento['taller']): EntradaDocumento {
  return {
    taller,
    cliente: { nombre: orden.cliente, telefono: orden.clienteTelefono },
    vehiculo: { matricula: orden.matricula, marca: orden.marca, modelo: orden.modelo },
    orden: {
      estado: orden.estado,
      descripcion: orden.descripcion,
      numeroFactura: orden.numeroFactura,
      fecha: fechaDe(orden),
      manoObraMinutos: orden.manoObraMinutos,
      precioHoraCentimos: orden.precioHoraCentimos,
    },
    lineas: orden.lineas,
  };
}

// La matrícula y el número salen de la base de datos y van a una cabecera HTTP: solo pasan letras
// sin tilde, cifras, punto, guion y guion bajo; cualquier otra tanda de caracteres es un guion.
const sinRarezas = (valor: string) => valor.replace(/[^A-Za-z0-9._-]+/g, '-');

const nombreDelArchivo = (documento: DocumentoOrden) =>
  documento.tipo === 'factura'
    ? `factura-${sinRarezas(documento.numero ?? '')}.pdf`
    : `presupuesto-${sinRarezas(documento.vehiculo.matricula)}.pdf`;

async function documentoPdf(orden: OrdenDetalle, tallerId: string): Promise<Response> {
  const documento = construirDocumento(entradaDe(orden, await leerTaller(tallerId)));
  const bytes = await generarPdf(documento);

  // `new Uint8Array` copia solo los bytes del PDF: el cuerpo de una respuesta no admite el tipo de
  // un búfer que puede ser una vista de otro más grande.
  return new Response(new Uint8Array(bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${nombreDelArchivo(documento)}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}

// El PDF lleva importes: solo lo descarga quien puede verlos. El proxy no es la barrera: la sesión
// se comprueba aquí, antes de leer nada. Un fallo se cuenta con un texto, no con una página en
// blanco: esto se abre en otra pestaña.
export async function GET(
  _peticion: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  let sesion: Sesion | null;
  try {
    sesion = await leerSesion();
  } catch {
    return texto(MENSAJES.sesion, 500);
  }
  if (sesion === null) redirect('/login');
  if (!puede(sesion.rol, 'ver_importes')) return texto(MENSAJES.soloElJefe, 403);

  try {
    const orden = await leerOrden((await params).id);
    return orden === null
      ? texto(MENSAJES.noEncontrada, 404)
      : await documentoPdf(orden, sesion.tallerId);
  } catch {
    return texto(MENSAJES.noSePudo, 500);
  }
}
