# Backlog de DosisYa (frontend)

> Última actualización: 2026-09-05.

> **Nota de esta actualización:** B-001 se resolvió en `main` vía PR #21 (`d9692ee`, "serializa el fan-out de verdad") mientras este backlog estaba en revisión — no lo cerró este trabajo. Se movió a "Hecho" sin haber sido ejecutado desde aquí; verificado con `npx vitest run` (75/75 en verde) antes de mover la marca.

## Reglas de ejecución
- Ejecutar tareas en orden de prioridad (P0 antes que P1).
- No empezar una tarea marcada como bloqueada — pasar a la siguiente P0 no bloqueada.
- No crear funcionalidad fuera del MVP (ver `VISION-MVP.md`) sin registrarla primero como propuesta en `DECISIONES-PENDIENTES.md`.
- Antes de mover una tarea a "Hecho", cumplir todos sus criterios de aceptación y correr las validaciones de `CLAUDE.md` §6.
- Al cerrar una tarea, actualizar este archivo y `ESTADO-PROYECTO.md` en el mismo commit o el siguiente.

## P0 — Bloquea el lanzamiento

- [ ] **B-002: Verificación manual end-to-end de los 10 flujos del MVP en un solo recorrido.**
  Cada flujo de `VISION-MVP.md` se validó por separado en su propio plan; nunca se confirmaron los 10 juntos, en desktop y móvil, contra la API real. Usar el skill `webapp-testing`.
  **Criterio de aceptación:** los 10 flujos completados sin bloqueos en desktop y móvil; cualquier hallazgo se registra como nueva tarea (P0 si bloquea, P1 si no).

## P1 — Importante después del MVP

- [ ] **B-010: Copy legal real de soporte/privacidad/términos.**
  `src/routes/privacidad.tsx:129` y `src/routes/terminos.tsx:101` dicen literalmente "el soporte actual en la app es un placeholder de desarrollo". Requiere que José defina el copy definitivo — ver D-003 en `DECISIONES-PENDIENTES.md`. No implementar contenido legal por iniciativa propia.

## Bloqueado / requiere decisión humana

> A diferencia de B-*, estos NO son tareas que Claude pueda ejecutar — son preguntas abiertas para José. No llevan checkbox porque no se "hacen", se resuelven con una decisión.

- **D-001:** `GET /api/v1/tasa-actual` no existe en `DosisYa-Backend` (usado por `src/hooks/useTasa.ts`, degrada bien hoy). Ver `DECISIONES-PENDIENTES.md`.
- **D-002:** Auth de paciente por teléfono no existe en backend (`HojaLoginPaciente.tsx` es un placeholder de UI). Ver `DECISIONES-PENDIENTES.md`.
- **D-003:** Copy legal definitivo de soporte/privacidad/términos — quién lo redacta y cuándo reemplaza el placeholder. Ver `DECISIONES-PENDIENTES.md`.

## Hecho (referencia — no repetir)
Los 10 flujos obligatorios y las features adicionales listadas en `VISION-MVP.md` ya están mergeados; su historial vive en `docs/superpowers/specs/` y `docs/superpowers/plans/`. Este backlog no repite trabajo ya cerrado — solo lo que falta para el gate de lanzamiento.

- **B-001** (regresión de fan-out en `leadsLista.test.ts`) — resuelto en `main` por PR #21 (`d9692ee`, 2026-09-05), fuera de este backlog. `npx vitest run` en verde (75/75) al momento de mover esta marca.
