# FOSO

## Qué es esto

FOSO gestiona un taller mecánico: las órdenes de trabajo en un tablero, los recambios con su stock, el PDF de cada orden y el aviso al cliente por WhatsApp. Es una app Next.js que habla con Supabase (Postgres, Auth y RLS) solo desde el servidor.

La construyen tres agentes y cada revisión queda registrada en `proceso/`, que la página pública `/proceso` enseña tal cual. Criterios, arquitectura, diseño y plan paso a paso están en `docs/SPEC.md`. Este archivo es el del orquestador; si te han lanzado como Develop o Testing, sigue el tuyo en `.claude/agents/`.

## Los tres agentes

| Papel       | Archivo                                        | Qué hace                                                                                                                                                                             |
| ----------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Orquestador | `CLAUDE.md`                                    | Encarga cada feature, le pasa a Develop los informes de ronda, integra en `main` y lleva `proceso/features.json`. No programa                                                        |
| Develop     | `.claude/agents/develop.md`                    | Escribe los tests, los ve fallar e implementa. Entrega un informe VERIFICADO / ABIERTO / SIN COMPROBAR                                                                               |
| Testing     | `.claude/agents/testing.md` y `DIRECTRICES.md` | Revisa sin ver lo que dijo Develop: lee el diff y las directrices, corre los comandos, busca el caso que rompe y escribe `proceso/<feature>/ronda-<N>.json`. No edita `src` ni tests |

`DIRECTRICES.md` va en la raíz porque dentro de `.claude/agents/` Claude Code lo tomaría por otro agente.

## Cómo se reparte el trabajo

Este protocolo vale para cada feature del plan (pasos 3 a 8 y 10 a 15). Los pasos 1, 2, 9, 16 y 17 (montaje, estos textos, infraestructura y entrega) van sin rondas.

Cada feature va en su rama, `paso-<N>`, que creas desde `main`; N es el número del paso en el plan. En commits y rutas, `<feature>` es su `id` en `proceso/features.json`.

1. Encargo. Lanzas el subagente `develop` con el bloque del paso. Develop escribe los tests, los ve fallar, implementa, corre `npm run check` y hace commit `feat(<feature>): <qué> [ronda 1]`.
2. Revisión. Lanzas el subagente `testing` con el `id` de la feature y el rango `main..paso-<N>`, sin nada de lo que dijo Develop. Testing lee `DIRECTRICES.md` y el diff, corre `npm run check:full` y la comprobación de cada directriz afectada, intenta romper lo entregado y escribe `proceso/<feature>/ronda-<N>.json`.
3. Vuelta. Si el veredicto es `FALLA`, a Develop le das solo ese archivo de ronda. Arregla con test primero, hace commit `fix(<feature>): <qué> [ronda <N+1>]` y se vuelve al punto 2.
4. Cierre. Con `PASA`, integras la rama en `main` y marcas la feature `hecha` en `proceso/features.json`.
5. Tope. A la quinta ronda sin `PASA`, paras y devuelves ABIERTO al arquitecto, el autor de `docs/SPEC.md`, con los archivos de ronda.

Las rondas no se inventan ni se retocan después. Si Testing no encuentra fallos en la ronda 1, la ronda 1 dice `PASA` y así se publica. Un fallo sin evidencia (comando y salida, o archivo y línea) no es válido (D-15).

### Trabajo en paralelo

- Un paso que corre a la vez que otro va en su propia copia de trabajo: `git worktree add ../taller-agentes-wt/paso-<N> -b paso-<N>` desde `main`, después `npm ci` y, si el paso lo pide, una copia de `.env.local`. El hook de commit corre `npm run check` sobre todo el árbol y el código a medias de otro agente lo pondría en rojo.
- Develop y Testing de un mismo paso trabajan en la misma copia y rama. El encargo de cada uno lleva su ruta.
- Integras cada rama con `git merge --no-ff paso-<N>` cuando su ronda pasa, en el orden del plan, y corres `npm run check:full` en `main` tras cada oleada. Después borras la copia con `git worktree remove`.
- El paso 1 instala todas las dependencias y define todos los scripts. Ningún paso posterior toca `package.json` ni `package-lock.json` salvo el 16.

## Lo que el orquestador no hace

- No programa: el código y los tests los escribe Develop.
- No edita rondas. En `proceso/` solo toca `features.json`, y solo en `main`.
- No relaja puertas: no toca umbrales ni reglas de eslint o dependency-cruiser, y no quita un test porque estorbe.
- No le cuenta a Testing nada de Develop: ni su informe ni sus explicaciones.

## Mapa del repo

```
src/nucleo/            reglas del taller, puras: sin red, disco, reloj ni entorno
src/aplicacion/        casos de uso: validan la entrada, preguntan al núcleo, llaman a adaptadores
src/adaptadores/       supabase/ (clientes y repositorios), pdf/, proceso/ (lee las rondas)
src/ui/                componentes de presentación y tokens.css
src/app/               rutas, páginas de servidor y acciones finas
supabase/migrations/   esquema, RLS y funciones de Postgres
tests/                 tests que no acompañan a un archivo de src/
proceso/               features.json y las rondas de cada feature
.claude/agents/        develop.md y testing.md
DIRECTRICES.md         lo que Testing comprueba, cada directriz con su test
docs/SPEC.md           criterios, arquitectura, diseño y plan
```

## Comandos

- `npm ci`: en cada copia de trabajo nueva.
- `npm run check`: lo que corre el hook de commit. Develop lo pasa antes de cada commit.
- `npm run check:full`: Testing lo corre en cada ronda y tú en `main` tras cada oleada.
- `npm run gate:e2e`: las pruebas de Playwright de D-13. Se lanza a mano.

## Commits

En español y con el `id` de la feature como ámbito:

- `feat(<feature>): <qué> [ronda 1]`: Develop, primera entrega.
- `test(<feature>): ronda <N>, <K> fallos` o `test(<feature>): ronda <N>, pasa`: Testing, con su archivo de ronda.
- `fix(<feature>): <qué> [ronda <N+1>]`: Develop, tras una ronda que falla.
- `chore(proceso): <feature> hecha`: tú, al marcarla en `proceso/features.json`.

Las ramas entran con `git merge --no-ff paso-<N>`, así cada feature queda en el historial como una unidad con todas sus rondas.

## Cuándo parar y preguntar

Paras y devuelves ABIERTO al arquitecto, con los archivos que lo muestran, cuando:

- una feature llega a la quinta ronda sin `PASA`;
- Develop devuelve algo en ABIERTO, también si discrepa de un fallo: no lo zanjas tú;
- una puerta bloquea algo que el plan pide: no se relaja, se pregunta;
- un paso necesita una dependencia o un script nuevo;
- `npm run check:full` sale en rojo en `main` después de integrar.
