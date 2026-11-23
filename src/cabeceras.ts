// 'unsafe-inline' sigue en scripts y estilos a propósito: la CSP con nonce obliga a renderizar todo
// en dinámico y /proceso es estática. Se compensa con el escape de React y cookies httpOnly.
// 'unsafe-eval' solo en desarrollo: React lo usa allí para reconstruir pilas de llamadas y sin él
// no arranca next dev. En producción no se permite nunca.
function politicaDeContenido(esDesarrollo: boolean): string {
  const scripts = esDesarrollo
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
    : "script-src 'self' 'unsafe-inline'";
  return [
    "default-src 'self'",
    scripts,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
}

export function crearCabeceras(esDesarrollo: boolean): { key: string; value: string }[] {
  return [
    { key: 'Content-Security-Policy', value: politicaDeContenido(esDesarrollo) },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  ];
}

export const CABECERAS = crearCabeceras(false);
