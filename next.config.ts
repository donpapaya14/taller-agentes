import type { NextConfig } from 'next';
import { CABECERAS } from './src/cabeceras';

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  images: { unoptimized: true },
  async headers() {
    return [{ source: '/(.*)', headers: CABECERAS }];
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
