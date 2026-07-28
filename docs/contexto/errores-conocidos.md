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

## Contratos frontend↔backend (verificado 2026-07-22)
- **Regla:** El backend (`DosisYa-Backend`) es la única fuente de verdad del contrato. Verificar contra `routers/`, `models.py` y `db/schema.sql` antes de asumir nombres de campos/enums (usar el skill `contrato-api`).
- **Estado:** Los 7 contratos que consume el frontend (búsqueda, leads, login súper, listado/estado de farmacias, récipe) están alineados 1:1 con el backend a esta fecha.
