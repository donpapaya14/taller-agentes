import type { NextConfig } from 'next';
import { crearCabeceras } from './src/cabeceras';

const nextConfig: NextConfig = {
  /* config options here */
  images: { unoptimized: true },
  // Por defecto Next responde «X-Powered-By: Next.js»: a quien visita no le sirve y a quien busca
  // fallos conocidos le dice dónde mirar.
  poweredByHeader: false,
  async headers() {
    return [{ source: '/(.*)', headers: crearCabeceras(process.env.NODE_ENV !== 'production') }];
  },
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
};

export default nextConfig;
