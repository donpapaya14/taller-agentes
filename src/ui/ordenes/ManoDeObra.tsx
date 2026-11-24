import { Boton } from '../Boton';

type PropsManoDeObra = {
  ordenId: string;
  minutos: number;
  accion: (datos: FormData) => void | Promise<void>;
};

/** Los minutos de trabajo de la orden. Lo que cuestan lo calcula el servidor con el precio por hora. */
export function ManoDeObra({ ordenId, minutos, accion }: PropsManoDeObra) {
  return (
    <form
      action={accion}
      className="flex flex-col gap-e4 rounded-pieza border border-raya bg-chapa p-e4"
    >
      <input type="hidden" name="ordenId" value={ordenId} />
      <div className="flex flex-col gap-e2">
        <label htmlFor={`${ordenId}-minutos`} className="text-nota font-seminegra text-acero">
          Mano de obra (minutos)
        </label>
        <input
          id={`${ordenId}-minutos`}
          type="number"
          name="minutos"
          min={0}
          max={6000}
          step={1}
          inputMode="numeric"
          required
          defaultValue={minutos}
          className="min-h-toque w-full min-w-0 rounded-pieza border border-raya bg-chapa-alta px-e4 text-base text-hueso"
        />
      </div>
      <Boton type="submit" variante="secundario">
        Guardar mano de obra
      </Boton>
    </form>
  );
}
