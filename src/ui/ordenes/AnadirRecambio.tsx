import { BotonDeEnvio } from '../BotonDeEnvio';
import { EstadoVacio } from '../EstadoVacio';

type RecambioElegible = { id: string; referencia: string; nombre: string };

type PropsAnadir = {
  ordenId: string;
  recambios: RecambioElegible[];
  accion: (datos: FormData) => void | Promise<void>;
};

const CAMPO =
  'min-h-toque w-full min-w-0 rounded-pieza border border-raya bg-chapa-alta px-e4 text-base text-hueso';

const ETIQUETA = 'text-nota font-seminegra text-acero';

/**
 * Añade un recambio del almacén a la orden. Solo ofrece referencia y nombre: el precio lo pone la
 * base de datos al guardar la línea, y quien monta el recambio no tiene por qué verlo.
 */
export function AnadirRecambio({ ordenId, recambios, accion }: PropsAnadir) {
  if (recambios.length === 0) {
    return <EstadoVacio texto="No hay más recambios en el almacén para añadir" />;
  }

  return (
    <form
      action={accion}
      className="flex flex-col gap-e4 rounded-pieza border border-raya bg-chapa p-e4"
    >
      <input type="hidden" name="ordenId" value={ordenId} />
      <div className="flex flex-col gap-e2">
        <label htmlFor={`${ordenId}-recambio`} className={ETIQUETA}>
          Recambio
        </label>
        <select id={`${ordenId}-recambio`} name="recambioId" required className={CAMPO}>
          <option value="">Elige un recambio</option>
          {recambios.map(({ id, referencia, nombre }) => (
            <option key={id} value={id}>
              {referencia} · {nombre}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-e2">
        <label htmlFor={`${ordenId}-cantidad`} className={ETIQUETA}>
          Cantidad
        </label>
        <input
          id={`${ordenId}-cantidad`}
          type="number"
          name="cantidad"
          min={1}
          max={999}
          step={1}
          inputMode="numeric"
          required
          defaultValue={1}
          className={CAMPO}
        />
      </div>
      <BotonDeEnvio variante="secundario">Añadir</BotonDeEnvio>
    </form>
  );
}
