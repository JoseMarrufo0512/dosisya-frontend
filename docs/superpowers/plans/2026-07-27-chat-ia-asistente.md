# Chat del Asistente IA (MVP) — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el Asistente IA del paciente responda de verdad (info de medicamentos + orientar búsqueda en DosisYa) vía un endpoint backend que reusa Gemini, sin acceso a BD.

**Architecture:** Backend FastAPI stateless: `POST /api/v1/ia/chat` recibe el hilo reciente, `gemini_service.responder_chat()` llama a Gemini con un system prompt de seguridad y devuelve texto plano. Frontend: `src/lib/chatIA.ts` consume el endpoint y `HojaChatIA.tsx` reemplaza el stub por la llamada real con estado "escribiendo…" y degradación amable.

**Tech Stack:** Python 3.12 + FastAPI + google-genai (backend); React 19 + TypeScript + TanStack (frontend). Gemini vía `gemini_service`.

## Global Constraints

- **Dos repos:** backend en `/home/josemarrufo/Escritorio/DosisYa-Backend`, frontend en `/home/josemarrufo/Escritorio/DosisYa-Frontend` (rama `feat/chat-ia-asistente` ya creada, con el spec comiteado). El backend necesita su propia rama (Task 1).
- **Backend público sin auth** (filosofía Cero Fricción B2C); rate limit vía `dosisya.limiter.limiter`.
- **Solo el backend habla con Gemini**; el frontend nunca llama a Gemini directo (CLAUDE.md §4.5).
- **No filtrar detalles de error del proveedor** al cliente (mensajes genéricos amables).
- **Verificación backend:** `.venv/bin/python -m pytest` desde `DosisYa-Backend` (correr el archivo nuevo + la suite completa). **Verificación frontend:** `npx tsc --noEmit && npm run build` (no hay runner de tests) + prueba manual en preview.
- **Envelope de respuesta backend:** `RespuestaEstructurada { status, message, data }` (ya existe en `models.py`).
- Spec: `docs/superpowers/specs/2026-07-27-chat-ia-asistente-design.md`.

---

## File Structure

**Backend (`DosisYa-Backend`):**
- `src/dosisya/services/gemini_service.py` — MODIFICAR: `responder_chat()` + system prompt + config chat.
- `src/dosisya/models.py` — MODIFICAR: modelos `ChatMensaje`, `ChatRequest`.
- `src/dosisya/routers/ia.py` — MODIFICAR: endpoint `POST /chat`.
- `tests/test_gemini_chat.py` — CREAR: tests del servicio (mock de `_get_client`).
- `tests/test_ia_chat.py` — CREAR: tests del endpoint (mock de `responder_chat`).

**Frontend (`DosisYa-Frontend`):**
- `src/lib/chatIA.ts` — CREAR: cliente HTTP del chat.
- `src/components/paciente/HojaChatIA.tsx` — MODIFICAR: cablear al endpoint.

---

## Task 1: Backend — `gemini_service.responder_chat()` + system prompt

**Files:**
- Modify: `DosisYa-Backend/src/dosisya/services/gemini_service.py`
- Test: `DosisYa-Backend/tests/test_gemini_chat.py`

**Interfaces:**
- Consumes: `_get_client()`, `_clasificar_error()`, `GeminiParsingError`, `GeminiQuotaError`, `GeminiTimeoutError`, `_TIMEOUT_BUFFER_SECONDS` (todos ya en el módulo).
- Produces: `async def responder_chat(mensajes: list[dict[str, str]]) -> str` — cada dict es `{"rol": "usuario"|"asistente", "texto": str}`; devuelve el texto de la respuesta.

- [ ] **Step 1: Crear la rama del backend**

Run:
```bash
cd /home/josemarrufo/Escritorio/DosisYa-Backend && git checkout -b feat/chat-ia-asistente
```
Expected: "Cambiado a nueva rama 'feat/chat-ia-asistente'".

- [ ] **Step 2: Escribir el test del servicio (falla)**

Create `DosisYa-Backend/tests/test_gemini_chat.py`:
```python
"""
Tests de gemini_service.responder_chat.

Se mockea _get_client con un cliente falso: NUNCA se llama a Gemini de verdad.
El servicio se ejercita con asyncio.run (sin depender de pytest-asyncio).
"""

import asyncio

import pytest

from dosisya.services import gemini_service
from dosisya.services.gemini_service import (
    GeminiParsingError,
    GeminiQuotaError,
    GeminiTimeoutError,
)


class _FakeResp:
    def __init__(self, text):
        self.text = text


class _FakeModels:
    def __init__(self, text=None, exc=None):
        self._text = text
        self._exc = exc
        self.llamadas = []

    def generate_content(self, model, contents, config):
        self.llamadas.append({"model": model, "contents": contents, "config": config})
        if self._exc is not None:
            raise self._exc
        return _FakeResp(self._text)


class _FakeClient:
    def __init__(self, text=None, exc=None):
        self.models = _FakeModels(text=text, exc=exc)


class _FakeAPIError(Exception):
    """Imita google.genai.errors.APIError vía duck typing sobre .code."""

    def __init__(self, code):
        super().__init__(f"api error {code}")
        self.code = code


def test_responder_chat_devuelve_texto(monkeypatch):
    monkeypatch.setattr(gemini_service, "_get_client", lambda: _FakeClient(text="  El acetaminofén baja la fiebre.  "))
    out = asyncio.run(
        gemini_service.responder_chat([{"rol": "usuario", "texto": "¿para qué sirve el acetaminofén?"}])
    )
    assert out == "El acetaminofén baja la fiebre."


def test_responder_chat_cuota_agotada(monkeypatch):
    monkeypatch.setattr(gemini_service, "_get_client", lambda: _FakeClient(exc=_FakeAPIError(429)))
    with pytest.raises(GeminiQuotaError):
        asyncio.run(gemini_service.responder_chat([{"rol": "usuario", "texto": "hola"}]))


def test_responder_chat_texto_vacio_es_parsing_error(monkeypatch):
    monkeypatch.setattr(gemini_service, "_get_client", lambda: _FakeClient(text=""))
    with pytest.raises(GeminiParsingError):
        asyncio.run(gemini_service.responder_chat([{"rol": "usuario", "texto": "hola"}]))
```

- [ ] **Step 3: Correr el test (falla porque `responder_chat` no existe)**

Run:
```bash
cd /home/josemarrufo/Escritorio/DosisYa-Backend && .venv/bin/python -m pytest tests/test_gemini_chat.py -q
```
Expected: FAIL — `AttributeError: module 'dosisya.services.gemini_service' has no attribute 'responder_chat'`.

- [ ] **Step 4: Añadir constantes y system prompt del chat**

En `DosisYa-Backend/src/dosisya/services/gemini_service.py`, después de la línea
`_MODEL_INVENTARIO = os.environ.get("GEMINI_MODEL_INVENTARIO", "gemini-flash-latest")`,
añadir:
```python

# ─── Chat del Asistente IA (paciente) ────────────────────────────────────────
_MODEL_CHAT = os.environ.get("GEMINI_MODEL_CHAT", "gemini-flash-latest")
_GEMINI_CHAT_TIMEOUT_SECONDS = float(os.environ.get("GEMINI_CHAT_TIMEOUT_SECONDS", "20"))
_CHAT_MAX_TURNOS = 10  # recorta el historial reciente enviado al modelo
```

Y cerca de los otros prompts (después de `_PROMPT_RECIPE`), añadir el system prompt:
```python

_PROMPT_CHAT = """Eres el asistente de DosisYa, una farmacia hiperlocal en Acarigua/Araure, Venezuela.
Ayudas a pacientes por chat, en español venezolano, con tono cercano y respuestas BREVES (2 a 5 frases).

Puedes:
- Explicar para qué sirve un medicamento, sus presentaciones y sus genéricos equivalentes (mismo principio activo).
- Orientar qué término buscar en DosisYa para comparar precios y disponibilidad (ej. "busca 'acetaminofén' en la app").

NUNCA debes:
- Indicar dosis personalizadas, diagnosticar, ni recomendar tratamientos o cambios de medicación.
- Sugerir cambiar un principio activo por otro (eso lo decide un médico).
Ante cualquier duda clínica (dosis, síntomas, interacciones, si tomar o no algo), deriva SIEMPRE al médico o farmacéutico y recuerda brevemente que esto no sustituye una consulta profesional.

Si te preguntan algo fuera de medicamentos o de DosisYa, responde amablemente que solo puedes ayudar con eso.
Responde en texto plano, sin markdown."""
```

- [ ] **Step 5: Añadir `_config_chat`, `_responder_chat_sync` y `responder_chat`**

Al final de `DosisYa-Backend/src/dosisya/services/gemini_service.py`, añadir:
```python

def _config_chat(timeout_s: float, incluir_thinking: bool = True):
    """Config de generación para el chat: texto plano, system prompt, sin thinking.

    Igual que el récipe, algunos modelos tras un alias "-latest" rechazan
    thinking_config con 400; por eso _responder_chat_sync reintenta sin él.
    """
    from google.genai import types

    kwargs: dict[str, Any] = {
        "system_instruction": _PROMPT_CHAT,
        "temperature": 0.4,
        "max_output_tokens": 1024,
        "http_options": types.HttpOptions(timeout=int(timeout_s * 1000)),
    }
    if incluir_thinking:
        kwargs["thinking_config"] = types.ThinkingConfig(thinking_budget=0)
    return types.GenerateContentConfig(**kwargs)


def _responder_chat_sync(mensajes: list[dict[str, str]]) -> str:
    """Versión síncrona del chat — corre en un thread pool.

    Mapea el historial (recortado a _CHAT_MAX_TURNOS) al formato google.genai y
    pide una respuesta de texto. Un error no reintentable con thinking_config
    activo se reintenta UNA vez sin ese campo (ver _config_chat).

    Raises:
        GeminiQuotaError: cuota agotada (429).
        GeminiTimeoutError: el RPC excedió su deadline.
        GeminiParsingError: fallo no reintentable o respuesta vacía.
        RuntimeError: GEMINI_API_KEY no configurada.
    """
    client = _get_client()

    from google.genai import types

    recientes = mensajes[-_CHAT_MAX_TURNOS:]
    contents = [
        types.Content(
            role="model" if m["rol"] == "asistente" else "user",
            parts=[types.Part.from_text(text=m["texto"])],
        )
        for m in recientes
    ]

    ultimo_error: BaseException | None = None
    for incluir_thinking in (True, False):
        try:
            response = client.models.generate_content(
                model=_MODEL_CHAT,
                contents=contents,
                config=_config_chat(_GEMINI_CHAT_TIMEOUT_SECONDS, incluir_thinking),
            )
            texto = (response.text or "").strip()
            if not texto:
                raise GeminiParsingError("Gemini no devolvió texto en el chat.")
            return texto
        except GeminiParsingError:
            raise
        except Exception as e:
            clase = _clasificar_error(e)
            if clase == "quota":
                raise GeminiQuotaError(
                    "El asistente está saturado ahora. Intenta de nuevo en un momento."
                ) from e
            if clase == "timeout":
                raise GeminiTimeoutError(
                    "El asistente tardó demasiado en responder. Intenta de nuevo."
                ) from e
            if clase == "transitorio":
                raise GeminiQuotaError(
                    "El asistente no está disponible ahora. Intenta de nuevo en un momento."
                ) from e
            # No reintentable: quizá thinking_config; reintenta sin él una vez.
            if incluir_thinking:
                logger.warning("Chat: error no reintentable con thinking_config (%s); reintento sin él.", e)
                ultimo_error = e
                continue
            logger.error("Error no reintentable de Gemini (chat): %s", e)
            raise GeminiParsingError(f"Error al consultar Gemini (chat): {e}") from e

    raise GeminiParsingError(f"Error al consultar Gemini (chat): {ultimo_error}")


async def responder_chat(mensajes: list[dict[str, str]]) -> str:
    """Chat asíncrono: llama a Gemini sin bloquear el event loop.

    Args:
        mensajes: hilo reciente, cada item {"rol": "usuario"|"asistente", "texto": str}.
            El último debe ser del usuario (lo valida el router).

    Returns:
        Texto de la respuesta del asistente.

    Raises:
        GeminiQuotaError / GeminiTimeoutError / GeminiParsingError / RuntimeError.
    """
    try:
        return await asyncio.wait_for(
            asyncio.to_thread(_responder_chat_sync, mensajes),
            timeout=_GEMINI_CHAT_TIMEOUT_SECONDS + _TIMEOUT_BUFFER_SECONDS,
        )
    except asyncio.TimeoutError as e:
        logger.warning("responder_chat abortado por techo global.")
        raise GeminiTimeoutError(
            "El asistente tardó demasiado en responder. Intenta de nuevo."
        ) from e
```

- [ ] **Step 6: Correr el test (pasa)**

Run:
```bash
cd /home/josemarrufo/Escritorio/DosisYa-Backend && .venv/bin/python -m pytest tests/test_gemini_chat.py -q
```
Expected: PASS (3 passed).

- [ ] **Step 7: Commit**

```bash
cd /home/josemarrufo/Escritorio/DosisYa-Backend
git add src/dosisya/services/gemini_service.py tests/test_gemini_chat.py
git commit -m "feat(chat): gemini_service.responder_chat con system prompt de seguridad

Reusa el cliente Gemini para un chat de texto del paciente: system prompt que
explica medicamentos y deriva a médico (sin dosis personalizadas ni diagnóstico),
historial recortado, timeout propio y mapeo de cuota/timeout a las excepciones
existentes. Tests con _get_client mockeado.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Backend — modelos `ChatRequest` + endpoint `POST /api/v1/ia/chat`

**Files:**
- Modify: `DosisYa-Backend/src/dosisya/models.py`
- Modify: `DosisYa-Backend/src/dosisya/routers/ia.py`
- Test: `DosisYa-Backend/tests/test_ia_chat.py`

**Interfaces:**
- Consumes: `responder_chat` (Task 1); `RespuestaEstructurada`, `limiter`, `GeminiTimeoutError`/`GeminiQuotaError`/`GeminiParsingError`.
- Produces: `POST /api/v1/ia/chat` con body `{ mensajes: [{rol, texto}] }` → `{ status, message, data: { respuesta } }`. Modelos `ChatMensaje`, `ChatRequest`.

- [ ] **Step 1: Escribir el test del endpoint (falla)**

Create `DosisYa-Backend/tests/test_ia_chat.py`:
```python
"""
Tests del endpoint POST /api/v1/ia/chat.

Se mockea dosisya.routers.ia.responder_chat — nunca se llama a Gemini. El rate
limiter se resetea antes de cada test (mismo patrón que test_ia_router.py).
"""

import pytest
from fastapi.testclient import TestClient

from dosisya.limiter import limiter
from dosisya.main import app
from dosisya.services.gemini_service import GeminiTimeoutError

client = TestClient(app)

ENDPOINT = "/api/v1/ia/chat"


@pytest.fixture(autouse=True)
def _reset_limiter():
    limiter.reset()
    yield
    limiter.reset()


def _body(*pares):
    return {"mensajes": [{"rol": r, "texto": t} for r, t in pares]}


def test_exito_devuelve_respuesta(monkeypatch):
    async def fake_responder_chat(mensajes):
        return "El acetaminofén sirve para fiebre y dolor leve."

    monkeypatch.setattr("dosisya.routers.ia.responder_chat", fake_responder_chat)
    resp = client.post(ENDPOINT, json=_body(("usuario", "¿para qué sirve el acetaminofén?")))
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "success"
    assert body["data"]["respuesta"].startswith("El acetaminofén")


def test_ultimo_mensaje_no_usuario_422(monkeypatch):
    async def fake_responder_chat(mensajes):
        return "no debería llamarse"

    monkeypatch.setattr("dosisya.routers.ia.responder_chat", fake_responder_chat)
    resp = client.post(ENDPOINT, json=_body(("asistente", "hola")))
    assert resp.status_code == 422


def test_texto_vacio_422():
    resp = client.post(ENDPOINT, json=_body(("usuario", "")))
    assert resp.status_code == 422


def test_timeout_devuelve_503(monkeypatch):
    async def fake_responder_chat(mensajes):
        raise GeminiTimeoutError("timeout")

    monkeypatch.setattr("dosisya.routers.ia.responder_chat", fake_responder_chat)
    resp = client.post(ENDPOINT, json=_body(("usuario", "hola")))
    assert resp.status_code == 503
```

- [ ] **Step 2: Correr el test (falla — 404, endpoint no existe)**

Run:
```bash
cd /home/josemarrufo/Escritorio/DosisYa-Backend && .venv/bin/python -m pytest tests/test_ia_chat.py -q
```
Expected: FAIL (los 200/422/503 dan 404 porque `/api/v1/ia/chat` no existe aún).

- [ ] **Step 3: Añadir los modelos Pydantic**

En `DosisYa-Backend/src/dosisya/models.py`, cambiar el import de typing:
```python
from typing import Annotated
```
por:
```python
from typing import Annotated, Literal
```
Y justo antes de `class RespuestaEstructurada(BaseModel):`, añadir:
```python
class ChatMensaje(BaseModel):
    """Un turno del chat del Asistente IA (paciente)."""

    rol: Literal["usuario", "asistente"] = Field(description="Autor del mensaje")
    texto: str = Field(min_length=1, max_length=1000, description="Contenido del mensaje")


class ChatRequest(BaseModel):
    """Hilo reciente del chat. El último mensaje debe ser del usuario."""

    mensajes: list[ChatMensaje] = Field(
        min_length=1, max_length=20, description="Turnos recientes (máx. 20)"
    )


```

- [ ] **Step 4: Añadir el endpoint en `ia.py`**

En `DosisYa-Backend/src/dosisya/routers/ia.py`, ampliar los imports:
```python
from dosisya.models import RespuestaEstructurada
```
por:
```python
from dosisya.models import ChatRequest, RespuestaEstructurada
```
y
```python
from dosisya.services.gemini_service import (
    GeminiParsingError,
    GeminiQuotaError,
    GeminiTimeoutError,
    analizar_recipe,
)
```
por:
```python
from dosisya.services.gemini_service import (
    GeminiParsingError,
    GeminiQuotaError,
    GeminiTimeoutError,
    analizar_recipe,
    responder_chat,
)
```

Al final del archivo, añadir el endpoint:
```python


@router.post(
    "/chat",
    response_model=RespuestaEstructurada,
    summary="Chat del Asistente IA (paciente) — Gemini",
    description=(
        "Chat de texto para el paciente sobre medicamentos: usos, presentaciones "
        "y genéricos equivalentes, más orientación de qué buscar en DosisYa.\n\n"
        "**Sin autenticación** (B2C Cero Fricción). Rate limit: 20/min por IP.\n\n"
        "El body lleva el hilo reciente `{ mensajes: [{rol, texto}] }`; el último "
        "mensaje debe ser del usuario. El asistente NUNCA da dosis personalizadas "
        "ni diagnostica — deriva a médico/farmacéutico.\n\n"
        "`data`: `{ respuesta: string }`."
    ),
    responses={
        200: {"description": "Respuesta generada"},
        422: {"description": "Body inválido o el último mensaje no es del usuario"},
        429: {"description": "Rate limit excedido (20/min por IP)"},
        500: {"description": "Asistente no configurado (GEMINI_API_KEY ausente)"},
        503: {"description": "El asistente no está disponible ahora (timeout/cuota) — reintentar"},
    },
)
@limiter.limit("20/minute")
async def chat_endpoint(request: Request, body: ChatRequest) -> RespuestaEstructurada:
    """Valida el hilo, llama a Gemini y devuelve la respuesta del asistente."""
    if body.mensajes[-1].rol != "usuario":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="El último mensaje debe ser del usuario.",
        )

    mensajes = [{"rol": m.rol, "texto": m.texto} for m in body.mensajes]

    try:
        respuesta = await responder_chat(mensajes)
    except (GeminiTimeoutError, GeminiQuotaError, GeminiParsingError) as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="El asistente no está disponible ahora, intenta de nuevo.",
        ) from e
    except RuntimeError as e:
        logger.error("Chat IA sin configurar: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="El asistente no está configurado.",
        ) from e

    return RespuestaEstructurada(
        status="success",
        message="Respuesta generada",
        data={"respuesta": respuesta},
    )
```

- [ ] **Step 5: Correr el test del endpoint (pasa)**

Run:
```bash
cd /home/josemarrufo/Escritorio/DosisYa-Backend && .venv/bin/python -m pytest tests/test_ia_chat.py -q
```
Expected: PASS (4 passed).

- [ ] **Step 6: Correr la suite completa (no romper nada)**

Run:
```bash
cd /home/josemarrufo/Escritorio/DosisYa-Backend && .venv/bin/python -m pytest -q
```
Expected: PASS (todos; ~101 passed).

- [ ] **Step 7: Commit**

```bash
cd /home/josemarrufo/Escritorio/DosisYa-Backend
git add src/dosisya/models.py src/dosisya/routers/ia.py tests/test_ia_chat.py
git commit -m "feat(chat): endpoint POST /api/v1/ia/chat

Chat público (rate limit 20/min IP) que valida el hilo (último mensaje del
usuario), llama a responder_chat y mapea timeout/cuota a 503 sin filtrar
detalles. Modelos ChatMensaje/ChatRequest con límites de tamaño. Tests: 200,
422 (rol/vacío) y 503.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Frontend — cliente `src/lib/chatIA.ts`

**Files:**
- Create: `DosisYa-Frontend/src/lib/chatIA.ts`

**Interfaces:**
- Consumes: `API_BASE` de `src/lib/api.ts`; el endpoint `POST /api/v1/ia/chat` (Task 2).
- Produces: `type MensajeChat = { rol: "usuario" | "asistente"; texto: string }`; `async function enviarMensajeChat(mensajes: MensajeChat[]): Promise<string>`.

- [ ] **Step 1: Crear el cliente**

Create `DosisYa-Frontend/src/lib/chatIA.ts`:
```ts
/*
 * Cliente del chat del Asistente IA (paciente).
 *
 * Habla con POST /api/v1/ia/chat del backend (que a su vez llama a Gemini; el
 * frontend NUNCA llama a Gemini directo — CLAUDE.md §4.5). Degradación elegante:
 * ante cualquier fallo lanza un Error para que la UI muestre un mensaje amable.
 */
import { API_BASE } from "./api";

export type MensajeChat = { rol: "usuario" | "asistente"; texto: string };

export async function enviarMensajeChat(mensajes: MensajeChat[]): Promise<string> {
  const res = await fetch(`${API_BASE}/api/v1/ia/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mensajes }),
  });

  if (!res.ok) {
    throw new Error(`El asistente respondió ${res.status}`);
  }

  const json = (await res.json()) as { data?: { respuesta?: unknown } };
  const respuesta = json?.data?.respuesta;
  if (typeof respuesta !== "string" || respuesta.trim() === "") {
    throw new Error("Respuesta vacía del asistente");
  }
  return respuesta;
}
```

- [ ] **Step 2: Verificar (tsc + build)**

Run:
```bash
cd /home/josemarrufo/Escritorio/DosisYa-Frontend && npx tsc --noEmit && npm run build 2>&1 | tail -2
```
Expected: TSC sin errores; build OK.

- [ ] **Step 3: Commit**

```bash
cd /home/josemarrufo/Escritorio/DosisYa-Frontend
git add src/lib/chatIA.ts
git commit -m "feat(chat): cliente HTTP del Asistente IA (src/lib/chatIA.ts)

enviarMensajeChat hace POST /api/v1/ia/chat con degradación elegante (lanza
Error ante fallo para que la UI muestre un mensaje amable).

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Frontend — cablear `HojaChatIA.tsx` al endpoint

**Files:**
- Modify: `DosisYa-Frontend/src/components/paciente/HojaChatIA.tsx`

**Interfaces:**
- Consumes: `enviarMensajeChat`, `MensajeChat` (Task 3).
- Produces: chat funcional con estado "escribiendo…" y mensaje de error amable.

- [ ] **Step 1: Añadir el import del cliente**

En `DosisYa-Frontend/src/components/paciente/HojaChatIA.tsx`, tras la línea
`import { useBackDismiss } from "@/hooks/useBackDismiss";` añadir:
```ts
import { enviarMensajeChat, type MensajeChat } from "@/lib/chatIA";
```

- [ ] **Step 2: Añadir estado de envío**

En el cuerpo del componente, tras `const [texto, setTexto] = useState("");` añadir:
```ts
  const [enviando, setEnviando] = useState(false);
```

- [ ] **Step 3: Reemplazar `enviar` por la llamada real**

Reemplazar la función `enviar` actual:
```tsx
  const enviar = () => {
    const t = texto.trim();
    if (!t) return;
    setMensajes((m) => [
      ...m,
      { de: "yo", texto: t },
      {
        de: "ia",
        texto: "Función en desarrollo — pronto podré responder tus dudas sobre este medicamento.",
      },
    ]);
    setTexto("");
  };
```
por:
```tsx
  const enviar = async () => {
    const t = texto.trim();
    if (!t || enviando) return;
    const nuevos: Mensaje[] = [...mensajes, { de: "yo", texto: t }];
    setMensajes(nuevos);
    setTexto("");
    setEnviando(true);
    try {
      const historial: MensajeChat[] = nuevos.map((m) => ({
        rol: m.de === "yo" ? "usuario" : "asistente",
        texto: m.texto,
      }));
      const respuesta = await enviarMensajeChat(historial);
      setMensajes((m) => [...m, { de: "ia", texto: respuesta }]);
    } catch {
      setMensajes((m) => [
        ...m,
        { de: "ia", texto: "No pude responder ahora, intenta de nuevo." },
      ]);
    } finally {
      setEnviando(false);
    }
  };
```

- [ ] **Step 4: Mostrar "escribiendo…" y deshabilitar el input mientras responde**

Tras el `</div>` que cierra el contenedor de la lista de mensajes (el `<div>` con
`className="flex flex-col gap-2.5"`), añadir el indicador:
```tsx
      {enviando && (
        <div
          style={{
            alignSelf: "flex-start",
            fontSize: 12,
            color: "var(--tinta-tenue)",
            marginTop: 6,
          }}
        >
          escribiendo…
        </div>
      )}
```

En el `<input>`, añadir `disabled={enviando}`:
```tsx
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && enviar()}
          placeholder="Escribe tu pregunta…"
          aria-label="Escribe tu pregunta al asistente"
          className="flex-1"
          disabled={enviando}
          style={{
            border: 0,
            outline: "none",
            background: "transparent",
            fontSize: 13.5,
            color: "var(--tinta)",
          }}
        />
```

En el `<button aria-label="Enviar">`, añadir `disabled={enviando}` y bajar la
opacidad cuando envía. Reemplazar la etiqueta de apertura del botón:
```tsx
        <button
          type="button"
          aria-label="Enviar"
          onClick={enviar}
          className="dy-foco flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]"
          style={{ background: "var(--verde-cruz)", color: "var(--papel)", border: 0 }}
        >
```
por:
```tsx
        <button
          type="button"
          aria-label="Enviar"
          onClick={enviar}
          disabled={enviando}
          className="dy-foco flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]"
          style={{
            background: "var(--verde-cruz)",
            color: "var(--papel)",
            border: 0,
            opacity: enviando ? 0.6 : 1,
          }}
        >
```

- [ ] **Step 5: Verificar (tsc + build)**

Run:
```bash
cd /home/josemarrufo/Escritorio/DosisYa-Frontend && npx tsc --noEmit && npm run build 2>&1 | tail -2
```
Expected: TSC sin errores; build OK.

- [ ] **Step 6: Verificación manual en preview**

Arrancar el preview, abrir el chat (burbuja o "Más" → Asistente IA), escribir una
pregunta (ej. "¿para qué sirve el acetaminofén?") y confirmar: aparece
"escribiendo…", el input se deshabilita, y llega una respuesta real. Si el backend
del chat aún no está desplegado, se verá "No pude responder ahora, intenta de
nuevo." (degradación correcta) — no debe romperse la UI.

- [ ] **Step 7: Commit**

```bash
cd /home/josemarrufo/Escritorio/DosisYa-Frontend
git add src/components/paciente/HojaChatIA.tsx
git commit -m "feat(chat): cablear HojaChatIA al endpoint del Asistente IA

Reemplaza el stub 'Función en desarrollo' por la llamada real a
enviarMensajeChat, con estado 'escribiendo…', input deshabilitado mientras
responde y mensaje amable ante error.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review (resultado)

**Cobertura del spec:**
- Endpoint `POST /api/v1/ia/chat` público, rate limit 20/min, body `{mensajes}`, envelope → Task 2. ✅
- `responder_chat` + system prompt de seguridad + modelo Gemini configurable + historial recortado → Task 1. ✅
- Errores 422/503/500, no streaming → Tasks 1 y 2. ✅
- Frontend `chatIA.ts` + cablear `HojaChatIA` con "escribiendo…" y error amable → Tasks 3 y 4. ✅
- Tests backend (200/422/503 + servicio) → Tasks 1 y 2. ✅

**Placeholders:** ninguno — cada paso trae código/comandos concretos.

**Consistencia de tipos:** `responder_chat(mensajes: list[dict[str,str]]) -> str` (Task 1) usado igual en el endpoint (Task 2, mapea `[{"rol","texto"}]`); `MensajeChat {rol,texto}` y `enviarMensajeChat(mensajes): Promise<string>` (Task 3) usados igual en `HojaChatIA` (Task 4, mapea `de:"yo"→"usuario"`, `de:"ia"→"asistente"`). `ChatMensaje.rol` Literal `"usuario"|"asistente"` coincide entre back y front.

**Orden:** Task 1 → 2 (endpoint usa `responder_chat`); Task 3 → 4 (UI usa el cliente). Backend (1–2) y frontend (3–4) son independientes entre bloques, pero el chat solo responde de verdad con el backend desplegado.
