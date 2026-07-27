# Chat del Asistente IA (MVP) — Diseño

**Fecha:** 2026-07-27
**Estado:** Aprobado (diseño). Pendiente de plan de implementación.
**Repos:** `DosisYa-Backend` (endpoint + servicio) y `DosisYa-Frontend` (cliente + UI).

## En una frase

Convertir el Asistente IA del paciente —hoy un stub que responde "Función en
desarrollo"— en un chat que responde de verdad: explica medicamentos (usos,
presentaciones, genéricos equivalentes) con disclaimers, orienta qué buscar en
DosisYa, y **nunca** da dosis personalizadas ni diagnostica. Backend stateless
que reusa Gemini; sin acceso a la base de datos (MVP).

## Decisiones tomadas (brainstorming)

- **Alcance/seguridad:** info general de medicamentos + ayuda de compra/búsqueda
  dentro de DosisYa. Con disclaimers. NUNCA dosis personalizadas ni diagnóstico
  → deriva a médico/farmacéutico.
- **Datos:** sin acceso al inventario/BD (MVP). Para precios/disponibilidad,
  orienta *qué* buscar; no consulta datos reales.
- **Modelo:** reusar Gemini (ya integrado y pagado en `gemini_service.py`).
- **Defaults aprobados:** no streaming; rate limit 20/min por IP; mensaje ≤ 1000
  chars; historial recortado a los últimos ~10 turnos; errores → mensaje amable.

## Contexto actual

- **Backend:** `src/dosisya/routers/ia.py` tiene solo `POST /api/v1/ia/analizar-recipe`
  (prefix `/api/v1/ia`). `src/dosisya/services/gemini_service.py` integra Gemini
  vía `google.genai` (récipe + inventario), con cliente `_get_client()`, modelos
  por env, y excepciones `GeminiParsingError` / `GeminiTimeoutError` /
  `GeminiQuotaError`. Rate limiting disponible en `limiter.py` (SlowAPI). Envelope
  de respuesta: `RespuestaEstructurada { status, message, data }`.
- **Frontend:** `src/components/paciente/HojaChatIA.tsx` tiene la UI del chat
  completa, con estado local de mensajes; al enviar responde un texto fijo
  "Función en desarrollo…". Se abre desde la hoja "Más" y desde la burbuja
  flotante (`BurbujaAsistenteIA`). No hay cliente HTTP de chat aún.
- **Regla del proyecto:** solo el backend habla con Gemini; el frontend nunca
  llama a Gemini directo (CLAUDE.md §4.5).

## Arquitectura

```
HojaChatIA (React)
   │  POST /api/v1/ia/chat { mensajes:[{rol,texto}] }
   ▼
ia.py: chat_endpoint  ──(rate limit 20/min IP)──►  gemini_service.responder_chat(mensajes)
   │                                                   │  system prompt + historial
   │                                                   ▼
   │                                                Gemini (google.genai)
   ▼
RespuestaEstructurada { status, message, data:{ respuesta } }
```

Backend **stateless**: no persiste conversaciones. El historial lo mantiene el
front y lo reenvía en cada llamada.

## Backend (`DosisYa-Backend`)

### Endpoint: `POST /api/v1/ia/chat`

- En `ia.py` (mismo router, prefix `/api/v1/ia`). **Público** (sin auth).
- **Rate limit:** 20/min por IP (SlowAPI, patrón de `limiter.py`).
- **Request body** (modelo Pydantic nuevo en `models.py`):
  ```
  ChatMensaje  { rol: Literal["usuario","asistente"], texto: str (1..1000) }
  ChatRequest  { mensajes: list[ChatMensaje] (1..20) }
  ```
  El último mensaje debe ser de `rol="usuario"`. El servicio recorta a los
  últimos ~10 turnos antes de llamar al modelo.
- **Response:** `RespuestaEstructurada { status:"success", message:"Respuesta generada", data:{ respuesta: str } }`.
- **Errores:**
  - 422 → body inválido (Pydantic: rol desconocido, texto vacío/>1000, lista vacía/>20).
  - 503 → `GeminiTimeoutError` / `GeminiQuotaError` / fallo del proveedor (mensaje:
    "El asistente no está disponible ahora, intenta de nuevo").
  - 500 → error inesperado.
- **Sin streaming** (una sola respuesta JSON).

### Servicio: `gemini_service.responder_chat(mensajes) -> str`

- Reusa `_get_client()` y el patrón sync-en-thread (`asyncio.to_thread` o el que
  ya use el récipe) con timeout propio (`GEMINI_CHAT_TIMEOUT_SECONDS`, default 20s).
- **Modelo:** env `GEMINI_MODEL_CHAT` (default `gemini-flash-latest`).
- **System prompt** (constante en el servicio) — el corazón de la seguridad:
  - Rol: asistente de DosisYa, farmacia hiperlocal en Acarigua/Araure, Venezuela.
  - Español venezolano, tono cercano, respuestas **breves** (2–5 frases).
  - Puede: explicar para qué sirve un medicamento, sus presentaciones, y
    **genéricos equivalentes** (mismo principio activo); orientar qué término
    buscar en DosisYa para comparar precios/disponibilidad.
  - No debe: dar dosis personalizadas, diagnosticar, indicar tratamientos, ni
    reemplazar al médico/farmacéutico → siempre deriva ante dudas clínicas.
  - Incluir un disclaimer breve cuando la pregunta roce lo clínico.
  - Rechazar cortésmente temas fuera de medicamentos/DosisYa.
- Convierte `mensajes` al formato de `google.genai` (roles user/model), con el
  system prompt como instrucción de sistema.
- Errores del proveedor → levanta `GeminiTimeoutError`/`GeminiQuotaError` (ya
  existentes) para que el router los mapee a 503.

### Tests (backend)

`tests/test_ia_chat.py` (estilo `test_ia_router.py`, mockeando la llamada a
Gemini / `responder_chat`):
- 200: mensajes válidos → `data.respuesta` es el texto mockeado.
- 422: último mensaje no es de usuario / texto vacío / >1000 chars / lista vacía.
- 503: `responder_chat` levanta `GeminiTimeoutError` → 503.
Correr la suite completa (`pytest`) para no romper nada.

## Frontend (`DosisYa-Frontend`)

### `src/lib/chatIA.ts`

- `enviarMensajeChat(mensajes: MensajeChat[]): Promise<string>` — `POST
  ${API_BASE}/api/v1/ia/chat`. Mapea el estado local del chat al body
  `{ mensajes:[{rol,texto}] }`. Devuelve `data.respuesta`. En error (red/no-ok)
  lanza un error controlado para que la UI muestre el mensaje amable.
- Tipo `MensajeChat { rol:"usuario"|"asistente"; texto:string }`.

### `src/components/paciente/HojaChatIA.tsx`

- Reemplazar el `enviar()` stub por: agregar el mensaje del usuario, llamar a
  `enviarMensajeChat` con el historial, mostrar estado **"escribiendo…"**,
  deshabilitar input/botón mientras responde, y agregar la respuesta.
- **Error:** si la llamada falla, agregar un mensaje del asistente tipo
  "No pude responder ahora, intenta de nuevo." (degradación elegante).
- Mantener el mensaje seed inicial y el diseño verde-cruz actuales.

### Verificación (frontend)

`npx tsc --noEmit && npm run build`; prueba manual en preview: enviar una
pregunta real y ver respuesta; simular error y ver el mensaje amable.

## Manejo de errores y casos borde

- **Sin `GEMINI_API_KEY`** en backend → el servicio ya levanta RuntimeError; el
  router lo mapea a 503 (no filtra detalles del error al cliente).
- **Timeout/cuota** → 503 + mensaje amable en la UI.
- **Rate limit excedido** → 429 (manejador global de SlowAPI ya existe); la UI lo
  trata como error genérico amable.
- **Body abusivo** (texto larguísimo, muchos mensajes) → cortado por validación
  Pydantic (422) y por el recorte de historial en el servicio.
- **Front sin backend / offline** → error de red → mensaje amable, sin romper.

## Fuera de alcance (fases futuras)

- Acceso al inventario/precios reales (tool-calling / RAG).
- Fallback a NVIDIA Nemotron (trabajo aparte en `.worktrees/fallback-ia-nvidia`).
- Streaming de la respuesta.
- Persistir el historial de conversaciones.
- Autenticación del paciente.
