# Estado operativo de DosisYa (frontend)

## Última actualización
2026-09-05 (tercera pasada del día — B-002, verificación manual del MVP contra producción real)

## Estado del MVP
- Flujos obligatorios construidos: 10/10 (ver `VISION-MVP.md`).
- Flujos verificados contra producción real (2026-09-05): 1-6 de 10 (ver B-002 en `BACKLOG.md`). 7-10 requieren credenciales de prueba (D-004).
- Gate de lanzamiento cumplido: NO — falta completar B-002 (flujos 7-10), B-011 (bug de UI) y B-010 (copy legal).
- Próxima tarea recomendada: B-011 (arreglar `[object Object]` en el mensaje de ubicación — rápido, sin dependencias).
- Bloqueos activos: D-002, D-003, D-004 (ver `DECISIONES-PENDIENTES.md`). D-001 se resolvió hoy.

## Último trabajo realizado
- **Qué se cambió:** verificación manual end-to-end (B-002) contra `https://dosisya-frontend.vercel.app` (producción real), desktop y móvil.
- **Incidente encontrado y resuelto:** el proyecto Supabase de DosisYa (`bhqvijerlvdnbdgpbish`) estaba **pausado (`INACTIVE`)**, causando 500 en toda búsqueda real en producción — ningún paciente podía buscar medicamentos. Diagnosticado con `get_project`/`query_logs` del MCP de Supabase (logs mostraban `ClientHandler: (ENOTFOUND) tenant/user ... not found`, la huella de un proyecto pausado). **Reactivado con `restore_project`, autorizado explícitamente por José.** Confirmado `ACTIVE_HEALTHY` y búsqueda real devolviendo 200 con datos reales. Documentado en `docs/contexto/errores-conocidos.md` para detectarlo más rápido si se repite (el plan gratuito de Supabase pausa proyectos inactivos).
- **Hallazgos de esta pasada:**
  - Flujos 1-6 del MVP confirmados funcionando contra la API real (búsqueda, resultados con stock/precio real, detalle, Lista Médica multi-medicamento, selector de farmacia).
  - Bug real de UI: `[object Object]` en el mensaje de ubicación predeterminada (`src/hooks/useGeolocalizacion.ts:39`) — confirmado en producción, desktop y móvil. Nuevo ítem **B-011**.
  - D-001 estaba desactualizado: el endpoint `GET /api/v1/tasa-actual` **sí existe y funciona** (se implementó después del spec original sin actualizar este backlog). Corregido.
  - La config `dev-proxy-prod` de `.claude/launch.json` está rota (variable de entorno que nadie lee, causa CORS en pruebas locales). No afecta producción. Nuevo ítem **B-012**.
  - Flujos 7-10 no se pudieron verificar de forma segura: no hay entorno de staging, y las únicas credenciales de BD completas en `DosisYa-Backend` (`.env.vercel.prod`) son de producción real. Nueva decisión **D-004**.
- **Archivos modificados:** `docs/producto/BACKLOG.md`, `docs/producto/DECISIONES-PENDIENTES.md`, `docs/producto/ESTADO-PROYECTO.md` (este archivo), `docs/contexto/errores-conocidos.md`.
- **Validaciones ejecutadas:**
  - `curl https://proyecto-dosis-ya.vercel.app/api/v1/medicamentos/buscar?...` → 200 con resultados reales (antes: 500).
  - `curl https://proyecto-dosis-ya.vercel.app/api/v1/tasa-actual` → 200 con datos reales.
  - Recorrido manual en `https://dosisya-frontend.vercel.app` (desktop 1280×720 y móvil 375×812) vía Browser pane.
- **Commit:** ver historial de esta rama (`git log --oneline`).

## Riesgos o deuda técnica
- El proyecto Supabase puede volver a pausarse por inactividad (plan gratuito) — considerar plan pago o un ping periódico si se repite (ver `docs/contexto/errores-conocidos.md`).
- Flujos 7-10 del MVP (lead real, panel de farmacia, panel súper-admin) siguen sin verificación end-to-end real — bloqueado por D-004.
- Placeholders visibles a usuarios reales en `/privacidad` y `/terminos` (B-010 / D-003).
- `main` avanzó con al menos 2 PRs más (#20 landing, #21 fix de leads) mientras el PR #22 (sistema de backlog) estaba en revisión — antes de mergear, confirmar que no hay conflictos.

## Próximo paso exacto
1. Leer `docs/producto/BACKLOG.md`, tomar **B-011** (P0, no bloqueada, sin dependencias): arreglar el mensaje `[object Object]` en `src/hooks/useGeolocalizacion.ts:39`.
2. Aplicar el fix (usar `err.message` cuando exista, o un fallback legible para `GeolocationPositionError`), correr `npx tsc --noEmit`, `npx vitest run`, `npm run build`.
3. Actualizar este archivo y marcar B-011 como hecho en `docs/producto/BACKLOG.md`.
4. Cuando José responda D-004, retomar B-002 para verificar los flujos 7-10.
