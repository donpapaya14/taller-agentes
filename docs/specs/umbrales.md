# Excepciones de puertas

Única vía para que el detector de manipulación degrade un hallazgo a aviso. Autorizadas por Vladys el 2026-11-23.

UMBRAL: proceso/f01-sistema-visual/ronda-1.json — informe de Testing que cita el patrón de un grep, no es código; anterior a la regla de testing.md que obliga a romper los patrones, y las rondas no se reescriben.
UMBRAL: proceso/f03-nucleo/ronda-1.json — informe de Testing que cita el patrón de un grep, no es código; anterior a la regla de testing.md que obliga a romper los patrones, y las rondas no se reescriben.
UMBRAL: proceso/f04-base-datos/ronda-1.json — informe de Testing que cita el patrón de un grep, no es código; anterior a la regla de testing.md que obliga a romper los patrones, y las rondas no se reescriben.
UMBRAL: proceso/f06-acceso/ronda-1.json — informe de Testing que cita el patrón de un grep, no es código; anterior a la regla de testing.md que obliga a romper los patrones, y las rondas no se reescriben.

## Paso 16: configuración protegida que se endurece

La guarda de umbrales marca como FALLO cualquier cambio en un archivo de configuración protegido, aunque lo endurezca. Estos tres cambios del paso 16 endurecen una puerta o añaden una y no relajan ninguna; entran con la fusión de esta rama.

UMBRAL: eslint.config.mjs — paso 16: una regla de lint prohíbe reloj, azar, entorno y red en `src/nucleo` (D-1); endurece una puerta y no relaja ninguna.
UMBRAL: .github/workflows/gate.yml — paso 16: las acciones van fijadas por SHA y las imágenes de seguridad por versión, y el job `desplegar` instala el navegador del smoke y le pasa `DEMO_PASSWORD`; endurece la cadena de suministro y completa el smoke, sin quitar ni relajar ninguna puerta.
UMBRAL: package.json#scripts.check:full — paso 16: `check:full` corre `spec:check` al final; añade una puerta y no quita ninguna.
