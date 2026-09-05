# Spec: Sistema de trabajo autónomo para el producto DosisYa (frontend)

**Fecha:** 2026-09-05
**Estado:** aprobado en diseño, pendiente de plan de implementación
**Contexto:** José recibió una propuesta externa (documento pegado en el chat, generado por otra IA a partir de una versión anterior de `CLAUDE.md`) que argumenta, correctamente, que `CLAUDE.md` es una buena "constitución técnica" pero no da a Claude una cola de trabajo priorizada, una definición de "terminado", ni límites de decisión explícitos entre sesiones. Pide implementar ese sistema.

El documento asume un proyecto que empieza de cero. **No es el caso.** Antes de diseñar, se auditó el estado real del repo (ver §1) y el diseño de este spec adapta la propuesta a esa realidad en vez de copiar su contenido de ejemplo.

## 1. Estado actual (verificado antes de diseñar)

- El repo **ya tiene** un flujo spec→plan→implementación vía los skills instalados (`brainstorming`, `writing-plans`, `executing-plans`, `subagent-driven-development`, `verification-before-completion`, `requesting-code-review`), documentado en `docs/superpowers/specs/` y `docs/superpowers/plans/` (24 y 13 archivos respectivamente a esta fecha). Ese flujo cubre gran parte de lo que el documento externo llama "ciclo obligatorio" y "Definition of Done".
- Los 10 "flujos obligatorios para lanzar" que el documento usa como ejemplo genérico de MVP **ya están implementados y mergeados**, cada uno con su propio spec/plan:
  1. Búsqueda geolocalizada — spec/plan `2026-07-12-busqueda-v2`.
  2. Resultados y detalle de farmacia con stock real — mismo spec + ruta `producto.$farmaciaId.$medicamentoId.tsx`.
  3. Lista Médica multi-medicamento — commit `ddbb253` ("Lista Médica multi-producto — carrito, drawer y selector de farmacia"), componentes en `src/components/lista/`.
  4. Selección de farmacia y contacto por WhatsApp — `SelectorFarmacia.tsx`, spec `2026-07-13-lead-premium-origen`.
  5. Registro correcto de leads CPC (fan-out) — `docs/contexto/decisiones.md` §"Consolidación de la capa de red", spec `2026-07-13-lead-premium-escaner`.
  6. Flujo de receta con IA — `docs/features/receta-ia-y-carrito.md`, `receta-ia-optimizacion-gemini.md`, spec/plan `2026-08-05/06-modo-farmaceutico-escaner-recipe`.
  7. Dashboard de farmacia — spec/plan `2026-07-13-admin-farmacia-completar`, commits `0aace62` (progreso de upload), `91fa24d` (fijar ubicación).
  8. Validación de ubicación antes de aprobación de farmacia — commit `c2d4fe5`, documentado en `CLAUDE.md` §5.
  9. Panel de superadmin — spec/plan `2026-07-14-super-admin-panel`, fix `3d54854` (#19).
  10. Chat IA / asistente flotante — spec/plan `2026-07-26` y `2026-07-27`, fix `4809a90` (#16).

  Conclusión: el frontend **no está "por construir"**, está por **cerrar el gate de calidad** antes de considerarlo lanzable.

- **CI roto en `main` ahora mismo:** `.github/workflows/ci.yml` corre `npx tsc --noEmit`, `npm test` y `npm run build` en cada push/PR a `main`. Verificado en este worktree (rama `claude/autonomous-claude-system-8b01f8`, sincronizada con `main`):
  - `npx tsc --noEmit` → limpio (exit 0).
  - `npx vitest run` → **3 de 74 tests fallan**, los 3 en `src/lib/leadsLista.test.ts` (fan-out de leads). Coincide con la regresión ya registrada en memoria (`regresion-leadslista-fanout-2026-08.md`): un refactor rompió la serialización de leads y quedó sin detectar porque `CLAUDE.md` §6 no exige `npm test` antes de commitear.
  - `npm run build` → se ejecuta como parte de esta spec; el resultado se vuelca a `docs/producto/ESTADO-PROYECTO.md` en la fase de implementación.
- Hallazgos concretos de gaps reales (por grep, no supuestos):
  - `src/routes/privacidad.tsx:129` y `terminos.tsx:101` dicen literalmente *"el soporte actual en la app es un placeholder de desarrollo"* → copy legal real pendiente.
  - `src/hooks/useTasa.ts` espera `GET /api/v1/tasa-actual` (spec `2026-07-26`), endpoint que **no existe en `DosisYa-Backend`**. Ya degrada bien (oculta el chip, `retry:false`, catch silencioso), no es un bug — es una dependencia de backend pendiente.
  - `src/components/paciente/HojaLoginPaciente.tsx` es un placeholder explícito ("Continuar con teléfono") a la espera de auth de paciente en backend, que no existe. Correctamente fuera del MVP (filosofía Cero Fricción, `CLAUDE.md` §1).
- No existe hoy ningún archivo bajo `docs/producto/` ni `.claude/agents/`.

## 2. Objetivo de este spec

Añadir la "capa de ejecución" que falta — backlog priorizado, definición de MVP/DoD, registro de estado entre sesiones, límites de autonomía — **sin duplicar** el ciclo spec→plan→implementación que los skills ya cubren, y con contenido inicial basado en el estado real del repo, no en el ejemplo del documento.

## 3. Alcance

### 3.1 `docs/producto/VISION-MVP.md`

No describe qué construir (ya existe); describe el **gate de lanzamiento**:
- Objetivo de negocio (igual al de `CLAUDE.md` §1, una frase).
- Los 10 flujos, cada uno marcado `✅ construido` con la referencia de §1 de este spec (spec/plan/commit).
- "No pertenece al MVP": pago en la plataforma, comisión por venta, login de paciente completo, logística propia — igual que el documento original, sigue siendo correcto.
- **Definition of Done del MVP**, atada a comandos reales del repo:
  - `npx tsc --noEmit` sin errores.
  - `npm run build` sin errores.
  - `npx vitest run` en verde (hoy no se cumple — 3 tests rojos).
  - `scripts/test-leads-cpc.sh` pasa.
  - CI en verde en `main` (job `verify` de `.github/workflows/ci.yml`).
  - Los 10 flujos verificados **juntos en un solo recorrido manual** (nunca se ha hecho — cada uno se validó por separado en su propio plan).
  - Sin mocks activos en funcionalidades declaradas operativas (confirmado: el mock de `recipeIA` ya se eliminó, commit `c85f157`).

### 3.2 `docs/producto/BACKLOG.md`

Reglas de ejecución (adaptadas del documento): ejecutar en orden de prioridad, no empezar una tarea bloqueada, no crear funcionalidad fuera del MVP sin registrarla como propuesta en `DECISIONES-PENDIENTES.md`, no marcar "Hecho" sin cumplir los criterios de aceptación.

**P0 — Bloquea el lanzamiento** (todo verificado, no inventado):
- B-001: Reparar los 3 tests rojos de `src/lib/leadsLista.test.ts` (CI roto en `main`).
- B-002: Verificación manual end-to-end de los 10 flujos del MVP en un solo recorrido (desktop + móvil), usando `webapp-testing`.
- B-003: Confirmar `npm run build` en verde (pendiente de resultado al momento de escribir este spec).

**P1 — Importante después del MVP:**
- B-010: Copy legal real de soporte/privacidad/términos (hoy placeholder de desarrollo).

**Bloqueado / requiere decisión humana** (referencian `DECISIONES-PENDIENTES.md`):
- D-001: `GET /api/v1/tasa-actual` no existe en `DosisYa-Backend`.
- D-002: Auth de paciente por teléfono no existe en backend (login opcional, fuera del MVP).
- D-003: Copy legal definitivo (quién lo redacta, cuándo se reemplaza el placeholder).

No se inventan tareas P1 adicionales especulativas (ej. "mejoras de accesibilidad genéricas") porque no hay evidencia concreta de qué falta — se agregarán cuando aparezca una señal real (bug reportado, hallazgo de auditoría B-002, etc.).

### 3.3 `docs/producto/ESTADO-PROYECTO.md`

Mismo formato que el documento original. Se inicializa en la fase de implementación con:
- Fecha: 2026-09-05.
- Resultado real de `tsc`/`test`/`build` (ejecutados en esta sesión).
- Commit actual (`9da1061` al momento de este spec).
- Próxima tarea recomendada: B-001.
- Bloqueos activos: D-001, D-002, D-003.

### 3.4 `docs/producto/DECISIONES-PENDIENTES.md`

Una entrada por decisión bloqueada (D-001, D-002, D-003 de §3.2), con: pregunta, contexto, opciones, impacto de no decidir, estado.

### 3.5 `CLAUDE.md` — nueva sección 8 (delgada)

Se añade **al final** de `CLAUDE.md` (no reemplaza nada existente). A diferencia del bloque de 8 pasos que trae el documento original, esta versión:
- Define **orden de lectura** (`CLAUDE.md` → `VISION-MVP.md` → `BACKLOG.md` → `ESTADO-PROYECTO.md` → spec de `docs/features/` aplicable → `docs/contexto/` si el cambio es grande) y **cómo elegir tarea** (la P0 no bloqueada de mayor prioridad en `BACKLOG.md`).
- Para "cómo ejecutar la tarea", **remite a los skills instalados** en vez de redefinir un ciclo propio: `brainstorming` (si cambia alcance/UX) → `writing-plans` → `executing-plans` / `subagent-driven-development` → `verification-before-completion` → `requesting-code-review`.
- Tabla de autonomía en tres niveles (Desarrollo local / Integración / Producción), acordada con José:

  | Nivel | Claude puede hacerlo solo | Requiere aprobación |
  |---|---|---|
  | Desarrollo local | Leer frontend/backend, editar frontend, tests, docs, commits locales atómicos | — |
  | Integración | — | Cambios de backend/BD/Supabase/n8n, nuevas dependencias de producción, variables de entorno |
  | Producción | — | Push, PR, merge a `main`, deploy, secretos, cambios de negocio/precio/flujo de pacientes |

- Lista de "requiere autorización humana explícita" (igual que el documento, ya cubre casos reales del proyecto: tocar backend/BD/Supabase/n8n, deploy manual, push/PR/merge a main, cambios de modelo de negocio, dependencias de producción nuevas, inventar/alterar contratos de API, eliminar funcionalidad/datos, decisiones de UX/negocio sin spec existente) → si se topa con uno, **documentar en `DECISIONES-PENDIENTES.md` y seguir con la siguiente P0 no bloqueada**, nunca quedarse detenido.
- Recordatorio de mantener `ESTADO-PROYECTO.md` y `BACKLOG.md` actualizados al cerrar cada tarea.

No se duplica la Definition of Done por feature (ya vive en cada spec de `docs/features/`) ni el ciclo de trabajo (ya vive en los skills).

### 3.6 `.claude/agents/{frontend,qa,auditor-api}.md`

Tres subagentes de proyecto (Claude Code los carga automáticamente desde `.claude/agents/`). Se crean ahora sin un caso de uso disparador inmediato (decisión explícita de José), así que cada uno debe ser autosuficiente: **repite inline** las reglas duras de `CLAUDE.md` (no tocar backend sin autorización, no editar `src/routeTree.gen.ts`, no crear `src/pages/`/`src/services/`, nunca llamar a Gemini desde React, `tipo_interaccion` no `tipo_accion`, trailing slash en `/api/v1/leads/`) por si el subagente no hereda el `CLAUDE.md` de la sesión principal — no se puede asumir que sí.

- **`frontend.md`** — Implementa el alcance de una tarea P0/P1 de `docs/producto/BACKLOG.md`, solo dentro de `src/` del frontend. Herramientas: lectura/escritura de archivos, Bash (lint/tsc/tests/build), sin acceso a operaciones de red destructivas. No hace push ni toca `DosisYa-Backend`.
- **`qa.md`** — Solo valida: corre `npx tsc --noEmit`, `npm run build`, `npx vitest run`, `scripts/test-leads-cpc.sh` (si aplica) y una pasada de `webapp-testing` (estados de carga/vacío/error/éxito + móvil). Reporta pass/fail con evidencia. No edita código de producto (puede anotar hallazgos en `ESTADO-PROYECTO.md`).
- **`auditor-api.md`** — Antes de implementar una llamada HTTP nueva o modificada, verifica el contrato real contra `DosisYa-Backend` (usa el skill `contrato-api`: lee `routers/`, `models.py`, `db/schema.sql`). Solo lectura sobre el backend; nunca lo modifica. Reporta mismatches de campos/enums/rutas.

## 4. Fuera de alcance

- No se corrige la regresión de `leadsLista.test.ts` en este spec (queda como B-001 en el backlog, para su propio ciclo spec→plan si hace falta, o fix directo si es trivial — se decide al tomar esa tarea).
- No se modifica `DosisYa-Backend` (los dos hallazgos que lo requieren, D-001 y D-002, quedan documentados como bloqueados).
- No se reescribe el `CLAUDE.md` existente (§1–§7): la nueva sección 8 se añade al final, sin tocar el resto.
- No se crean specs/plans nuevos para features de producto — este spec es sobre el sistema de proceso, no sobre una feature de DosisYa.

## 5. Riesgo / nota

Este es el primer corte de `BACKLOG.md`/`VISION-MVP.md` basado en una auditoría de código de una sesión, no en una revisión exhaustiva de cada flujo en el navegador. B-002 (verificación manual end-to-end) existe justamente para cerrar esa brecha — hasta que se corra, "los 10 flujos están construidos" es una observación de código, no una garantía de que funcionan correctamente en conjunto contra la API real.
