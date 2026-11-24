import { anteriorEstado, ETIQUETA_ESTADO, siguienteEstado, type Estado } from '../../nucleo/orden';
import { Boton } from '../Boton';
import { IconoAvanzar } from '../iconos';

type AccionDeFormulario = (datos: FormData) => void | Promise<void>;

type PropsPaso = {
  ordenId: string;
  de: Estado;
  a: Estado;
  texto: string;
  variante: 'principal' | 'secundario';
  accion: AccionDeFormulario;
};

// El servidor decide si el paso vale: el formulario cuenta de dónde se parte y adónde se va.
function Paso({ ordenId, de, a, texto, variante, accion }: PropsPaso) {
  return (
    <form action={accion}>
      <input type="hidden" name="id" value={ordenId} />
      <input type="hidden" name="de" value={de} />
      <input type="hidden" name="a" value={a} />
      <Boton type="submit" variante={variante}>
        {texto}
        {variante === 'principal' && <IconoAvanzar className="size-e5 shrink-0" />}
      </Boton>
    </form>
  );
}

const enMinusculas = (estado: Estado) => ETIQUETA_ESTADO[estado].toLowerCase();

/**
 * Los botones que llevan una orden a su estado vecino. Pasar a «entregado» no está aquí: se entrega
 * con su aviso y su factura (AccionesOrden). Una orden entregada ya no cambia y no ofrece nada.
 */
export function CambioDeEstado({
  ordenId,
  estado,
  accion,
}: {
  ordenId: string;
  estado: Estado;
  accion: AccionDeFormulario;
}) {
  const anterior = anteriorEstado(estado);
  const siguiente = siguienteEstado(estado);
  const avance = siguiente !== null && siguiente !== 'entregado' ? siguiente : null;
  if (anterior === null && avance === null) return null;

  return (
    <div className="flex flex-wrap gap-e3">
      {anterior !== null && (
        <Paso
          ordenId={ordenId}
          de={estado}
          a={anterior}
          texto={`Volver a ${enMinusculas(anterior)}`}
          variante="secundario"
          accion={accion}
        />
      )}
      {avance !== null && (
        <Paso
          ordenId={ordenId}
          de={estado}
          a={avance}
          texto={`Pasar a ${enMinusculas(avance)}`}
          variante="principal"
          accion={accion}
        />
      )}
    </div>
  );
}
