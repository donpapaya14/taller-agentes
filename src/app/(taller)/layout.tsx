import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { leerSesion } from '@/adaptadores/supabase/sesion';
import { Navegacion } from '@/ui/Navegacion';
import { salir } from '../login/acciones';

// Todo lo privado depende de quién lo pide. Sin esto, un build sin las variables de Supabase intenta
// dejar cada pantalla hecha: el error de entorno salta antes de leer las cookies, Next no la marca
// como dinámica y la compilación falla.
export const dynamic = 'force-dynamic';

// El proxy orienta, pero no es la barrera: cada pantalla privada empieza por leerSesion() y, sin
// sesión, no pinta nada. Cada pantalla (y su loading y su error) abre su propio <main>; el armazón
// solo pone la navegación. El pie deja sitio a la barra fija de abajo, que en móvil tapa lo que
// haya detrás.
export default async function LayoutDelTaller({ children }: Readonly<{ children: ReactNode }>) {
  const sesion = await leerSesion();
  if (sesion === null) redirect('/login');

  return (
    <div className="flex min-h-dvh flex-col pb-e8 lg:pb-0">
      <Navegacion
        taller={sesion.taller}
        nombre={sesion.nombre}
        rol={sesion.rol}
        accionSalir={salir}
      />
      {children}
    </div>
  );
}
