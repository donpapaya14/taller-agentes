# FOSO

FOSO gestiona un taller mecánico: las órdenes de trabajo y los recambios con su stock. Es una aplicación Next.js con Supabase.

Este README es provisional; el definitivo se escribe al cerrar el proyecto. Criterios, arquitectura y plan están en [`docs/SPEC.md`](docs/SPEC.md) y las decisiones en [`DECISIONES.md`](DECISIONES.md).

## Comandos

- `npm ci`: instala las dependencias.
- `npm run dev`: servidor de desarrollo.
- `npm run check`: lint, tipos y tests. Es lo que corre el hook de commit.
- `npm run check:full`: lo anterior más cobertura, arquitectura y las puertas de calidad.
