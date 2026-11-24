'use client';

import type { ComponentProps } from 'react';
import { useFormStatus } from 'react-dom';
import { Boton } from './Boton';

type PropsBotonDeEnvio = Omit<ComponentProps<typeof Boton>, 'type' | 'disabled'>;

/**
 * El botón que envía un formulario con acción de servidor. Mientras la acción se ejecuta queda
 * desactivado: un segundo toque la lanzaría otra vez y encontraría la orden ya movida o entregada,
 * y acabaría en un aviso de error. Tiene que ir dentro del formulario, en su propio componente:
 * useFormStatus solo ve el formulario que tiene por encima.
 */
export function BotonDeEnvio(props: PropsBotonDeEnvio) {
  const { pending } = useFormStatus();
  return <Boton type="submit" disabled={pending} {...props} />;
}
