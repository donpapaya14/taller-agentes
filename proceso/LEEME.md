# proceso

El registro de cómo se construye FOSO, feature a feature. La página `/proceso` lo enseña tal cual.

- `features.json`: las doce features del plan y su estado. Solo lo edita el orquestador, en `main`.
- `<feature>/ronda-<N>.json`: el informe de cada ronda de revisión, uno por archivo. Lo escribe Testing con el formato de `.claude/agents/testing.md`.

Las rondas no se editan a mano ni se retocan después.
