# Estado operativo de DosisYa (frontend)

## Última actualización
2026-09-05

## Estado del MVP
- Flujos obligatorios construidos: 10/10 (ver `VISION-MVP.md`) — pendiente de verificación conjunta (B-002).
- Gate de lanzamiento cumplido: NO — bloqueado por CI roto en `main` (B-001).
- Próxima tarea recomendada: B-001 (reparar `leadsLista.test.ts`).
- Bloqueos activos: D-001, D-002, D-003 (ver `DECISIONES-PENDIENTES.md`).

## Último trabajo realizado
- Qué se cambió: se creó el sistema de trabajo autónomo (`docs/producto/`, `.claude/agents/`, sección 8 de `CLAUDE.md`) — ver spec `docs/superpowers/specs/2026-09-05-sistema-autonomo-producto-design.md` y plan `docs/superpowers/plans/2026-09-05-sistema-autonomo-producto.md`.
- Archivos modificados: `docs/producto/VISION-MVP.md`, `docs/producto/BACKLOG.md`, `docs/producto/DECISIONES-PENDIENTES.md`, `docs/producto/ESTADO-PROYECTO.md` (este archivo), `CLAUDE.md`, `.claude/agents/frontend.md`, `.claude/agents/qa.md`, `.claude/agents/auditor-api.md`.
- Validaciones ejecutadas (2026-09-05, rama `claude/autonomous-claude-system-8b01f8`, sincronizada con `main`):
  - `npx tsc --noEmit`: ✅ limpio.
  - `npx vitest run`: ❌ 3/74 tests fallan, los 3 en `src/lib/leadsLista.test.ts` (regresión de fan-out, ver memoria `regresion-leadslista-fanout-2026-08.md`).
  - `npm run build`: ✅ limpio (cliente + SSR).
- Commit: ver historial de esta rama (`git log --oneline`).

## Riesgos o deuda técnica
- CI roto en `main` desde la regresión de `leadsLista` (ago 2026) — cualquier PR nuevo hereda ese rojo hasta que se repare B-001.
- Los 10 flujos del MVP nunca se verificaron juntos en un solo recorrido manual (B-002).
- Placeholders visibles a usuarios reales en `/privacidad` y `/terminos` (B-010 / D-003).

## Próximo paso exacto
1. Leer `docs/producto/BACKLOG.md`, tomar B-001 (P0, no bloqueada).
2. Correr `npx vitest run src/lib/leadsLista.test.ts` para ver el fallo exacto; usar el skill `systematic-debugging`.
3. Reparar, correr `npx vitest run` completo + `npx tsc --noEmit` + `npm run build`.
4. Actualizar este archivo y marcar B-001 como hecho en `docs/producto/BACKLOG.md`.
