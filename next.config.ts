import type { NextConfig } from 'next';
import { crearCabeceras } from './src/cabeceras';

const nextConfig: NextConfig = {
  /* config options here */
  images: { unoptimized: true },
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
