# Feature: Optimización del Escáner de Récipe (Gemini, free tier)

> Diseño aprobado el 2026-07-13. Complementa a `receta-ia-y-carrito.md` (Flujo 2).
> Autorización expresa del usuario para modificar `DosisYa-Backend` en este alcance.

## Problema

El escaneo de récipes tarda ~30 segundos y falla con frecuencia en el free tier
de Gemini. Diagnóstico:

1. **Thinking activado:** `gemini-flash-latest` apunta a Gemini 2.5 Flash, que
   por defecto "razona" antes de responder (10-20s extra). El SDK legacy
   `google-generativeai` (deprecado por Google) no permite desactivarlo.
2. **Sin reintentos:** un solo 429/503 del free tier = error inmediato al paciente.
3. **Imágenes crudas:** fotos de 3-8 MB viajan completas teléfono → Vercel → Gemini.

## Objetivo / Criterio de éxito

- Latencia p50 **< 8s** por escaneo (hoy ~30s), p95 < 20s.
- Un 429/503 transitorio NO llega al usuario (se resuelve con retry+fallback).
- El contrato de la API **no cambia**: mismo endpoint, mismo envelope.
- Al activar facturación de Gemini después: **cero cambios de código** (solo env vars).

## Diseño

### Backend (`DosisYa-Backend`)

**`services/gemini_service.py` — migración de SDK:**
- Reemplazar `google-generativeai` por **`google-genai`** (SDK unificado actual)
  en `requirements.txt` y `pyproject.toml`.
- Cliente vía `genai.Client(api_key=...)`; llamadas con
  `client.models.generate_content(...)`.
- **`thinking_config=ThinkingConfig(thinking_budget=0)`** en el path del récipe
  → elimina la latencia de razonamiento.
- El parser de inventario B2B (`parsear_inventario`) migra al mismo cliente
  **manteniendo su comportamiento actual** (sin `response_schema`, misma
  temperatura/límites). También recibe `thinking_budget=0`.
- Se mantienen: `response_mime_type="application/json"`,
  `response_schema` del récipe, `temperature=0.1`, `max_output_tokens=8192`,
  timeout RPC configurable + techo global asyncio, `asyncio.to_thread`.

**Modelos configurables por entorno:**

| Env var | Default | Rol |
|---|---|---|
| `GEMINI_MODEL_RECIPE` | `gemini-2.5-flash` | Intento principal |
| `GEMINI_MODEL_RECIPE_FALLBACK` | `gemini-2.5-flash-lite` | Reintento |

**Retry con fallback de modelo (solo path récipe):**
- Errores que disparan retry: 429 (cuota), 500/503 (transitorios), timeout RPC.
- Máximo 2 intentos totales: intento 1 con modelo principal (timeout 18s),
  intento 2 con fallback (timeout 15s). Total siempre < 45s (timeout frontend).
- Estos timeouts por intento son propios del path récipe (constantes nuevas);
  `GEMINI_TIMEOUT_SECONDS` (default 30s) sigue gobernando SOLO el parser de
  inventario B2B, sin cambios.
- Racional free tier: cada modelo tiene cuota RPM/RPD **separada** — si flash
  agota su cuota, flash-lite sigue disponible.
- Nueva excepción `GeminiQuotaError` (subclase de `GeminiParsingError`) cuando
  ambos intentos fallan por 429.

**`routers/ia.py`:**
- `GeminiQuotaError` → **503** con mensaje amigable:
  "Hay mucha demanda en este momento. Intenta de nuevo en un minuto."
- Resto del mapeo intacto (ilegible → 200 `status:"error"`, timeout → 504,
  API key ausente → 500, MIME/tamaño → 400).

### Frontend (`DosisYa-Frontend`)

**`src/lib/comprimirImagen.ts` (nuevo):**
- `comprimirImagen(file: File): Promise<File>` con canvas nativo (sin deps):
  decodifica con `createImageBitmap`, redimensiona a **máx. 1600px** en el lado
  mayor, exporta JPEG calidad **0.8**.
- Fallbacks que nunca bloquean: si el navegador no decodifica (ej. HEIC en
  Chrome) o el resultado queda más grande que el original → **envía el original**.

**`src/lib/recipeIA.ts`:**
- `analizarRecipe()` comprime antes de armar el FormData (la UI no cambia).
- **Mock eliminado** (commit `c85f157`): el mock de desarrollo y su flag
  `VITE_RECIPE_MOCK` se borraron una vez que `POST /api/v1/ia/analizar-recipe`
  quedó operativo en el backend (`routers/ia.py`). `analizarRecipe()` ahora
  siempre llama al backend real. _(Histórico: mientras existió, el mock respetaba
  la regla médica de mismo principio activo, ej. Losartán → "Losartán genérico 50mg".)_

**`src/components/EscanerRecipe.tsx`:** sin cambios funcionales (la compresión
vive en la capa lib).

## Manejo de errores (resumen del contrato — NO romper)

| Caso | Respuesta |
|---|---|
| Éxito | 200 `{status:"success", data:[{medicamento,cantidad,alternativas}]}` |
| Ilegible / no es récipe | 200 `{status:"error", data:null}` |
| MIME/tamaño inválido | 400 |
| Cuota agotada (ambos intentos) | **503** (nuevo) |
| Timeout | 504 |
| GEMINI_API_KEY ausente | 500 |

**Regla médica (invariante):** `alternativas` solo contiene equivalentes del
MISMO principio activo. El prompt `_PROMPT_RECIPE` conserva esta restricción
palabra por palabra; la migración de SDK no toca el texto del prompt.

## Verificación

1. Backend local (uvicorn + `GEMINI_API_KEY` real): enviar foto de récipe real
   y comparar latencia antes/después. Probar también upload de inventario B2B.
2. Forzar el retry: simular 429 (mock del cliente) y verificar fallback a
   flash-lite + que el usuario recibe respuesta normal.
3. Frontend: `npx tsc --noEmit && npm run build` (regla pre-commit del repo).
4. Preview del navegador: comprobar que una foto grande se comprime (~300 KB)
   y que el flujo completo idle → scanning → results funciona contra el
   backend local (uvicorn + `GEMINI_API_KEY`).

## Fuera de alcance (YAGNI)

- Compresión server-side (Pillow), telemetría de latencia, health-check de cuota.
- Cambiar de proveedor de IA (decisión cerrada: se sigue con Gemini).
- Streaming de respuesta.
