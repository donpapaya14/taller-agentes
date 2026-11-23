import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { variablesDeFuente } from '@/ui/fuentes';
import './globals.css';

export const metadata: Metadata = {
  title: 'FOSO',
  description: 'Órdenes de trabajo, recambios y avisos al cliente de un taller mecánico.',
};

// Tipo explícito: LayoutProps solo existe tras `next dev` o `next build`
// y `tsc` fallaría en un clon limpio.
export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="es" className={variablesDeFuente}>
      <body>{children}</body>
    </html>
  );
}
