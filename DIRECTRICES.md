# Directrices

Lo que Testing comprueba en cada ronda. Un fallo cita una de estas directrices y trae su evidencia; lo que no incumple ninguna es, como mucho, una observación. Cada directriz tiene un test con su ID, así que ninguna se queda en texto. El bloque del final lo escribe `spec-check`: no se edita a mano.

| ID   | Directriz                                                                                                                      | Cómo se demuestra                                                 |
| ---- | ------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| D-1  | La lógica de negocio vive en `src/nucleo` y es pura: sin red, sin disco, sin reloj, sin entorno                                | test `[D-1]` que ejecuta dependency-cruiser y exige 0 violaciones |
| D-2  | Todo dato que entra (formulario, fila de la base de datos, archivo de ronda) se valida con zod antes de usarse                 | tests `[D-2]` con entrada basura en cada adaptador y caso de uso  |
| D-3  | Toda tabla tiene RLS activado, política por taller y ningún permiso para `anon`                                                | test `[D-3]` que recorre el catálogo de Postgres                  |
| D-4  | Ningún secreto en el repo ni en el navegador: la clave secreta solo en módulos `server-only`, ninguna variable `NEXT_PUBLIC_*` | test `[D-4]`                                                      |
| D-5  | El dinero se guarda y se calcula en céntimos enteros                                                                           | tests de propiedades `[D-5]`                                      |
| D-6  | Cada archivo de `src/nucleo` y `src/aplicacion` tiene su archivo de test al lado                                               | test `[D-6]`                                                      |
| D-7  | Límites: 300 líneas por archivo, 50 por función, complejidad 10, 4 parámetros                                                  | test `[D-7]` que lee la configuración de eslint                   |
| D-8  | Sin atajos: nada de `skip`, `only`, comentarios que apagan eslint o TypeScript, `any` ni HTML inyectado sin escapar            | test `[D-8]` que recorre `src` y `tests`                          |
| D-9  | Colores, tipografías y espaciados salen de `src/ui/tokens.css`; ningún valor suelto                                            | test `[D-9]`                                                      |
| D-10 | Cada par de texto y fondo cumple contraste AA                                                                                  | test `[D-10]` que calcula el contraste de los pares declarados    |
| D-11 | Cada pantalla tiene estado de carga, de error y vacío                                                                          | test `[D-11]`                                                     |
| D-12 | Textos en español, sin emojis, sin texto de relleno, nunca por debajo de 14 px                                                 | test `[D-12]`                                                     |
| D-13 | Móvil primero: a 390 px nada se desborda, los botones de acción miden 48 px o más y axe no da faltas graves                    | manual: `npm run gate:e2e`, tests `[D-13]` de Playwright          |
| D-14 | Ningún `catch` vacío; todo error llega al usuario con un mensaje que puede entender                                            | test `[D-14]`                                                     |
| D-15 | Una ronda es honesta: todo fallo lleva evidencia y el veredicto `PASA` exige cero fallos y todos los comandos en verde         | test `[D-15]` sobre el esquema de ronda                           |

<!-- estado:inicio -->
<!-- estado:fin -->
