# CLAUDE.md - Proyecto DosisYa (Frontend)

Este archivo es la fuente de verdad para el contexto persistente de Claude Code. Léelo siempre antes de iniciar o planificar cualquier tarea.

## 1. Visión y Negocio
- **Proyecto:** DosisYa, un marketplace farmacéutico hiperlocal (Acarigua/Araure, Venezuela).
- **Modelo B2B:** Cobro por "Leads" (interacciones hacia WhatsApp de la farmacia). NO cobramos comisiones por venta.
- **Filosofía B2C:** "Cero Fricción". El paciente NO se registra (sin login) para buscar, armar su Lista Médica ni contactar.
- **Logística:** Descentralizada. La "última milla" la asume la farmacia (motorizados propios o Yummy).
- **IA:** Normalización de inventario B2B con Gemini (ya en backend) y escáner de recetas con Gemini Vision (pendiente — spec en `docs/features/receta-ia-y-carrito.md`).

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
- Código pegado desde chats externos (zips, bloques de comandos): pasar por el skill `integrar-codigo-externo` — commit de respaldo primero, validar contra schema y dependencias reales.

## 6. Comandos
- `npm run dev` (puerto 5173) · `npm run build` · `npm run lint` · `npm run format`
- Verificación mínima antes de commit/push: `npx tsc --noEmit && npm run build` (los builds de Vercel ya se rompieron dos veces por saltarse esto).
- `scripts/test-leads-cpc.sh` — prueba end-to-end de leads CPC; correrlo tras tocar `leads*.ts` o `whatsapp.ts`.

## 7. Más Contexto
- `docs/contexto/` — decisiones cerradas, errores conocidos, glosario, convenciones. Leer antes de proponer cambios grandes.
- `docs/features/` — specs por funcionalidad (el "ticket" de lo que se va a construir).
