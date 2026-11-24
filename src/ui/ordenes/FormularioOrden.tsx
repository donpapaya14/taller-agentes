'use client';

import { useActionState, useId, useState, type ReactNode } from 'react';
import { Aviso } from '../Aviso';
import { Boton } from '../Boton';
import { IconoAvanzar } from '../iconos';
import { Matricula } from '../Matricula';

type Textos = Record<string, string>;

// Lo que la acción devuelve al formulario: un mensaje por campo, un motivo general si el fallo no es
// de ningún campo y lo que se escribió, para que al corregir no haya que volver a escribirlo todo
// (React vacía los campos de un formulario cuando termina su acción).
export type EstadoFormulario = { errores: Textos; motivo: string | null; valores: Textos };

type VehiculoElegible = { id: string; matricula: string; etiqueta: string };

type PropsFormulario = {
  vehiculos: VehiculoElegible[];
  accion: (estado: EstadoFormulario, datos: FormData) => Promise<EstadoFormulario>;
};

const SIN_ENVIAR: EstadoFormulario = { errores: {}, motivo: null, valores: {} };

// La opción que despliega los datos del vehículo nuevo. No viaja: al servidor le llega un
// `vehiculoId` vacío, que es como el caso de uso distingue «vehículo nuevo» de «vehículo elegido».
const VEHICULO_NUEVO = 'nuevo';

// Los mismos topes que valida el caso de uso: el navegador avisa antes, el servidor decide.
const CAMPOS_DE_TEXTO = [
  { nombre: 'marca', etiqueta: 'Marca', largo: 40, tipo: 'text' },
  { nombre: 'modelo', etiqueta: 'Modelo', largo: 40, tipo: 'text' },
  { nombre: 'clienteNombre', etiqueta: 'Nombre del cliente', largo: 80, tipo: 'text' },
  { nombre: 'clienteTelefono', etiqueta: 'Teléfono del cliente', largo: undefined, tipo: 'tel' },
] as const;

const ENTRADA =
  'min-h-toque w-full rounded-pieza border border-raya bg-chapa-alta px-e4 text-base text-hueso aria-invalid:border-averia';

// Un campo con error lo señala y apunta al texto que lo explica.
const conError = (id: string, error: string | undefined) =>
  error === undefined ? {} : { 'aria-invalid': true as const, 'aria-describedby': `${id}-error` };

function Campo({
  id,
  etiqueta,
  error,
  children,
}: {
  id: string;
  etiqueta: string;
  error: string | undefined;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-e2">
      <label htmlFor={id} className="text-nota font-seminegra text-acero">
        {etiqueta}
      </label>
      {children}
      {error !== undefined && (
        <p id={`${id}-error`} role="alert" className="text-menor text-averia">
          {error}
        </p>
      )}
    </div>
  );
}

type PropsVehiculoNuevo = { id: string; errores: Textos; valores: Textos };

// La matrícula escrita se dibuja como placa: lo que se ve es lo que se va a guardar.
function VehiculoNuevo({ id, errores, valores }: PropsVehiculoNuevo) {
  const [matricula, setMatricula] = useState(valores.matricula ?? '');
  const idMatricula = `${id}-matricula`;
  const escrita = matricula.trim().toUpperCase();

  return (
    <>
      <Campo id={idMatricula} etiqueta="Matrícula" error={errores.matricula}>
        <input
          id={idMatricula}
          name="matricula"
          required
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          value={matricula}
          onChange={(cambio) => setMatricula(cambio.target.value)}
          className={ENTRADA}
          {...conError(idMatricula, errores.matricula)}
        />
        {escrita !== '' && (
          <div className="@container">
            <Matricula texto={escrita} />
          </div>
        )}
      </Campo>
      {CAMPOS_DE_TEXTO.map(({ nombre, etiqueta, largo, tipo }) => {
        const idCampo = `${id}-${nombre}`;
        return (
          <Campo key={nombre} id={idCampo} etiqueta={etiqueta} error={errores[nombre]}>
            <input
              id={idCampo}
              name={nombre}
              type={tipo}
              inputMode={tipo === 'tel' ? 'tel' : undefined}
              required
              maxLength={largo}
              autoComplete="off"
              defaultValue={valores[nombre] ?? ''}
              className={ENTRADA}
              {...conError(idCampo, errores[nombre])}
            />
          </Campo>
        );
      })}
    </>
  );
}

function SelectorDeVehiculo(props: {
  id: string;
  vehiculos: VehiculoElegible[];
  eleccion: string;
  error: string | undefined;
  alElegir: (eleccion: string) => void;
}) {
  const { id, vehiculos, eleccion, error, alElegir } = props;
  return (
    <Campo id={id} etiqueta="Vehículo" error={error}>
      <select
        id={id}
        required
        value={eleccion}
        onChange={(cambio) => alElegir(cambio.target.value)}
        className={ENTRADA}
        {...conError(id, error)}
      >
        <option value="">Elige un vehículo</option>
        {vehiculos.map(({ id: vehiculoId, matricula, etiqueta }) => (
          <option key={vehiculoId} value={vehiculoId}>
            {etiqueta === '' ? matricula : `${matricula} · ${etiqueta}`}
          </option>
        ))}
        <option value={VEHICULO_NUEVO}>Vehículo nuevo</option>
      </select>
    </Campo>
  );
}

/**
 * El formulario de una orden nueva: un vehículo del taller o uno nuevo con su cliente, y lo que hay
 * que hacer. Es de cliente solo para desplegar los datos del vehículo nuevo y dibujar la placa; lo
 * que se manda lo valida el servidor.
 */
export function FormularioOrden({ vehiculos, accion }: PropsFormulario) {
  const [estado, enviar, pendiente] = useActionState(accion, SIN_ENVIAR);
  const [eleccion, setEleccion] = useState(vehiculos.length === 0 ? VEHICULO_NUEVO : '');
  const id = useId();
  const { errores, valores } = estado;
  const esNuevo = eleccion === VEHICULO_NUEVO;

  return (
    <form
      action={enviar}
      className="flex w-full max-w-lectura flex-col gap-e5 rounded-pieza border border-raya bg-chapa p-e5"
    >
      {estado.motivo !== null && <Aviso tipo="error" texto={estado.motivo} />}
      <SelectorDeVehiculo
        id={`${id}-vehiculo`}
        vehiculos={vehiculos}
        eleccion={eleccion}
        error={errores.vehiculoId}
        alElegir={setEleccion}
      />
      <input type="hidden" name="vehiculoId" value={esNuevo ? '' : eleccion} />
      {esNuevo && <VehiculoNuevo id={id} errores={errores} valores={valores} />}
      <Campo id={`${id}-descripcion`} etiqueta="Qué hay que hacer" error={errores.descripcion}>
        <textarea
          id={`${id}-descripcion`}
          name="descripcion"
          required
          maxLength={500}
          rows={4}
          defaultValue={valores.descripcion ?? ''}
          className={`${ENTRADA} py-e3`}
          {...conError(`${id}-descripcion`, errores.descripcion)}
        />
      </Campo>
      <Boton type="submit" disabled={pendiente}>
        Crear orden
        <IconoAvanzar className="size-e5 shrink-0" />
      </Boton>
    </form>
  );
}
