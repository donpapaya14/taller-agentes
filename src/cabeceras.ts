// 'unsafe-inline' sigue en scripts y estilos a propósito: la CSP con nonce obliga a renderizar todo
// en dinámico y /proceso es estática. Se compensa con el escape de React y cookies httpOnly.
const POLITICA_DE_CONTENIDO = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

export const CABECERAS: { key: string; value: string }[] = [
  { key: 'Content-Security-Policy', value: POLITICA_DE_CONTENIDO },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];
