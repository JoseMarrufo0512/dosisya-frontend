# Backlog de DosisYa (frontend)

> Última actualización: 2026-09-05.

## Reglas de ejecución
- Ejecutar tareas en orden de prioridad (P0 antes que P1).
- No empezar una tarea marcada como bloqueada — pasar a la siguiente P0 no bloqueada.
- No crear funcionalidad fuera del MVP (ver `VISION-MVP.md`) sin registrarla primero como propuesta en `DECISIONES-PENDIENTES.md`.
- Antes de mover una tarea a "Hecho", cumplir todos sus criterios de aceptación y correr las validaciones de `CLAUDE.md` §6.
- Al cerrar una tarea, actualizar este archivo y `ESTADO-PROYECTO.md` en el mismo commit o el siguiente.

## P0 — Bloquea el lanzamiento

- [ ] **B-001: Reparar la regresión de fan-out en `src/lib/leadsLista.test.ts`.**
  3 de 74 tests fallan hoy en `main` (`npx vitest run`), lo que rompe el job `verify` de `.github/workflows/ci.yml` en cada push/PR. Ver memoria `regresion-leadslista-fanout-2026-08.md`. Antes de tocar código: leer `src/lib/leadsLista.ts` y su test, correr `npx vitest run src/lib/leadsLista.test.ts` para ver el fallo exacto, aplicar el skill `systematic-debugging`.
  **Criterio de aceptación:** `npx vitest run` en verde (74/74), `npx tsc --noEmit` sigue en verde, `npm run build` sigue en verde.

- [ ] **B-002: Verificación manual end-to-end de los 10 flujos del MVP en un solo recorrido.**
  Cada flujo de `VISION-MVP.md` se validó por separado en su propio plan; nunca se confirmaron los 10 juntos, en desktop y móvil, contra la API real. Usar el skill `webapp-testing`.
  **Criterio de aceptación:** los 10 flujos completados sin bloqueos en desktop y móvil; cualquier hallazgo se registra como nueva tarea (P0 si bloquea, P1 si no).

- [ ] **B-003: Confirmar que `npm run build` sigue en verde tras B-001.**
  Verificado en verde el 2026-09-05 (antes de B-001); re-confirmar después de tocar `leadsLista.ts`.
  **Criterio de aceptación:** `npm run build` exit 0.

## P1 — Importante después del MVP

- [ ] **B-010: Copy legal real de soporte/privacidad/términos.**
  `src/routes/privacidad.tsx:129` y `src/routes/terminos.tsx:101` dicen literalmente "el soporte actual en la app es un placeholder de desarrollo". Requiere que José defina el copy definitivo — ver D-003 en `DECISIONES-PENDIENTES.md`. No implementar contenido legal por iniciativa propia.

## Bloqueado / requiere decisión humana

- [ ] **D-001:** `GET /api/v1/tasa-actual` no existe en `DosisYa-Backend` (usado por `src/hooks/useTasa.ts`, degrada bien hoy). Ver `DECISIONES-PENDIENTES.md`.
- [ ] **D-002:** Auth de paciente por teléfono no existe en backend (`HojaLoginPaciente.tsx` es un placeholder de UI). Ver `DECISIONES-PENDIENTES.md`.
- [ ] **D-003:** Copy legal definitivo de soporte/privacidad/términos — quién lo redacta y cuándo reemplaza el placeholder. Ver `DECISIONES-PENDIENTES.md`.

## Hecho (referencia — no repetir)
Los 10 flujos obligatorios y las features adicionales listadas en `VISION-MVP.md` ya están mergeados; su historial vive en `docs/superpowers/specs/` y `docs/superpowers/plans/`. Este backlog no repite trabajo ya cerrado — solo lo que falta para el gate de lanzamiento.
