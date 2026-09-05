# Errores conocidos (gotchas)
> Las trampas que ya te han mordido. Cada una ahorra horas de debugging.

## Exposición de API Keys de Gemini
- **Pasa cuando:** El frontend intenta llamar directamente a `generativelanguage.googleapis.com`.
- **Causa real:** Claude intentó implementar el escáner de recetas directamente en React.
- **Solución:** ¡NUNCA LLAMAR A GEMINI DESDE REACT! El frontend debe enviar la imagen (Base64/FormData) a nuestro propio backend (FastAPI), y es el backend de Python quien se comunica seguro con Gemini.

## Pérdida del Carrito al Refrescar
- **Pasa cuando:** El usuario añade medicinas, recarga la página, y la lista desaparece.
- **Causa real:** El estado de React se reinició y no estaba sincronizado.
- **Solución:** Usar un custom hook (ej. `useLocalStorage`) para que la "Lista Médica" se guarde en el almacenamiento local del navegador y persista entre sesiones sin requerir login.

## Bloqueo de UI al registrar Leads
- **Pasa cuando:** Clic en "Contactar" congela la app.
- **Solución:** FastAPI usa `BackgroundTasks`. El frontend asume respuesta instantánea.

## Failed to Fetch (CORS Frontend)
- **Solución:** Ajustar `FRONTEND_CORS_ORIGINS` en Vercel.

## Lead perdido en silencio por `medicamento_buscado_id` no-UUID
- **Pasa cuando:** Se registra un lead con un `medicamento_buscado_id` que no es UUID — típicamente los IDs sintéticos del escáner de récipe (ej. `"recipe-losartán"`).
- **Causa real:** La columna `leads_interacciones.medicamento_buscado_id` es un `UUID` (nullable). El backend rechaza el valor mal formado y el lead completo se pierde **sin error visible** (los POST son fire-and-forget).
- **Solución:** `postLead()` (en `src/lib/leads.ts`, único punto de envío) valida contra `UUID_RE` y manda `null` cuando no matchea. La interacción CPC se cobra igual, solo que sin referencia de inventario. No armar el POST de leads por fuera de `postLead`.

## Pausa automática de Supabase (plan free) → 500 en toda la app
- **Pasa cuando:** El proyecto Supabase de DosisYa (plan gratuito) se pausa automáticamente por inactividad. El backend FastAPI sigue arriba (`/docs` responde 200), pero **cualquier endpoint que toque la base de datos devuelve 500 genérico** — `{"status":"error","message":"Error interno al ejecutar la búsqueda.","data":null}` en el caso de la búsqueda, por ejemplo. No es un bug de query ni de código: no hay ninguna base de datos que responda.
- **Cómo detectarlo (no adivinar la causa por el código primero):** consultar el `status` del proyecto vía MCP de Supabase (`list_projects` / `get_project`) o el dashboard. Si `status: INACTIVE`, esa es la causa. Los logs (`query_logs`) muestran `ClientHandler: (ENOTFOUND) tenant/user postgres.<project_ref> not found` — esa línea es la huella digital de un proyecto pausado, no de una query rota.
- **Causa real:** Plan gratuito de Supabase pausa proyectos tras ~7 días sin actividad (conexiones, queries). Nadie lo notó hasta que un paciente real intentó buscar y recibió "Algo salió mal".
- **Solución:** `restore_project` vía MCP (o el botón "Restore" del dashboard de Supabase) — requiere autorización explícita de José (`CLAUDE.md` §8, es un cambio sobre Supabase). Tarda unos minutos (`COMING_UP` → `ACTIVE_HEALTHY`); reintentar la búsqueda hasta que responda 200. Si esto se repite, considerar un plan pago o un ping periódico (cron) para evitar la pausa.
- **Detectado y resuelto:** 2026-09-05, durante la verificación manual del MVP (B-002).

## Contratos frontend↔backend (verificado 2026-07-22)
- **Regla:** El backend (`DosisYa-Backend`) es la única fuente de verdad del contrato. Verificar contra `routers/`, `models.py` y `db/schema.sql` antes de asumir nombres de campos/enums (usar el skill `contrato-api`).
- **Estado:** Los 7 contratos que consume el frontend (búsqueda, leads, login súper, listado/estado de farmacias, récipe) están alineados 1:1 con el backend a esta fecha.
