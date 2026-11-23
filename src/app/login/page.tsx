'use client';

import type { InputHTMLAttributes } from 'react';
import { use, useActionState } from 'react';
import { Boton } from '@/ui/Boton';
import { IconoAvanzar, IconoLlave } from '@/ui/iconos';
import { entrar, entrarComoDemo } from './acciones';

const AVISO_DE_DEMO =
  'No se pudo entrar con la cuenta de demostración. Inténtalo de nuevo en unos minutos.';

function Aviso({ texto }: { texto: string }) {
  return (
    <p
      role="alert"
      className="rounded-pieza border border-averia bg-chapa px-e4 py-e3 text-menor text-averia"
    >
      {texto}
    </p>
  );
}

type PropsCampo = InputHTMLAttributes<HTMLInputElement> & { id: string; etiqueta: string };

function Campo({ etiqueta, ...entrada }: PropsCampo) {
  return (
    <div className="flex flex-col gap-e2">
      <label htmlFor={entrada.id} className="text-nota font-seminegra text-acero">
        {etiqueta}
      </label>
      <input
        required
        className="min-h-toque w-full rounded-pieza border border-raya bg-chapa-alta px-e4 text-base text-hueso"
        {...entrada}
      />
    </div>
  );
}

function FormularioDeCorreo() {
  const [estado, accionEntrar, entrando] = useActionState(entrar, { error: null });

  return (
    <form action={accionEntrar} className="flex flex-col gap-e4">
      <Campo
        etiqueta="Correo"
        id="correo"
        name="correo"
        type="email"
        inputMode="email"
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
      />
      <Campo
        etiqueta="Contraseña"
        id="contrasena"
        name="contrasena"
        type="password"
        autoComplete="current-password"
      />
      {estado.error !== null && <Aviso texto={estado.error} />}
      <Boton type="submit" disabled={entrando} className="w-full">
        Entrar
        <IconoAvanzar className="size-e5 shrink-0" />
      </Boton>
    </form>
  );
}

function AccesosDeDemostracion({ conAviso }: { conAviso: boolean }) {
  return (
    <form action={entrarComoDemo} className="flex flex-col gap-e3 border-t border-raya pt-e5">
      <h2 className="font-dato text-nota tracking-dato text-acero uppercase">
        Accesos de demostración
      </h2>
      {conAviso && <Aviso texto={AVISO_DE_DEMO} />}
      {[
        { rol: 'jefe', texto: 'Entrar como jefe' },
        { rol: 'mecanico', texto: 'Entrar como mecánico' },
      ].map(({ rol, texto }) => (
        <Boton
          key={rol}
          type="submit"
          name="rol"
          value={rol}
          variante="secundario"
          className="w-full"
        >
          {texto}
          <IconoLlave className="size-e5 shrink-0 text-lampara group-hover:text-foso" />
        </Boton>
      ))}
    </form>
  );
}

// searchParams llega como promesa y se lee con use(): el aviso de la demostración viaja en la
// dirección (?error=demo) porque entrarComoDemo no devuelve nada, solo redirige. Solo se reconoce
// ese código: cualquier otro texto de la dirección se ignora y nunca se escribe en la página.
export default function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const { error } = use(searchParams);

  return (
    <main className="flex min-h-dvh flex-col">
      <div aria-hidden="true" className="franja-seguridad" />
      {/* La primera columna mide lo que el nombre y el panel se queda con el resto: con dos mitades
          iguales, FOSO no cabe en su columna entre 1024 y 1056 px. */}
      <div className="grid flex-1 content-center gap-e7 px-e4 py-e7 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-center lg:px-e5">
        <h1 className="font-titular text-marca font-supernegra tracking-titular uppercase">FOSO</h1>
        <div className="flex w-full max-w-lectura flex-col gap-e6 rounded-pieza border border-raya bg-chapa p-e5 lg:justify-self-end">
          <FormularioDeCorreo />
          <AccesosDeDemostracion conAviso={error === 'demo'} />
        </div>
      </div>
    </main>
  );
}
