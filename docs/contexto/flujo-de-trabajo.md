# Flujo de trabajo

## Antes de tocar nada
1. Lee `CLAUDE.md` en la raíz.
2. Lee los documentos en `docs/contexto/` (Arquitectura, Convenciones, etc.).
3. Lee el "ticket" específico de la funcionalidad en la que vas a trabajar dentro de `docs/features/`.

## Para hacer un cambio (Frontend)
1. Analiza el spec en `docs/features/`.
2. Antes de escribir código, formula un plan y propón qué componentes vas a tocar. Solicita aprobación.
3. Al implementar, prioriza el manejo de estados de error, vacío y carga (Skeleton Loaders).
4. Asegura que la UI no se bloquee esperando a la API.

## Antes de dar algo por terminado
- [ ] Validar estados de carga (ej. "La IA está descifrando la receta...").
- [ ] Validar manejo de errores (ej. "Letra ilegible").
- [ ] Confirmar que los leads se envían como `POST /api/v1/leads` en background.

## Deploy
- **Backend / Frontend:** Se compilan y despliegan en Vercel independientemente.
