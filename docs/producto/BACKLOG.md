# Backlog de DosisYa (frontend)

> Última actualización: 2026-09-05.

> **Nota de esta actualización (2):** Al ejecutar B-002 se encontró y **resolvió** un incidente activo en producción: el proyecto Supabase estaba pausado (`INACTIVE`), causando 500 en toda búsqueda real. Ver detalle en `docs/contexto/errores-conocidos.md` y `ESTADO-PROYECTO.md`. B-002 se deja parcialmente completo (flujos 1-6 verificados contra producción real; 7-10 requieren credenciales de prueba — ver D-004). También se encontró un bug real de UI ([object Object] en el mensaje de ubicación) y se corrigió D-001 (el endpoint de tasa sí existe).

> **Nota de esta actualización (1):** B-001 se resolvió en `main` vía PR #21 (`d9692ee`, "serializa el fan-out de verdad") mientras este backlog estaba en revisión — no lo cerró este trabajo. Se movió a "Hecho" sin haber sido ejecutado desde aquí; verificado con `npx vitest run` (75/75 en verde) antes de mover la marca.

## Reglas de ejecución
- Ejecutar tareas en orden de prioridad (P0 antes que P1).
- No empezar una tarea marcada como bloqueada — pasar a la siguiente P0 no bloqueada.
- No crear funcionalidad fuera del MVP (ver `VISION-MVP.md`) sin registrarla primero como propuesta en `DECISIONES-PENDIENTES.md`.
- Antes de mover una tarea a "Hecho", cumplir todos sus criterios de aceptación y correr las validaciones de `CLAUDE.md` §6.
- Al cerrar una tarea, actualizar este archivo y `ESTADO-PROYECTO.md` en el mismo commit o el siguiente.

## P0 — Bloquea el lanzamiento

- [ ] **B-002: Verificación manual end-to-end de los 10 flujos del MVP en un solo recorrido.**
  **Estado (2026-09-05): parcial.** Verificado contra `https://dosisya-frontend.vercel.app` (producción real, desktop + móvil):
  - ✅ Flujo 1 (ubicación con fallback) — funciona; bug cosmético encontrado, ver B-011.
  - ✅ Flujo 2 (búsqueda por nombre) — funciona contra la API real.
  - ✅ Flujo 3 (resultados con stock/precio real) — funciona.
  - ✅ Flujo 4 (detalle de producto/farmacia, `/producto/$farmaciaId/$medicamentoId`) — funciona.
  - ✅ Flujo 5 (agregar varios medicamentos a la Lista Médica, localStorage) — funciona, persiste entre navegaciones.
  - ✅ Flujo 6 (selector de farmacia, ranking por match) — funciona, UI correcta hasta el botón "Contactar por WhatsApp".
  - ⛔ Flujos 7-10 (enviar por WhatsApp, lead real, panel de farmacia, panel súper-admin): no verificados — requerirían crear un lead facturable real o iniciar sesión en una cuenta real. Ver D-004 en `DECISIONES-PENDIENTES.md`. Las páginas `/admin/login` y `/super/login` sí se confirmaron renderizando sin errores de consola (verificación estructural, no funcional).
  - Durante esta verificación se encontró y **resolvió** un incidente en producción (Supabase pausado, 500 en toda búsqueda) — ver `docs/contexto/errores-conocidos.md`.
  **Criterio de aceptación (pendiente):** flujos 7-10 verificados — bloqueado por D-004.

- [ ] **B-011: Bug de UI — `[object Object]` en el mensaje de ubicación predeterminada.**
  Confirmado en producción real (desktop y móvil, `https://dosisya-frontend.vercel.app/buscar`): cuando falla la geolocalización, el mensaje muestra literalmente `⚠️ Usando ubicación predeterminada: Acarigua ([object Object])`. Causa: [src/hooks/useGeolocalizacion.ts:39](../../src/hooks/useGeolocalizacion.ts) hace `String(err)` sobre un `GeolocationPositionError`, que no es instancia de `Error` y no tiene `.message` — `String()` de un objeto plano produce `"[object Object]"`. El fallback en sí funciona bien (usa Acarigua, la búsqueda no se rompe); solo el texto del mensaje está roto. Visible a cualquier usuario real que no otorgue permiso de ubicación (caso común).
  **Criterio de aceptación:** el mensaje muestra un texto legible (p. ej. el nombre del error de geolocalización, o simplemente omitir el detalle técnico) en vez de `[object Object]`. Correr `npx tsc --noEmit`, `npx vitest run`, `npm run build`.

## P1 — Importante después del MVP

- [ ] **B-010: Copy legal real de soporte/privacidad/términos.**
  `src/routes/privacidad.tsx:129` y `src/routes/terminos.tsx:101` dicen literalmente "el soporte actual en la app es un placeholder de desarrollo". Requiere que José defina el copy definitivo — ver D-003 en `DECISIONES-PENDIENTES.md`. No implementar contenido legal por iniciativa propia.

- [ ] **B-012: `.claude/launch.json` → la config `dev-proxy-prod` está rota.**
  Fija la variable `DEV_API_PROXY`, que ningún código lee. `VITE_API_URL` queda indefinida y `src/lib/api.ts` cae al fallback absoluto (`https://proyecto-dosis-ya.vercel.app`), haciendo fetch directo desde el navegador — el backend no manda CORS para `localhost:5173`, así que toda petición falla. Solo afecta pruebas locales, no producción (confirmado: la propia `dosisya-frontend.vercel.app` no tiene este problema).
  **Criterio de aceptación:** o se elimina esa config de `.claude/launch.json`, o se corrige para que realmente proxee vía Vite (como hace `dev-backend-local`, que sí exporta `VITE_API_URL=` vacío).

## Bloqueado / requiere decisión humana

> A diferencia de B-*, estos NO son tareas que Claude pueda ejecutar — son preguntas abiertas para José. No llevan checkbox porque no se "hacen", se resuelven con una decisión.

- **D-002:** Auth de paciente por teléfono no existe en backend (`HojaLoginPaciente.tsx` es un placeholder de UI). Ver `DECISIONES-PENDIENTES.md`.
- **D-003:** Copy legal definitivo de soporte/privacidad/términos — quién lo redacta y cuándo reemplaza el placeholder. Ver `DECISIONES-PENDIENTES.md`.
- **D-004:** No hay entorno de staging ni credenciales de prueba documentadas para verificar los flujos 7-10 (lead real, panel de farmacia, panel súper-admin) sin tocar datos reales. Ver `DECISIONES-PENDIENTES.md`.

## Hecho (referencia — no repetir)
Los 10 flujos obligatorios y las features adicionales listadas en `VISION-MVP.md` ya están mergeados; su historial vive en `docs/superpowers/specs/` y `docs/superpowers/plans/`. Este backlog no repite trabajo ya cerrado — solo lo que falta para el gate de lanzamiento.

- **B-001** (regresión de fan-out en `leadsLista.test.ts`) — resuelto en `main` por PR #21 (`d9692ee`, 2026-09-05), fuera de este backlog. `npx vitest run` en verde (75/75) al momento de mover esta marca.
- **D-001** (endpoint `GET /api/v1/tasa-actual`) — resuelto: el endpoint existe y funciona, verificado 2026-09-05 contra producción real. Ver `DECISIONES-PENDIENTES.md`.
- **Incidente de producción — Supabase pausado** — detectado y resuelto 2026-09-05 durante B-002 (proyecto `bhqvijerlvdnbdgpbish` reactivado con `restore_project`, autorizado explícitamente por José). Ver `docs/contexto/errores-conocidos.md` para la causa raíz y cómo detectarlo a futuro.
