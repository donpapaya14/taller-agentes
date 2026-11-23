export const RUTAS_PUBLICAS = ['/', '/proceso', '/login'] as const;

export const USUARIOS_DEMO = {
  jefe: 'jefe@tallerdemo.example',
  mecanico: 'mecanico@tallerdemo.example',
  otro: 'jefe@otrotaller.example',
} as const;

type Decision = { tipo: 'pasa' } | { tipo: 'redirige'; a: '/login' | '/tablero' };

const PUBLICAS: readonly string[] = RUTAS_PUBLICAS;

// El cron no lleva sesión: se identifica con su propio secreto en la ruta.
const PREFIJO_DEL_CRON = '/api/cron/';

const esPublica = (ruta: string) => PUBLICAS.includes(ruta) || ruta.startsWith(PREFIJO_DEL_CRON);

// Solo orienta al visitante. Quién puede leer o cambiar datos lo decide RLS en la base de datos.
export function decidirAcceso(ruta: string, haySesion: boolean): Decision {
  if (haySesion) {
    return ruta === '/login' ? { tipo: 'redirige', a: '/tablero' } : { tipo: 'pasa' };
  }
  return esPublica(ruta) ? { tipo: 'pasa' } : { tipo: 'redirige', a: '/login' };
}
