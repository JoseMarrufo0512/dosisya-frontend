# Sistema de Trabajo Autónomo del Producto — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir la capa de ejecución que falta en DosisYa-Frontend — backlog priorizado, definición de MVP/DoD, registro de estado entre sesiones y límites de autonomía — con contenido basado en el estado real del repo (auditado en la spec), sin duplicar el ciclo spec→plan→implementación que los skills instalados ya cubren.

**Architecture:** Ocho archivos nuevos/editados, todos de contenido estático (Markdown + frontmatter de subagentes). No hay código de aplicación, no hay lógica, no hay dependencias nuevas. Cada tarea crea o edita un archivo, verifica su contenido con `grep`/`test -f`, y commitea.

**Tech Stack:** Markdown. Frontmatter YAML para `.claude/agents/*.md` (formato de subagentes de Claude Code).

## Global Constraints

- El contenido de `docs/producto/*` debe basarse en los hallazgos reales de `docs/superpowers/specs/2026-09-05-sistema-autonomo-producto-design.md` §1 — no inventar tareas ni "features típicas" que no tengan evidencia en el repo.
- No modificar el contenido existente de `CLAUDE.md` (secciones 1–7): la única edición es **añadir** una sección 8 nueva al final del archivo.
- No modificar nada en `DosisYa-Backend`.
- No hacer `git push` ni tocar `main` — todos los commits son locales, en la rama actual del worktree.
- No crear specs ni plans de features de producto — este plan es sobre el sistema de proceso en sí.
- Cada `.claude/agents/*.md` debe repetir inline las reglas duras de `CLAUDE.md` (no tocar backend, no editar `routeTree.gen.ts`, no Gemini desde React, `tipo_interaccion`, trailing slash en `/api/v1/leads/`) — nunca asumir que el subagente hereda el `CLAUDE.md` de la sesión principal.

---

### Task 1: `docs/producto/VISION-MVP.md`

**Files:**
- Create: `docs/producto/VISION-MVP.md`

**Interfaces:**
- Consumes: nada (primer archivo del plan).
- Produces: referencias `B-001`, `B-002` que Task 2 (`BACKLOG.md`) debe usar con los mismos identificadores; referencia `D-002` que Task 3 (`DECISIONES-PENDIENTES.md`) debe definir con el mismo identificador.

- [ ] **Step 1: Crear el directorio y el archivo**

Contenido exacto de `docs/producto/VISION-MVP.md`:

```markdown
# MVP de DosisYa — Gate de lanzamiento

> Última actualización: 2026-09-05. Este documento no describe qué construir — los flujos obligatorios ya están construidos (ver abajo). Describe qué falta para poder llamarlo "lanzable".

## Objetivo
Permitir que un paciente en Acarigua/Araure encuentre medicamentos disponibles en farmacias cercanas y contacte a una farmacia por WhatsApp, sin crear cuenta.

## Flujos obligatorios para lanzar (estado real)

1. ✅ Un paciente permite ubicación o selecciona una ubicación alternativa. — spec `docs/superpowers/specs/2026-07-12-busqueda-v2-design.md`.
2. ✅ Busca un medicamento por nombre. — mismo spec.
3. ✅ Ve resultados reales de farmacias dentro del radio permitido. — mismo spec (`ST_DWithin`, ver `CLAUDE.md` §5).
4. ✅ Puede abrir el detalle de un medicamento y de la farmacia. — ruta `src/routes/producto.$farmaciaId.$medicamentoId.tsx`.
5. ✅ Puede agregar varios medicamentos a la Lista Médica. — commit `ddbb253`, `src/components/lista/`.
6. ✅ Puede seleccionar una farmacia para su Lista Médica. — `src/components/lista/SelectorFarmacia.tsx` (creado en el mismo commit `ddbb253`).
7. ✅ Puede enviar la Lista Médica por WhatsApp. — `src/lib/whatsapp.ts`, `src/lib/leadsLista.ts`.
8. ✅ Cada acción comercial relevante genera el lead correcto (fan-out). — `docs/contexto/decisiones.md` §"Consolidación de la capa de red", spec `docs/superpowers/specs/2026-07-13-lead-premium-escaner-design.md` (origen `busqueda`/`lista_medica`/`escaner_recipe` para facturación premium). **En riesgo:** ver B-001 en `BACKLOG.md` (3 tests rojos en `leadsLista.test.ts` en `main`).
9. ✅ Una farmacia puede gestionar su información e inventario desde su panel. — spec `docs/superpowers/specs/2026-07-13-admin-farmacia-completar-design.md`, `src/routes/admin.dashboard.tsx`.
10. ✅ Un superadmin puede revisar y aprobar farmacias (con ubicación). — commit `c2d4fe5`, spec `docs/superpowers/specs/2026-07-14-super-admin-panel-design.md`.

Funcionalidad adicional ya construida, fuera de la lista original de 10 pero parte del producto real: escáner de receta con IA (paciente y modo farmacéutico), chat/asistente IA flotante, verificación en vivo de RIF en el registro, facturación con leads premium, landing `/acerca-de`, términos y privacidad.

## No pertenece al MVP
- Pago dentro de la plataforma.
- Comisión por venta.
- Login de paciente completo (existe un placeholder de UI en `src/components/paciente/HojaLoginPaciente.tsx`; el backend de auth de paciente no existe — ver D-002 en `DECISIONES-PENDIENTES.md`).
- Logística propia.
- Funciones no especificadas en `docs/features/`.

## Definition of Done del MVP
El MVP se considera terminado solo si:
- [ ] `npx tsc --noEmit` pasa sin errores.
- [ ] `npm run build` pasa sin errores.
- [ ] `npx vitest run` pasa en verde (**hoy no se cumple** — ver B-001 en `BACKLOG.md`).
- [ ] `scripts/test-leads-cpc.sh` pasa.
- [ ] El job `verify` de `.github/workflows/ci.yml` está en verde en `main`.
- [ ] Los 10 flujos de arriba se verifican **juntos, en un solo recorrido manual**, en desktop y móvil, contra la API real (ver B-002 en `BACKLOG.md` — nunca se ha hecho; cada flujo se validó por separado en su propio plan).
- [ ] No hay mocks activos en funcionalidades declaradas operativas (confirmado: el mock de `recipeIA` se eliminó en el commit `c85f157`).
- [ ] El despliegue de Vercel funciona y no muestra errores de consola críticos.

## Cómo se actualiza este documento
Cuando una tarea de `BACKLOG.md` cierra un ítem de la Definition of Done, marca el checkbox aquí y anota el resultado en `ESTADO-PROYECTO.md`. Si aparece un flujo nuevo que el negocio considera obligatorio para lanzar, agrégalo aquí primero (requiere decisión de José — ver "Requiere autorización humana explícita" en `CLAUDE.md` §8) antes de crear tareas para él en `BACKLOG.md`.
```

- [ ] **Step 2: Verificar que el archivo quedó bien formado**

Run: `test -f docs/producto/VISION-MVP.md && grep -c '^## ' docs/producto/VISION-MVP.md`
Expected: el archivo existe y el conteo de encabezados `## ` es `5` (Objetivo, Flujos obligatorios, No pertenece al MVP, Definition of Done, Cómo se actualiza).

- [ ] **Step 3: Commit**

```bash
git add docs/producto/VISION-MVP.md
git commit -m "docs(producto): agrega VISION-MVP.md con el gate de lanzamiento real

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: `docs/producto/BACKLOG.md`

**Files:**
- Create: `docs/producto/BACKLOG.md`

**Interfaces:**
- Consumes: identificadores `B-001`, `B-002` y referencia a `VISION-MVP.md` de Task 1.
- Produces: identificadores `B-001`, `B-002`, `B-003`, `B-010`, `D-001`, `D-002`, `D-003` que Task 3 (`DECISIONES-PENDIENTES.md`) y Task 4 (`ESTADO-PROYECTO.md`) deben usar exactamente igual (mismo texto de identificador, sin renombrar).

- [ ] **Step 1: Crear el archivo**

Contenido exacto de `docs/producto/BACKLOG.md`:

```markdown
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
```

- [ ] **Step 2: Verificar identificadores**

Run: `grep -oE '\b[BD]-[0-9]{3}\b' docs/producto/BACKLOG.md | sort -u`
Expected:
```
B-001
B-002
B-003
B-010
D-001
D-002
D-003
```

- [ ] **Step 3: Commit**

```bash
git add docs/producto/BACKLOG.md
git commit -m "docs(producto): agrega BACKLOG.md con hallazgos reales del repo

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: `docs/producto/DECISIONES-PENDIENTES.md`

**Files:**
- Create: `docs/producto/DECISIONES-PENDIENTES.md`

**Interfaces:**
- Consumes: identificadores `D-001`, `D-002`, `D-003` de Task 2.
- Produces: nada consumido por tareas posteriores (Task 4 solo referencia el nombre del archivo, no su contenido).

- [ ] **Step 1: Crear el archivo**

Contenido exacto de `docs/producto/DECISIONES-PENDIENTES.md`:

```markdown
# Decisiones pendientes (requieren a José)

> Cada entrada bloquea una tarea de `BACKLOG.md`. No se implementan por iniciativa propia — se documentan aquí y se continúa con la siguiente tarea P0 no bloqueada.

## D-001: Endpoint `GET /api/v1/tasa-actual` no existe en el backend
- **Contexto:** `src/hooks/useTasa.ts` (spec `docs/superpowers/specs/2026-07-26-asistente-ia-flotante-y-paridad-mockup-design.md`) espera este endpoint para mostrar la tasa USD→VES. Hoy no existe en `DosisYa-Backend`; el hook ya degrada bien (`retry:false`, catch silencioso, oculta el chip si falla).
- **Opciones:** (a) implementar el endpoint en el backend (requiere autorización expresa para tocar `DosisYa-Backend`, per `CLAUDE.md` §2); (b) dejarlo bloqueado indefinidamente y ocultar el chip permanentemente; (c) quitar la UI que depende de él.
- **Impacto de no decidir:** ninguno crítico — el frontend no falla, solo no muestra la tasa. No bloquea el MVP.
- **Estado:** abierta.

## D-002: Auth de paciente por teléfono no existe en el backend
- **Contexto:** `src/components/paciente/HojaLoginPaciente.tsx` tiene un botón "Continuar con teléfono" que hoy solo muestra un toast ("Pronto podrás..."). No hay auth de paciente en `DosisYa-Backend` (solo farmacia/superadmin), y por diseño (Cero Fricción, `CLAUDE.md` §1) el login de paciente es opcional y está fuera del MVP.
- **Opciones:** (a) mantener el placeholder tal cual hasta que haya un caso de negocio real para cuentas de paciente; (b) quitar el botón si genera expectativa falsa en usuarios reales.
- **Impacto de no decidir:** bajo — es un flujo opcional, no bloquea ningún flujo obligatorio del MVP.
- **Estado:** abierta.

## D-003: Copy legal definitivo de soporte/privacidad/términos
- **Contexto:** `src/routes/privacidad.tsx` y `src/routes/terminos.tsx` incluyen literalmente el texto "el soporte actual en la app es un placeholder de desarrollo" en la sección de contacto/soporte.
- **Opciones:** (a) José redacta o aprueba el copy real (canal de soporte, datos de contacto, políticas reales); (b) delegar la redacción a Claude con una revisión legal humana antes de publicar.
- **Impacto de no decidir:** riesgo de imagen/legal si se lanza a producción con placeholders visibles a usuarios reales — recomendado resolver antes del lanzamiento, aunque no bloquea el desarrollo de otros flujos.
- **Estado:** abierta.
```

- [ ] **Step 2: Verificar identificadores contra BACKLOG.md**

Run: `grep -oE '^## D-[0-9]{3}' docs/producto/DECISIONES-PENDIENTES.md`
Expected:
```
## D-001
## D-002
## D-003
```

- [ ] **Step 3: Commit**

```bash
git add docs/producto/DECISIONES-PENDIENTES.md
git commit -m "docs(producto): agrega DECISIONES-PENDIENTES.md con las 3 decisiones bloqueadas

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: `docs/producto/ESTADO-PROYECTO.md`

**Files:**
- Create: `docs/producto/ESTADO-PROYECTO.md`

**Interfaces:**
- Consumes: resultados reales de `npx tsc --noEmit`, `npx vitest run` y `npm run build` ya obtenidos durante la sesión de diseño (tsc limpio; vitest 3/74 rojos en `leadsLista.test.ts`; build limpio, cliente + SSR).
- Produces: nada consumido por tareas posteriores.

- [ ] **Step 1: Crear el archivo**

Contenido exacto de `docs/producto/ESTADO-PROYECTO.md`:

```markdown
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
```

- [ ] **Step 2: Verificar secciones**

Run: `grep -c '^## ' docs/producto/ESTADO-PROYECTO.md`
Expected: `5` (Última actualización, Estado del MVP, Último trabajo realizado, Riesgos o deuda técnica, Próximo paso exacto).

- [ ] **Step 3: Commit**

```bash
git add docs/producto/ESTADO-PROYECTO.md
git commit -m "docs(producto): agrega ESTADO-PROYECTO.md con el estado real al 2026-09-05

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Sección 8 de `CLAUDE.md`

**Files:**
- Modify: `CLAUDE.md` (append al final, después de la línea 51 — no tocar nada de las líneas 1–51)

**Interfaces:**
- Consumes: nombres de archivo `docs/producto/{VISION-MVP,BACKLOG,ESTADO-PROYECTO,DECISIONES-PENDIENTES}.md` de Tasks 1–4 (deben coincidir exactamente).
- Produces: nada consumido por tareas posteriores.

- [ ] **Step 1: Confirmar que no se ha tocado el archivo todavía**

Run: `wc -l CLAUDE.md`
Expected: `51 CLAUDE.md` (si el número es distinto, alguien más editó el archivo desde la spec — releer antes de continuar).

- [ ] **Step 2: Añadir la sección 8 al final del archivo**

Usa el editor de archivos para **añadir** (no reemplazar nada existente) el siguiente bloque al final de `CLAUDE.md`, precedido por una línea en blanco:

```markdown

## 8. Protocolo de Trabajo Autónomo

### Misión
Llevar el frontend de DosisYa al gate de lanzamiento definido en `docs/producto/VISION-MVP.md` de forma iterativa, segura y verificable — sin depender de una aprobación por cada microdecisión de desarrollo local.

### Orden de lectura antes de tomar una tarea
1. Este archivo (`CLAUDE.md`).
2. `docs/producto/VISION-MVP.md` — qué falta para poder llamar "lanzable" al MVP.
3. `docs/producto/BACKLOG.md` — la cola de trabajo priorizada.
4. `docs/producto/ESTADO-PROYECTO.md` — qué se hizo en la última sesión y cuál es el próximo paso exacto.
5. La especificación aplicable en `docs/features/` (si la tarea es una feature con spec propia).
6. `docs/contexto/` antes de cambios grandes.

### Selección de tarea
Elegir siempre la tarea P0 no bloqueada de mayor prioridad en `docs/producto/BACKLOG.md`. No inventar tareas nuevas ni reordenar prioridades sin registrar la propuesta en `docs/producto/DECISIONES-PENDIENTES.md`.

### Cómo ejecutar una tarea
El ciclo de trabajo ya existe como skills — no lo reinventes:
`brainstorming` (si la tarea cambia alcance o UX) → `writing-plans` → `executing-plans` o `subagent-driven-development` → `verification-before-completion` → `requesting-code-review`.
Antes de escribir cualquier llamada HTTP nueva o modificada, verificar el contrato real con el skill `contrato-api`.

### Niveles de autonomía

| Nivel | Puedes hacerlo solo | Requiere aprobación explícita de José |
|---|---|---|
| Desarrollo local | Leer frontend y backend, editar frontend, crear/editar tests y docs, refactors pequeños, correr lint/tsc/build/tests, commits locales atómicos | — |
| Integración | — | Cambios en `DosisYa-Backend`, Supabase, n8n; nuevas dependencias de producción; variables de entorno o secretos |
| Producción | — | Push, PR, merge a `main`, deploy manual, cambios de modelo de negocio/precios/flujo de pacientes |

### Requiere autorización humana explícita
Detente y registra la pregunta en `docs/producto/DECISIONES-PENDIENTES.md` si necesitas:
- Modificar el backend, la base de datos, Supabase o n8n.
- Desplegar manualmente, cambiar variables de entorno o secretos.
- Hacer push, crear PR o tocar la rama principal.
- Cambiar el modelo de negocio, precios, cobros o flujo de pacientes.
- Agregar dependencias de producción.
- Inventar o alterar contratos de API.
- Eliminar funcionalidad, datos o archivos relevantes.
- Tomar una decisión de UX o negocio sin una especificación existente.

Cuando haya un bloqueo, no te quedes detenido: documenta el bloqueo en `docs/producto/DECISIONES-PENDIENTES.md` y continúa con la siguiente tarea P0 no bloqueada de `docs/producto/BACKLOG.md`.

### Cierre de tarea
Al terminar una tarea (o al bloquearte), actualiza `docs/producto/ESTADO-PROYECTO.md` y marca el ítem correspondiente en `docs/producto/BACKLOG.md`.
```

- [ ] **Step 3: Verificar que las secciones 1–7 no cambiaron y que la 8 se agregó**

Run: `head -51 CLAUDE.md | md5sum && git show HEAD:CLAUDE.md | head -51 | md5sum`
Expected: los dos hashes son idénticos (las primeras 51 líneas no cambiaron).

Run: `grep -c '^## 8\. Protocolo de Trabajo Autónomo$' CLAUDE.md`
Expected: `1`

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(claude): añade sección 8 — Protocolo de Trabajo Autónomo

Remite a los skills instalados para el ciclo de ejecución (no lo
duplica); define orden de lectura de docs/producto/, selección de
tarea y los tres niveles de autonomía acordados con José.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: `.claude/agents/frontend.md`

**Files:**
- Create: `.claude/agents/frontend.md`

**Interfaces:**
- Consumes: nada.
- Produces: subagente `frontend` disponible para Task tool.

- [ ] **Step 1: Crear el archivo**

Contenido exacto de `.claude/agents/frontend.md`:

```markdown
---
name: frontend
description: Implementa el alcance de una tarea P0/P1 de docs/producto/BACKLOG.md dentro del frontend de DosisYa (React 19 + TanStack Start/Router + Vite + TypeScript). Úsalo cuando ya elegiste una tarea del backlog y necesitas escribir el código.
tools: Read, Write, Edit, Bash, Glob, Grep
---

Eres el implementador de frontend de DosisYa. Trabajas dentro de este repo (`DosisYa-Frontend`) únicamente.

Reglas duras (no negociables, no asumas que las heredas de otra sesión — repítetelas):
- **Nunca** llames a Gemini desde React. Las imágenes de recetas van al backend FastAPI (`POST /api/v1/ia/analizar-recipe`); solo el backend habla con Gemini.
- **Nunca** modifiques `DosisYa-Backend`, Supabase, n8n ni variables de entorno/secretos sin que José lo haya autorizado explícitamente en esta conversación. Si tu tarea lo requiere, detente y documenta el bloqueo en `docs/producto/DECISIONES-PENDIENTES.md` en vez de tocarlo.
- **Nunca** edites `src/routeTree.gen.ts` a mano (es autogenerado) ni crees `src/pages/` o `src/services/` (no existen en esta estructura).
- El campo del lead es `tipo_interaccion` (no `tipo_accion`); valores canónicos: `clic_whatsapp`, `clic_llamar`, `ver_mapa`, `ver_detalle`, `compartir`, `capture_pantalla`. `medicamento_buscado_id` es un UUID único nullable, NO un array — multi-producto es fan-out (un POST por medicamento).
- `POST /api/v1/leads/` lleva trailing slash.
- No inventes rutas ni campos de API: antes de escribir o modificar una llamada HTTP, usa el skill `contrato-api` o lee directamente `DosisYa-Backend/src/dosisya/{models.py,routers/,db/schema.sql}`.
- Los POST de leads son fire-and-forget (asíncronos, `keepalive: true` si abres `wa.me` después) — nunca bloquees la UI esperando esa respuesta.

Flujo de trabajo:
1. Lee la tarea en `docs/producto/BACKLOG.md` y su spec en `docs/features/` si existe.
2. Si la tarea cambia alcance o UX de forma no trivial, usa el skill `brainstorming` antes de codear.
3. Implementa solo el alcance de la tarea — no expandas el scope sin registrar una propuesta en `docs/producto/DECISIONES-PENDIENTES.md`.
4. Corre `npx tsc --noEmit`, `npm run lint`, `npx vitest run` y `npm run build`; si tocaste `leads*.ts` o `whatsapp.ts`, corre también `scripts/test-leads-cpc.sh`.
5. Deja un commit local atómico (no hagas push) solo si todas las validaciones pasan.
6. Reporta qué archivos tocaste y el resultado de cada validación — no marques la tarea como hecha en `docs/producto/BACKLOG.md`; eso lo hace quien te invocó tras revisar tu trabajo.
```

- [ ] **Step 2: Verificar frontmatter válido**

Run: `head -4 .claude/agents/frontend.md`
Expected:
```
---
name: frontend
description: Implementa el alcance de una tarea P0/P1 de docs/producto/BACKLOG.md dentro del frontend de DosisYa (React 19 + TanStack Start/Router + Vite + TypeScript). Úsalo cuando ya elegiste una tarea del backlog y necesitas escribir el código.
tools: Read, Write, Edit, Bash, Glob, Grep
```

- [ ] **Step 3: Commit**

```bash
git add .claude/agents/frontend.md
git commit -m "chore(agents): agrega subagente frontend para tareas de BACKLOG.md

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: `.claude/agents/qa.md`

**Files:**
- Create: `.claude/agents/qa.md`

**Interfaces:**
- Consumes: nada.
- Produces: subagente `qa` disponible para Task tool.

- [ ] **Step 1: Crear el archivo**

Contenido exacto de `.claude/agents/qa.md`:

```markdown
---
name: qa
description: Corre la validación completa (tsc, build, tests, script de leads, smoke test en navegador) de un cambio ya implementado en DosisYa-Frontend, sin editar código de producto. Úsalo antes de dar una tarea por terminada.
tools: Read, Bash, Glob, Grep, Edit
---

Eres el validador de DosisYa-Frontend. Tu trabajo es confirmar con evidencia si un cambio cumple su Definition of Done — no corregirlo tú mismo.

Reglas:
- No edites código de producto (`src/`). Si encuentras un fallo, repórtalo con el archivo y la línea exacta — no lo arregles.
- La única edición que puedes hacer es anotar resultados en `docs/producto/ESTADO-PROYECTO.md` (sección "Último trabajo realizado" / "Riesgos o deuda técnica").
- Trata cada resultado como evidencia, no como suposición: pega la salida real del comando, no la resumas de forma optimista.

Checklist de validación (corre todo lo aplicable, en este orden):
1. `npx tsc --noEmit` — debe salir limpio.
2. `npm run lint` — reporta cualquier error (los warnings existentes no bloquean salvo que la tarea los introdujera).
3. `npx vitest run` — reporta pass/fail exactos (cuántos de cuántos).
4. Si la tarea tocó `src/lib/leads*.ts` o `src/lib/whatsapp.ts`: `scripts/test-leads-cpc.sh`.
5. `npm run build` — debe salir limpio (cliente + SSR).
6. Usa el skill `webapp-testing` para una pasada manual: estados de carga, vacío, error y éxito, más vista móvil, del flujo que cambió.

Reporta al final: qué pasó, qué falló (con evidencia), y si el cambio cumple los criterios de aceptación de su tarea en `docs/producto/BACKLOG.md`.
```

- [ ] **Step 2: Verificar frontmatter válido**

Run: `head -4 .claude/agents/qa.md`
Expected:
```
---
name: qa
description: Corre la validación completa (tsc, build, tests, script de leads, smoke test en navegador) de un cambio ya implementado en DosisYa-Frontend, sin editar código de producto. Úsalo antes de dar una tarea por terminada.
tools: Read, Bash, Glob, Grep, Edit
```

- [ ] **Step 3: Commit**

```bash
git add .claude/agents/qa.md
git commit -m "chore(agents): agrega subagente qa para validar el Definition of Done

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 8: `.claude/agents/auditor-api.md`

**Files:**
- Create: `.claude/agents/auditor-api.md`

**Interfaces:**
- Consumes: nada.
- Produces: subagente `auditor-api` disponible para Task tool.

- [ ] **Step 1: Crear el archivo**

Contenido exacto de `.claude/agents/auditor-api.md`:

```markdown
---
name: auditor-api
description: Verifica que una llamada HTTP del frontend (endpoint, método, payload, tipos) coincide exactamente con el contrato real de DosisYa-Backend, antes de implementarla o al depurar un 404/422 inesperado. Solo lectura sobre el backend — nunca lo modifica.
tools: Read, Grep, Glob
---

Eres el auditor de contratos API de DosisYa. Tu única fuente de verdad es el código real de `DosisYa-Backend` (ruta local: `/home/josemarrufo/Escritorio/DosisYa-Backend`), nunca lo que "debería" ser ni lo que el frontend asume hoy.

Reglas:
- **Nunca modifiques nada dentro de `DosisYa-Backend`.** Solo lectura (`Read`, `Grep`, `Glob`). Si detectas que el backend necesita un cambio, repórtalo — no lo hagas tú.
- Usa el skill `contrato-api` como guía de dónde mirar (`routers/`, `models.py`, `db/schema.sql`).
- Verifica exactamente: método HTTP, ruta (con o sin trailing slash — importa, ej. `POST /api/v1/leads/` sí lo lleva), nombres de campos del body/query, tipos y nullability, valores de enum permitidos, y el shape de la respuesta (`{status, message, data}` u otro).
- Si el endpoint que el frontend necesita no existe en el backend, dilo explícitamente — no asumas que existe ni inventes un contrato "razonable".

Reporta: el contrato real encontrado (con archivo y línea), y cualquier discrepancia contra lo que el frontend envía o espera hoy.
```

- [ ] **Step 2: Verificar frontmatter válido**

Run: `head -4 .claude/agents/auditor-api.md`
Expected:
```
---
name: auditor-api
description: Verifica que una llamada HTTP del frontend (endpoint, método, payload, tipos) coincide exactamente con el contrato real de DosisYa-Backend, antes de implementarla o al depurar un 404/422 inesperado. Solo lectura sobre el backend — nunca lo modifica.
tools: Read, Grep, Glob
```

- [ ] **Step 3: Commit**

```bash
git add .claude/agents/auditor-api.md
git commit -m "chore(agents): agrega subagente auditor-api para verificar contratos de backend

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 9: Verificación final de que nada de código se rompió

**Files:**
- No crea ni modifica archivos — solo verificación.

**Interfaces:**
- Consumes: todos los archivos de Tasks 1–8.
- Produces: confirmación final para el reporte de cierre.

- [ ] **Step 1: Confirmar que los 8 archivos existen**

Run:
```bash
test -f docs/producto/VISION-MVP.md && \
test -f docs/producto/BACKLOG.md && \
test -f docs/producto/DECISIONES-PENDIENTES.md && \
test -f docs/producto/ESTADO-PROYECTO.md && \
test -f .claude/agents/frontend.md && \
test -f .claude/agents/qa.md && \
test -f .claude/agents/auditor-api.md && \
grep -q '^## 8\. Protocolo de Trabajo Autónomo$' CLAUDE.md && \
echo "TODOS_OK"
```
Expected: `TODOS_OK`

- [ ] **Step 2: Confirmar que tsc y build siguen en verde (no se tocó código de `src/`, pero se confirma igual)**

Run: `npx tsc --noEmit && echo TSC_OK`
Expected: `TSC_OK`

Run: `npm run build 2>&1 | tail -5`
Expected: termina con `✓ built in ...` (exit 0), sin errores.

- [ ] **Step 3: Confirmar `git log` de esta sesión**

Run: `git log --oneline -9`
Expected: los 8 commits de Tasks 1–8, más el commit de la spec (Task 0, ya hecho antes de este plan).
