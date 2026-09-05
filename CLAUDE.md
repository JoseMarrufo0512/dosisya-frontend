# CLAUDE.md - Proyecto DosisYa (Frontend)

Este archivo es la fuente de verdad para el contexto persistente de Claude Code. Léelo siempre antes de iniciar o planificar cualquier tarea.

## 1. Visión y Negocio
- **Proyecto:** DosisYa, un marketplace farmacéutico hiperlocal (Acarigua/Araure, Venezuela).
- **Modelo B2B:** Cobro por "Leads" (interacciones hacia WhatsApp de la farmacia). NO cobramos comisiones por venta.
- **Filosofía B2C:** "Cero Fricción". El paciente NO se registra (sin login) para buscar, armar su Lista Médica ni contactar.
- **Logística:** Descentralizada. La "última milla" la asume la farmacia (motorizados propios o Yummy).
- **IA:** Normalización de inventario B2B con Gemini (ya en backend) y escáner de recetas con Gemini Vision — **operativo**: endpoint backend `POST /api/v1/ia/analizar-recipe` (`routers/ia.py`) + cliente frontend `src/lib/recipeIA.ts` (mock eliminado en commit `c85f157`). Spec en `docs/features/receta-ia-y-carrito.md`.

## 2. Stack Técnico Real
- **Frontend:** React 19 + TanStack Start (SSR) + TanStack Router (file-based) + Vite 7 + TypeScript. Estilos: TailwindCSS 4 (CSS-first, sin tailwind.config). UI: shadcn/ui + Radix, framer-motion, sonner (toasts), vaul (drawer), lucide-react. HTTP state: TanStack Query. Forms: Zod + React Hook Form.
- **Backend (API):** Python + FastAPI. Repo separado en `/home/josemarrufo/Escritorio/DosisYa-Backend`. NO TOCAR SIN AUTORIZACIÓN EXPRESA — pero SÍ leerlo para verificar contratos de API.
- **Base de Datos:** PostgreSQL en Supabase (PostGIS para geolocalización, pg_trgm para búsqueda difusa).
- **Deploy:** Vercel. Frontend `dosisya-frontend`; backend `proyecto-dosis-ya.vercel.app`.
- **Notificaciones B2B:** n8n + OpenWA.

## 3. Estructura Real de `src/` (no inventar carpetas)
- `src/routes/` — rutas file-based: `__root.tsx`, `index.tsx`, `admin.login.tsx`, `admin.dashboard.tsx`. `src/routeTree.gen.ts` es AUTO-GENERADO: nunca editarlo a mano.
- `src/components/` — UI del dominio; `src/components/lista/` — carrito Lista Médica (CartSummary, ListaMedicaDrawer, SelectorFarmacia); `src/components/ui/` — shadcn.
- `src/hooks/` — `useListaMedica`, `useGeolocalizacion`, `useBuscarMedicamentos`, `useLocalStorage`.
- `src/lib/` — `api.ts` (API_BASE + tipos), `leads.ts`, `leadsLista.ts`, `whatsapp.ts`.
- NO existen `src/pages/` ni `src/services/`. No crearlas.

## 4. Reglas Estrictas
1. **Cero Lovable:** Prohibido usar dependencias o patrones generados por Lovable (ej. RudderStack). Fue descartado.
2. **No bloquees la UI:** Los POST de leads son fire-and-forget (asíncronos, `keepalive: true` si se abre wa.me después). Usa Skeleton Loaders mientras carga.
3. **No inventes rutas ni campos de API:** El backend ya existe. Antes de escribir código que llame a la API, verifica el contrato real en `DosisYa-Backend/src/dosisya/models.py`, `routers/` y `db/schema.sql` (o usa el skill `contrato-api`).
4. **`VITE_API_URL` nunca apunta al frontend** (genera loops de red). En dev queda vacía → proxy Vite a `localhost:8000`.
5. **Nunca llamar a Gemini desde React:** las imágenes de recetas van a nuestro backend FastAPI; solo el backend habla con Gemini.

## 5. Lecciones Pagadas (no repetir estos bugs)
- `leads_interacciones.medicamento_buscado_id` es **un UUID único (nullable), NO un array**. Lista multi-producto = fan-out: un POST por medicamento (commit `ac555ca`).
- El campo del lead es **`tipo_interaccion`** (no `tipo_accion`). Valores canónicos del enum PG: `clic_whatsapp`, `clic_llamar`, `ver_mapa`, `ver_detalle`, `compartir`, `capture_pantalla`. Existen alias legacy de Lovable (`click_whatsapp`, `abrir_mapa`, `expandir_detalle`) — usar siempre los canónicos.
- `POST /api/v1/leads/` lleva **trailing slash** (commit `b071fc0`).
- La sección **Configuración** del panel edita vía `PATCH /api/v1/farmacias/{id}` (sin trailing slash). El body usa **nombres alias del dashboard** (`nombre_farmacia`, `whatsapp`), NO las columnas de BD (`nombre`, `telefono_whatsapp`) — el backend mapea. El dashboard GET devuelve `whatsapp`/`sector`/`punto_referencia` para precargar el form. Antes de 2026-07-13 ese endpoint NO existía en el backend (feature frontend contra contrato fantasma → 404 al guardar).
- **"Subí el inventario y no aparece en el buscador" casi nunca es el inventario: es `farmacias.ubicacion`.** El buscador filtra por `ST_DWithin` con radio máximo de 50 km, y una farmacia en `(0,0)` queda a ~7 700 km de Acarigua: el 100% de su inventario es invisible aunque tenga stock. Como `ubicacion` es `NOT NULL`, `(0,0)` es el centinela de "nunca se ubicó"; el predicado canónico vive en `dosisya/geo.py` (`ubicacion_configurada`) con un epsilon compartido — no reimplementarlo por router. **Antes de depurar una carga de inventario, verificar la ubicación de la farmacia.**
  - Hasta 2026-08-09 el registro creaba TODA farmacia en `(0,0)` y no existía ningún camino para corregirlo, así que solo las farmacias DEMO sembradas por SQL eran visibles. Hoy aceptan coordenadas `POST /api/v1/auth/register`, `PATCH /api/v1/farmacias/{id}` y `PATCH /api/v1/admin/farmacias/{id}/estado`.
  - **Contrato de `lat`/`lng` en los tres:** opcionales y **juntas o ninguna** (una sola → 400). Omitirlas NO borra la ubicación: conserva la guardada. En el SQL los casts `::float8` del `CASE` son obligatorios — sin ellos asyncpg falla con *"could not determine data type"* cuando ambas llegan en `NULL`. Ojo al orden: `ST_MakePoint(lng, lat)`.
  - Siguen siendo opcionales a propósito: exigirlas bloquearía la afiliación cuando el GPS falla o el navegador niega el permiso. La red de contención es que el panel de la farmacia y la lista del superadmin exponen `ubicacion_configurada`, y aprobar una farmacia sin ubicar pide confirmación explícita.
- Código pegado desde chats externos (zips, bloques de comandos): pasar por el skill `integrar-codigo-externo` — commit de respaldo primero, validar contra schema y dependencias reales.

## 6. Comandos
- `npm run dev` (puerto 5173) · `npm run build` · `npm run lint` · `npm run format`
- Verificación mínima antes de commit/push: `npx tsc --noEmit && npm run build` (los builds de Vercel ya se rompieron dos veces por saltarse esto).
- `scripts/test-leads-cpc.sh` — prueba end-to-end de leads CPC; correrlo tras tocar `leads*.ts` o `whatsapp.ts`.

## 7. Más Contexto
- `docs/contexto/` — decisiones cerradas, errores conocidos, glosario, convenciones. Leer antes de proponer cambios grandes.
- `docs/features/` — specs por funcionalidad (el "ticket" de lo que se va a construir).

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
