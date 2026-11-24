# SPEC: FOSO — gestión de taller mecánico construida por tres agentes

<!-- Tamaño L. GATE 1 y GATE 2 fusionados en un solo OK de Vladys (ver Decisiones). -->

## Petición literal

Vladys, por orden:

- "esta prueba que, la hacemos? tenemos una base de otro proyecto no?"
- "vale y tu crees que nuestro proceso podria ser el ganador? que crees que podriamos hacer? algo estilo el panel que ya tenemos? porque todo el mundo usara lo mismo y no quiero que saque la misma app"
- (tras proponerle la app de talleres) "me parece bien, hazlo asi si"
- (cuentas) "usa mi supabase, no el del trabajo , mi github y y vecel"
- (diseño) "te pongo fable, para que tengamos el mejor proyecto, y un diseño muy bueno tambien, no quiero el panel generico que tenemos en otro proyecto"
- (ritmo) "quiero que lo desarrolles cuanto antes si hace falta abrir varios agentes abrelos"
- (gates) "vale, un solo OK a spec y plan"

Enunciado de la prueba (Speed Paradigm, Desarrollador/a Full Stack con IA):

> Con Claude Code o con Codex, crea un proyecto en Next.js que trabaje con 3 agentes:
> 1. Orquestador: el agente principal, con su CLAUDE.md (o AGENTS.md), que reparte el trabajo.
> 2. Develop: un subagente que programa, con su propio .md de cómo programar.
> 3. Testing: un subagente con un .md de DIRECTRICES que Develop tiene que cumplir. Testing revisa lo que hace Develop y le devuelve los fallos hasta que todo pasa.
>
> Con ese equipo de agentes, haz una app del tema que quieras (tema libre): con una base de datos gratuita: Firebase o Supabase; publicada gratis en Vercel (o similar).
> MUY IMPORTANTE: la dirección de la app tiene que ser PÚBLICA. [...] En Vercel, quita la protección en Settings › Deployment Protection (Vercel Authentication) y pásanos la dirección de producción, no la de una vista previa.
> No hace falta gastar dinero: usa planes gratuitos. No subas claves de API al repositorio. No hace falta vídeo.
> Al entregar nos pasas: el enlace de la app; el repositorio de GitHub (público o con acceso para nosotros), con los .md de los agentes; un usuario y una contraseña de prueba, si la app tiene login; las respuestas a 4 preguntas cortas.

## Objetivo

Entregar una app pública de gestión para talleres mecánicos (órdenes en tablero, recambios, presupuesto y factura, aviso por WhatsApp, roles y varios talleres aislados) construida de verdad por tres agentes versionados en el repo, de modo que el evaluador vea en diez minutos tanto la app como las rondas reales Develop ↔ Testing que la produjeron.

## Usuario y contexto

- **Quién lo evalúa**: el equipo técnico de Speed Paradigm. Unos diez minutos por candidato: abre la URL, entra con el usuario de prueba, mira el repo y los `.md` de los agentes.
- **Para quién es**: personal de Vladys (candidatura). Nada de otros proyectos ni de clientes: ni código, ni cuentas, ni nombres.
- **Usuario ficticio de la app**: el jefe de un taller pequeño y sus mecánicos, que la usan de pie y con el móvil.
- **Plazo**: cuanto antes, 1 o 2 sesiones, con agentes en paralelo.

## Fuera de alcance

- Código, esquema o estilos de otros proyectos.
- IA dentro de la app (ningún LLM, ninguna API de pago).
- Registro público de usuarios y alta de talleres: los usuarios son los de la demostración.
- Pantallas de mantenimiento de clientes y vehículos: se crean dentro de «Nueva orden» y se ven en la ficha de la orden.
- Arrastrar y soltar en el tablero: la orden avanza con un botón grande (sirve con guantes y en móvil, y no añade dependencias).
- Validez fiscal de la factura: el PDF lleva la leyenda «Documento de demostración sin validez fiscal».
- Envío real de WhatsApp: solo se abre `wa.me` con el mensaje escrito.
- Agenda de citas, informes, exportaciones, modo sin conexión, varios idiomas.
- **Orden de recorte si falta tiempo** (de lo primero que se cae a lo último): PDF de presupuesto y factura → botón «Restablecer la demo» de la pantalla de acceso (queda el restablecido diario) → alta de cliente nuevo dentro de «Nueva orden». Nunca se recortan: aislamiento entre talleres, tablero, `/proceso`, rondas reales.

## Criterios de aceptación

<!-- Cada criterio se demuestra con un test cuyo nombre lleva el ID. El estado lo escribe `npm run spec:check`.
     Todo criterio tiene al menos un test de vitest, porque `check:full` corre sin navegador.
     Los que solo se ven en un navegador real o contra producción llevan la marca de comprobación a mano. -->

| ID | Criterio | Cómo se demuestra |
|---|---|---|
| C-1 | Sin sesión, cualquier ruta privada (`/tablero`, `/ordenes/*`, `/recambios`) lleva a `/login`; con sesión, `/login` lleva a `/tablero`. `/` y `/proceso` son públicas | unit `src/aplicacion/acceso.test.ts` con `[C-1]` |
| C-2 | Un usuario del taller A no lee, inserta, modifica ni borra filas del taller B en `talleres`, `miembros`, `clientes`, `vehiculos`, `recambios`, `ordenes` ni `orden_lineas`; el rol `anon` no lee ninguna | integración `tests/bd/aislamiento.test.ts` con `[C-2]` (Postgres en proceso) |
| C-3 | El mecánico no puede entregar una orden, ni crear, modificar o borrar recambios, ni borrar órdenes; el jefe sí. La regla vale en la base de datos y en la interfaz | integración `tests/bd/roles.test.ts` + unit `src/nucleo/permisos.test.ts` con `[C-3]` |
| C-4 | Una orden solo se mueve recibido → en reparación → listo → entregado, puede retroceder un paso mientras no esté entregada, y una orden entregada no cambia más | property `src/nucleo/orden.test.ts` + integración `tests/bd/transiciones.test.ts` con `[C-4]` |
| C-5 | Al entregar una orden se descuenta del stock la cantidad de cada línea en una sola transacción; si falta stock de un recambio no cambia nada y el error nombra la referencia | integración `tests/bd/cerrar-orden.test.ts` + property `src/nucleo/stock.test.ts` con `[C-5]` |
| C-6 | Un recambio con stock menor o igual que su mínimo sale marcado «Bajo mínimo» en `/recambios` y suma en el aviso del tablero del jefe | unit `src/nucleo/stock.test.ts` + componente `src/ui/recambios/ListaRecambios.test.tsx` con `[C-6]` |
| C-7 | Los importes se calculan en céntimos enteros: recambios + mano de obra = base; IVA 21 % redondeado al céntimo; total = base + IVA | property `src/nucleo/importe.test.ts` con `[C-7]` |
| C-8 | El PDF de una orden no entregada se titula «Presupuesto»; el de una entregada, «Factura» con número correlativo por taller `F-AAAA-NNNN`. Lleva matrícula, líneas, totales y la leyenda de demostración | unit `src/nucleo/documento.test.ts` + `src/adaptadores/pdf/generar.test.ts` + integración `tests/bd/cerrar-orden.test.ts` con `[C-8]` |
| C-9 | «Avisar por WhatsApp» abre `https://wa.me/<teléfono>?text=<mensaje>` con el teléfono normalizado a prefijo 34, la matrícula y un texto según el estado; con teléfono no válido el botón queda desactivado y dice por qué | unit `src/nucleo/whatsapp.test.ts` + componente `src/ui/ordenes/AccionesOrden.test.tsx` con `[C-9]` |
| C-10 | El tablero muestra las órdenes del taller en cuatro columnas en orden, cada tarjeta con matrícula, vehículo, cliente y el botón de avanzar; una columna sin órdenes muestra su estado vacío | componente `src/ui/tablero/Tablero.test.tsx` con `[C-10]` |
| C-11 | «Nueva orden» crea la orden con un vehículo y cliente existentes o nuevos; matrícula, teléfono y descripción se validan y cada error se explica en español junto a su campo | unit `src/aplicacion/nueva-orden.test.ts` + `src/nucleo/matricula.test.ts` con `[C-11]` |
| C-12 | `/proceso` es pública y enseña, por cada feature, sus rondas con veredicto, número de fallos, directriz incumplida, archivo, evidencia y commit, leídos de `proceso/**/ronda-*.json`; un archivo de ronda mal formado rompe el build | unit `src/adaptadores/proceso/leer-rondas.test.ts` + componente `src/ui/proceso/LineaDeRondas.test.tsx` con `[C-12]` |
| C-13 | `restablecer_demo()` deja los dos talleres de demostración con los datos de partida y no se puede repetir en 10 minutos; la ruta del cron responde 401 sin `Authorization: Bearer <CRON_SECRET>` | integración `tests/bd/restablecer-demo.test.ts` + unit `src/app/api/cron/restablecer/route.test.ts` con `[C-13]` |
| C-14 | Ningún color literal ni clase de la paleta por defecto de Tailwind fuera de `src/ui/tokens.css`; cada par texto/fondo declarado en `src/ui/pares-contraste.ts` cumple AA (4,5:1) | unit `tests/diseno/tokens.test.ts` con `[C-14]` |
| C-15 | Cada segmento de ruta privada tiene `loading.tsx` y `error.tsx`, y cada lista (tablero, recambios, líneas de una orden, rondas) tiene estado vacío con texto propio | unit `tests/diseno/estados.test.ts` + tests de componente con `[C-15]` |
| C-16 | A 390 px de ancho `/login`, `/tablero`, `/ordenes/[id]`, `/recambios` y `/proceso` no tienen desplazamiento horizontal, todo botón de acción mide al menos 48 px de alto y axe no encuentra faltas graves ni críticas | manual: lo comprueba `npm run gate:e2e` con `[C-16]` en `tests/e2e/movil.spec.ts` (gate completo) |
| C-17 | La interfaz no usa como tipografía de titulares ninguna de la lista vetada, no tiene antetítulos numerados, titulares por contraste («No es X. Es Y.»), emojis como iconos, texto de menos de 14 px ni texto de relleno | unit `tests/diseno/anti-generico.test.ts` con `[C-17]` |
| C-18 | La clave secreta de Supabase solo se importa desde módulos con `server-only`; no existe ninguna variable `NEXT_PUBLIC_*`; las respuestas llevan `Content-Security-Policy` con `frame-ancestors 'none'`, `X-Content-Type-Options` y `Referrer-Policy` | unit `tests/seguridad/claves.test.ts` + `tests/seguridad/cabeceras.test.ts` con `[C-18]` |

## Criterios de proceso

| ID | Criterio | Cómo se demuestra |
|---|---|---|
| P-1 | Puertas instaladas y `check:full` en verde | unit `tests/proceso/puertas.test.ts` con `[P-1]` + `npm run check:full` |
| P-2 | Los tres agentes viven en el repo: `CLAUDE.md` (orquestador, nombra a `develop` y `testing` y describe cómo reparte), `.claude/agents/develop.md` (cómo se programa, remite a `DIRECTRICES.md`), `.claude/agents/testing.md` + `DIRECTRICES.md`. No dependen de nada de fuera del repo | unit `tests/proceso/agentes.test.ts` con `[P-2]` |
| P-3 | Cada directriz `D-n` de `DIRECTRICES.md` tiene al menos un test con su ID en verde | `npm run spec:check` sobre `DIRECTRICES.md` + unit `tests/proceso/directrices.test.ts` con `[P-3]` |
| P-4 | Toda feature marcada `hecha` en `proceso/features.json` tiene rondas numeradas desde 1 sin huecos y la última con veredicto `PASA`; toda ronda `FALLA` lleva al menos un fallo con evidencia o un comando en rojo con su resumen | unit `tests/proceso/rondas.test.ts` con `[P-4]` |
| P-5 | El historial no contiene secretos ni nombres de clientes o de otros proyectos | manual: `gitleaks git` sin hallazgos (también puerta `secretos` del gate) y búsqueda de términos con la lista que guarda Vladys fuera del repo, antes de hacerlo público |
| P-6 | El `README.md` se lee en tres minutos y contiene: enlace de la app, usuarios de prueba (jefe y mecánico) con su contraseña, cómo trabajan los tres agentes, dónde están las rondas, cómo arrancar en local y la sección «Las cuatro preguntas» | unit `tests/proceso/readme.test.ts` con `[P-6]` |
| P-7 | La dirección de producción responde sin pedir cuenta de Vercel, el jefe y el mecánico de demostración entran con la contraseña publicada, el mecánico no ve «Entregar» y el jefe del otro taller no ve las matrículas del primero | manual: `npm run smoke` contra producción (`tests/e2e/smoke.spec.ts`, tests `[P-7]`) |
| P-8 | Todas las features están `hecha` en `proceso/features.json` antes de entregar | manual: `node scripts/entrega-check.mjs` |
| P-9 | El proyecto es Next.js con App Router y lleva la estructura de agentes de Claude Code (`CLAUDE.md` y `.claude/agents/`) | unit `tests/proceso/enunciado.test.ts` con `[P-9]` |
| P-10 | Cero euros: organización de Supabase en plan Free, cuenta de Vercel en Hobby, repo público (Actions sin coste), ningún servicio de pago | manual: paso 9 (plan de Supabase antes de crear) y `npm run checklist` (apartado de coste) |
| P-11 | El repo de GitHub es público y los cuatro `.md` de los agentes se leen sin iniciar sesión | manual: `npm run checklist` (visibilidad con `gh repo view` y lectura anónima de los cuatro archivos) |

## Cumplimiento del enunciado

Cada requisito literal de la prueba, con el criterio que lo cubre y cómo se comprueba. El paso 17 (`npm run checklist`) recorre esta tabla contra producción.

| Requisito del enunciado | Criterio | Comprobación |
|---|---|---|
| Proyecto en Next.js | P-9 | automática: test `[P-9]` (dependencia `next`, carpeta `src/app`) |
| Hecho con Claude Code | P-9, P-2 | automática: test `[P-9]` (estructura `.claude/agents`); a mano en el checklist: los commits llevan `Co-Authored-By: Claude` |
| Orquestador con `CLAUDE.md` que reparte el trabajo | P-2 | automática: test `[P-2]` (existe, nombra a los dos subagentes y contiene el protocolo de ronda) |
| Subagente Develop con su propio `.md` de cómo programar | P-2 | automática: test `[P-2]` (frontmatter de agente válido y secciones de cómo se programa) |
| Subagente Testing con `.md` de DIRECTRICES que Develop debe cumplir | P-2, P-3 | automática: test `[P-2]` (`develop.md` remite a `DIRECTRICES.md`) y `spec:check` (cada directriz con test en verde) |
| Testing revisa y devuelve los fallos hasta que todo pasa | P-4, P-8, C-12 | automática: test `[P-4]` (rondas sin huecos, última `PASA`, fallos con evidencia o comando en rojo); a mano: `entrega-check` (todas las features hechas); visible en `/proceso` y en los commits `test(...)`/`fix(...)` |
| Base de datos gratuita: Supabase | P-10, C-2 | a mano: plan Free confirmado antes de crear el proyecto (paso 9) y en el checklist |
| Publicada gratis en Vercel | P-10, P-7 | a mano: checklist (cuenta Hobby, proyecto en la cuenta personal) |
| Dirección de producción pública, sin protección de Vercel | P-7 | a mano contra producción: smoke y petición sin sesión que no redirige a `vercel.com` ni devuelve 401 |
| Sin gastar dinero | P-10 | a mano: checklist (facturación de Supabase y Vercel en 0, ninguna API de pago en dependencias ni variables) |
| Ninguna clave de API en el repo | P-5, C-18 | automática: gitleaks en cada commit y puerta `secretos` del gate, tests `[C-18]`; a mano: `gitleaks git` sobre todo el historial antes de hacerlo público |
| Repo de GitHub accesible, con los `.md` de los agentes | P-11 | a mano: checklist (repo público y los cuatro archivos legibles sin sesión) |
| Usuario y contraseña de prueba | P-7, P-6 | a mano contra producción: smoke entra como jefe y como mecánico; automática: test `[P-6]` (el README los trae) |
| Respuestas a 4 preguntas cortas | P-6 | automática: test `[P-6]` (sección «Las cuatro preguntas» en el README y borrador en `docs/ENTREGA.md`); se rellenan al conocerlas |
| No hace falta vídeo | — | no se hace |

## Tipo y puertas

- **tipo**: web.
- **supabase**: sí. `gate:rls` corre los tests de `tests/bd` (Postgres en proceso con PGlite, sin Docker).
- **Rutas N3 (mutación, break 80)**: `src/nucleo/**/*.ts`. Las políticas y funciones SQL no admiten mutación: se cubren con `tests/bd`.
- **Omisiones del gate** (van a `calidad.json.omitir`):
  - `dast`: app de demostración sin datos reales ni formularios públicos más allá del acceso; el riesgo real es el aislamiento entre talleres y lo cubren C-2, C-3 y las cabeceras de C-18.
  - `lighthouse`: sin imágenes ni terceros; el presupuesto de peso no aporta en una app tras login.
  - `enlaces`: los únicos enlaces externos son `wa.me` y el repo; el smoke los cubre.
  - `carga`: uso esperado de un evaluador a la vez; el límite es el plan gratuito, descrito en Escalado.
- Se mantienen: `tipos`, `rls`, `mutacion`, `e2e`, `a11y`, `cabeceras`.

## Arquitectura

```
navegador
   │  (solo HTML y acciones de servidor; el navegador nunca habla con Supabase)
   ▼
src/app/**            rutas, páginas de servidor y acciones finas
   │
   ├──► src/ui/**            componentes de presentación + tokens (sin datos, sin Supabase)
   │
   ▼
src/aplicacion/**     casos de uso: validan la entrada, piden al núcleo que decida, llaman a adaptadores
   │                     │
   ▼                     ▼
src/nucleo/**         src/adaptadores/**     supabase (repositorios), pdf, proceso (lee rondas del disco)
(puro, sin IO)                │
                              ▼
                     Supabase: Postgres + Auth + RLS      proceso/**/ronda-*.json
                     supabase/migrations/*.sql
```

- **Núcleo** (`src/nucleo`): lógica pura, sin IO, sin reloj ni variables de entorno. Property-based en cálculos. Es lo que se muta.
- **Aplicación** (`src/aplicacion`): un archivo por caso de uso. Valida con zod lo que llega del formulario. Recibe los adaptadores como parámetro («puerto») para poder probarse sin base de datos.
- **Adaptadores** (`src/adaptadores`): `supabase/` (cliente de servidor con cookies, cliente secreto, repositorios que validan con zod cada fila), `pdf/`, `proceso/`.
- **UI** (`src/ui`): componentes sin acceso a datos. Reciben props ya resueltas.
- **Base de datos** (`supabase/migrations`): el aislamiento y los roles se deciden en Postgres (RLS y funciones). El servidor siempre actúa con la sesión del usuario; la clave secreta solo se usa para restablecer la demo.
- **Dependencias prohibidas** (reglas de `.dependency-cruiser.cjs`):
  - `src/nucleo` → cualquier otra carpeta de `src`, cualquier paquete de `node_modules` o `node:*`;
  - `src/ui` → `src/adaptadores`, `src/aplicacion`, `@supabase/*`;
  - `src/aplicacion` → `src/app`, `src/ui`;
  - `src/adaptadores` → `src/app`, `src/ui`, `src/aplicacion`;
  - cualquiera fuera de `src/adaptadores/supabase` → `@supabase/*`;
  - ciclos.
- **Próxima feature probable**: agenda de citas → una tabla con su política, un archivo en `nucleo`, uno en `aplicacion`, un repositorio y una ruta: 5 archivos nuevos, ninguno existente cambia salvo la navegación.

### Modelo de datos

```
talleres(id, nombre, nif, direccion, telefono, siguiente_factura)
miembros(usuario_id → auth.users, taller_id → talleres, rol: jefe|mecanico, nombre)      un taller por usuario
clientes(id, taller_id, nombre, telefono)
vehiculos(id, taller_id, cliente_id → clientes, matricula, marca, modelo)                 matrícula única por taller
recambios(id, taller_id, referencia, nombre, precio_centimos, stock, stock_minimo)        referencia única por taller
ordenes(id, taller_id, vehiculo_id → vehiculos, estado, descripcion, mano_obra_minutos,
        precio_hora_centimos, numero_factura, creada_en, entregada_en)
orden_lineas(id, taller_id, orden_id → ordenes, recambio_id → recambios, cantidad, precio_unitario_centimos)
demo_control(id, ultimo_restablecido)                                                     sin políticas: nadie la lee por API
```

## Diseño

El diseño es criterio de aceptación (C-14 a C-17), no un acabado. Ninguna pantalla puede parecer un panel de administración de plantilla: nada de barra lateral gris, tarjetas con sombra y esquinas de 8 px, ni tabla por defecto.

### Conceptos considerados

| Concepto | Idea | A favor | En contra |
|---|---|---|---|
| **FOSO** (elegido) | El taller de noche visto desde el foso: negro de aceite, la luz naranja de la lámpara portátil, acero y pintura de seguridad. Cada orden es una matrícula | Oscuro, de mucho contraste y letra grande: se lee de pie y con el móvil; la matrícula es un objeto real que nadie más va a usar como pieza central | Un tema oscuro mal medido cansa: obliga a comprobar el contraste par a par (C-14) |
| CUADRO | El cuadro de instrumentos: agujas, testigos y relojes para stock y carga de trabajo | Muy reconocible | Decorativo: un reloj ocupa sitio y no dice más que un número; envejece como truco |
| PARTE | La hoja de trabajo de papel con copia de calco: fondo claro, tinta, sellos | Fiel al taller de siempre | Es el estilo claro tipo papel que Vladys ya descartó como estilo de casa; discreto para algo que se mira diez minutos |

`[asumido]` Se construye FOSO. Vladys lo confirma o lo cambia en el gate de diseño viendo el tablero real.

### Concepto FOSO

- **Lo que se recuerda**: cada orden es su matrícula, dibujada como una placa española (fondo claro, banda azul a la izquierda, caracteres en monoespaciada grande). Se reconoce un coche a tres metros del móvil.
- **Tokens** (únicos valores de color del proyecto; viven en `src/ui/tokens.css`):

  | Token | Valor | Uso |
  |---|---|---|
  | `--foso` | `#0B0C0E` | fondo |
  | `--chapa` | `#131518` | superficie de tarjetas y columnas |
  | `--chapa-alta` | `#1C1F24` | superficie elevada, campos |
  | `--hueso` | `#F2EFE8` | texto principal |
  | `--acero` | `#9AA1AA` | texto secundario |
  | `--lampara` | `#FF6A1A` | acento y acción principal (texto encima en `--foso`) |
  | `--ambar` | `#FFB020` | aviso: en reparación, bajo mínimo |
  | `--testigo` | `#3DDC84` | listo, ronda que pasa |
  | `--averia` | `#FF5A5A` | error, ronda que falla |
  | `--raya` | `rgba(242, 239, 232, 0.12)` | líneas finas de separación |
  | `--placa` / `--placa-texto` / `--placa-banda` | `#F4F4F0` / `#111214` / `#0B3FA8` | la matrícula |

  Si un par no llega a AA en el test de C-14, se ajusta la luminosidad del token y se anota en Decisiones; no se relaja el test.
- **Tipografía** (con `next/font/google`, servida desde el propio dominio): titulares en **Big Shoulders** (pesos 700 a 900, mayúsculas, la de la rotulación industrial); texto en **Schibsted Grotesk**; datos (matrículas, referencias, importes, commits) en **Martian Mono**. Texto base 18 px; mínimo absoluto 14 px.
- **Espaciado y forma**: escala de 4 px (`--e1` 4 px … `--e8` 64 px); esquinas de 2 px (4 px en la matrícula); `--toque: 3.5rem` como alto mínimo de todo botón de acción; sin sombras, separación con `--raya`.
- **Atmósfera** (solo CSS): sobre `--foso`, una rejilla de suelo muy tenue cada 64 px y grano fino; una franja de rayas de seguridad naranja y negra de 6 px corona el tablero. Con `prefers-reduced-motion: reduce` no se mueve nada.
- **Movimiento**: las tarjetas entran escalonadas (40 ms) al cargar; al avanzar una orden, la tarjeta se desplaza a su nueva columna. Nada más.
- **Pantallas** (seis, ninguna más):
  1. `/login`: nombre FOSO enorme, acceso con correo y contraseña, y dos botones «Entrar como jefe» y «Entrar como mecánico» para el evaluador.
  2. `/tablero`: la pieza central. En escritorio, cuatro columnas a todo el alto; en móvil, un selector fijo de las cuatro columnas con su recuento y la columna activa a pantalla completa, con el botón de avanzar de 56 px en cada tarjeta.
  3. `/ordenes/nueva`: un solo formulario de arriba abajo; la matrícula se dibuja como placa mientras se escribe.
  4. `/ordenes/[id]`: la placa arriba, estado, líneas de recambios, mano de obra, totales, y tres acciones: avisar por WhatsApp, descargar PDF, entregar.
  5. `/recambios`: lista con el stock como dato grande; los que están bajo mínimo, arriba y en ámbar.
  6. `/proceso`: pública, mismo nivel visual. Cabecera con los tres agentes y enlace a su `.md`; debajo, una fila por feature con sus rondas como pasos por el foso: cada ronda es una pieza roja con el número de fallos o verde si pasa; al abrirla, los fallos con directriz, archivo, evidencia en monoespaciada y commit. Las cifras que salen son las reales de los archivos.
- **Vetado** (lo comprueba C-17): Inter, Roboto, Arial, system-ui, Space Grotesk o Poppins en titulares; antetítulos numerados; titulares «No es X. Es Y.»; emojis como iconos (iconos SVG propios en línea); cifras de adorno; texto de relleno; textos en inglés.

### Gate de diseño

El paso 3 construye el tablero con el sistema visual completo y datos de muestra → capturas a 1440×900 y 390×844 → la sesión principal lo puntúa con la rúbrica de impacto de la casa (mínimo 13 de 16 y ningún criterio a 0, tomando el tablero como pieza principal) y pasa el detector de web genérica sobre `src/` → **OK de Vladys**. Bloquea solo los pasos con pantallas (12 a 15). No bloquea núcleo, base de datos, acceso, casos de uso ni PDF (pasos 4 a 11), que avanzan mientras tanto.

## Los tres agentes del repo

| Papel del enunciado | Archivo | Qué contiene |
|---|---|---|
| Orquestador | `CLAUDE.md` | Qué es el proyecto, mapa de carpetas, el protocolo de ronda, a quién se le encarga qué, formato de los commits, cuándo parar y preguntar. No programa |
| Develop | `.claude/agents/develop.md` | Cómo se programa aquí: test antes que código, capas y qué puede importar cada una, validación en los bordes, dinero en céntimos, tokens de diseño, comandos, formato del informe (VERIFICADO / ABIERTO / SIN COMPROBAR) |
| Testing | `.claude/agents/testing.md` + `DIRECTRICES.md` | Cómo revisa: no ve la conversación de Develop, lee el diff y las directrices, ejecuta los comandos, busca el caso que rompe, escribe `proceso/<feature>/ronda-N.json`. No edita código de `src` ni tests |

`DIRECTRICES.md` va en la raíz (dentro de `.claude/agents/` Claude Code lo tomaría por otro agente). Cada directriz tiene un test con su ID: no hay directriz que sea solo texto (P-3).

### Protocolo de ronda

Lo sigue el orquestador para cada feature (pasos 3 a 8 y 10 a 15):

1. **Encargo**: el orquestador lanza a Develop con el bloque del paso. Develop escribe los tests, los ve fallar, implementa, corre `npm run check` y hace commit `feat(<feature>): <qué> [ronda 1]`.
2. **Revisión**: el orquestador lanza a Testing con el identificador de la feature y el rango de commits, sin nada de lo que dijo Develop. Testing lee `DIRECTRICES.md`, lee el diff, corre `npm run check:full` y la comprobación de cada directriz afectada, intenta romper lo entregado y escribe `proceso/<feature>/ronda-<N>.json`. Commit `test(<feature>): ronda <N>, <K> fallos` o `test(<feature>): ronda <N>, pasa`.
3. **Vuelta**: si el veredicto es `FALLA`, el orquestador entrega a Develop solo ese archivo de ronda. Develop arregla con test primero y hace commit `fix(<feature>): <qué> [ronda <N+1>]`. Se vuelve al punto 2.
4. **Cierre**: con veredicto `PASA`, el orquestador integra la rama en `main` y marca la feature `hecha` en `proceso/features.json` (commit `chore(proceso): <feature> hecha`).
5. **Tope**: a la quinta ronda sin `PASA` el orquestador para y devuelve ABIERTO al arquitecto con los archivos de ronda.

Reglas de honestidad: las rondas no se inventan ni se retocan después. Si Testing no encuentra fallos en la ronda 1, la ronda 1 dice `PASA` y así se publica. Un fallo sin evidencia (comando y salida, o archivo y línea) no es un fallo válido (D-15).

### Trabajo en paralelo

- Cada paso que corre a la vez que otro lo hace en **su propia copia de trabajo de git** (`git worktree add ../taller-agentes-wt/paso-<N> -b paso-<N>` desde `main`, seguido de `npm ci` y, si el paso lo pide, copia de `.env.local`). Motivo: el hook de commit corre `npm run check` sobre todo el árbol, y el código a medias de otro agente lo pondría en rojo.
- Develop y Testing de un mismo paso trabajan en la misma copia y rama. Testing revisa `main..paso-<N>`.
- El orquestador integra cada rama con `git merge --no-ff paso-<N>` cuando su ronda pasa, en el orden de la tabla, y corre `npm run check:full` en `main` tras cada oleada. Después borra la copia (`git worktree remove`).
- Para que las ramas no choquen: el paso 1 instala **todas** las dependencias y define **todos** los scripts; ningún paso posterior toca `package.json` ni `package-lock.json` salvo el 16. `proceso/features.json` solo lo edita el orquestador en `main`.

### Cómo encaja con el flujo de la casa

- La sesión que construye se abre **dentro de** `<raiz-del-repo>`, para que el `CLAUDE.md` del repo sea el del orquestador y `develop` y `testing` aparezcan como tipos de agente. Se lanzan con `model` explícito (columna Modelo del plan).
- Si esos tipos de agente no están disponibles en la sesión, se lanza `ejecutor-sonnet` con la primera línea «Lee `.claude/agents/develop.md` (o `testing.md`) y trabaja exactamente como dice» y el mismo encargo. El resultado es equivalente y se anota en Decisiones.
- Los pasos 1, 2, 9, 16 y 17 (montaje, textos de los agentes, infraestructura y entrega) los hace `ejecutor-sonnet` con el contrato de ejecutor de la casa, sin rondas.
- Antes del GATE 3 pasa el `revisor-adversarial` de la casa. Sus hallazgos bloqueantes entran como una ronda más de la feature afectada, con `"origen": "revision-final"`.

## Amenazas

| Activo | Quién/qué lo ataca | Impacto | Mitigación | Prueba (ID) |
|---|---|---|---|---|
| Datos de un taller | Usuario autenticado de otro taller que llama a la API de Supabase directamente con su sesión | Lee o cambia clientes y órdenes ajenas | RLS en todas las tablas con `taller_id = app.mi_taller()`; el servidor nunca usa la clave secreta para datos de negocio | C-2 |
| Reglas de rol | Mecánico que salta la interfaz y llama a la API | Entrega órdenes, cambia stock o precios | El rol se decide en políticas y en `cerrar_orden()`; la interfaz solo oculta | C-3 |
| Tablas de negocio | Cualquiera con la clave publicable (es pública por diseño) | Lectura anónima | `anon` sin permisos sobre ninguna tabla | C-2 |
| Clave secreta de Supabase | Fuga por el repo público o por el paquete del navegador | Control total de la base de datos | Solo en variables de Vercel; módulo `server-only`; cero variables `NEXT_PUBLIC_*`; gitleaks en cada commit y en el gate | C-18, P-5 |
| Usuarios de demostración (contraseña pública) | Un visitante cambia la contraseña o destroza los datos | El evaluador no puede entrar o ve basura | `restablecer_demo()` diario por cron y enlace en `/login` con espera de 10 minutos; repone datos y contraseñas | C-13 |
| Ruta del cron | Bot que la llama en bucle | Restablecidos continuos | Exige `Bearer CRON_SECRET`; la función se niega si hubo otro en 10 minutos | C-13 |
| Alta de usuarios | Bots registrándose | Usuarios basura y correo saliente | Registro desactivado en Supabase Auth; no hay formulario de alta | verificación del paso 9 |
| Stock y numeración de facturas | Dos entregas a la vez | Stock negativo o número repetido | `cerrar_orden()` bloquea la fila y descuenta con `where stock >= cantidad` en una transacción | C-5, C-8 |
| Interfaz | XSS con datos escritos por un usuario (descripción, nombre) | Robo de sesión | Escape por defecto de React; la inyección de HTML sin escapar está prohibida por lint (`react/no-danger`); sesión en cookie `httpOnly`; CSP | C-18, D-8 |
| Next.js | Fallos publicados (siete avisos el 3-nov-2026; salto de middleware en 2025) | Salto de autenticación o caída | Versión fijada ≥ 16.4.6; la autorización no depende del proxy sino de RLS; sin optimización de imágenes ni Cache Components; osv-scanner y Dependabot | puerta `dependencias` |
| Dinero | No hay: ninguna API de pago ni endpoint que gaste | — | — | P-10 |

Datos personales: ninguno real. Clientes, teléfonos y matrículas son inventados y el README lo dice.

## Escalado

- **Carga hoy**: un evaluador, quizá tres a la vez. Decenas de filas.
- **Límite estimado**: plan gratuito de Supabase (500 MB, pausa si no hay actividad en una semana) y Vercel Hobby.
- **Qué rompe primero**: la pausa por inactividad de Supabase. La evita el cron diario de restablecido, que hace una consulta real.
- **Plan a 10x / coste**: cientos de talleres caben en el plan gratuito por volumen; lo primero que habría que pagar es Supabase Pro (25 $/mes) para quitar la pausa y tener copias. No se hace en esta prueba.
- **Prueba de carga (k6)**: no aplica: demostración de un usuario a la vez (omitida en `calidad.json`).

## Stack

Next.js, Supabase o Firebase y Vercel los fija el enunciado; lo que se decide es cómo usarlos. Versiones consultadas en npm el 2026-11-23.

- **Next.js 16.4.6 (App Router, React 19.3) + TypeScript 6.0**: lo exige la prueba. Todo el acceso a datos va en el servidor (páginas de servidor y acciones), así el navegador no necesita ninguna clave. Alternativa evaluada: componentes de cliente hablando con Supabase desde el navegador (lo que hace casi todo el mundo); se descarta porque expone la clave publicable y duplica comprobaciones. Historial: 2026 ha traído avisos de seguridad casi mensuales (3-nov: siete fallos, corregidos en 16.4.5); se fija ≥ 16.4.6 y no se usan las piezas afectadas. TypeScript 6.0 y no 7.0: `typescript-eslint` 8.74 solo admite hasta 6.0.
- **Supabase (Postgres 17 + Auth) y no Firebase**: los datos son relacionales (orden → líneas → recambios) y entregar una orden necesita una transacción; con RLS el aislamiento entre talleres se escribe una vez en la base de datos y se prueba con SQL. Qué lo haría cambiar: necesitar tiempo real sin conexión en el móvil.
- **`@supabase/ssr` 0.12 + `@supabase/supabase-js` 2.119, sin ORM**: la sesión viaja en cookie `httpOnly` y cada consulta sale con el usuario, así que RLS decide. Alternativa evaluada: Drizzle con conexión directa; se descarta porque conecta como propietario y se salta RLS.
- **Tailwind 4.3 con la paleta por defecto apagada** (`--color-*: initial` y solo los tokens de FOSO). Sin librería de componentes: alternativa evaluada, shadcn/ui; se descarta porque es exactamente el aspecto de panel genérico que se quiere evitar.
- **zod 4.6**: valida formularios, filas que vuelven de la base de datos y archivos de ronda.
- **pdf-lib 1.17 para el PDF**: JavaScript puro, sin binarios ni fuentes externas. Sin versiones nuevas desde 2022 pero sin avisos abiertos; alternativa: `@react-pdf/renderer` (mantenida, pero arrastra muchas más dependencias).
- **Tests**: vitest 4.1.11 (fijada: con vitest 5, Stryker da un resultado falso), fast-check, Testing Library con jsdom, Playwright 1.65 con axe, **PGlite 0.6** (Postgres en WebAssembly) para probar políticas y funciones SQL dentro de vitest sin Docker. Alternativa: `supabase start` con Docker y pgTAP; se usa solo en el gate completo del CI para el E2E.
- **Puertas**: las de la casa copiadas en `scripts/puertas` + eslint con sonarjs, dependency-cruiser, knip, jscpd, Stryker 10.1 sobre `src/nucleo`, gitleaks, semgrep y osv-scanner en GitHub Actions.
- **Vercel Hobby**: lo pide la prueba. Un cron diario (el plan gratuito permite uno al día).
- **Cadena de suministro**: 8 dependencias de ejecución (`next`, `react`, `react-dom`, `@supabase/ssr`, `@supabase/supabase-js`, `zod`, `pdf-lib`, `server-only`); sin librería de componentes, de iconos, de fechas ni de animación.
- **Defaults inseguros que se evitan a propósito**: RLS apagado, clave en el cliente, confiar en el proxy para autorizar, clave secreta para consultas normales, registro abierto.
- **Coste**: 0 €. Cuentas personales verificadas: GitHub `donpapaya14` (repo público: Actions sin coste), Vercel `donpapaya14` / equipo `donpapaya14s-projects` en Hobby (alias `vvlad`), Supabase `donpapaya14's Org` (`<id-organizacion>`; un proyecto en pausa, cabe otro en Free). El plan de la organización se confirma antes de crear el proyecto (paso 9).

## Despliegue

- **Entornos**: un solo proyecto de Supabase en la nube (`taller-agentes`), que es a la vez la demostración pública y la base contra la que se desarrolla; no contiene datos reales y se restablece. El E2E del gate completo corre contra un Supabase local levantado en el runner de GitHub.
- **despliegue**: Actions → Gate → Run workflow con «desplegar» marcado, desde `main`. El job `desplegar` ejecuta `npm run desplegar` (`vercel pull` + `vercel build --prod` + `vercel deploy --prebuilt --prod` con el token de la cuenta personal). Las migraciones se aplican antes con `supabase db push` desde local.
- **smoke**: `URL_BASE=https://<producción> npm run smoke`.
- **rollback**: `vercel rollback --token=$VERCEL_TOKEN_VLADYS` al despliegue anterior. Base de datos: `restablecer_demo()`.
- **GATE 3 en dos tiempos**: (a) OK de Vladys a publicar (repo público y despliegue a producción); (b) con producción arriba, `npm run checklist` recorre la tabla «Cumplimiento del enunciado» y Vladys da el OK a enviar la candidatura con ese informe delante.

## Supuestos

- `[asumido]` Concepto visual FOSO y nombre de la app «FOSO»; el repo se queda como `taller-agentes`.
- `[asumido]` Autor de los commits: `Vladyslav Zinkevych <172605387+donpapaya14@users.noreply.github.com>` (ya configurado en local en el repo): no publica el correo personal y GitHub y Vercel reconocen al autor.
- `[asumido]` El repo se sube primero como **privado** para que corra el gate y se hace público en el GATE 3, tras P-5.
- `[asumido]` Un usuario pertenece a un solo taller. IVA único del 21 %. Precio por hora de mano de obra por orden (45,00 € por defecto).
- `[asumido]` Talleres de demostración ficticios: «Talleres Vega» (jefe y mecánico) y «Mecánica Ribera» (jefe), con correos `@tallerdemo.example` / `@otrotaller.example` y una contraseña común publicada en el README.
- `[asumido]` Región de Supabase `eu-west-1`.
- `[asumido]` Las «4 preguntas cortas» se contestan al entregar; el README reserva la sección y `docs/ENTREGA.md` el borrador.

## Plan

### Objetivo del plan

Pasar de repo vacío a app pública con las rondas reales Develop ↔ Testing registradas, en el menor tiempo posible, con hasta seis agentes a la vez.

### Fuera de alcance del plan

Lo de la sección «Fuera de alcance». Ningún paso instala nada fuera del repo. Ningún paso antes del 17 hace público el repo ni despliega.

### Orden y paralelismo

| Paso | Qué | Oleada | Depende de | En paralelo con | Ejecutor | Modelo |
|---|---|---|---|---|---|---|
| 1 | Esqueleto Next, puertas, todas las dependencias y scripts | 1 | — | 2 | ejecutor-sonnet | sonnet |
| 2 | Los tres agentes y las directrices (`.md`) | 1 | — | 1 | ejecutor-sonnet | opus — son los textos que el evaluador lee palabra por palabra; su calidad no se puede dictar entera desde el plan |
| 3 | Sistema visual FOSO y tablero de muestra → gate de diseño | 2 | 1, 2 | 4, 5, 6, 8 | develop + testing | opus — diseño fino dentro del paso (composición, ritmo, ajuste de contraste) |
| 4 | Proceso: formato de ronda, lectura y tests de proceso | 2 | 1, 2 | 3, 5, 6, 8 | develop + testing | sonnet |
| 5 | Núcleo puro del taller | 2 | 1, 2 | 3, 4, 6, 8 | develop + testing | sonnet |
| 6b | Ronda siguiente de base de datos: referencias compuestas, permisos por columna, nulos | 2 (tras el 6, antes del 7) | 6 | 3, 4, 5, 8 | develop + testing | opus — mismo motivo que el paso 6: seguridad entre talleres sobre PGlite |
| 6 | Base de datos: esquema, RLS y arnés de pruebas | 2 | 1, 2 | 3, 4, 5, 8 | develop + testing | opus — PGlite con roles y RLS tiene comportamiento sin comprobar y aquí se decide la seguridad entre talleres |
| 7 | Funciones SQL: entregar orden, numeración y demo | 2 (tras el 6) | 6 | 3, 4, 5, 8 | develop + testing | sonnet |
| 8 | Acceso: lógica, clientes de Supabase y cabeceras (sin pantallas) | 2 | 1, 2 | 3, 4, 5, 6 | develop + testing | sonnet |
| 8b | Ronda extra de acceso: sin Cache Components, límite de tiempo, matcher, CSP de desarrollo | 2 (tras el 8) | 8 | 3, 4, 5, 6, 7 | develop + testing | sonnet |
| 9 | Proyecto de Supabase en la nube | 3 | 7, 8 | 10, 11 | ejecutor-sonnet | sonnet |
| 10 | Órdenes y recambios: casos de uso y repositorios (sin pantallas) | 3 | 5, 8 | 9, 11, 12 | develop + testing | sonnet |
| 11 | PDF, restablecer demo y cron (sin pantallas) | 3 | 5, 7, 8 | 9, 10, 12 | develop + testing | sonnet |
| 12 | Pantallas de acceso, armazón y `/proceso` | 3 | 3 + OK de diseño, 4, 8 | 10, 11 | develop + testing | sonnet |
| 13 | Pantallas de tablero, nueva orden y ficha | 4 | 9, 10, 11, 12 | 14 | develop + testing | sonnet |
| 14 | Pantalla de recambios | 4 | 9, 10, 12 | 13 | develop + testing | sonnet |
| 15 | Móvil, accesibilidad, E2E y enlace de restablecer | 5 | 13, 14 | — | develop + testing | sonnet |
| 16 | Cierre: `spec:check` completo, README, repo privado y gate | 6 | 15 | — | ejecutor-sonnet | sonnet |
| 17 | Publicación y checklist de entrega | 7 | 16 + revisor + GATE 3 | — | ejecutor-sonnet | sonnet |

Testing corre siempre en `sonnet`. Oleada 2: cinco ramas a la vez (3, 4, 5, 6→7, 8). El OK de diseño solo hace esperar al paso 12; 9, 10 y 11 arrancan en cuanto se integra la oleada 2.

### Pasos

#### Paso 1: Esqueleto Next, puertas, dependencias y scripts

- **Cierra:** P-1, P-9
- **Archivos** (todos nuevos, en `<raiz-del-repo>`; se trabaja en `main`, sin copia aparte):
  - lo que genera `create-next-app` (`package.json`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `postcss.config.mjs`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`, `.gitignore`)
  - `calidad.json`, `.dependency-cruiser.cjs`, `knip.json`, `vitest.config.ts`, `stryker.config.mjs`, `playwright.config.ts`, `.nvmrc`, `.editorconfig`, `.prettierrc.json`, `.gitleaks.toml`, `.env.example`, `vercel.json`
  - `scripts/puertas/**`, `.github/workflows/gate.yml`, `.github/dependabot.yml` (copias)
  - `tests/proceso/puertas.test.ts`, `tests/proceso/enunciado.test.ts`, `README.md` (provisional), `DECISIONES.md`
- **Contexto que necesitas** (ya investigado):
  - El repo existe con `git init -b main`, autor local configurado y `docs/SPEC.md`. A la vez que tú, otro agente escribe `CLAUDE.md`, `.claude/agents/*`, `DIRECTRICES.md` y `proceso/*`: no los toques ni los añadas a tu commit.
  - Plantilla de puertas: `<plantilla-de-puertas>/` (`scripts/` con 6 `.mjs` y `lib/puerta.mjs`; `.github/workflows/gate.yml`, 185 líneas; `.github/dependabot.yml`). Guía: `ADOPTAR.md` en esa carpeta, secciones 1 a 5.
  - Configs que se imitan: `../proyecto-previo/eslint.config.js:25-47` (límites leídos de `calidad.json`), `../proyecto-previo/.dependency-cruiser.cjs:6-36`, `../proyecto-previo/stryker.config.mjs:15-57`, `../proyecto-previo/vitest.config.js:9-27`, y los scripts `cobertura`, `duplicado`, `muerto`, `puertas` de `../proyecto-previo/package.json`.
  - Los hooks globales de git corren `npm run check` en cada commit y `npm run check:full` en cada push.
  - `scripts/puertas/spec-check.mjs` trata como criterio toda fila de tabla cuya primera celda sea un ID; hasta el paso 16 daría SIN TEST. Por eso `spec:check` existe pero **no** entra en `check:full` todavía.
  - `gate.yml`, paso «puertas gate:<id>» (líneas 131-142 de la plantilla): corre `npm run gate:<id>` si el script existe.
- **Contrato exacto:**
  - Generar con `npx create-next-app@16.4.6 <dir> --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --yes`. Si se niega porque el directorio no está vacío, generar en `<carpeta-temporal>/next-base` y mover el contenido (sin `.git`) al repo.
  - Dependencias, versiones exactas (sin `^`). Ejecución: `next` 16.4.6, `react` y `react-dom` 19.3.1, `@supabase/supabase-js` 2.119.2, `@supabase/ssr` 0.12.7, `zod` 4.6.7, `pdf-lib` 1.17.1, `server-only` (última). Desarrollo: `typescript` última 6.0.x (`npm view typescript@6.0 version`), `vitest` 4.1.11, `@vitest/coverage-v8` 4.1.11, `@stryker-mutator/core` y `@stryker-mutator/vitest-runner` 10.1.1, `eslint-plugin-sonarjs` 4.2.2, `dependency-cruiser` 18.9.0, `knip` 6.48.0, `jscpd` 5.4.3, `fast-check` 4.11.0, `@testing-library/react` 16.3.3, `jsdom` 31.0.1, `@electric-sql/pglite` 0.6.0, `@playwright/test` 1.65.1, `@axe-core/playwright` 4.14.0, `prettier` (última). `.nvmrc`: `24`.
  - `calidad.json`: `tipo: "web"`, `supabase: true`, `limites` de `ADOPTAR.md` sección 2, `mutacion: { "break": 80, "rutas": ["src/nucleo/**/*.ts"] }`, `omitir` con `dast`, `lighthouse`, `enlaces`, `carga` y los motivos de la sección «Tipo y puertas».
  - Scripts de `package.json`: `dev`, `build`, `start`, `lint` (`eslint .`), `tipos` (`tsc --noEmit`), `test` (`vitest run`), `check` (`npm run lint && npm run tipos && npm test`), `cobertura` (como proyecto-previo, dejando `reports/vitest.json`), `arquitectura` (`depcruise src --config .dependency-cruiser.cjs`), `duplicado`, `muerto`, `puertas` (como proyecto-previo, con `origin/main` y caída al primer commit), `spec:check` (`node scripts/puertas/spec-check.mjs --specs DIRECTRICES.md --vitest reports/vitest.json --no-escribir`), `check:full` (`npm run check && npm run cobertura && npm run arquitectura && npm run puertas`), `gate:tipos` (`npm run tipos`), `gate:rls` (`vitest run tests/bd`), `gate:mutacion` (`stryker run --concurrency 4`), `e2e` (`playwright test tests/e2e/movil.spec.ts`), `gate:e2e` y `gate:a11y` (`npm run e2e`), `gate:cabeceras` (`vitest run tests/seguridad/cabeceras.test.ts`), `smoke` (`playwright test tests/e2e/smoke.spec.ts`), `checklist` (`node scripts/checklist-entrega.mjs`), `desplegar` (`npx vercel@latest pull --yes --environment=production --token="$VERCEL_TOKEN" && npx vercel@latest build --prod --token="$VERCEL_TOKEN" && npx vercel@latest deploy --prebuilt --prod --token="$VERCEL_TOKEN"`).
  - `.dependency-cruiser.cjs`: una regla por línea de «Dependencias prohibidas» de la sección Arquitectura, más `sin-ciclos`; `exclude: '^scripts/puertas/'`; `tsConfig` apuntando a `tsconfig.json`.
  - `eslint.config.mjs`: lo generado por Next + `sonarjs.configs.recommended` + el bloque de límites de proyecto-previo aplicado a `**/*.{ts,tsx,mjs}`; `ignores`: `.next/**`, `coverage/**`, `reports/**`, `.stryker-tmp/**`, `scripts/puertas/**`. En `error`: `no-empty`, `no-console`, `@typescript-eslint/no-explicit-any`, `react/no-danger`.
  - `vitest.config.ts`: entorno `node` por defecto y `jsdom` para `**/*.test.tsx`; `include`: `src/**/*.test.{ts,tsx}`, `tests/**/*.test.ts`; `exclude`: `tests/e2e/**`; cobertura v8 sobre `src/**` (sin tests, sin `src/app/**/layout.tsx`, `loading.tsx`, `error.tsx`), umbrales `lines: 80, branches: 75`; `passWithNoTests: false`; alias `@` → `src`.
  - `playwright.config.ts`: `baseURL` de `URL_BASE` (por defecto `http://127.0.0.1:3000`); proyectos `movil` (390×844) y `escritorio` (1440×900); reporter `json` a `reports/playwright.json` más `list`; `webServer` (`npm run build && npm run start`) solo si no hay `URL_BASE`.
  - `.env.example` (solo nombres): `SUPABASE_URL=`, `SUPABASE_PUBLISHABLE_KEY=`, `SUPABASE_SECRET_KEY=`, `CRON_SECRET=`, `DEMO_PASSWORD=`.
  - `.gitignore` añade: `.env*` (salvo `.env.example`), `reports/`, `coverage/`, `.stryker-tmp/`, `test-results/`, `playwright-report/`, `supabase/.temp/`, `.vercel/`.
  - `vercel.json`: `{ "framework": "nextjs", "crons": [{ "path": "/api/cron/restablecer", "schedule": "0 4 * * *" }] }`.
  - `gate.yml`: copia, con tres cambios: (1) la primera línea de comentario pasa a `# Gate de calidad: cada puerta deja su informe y scripts/puertas/informe-gate.mjs decide.`; (2) justo antes del paso «puertas gate:<id>», un paso con `if: env.NIVEL == 'completo'` que levanta Supabase local (`supabase/setup-cli@v1`, `supabase start`, `supabase db reset`), exporta a `$GITHUB_ENV` `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` y `SUPABASE_SECRET_KEY` leídas de `supabase status -o env`, fija `DEMO_PASSWORD=demo-ci-local` y `CRON_SECRET=cron-ci-local`, corre `node scripts/crear-usuarios-demo.mjs` y `npx playwright install --with-deps chromium`; (3) en el job `desplegar`, `env` con `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` desde `secrets` y `URL_BASE: ${{ vars.URL_PRODUCCION }}`.
  - `src/app/page.tsx`: una línea de texto «FOSO» provisional. Borrar los SVG y estilos de ejemplo.
  - `DECISIONES.md`: título y una línea que remite a la sección Decisiones de `docs/SPEC.md`.
- **Tests primero:**
  | Test | Entrada | Resultado esperado |
  |---|---|---|
  | `[P-1] package.json define los scripts de las puertas` | `package.json` | existen `check`, `check:full`, `cobertura`, `arquitectura`, `duplicado`, `muerto`, `spec:check`, `gate:tipos`, `gate:rls`, `gate:mutacion`, `gate:e2e`, `smoke`, `checklist` |
  | `[P-1] calidad.json declara tipo web, supabase y las omisiones con motivo` | `calidad.json` | `tipo === 'web'`, `supabase === true`, cada valor de `omitir` tiene más de 20 caracteres |
  | `[P-9] el proyecto es Next.js con App Router` | `package.json` y disco | `dependencies.next` existe y `src/app/layout.tsx` existe |
  | `[P-9] lleva la estructura de agentes de Claude Code` | disco | si existe `.claude/agents`, contiene `develop.md` y `testing.md`, y existe `CLAUDE.md` (mientras el otro agente no haya terminado, el test usa `it.runIf(existsSync('.claude/agents'))`) |
- **Cambio:** generar → fijar versiones e `npm install` dentro del repo → copiar puertas → configs → tests rojo y verde → `npm run check:full` → `node scripts/puertas/trinquete.mjs --actualizar` → `git add` solo de tus archivos → commit `chore: esqueleto Next 16 y puertas de calidad`.
- **No hacer:** crear carpetas de `src` vacías; tocar `docs/SPEC.md` ni los archivos del otro agente; push.
- **Verificación:** `npm run check:full` → código 0; `npm run build` → compila; `git log --oneline` → un commit.
- **Para y devuelve ABIERTO si:** `create-next-app@16.4.6` genera otra estructura (sin `src/app`); una puerta de `scripts/puertas` falla por algo ajeno al repo; el hook bloquea el commit por algo distinto de un `check` en rojo.

#### Paso 2: Los tres agentes y las directrices

- **Cierra:** P-2 (contenido), P-3 (tabla)
- **Archivos** (todos nuevos; se trabaja en `main`, sin commit: lo hace la sesión principal cuando el paso 1 haya hecho el suyo, con `docs(agentes): orquestador, develop, testing y directrices`):
  - `CLAUDE.md`, `.claude/agents/develop.md`, `.claude/agents/testing.md`, `DIRECTRICES.md`
  - `proceso/features.json`, `proceso/LEEME.md`
- **Contexto que necesitas:**
  - SPEC, sección «Los tres agentes del repo» entera (tabla, Protocolo de ronda, reglas de honestidad, Trabajo en paralelo): es lo que hay que convertir en `CLAUDE.md`, `develop.md` y `testing.md`.
  - SPEC, «Arquitectura» (capas y dependencias prohibidas) y «Diseño → Concepto FOSO» (tokens y vetos): `develop.md` las resume como normas de trabajo.
  - Formato de agente de Claude Code: frontmatter YAML con `name`, `description`, `tools`, `model`.
  - Formato de ronda que `testing.md` debe documentar (lo validará el paso 4): JSON con `feature` (texto), `ronda` (entero ≥ 1), `fecha` (`AAAA-MM-DD`), `commitRevisado` (hash de 7 a 40 hex), `origen` opcional (`ronda` | `revision-final`), `veredicto` (`PASA` | `FALLA`), `comandos` (lista de `{ comando, resultado: 'OK' | 'FALLO', resumen }`, al menos uno), `fallos` (lista de `{ directriz: 'D-n', archivo, descripcion, evidencia }`), `observaciones` (texto). `PASA` exige cero fallos y ningún comando en `FALLO`.
- **Contrato exacto:**
  - Límites: `CLAUDE.md` ≤ 90 líneas, `develop.md` ≤ 120, `testing.md` ≤ 100, `DIRECTRICES.md` ≤ 70. Español, frases cortas, sin emojis, sin mayúsculas de énfasis. Prohibido mencionar rutas de fuera del repo, «skills» u otros proyectos.
  - Frontmatter: `develop` → `tools: Read, Edit, Write, Bash, Grep, Glob`, `model: sonnet`. `testing` → `tools: Read, Write, Bash, Grep, Glob`, `model: sonnet`.
  - `CLAUDE.md`, secciones en este orden: «Qué es esto», «Los tres agentes» (tabla), «Cómo se reparte el trabajo» (el protocolo de ronda, puntos 1 a 5, y que cada feature va en su rama), «Lo que el orquestador no hace» (no programa, no edita rondas, no relaja puertas), «Mapa del repo», «Comandos», «Commits», «Cuándo parar y preguntar».
  - `develop.md`, secciones: «Tu trabajo», «Antes de escribir código» (leer el encargo y `DIRECTRICES.md`), «Test primero», «Capas», «Datos y errores», «Interfaz», «Lo que no haces» (saltar un test, desactivar una regla, tocar `proceso/` o `DIRECTRICES.md`, tocar `package.json`), «Cuando Testing te devuelve fallos» (arreglar la causa con un test que lo reproduce; discrepar se hace por escrito en el informe), «Informe» (VERIFICADO / ABIERTO / SIN COMPROBAR con comando y salida).
  - `testing.md`, secciones: «Tu trabajo», «Lo que recibes» (feature y rango de commits; nunca la explicación de Develop), «Cómo revisas» (1 leer directrices; 2 leer el diff; 3 `npm run check:full`; 4 la comprobación de cada directriz afectada; 5 buscar el caso que rompe: entradas límite, otro taller, otro rol, móvil), «Qué es un fallo» (incumple una directriz, con evidencia; una preferencia no lo es), «El informe de ronda» (ruta y formato), «Lo que no haces» (editar `src`, tests o directrices; inventar fallos; dar `PASA` con un comando en rojo).
  - `DIRECTRICES.md`: un párrafo de entrada, esta tabla literal y, al final, dos comentarios HTML en líneas seguidas: el primero con el texto `estado:inicio` y el segundo con `estado:fin` (entre ellos escribe `spec-check` el estado):
    ```
    | ID | Directriz | Cómo se demuestra |
    |---|---|---|
    | D-1 | La lógica de negocio vive en `src/nucleo` y es pura: sin red, sin disco, sin reloj, sin entorno | test `[D-1]` que ejecuta dependency-cruiser y exige 0 violaciones |
    | D-2 | Todo dato que entra (formulario, fila de la base de datos, archivo de ronda) se valida con zod antes de usarse | tests `[D-2]` con entrada basura en cada adaptador y caso de uso |
    | D-3 | Toda tabla tiene RLS activado, política por taller y ningún permiso para `anon` | test `[D-3]` que recorre el catálogo de Postgres |
    | D-4 | Ningún secreto en el repo ni en el navegador: la clave secreta solo en módulos `server-only`, ninguna variable `NEXT_PUBLIC_*` | test `[D-4]` |
    | D-5 | El dinero se guarda y se calcula en céntimos enteros | tests de propiedades `[D-5]` |
    | D-6 | Cada archivo de `src/nucleo` y `src/aplicacion` tiene su archivo de test al lado | test `[D-6]` |
    | D-7 | Límites: 300 líneas por archivo, 50 por función, complejidad 10, 4 parámetros | test `[D-7]` que lee la configuración de eslint |
    | D-8 | Sin atajos: nada de `skip`, `only`, comentarios que apagan eslint o TypeScript, `any` ni HTML inyectado sin escapar | test `[D-8]` que recorre `src` y `tests` |
    | D-9 | Colores, tipografías y espaciados salen de `src/ui/tokens.css`; ningún valor suelto | test `[D-9]` |
    | D-10 | Cada par de texto y fondo cumple contraste AA | test `[D-10]` que calcula el contraste de los pares declarados |
    | D-11 | Cada pantalla tiene estado de carga, de error y vacío | test `[D-11]` |
    | D-12 | Textos en español, sin emojis, sin texto de relleno, nunca por debajo de 14 px | test `[D-12]` |
    | D-13 | Móvil primero: a 390 px nada se desborda, los botones de acción miden 48 px o más y axe no da faltas graves | manual: `npm run gate:e2e`, tests `[D-13]` de Playwright |
    | D-14 | Ningún `catch` vacío; todo error llega al usuario con un mensaje que puede entender | test `[D-14]` |
    | D-15 | Una ronda es honesta: todo fallo lleva evidencia y el veredicto `PASA` exige cero fallos y todos los comandos en verde | test `[D-15]` sobre el esquema de ronda |
    ```
  - `proceso/features.json`: lista de `{ id, titulo, resumen, estado }` con `estado: "pendiente"` en todas: `f01-sistema-visual` «Sistema visual y tablero», `f02-proceso` «Registro del proceso», `f03-nucleo` «Reglas del taller», `f04-base-datos` «Base de datos y aislamiento», `f05-funciones` «Entrega de órdenes y demo en la base de datos», `f06-acceso` «Acceso y seguridad», `f07-ordenes-recambios` «Órdenes y recambios», `f08-documentos-demo` «PDF y demo restablecible», `f09-pantallas-acceso` «Acceso, armazón y página de proceso», `f10-pantallas-ordenes` «Tablero, nueva orden y ficha», `f11-pantalla-recambios` «Almacén de recambios», `f12-movil` «Móvil y accesibilidad». `resumen`: una frase de lo que hace cada una.
  - `proceso/LEEME.md` (≤ 12 líneas): qué hay en la carpeta, quién escribe cada archivo y que las rondas no se editan a mano.
- **Tests primero:** no aplica en este paso (son textos); los tests `[P-2]` y `[P-3]` los escribe el paso 4 contra estos archivos. Compruébalo tú con la verificación de abajo.
- **No hacer:** rondas de ejemplo; copiar texto de contratos o agentes de fuera del repo; directrices fuera de la tabla; commit.
- **Verificación:** `wc -l CLAUDE.md .claude/agents/*.md DIRECTRICES.md` → dentro de los límites; `grep -rnE "Users/|\.claude/skills|skill" CLAUDE.md .claude DIRECTRICES.md proceso` → sin resultados; `grep -c "^| D-" DIRECTRICES.md` → 15; `node -e "JSON.parse(require('fs').readFileSync('proceso/features.json','utf8')).length"` → 12.
- **Para y devuelve ABIERTO si:** una sección pedida no cabe en el límite de líneas sin perder una regla.

#### Paso 3: Sistema visual FOSO y tablero de muestra (feature `f01-sistema-visual`)

- **Cierra:** C-10, C-14, C-17; D-9, D-10, D-12
- **Archivos:**
  - `src/ui/tokens.css`, `src/ui/pares-contraste.ts`, `src/ui/fuentes.ts`, `src/ui/Matricula.tsx`, `src/ui/Boton.tsx`, `src/ui/EstadoVacio.tsx`, `src/ui/iconos.tsx` — crear
  - `src/ui/tablero/Tablero.tsx`, `src/ui/tablero/TarjetaOrden.tsx`, `src/ui/tablero/Tablero.test.tsx`, `src/ui/tablero/muestra.ts` — crear
  - `src/app/globals.css`, `src/app/layout.tsx` — modificar; `src/app/muestra/page.tsx` — crear (temporal, la borra el paso 13)
  - `tests/diseno/tokens.test.ts`, `tests/diseno/anti-generico.test.ts`, `tests/diseno/contraste.ts` — crear
- **Contexto que necesitas:**
  - SPEC, sección «Diseño» entera: es el contrato visual.
  - Tailwind 4: los tokens se declaran en `@theme` dentro de `tokens.css`; `--color-*: initial;` apaga la paleta por defecto. `globals.css` importa `tailwindcss` y `tokens.css`.
  - Fuentes con `next/font/google`: `Big_Shoulders` (si no existe con ese nombre, `Big_Shoulders_Display`), `Schibsted_Grotesk`, `Martian_Mono`, expuestas como `--fuente-titular`, `--fuente-texto`, `--fuente-dato`.
- **Contrato exacto:**
  ```ts
  // src/ui/tablero/Tablero.tsx
  export type OrdenTablero = { id: string; matricula: string; vehiculo: string; cliente: string;
    estado: 'recibido' | 'en_reparacion' | 'listo' | 'entregado'; descripcion: string };
  export function Tablero(props: { ordenes: OrdenTablero[]; puedeEntregar: boolean;
    accionAvanzar?: (datos: FormData) => void | Promise<void> }): JSX.Element
  // cada tarjeta: <form action={accionAvanzar}> con campos ocultos `id` y `de`; la matrícula enlaza a `/ordenes/<id>`
  // src/ui/Matricula.tsx
  export function Matricula(props: { texto: string; tamano?: 'normal' | 'grande' }): JSX.Element
  // src/ui/Boton.tsx
  export function Boton(props: React.ButtonHTMLAttributes<HTMLButtonElement> & { variante?: 'principal' | 'secundario' | 'peligro' }): JSX.Element
  // src/ui/EstadoVacio.tsx
  export function EstadoVacio(props: { texto: string }): JSX.Element
  // src/ui/pares-contraste.ts
  export const PARES: { texto: string; fondo: string; minimo: 4.5 | 3 }[]   // nombres de token
  // tests/diseno/contraste.ts
  export function contraste(hexA: string, hexB: string): number             // luminancia relativa WCAG 2.x
  ```
  - Títulos de columna: «Recibido», «En reparación», «Listo», «Entregado». Botones: «Pasar a en reparación», «Pasar a listo», «Entregar» (este es un enlace a la ficha y solo aparece si `puedeEntregar`). Vacíos: «Nada recibido hoy», «Ningún coche en el elevador», «Nada pendiente de recoger», «Aún no se ha entregado nada».
  - `PARES` (todos con mínimo 4,5): hueso/foso, hueso/chapa, hueso/chapa-alta, acero/foso, acero/chapa, foso/lampara, lampara/foso, ambar/chapa, testigo/chapa, averia/chapa, placa-texto/placa.
  - `muestra.ts`: 9 órdenes ficticias repartidas 3/3/2/1, matrículas de cuatro cifras y tres consonantes, nombres españoles inventados.
  - `/muestra` renderiza `<Tablero ordenes={MUESTRA} puedeEntregar />` dentro del `layout` real.
- **Tests primero:**
  | Test | Entrada | Resultado esperado |
  |---|---|---|
  | `[C-10] agrupa las órdenes en cuatro columnas en orden` | `MUESTRA` | 4 regiones con sus encabezados en orden y 3, 3, 2 y 1 tarjetas |
  | `[C-10] cada tarjeta muestra matrícula, vehículo, cliente y el botón de su siguiente estado` | una orden `recibido` | los tres textos y el botón «Pasar a en reparación» |
  | `[C-10][C-15][D-11] una columna sin órdenes muestra su estado vacío` | `ordenes: []` | los cuatro textos de vacío |
  | `[C-3] sin permiso de entrega no aparece Entregar` | orden `listo`, `puedeEntregar: false` | no existe «Entregar» |
  | `[C-14][D-9] ningún color literal fuera de tokens.css` | `src/**/*.{ts,tsx,css}` menos `tokens.css` | 0 coincidencias de `#[0-9a-fA-F]{3,8}\b`, `rgb(`, `hsl(`, `oklch(` |
  | `[C-14][D-9] ninguna clase de la paleta por defecto de Tailwind` | `src/**/*.tsx` | 0 coincidencias de `(bg|text|border|ring|fill|stroke)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d` |
  | `[C-14][D-10] cada par declarado cumple su contraste mínimo` | `PARES` + valores leídos de `tokens.css` | todos ≥ su `minimo` |
  | `[C-17][D-12] sin tipografías vetadas, antetítulos numerados, titulares por contraste ni emojis` | `src/**/*.{tsx,css}` | 0 coincidencias de cada patrón |
  | `[C-17][D-12] ningún texto por debajo de 14 px` | `src/**/*.{css,tsx}` | ningún `font-size` menor de `0.875rem` o `14px`; no se usa `text-xs` |
- **Cambio:** tests → tokens y fuentes → `Matricula`, `Boton`, `EstadoVacio`, iconos SVG → `Tablero` y `TarjetaOrden` (escritorio: 4 columnas; móvil: selector fijo y una columna) → atmósfera en `globals.css` → `/muestra` → ronda de Testing.
- **No hacer:** librerías de componentes, iconos o animación; `style` con valores de color; otras pantallas; navegación definitiva (paso 12).
- **Verificación:** `npm run check:full` → 0. La sesión principal (no el agente): comprueba el puerto 3000, lanza `npm run dev` en segundo plano en la copia de trabajo, captura `/muestra` a 1440×900 y 390×844 en `docs/diseno/tablero-escritorio.png` y `docs/diseno/tablero-movil.png`, corre `bash <detector-de-diseño-generico> src` (debe dar PASA) y para el servidor.
- **Gate de diseño (sesión principal):** rúbrica de impacto ≥ 13/16 sin ningún 0, enseñar a Vladys las dos capturas y la tabla; sin su OK no se lanza el paso 12. Los cambios que pida vuelven a Develop como ronda nueva de `f01-sistema-visual`.
- **Para y devuelve ABIERTO si:** un token no llega a AA sin perder el carácter; `next/font` no encuentra alguna familia; el tablero en móvil necesita más JavaScript de cliente que el selector de columna.

#### Paso 4: Proceso: formato de ronda, lectura y tests de proceso (feature `f02-proceso`)

- **Cierra:** C-12 (datos), P-2, P-3, P-4; D-15, D-2 (parte)
- **Archivos** (todos nuevos):
  - `src/adaptadores/proceso/esquema.ts`, `src/adaptadores/proceso/esquema.test.ts`, `src/adaptadores/proceso/leer-rondas.ts`, `src/adaptadores/proceso/leer-rondas.test.ts`
  - `tests/proceso/agentes.test.ts`, `tests/proceso/directrices.test.ts`, `tests/proceso/rondas.test.ts`
  - `scripts/entrega-check.mjs`
- **Contexto que necesitas:**
  - En el repo ya existen `CLAUDE.md`, `.claude/agents/develop.md`, `.claude/agents/testing.md`, `DIRECTRICES.md` (tabla `| ID | Directriz | Cómo se demuestra |` con `D-1` a `D-15`), `proceso/features.json` (12 features con `id`, `titulo`, `resumen`, `estado`).
  - Las rondas viven en `proceso/<id-de-feature>/ronda-<n>.json`.
- **Contrato exacto:**
  ```ts
  // src/adaptadores/proceso/esquema.ts
  export type Fallo = { directriz: string; archivo: string; descripcion: string; evidencia: string };
  export type Comando = { comando: string; resultado: 'OK' | 'FALLO'; resumen: string };
  export type Ronda = { feature: string; ronda: number; fecha: string; commitRevisado: string; origen?: 'ronda' | 'revision-final';
    veredicto: 'PASA' | 'FALLA'; comandos: Comando[]; fallos: Fallo[]; observaciones: string };
  export type Feature = { id: string; titulo: string; resumen: string; estado: 'pendiente' | 'en_curso' | 'hecha' };
  export const esquemaRonda: z.ZodType<Ronda>;     // objeto estricto; directriz /^D-\d+$/; archivo no vacío; descripcion y evidencia ≥ 10 caracteres;
                                                   // ronda entero ≥ 1; fecha /^\d{4}-\d{2}-\d{2}$/; commitRevisado /^[0-9a-f]{7,40}$/; comandos ≥ 1
  export const esquemaFeature: z.ZodType<Feature>;
  // reglas cruzadas (superRefine): PASA con fallos o con un comando FALLO → 'Una ronda que pasa no puede tener fallos ni comandos en rojo'
  //                               FALLA sin fallos y sin comando FALLO → 'Una ronda que falla necesita al menos un fallo o un comando en rojo'

  // src/adaptadores/proceso/leer-rondas.ts
  export type FeatureConRondas = Feature & { rondas: Ronda[] };            // rondas ordenadas por número
  export type ResumenProceso = { features: number; rondas: number; fallosCorregidos: number };
  export function leerProceso(directorio: string): FeatureConRondas[];     // lanza Error(`Ronda mal formada: <ruta>: <detalle>`) si un archivo no valida
  export function resumir(features: FeatureConRondas[]): ResumenProceso;   // fallosCorregidos = fallos de rondas FALLA de features cuya última ronda es PASA
  export function huecosDeRondas(feature: FeatureConRondas): string | null; // null si las rondas son 1..N seguidas; si no, texto que nombra el hueco
  ```
  - `scripts/entrega-check.mjs`: lee `proceso/features.json`; lista las features cuyo `estado` no es `hecha`; sale con 1 si hay alguna, con 0 si no.
- **Tests primero:**
  | Test | Entrada | Resultado esperado |
  |---|---|---|
  | `[D-15] una ronda PASA con un fallo se rechaza` | `veredicto: 'PASA'`, 1 fallo válido | error «Una ronda que pasa no puede tener fallos ni comandos en rojo» |
  | `[D-15] un fallo sin evidencia se rechaza` | `evidencia: ''` | error en `fallos.0.evidencia` |
  | `[D-15] una ronda FALLA sin fallos ni comandos en rojo se rechaza` | `veredicto: 'FALLA'`, `fallos: []`, comandos `OK` | error «Una ronda que falla necesita…» |
  | `[D-2] una ronda con campos de más o de menos se rechaza` | `{ feature: 1 }`; ronda válida + `extra: true` | `success === false` en las dos |
  | `[C-12] lee features y rondas ordenadas` | directorio temporal: 2 features, rondas 2 y 1 de la primera | primera con rondas `[1, 2]`, segunda con `[]` |
  | `[C-12][D-2] un archivo de ronda mal formado lanza error con su ruta` | `ronda-1.json` con `veredicto: 'QUIZA'` | lanza `Ronda mal formada: …/ronda-1.json` |
  | `[C-12] resume fallos corregidos solo de features que acaban en PASA` | A: FALLA(3) → PASA; B: FALLA(2) | `{ features: 2, rondas: 3, fallosCorregidos: 3 }` |
  | `[P-2] existen los cuatro archivos de los agentes y no están vacíos` | disco | los cuatro |
  | `[P-2] develop y testing declaran name, description, tools y model` | frontmatter | `name` correcto; `model: sonnet`; `testing` no tiene `Edit` en `tools` |
  | `[P-2] el orquestador nombra a los dos subagentes y describe las rondas` | `CLAUDE.md` | contiene `develop`, `testing` y `ronda` |
  | `[P-2] develop remite a las directrices` | `develop.md` | contiene `DIRECTRICES.md` |
  | `[P-2] los agentes no dependen de nada de fuera del repo` | los cuatro textos | no contienen `~/`, `/Users/` ni `skill` |
  | `[P-3] hay 15 directrices con ID único y demostración no vacía` | `DIRECTRICES.md` | `D-1`…`D-15`, sin repetidos |
  | `[P-4] las rondas reales de toda feature hecha no tienen huecos y acaban en PASA` | `leerProceso('proceso')` | para cada `hecha`: `huecosDeRondas` es `null` y la última es `PASA` |
  | `[P-4] detecta un hueco` | directorio temporal con rondas 1 y 3 | `huecosDeRondas` devuelve texto que contiene `2` |
- **Cambio:** tests → esquema → lector → tests de proceso → script → ronda de Testing.
- **No hacer:** componentes ni la página (paso 12); leer el historial de git; tocar los `.md` de los agentes (si un test `[P-2]` falla por su contenido, ABIERTO).
- **Verificación:** `npm run check:full` → 0; `node scripts/entrega-check.mjs` → sale con 1 y lista las 12.
- **Para y devuelve ABIERTO si:** algún `.md` de agente no cumple un test `[P-2]`.

#### Paso 5: Núcleo puro del taller (feature `f03-nucleo`)

- **Cierra:** C-3, C-4, C-5, C-6, C-7, C-8, C-9, C-11 (las reglas); D-1, D-5, D-6
- **Archivos** (nuevos; cada `.ts` con su `.test.ts` al lado, en `src/nucleo/`): `orden`, `permisos`, `importe`, `stock`, `whatsapp`, `matricula`, `documento`; más `tests/proceso/arquitectura.test.ts`.
- **Contexto que necesitas:** el núcleo no importa nada. `fast-check` está instalado.
- **Contrato exacto:**
  ```ts
  // orden.ts
  export const ESTADOS = ['recibido', 'en_reparacion', 'listo', 'entregado'] as const;
  export type Estado = (typeof ESTADOS)[number];
  export const ETIQUETA_ESTADO: Record<Estado, string>;   // 'Recibido' | 'En reparación' | 'Listo' | 'Entregado'
  export function siguienteEstado(estado: Estado): Estado | null;    // entregado → null
  export function anteriorEstado(estado: Estado): Estado | null;     // recibido → null; entregado → null
  export function puedeTransicionar(de: Estado, a: Estado): boolean; // un paso adelante, o un paso atrás si `de` no es entregado

  // permisos.ts
  export type Rol = 'jefe' | 'mecanico';
  export type Accion = 'crear_orden' | 'mover_orden' | 'anadir_linea' | 'entregar_orden' | 'borrar_orden' | 'editar_recambios' | 'ver_importes';
  export function puede(rol: Rol, accion: Accion): boolean;  // mecánico: solo las tres primeras; jefe: todas

  // importe.ts
  export const IVA_PORCENTAJE = 21;
  export type Linea = { cantidad: number; precioUnitarioCentimos: number };
  export type Totales = { recambiosCentimos: number; manoObraCentimos: number; baseCentimos: number; ivaCentimos: number; totalCentimos: number };
  export function calcularTotales(lineas: Linea[], manoObraMinutos: number, precioHoraCentimos: number): Totales;
  //  manoObra = Math.round(minutos * precioHora / 60); iva = Math.round(base * 21 / 100)
  //  RangeError('Importe no válido') si algún número no es entero, es negativo, o una cantidad es 0
  export function formatearEuros(centimos: number): string;  // 123456 → '1.234,56 €' (punto de millar, espacio normal antes de €); -50 → '-0,50 €'; RangeError('Importe no válido') si no es un entero finito (12.5, NaN, Infinity)
  export function eurosACentimos(texto: string): number | null;  // '12,50' → 1250; '12.5' → 1250; '0,1' → 10; '12,505' → null; 'abc' → null; '-1' → null

  // stock.ts
  export type Existencia = { recambioId: string; referencia: string; stock: number; stockMinimo: number };
  export type Consumo = { recambioId: string; cantidad: number };
  export function bajoMinimo(e: Pick<Existencia, 'stock' | 'stockMinimo'>): boolean;  // stock <= stockMinimo
  export type ResultadoDescuento = { ok: true; existencias: Existencia[] } | { ok: false; faltan: { referencia: string; falta: number }[] };
  export function descontar(existencias: Existencia[], consumos: Consumo[]): ResultadoDescuento;
  //  todo o nada; consumos repetidos del mismo recambio se suman; recambio inexistente → falta con referencia '?' + id

  // whatsapp.ts
  export function normalizarTelefono(texto: string): string | null;
  //  quita espacios, guiones, puntos y paréntesis; 9 cifras que empiezan por 6, 7, 8 o 9 → '34' + cifras;
  //  admite '+34', '0034' o '34' delante de esas 9 cifras; cualquier otra cosa → null
  export function mensajeAviso(d: { taller: string; matricula: string; estado: Estado }): string;
  //  recibido:      `Hola, le escribimos de ${taller}. Hemos recibido su vehículo ${matricula}.`
  //  en_reparacion: `Hola, le escribimos de ${taller}. Ya estamos trabajando en su vehículo ${matricula}.`
  //  listo:         `Hola, le escribimos de ${taller}. Su vehículo ${matricula} ya está listo para recoger.`
  //  entregado:     `Hola, le escribimos de ${taller}. Gracias por confiar en nosotros con su vehículo ${matricula}.`
  export function enlaceAviso(d: { telefono: string; taller: string; matricula: string; estado: Estado }): string | null;
  //  `https://wa.me/${tel}?text=${encodeURIComponent(mensaje)}`; null si el teléfono no es válido

  // matricula.ts
  export function normalizarMatricula(texto: string): string | null;
  //  mayúsculas, sin espacios ni guiones; válida si casa /^\d{4}[BCDFGHJKLMNPRSTVWXYZ]{3}$/ o /^[A-Z]{1,2}\d{4}[A-Z]{1,2}$/; si no, null

  // documento.ts
  export const LEYENDA_DEMO = 'Documento de demostración sin validez fiscal';
  export type EntradaDocumento = { taller: { nombre: string; nif: string; direccion: string; telefono: string };
    cliente: { nombre: string; telefono: string }; vehiculo: { matricula: string; marca: string; modelo: string };
    orden: { estado: Estado; descripcion: string; numeroFactura: string | null; fecha: string; manoObraMinutos: number; precioHoraCentimos: number };
    lineas: { referencia: string; nombre: string; cantidad: number; precioUnitarioCentimos: number }[] };
  export type DocumentoOrden = { tipo: 'presupuesto' | 'factura'; titulo: 'Presupuesto' | 'Factura'; numero: string | null;
    cabecera: EntradaDocumento['taller']; cliente: EntradaDocumento['cliente']; vehiculo: EntradaDocumento['vehiculo'];
    fecha: string; descripcion: string;
    filas: { concepto: string; cantidad: string; precio: string; importe: string }[];   // una por línea + «Mano de obra» si minutos > 0
    totales: { base: string; iva: string; total: string }; leyenda: string };
  export function construirDocumento(entrada: EntradaDocumento): DocumentoOrden;
  //  factura si estado === 'entregado' y numeroFactura no es null; si no, presupuesto con numero null
  //  cantidad de mano de obra en horas con dos decimales y coma: 90 min → '1,50 h'
  ```
- **Tests primero** (más un caso por cada rama descrita en los comentarios del contrato):
  | Test | Entrada | Resultado esperado |
  |---|---|---|
  | `[C-4] solo se llega al estado siguiente o al anterior` (propiedad) | todos los pares de `ESTADOS` | verdadero solo en los 3 avances y los 2 retrocesos (en_reparacion→recibido, listo→en_reparacion) |
  | `[C-4] una orden entregada no cambia` | `('entregado', x)` para todo x | `false` |
  | `[C-3] el mecánico no entrega, no borra, no edita recambios ni ve importes` | `puede('mecanico', …)` | `false` en esas cuatro, `true` en las otras tres |
  | `[C-7][D-5] base + IVA = total y todo son enteros` (propiedad) | cantidad 1..50, precio 0..500000, minutos 0..2000, precio hora 0..20000 | `total === base + iva`; los cinco enteros; `iva === Math.round(base*21/100)` |
  | `[C-7] ejemplo fijado` | 2 × 1250 + 1 × 899, 90 min a 4500 | recambios 3399, mano de obra 6750, base 10149, IVA 2131, total 12280 |
  | `[C-7][D-5] rechaza decimales, negativos y cantidad cero` | precio 12.5; cantidad −1; cantidad 0 | `RangeError('Importe no válido')` |
  | `[C-7] formatea euros` | 123456; 5; 0; 100000000 | `'1.234,56 €'`; `'0,05 €'`; `'0,00 €'`; `'1.000.000,00 €'` |
  | `[C-7][D-5] convierte euros escritos a céntimos` | los seis ejemplos del contrato | 1250, 1250, 10, `null`, `null`, `null` |
  | `[C-5] descontar es todo o nada` (propiedad) | existencias y consumos arbitrarios | si `ok`, ningún stock negativo y lo descontado es la suma de consumos; si no, `faltan` no está vacío |
  | `[C-5] nombra la referencia que falta y cuánto` | stock 2 de `FIL-01`, consumo 5 | `{ ok: false, faltan: [{ referencia: 'FIL-01', falta: 3 }] }` |
  | `[C-6] bajo mínimo incluye el igual` | 4/4; 5/4; 0/0 | `true`; `false`; `true` |
  | `[C-9] normaliza teléfonos españoles` | `'612 345 678'`; `'+34 612-345-678'`; `'0034612345678'`; `'12345'`; `'512345678'` | `'34612345678'` las tres primeras; `null` las dos últimas |
  | `[C-9] construye el enlace con el mensaje codificado` | `612345678`, `Talleres Vega`, `1234BCD`, `listo` | `'https://wa.me/34612345678?text=' + encodeURIComponent('Hola, le escribimos de Talleres Vega. Su vehículo 1234BCD ya está listo para recoger.')` |
  | `[C-9] sin teléfono válido no hay enlace` | `'abc'` | `null` |
  | `[C-11] normaliza matrículas` | `'1234 bcd'`; `'m-1234-ab'`; `'1234AEI'`; `'12BCD'` | `'1234BCD'`; `'M1234AB'`; `null`; `null` |
  | `[C-8] sin entregar es presupuesto sin número` | estado `listo` | `tipo: 'presupuesto'`, `numero: null`, `leyenda === LEYENDA_DEMO` |
  | `[C-8] entregada con número es factura` | `entregado`, `'F-2026-0001'` | `tipo: 'factura'`, `numero: 'F-2026-0001'` |
  | `[C-8] filas y totales salen formateados` | el ejemplo de C-7 | 3 filas (la última «Mano de obra», `'1,50 h'`), `totales.total === '122,80 €'` |
  | `[D-1] dependency-cruiser no encuentra violaciones` | ejecuta `npx depcruise src --config .dependency-cruiser.cjs` | código de salida 0 |
  | `[D-6] cada archivo de nucleo y aplicacion tiene su test` | disco | por cada `x.ts` (no test) existe `x.test.ts` |
- **Cambio:** un módulo cada vez, test → código; al final `npm run gate:mutacion` y matar los mutantes vivos con tests; ronda de Testing.
- **No hacer:** `Intl.NumberFormat` (mete espacios que el PDF no dibuja); `Date`; zod en el núcleo; estados o acciones fuera del contrato.
- **Verificación:** `npm run check:full` → 0; `npm run gate:mutacion` → ≥ 80 con la tabla pegada.
- **Para y devuelve ABIERTO si:** Stryker da 0 % o un 100 % sin mutantes (comprobar `vitest` 4.1.11); dos casos del contrato se contradicen.

#### Paso 6: Base de datos: esquema, RLS y arnés de pruebas (feature `f04-base-datos`)

- **Cierra:** C-2, C-3, C-4 (en la base de datos); D-3
- **Archivos** (nuevos):
  - `supabase/config.toml`, `supabase/migrations/20261123000001_esquema.sql`, `supabase/migrations/20261123000002_rls.sql`
  - `tests/bd/arnes.ts`, `tests/bd/aislamiento.test.ts`, `tests/bd/roles.test.ts`, `tests/bd/transiciones.test.ts`, `tests/bd/catalogo.test.ts`
- **Contexto que necesitas:**
  - SPEC, «Arquitectura → Modelo de datos» y las tres primeras filas de «Amenazas».
  - `@electric-sql/pglite` 0.6.0 está instalado. PGlite no trae los roles ni el esquema `auth` de Supabase: el arnés los crea **antes** de aplicar las migraciones, así las migraciones son las mismas que irán a la nube.
  - En Supabase real `auth.uid()` sale del JWT; en el arnés se sustituye por una función que lee un ajuste de sesión.
- **Contrato exacto:**
  - `supabase/config.toml`: `project_id = "taller-agentes"`; `[auth] enable_signup = false`; `[api] schemas = ["public"]`.
  - `…01_esquema.sql`: tipos `rol_taller` (`'jefe','mecanico'`) y `estado_orden` (`'recibido','en_reparacion','listo','entregado'`); las ocho tablas del modelo de datos con: `id uuid primary key default gen_random_uuid()` (salvo `miembros`, clave `usuario_id`, y `demo_control`, `id boolean primary key default true check (id)`, `ultimo_restablecido timestamptz`); `taller_id uuid not null references talleres(id) on delete cascade` en las de negocio; `miembros.usuario_id uuid references auth.users(id) on delete cascade`; `not null` en nombre, matrícula, referencia, descripción; `check (precio_centimos >= 0)`, `check (stock >= 0)`, `check (stock_minimo >= 0)`, `check (cantidad > 0)`, `check (precio_unitario_centimos >= 0)`, `check (mano_obra_minutos >= 0)`; `ordenes.estado estado_orden not null default 'recibido'`, `precio_hora_centimos integer not null default 4500`, `mano_obra_minutos integer not null default 0`, `numero_factura text`, `creada_en timestamptz not null default now()`, `entregada_en timestamptz`; `talleres.siguiente_factura integer not null default 1`; únicos `(taller_id, matricula)` en `vehiculos`, `(taller_id, referencia)` en `recambios`, `(orden_id, recambio_id)` en `orden_lineas`; `orden_lineas.orden_id … on delete cascade`.
  - Disparador `ordenes_reglas` (`before update on ordenes for each row`): `new.taller_id <> old.taller_id` → `raise exception 'TALLER_INMUTABLE'`; `old.estado = 'entregado'` → `raise exception 'ORDEN_CERRADA'`; cambia `estado` y el par no es recibido→en_reparacion, en_reparacion→listo, listo→entregado, en_reparacion→recibido ni listo→en_reparacion → `raise exception 'TRANSICION_INVALIDA'`.
  - `…02_rls.sql`:
    - `create schema app;` con `app.mi_taller() returns uuid` y `app.mi_rol() returns public.rol_taller`, `language sql stable security definer set search_path = ''`, que leen `public.miembros where usuario_id = auth.uid()`. `grant usage on schema app to authenticated`; `grant execute` de las dos a `authenticated`; `revoke all` de las dos a `public` y `anon`.
    - `alter table … enable row level security` en las ocho. `revoke all on all tables in schema public from anon;`. A `authenticated`, solo los privilegios que alguna política usa.
    - Políticas, todas `to authenticated` («del taller» = `taller_id = app.mi_taller()`):

      | Tabla | select | insert | update | delete |
      |---|---|---|---|---|
      | `talleres` | `id = app.mi_taller()` | — | — | — |
      | `miembros` | del taller | — | — | — |
      | `clientes`, `vehiculos` | del taller | del taller | del taller (`using` y `with check`) | del taller y `app.mi_rol() = 'jefe'` |
      | `recambios` | del taller | del taller y jefe | del taller y jefe | del taller y jefe |
      | `ordenes` | del taller | del taller, `estado = 'recibido'` y `numero_factura is null` | `using`: del taller y `estado <> 'entregado'`; `with check`: del taller, `estado <> 'entregado'` y `numero_factura is null` | del taller, jefe y `estado <> 'entregado'` |
      | `orden_lineas` | del taller | del taller y existe la orden en ese taller con `estado <> 'entregado'` | igual que insert | igual que insert |
      | `demo_control` | — | — | — | — |
  - Arnés:
    ```ts
    // tests/bd/arnes.ts
    export type Sql = (texto: string, parametros?: unknown[]) => Promise<Record<string, unknown>[]>;
    export type Bd = { sql: Sql; cerrar: () => Promise<void> };
    export async function crearBd(): Promise<Bd>;   // PGlite en memoria; crea roles anon, authenticated y service_role (este con bypassrls);
                                                    // esquema auth mínimo; aplica supabase/migrations/*.sql en orden de nombre
    export type Semilla = { tallerA: string; tallerB: string; jefeA: string; mecanicoA: string; jefeB: string;
      ordenA: string; ordenB: string; recambioA: string; recambioB: string; clienteB: string; vehiculoB: string };
    export async function sembrarDosTalleres(bd: Bd): Promise<Semilla>;   // como superusuario: en cada taller 1 cliente, 1 vehículo, 2 recambios (stock 10), 1 orden `recibido` con 1 línea
    export async function como<T>(bd: Bd, usuarioId: string | null, fn: (sql: Sql) => Promise<T>): Promise<T>;
    //  transacción; `set local role authenticated` (`anon` si usuarioId es null);
    //  `select set_config('request.jwt.claim.sub', <id o ''>, true)`; ejecuta fn; rollback siempre
    ```
    Esquema `auth` del arnés: `auth.users(id uuid primary key, email text unique)` y `auth.uid()` = `nullif(current_setting('request.jwt.claim.sub', true), '')::uuid`.
- **Tests primero:**
  | Test | Entrada | Resultado esperado |
  |---|---|---|
  | `[C-2] el jefe de A no ve filas de B en ninguna tabla` | `como(jefeA)`: `count(*)` con `taller_id = tallerB` en las 6 tablas de negocio y `talleres where id = tallerB` | 0 en todas |
  | `[C-2] el jefe de A no inserta en B` | cliente, vehículo, recambio, orden y línea con `taller_id = tallerB` | error de política en las cinco |
  | `[C-2] el jefe de A no modifica ni borra filas de B` | `update` y `delete` sobre `ordenB`, `recambioB`, `clienteB` | 0 filas afectadas; leídas como superusuario, sin cambios |
  | `[C-2] una línea de A no puede colgar de una orden de B` | línea con `taller_id = tallerA`, `orden_id = ordenB` | error de política |
  | `[C-2] anon no lee ninguna tabla` | `como(null)`: `select` en las 8 | error de permiso en las 8 |
  | `[C-2] nadie cambia de taller una fila` | `como(jefeA)`: `update ordenes set taller_id = tallerB where id = ordenA` | error |
  | `[C-3] el mecánico no crea, cambia ni borra recambios` | `como(mecanicoA)` | error al insertar; 0 filas al actualizar y al borrar |
  | `[C-3] el mecánico no borra órdenes y el jefe sí` | `delete from ordenes where id = ordenA` | mecánico 0 filas; jefe 1 fila |
  | `[C-3] nadie pone entregado con un update directo` | `como(jefeA)`: orden en `listo` → `set estado = 'entregado'` | error de política |
  | `[C-3] el mecánico mueve la orden y añade líneas` | recibido → en_reparacion; insertar línea | 1 fila en cada una |
  | `[C-4] la base de datos rechaza saltos de estado` | recibido → listo | error `TRANSICION_INVALIDA` |
  | `[D-3] toda tabla de public tiene RLS activado` | `pg_class` + `pg_namespace` | `relrowsecurity = true` en las 8 |
  | `[D-3] anon no tiene privilegios sobre tablas de public` | `information_schema.role_table_grants where grantee = 'anon'` | 0 filas |
  | `[D-3] toda tabla de negocio tiene política que usa app.mi_taller` | `pg_policies` | las 7 (todas menos `demo_control`) con `mi_taller` en `qual` o `with_check` |
- **Cambio:** arnés con un test mínimo (`select 1` como `authenticated`) → esquema → tests de aislamiento en rojo → RLS → verde → roles, transiciones y catálogo → ronda de Testing.
- **No hacer:** crear el proyecto en la nube ni `supabase db push` (paso 9); políticas `to public`; `security definer` fuera de `app.mi_taller` y `app.mi_rol`; sembrar dentro de `como`.
- **Verificación:** `npm run gate:rls` → verde con la salida pegada; `npm run check:full` → 0.
- **Para y devuelve ABIERTO si:** PGlite no admite `create role`, `set local role`, `security definer` o disparadores `plpgsql` (decir cuál y el error exacto: el arquitecto decide si se pasa a `supabase start`); una política necesita otra función `security definer`.

#### Paso 6b: Ronda siguiente de base de datos: referencias, precios y nulos (feature `f04-base-datos`)

Cambio de contrato decidido por el arquitecto a partir de los ABIERTO de Develop. Se hace en la rama `paso-6`, editando las migraciones 01 y 02 en su sitio (aún no se han aplicado a ninguna base de datos). Commit `fix(f04-base-datos): <qué> [cambio de contrato]`; Testing lo revisa en la ronda siguiente. Si la ronda 1 de Testing trae fallos propios, se arreglan en el mismo encargo.

- **Cierra:** C-2, C-3 (refuerzo); D-3
- **Archivos:** `supabase/migrations/20261123000001_esquema.sql`, `supabase/migrations/20261123000002_rls.sql`, `tests/bd/arnes.ts` — modificar; `tests/bd/aislamiento.test.ts`, `tests/bd/roles.test.ts`, `tests/bd/catalogo.test.ts` — modificar (añadir casos).
- **Contexto que necesitas:**
  - Hoy las claves ajenas apuntan solo a `id`: el jefe de A inserta una línea de A con un recambio de B, una orden de A con un vehículo de B y un vehículo de A con un cliente de B.
  - Hoy el mecánico puede escribir `precio_hora_centimos` y `entregada_en` en `ordenes` y elegir el `precio_unitario_centimos` de una línea.
  - Faltan `not null` en varias columnas.
  - Se ratifica lo que ya hiciste: el arnés reproduce los permisos por defecto de Supabase (todo concedido a `anon`, `authenticated` y `service_role`) antes de las migraciones; la migración hace `revoke all` a `authenticated` y concede solo lo que usan las políticas; `await` de nivel superior en los tests.
- **Contrato exacto:**
  - **Referencias dentro del taller** (esquema): `unique (taller_id, id)` en `clientes`, `vehiculos`, `recambios` y `ordenes`. Las claves ajenas pasan a ser compuestas y sustituyen a las simples: `vehiculos (taller_id, cliente_id) → clientes (taller_id, id)`; `ordenes (taller_id, vehiculo_id) → vehiculos (taller_id, id)`; `orden_lineas (taller_id, orden_id) → ordenes (taller_id, id) on delete cascade`; `orden_lineas (taller_id, recambio_id) → recambios (taller_id, id)`.
  - **Nulos** (esquema): `not null` en `miembros.taller_id`, `miembros.rol`, `miembros.nombre`, `clientes.nombre`, `vehiculos.cliente_id`, `ordenes.vehiculo_id`, `orden_lineas.orden_id`, `orden_lineas.recambio_id`, `orden_lineas.cantidad`, `orden_lineas.precio_unitario_centimos`, `recambios.precio_centimos`, `recambios.stock` (`default 0`), `recambios.stock_minimo` (`default 0`). Además `check (precio_hora_centimos >= 0)` en `ordenes`.
  - **Precio de la línea lo pone la base de datos** (esquema): disparador `orden_lineas_precio`, `before insert on orden_lineas for each row`: `new.precio_unitario_centimos := (select precio_centimos from public.recambios where id = new.recambio_id and taller_id = new.taller_id)`. Siempre, venga lo que venga en la fila.
  - **Permisos por columna** (RLS), en lugar de permisos sobre la tabla entera para estas dos:
    - `ordenes`: `grant select, delete`; `grant insert (taller_id, vehiculo_id, descripcion)`; `grant update (estado, descripcion, mano_obra_minutos)`. Nadie escribe por API `precio_hora_centimos`, `numero_factura`, `entregada_en`, `creada_en` ni `taller_id`.
    - `orden_lineas`: `grant select, delete`; `grant insert (taller_id, orden_id, recambio_id, cantidad)`; `grant update (cantidad)`.
    - Las políticas no cambian. Las condiciones `estado = 'recibido'` y `numero_factura is null` del `insert` de `ordenes` se mantienen aunque ya no se puedan enviar esas columnas.
  - Arnés: `sembrarDosTalleres` inserta como superusuario (los permisos por columna no le afectan); el precio de sus líneas lo pone el disparador.
- **Tests primero:**
  | Test | Entrada | Resultado esperado |
  |---|---|---|
  | `[C-2] una línea de A no puede usar un recambio de B` | `como(jefeA)`: línea con `taller_id = tallerA`, `orden_id = ordenA`, `recambio_id = recambioB` | error de clave ajena |
  | `[C-2] una orden de A no puede usar un vehículo de B` | `como(jefeA)`: orden con `taller_id = tallerA`, `vehiculo_id = vehiculoB` | error de clave ajena |
  | `[C-2] un vehículo de A no puede colgar de un cliente de B` | `como(jefeA)`: vehículo con `cliente_id = clienteB` | error de clave ajena |
  | `[C-2] tampoco como superusuario se cruzan talleres` | sin `como`: la misma línea con recambio de B | error de clave ajena (la regla es del esquema, no de la política) |
  | `[C-3] nadie escribe el precio por hora ni la fecha de entrega por API` | `como(mecanicoA)` y `como(jefeA)`: `update ordenes set precio_hora_centimos = 0`; `update ordenes set entregada_en = now()` | error de permiso en las cuatro |
  | `[C-3] al crear una orden no se pueden enviar estado, precio ni número` | `como(mecanicoA)`: `insert` con `precio_hora_centimos = 0`; otro con `numero_factura = 'F-1'` | error de permiso en las dos |
  | `[C-3] el precio de la línea lo pone la base de datos` | `como(mecanicoA)`: `insert` de línea sin precio, recambio a 1250 | fila creada con `precio_unitario_centimos = 1250` |
  | `[C-3] nadie elige el precio de una línea` | `como(mecanicoA)`: `insert` con `precio_unitario_centimos = 0`; `update … set precio_unitario_centimos = 0` | error de permiso en las dos |
  | `[D-3] las columnas obligatorias no admiten nulos` | `information_schema.columns` de las 13 columnas del contrato | `is_nullable = 'NO'` en todas |
  | `[D-3] un precio por hora negativo se rechaza` | como superusuario: `update ordenes set precio_hora_centimos = -500` | error de `check` |
- **No hacer:** comprobar el taller de las referencias dentro de las políticas (lo hace el esquema, que también protege a las funciones `security definer`); `force row level security`; ocultar precios al mecánico en la base de datos (lo decide la interfaz).
- **Verificación:** `npm run gate:rls` → verde con la salida pegada; `npm run check:full` → 0.
- **Para y devuelve ABIERTO si:** PGlite no admite `grant` por columna o claves ajenas compuestas; el `on delete cascade` de `talleres` choca con las claves compuestas al borrar un taller (lo necesita `app.sembrar_demo()` del paso 7).

#### Paso 7: Funciones SQL: entregar orden, numeración y demo (feature `f05-funciones`)

Se hace en la misma rama y copia de trabajo que el paso 6, cuando su ronda pase.

- **Cierra:** C-5, C-8 (numeración), C-13 (función)
- **Archivos:**
  - `supabase/migrations/20261123000003_cerrar_orden.sql`, `supabase/migrations/20261123000004_demo.sql`, `tests/bd/cerrar-orden.test.ts`, `tests/bd/restablecer-demo.test.ts` — crear
  - `tests/bd/arnes.ts` — modificar (solo añadir `sembrarUsuariosDemo`)
- **Contexto que necesitas:**
  - `tests/bd/arnes.ts`: `crearBd`, `sembrarDosTalleres`, `como`, tipos `Bd`, `Sql`, `Semilla`.
  - `supabase/migrations/20261123000001_esquema.sql` (tablas, disparador `ordenes_reglas`) y `…02_rls.sql` (`app.mi_taller()`, `app.mi_rol()`).
- **Contrato exacto:**
  - `public.cerrar_orden(p_orden uuid) returns text` — `language plpgsql security definer set search_path = ''`. En este orden: `app.mi_rol()` no es `'jefe'` → `raise exception 'SOLO_JEFE'`; `select … from public.ordenes where id = p_orden and taller_id = app.mi_taller() for update`, sin fila → `'ORDEN_NO_ENCONTRADA'`; estado distinto de `'listo'` → `'ESTADO_INVALIDO'`; por cada línea `update public.recambios set stock = stock - cantidad where id = … and taller_id = <taller de la orden> and stock >= cantidad` (el filtro por taller es obligatorio aunque las claves compuestas ya lo impidan), sin fila afectada → `raise exception 'STOCK_INSUFICIENTE:%', referencia`; número: `update public.talleres set siguiente_factura = siguiente_factura + 1 where id = <taller> returning siguiente_factura - 1` → `'F-' || to_char(now(), 'YYYY') || '-' || lpad(n::text, 4, '0')`; `update public.ordenes set estado = 'entregado', numero_factura = …, entregada_en = now()`; devuelve el número. `revoke all on function … from public, anon; grant execute … to authenticated`.
  - `app.sembrar_demo() returns void` — borra las filas de los dos talleres de demostración (ids fijos `00000000-0000-4000-8000-00000000000a` y `00000000-0000-4000-8000-00000000000b`) y las crea de nuevo:
    - «Talleres Vega» (`…000a`): 6 clientes, 8 vehículos, 10 recambios (exactamente 2 con stock ≤ mínimo), 9 órdenes: 3 `recibido`, 3 `en_reparacion`, 2 `listo`, 1 `entregado` (con `numero_factura = 'F-2026-0001'`; `siguiente_factura = 2`); de 1 a 3 líneas en las que están en reparación, listas o entregadas. Las filas se insertan con su estado final directamente (un `insert` no dispara `ordenes_reglas`).
    - «Mecánica Ribera» (`…000b`): 2 clientes, 2 vehículos, 3 recambios, 2 órdenes `recibido`.
    - `miembros`: busca en `auth.users` por correo `jefe@tallerdemo.example` (jefe, «Marta Vega», taller a), `mecanico@tallerdemo.example` (mecánico, «Iván Soler», taller a), `jefe@otrotaller.example` (jefe, «Raúl Ribera», taller b); si un usuario no existe se salta su fila.
    - Todo inventado: nombres, teléfonos con formato español válido, matrículas con formato actual. Ninguna persona ni empresa real.
  - `public.restablecer_demo() returns text` — `security definer set search_path = ''`: si `demo_control.ultimo_restablecido > now() - interval '10 minutes'` devuelve `'EN_ESPERA'`; si no, `perform app.sembrar_demo()`, guarda `now()` en `demo_control` (insertando la fila si falta) y devuelve `'RESTABLECIDO'`. `revoke all … from public, anon, authenticated; grant execute … to service_role`.
  - Arnés: `export async function sembrarUsuariosDemo(bd: Bd): Promise<{ jefe: string; mecanico: string; jefeOtro: string }>` inserta los tres correos en `auth.users`.
- **Tests primero:**
  | Test | Entrada | Resultado esperado |
  |---|---|---|
  | `[C-5] entregar descuenta el stock de cada línea` | orden `listo` con 2 uds. de un recambio con stock 10; `como(jefeA)`: `select cerrar_orden(…)` | stock 8, estado `entregado`, `entregada_en` no nulo |
  | `[C-5] sin stock suficiente no cambia nada` | una línea con stock de sobra y otra que pide 5 de `FIL-01` con stock 2 | error `STOCK_INSUFICIENTE:FIL-01`; ningún stock cambia; estado `listo`; `siguiente_factura` igual |
  | `[C-3] el mecánico no puede entregar` | `como(mecanicoA)` | error `SOLO_JEFE` |
  | `[C-2] el jefe de A no entrega una orden de B` | `como(jefeA)`: `cerrar_orden(ordenB)` | error `ORDEN_NO_ENCONTRADA`; `ordenB` intacta |
  | `[C-4] solo se entrega desde listo` | orden `recibido` | error `ESTADO_INVALIDO` |
  | `[C-8] la numeración es correlativa por taller` | entregar dos órdenes de A y una de B | A: `F-<año>-0001` y `F-<año>-0002`; B: `F-<año>-0001` |
  | `[C-4] una orden entregada no admite cambios` | como superusuario: `update ordenes set descripcion = 'x'` sobre la entregada | error `ORDEN_CERRADA` |
  | `[C-13] restablecer deja los datos de partida` | usuarios demo; `restablecer_demo()`; borrar órdenes y cambiar stock como superusuario; poner `ultimo_restablecido` 11 minutos atrás; `restablecer_demo()` | `RESTABLECIDO`; 9 órdenes en Talleres Vega repartidas 3/3/2/1; 10 recambios; 3 filas en `miembros` |
  | `[C-13] no se repite antes de 10 minutos` | dos llamadas seguidas | la segunda devuelve `EN_ESPERA` |
  | `[C-13] un usuario normal no puede restablecer` | `como(jefeA)`: `select restablecer_demo()` | error de permiso |
  | `[C-6] la demo tiene dos recambios bajo mínimo` | tras sembrar | exactamente 2 en Talleres Vega con `stock <= stock_minimo` |
- **Cambio:** tests de `cerrar_orden` → función → tests de demo → funciones → ronda de Testing.
- **No hacer:** tocar las migraciones 01 y 02 (si hace falta, ABIERTO); importes en SQL; datos reales.
- **Verificación:** `npm run gate:rls` → verde; `npm run check:full` → 0.
- **Para y devuelve ABIERTO si:** `ordenes_reglas` impide a `cerrar_orden` poner `entregado`; el rol `service_role` del arnés no puede ejecutar la función.

#### Paso 8: Acceso: lógica, clientes de Supabase y cabeceras (feature `f06-acceso`)

- **Cierra:** C-1, C-18; D-4, D-7, D-8, D-14, D-2 (parte)
- **Archivos:**
  - `src/adaptadores/supabase/entorno.ts`, `src/adaptadores/supabase/entorno.test.ts`, `src/adaptadores/supabase/cliente-servidor.ts`, `src/adaptadores/supabase/cliente-secreto.ts`, `src/adaptadores/supabase/sesion.ts` — crear
  - `src/aplicacion/acceso.ts`, `src/aplicacion/acceso.test.ts`, `src/proxy.ts`, `src/cabeceras.ts` — crear; `next.config.ts` — modificar
  - `tests/seguridad/claves.test.ts`, `tests/seguridad/cabeceras.test.ts`, `tests/proceso/normas.test.ts`, `scripts/crear-usuarios-demo.mjs` — crear
- **Contexto que necesitas:**
  - Dependencias ya instaladas: `@supabase/ssr`, `@supabase/supabase-js`, `server-only`, `zod`.
  - En Next 16 el antiguo `middleware.ts` se llama `proxy.ts` y exporta `proxy`. Solo refresca la sesión y redirige; la autorización real es RLS.
  - Tabla `miembros(usuario_id, taller_id, rol, nombre)` y `talleres(id, nombre)`. Aún no hay proyecto en la nube: nada de este paso se prueba contra Supabase real.
  - Variables: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `CRON_SECRET`, `DEMO_PASSWORD`.
- **Contrato exacto:**
  ```ts
  // src/adaptadores/supabase/entorno.ts
  export function leerEntorno(env?: Record<string, string | undefined>): { url: string; clavePublicable: string };
  export function leerEntornoSecreto(env?: Record<string, string | undefined>): { claveSecreta: string; cronSecret: string; demoPassword: string };
  //  zod; variable vacía o ausente → Error(`Falta la variable de entorno ${NOMBRE}`)
  // src/adaptadores/supabase/cliente-servidor.ts
  export async function crearClienteServidor(): Promise<SupabaseClient>;   // createServerClient de @supabase/ssr con las cookies de next/headers
  // src/adaptadores/supabase/cliente-secreto.ts   (primera línea: import 'server-only')
  export function crearClienteSecreto(): SupabaseClient;                   // sin persistencia de sesión
  // src/adaptadores/supabase/sesion.ts
  export type Sesion = { usuarioId: string; tallerId: string; taller: string; rol: 'jefe' | 'mecanico'; nombre: string };
  export async function leerSesion(): Promise<Sesion | null>;              // getUser() + fila de miembros con el nombre del taller, validada con zod
  // src/aplicacion/acceso.ts
  export const RUTAS_PUBLICAS = ['/', '/proceso', '/login'] as const;
  export function decidirAcceso(ruta: string, haySesion: boolean): { tipo: 'pasa' } | { tipo: 'redirige'; a: '/login' | '/tablero' };
  //  sin sesión y ruta ni pública ni `/api/cron/*` → /login; con sesión y ruta '/login' → /tablero; resto pasa
  export const USUARIOS_DEMO = { jefe: 'jefe@tallerdemo.example', mecanico: 'mecanico@tallerdemo.example', otro: 'jefe@otrotaller.example' } as const;
  // src/cabeceras.ts
  export const CABECERAS: { key: string; value: string }[];
  ```
  - `CABECERAS`: `Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`; `X-Content-Type-Options: nosniff`; `Referrer-Policy: strict-origin-when-cross-origin`; `Permissions-Policy: camera=(), microphone=(), geolocation=()`. `next.config.ts` las aplica a `/(.*)` y pone `images: { unoptimized: true }`.
  - `src/proxy.ts`: refresca la sesión con `@supabase/ssr`, llama a `decidirAcceso` y redirige; `matcher` que excluye `_next/static`, `_next/image` y archivos con extensión.
  - `scripts/crear-usuarios-demo.mjs`: con `SUPABASE_URL` y `SUPABASE_SECRET_KEY` del entorno, crea (o, si existen, pone la contraseña a) los tres usuarios de `USUARIOS_DEMO` con `email_confirm: true` y `DEMO_PASSWORD`; después `rpc('restablecer_demo')`. Idempotente. Sale con 1 y mensaje si falta una variable.
- **Tests primero:**
  | Test | Entrada | Resultado esperado |
  |---|---|---|
  | `[C-1] sin sesión las rutas privadas van a /login` | `/tablero`, `/ordenes/abc`, `/recambios` | `{ tipo: 'redirige', a: '/login' }` |
  | `[C-1] las públicas pasan sin sesión` | `/`, `/proceso`, `/login`, `/api/cron/restablecer` | `{ tipo: 'pasa' }` |
  | `[C-1] con sesión /login va al tablero` | `/login`, `true` | `{ tipo: 'redirige', a: '/tablero' }` |
  | `[D-2] falta de una variable da error con su nombre` | `leerEntorno({ SUPABASE_PUBLISHABLE_KEY: 'x' })` | `Error('Falta la variable de entorno SUPABASE_URL')` |
  | `[C-18][D-4] la clave secreta solo se lee en módulos server-only` | recorre `src` buscando `SUPABASE_SECRET_KEY`, `leerEntornoSecreto` y `cliente-secreto` | ningún archivo que los mencione lleva `'use client'`; `cliente-secreto.ts` empieza por `import 'server-only'` |
  | `[C-18][D-4] no hay variables NEXT_PUBLIC` | `src`, `.env.example`, `next.config.ts` | 0 coincidencias de `NEXT_PUBLIC_` |
  | `[C-18] las cabeceras de seguridad están declaradas` | `CABECERAS` | las cuatro; la CSP contiene `frame-ancestors 'none'` y ningún `*` |
  | `[D-7] eslint tiene los límites como error` | `new ESLint().calculateConfigForFile('src/aplicacion/acceso.ts')` | `max-lines`, `max-lines-per-function`, `complexity`, `max-params` en nivel 2 con 300, 50, 10 y 4 |
  | `[D-8] sin atajos en src ni tests` | recorre `src` y `tests` buscando `.skip(`, `.only(`, comentarios que apagan eslint o TypeScript, `: any` y la propiedad de React que inyecta HTML (patrones montados por concatenación para que el test no se encuentre a sí mismo) | 0 coincidencias |
  | `[D-14] eslint prohíbe catch vacío, console y HTML sin escapar` | configuración calculada | `no-empty`, `no-console` y `react/no-danger` en nivel 2 |
- **Cambio:** tests → entorno → `acceso` → clientes y sesión → proxy y cabeceras → script → ronda de Testing.
- **No hacer:** cliente de Supabase para el navegador; páginas (paso 12); crear el proyecto en la nube (paso 9); usar el cliente secreto fuera de restablecer la demo y del script.
- **Verificación:** `npm run check:full` → 0; `npm run build` → compila con el proxy.
- **Para y devuelve ABIERTO si:** Next 16.4.6 no reconoce `src/proxy.ts`; `@supabase/ssr` 0.12.7 cambia la forma de pasar cookies respecto a `getAll`/`setAll`.

#### Paso 8b: Ronda extra de acceso tras la oleada 2 (feature `f06-acceso`)

Cambio de contrato decidido por el arquitecto, no hallazgo de Testing: Develop lo implementa en la rama `paso-8` (commit `fix(f06-acceso): <qué> [cambio de contrato]`) y Testing lo revisa en la ronda siguiente, que registra solo lo que Testing encuentre.

- **Cierra:** C-1, C-18 (refuerzo); D-14
- **Archivos:** `next.config.ts`, `src/cabeceras.ts`, `src/proxy.ts`, `src/adaptadores/supabase/sesion.ts`, `src/adaptadores/supabase/cliente-servidor.ts` — modificar; `src/adaptadores/supabase/tiempo-limite.ts`, `src/adaptadores/supabase/tiempo-limite.test.ts` — crear; `tests/seguridad/cabeceras.test.ts`, `tests/seguridad/claves.test.ts` — modificar (añadir casos).
- **Contexto que necesitas:**
  - `next.config.ts` trae de `create-next-app` las líneas `cacheComponents: true` y `partialPrefetching: true`. Con Cache Components activo no vale `export const dynamic = 'force-static'` (paso 12) y es la pieza del aviso de seguridad de noviembre.
  - `src/adaptadores/supabase/sesion.ts` exporta `refrescarSesion(peticion)` (lo usa `src/proxy.ts`): se mantiene, es la forma correcta de respetar la regla `supabase-solo-en-su-adaptador`.
  - Con Supabase caído, `supabase-js` reintenta unos 25 s antes de fallar.
  - El `matcher` de `src/proxy.ts` excluye toda ruta con un punto.
- **Contrato exacto:**
  ```ts
  // src/adaptadores/supabase/tiempo-limite.ts
  export const LIMITE_MS = 4000;
  export function conTiempoLimite(buscar: typeof fetch, ms?: number): typeof fetch;   // añade AbortSignal.timeout(ms) respetando la señal que ya venga (AbortSignal.any)
  // src/cabeceras.ts
  export function crearCabeceras(esDesarrollo: boolean): { key: string; value: string }[];   // en desarrollo, script-src añade 'unsafe-eval'; en producción, nunca
  export const CABECERAS = crearCabeceras(false);
  ```
  - `next.config.ts`: quitar `cacheComponents` y `partialPrefetching`; `headers()` usa `crearCabeceras(process.env.NODE_ENV !== 'production')`.
  - `crearClienteServidor()` y el cliente que crea `refrescarSesion` pasan `global: { fetch: conTiempoLimite(fetch) }`. `refrescarSesion` y `leerSesion` capturan el error de tiempo agotado o de red y devuelven «sin sesión» (el error no se traga: se relanza todo lo que no sea de red o de tiempo).
  - `matcher` de `src/proxy.ts`: `['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt|xml|woff2)$).*)']` (excluye solo extensiones de archivo estático, no cualquier punto).
- **Tests primero:**
  | Test | Entrada | Resultado esperado |
  |---|---|---|
  | `[D-14] una petición que no responde se corta al llegar al límite` | `conTiempoLimite(fetchQueNuncaResuelve, 50)` | rechaza con un error de nombre `TimeoutError` o `AbortError` en menos de 500 ms |
  | `[D-14] una petición que responde a tiempo pasa intacta` | fetch falso que resuelve con 200 | misma respuesta |
  | `[C-18] en producción la CSP no permite eval` | `crearCabeceras(false)` | la CSP no contiene `unsafe-eval` |
  | `[C-18] en desarrollo la CSP permite eval para que arranque next dev` | `crearCabeceras(true)` | `script-src` contiene `'unsafe-eval'` |
  | `[C-18] next.config no activa Cache Components` | texto de `next.config.ts` | no contiene `cacheComponents` ni `partialPrefetching` |
  | `[C-1] una ruta privada con punto pasa por el proxy` | expresión del `matcher` contra `/ordenes/a.b` y contra `/logo.svg` | casa la primera, no la segunda |
- **No hacer:** quitar el bloque `turbopack` de `next.config.ts`; bajar el límite por debajo de 4000 ms; capturar errores que no sean de red o de tiempo.
- **Verificación:** `npm run check:full` → 0; `npm run build` → compila.
- **Para y devuelve ABIERTO si:** al quitar `partialPrefetching` el build avisa de otra opción dependiente; `AbortSignal.any` no existe en el runtime del proxy.

#### Paso 9: Proyecto de Supabase en la nube

- **Cierra:** P-10 (parte: plan Free), amenaza «Alta de usuarios»
- **Archivos:** `.env.local` — crear en local, **nunca** al repo; `scripts/comprobar-nube.mjs` — crear (versionado, sin claves).
- **Contexto que necesitas:**
  - El CLI de Supabase tiene sesión en la organización personal `donpapaya14's Org`, id `<id-organizacion>`. Tiene un proyecto en pausa (`<proyecto-en-pausa>`) que no se toca. **Nunca** otra organización.
  - En `main` ya están integradas las cuatro migraciones (`supabase/migrations/2026112300000{1,2,3,4}_*.sql`), `supabase/config.toml` con `enable_signup = false` y `scripts/crear-usuarios-demo.mjs`.
  - Crear un proyecto en una organización de pago cuesta dinero cada mes; en Free, nada.
- **Contrato exacto**, en este orden:
  1. Confirmar el plan: `supabase orgs list -o json` y, si no trae el plan, consultar `GET https://api.supabase.com/v1/organizations/<id-organizacion>` con el token del CLI. Tiene que decir `free`. Si dice otra cosa o no se puede saber: **parar** y ABIERTO.
  2. `supabase projects create taller-agentes --org-id <id-organizacion> --region eu-west-1 --db-password "<openssl rand -base64 24>"`. La contraseña va solo a `.env.local` como `SUPABASE_DB_PASSWORD`.
  3. `supabase link --project-ref <ref>` → `supabase db push` → `supabase config push`.
  4. `supabase projects api-keys --project-ref <ref>` → `.env.local` con `SUPABASE_URL=https://<ref>.supabase.co`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `CRON_SECRET=<openssl rand -hex 32>`, `DEMO_PASSWORD=<palabras legibles + cifras, 16 caracteres o más, p. ej. foso-taller-2026-demo>`.
  5. `node --env-file=.env.local scripts/crear-usuarios-demo.mjs`.
- **Tests primero:** no aplica (infraestructura). La prueba es la verificación.
- **No hacer:** tocar el proyecto en pausa; activar complementos, ramas o cambiar el tamaño de cómputo; escribir claves en archivos versionados o en el informe (se citan por nombre, no por valor).
- **Comprobación de permisos en la nube** (en Supabase el dueño de las tablas es `postgres`, que no es superusuario, y los permisos por defecto no son los de PGlite): `scripts/comprobar-nube.mjs` lee `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` y `DEMO_PASSWORD` del entorno y, **solo con la clave publicable**, comprueba e imprime `OK`/`FALLO` por línea (sale con 1 si hay algún `FALLO`): (1) sin sesión, `select` en `ordenes` → 0 filas o error de permiso; (2) sin sesión, `rpc('cerrar_orden')` y `rpc('restablecer_demo')` → error de permiso; (3) el jefe de demostración entra y ve 9 órdenes y 10 recambios (prueba que `app.mi_taller()` lee `miembros` siendo `security definer`); (4) ese jefe no ve ninguna fila con el `taller_id` del otro taller y `rpc('restablecer_demo')` le da error de permiso; (5) el mecánico: `update recambios set stock = 0` → 0 filas, y `rpc('cerrar_orden')` sobre una orden en «Listo» → `SOLO_JEFE`; (6) el jefe del otro taller ve 2 órdenes. Ninguna comprobación deja datos cambiados.
- **Verificación:** `node --env-file=.env.local scripts/comprobar-nube.mjs` → todo `OK`, con la salida pegada; `supabase migration list` → las 4 aplicadas en remoto; con el cliente secreto, `select count(*) from ordenes` → 11 (9 + 2); una petición de alta (`auth.signUp`) con la clave publicable → rechazada por registro desactivado; `git status --short` → no aparece `.env.local`; `supabase projects list` → dos proyectos en la organización personal, el nuevo `ACTIVE_HEALTHY`.
- **Para y devuelve ABIERTO si:** el plan no es Free; `projects create` pide confirmar un pago o dice que no caben más proyectos; `config push` no desactiva el registro (lo hace Vladys en Authentication → Sign In / Providers); las claves tienen un formato que `@supabase/ssr` rechaza.

#### Paso 10: Órdenes y recambios: casos de uso y repositorios (feature `f07-ordenes-recambios`)

- **Cierra:** C-11, C-4 y C-5 (casos de uso), C-3 (caso de uso); D-2, D-14
- **Archivos** (nuevos):
  - `src/adaptadores/supabase/filas.ts`, `src/adaptadores/supabase/filas.test.ts`, `src/adaptadores/supabase/ordenes.ts`, `src/adaptadores/supabase/recambios.ts`
  - `src/aplicacion/nueva-orden.ts`, `src/aplicacion/mover-orden.ts`, `src/aplicacion/cerrar-orden.ts`, `src/aplicacion/recambios.ts`, `src/aplicacion/lineas.ts`, cada uno con su `.test.ts`
- **Contexto que necesitas:**
  - `src/nucleo/orden.ts` (`Estado`, `puedeTransicionar`), `src/nucleo/permisos.ts` (`Rol`, `puede`), `src/nucleo/matricula.ts` (`normalizarMatricula`), `src/nucleo/whatsapp.ts` (`normalizarTelefono`), `src/nucleo/importe.ts` (`eurosACentimos`).
  - `src/adaptadores/supabase/cliente-servidor.ts`: `crearClienteServidor()` (cliente con la sesión del usuario; RLS filtra por taller). `sesion.ts`: `leerSesion()` da `tallerId`.
  - SPEC, «Modelo de datos». Función `public.cerrar_orden(p_orden uuid) returns text` con errores `SOLO_JEFE`, `ORDEN_NO_ENCONTRADA`, `ESTADO_INVALIDO`, `STOCK_INSUFICIENTE:<referencia>`.
  - `src/ui/tablero/Tablero.tsx` exporta `OrdenTablero` en otra rama; **no** lo importes (los adaptadores no importan de `ui`): define aquí la forma de los datos y la pantalla los adaptará.
- **Contrato exacto:**
  ```ts
  // src/adaptadores/supabase/filas.ts — esquemas zod estrictos de lo que vuelve de la base de datos
  export const filaOrdenResumen: z.ZodType<OrdenResumen>;   // { id, estado, descripcion, matricula, vehiculo: `${marca} ${modelo}`, cliente, entregadaEn: string | null }
  export const filaOrdenDetalle: z.ZodType<OrdenDetalle>;   // OrdenResumen + { clienteTelefono, marca, modelo, manoObraMinutos, precioHoraCentimos, numeroFactura, creadaEn,
                                                            //   lineas: { id, recambioId, referencia, nombre, cantidad, precioUnitarioCentimos }[] }
  export const filaRecambio: z.ZodType<Recambio>;           // { id, referencia, nombre, precioCentimos, stock, stockMinimo }
  // src/adaptadores/supabase/ordenes.ts
  export async function listarOrdenes(): Promise<OrdenResumen[]>;             // las entregadas, solo las de los últimos 7 días
  export async function leerOrden(id: string): Promise<OrdenDetalle | null>;
  export async function listarVehiculos(): Promise<{ id: string; matricula: string; etiqueta: string }[]>;
  export async function crearOrden(d: DatosOrden, tallerId: string): Promise<{ id: string }>;   // crea cliente y vehículo si vienen nuevos
  export async function cambiarEstado(id: string, de: Estado, a: Estado): Promise<boolean>;     // update … where id and estado = de; false si no afectó fila
  export async function guardarManoObra(id: string, minutos: number): Promise<boolean>;
  export async function anadirLinea(d: { ordenId: string; recambioId: string; cantidad: number; tallerId: string }): Promise<boolean>;  // no envía precio: lo pone el disparador `orden_lineas_precio`
  export async function quitarLinea(lineaId: string): Promise<boolean>;
  export async function rpcCerrar(id: string): Promise<{ numero: string } | { error: string }>;  // error = mensaje de la excepción de Postgres
  // src/adaptadores/supabase/recambios.ts
  export async function listarRecambios(): Promise<Recambio[]>;
  export async function guardarRecambio(d: DatosRecambio & { id?: string }, tallerId: string): Promise<boolean>;
  // src/aplicacion/nueva-orden.ts
  export type DatosOrden = { descripcion: string } & ({ vehiculoId: string } | { matricula: string; marca: string; modelo: string; clienteNombre: string; clienteTelefono: string });
  export type Errores = Record<string, string>;
  export function validarNuevaOrden(entrada: unknown): { ok: true; datos: DatosOrden } | { ok: false; errores: Errores };
  // src/aplicacion/mover-orden.ts
  export type Resultado = { ok: true } | { ok: false; motivo: string };
  export async function moverOrden(d: { id: string; de: Estado; a: Estado }, puerto: { cambiarEstado: (id: string, de: Estado, a: Estado) => Promise<boolean> }): Promise<Resultado>;
  // src/aplicacion/cerrar-orden.ts
  export function traducirErrorCierre(mensaje: string): string;
  export async function cerrarOrden(d: { id: string; rol: Rol }, puerto: { rpcCerrar: (id: string) => Promise<{ numero: string } | { error: string }> }): Promise<{ ok: true; numeroFactura: string } | { ok: false; motivo: string }>;
  // src/aplicacion/recambios.ts
  export type DatosRecambio = { referencia: string; nombre: string; precioCentimos: number; stock: number; stockMinimo: number };
  export function validarRecambio(entrada: unknown): { ok: true; datos: DatosRecambio } | { ok: false; errores: Errores };
  // src/aplicacion/lineas.ts
  export function validarLinea(entrada: unknown): { ok: true; datos: { recambioId: string; cantidad: number } } | { ok: false; errores: Errores };
  export function validarManoObra(entrada: unknown): { ok: true; minutos: number } | { ok: false; errores: Errores };   // entero 0..6000
  ```
  - Mensajes de `validarNuevaOrden` (clave = campo): `matricula` «Matrícula no válida. Ejemplo: 1234 BCD»; `clienteTelefono` «Teléfono no válido. Nueve cifras, por ejemplo 612 345 678»; `descripcion` (menos de 5 o más de 500 caracteres) «Describe la avería o el trabajo (entre 5 y 500 letras)»; `clienteNombre` «Falta el nombre del cliente»; `marca` «Falta la marca»; `modelo` «Falta el modelo»; `vehiculoId` «Elige un vehículo». La salida lleva la matrícula y el teléfono ya normalizados.
  - `moverOrden`: transición no permitida → «Ese cambio de estado no está permitido» (sin llamar al puerto); `a === 'entregado'` → «Entregar se hace desde la ficha de la orden»; el puerto devuelve `false` → «Otra persona ya movió esta orden. Recarga el tablero».
  - `traducirErrorCierre`: `SOLO_JEFE` → «Solo el jefe de taller puede entregar una orden»; `ESTADO_INVALIDO` → «La orden tiene que estar en «Listo» para entregarla»; `STOCK_INSUFICIENTE:FIL-01` → «No hay stock suficiente de FIL-01. Revisa el almacén antes de entregar»; `ORDEN_NO_ENCONTRADA` → «No encontramos esa orden»; cualquier otro → «No se pudo entregar la orden. Inténtalo de nuevo». `cerrarOrden` con `rol: 'mecanico'` devuelve el motivo de solo jefe sin llamar al puerto.
  - `validarRecambio`: referencia 2 a 20 caracteres (se devuelve en mayúsculas) «La referencia tiene entre 2 y 20 caracteres»; nombre 2 a 80 «Falta el nombre del recambio»; precio escrito en euros, convertido con `eurosACentimos`, «Precio no válido. Ejemplo: 12,50»; stock y mínimo enteros ≥ 0 «Tiene que ser un número entero, cero o más».
  - `validarLinea`: cantidad entera 1 a 999 «La cantidad va de 1 a 999»; `recambioId` uuid «Elige un recambio».
- **Tests primero:**
  | Test | Entrada | Resultado esperado |
  |---|---|---|
  | `[C-11] acepta vehículo existente con descripción` | `{ vehiculoId: <uuid>, descripcion: 'Cambio de aceite' }` | `ok: true` |
  | `[C-11] acepta vehículo y cliente nuevos y normaliza` | matrícula `'1234 bcd'`, teléfono `'612 345 678'`, resto válido | `ok: true`, `'1234BCD'`, `'34612345678'` |
  | `[C-11][D-2] explica cada error junto a su campo` | matrícula `'12'`, teléfono `'1'`, descripción `'a'`, nombre `''` | los cuatro mensajes literales en sus claves |
  | `[C-11][D-2] rechaza entrada que no es un objeto` | `null`; `'x'` | `ok: false` |
  | `[C-4] mover a un estado no contiguo no llega a la base de datos` | `recibido` → `listo` | motivo literal; el puerto no se llama |
  | `[C-4] mover a entregado se rechaza` | `listo` → `entregado` | «Entregar se hace desde la ficha de la orden» |
  | `[C-4][D-14] si la orden ya cambió, lo dice` | puerto → `false` | «Otra persona ya movió esta orden. Recarga el tablero» |
  | `[C-5][D-14] traduce cada error de la base de datos` | los cinco mensajes | los cinco textos literales |
  | `[C-3] el mecánico no llega a la base de datos al entregar` | `rol: 'mecanico'` | `ok: false`; el puerto no se llama |
  | `[C-5] entrega correcta devuelve el número` | puerto → `{ numero: 'F-2026-0002' }` | `{ ok: true, numeroFactura: 'F-2026-0002' }` |
  | `[D-2] valida el recambio y explica los errores` | referencia `'a'`, precio `'12,505'`, stock `-1` | errores en `referencia`, `precio` y `stock` |
  | `[D-2] valida líneas y mano de obra` | cantidad 0; minutos 7000; minutos `'abc'` | `ok: false` en las tres |
  | `[D-2] una fila de orden con estado desconocido se rechaza` | `filaOrdenResumen.safeParse({ …, estado: 'roto' })` | `success: false` |
  | `[D-2] una fila de recambio con stock negativo o texto se rechaza` | `stock: -1`; `stock: '3'` | `success: false` |
- **Cambio:** tests → casos de uso → esquemas de fila → repositorios → ronda de Testing.
- **No hacer:** páginas, acciones de servidor o componentes (pasos 13 y 14); importar de `src/ui`; recalcular importes aquí.
- **Verificación:** `npm run check:full` → 0. Los repositorios se prueban contra la base de datos real en el paso 13; aquí quedan cubiertos por tipos y por los esquemas de fila (si la cobertura de `src/adaptadores/supabase` baja el umbral global, ABIERTO: no se toca el umbral).
- **Para y devuelve ABIERTO si:** la consulta con relaciones anidadas de PostgREST no devuelve la forma que el esquema espera; hace falta una columna que no existe.

#### Paso 11: PDF, restablecer demo y cron (feature `f08-documentos-demo`)

- **Cierra:** C-8 (PDF), C-13 (ruta y caso de uso); D-14
- **Archivos** (nuevos):
  - `src/adaptadores/pdf/generar.ts`, `src/adaptadores/pdf/generar.test.ts`
  - `src/aplicacion/restablecer-demo.ts`, `src/aplicacion/restablecer-demo.test.ts`
  - `src/adaptadores/supabase/demo.ts`
  - `src/app/api/cron/restablecer/route.ts`, `src/app/api/cron/restablecer/route.test.ts`
- **Contexto que necesitas:**
  - `src/nucleo/documento.ts`: tipo `DocumentoOrden` (`titulo`, `numero`, `cabecera`, `cliente`, `vehiculo`, `fecha`, `descripcion`, `filas`, `totales`, `leyenda`).
  - `pdf-lib` instalado; fuente estándar Helvetica (WinAnsi: admite tildes, ñ y €; no admite espacios finos).
  - `public.restablecer_demo() returns text` (`'RESTABLECIDO'` | `'EN_ESPERA'`), solo ejecutable con la clave secreta. `src/adaptadores/supabase/cliente-secreto.ts`: `crearClienteSecreto()`. `src/adaptadores/supabase/entorno.ts`: `leerEntornoSecreto()` → `{ cronSecret, demoPassword }`. `src/aplicacion/acceso.ts`: `USUARIOS_DEMO`.
  - Vercel envía `Authorization: Bearer <CRON_SECRET>` a las rutas de cron.
- **Contrato exacto:**
  ```ts
  // src/adaptadores/pdf/generar.ts
  export async function generarPdf(documento: DocumentoOrden): Promise<Uint8Array>;
  //  A4 vertical; título grande arriba a la izquierda, número a la derecha; datos del taller, cliente y vehículo;
  //  tabla de filas; totales a la derecha; leyenda al pie de cada página. Si las filas no caben, sigue en páginas nuevas.
  // src/aplicacion/restablecer-demo.ts
  export type ResultadoRestablecer = { estado: 'RESTABLECIDO' | 'EN_ESPERA' } | { estado: 'ERROR'; motivo: string };
  export async function restablecerDemo(puerto: { rpcRestablecer: () => Promise<string>; reponerContrasenas: () => Promise<void> }): Promise<ResultadoRestablecer>;
  //  si rpcRestablecer devuelve 'RESTABLECIDO' llama a reponerContrasenas; cualquier excepción o valor inesperado → { estado: 'ERROR', motivo: 'No se pudo restablecer la demo' }
  export function autorizado(cabecera: string | null, secreto: string): boolean;   // compara `Bearer ${secreto}` en tiempo constante
  // src/adaptadores/supabase/demo.ts   (import 'server-only')
  export async function rpcRestablecer(): Promise<string>;
  export async function reponerContrasenas(): Promise<void>;   // pone DEMO_PASSWORD a los tres usuarios de USUARIOS_DEMO con la API de administración
  // src/app/api/cron/restablecer/route.ts
  export async function GET(peticion: Request): Promise<Response>;
  //  no autorizado → 401 { error: 'No autorizado' } sin llamar al caso de uso; autorizado → 200 { estado } (500 si ERROR)
  ```
- **Tests primero:**
  | Test | Entrada | Resultado esperado |
  |---|---|---|
  | `[C-8] genera un PDF válido de una página` | documento con 3 filas | los bytes empiezan por `%PDF-`; `PDFDocument.load` → 1 página |
  | `[C-8] con 60 filas pagina` | 60 filas | 2 páginas o más |
  | `[C-8] admite tildes, eñes y el símbolo del euro` | cliente «Peña Muñoz», importes con € | no lanza |
  | `[C-13] sin cabecera responde 401` | `GET` sin `Authorization` | 401, `{ error: 'No autorizado' }` |
  | `[C-13] con secreto incorrecto responde 401` | `Bearer otro` | 401 |
  | `[C-13] autorizado compara el secreto completo` | `'Bearer abc'` con `abc`; `'Bearer ab'`; `null`; `'abc'` | `true`; `false`; `false`; `false` |
  | `[C-13] solo repone contraseñas si se restableció` | puerto → `'EN_ESPERA'` | `reponerContrasenas` no se llama; `{ estado: 'EN_ESPERA' }` |
  | `[C-13] restablecido repone contraseñas` | puerto → `'RESTABLECIDO'` | se llama una vez; `{ estado: 'RESTABLECIDO' }` |
  | `[C-13][D-14] si la base de datos falla devuelve ERROR con mensaje` | puerto que lanza | `{ estado: 'ERROR', motivo: 'No se pudo restablecer la demo' }` |
- **Cambio:** tests → generador → caso de uso → adaptador → ruta → ronda de Testing.
- **No hacer:** fuentes incrustadas ni logotipos; guardar el PDF; exponer `restablecer_demo` a usuarios; la ruta del PDF y el enlace de `/login` (pasos 13 y 15).
- **Verificación:** `npm run check:full` → 0.
- **Para y devuelve ABIERTO si:** `pdf-lib` no carga en el runtime de Node de Next 16; el test de la ruta necesita importar `server-only` y vitest no lo resuelve (se soluciona con un alias en `vitest.config.ts`, que es del paso 1: ABIERTO).

#### Paso 12: Pantallas de acceso, armazón y `/proceso` (feature `f09-pantallas-acceso`)

Requiere el OK de Vladys al gate de diseño.

- **Cierra:** C-12 (pantalla), C-15, C-1 (pantalla); D-11
- **Archivos:**
  - `src/app/page.tsx` — modificar; `src/app/login/page.tsx`, `src/app/login/acciones.ts`, `src/app/(taller)/layout.tsx`, `src/app/(taller)/loading.tsx`, `src/app/(taller)/error.tsx`, `src/app/proceso/page.tsx` — crear
  - `src/ui/Navegacion.tsx`, `src/ui/proceso/LineaDeRondas.tsx`, `src/ui/proceso/LineaDeRondas.test.tsx`, `src/ui/proceso/TresAgentes.tsx` — crear
  - `tests/diseno/estados.test.ts` — crear
- **Contexto que necesitas:**
  - SPEC, «Diseño → Pantallas», puntos 1 y 6. Sistema visual hecho: `src/ui/tokens.css`, `src/ui/fuentes.ts`, `src/ui/Boton.tsx` (`variante`), `src/ui/EstadoVacio.tsx` (`texto`), `src/ui/iconos.tsx`.
  - `src/adaptadores/proceso/leer-rondas.ts`: `leerProceso(directorio)`, `resumir(features)`, tipo `FeatureConRondas` (feature + `rondas: Ronda[]`; cada `Ronda` con `ronda`, `veredicto`, `fallos[]`, `commitRevisado`, `fecha`).
  - `src/adaptadores/supabase/sesion.ts`: `leerSesion()`; `cliente-servidor.ts`: `crearClienteServidor()`; `src/aplicacion/acceso.ts`: `USUARIOS_DEMO`; `entorno.ts`: `leerEntornoSecreto().demoPassword`.
  - `.env.local` con las claves del proyecto en la nube (cópialo a tu copia de trabajo desde `<raiz-del-repo>/.env.local`).
- **Contrato exacto:**
  ```ts
  // src/app/login/acciones.ts  ('use server')
  export async function entrar(estadoPrevio: { error: string | null }, datos: FormData): Promise<{ error: string | null }>;   // signInWithPassword; error → 'Correo o contraseña incorrectos'
  export async function entrarComoDemo(datos: FormData): Promise<void>;   // campo `rol`: 'jefe' | 'mecanico'; usa DEMO_PASSWORD en el servidor; redirige a /tablero
  export async function salir(): Promise<void>;
  // src/ui/proceso/LineaDeRondas.tsx
  export function LineaDeRondas(props: { feature: FeatureConRondas; urlRepo: string }): JSX.Element;
  // src/ui/Navegacion.tsx
  export function Navegacion(props: { taller: string; nombre: string; rol: 'jefe' | 'mecanico'; accionSalir: () => Promise<void> }): JSX.Element;
  ```
  - `/login`: titular «FOSO»; campos «Correo» y «Contraseña»; botón «Entrar»; debajo, «Entrar como jefe» y «Entrar como mecánico».
  - `/`: con sesión redirige a `/tablero`; sin sesión, el nombre, la frase «Gestión de taller: órdenes, recambios y facturas. La construyeron tres agentes.» y dos enlaces: «Entrar» y «Cómo se construyó».
  - `(taller)/layout.tsx`: llama a `leerSesion()` y sin sesión redirige a `/login` (no se fía del proxy). `Navegacion`: enlaces «Tablero» y «Recambios», nombre del taller, nombre y rol («Jefe de taller» / «Mecánico»), «Salir». En móvil, barra inferior fija con icono y texto. `loading.tsx`: «Cargando el taller…». `error.tsx`: «Algo ha fallado al cargar esta pantalla» y botón «Reintentar».
  - `/proceso`: `export const dynamic = 'force-static'`; `leerProceso(path.join(process.cwd(), 'proceso'))`; `urlRepo = 'https://github.com/donpapaya14/taller-agentes'`. Titular «Cómo se construyó». Entrada de dos frases: quién reparte, quién programa, quién revisa, y que lo de abajo son los informes reales de cada revisión. `TresAgentes`: tres bloques (Orquestador, Develop, Testing), una frase cada uno y enlace a su archivo (`${urlRepo}/blob/main/CLAUDE.md`, `…/.claude/agents/develop.md`, `…/.claude/agents/testing.md`, y `…/DIRECTRICES.md`). Una línea con las cifras de `resumir` («12 features · 19 rondas · 23 fallos corregidos», con los números reales). Después, una `LineaDeRondas` por feature.
  - `LineaDeRondas`: título y resumen de la feature; una pieza por ronda: `FALLA` en `--averia` con «N fallos» («1 fallo» en singular), `PASA` en `--testigo` con «Pasa». Cada pieza es un `<details>` nativo: dentro, por cada fallo, la directriz, la descripción, el archivo y la evidencia en `--fuente-dato`; el commit enlaza a `${urlRepo}/commit/<hash>`. Sin rondas: «Todavía sin revisar».
- **Tests primero:**
  | Test | Entrada | Resultado esperado |
  |---|---|---|
  | `[C-12] dibuja una pieza por ronda con su veredicto y los fallos dentro` | feature con FALLA (2 fallos) y PASA | «2 fallos», «Pasa», las dos directrices, la evidencia y el enlace al commit |
  | `[C-12] usa el singular con un solo fallo` | FALLA con 1 fallo | «1 fallo» |
  | `[C-15][D-11] una feature sin rondas muestra su estado vacío` | `rondas: []` | «Todavía sin revisar» |
  | `[C-15][D-11] cada pantalla privada tiene carga y error` | `src/app/(taller)/**/page.tsx` | junto a cada una, o en un segmento padre dentro de `(taller)`, existen `loading.tsx` y `error.tsx`; y existen los de `(taller)` |
- **Cambio:** tests → componentes de proceso y página → login y acciones → armazón → portada → ronda de Testing.
- **No hacer:** contadores animados ni gráficos; JavaScript de cliente en `/proceso`; páginas de tablero, órdenes o recambios; el enlace de restablecer (paso 15).
- **Verificación:** `npm run check:full` → 0; `npm run build` → `/proceso` sale como estática (○); con `npm run dev` lanzado por la sesión principal, «Entrar como jefe» lleva a `/tablero` (dará 404 hasta el paso 13: vale) con sesión iniciada, y «Salir» vuelve a `/login`.
- **Para y devuelve ABIERTO si:** `force-static` no deja leer `proceso/` con `node:fs` en el build; la sesión no persiste tras `entrarComoDemo` (cookies).

#### Paso 13: Pantallas de tablero, nueva orden y ficha (feature `f10-pantallas-ordenes`)

- **Cierra:** C-10, C-9 (pantalla), C-5, C-7, C-8, C-3 (pantalla), C-15
- **Archivos:**
  - `src/app/(taller)/tablero/page.tsx`, `src/app/(taller)/tablero/acciones.ts`, `src/app/(taller)/ordenes/nueva/page.tsx`, `src/app/(taller)/ordenes/nueva/acciones.ts`, `src/app/(taller)/ordenes/[id]/page.tsx`, `src/app/(taller)/ordenes/[id]/acciones.ts`, `src/app/(taller)/ordenes/[id]/documento/route.ts` — crear
  - `src/ui/ordenes/FormularioOrden.tsx`, `src/ui/ordenes/LineasOrden.tsx`, `src/ui/ordenes/Totales.tsx`, `src/ui/ordenes/AccionesOrden.tsx`, `src/ui/ordenes/AccionesOrden.test.tsx`, `src/ui/ordenes/LineasOrden.test.tsx` — crear
  - `src/app/muestra/page.tsx`, `src/ui/tablero/muestra.ts` — borrar (los datos que use `Tablero.test.tsx` pasan al propio test)
- **Contexto que necesitas:**
  - `src/ui/tablero/Tablero.tsx`: `Tablero({ ordenes: OrdenTablero[], puedeEntregar, accionAvanzar })`; cada tarjeta envía un `FormData` con `id` y `de`. `src/ui/Matricula.tsx`, `Boton.tsx`, `EstadoVacio.tsx`.
  - Repositorios en `src/adaptadores/supabase/ordenes.ts`: `listarOrdenes`, `leerOrden`, `listarVehiculos`, `crearOrden`, `cambiarEstado`, `guardarManoObra`, `anadirLinea`, `quitarLinea`, `rpcCerrar`; en `recambios.ts`: `listarRecambios`. Tipos `OrdenResumen`, `OrdenDetalle`, `Recambio` en `filas.ts`.
  - Casos de uso: `validarNuevaOrden`, `moverOrden`, `cerrarOrden`, `validarLinea`, `validarManoObra` (`src/aplicacion/*`). `restablecer` no se usa aquí.
  - Núcleo: `siguienteEstado`, `anteriorEstado`, `ETIQUETA_ESTADO`, `puede`, `calcularTotales`, `formatearEuros`, `bajoMinimo`, `enlaceAviso`, `construirDocumento`. PDF: `generarPdf(documento)`.
  - `leerSesion()` da `rol`, `taller` y `tallerId`. Para el PDF hacen falta los datos del taller (`talleres`: nombre, nif, dirección, teléfono): léelos con el cliente de servidor dentro de `route.ts` validando con zod.
- **Contrato exacto:**
  ```ts
  // src/ui/ordenes/AccionesOrden.tsx
  export function AccionesOrden(props: { ordenId: string; enlaceWhatsapp: string | null; tipoDocumento: 'presupuesto' | 'factura';
    puedeVerDocumento: boolean; puedeEntregar: boolean; accionEntregar: (datos: FormData) => Promise<void> }): JSX.Element;
  // src/ui/ordenes/LineasOrden.tsx
  export function LineasOrden(props: { lineas: LineaVista[]; verImportes: boolean; editable: boolean }): JSX.Element;   // vacío: «Sin recambios todavía»
  ```
  - `/tablero`: convierte `OrdenResumen` en `OrdenTablero`; botón «Nueva orden» (acción principal); para el jefe, encima del tablero, «N recambios bajo mínimo» («1 recambio bajo mínimo») enlazado a `/recambios` cuando N > 0. `accionAvanzar` llama a `moverOrden` y revalida la ruta; si no va bien, el motivo se muestra encima del tablero.
  - `/ordenes/nueva`: `FormularioOrden` con selector «Vehículo» (existentes más la opción «Vehículo nuevo», que despliega matrícula, marca, modelo, nombre y teléfono del cliente) y «Qué hay que hacer»; la matrícula escrita se dibuja con `Matricula`. Errores de `validarNuevaOrden` junto a cada campo. Al crear, redirige a la ficha.
  - `/ordenes/[id]`: placa grande, vehículo, cliente, etiqueta de estado, descripción; botones de avanzar y retroceder según `siguienteEstado`/`anteriorEstado` (nunca a entregado); «Recambios» con `LineasOrden` y, si la orden no está entregada, formulario para añadir línea (recambio + cantidad) y campo de mano de obra en minutos; `Totales` (base, IVA, total) solo si `puede(rol, 'ver_importes')`; `AccionesOrden`. Orden inexistente o de otro taller: `notFound()`.
  - `AccionesOrden`: enlace «Avisar por WhatsApp» (`target="_blank" rel="noopener noreferrer"`); con `enlaceWhatsapp: null`, botón desactivado y el texto «El cliente no tiene un teléfono válido»; «Descargar presupuesto» o «Descargar factura» si `puedeVerDocumento`; «Entregar» si `puedeEntregar`, con el aviso «Se descontarán los recambios del almacén y se emitirá la factura». El resultado de `cerrarOrden` (número de factura o motivo) se muestra en la ficha.
  - `GET /ordenes/[id]/documento`: sin sesión → redirige a `/login`; mecánico → 403 «Solo el jefe de taller puede descargar este documento»; orden inexistente → 404; si no, `construirDocumento` + `generarPdf` con `Content-Type: application/pdf` y `Content-Disposition: inline; filename="presupuesto-<matricula>.pdf"` o `factura-<numero>.pdf`.
- **Tests primero:**
  | Test | Entrada | Resultado esperado |
  |---|---|---|
  | `[C-9] con enlace muestra el aviso que abre en otra pestaña` | `enlaceWhatsapp: 'https://wa.me/34612345678?text=Hola'` | enlace con ese `href`, `target="_blank"` y `rel` con `noopener` |
  | `[C-9] sin teléfono válido el botón está desactivado y dice por qué` | `enlaceWhatsapp: null` | botón `disabled` y el texto del motivo |
  | `[C-3] sin permiso no hay descarga ni entrega` | `puedeVerDocumento: false`, `puedeEntregar: false` | no existen «Descargar…» ni «Entregar» |
  | `[C-8] el texto de descarga depende del tipo` | `tipoDocumento: 'factura'` | «Descargar factura» |
  | `[C-15][D-11] una orden sin líneas muestra su estado vacío` | `lineas: []` | «Sin recambios todavía» |
  | `[C-3] el mecánico no ve precios en las líneas` | `verImportes: false` | no aparece ningún «€» |
- **Cambio:** tests → componentes → tablero → nueva orden → ficha y acciones → ruta del PDF → borrar `/muestra` → ronda de Testing.
- **Obligatorio en cada página, acción y ruta de este paso:** empezar por `leerSesion()` y, si devuelve `null`, `redirect('/login')` (en acciones y en la ruta del PDF, antes de tocar datos). El proxy es comodidad, no la barrera.
- **No hacer:** tocar `src/app/(taller)/recambios` ni `src/ui/recambios` (otra rama); páginas de clientes o vehículos; componentes de cliente salvo el formulario de nueva orden y el selector de columna.
- **Verificación:** `npm run check:full` → 0; con `npm run dev` (sesión principal): como mecánico, crear una orden con vehículo nuevo y pasarla a «En reparación»; como jefe, añadir dos líneas a una orden en «Listo», abrir el PDF (Presupuesto), entregar, ver el número de factura y abrir el PDF (Factura). Al acabar, `node --env-file=.env.local scripts/crear-usuarios-demo.mjs` no restablece si han pasado menos de 10 minutos: anotar la hora.
- **Para y devuelve ABIERTO si:** la política de `ordenes` rechaza el cambio de estado del mecánico; `supabase.rpc('cerrar_orden')` no devuelve el texto de la excepción; `pdf-lib` falla en la ruta.

#### Paso 14: Pantalla de recambios (feature `f11-pantalla-recambios`)

- **Cierra:** C-6, C-3 (pantalla), C-15
- **Archivos** (nuevos): `src/app/(taller)/recambios/page.tsx`, `src/app/(taller)/recambios/acciones.ts`, `src/ui/recambios/ListaRecambios.tsx`, `src/ui/recambios/ListaRecambios.test.tsx`, `src/ui/recambios/FormularioRecambio.tsx`
- **Contexto que necesitas:**
  - `src/adaptadores/supabase/recambios.ts`: `listarRecambios(): Promise<Recambio[]>` (`{ id, referencia, nombre, precioCentimos, stock, stockMinimo }`), `guardarRecambio(datos, tallerId)`.
  - `src/aplicacion/recambios.ts`: `validarRecambio(entrada)` con errores por campo. Núcleo: `bajoMinimo`, `formatearEuros`, `puede(rol, 'editar_recambios')`. `leerSesion()`.
  - SPEC, «Diseño → Pantallas», punto 5. Componentes: `Boton`, `EstadoVacio`.
- **Contrato exacto:**
  ```ts
  // src/ui/recambios/ListaRecambios.tsx
  export type RecambioVista = { id: string; referencia: string; nombre: string; precio: string | null; stock: number; stockMinimo: number; bajoMinimo: boolean };
  export function ListaRecambios(props: { recambios: RecambioVista[]; puedeEditar: boolean }): JSX.Element;
  //  bajo mínimo primero y con la etiqueta «Bajo mínimo»; el resto por referencia; `precio: null` (mecánico) no se dibuja
  ```
  - `/recambios`: titular «Almacén»; el stock como dato grande de cada fila, con «mín. N» al lado; el jefe ve el precio y, por recambio, un formulario plegado («Editar») con stock, mínimo y precio, más «Añadir recambio» arriba; el mecánico solo lee. Vacío: «El almacén está vacío». Errores de `validarRecambio` junto a su campo; si `guardarRecambio` devuelve `false`: «No se pudo guardar el recambio».
- **Tests primero:**
  | Test | Entrada | Resultado esperado |
  |---|---|---|
  | `[C-6] los recambios bajo mínimo salen primero y marcados` | tres recambios, el tercero con `bajoMinimo: true` | ese es el primero y lleva «Bajo mínimo»; los otros no |
  | `[C-3] sin permiso de edición no hay formularios` | `puedeEditar: false` | ningún `input` ni «Editar» ni «Añadir recambio» |
  | `[C-3] el mecánico no ve precios` | `precio: null` en todos | no aparece ningún «€» |
  | `[C-15][D-11] lista vacía muestra su texto` | `recambios: []` | «El almacén está vacío» |
- **Cambio:** tests → lista → formulario → página y acciones → ronda de Testing.
- **Obligatorio en la página y en cada acción de este paso:** empezar por `leerSesion()` y, si devuelve `null`, `redirect('/login')`.
- **No hacer:** historial de movimientos de stock; tocar `tablero` u `ordenes` (otra rama); borrar recambios.
- **Verificación:** `npm run check:full` → 0; con `npm run dev` (sesión principal): como jefe, cambiar el stock de un recambio por debajo de su mínimo y verlo subir arriba con la etiqueta; como mecánico, sin formularios.
- **Para y devuelve ABIERTO si:** la política de `recambios` rechaza la escritura del jefe.

#### Paso 15: Móvil, accesibilidad, E2E y enlace de restablecer (feature `f12-movil`)

- **Cierra:** C-16, C-13 (enlace); D-13
- **Archivos:** `tests/e2e/movil.spec.ts`, `tests/e2e/smoke.spec.ts`, `tests/e2e/ayuda.ts` — crear; `src/app/login/page.tsx`, `src/app/login/acciones.ts` — modificar; cualquier archivo de `src/ui/**` o `src/app/**` — modificar solo para arreglar un fallo de `[C-16]`, diciéndolo en el informe.
- **Contexto que necesitas:**
  - `playwright.config.ts` ya existe (proyectos `movil` 390×844 y `escritorio` 1440×900; `baseURL` de `URL_BASE`). Scripts `e2e` y `smoke` ya definidos.
  - `src/aplicacion/restablecer-demo.ts`: `restablecerDemo(puerto)`; `src/adaptadores/supabase/demo.ts`: `rpcRestablecer`, `reponerContrasenas`.
  - Usuarios: `USUARIOS_DEMO` (`src/aplicacion/acceso.ts`); contraseña en `DEMO_PASSWORD` del entorno.
- **Contrato exacto:**
  - `tests/e2e/ayuda.ts`: `export async function entrarComo(page, rol: 'jefe' | 'mecanico' | 'otro'): Promise<void>` (rellena `/login` con el correo de `USUARIOS_DEMO` y `process.env.DEMO_PASSWORD`).
  - `tests/e2e/movil.spec.ts` — un test por pantalla (`/login`, `/tablero`, `/ordenes/<primera del tablero>`, `/recambios`, `/proceso`), nombre `[C-16][D-13] <pantalla> cabe en el móvil y es accesible`: (1) `document.documentElement.scrollWidth <= window.innerWidth`; (2) todo `button` y todo `a` con clase de botón, visibles, con `boundingBox().height >= 48`; (3) `new AxeBuilder({ page }).analyze()` sin violaciones de impacto `serious` ni `critical`.
  - `tests/e2e/smoke.spec.ts` — tests `[P-7]`: `/proceso` responde 200 y contiene «Cómo se construyó»; ninguna respuesta de navegación viene de un dominio `vercel.com` ni es 401; el jefe entra y ve al menos una matrícula en el tablero; el mecánico abre una orden en «Listo» y no ve «Entregar»; el jefe del otro taller no ve ninguna de las matrículas que vio el primero.
  - `/login`: bajo los botones de demostración, enlace discreto «¿No puedes entrar? Restablecer la demo» (acción `restablecer` en `acciones.ts`, que llama a `restablecerDemo`); respuesta visible: `RESTABLECIDO` → «Demo restablecida. Ya puedes entrar»; `EN_ESPERA` → «La demo se restableció hace menos de 10 minutos. Prueba a entrar»; `ERROR` → su motivo.
- **Tests primero:** los specs de Playwright de arriba son los tests de este paso: se escriben, se ven fallar donde fallen y se arregla la interfaz.
- **Cambio:** specs → correr → arreglar → enlace de restablecer → ronda de Testing.
- **No hacer:** arreglar faltas de axe ocultando elementos al lector de pantalla; bajar el mínimo de 48 px; `schedule` en `gate.yml`.
- **Verificación:** la sesión principal levanta `npm run build && npm run start` en segundo plano (puerto 3000 libre) con `.env.local`; `URL_BASE=http://127.0.0.1:3000 DEMO_PASSWORD=… npm run e2e` → verde en `movil` y `escritorio`; `URL_BASE=http://127.0.0.1:3000 npm run smoke` → verde; `npm run check:full` → 0.
- **Para y devuelve ABIERTO si:** axe marca como grave el contraste de un token (vuelve como ronda de `f01-sistema-visual`); un arreglo de `[C-16]` exige rehacer la composición de una pantalla.

#### Paso 16: Cierre: `spec:check` completo, README, repo privado y gate

- **Cierra:** P-3 (todas en verde), P-6, P-1 (gate en GitHub), P-8
- **Archivos:** `package.json` — modificar; `README.md` — reescribir; `tests/proceso/readme.test.ts`, `docs/ENTREGA.md`, `scripts/checklist-entrega.mjs` — crear; tests que falten para cerrar criterios `SIN TEST` — en los archivos que nombra la tabla de criterios.
- **Contexto que necesitas:**
  - `package.json`: `spec:check` hoy es `node scripts/puertas/spec-check.mjs --specs DIRECTRICES.md --vitest reports/vitest.json --no-escribir` y no está en `check:full`.
  - `docs/SPEC.md` (tablas «Criterios de aceptación», «Criterios de proceso», «Cumplimiento del enunciado») y `DIRECTRICES.md` terminan con los dos comentarios HTML `estado:inicio` y `estado:fin`, entre los que `spec-check` escribe.
  - GitHub: la cuenta es `donpapaya14`; la sesión activa de `gh` es otra. Antes: `gh auth switch -u donpapaya14`. Al acabar: `gh auth switch -u <cuenta-anterior>` (dejarla como estaba).
  - Todas las features están `hecha` y sus ramas integradas en `main`.
- **Contrato exacto:**
  - `package.json`: `spec:check` → `node scripts/puertas/spec-check.mjs --specs docs/SPEC.md,DIRECTRICES.md --vitest reports/vitest.json`; `check:full` → añade al final `&& npm run spec:check`.
  - Correr `npm run cobertura && npm run spec:check`. Por cada ID en `SIN TEST`: escribir el test que falta, con el ID en el nombre, en el archivo que su fila nombra. Ninguna fila se cambia a comprobación a mano para salir del paso.
  - `README.md` (≤ 130 líneas), secciones con estos títulos exactos: «FOSO», «Probarla» (URL de producción, tabla con los tres usuarios, su rol y la contraseña, y qué mirar en dos minutos), «Los tres agentes» (tabla archivo → papel y el protocolo de ronda en cinco líneas), «Dónde están las rondas», «Directrices con test», «Stack», «Arquitectura» (el diagrama del SPEC), «Arrancar en local», «Qué no hace», «Las cuatro preguntas» (cuatro huecos numerados con «Pendiente: se contestan al recibirlas»). Una captura (`docs/diseno/tablero-escritorio.png`). Aviso: datos ficticios; las puertas de `scripts/puertas` son trabajo propio reutilizado. La URL de producción va como `https://taller-agentes.vercel.app` hasta que el paso 17 confirme la definitiva.
  - `docs/ENTREGA.md`: plantilla del mensaje de entrega (enlace de la app, repo, usuarios y contraseña, cuatro preguntas con hueco).
  - `scripts/checklist-entrega.mjs`: recibe `URL_BASE` y `REPO` (`donpapaya14/taller-agentes`) por entorno; imprime una tabla con una fila por requisito de «Cumplimiento del enunciado» y `OK` / `FALLO` / `A MANO`; sale con 1 si hay algún `FALLO`. Comprobaciones automáticas: (1) `package.json` depende de `next`; (2) existen `CLAUDE.md`, `.claude/agents/develop.md`, `.claude/agents/testing.md`, `DIRECTRICES.md`; (3) `git log --format=%b` contiene `Co-Authored-By: Claude`; (4) `node scripts/entrega-check.mjs` sale con 0; (5) `fetch(URL_BASE + '/proceso', { redirect: 'manual' })` → 200; (6) `fetch(URL_BASE + '/login', { redirect: 'manual' })` → 200 y el cuerpo no contiene `vercel.com/login` ni «Authentication Required»; (7) `gh repo view $REPO --json visibility` → `PUBLIC`; (8) `fetch('https://raw.githubusercontent.com/$REPO/main/<archivo>')` → 200 para los cuatro `.md`; (9) `gitleaks git --no-banner` sale con 0; (10) ninguna dependencia de `package.json` es un SDK de pago (`openai`, `@anthropic-ai/sdk`, `stripe`, `twilio`); (11) `npm run smoke` sale con 0 (entra el jefe y el mecánico con `DEMO_PASSWORD`). `A MANO`: plan Free de Supabase, plan Hobby de Vercel, facturación en 0, Deployment Protection, las cuatro preguntas contestadas.
  - GitHub: `gh repo create donpapaya14/taller-agentes --private --source . --remote origin` → `git push -u origin main` → esperar el gate rápido y leer su resumen.
- **Tests primero:**
  | Test | Entrada | Resultado esperado |
  |---|---|---|
  | `[P-6] el README tiene las secciones de la entrega` | `README.md` | los diez títulos, una URL `https://`, los tres correos de demostración, y menos de 131 líneas |
  | `[P-6] la entrega reserva las cuatro preguntas` | `README.md` y `docs/ENTREGA.md` | ambos contienen «Las cuatro preguntas» o «cuatro preguntas» y cuatro huecos numerados |
- **No hacer:** hacer público el repo; desplegar; escribir la contraseña de la base de datos o claves; relajar umbrales para que el gate pase.
- **Verificación:** `npm run check:full` → 0 y los bloques de estado de `docs/SPEC.md` y `DIRECTRICES.md` sin `SIN TEST` ni `ROJO`; `npm run gate:mutacion` → ≥ 80; `node scripts/entrega-check.mjs` → 0; gate rápido de GitHub en verde (pegar el resumen); `gh auth status` → activa la cuenta que había al empezar.
- **Para y devuelve ABIERTO si:** un criterio queda `SIN TEST` y su test exige tocar código de producción; el gate rápido falla en `secretos`, `sast` o `dependencias` por algo que no es del repo; el push lo bloquea un hook por algo distinto de `check:full`.

#### Paso 17: Publicación y checklist de entrega

Requiere: revisor adversarial sin bloqueantes abiertos y OK de Vladys a publicar (GATE 3, primer tiempo).

- **Cierra:** P-5, P-7, P-10, P-11
- **Archivos:** `README.md`, `docs/ENTREGA.md` — modificar solo la URL de producción si no es la prevista. Ninguno más.
- **Contexto que necesitas:**
  - Vercel: cuenta personal, alias de shell `vvlad` (equivale a `vercel --token=$VERCEL_TOKEN_VLADYS`), equipo `donpapaya14s-projects` (Hobby). **Nunca** otra cuenta ni la sesión de equipo.
  - Un proyecto creado por CLI puede quedar con el preset «Other» y dar 404 en todo: `vercel.json` ya lleva `"framework": "nextjs"`. Un despliegue puede quedar en `BLOCKED` por el autor del commit: se ve con `--debug`, campo `readyStateReason`.
  - `.env.local` tiene los valores de `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `CRON_SECRET`, `DEMO_PASSWORD`.
  - `gate.yml`, job `desplegar`: usa el entorno `produccion` con los secretos `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` y la variable `URL_PRODUCCION`.
- **Contrato exacto**, en este orden:
  1. `gitleaks git --no-banner` sobre todo el historial → sin hallazgos. Búsqueda de términos privados con la lista que la sesión principal pasa desde fuera del repo → sin resultados.
  2. `gh auth switch -u donpapaya14`. `vvlad link --yes --project taller-agentes` (crea el proyecto en la cuenta personal). Leer `orgId` y `projectId` de `.vercel/project.json`.
  3. Variables de producción en Vercel (`vvlad env add <NOMBRE> production` para las cinco).
  4. En GitHub: entorno `produccion` con los tres secretos y la variable `URL_PRODUCCION` (`gh secret set … --env produccion`, `gh variable set URL_PRODUCCION --env produccion`).
  5. `gh workflow run gate.yml -f desplegar=true --ref main` → esperar → gate completo en verde y job `desplegar` terminado.
  6. `gh repo edit donpapaya14/taller-agentes --visibility public --accept-visibility-change-consequences`.
  7. `URL_BASE=<producción> REPO=donpapaya14/taller-agentes DEMO_PASSWORD=… npm run checklist` → pegar la tabla entera.
  8. `gh auth switch -u <cuenta-anterior>`.
- **Tests primero:** no aplica; el checklist y el smoke son la prueba.
- **No hacer:** `vercel deploy --prod` desde local; hacer público el repo antes del punto 1; contestar las cuatro preguntas sin haberlas leído; tocar Deployment Protection por CLI si la URL de producción ya responde sin sesión.
- **Verificación:** tabla del checklist sin ningún `FALLO`; abrir la URL de producción en una ventana privada → carga sin pedir cuenta de Vercel; las filas `A MANO` (plan Free, plan Hobby, facturación en 0, Deployment Protection) las confirma la sesión principal con Vladys mirando los paneles.
- **Para y devuelve ABIERTO si:** el despliegue queda en `BLOCKED`; la URL de producción pide autenticación de Vercel (Vladys la quita en Settings → Deployment Protection); el gate completo falla en una puerta; `vvlad` no está en la cuenta `donpapaya14`.

Con el checklist delante, Vladys da el segundo tiempo del GATE 3: enviar la candidatura.

### Riesgos

- Alcance mayor que el plazo — se detecta al integrar la oleada 3: si va tarde, se aplica el orden de recorte de «Fuera de alcance».
- PGlite no se comporta como el Postgres de Supabase con roles y RLS — se detecta en el primer test del paso 6; salida: `supabase start` con Docker solo para `tests/bd`.
- Dos ramas tocan el mismo archivo pese al reparto — se detecta en el `merge`; lo resuelve el orquestador y corre `check:full` antes de seguir.
- Los repositorios de Supabase (paso 10) se escriben sin base de datos delante — se detecta en la verificación a mano de los pasos 13 y 14 y en el E2E del 15.
- Un visitante cambia la contraseña de demostración — lo cubren el cron y el enlace de restablecer; se detecta con el smoke.
- El proyecto gratuito de Supabase se pausa — lo evita el cron diario; se detecta con el smoke antes de enviar.
- El tema oscuro no llega a AA en algún par — lo detecta `[C-14][D-10]` en el paso 3 y axe en el 15.
- Despliegue bloqueado por autor o preset — se detecta con `--debug` y con el checklist.
- Las rondas salen «demasiado limpias» — no se fuerza nada: se publica lo que pase.

### Verificación final

`npm run check:full` → `npm run gate:mutacion` → `node scripts/entrega-check.mjs` → revisor adversarial → gate completo en GitHub → `npm run smoke` y `npm run checklist` contra producción.

### Cobertura de criterios

| Paso | Criterios que cierra |
|---|---|
| 1 | P-1, P-9 |
| 2 | P-2 y P-3 (contenido) |
| 3 | C-10, C-14, C-17, D-9, D-10, D-12 |
| 4 | C-12 (datos), P-2, P-3, P-4, D-15 |
| 5 | C-3, C-4, C-5, C-6, C-7, C-8, C-9, C-11 (reglas), D-1, D-5, D-6 |
| 6 | C-2, C-3, C-4 (base de datos), D-3 |
| 6b | C-2, C-3, D-3 (refuerzo) |
| 7 | C-5, C-8 (numeración), C-13 (función) |
| 8 | C-1, C-18, D-2, D-4, D-7, D-8, D-14 |
| 8b | C-1, C-18, D-14 (refuerzo) |
| 9 | P-10 (plan Free) |
| 10 | C-11, C-4, C-5, C-3 (casos de uso), D-2 |
| 11 | C-8 (PDF), C-13 (ruta) |
| 12 | C-12 (pantalla), C-15, D-11 |
| 13 | C-10, C-9, C-5, C-7, C-8, C-3 (pantallas) |
| 14 | C-6, C-3 (pantalla) |
| 15 | C-16, C-13 (enlace), D-13 |
| 16 | P-3 (todas en verde), P-6, P-8 |
| 17 | P-5, P-7, P-10, P-11 |

### Prueba del plan

- [x] Cada paso se puede ejecutar leyendo su bloque y las secciones del SPEC que cita.
- [x] Ningún paso contiene verbos vagos.
- [x] Nombres, rutas, firmas, textos y valores están escritos. Excepción declarada: la composición visual del paso 3 y la redacción de los `.md` del paso 2, por eso van en opus.
- [x] Las referencias a archivos existentes (plantilla de puertas, configs de proyecto-previo, `spec-check.mjs`, `gate.yml`) se abrieron en esta sesión. Las rutas dentro del repo son de archivos que crean pasos anteriores.
- [x] Cada test tiene entrada y resultado concretos.
- [x] Todo criterio tiene paso y todo paso cierra algún criterio.
- [ ] Un paso ≤ 5 archivos: **no se cumple** en los pasos 1, 3, 8, 10, 12 y 13 (esqueleto e interfaz crean muchos archivos pequeños). Se acepta porque cada uno tiene un solo objetivo; si un ejecutor se queda corto, el arquitecto parte ese paso.

## Decisiones

- 2026-11-23 GATE 1 y GATE 2 fusionados en un solo OK de Vladys a SPEC y plan («vale, un solo OK a spec y plan»). El gate de diseño del tablero y el GATE 3 se mantienen.
- 2026-11-23 Plan por oleadas en paralelo, cada paso en su copia de trabajo de git (Vladys: «si hace falta abrir varios agentes abrelos»). El paso 1 instala todas las dependencias y scripts para que las ramas no choquen en `package.json`.
- 2026-11-23 GATE 3 en dos tiempos: publicar, y con producción arriba, checklist contra el enunciado antes de enviar la candidatura (el checklist necesita la URL de producción, que no existe antes de publicar).
- 2026-11-23 (oleada 2) Se quitan `cacheComponents` y `partialPrefetching` que trajo `create-next-app`: es la pieza del aviso de seguridad y es incompatible con `force-static` de `/proceso`. Lo aplica el paso 8b.
- 2026-11-23 (oleada 2) Validado `refrescarSesion(peticion)` en `src/adaptadores/supabase/sesion.ts` con el proxy llamándola: la regla de arquitectura manda sobre el bloque del paso 8.
- 2026-11-23 (oleada 2) Las llamadas a Supabase llevan un límite de 4 s; pasado ese tiempo el proxy trata la petición como sin sesión (antes, 25 s por petición con Supabase caído). Paso 8b.
- 2026-11-23 (oleada 2) El proxy no es la barrera de acceso: su `matcher` pasa a excluir solo extensiones de archivo estático (paso 8b) y cada página, acción y ruta privada llama a `leerSesion()` (pasos 12, 13 y 14).
- 2026-11-23 (oleada 2) CSP con `'unsafe-eval'` solo en desarrollo, para que arranque `next dev`; en producción nunca, y hay test. Paso 8b.
- 2026-11-23 (oleada 2) P-4 se alinea con el contrato del paso 4, `testing.md` y D-15: una ronda `FALLA` vale con un fallo con evidencia o con un comando en rojo (el comando en rojo ya es la evidencia).
- 2026-11-23 (oleada 2) `formatearEuros` lanza `RangeError('Importe no válido')` si no recibe un entero finito, igual que `calcularTotales`. Si la ronda 1 de Testing no lo señala, entra como cambio de contrato de `f03-nucleo` y Testing lo revisa en la ronda siguiente; no se anota como hallazgo de Testing.
- 2026-11-23 (oleada 2) La línea base del trinquete se baja en `main` tras integrar cada oleada con `check:full` en verde (`node scripts/puertas/trinquete.mjs --actualizar`, commit `chore(calidad): baja la línea base del trinquete`). Solo baja; nunca dentro de una rama de feature.
- 2026-11-23 (paso 6) Las referencias entre tablas llevan el taller: claves ajenas compuestas `(taller_id, x_id)`. Es una regla del esquema, así que también protege a `cerrar_orden()` y a cualquier función `security definer` (descartado: comprobarlo en cada política, que no cubre a las funciones). `cerrar_orden()` filtra además por taller al descontar. Paso 6b y paso 7.
- 2026-11-23 (paso 6) Nadie escribe por API el precio por hora, el número de factura, la fecha de entrega ni el precio de una línea: permisos por columna en `ordenes` y `orden_lineas`, y el precio de la línea lo copia un disparador desde el recambio. El precio por hora queda en su valor por defecto (no hay pantalla que lo cambie). Paso 6b; el paso 10 no envía precio al añadir una línea.
- 2026-11-23 (paso 6) El mecánico puede leer precios por API aunque la interfaz no se los enseñe: dentro de un mismo taller no es un secreto y ocultarlo por columnas complicaría las consultas. La amenaza cubierta es que los cambie.
- 2026-11-23 (paso 6) `not null` en todas las columnas que el modelo da por obligatorias, `default 0` en stock y stock mínimo, y `check` de precio por hora no negativo. Paso 6b.
- 2026-11-23 (paso 6) Ratificado: el arnés de PGlite reproduce los permisos por defecto de Supabase antes de migrar; la migración retira todo a `authenticated` y concede solo lo que usan las políticas; `await` de nivel superior en los tests de base de datos.
- 2026-11-23 (paso 6) El paso 9 comprueba los permisos contra la nube con `scripts/comprobar-nube.mjs` (solo clave publicable y usuarios de demostración): PGlite no reproduce que `postgres` no sea superusuario en Supabase.
- 2026-11-23 App nueva desde cero, sin código de otros proyectos.
- 2026-11-23 Todo el acceso a datos en el servidor, sin cliente de Supabase en el navegador (ninguna clave en el cliente; descartado: consultas desde componentes de cliente).
- 2026-11-23 El aislamiento y los roles se deciden en Postgres (RLS + `cerrar_orden`), no en el servidor de Next (descartado: filtrar por `taller_id` con la clave secreta).
- 2026-11-23 Políticas y funciones SQL probadas con PGlite dentro de vitest (rápido, sin Docker, entra en `check:full`; descartado en local: `supabase start` + pgTAP).
- 2026-11-23 Una sola tabla de órdenes para presupuesto y factura; el número se asigna al entregar.
- 2026-11-23 Sin arrastrar y soltar; botón grande de avanzar.
- 2026-11-23 CSP con `'unsafe-inline'` en scripts y estilos (la CSP con nonce obliga a renderizar todo en dinámico y `/proceso` es estática; se compensa con el escape de React, `react/no-danger` y cookies `httpOnly`).
- 2026-11-23 Un único proyecto de Supabase para desarrollo y demostración (no hay datos reales y se restablece; el E2E del CI usa Supabase local). Excepción consciente a «dev y prod no comparten recursos».
- 2026-11-23 Las puertas de `scripts/puertas` son las de la casa copiadas tal cual; el README lo dice.
- 2026-11-23 `spec:check` cruza tanto `docs/SPEC.md` como `DIRECTRICES.md`: cada directriz de Testing queda atada a un test sin escribir otra herramienta.
- 2026-11-23 La construcción se hace con los agentes del repo (`develop`, `testing`) para que las rondas sean auténticas; los agentes de la casa solo montan el esqueleto, escriben los `.md`, crean la infraestructura y hacen la revisión final.
- 2026-11-23 OK de Vladys a SPEC + plan («ok», tras ver el resumen y las 3 preguntas con recomendación «sí»): commits con usuario `donpapaya14` y nombre real; repo privado durante la construcción y público al final; GATE 3 en dos tiempos.
- 2026-11-23 Los tipos de agente `develop` y `testing` no estaban cargados en la sesión que construye (se abrió fuera del repo): se lanzan como `ejecutor-sonnet` con la primera línea «Lee `.claude/agents/develop.md` (o `testing.md`) y trabaja exactamente como dice», como prevé «Cómo encaja con el flujo de la casa».
- 2026-11-23 Pendientes del paso 1 para pasos posteriores: (a) quien cambie `src/app/page.tsx` sustituye el test provisional de `tests/proceso/enunciado.test.ts`; (b) `AGENTS.md` que reescribe `next dev` va a `.gitignore` (paso 16); (c) el job `desplegar` de `gate.yml` necesita `npx playwright install --with-deps chromium` antes del smoke (paso 16); (d) `trinquete --actualizar` siempre después de `git add`; (e) valorar eslint 10 y `vitest.config.mts` en el paso 16.
- 2026-11-23 (ronda 1 de f03-nucleo, observaciones de Testing) Cambio de contrato del núcleo junto al de `formatearEuros`: `descontar` rechaza cantidades que no sean enteros ≥ 1; `calcularTotales` lanza si un producto intermedio o el total deja de ser entero seguro; `puede` solo concede permisos a `jefe` y `mecanico`. La prueba de D-1 solo vigila imports; reloj, entorno y azar sin import (`Date.now`, `process.env`, `Math.random`, `fetch`) los cubre una regla de lint en el paso 16.
- 2026-11-23 (paso 6b) Una línea de A con un recambio de B se rechaza por `not null` del precio (el disparador `before` solo busca el precio en el taller de la línea) antes de llegar a la clave ajena compuesta; se ratifica: la fila no entra, que es lo que exige C-2. La clave compuesta queda probada aparte con `update` como superusuario. `transiciones.test.ts` deja de enviar el precio (fuera de la lista del bloque, necesario por el grant por columna). El paso 7 escribe sus tests en archivos nuevos (aislamiento y catálogo rozan las 300 líneas).
- 2026-11-23 (f01, ronda 2) La matrícula que no cabe se recorta en una línea con puntos suspensivos; el texto completo sigue en el DOM. Los casos de texto largo (placa de 20 y 40 caracteres, palabra de 80 letras, URL de 63) entran en el E2E móvil del paso 15.
- 2026-11-23 (paso 7) Ratificado: número de factura con 4 cifras hasta 9999 y sin recortar desde 10000 (`lpad` literal duplicaba números); índice único parcial `(taller_id, numero_factura)`; año de factura en `Europe/Madrid`; `restablecer_demo` crea y bloquea su fila de control; `sembrar_demo` devuelve a su taller a un usuario de demo movido y no es ejecutable por `authenticated`; `cerrar_orden` recorre líneas por referencia con `left join` filtrado por taller y las cuatro condiciones son `raise exception`. Paso 9: `crear-usuarios-demo.mjs` debe tratar `EN_ESPERA` de `restablecer_demo` (esperar o reintentar tras el plazo) para que los usuarios nuevos no queden sin taller.
- 2026-11-23 (paso 8c) Plazo total de sesión `PLAZO_TOTAL_MS = 4500` (con 5000 la medida real pasaba de 5 s): `conPlazoTotal` corta con una carrera y aborta la señal compartida, porque auth-js duerme entre reintentos sin mirar señales; la consulta de `miembros` va con `.retry(false)`. Medido con servidores falsos: de 25-30 s a 4,5 s. Al vencer, `refrescarSesion` conserva las cookies ya renovadas.
- 2026-11-23 Gate de diseño: OK de Vladys («ok») al tablero de muestra FOSO (capturas 1440×900 y 390×844 del commit 3c1b407). Pendiente menor visto en la captura móvil: el grano del fondo no cubre toda la altura de página; se corrige en el paso 12 (armazón) o en la siguiente ronda de f01.
- 2026-11-23 (f07 ronda 1 PASA, observaciones para pasos 13 y 14) (a) `validarRecambio` sin tope: stock, mínimo y precio en céntimos ≤ 2147483647 (integer de Postgres) con mensaje del campo; (b) `marca`, `modelo` y `clienteNombre` con tope de longitud (40, 40 y 80); (c) los ids de formularios se validan como uuid en los casos de uso y las acciones capturan la excepción del repositorio y devuelven `{ ok: false, motivo }`; (d) `guardarRecambio` pasa a distinguir referencia repetida de «sin permiso o no encontrado»; (e) `restablecer_demo` siembra matrículas ya normalizadas (paso 11); `normalizarMatricula` rechaza letras que cambian de longitud al pasar a mayúsculas (`ß`, ligaduras) en la ronda siguiente de f03. Paso 12 y Testing de f05: `src/app/error.tsx` para errores del layout, traducir 23505/40P01 a español y cambiar cantidad de línea van al paso 13/14; `puedeTransicionar` con estado desconocido da false (f03).
- 2026-11-23 (f06 ronda 3 PASA, integrada 8c) Observaciones: con Auth caído y token caducado auth-js lanza hasta 5 refrescos por petición y un 429 cierra la sesión (comportamiento de la librería; se acepta y se anota como riesgo); `leerSesion` da null a 4,0 s con token vigente y lanza a 4,5 s con caducado: la pantalla del paso 12/13 trata ambos igual («No se pudo cargar tu taller»); falta un test con rol `mecanico` en `sesion.ts` y que el proxy registre `ErrorDeEntorno` (próxima ronda de f06 o paso 16).
- 2026-11-24 (paso 11, ABIERTOs de Develop) Ratificado: `reponerContrasenas(correos)` recibe la lista (dependency-cruiser prohíbe adaptadores → aplicación); `cerrar_orden` bloquea el taller antes que la orden y los recambios (probado en PostgreSQL 17 real: con otro orden hay interbloqueo); fecha de la factura de demo en el año de Madrid con `greatest(...)` al 1 de enero; NIF y teléfonos inventados con dígito de control válido y la leyenda «Documento de demostración sin validez fiscal»; páginas de continuación del PDF repiten encabezado de tabla y pie; grises del PDF como constantes en `generar.ts` (el PDF no lee tokens.css). Para el paso 13: `crearClienteSecreto` y el cron usan `conPlazoTotal` (ya en main desde 8c); el motivo real de un 500 del cron se registra con `console.error` solo en la ruta del cron (excepción a no-console acotada a ese archivo, decidida en el paso 16 si la regla la bloquea); `new Response(new Uint8Array(bytes))` para el PDF. Testing corre `check:full` también tras su commit.
- 2026-11-24 (f09 ronda 2) `src/app/error.tsx` se hizo en el paso 12 (sale de los pasos 13/14), con «Reintentar» (`retry`) y «Salir». El paso 13 pasa `(taller)/error.tsx` de `reset` a `retry`. `gate:e2e` no se corre en las rondas hasta que exista `tests/e2e/movil.spec.ts` (paso 15); Testing corre a mano los specs que existan.
- 2026-11-24 (f08 ronda 1 PASA) Observaciones que se arreglan en una ronda de f08 tras el paso 13 (rama propia, test primero): `trocear` de `generar.ts` lineal (hoy cuadrático con una palabra larga); `limpiar` normaliza a NFC; cabeceras del PDF que no pisan el pie; tests que fijan cantidad, precio e importe de cada fila; el cron comprueba el secreto antes de leer el resto del entorno; el cron reintenta las contraseñas aunque la base responda `EN_ESPERA`; test que distinga `for update` de `for share` en `cerrar_orden`; texto menudo del PDF a 10,5 pt (D-12 también en papel).
- 2026-11-24 (paso 13, ABIERTOs de Develop) Ratificado: `LineasOrden` con `accionCantidad` y `accionQuitar` cuando `editable`; piezas de UI y apoyos de test extra por los límites de D-7; aviso de resultado por cookie flash `foso-aviso` (httpOnly, 10 s); fecha del PDF `entregadaEn ?? creadaEn` en Madrid; permisos por acción según `puede`. Registro de la causa real de fallos: no se relaja `no-console` (exigiría `UMBRAL:` de Vladys); los errores inesperados se relanzan y los registra Vercel; los esperados devuelven motivo en español. Queda como mejora documentada en el README.
- 2026-11-23 Concepto visual FOSO, sin librería de componentes y con la paleta por defecto de Tailwind apagada (descartado: shadcn/ui).

## Umbrales

<!-- Única vía legítima para relajar una puerta: una línea `UMBRAL: <ruta-o-clave> — <motivo>`. -->

<!-- estado:inicio -->
| ID | Estado | Tests (n) | Fecha |
|---|---|---|---|
| C-1 | VERIFICADO | 72 | 2026-11-24 |
| C-2 | VERIFICADO | 21 | 2026-11-24 |
| C-3 | VERIFICADO | 91 | 2026-11-24 |
| C-4 | VERIFICADO | 100 | 2026-11-24 |
| C-5 | VERIFICADO | 91 | 2026-11-24 |
| C-6 | VERIFICADO | 23 | 2026-11-24 |
| C-7 | VERIFICADO | 86 | 2026-11-24 |
| C-8 | VERIFICADO | 105 | 2026-11-24 |
| C-9 | VERIFICADO | 37 | 2026-11-24 |
| C-10 | VERIFICADO | 24 | 2026-11-24 |
| C-11 | VERIFICADO | 83 | 2026-11-24 |
| C-12 | VERIFICADO | 34 | 2026-11-24 |
| C-13 | VERIFICADO | 96 | 2026-11-24 |
| C-14 | VERIFICADO | 5 | 2026-11-24 |
| C-15 | VERIFICADO | 24 | 2026-11-24 |
| C-16 | MANUAL | 0 | 2026-11-24 |
| C-17 | VERIFICADO | 3 | 2026-11-24 |
| C-18 | VERIFICADO | 11 | 2026-11-24 |
| P-1 | VERIFICADO | 3 | 2026-11-24 |
| P-2 | VERIFICADO | 5 | 2026-11-24 |
| P-3 | VERIFICADO | 2 | 2026-11-24 |
| P-4 | VERIFICADO | 17 | 2026-11-24 |
| P-5 | MANUAL | 0 | 2026-11-24 |
| P-6 | VERIFICADO | 7 | 2026-11-24 |
| P-7 | MANUAL | 0 | 2026-11-24 |
| P-8 | MANUAL | 5 | 2026-11-24 |
| P-9 | VERIFICADO | 2 | 2026-11-24 |
| P-10 | MANUAL | 0 | 2026-11-24 |
| P-11 | MANUAL | 0 | 2026-11-24 |
| D-1 | VERIFICADO | 16 | 2026-11-24 |
| D-2 | VERIFICADO | 431 | 2026-11-24 |
| D-3 | VERIFICADO | 14 | 2026-11-24 |
| D-4 | VERIFICADO | 8 | 2026-11-24 |
| D-5 | VERIFICADO | 66 | 2026-11-24 |
| D-6 | VERIFICADO | 2 | 2026-11-24 |
| D-7 | VERIFICADO | 1 | 2026-11-24 |
| D-8 | VERIFICADO | 2 | 2026-11-24 |
| D-9 | VERIFICADO | 3 | 2026-11-24 |
| D-10 | VERIFICADO | 9 | 2026-11-24 |
| D-11 | VERIFICADO | 21 | 2026-11-24 |
| D-12 | VERIFICADO | 7 | 2026-11-24 |
| D-13 | MANUAL | 37 | 2026-11-24 |
| D-14 | VERIFICADO | 218 | 2026-11-24 |
| D-15 | VERIFICADO | 7 | 2026-11-24 |

Resumen: 44 criterios: 37 VERIFICADO, 0 ROJO, 0 SIN TEST, 7 MANUAL, 0 OMITIDO.
<!-- estado:fin -->
