# Mensaje de entrega

Plantilla del mensaje con el que se entrega FOSO. Lo que va entre llaves dobles se rellena al enviar. Antes de enviarlo, `npm run checklist` recorre contra producción cada requisito del enunciado.

---

**Asunto:** Entrega de la prueba técnica: FOSO, gestión de taller mecánico

Hola,

Os paso la entrega:

- **Aplicación (producción, pública):** https://foso-taller.vercel.app
- **Repositorio:** https://github.com/donpapaya14/taller-agentes, con los `.md` de los agentes: `CLAUDE.md`, `.claude/agents/develop.md`, `.claude/agents/testing.md` y `DIRECTRICES.md`.
- **Usuarios de prueba**, los tres con la contraseña `foso-taller-047359-demo`:

| Correo                        | Rol                                                    |
| ----------------------------- | ------------------------------------------------------ |
| `jefe@tallerdemo.example`     | jefe de Talleres Vega                                  |
| `mecanico@tallerdemo.example` | mecánico de Talleres Vega                              |
| `jefe@otrotaller.example`     | jefe de Mecánica Ribera, para comprobar el aislamiento |

Todo corre en planes gratuitos (Supabase Free y Vercel Hobby) y no hay ninguna clave en el repositorio. Las rondas reales entre Develop y Testing están en `/proceso` y en la carpeta `proceso/` del repositorio.

## Las cuatro preguntas

1. {{pregunta 1 y su respuesta}}
2. {{pregunta 2 y su respuesta}}
3. {{pregunta 3 y su respuesta}}
4. {{pregunta 4 y su respuesta}}
