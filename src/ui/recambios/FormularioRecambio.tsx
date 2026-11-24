'use client';

import { useActionState, useId, type InputHTMLAttributes } from 'react';
import { Boton } from '../Boton';

// El tipo vive aquí y ListaRecambios.tsx lo reexporta: así el formulario no importa de la lista y no
// hay ciclo. `precio` llega ya escrito para mostrarlo («1.234,56 €») y es null si quien mira no puede
// verlo.
export type RecambioVista = {
  id: string;
  referencia: string;
  nombre: string;
  precio: string | null;
  stock: number;
  stockMinimo: number;
  bajoMinimo: boolean;
};

type Textos = Partial<Record<string, string>>;

// Lo que contesta la acción de guardar. Con un fallo, `valores` devuelve lo que se mandó: React vacía
// los campos del formulario al terminar la acción y quien ha escrito algo mal quiere corregirlo, no
// volver a escribirlo todo.
export type EstadoDelFormulario =
  null | { ok: true } | { ok: false; motivo: string; errores: Textos; valores: Textos };

export type AccionGuardar = (
  estado: EstadoDelFormulario,
  datos: FormData,
) => Promise<EstadoDelFormulario>;

// Sin acción el formulario se dibuja igual y guardar no cambia nada.
const SIN_ACCION: AccionGuardar = (estado) => Promise.resolve(estado);

// El precio llega como se muestra («1.234,56 €») y el campo lo quiere como se teclea («1234,56»).
const precioParaEscribir = (precio: string | null) => (precio ?? '').replace(/[^\d,]/g, '');

// Lo que enseña cada campo al abrir el formulario: vacío en el alta y lo del recambio al editarlo.
function valoresIniciales(recambio: RecambioVista | undefined): Textos {
  if (recambio === undefined) return {};
  return {
    precio: precioParaEscribir(recambio.precio),
    stock: String(recambio.stock),
    stockMinimo: String(recambio.stockMinimo),
  };
}

type PropsCampo = InputHTMLAttributes<HTMLInputElement> & {
  idBase: string;
  nombre: string;
  etiqueta: string;
  valor: string;
  error: string | undefined;
};

function Campo({ idBase, nombre, etiqueta, valor, error, ...atributos }: PropsCampo) {
  const id = `${idBase}-${nombre}`;
  const idDelError = `${id}-error`;
  const conError = error !== undefined;

  return (
    <div className="flex flex-col gap-e2">
      <label htmlFor={id} className="text-nota font-seminegra text-acero">
        {etiqueta}
      </label>
      <input
        id={id}
        name={nombre}
        defaultValue={valor}
        autoComplete="off"
        aria-invalid={conError || undefined}
        aria-describedby={conError ? idDelError : undefined}
        className="min-h-toque w-full rounded-pieza border border-raya bg-chapa-alta px-e4 text-base text-hueso aria-invalid:border-averia"
        {...atributos}
      />
      {conError && (
        <p id={idDelError} className="text-nota text-averia">
          {error}
        </p>
      )}
    </div>
  );
}

// Al editar solo se piden stock, mínimo y precio: la referencia y el nombre viajan sin pedirse, con
// lo que ya tiene el recambio, porque guardar escribe las cinco columnas.
function CamposOcultos({ recambio }: { recambio: RecambioVista }) {
  return (
    <>
      <input type="hidden" name="id" value={recambio.id} />
      <input type="hidden" name="referencia" value={recambio.referencia} />
      <input type="hidden" name="nombre" value={recambio.nombre} />
    </>
  );
}

function Resultado({ estado }: { estado: EstadoDelFormulario }) {
  if (estado === null) return null;
  if (estado.ok) {
    return (
      <p
        role="status"
        className="rounded-pieza border border-testigo bg-chapa px-e4 py-e3 text-menor text-testigo"
      >
        Recambio guardado
      </p>
    );
  }
  return (
    <p
      role="alert"
      className="rounded-pieza border border-averia bg-chapa px-e4 py-e3 text-menor text-averia"
    >
      {estado.motivo}
    </p>
  );
}

type PropsFormulario = { recambio?: RecambioVista; accion?: AccionGuardar };

/**
 * Sin `recambio` es el alta de uno nuevo; con él, la edición de su stock, su mínimo y su precio. Los
 * errores salen junto a su campo y el motivo, arriba del botón.
 */
export function FormularioRecambio({ recambio, accion = SIN_ACCION }: PropsFormulario) {
  const idBase = useId();
  const [estado, enviar, enviando] = useActionState(accion, null);
  const inicial = valoresIniciales(recambio);
  const fallo = estado?.ok === false ? estado : null;
  const valorDe = (nombre: string) => fallo?.valores[nombre] ?? inicial[nombre] ?? '';
  const campo = (
    nombre: string,
    etiqueta: string,
    atributos: InputHTMLAttributes<HTMLInputElement> = {},
  ) => (
    <Campo
      idBase={idBase}
      nombre={nombre}
      etiqueta={etiqueta}
      valor={valorDe(nombre)}
      error={fallo?.errores[nombre]}
      {...atributos}
    />
  );

  return (
    <form action={enviar} noValidate className="flex w-full max-w-lectura flex-col gap-e4">
      {recambio === undefined ? (
        <>
          {campo('referencia', 'Referencia', { autoCapitalize: 'characters', spellCheck: false })}
          {campo('nombre', 'Nombre')}
        </>
      ) : (
        <CamposOcultos recambio={recambio} />
      )}
      {campo('precio', 'Precio en euros', { inputMode: 'decimal' })}
      {campo('stock', 'Stock', { inputMode: 'numeric' })}
      {campo('stockMinimo', 'Stock mínimo', { inputMode: 'numeric' })}
      <Resultado estado={estado} />
      <Boton type="submit" disabled={enviando} className="self-start">
        {recambio === undefined ? 'Guardar recambio' : 'Guardar cambios'}
        {recambio !== undefined && <span className="sr-only"> de {recambio.referencia}</span>}
      </Boton>
    </form>
  );
}
