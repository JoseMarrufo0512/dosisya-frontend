# Optimización del Escáner de Récipe (Gemini) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bajar la latencia del escaneo de récipes de ~30s a <8s (p50) y absorber los 429/503 del free tier de Gemini sin que el paciente vea errores.

**Architecture:** Se migra `gemini_service.py` (DosisYa-Backend) del SDK deprecado `google-generativeai` al SDK unificado `google-genai`, desactivando el razonamiento (`thinking_budget=0`) y añadiendo retry con fallback de modelo (flash → flash-lite, cuotas separadas en free tier). En el frontend, las fotos se comprimen con canvas nativo antes de subir. El contrato HTTP del endpoint NO cambia.

**Tech Stack:** Backend: Python 3.11+/FastAPI/google-genai/pytest+uv. Frontend: React 19/TypeScript/Vite (sin dependencias nuevas).

**Spec:** `docs/features/receta-ia-optimizacion-gemini.md` (aprobado 2026-07-13).

## Global Constraints

- **Dos repos:** Backend = `/home/josemarrufo/Escritorio/DosisYa-Backend` (autorización expresa del usuario para esta feature). Frontend = `/home/josemarrufo/Escritorio/DosisYa-Frontend`. Cada repo committea por separado.
- **Contrato HTTP intacto** (consumido por `src/lib/recipeIA.ts`): éxito → 200 `{status:"success",data:[{medicamento,cantidad,alternativas}]}`; ilegible → 200 `{status:"error",data:null}`; MIME/tamaño → 400; cuota agotada → **503 (nuevo)**; timeout → 504; API key ausente → 500.
- **Regla médica invariante:** el texto de `_PROMPT_RECIPE` NO se modifica ni una palabra. `alternativas` = solo mismo principio activo.
- **Env vars nuevas (con default en código, no rompen si faltan):** `GEMINI_MODEL_RECIPE` (default `gemini-2.5-flash`), `GEMINI_MODEL_RECIPE_FALLBACK` (default `gemini-2.5-flash-lite`), `GEMINI_MODEL_INVENTARIO` (default `gemini-flash-latest`).
- **Timeouts récipe:** intento 1 = 18s, intento 2 = 15s, techo global asyncio = 40s (< 45s del timeout frontend). El inventario B2B sigue con `GEMINI_TIMEOUT_SECONDS` (30s) + buffer 15s.
- **Verificación backend:** `cd /home/josemarrufo/Escritorio/DosisYa-Backend && uv run pytest -q` (baseline actual: 41 passed).
- **Verificación frontend:** `cd /home/josemarrufo/Escritorio/DosisYa-Frontend && npx tsc --noEmit && npm run build` (regla pre-commit de CLAUDE.md).
- Los tests NUNCA llaman a la API real de Gemini (patrón existente del repo: mocks/monkeypatch).

---

### Task 1: Dependencia google-genai + helpers del cliente nuevo

**Files:**
- Modify: `/home/josemarrufo/Escritorio/DosisYa-Backend/pyproject.toml` (línea de `google-generativeai`)
- Modify: `/home/josemarrufo/Escritorio/DosisYa-Backend/src/dosisya/requirements.txt` (línea 24)
- Modify: `/home/josemarrufo/Escritorio/DosisYa-Backend/src/dosisya/services/gemini_service.py` (añadir helpers; NO borrar código viejo aún)
- Test: `/home/josemarrufo/Escritorio/DosisYa-Backend/tests/test_gemini_service.py` (nuevo)

**Interfaces:**
- Consumes: nada (primera task).
- Produces (usado por Tasks 2 y 3):
  - `_get_client() -> genai.Client` — lanza `RuntimeError` si `GEMINI_API_KEY` falta o es placeholder.
  - `_clasificar_error(exc: BaseException) -> str | None` — devuelve `"quota"` (429), `"transitorio"` (500/502/503), `"timeout"` o `None`.
  - `_config_generacion(timeout_s: float, response_schema: dict | None = None) -> types.GenerateContentConfig` — JSON mode, temp 0.1, max 8192 tokens, `thinking_budget=0`, timeout HTTP en ms.
  - Constantes: `_MODEL_RECIPE`, `_MODEL_RECIPE_FALLBACK`, `_MODEL_INVENTARIO`, `_RECIPE_TIMEOUT_INTENTO_1_S = 18.0`, `_RECIPE_TIMEOUT_INTENTO_2_S = 15.0`, `_RECIPE_TIMEOUT_GLOBAL_S = 40.0`.

- [ ] **Step 1: Cambiar la dependencia en pyproject.toml**

En `/home/josemarrufo/Escritorio/DosisYa-Backend/pyproject.toml`, reemplazar:

```toml
    "google-generativeai>=0.8,<1.0", # Cliente Gemini (normalización de inventario + escáner de récipe)
```

por:

```toml
    "google-genai>=1.0,<2.0",   # SDK unificado Gemini (inventario + escáner de récipe; permite thinking_budget=0)
```

- [ ] **Step 2: Cambiar la dependencia en requirements.txt**

En `/home/josemarrufo/Escritorio/DosisYa-Backend/src/dosisya/requirements.txt`, reemplazar:

```
google-generativeai>=0.8,<1.0
```

por:

```
google-genai>=1.0,<2.0
```

- [ ] **Step 3: Instalar y verificar el import**

Run: `cd /home/josemarrufo/Escritorio/DosisYa-Backend && uv sync --extra dev && uv run python -c "from google import genai; from google.genai import types; print(genai.__version__ if hasattr(genai, '__version__') else 'ok')"`
Expected: imprime una versión o `ok`, sin ImportError.

- [ ] **Step 4: Escribir los tests que fallan (helpers)**

Crear `/home/josemarrufo/Escritorio/DosisYa-Backend/tests/test_gemini_service.py`:

```python
"""
DosisYa — Tests del servicio Gemini (SDK google-genai).

Gemini NUNCA se llama de verdad: el cliente se falsea monkeypatcheando
`dosisya.services.gemini_service._get_client`. Los errores del SDK se
simulan con excepciones duck-typed (atributo `.code`), igual que hace
`_clasificar_error`.
"""

from __future__ import annotations

import httpx
import pytest

from dosisya.services import gemini_service as gs


class ErrorConCode(Exception):
    """Simula google.genai.errors.APIError (duck typing sobre .code)."""

    def __init__(self, code: int):
        super().__init__(f"HTTP {code}")
        self.code = code


class TestClasificarError:
    def test_429_es_quota(self):
        assert gs._clasificar_error(ErrorConCode(429)) == "quota"

    @pytest.mark.parametrize("code", [500, 502, 503])
    def test_5xx_es_transitorio(self, code: int):
        assert gs._clasificar_error(ErrorConCode(code)) == "transitorio"

    def test_timeout_httpx(self):
        assert gs._clasificar_error(httpx.ReadTimeout("lento")) == "timeout"

    def test_timeout_builtin(self):
        assert gs._clasificar_error(TimeoutError()) == "timeout"

    def test_error_generico_no_reintentable(self):
        assert gs._clasificar_error(ValueError("boom")) is None

    def test_4xx_no_reintentable(self):
        assert gs._clasificar_error(ErrorConCode(400)) is None


class TestGetClient:
    def test_api_key_ausente_lanza_runtime_error(self, monkeypatch: pytest.MonkeyPatch):
        monkeypatch.setenv("GEMINI_API_KEY", "")
        with pytest.raises(RuntimeError, match="GEMINI_API_KEY"):
            gs._get_client()

    def test_api_key_placeholder_lanza_runtime_error(self, monkeypatch: pytest.MonkeyPatch):
        monkeypatch.setenv("GEMINI_API_KEY", "your-gemini-api-key-here")
        with pytest.raises(RuntimeError, match="GEMINI_API_KEY"):
            gs._get_client()

    def test_api_key_valida_devuelve_cliente(self, monkeypatch: pytest.MonkeyPatch):
        monkeypatch.setenv("GEMINI_API_KEY", "test-key-123")
        client = gs._get_client()
        assert hasattr(client, "models")


class TestConfigGeneracion:
    def test_config_sin_schema(self):
        config = gs._config_generacion(18.0)
        assert config.response_mime_type == "application/json"
        assert config.temperature == 0.1
        assert config.max_output_tokens == 8192
        assert config.thinking_config.thinking_budget == 0
        assert config.http_options.timeout == 18_000  # milisegundos
        assert config.response_schema is None

    def test_config_con_schema(self):
        config = gs._config_generacion(15.0, response_schema=gs._RECIPE_RESPONSE_SCHEMA)
        assert config.response_schema is not None
        assert config.http_options.timeout == 15_000
```

- [ ] **Step 5: Correr los tests y verificar que fallan**

Run: `cd /home/josemarrufo/Escritorio/DosisYa-Backend && uv run pytest tests/test_gemini_service.py -v`
Expected: FAIL — `AttributeError: module ... has no attribute '_clasificar_error'` (y `_get_client`, `_config_generacion`).

- [ ] **Step 6: Implementar los helpers en gemini_service.py**

En `/home/josemarrufo/Escritorio/DosisYa-Backend/src/dosisya/services/gemini_service.py`, añadir DESPUÉS del bloque de constantes existente (tras `LIMITE_CHARS_GEMINI = 50_000`, línea ~42) y SIN borrar nada del código viejo todavía:

```python
# ─── Migración a SDK google-genai (spec: receta-ia-optimizacion-gemini.md) ───

# Modelos configurables por entorno (Vercel → Settings → Environment Variables).
# Free tier: cada modelo tiene cuota RPM/RPD SEPARADA — por eso el fallback usa
# un modelo distinto (si flash agota su cuota, flash-lite sigue disponible).
_MODEL_RECIPE = os.environ.get("GEMINI_MODEL_RECIPE", "gemini-2.5-flash")
_MODEL_RECIPE_FALLBACK = os.environ.get(
    "GEMINI_MODEL_RECIPE_FALLBACK", "gemini-2.5-flash-lite"
)
_MODEL_INVENTARIO = os.environ.get("GEMINI_MODEL_INVENTARIO", "gemini-flash-latest")

# Timeouts por intento del path récipe (segundos). 18 + 15 + margen < 45s del
# timeout del frontend (RECIPE_TIMEOUT_MS en recipeIA.ts). Son PROPIOS del
# récipe: el inventario B2B sigue gobernado por _GEMINI_TIMEOUT_SECONDS.
_RECIPE_TIMEOUT_INTENTO_1_S = 18.0
_RECIPE_TIMEOUT_INTENTO_2_S = 15.0
_RECIPE_TIMEOUT_GLOBAL_S = 40.0  # techo asyncio de los dos intentos juntos


def _get_client():
    """Crea el cliente google-genai con la API key del entorno.

    Raises:
        RuntimeError: si GEMINI_API_KEY falta, es placeholder, o el paquete
            google-genai no está instalado.
    """
    api_key = os.environ.get("GEMINI_API_KEY", "")
    if not api_key or api_key == "your-gemini-api-key-here":
        raise RuntimeError(
            "GEMINI_API_KEY no está configurada. "
            "Añádela en Vercel → Settings → Environment Variables."
        )
    try:
        from google import genai
    except ImportError as e:
        raise RuntimeError(
            "Paquete google-genai no instalado. "
            "Añade 'google-genai>=1.0' a requirements.txt."
        ) from e
    return genai.Client(api_key=api_key)


def _clasificar_error(exc: BaseException) -> str | None:
    """Clasifica un error de Gemini para decidir si se reintenta.

    Returns:
        "quota"       → 429: cuota agotada; reintentar con el modelo fallback.
        "transitorio" → 500/502/503: error del servicio; reintentar.
        "timeout"     → el RPC excedió su deadline; reintentar.
        None          → no reintentable (propagar como GeminiParsingError).

    Usa duck typing sobre `.code` (atributo de google.genai.errors.APIError)
    en vez de isinstance: no acopla los tests al constructor del SDK.
    """
    code = getattr(exc, "code", None)
    if code == 429:
        return "quota"
    if code in (500, 502, 503):
        return "transitorio"
    try:
        import httpx

        if isinstance(exc, httpx.TimeoutException):
            return "timeout"
    except ImportError:
        pass
    return "timeout" if isinstance(exc, TimeoutError) else None


def _config_generacion(timeout_s: float, response_schema: dict | None = None):
    """Construye el GenerateContentConfig común (JSON, temp baja, SIN thinking).

    thinking_budget=0 desactiva el razonamiento de Gemini 2.5 — era la fuente
    principal de los ~30s de latencia que motivaron esta migración.

    Args:
        timeout_s: Deadline del RPC en segundos (http_options lo recibe en MS).
        response_schema: Schema JSON opcional para output tipado.
    """
    from google.genai import types

    kwargs: dict[str, Any] = {
        "response_mime_type": "application/json",
        "temperature": 0.1,
        "max_output_tokens": 8192,
        "thinking_config": types.ThinkingConfig(thinking_budget=0),
        "http_options": types.HttpOptions(timeout=int(timeout_s * 1000)),
    }
    if response_schema is not None:
        kwargs["response_schema"] = response_schema
    return types.GenerateContentConfig(**kwargs)
```

- [ ] **Step 7: Correr los tests nuevos y verificar que pasan**

Run: `cd /home/josemarrufo/Escritorio/DosisYa-Backend && uv run pytest tests/test_gemini_service.py -v`
Expected: PASS (13 tests).

⚠️ Si `test_config_sin_schema` falla porque `http_options.timeout` espera otra unidad o `ThinkingConfig` tiene otro nombre de campo: consultar `uv run python -c "from google.genai import types; help(types.HttpOptions)"` y ajustar — la intención es timeout de 18s y thinking desactivado.

- [ ] **Step 8: Verificar que la suite vieja sigue verde (el código legacy aún importa google.generativeai de forma perezosa — no debe romper porque ya no está instalado, dado que solo se importa DENTRO de las funciones)**

Run: `cd /home/josemarrufo/Escritorio/DosisYa-Backend && uv run pytest -q`
Expected: 54 passed (41 baseline + 13 nuevos). Si algún test viejo falla con ImportError de `google.generativeai`, significa que ese test ejercita el código legacy sin mock — anotar cuál y arreglarlo en la Task 2/3 que migra esa función.

- [ ] **Step 9: Commit (repo backend)**

```bash
cd /home/josemarrufo/Escritorio/DosisYa-Backend && git add pyproject.toml src/dosisya/requirements.txt src/dosisya/services/gemini_service.py tests/test_gemini_service.py && git commit -m "feat(ia): dependencia google-genai + helpers de cliente, clasificación de errores y config sin thinking"
```

---

### Task 2: Migrar el escáner de récipe con retry + fallback de modelo

**Files:**
- Modify: `/home/josemarrufo/Escritorio/DosisYa-Backend/src/dosisya/services/gemini_service.py` (reemplazar `_analizar_recipe_sync` completa, ~líneas 370-464; actualizar `analizar_recipe`, ~líneas 467-501; añadir `GeminiQuotaError` y `_extraer_lista_json`)
- Test: `/home/josemarrufo/Escritorio/DosisYa-Backend/tests/test_gemini_service.py`

**Interfaces:**
- Consumes (Task 1): `_get_client`, `_clasificar_error`, `_config_generacion`, `_MODEL_RECIPE`, `_MODEL_RECIPE_FALLBACK`, `_RECIPE_TIMEOUT_INTENTO_1_S/2_S/GLOBAL_S`.
- Produces:
  - `class GeminiQuotaError(GeminiParsingError)` — la importará el router en Task 4.
  - `_extraer_lista_json(response, contexto: str, sugerencia: str) -> list` — reutilizada por Task 3.
  - `analizar_recipe(imagen_bytes: bytes, mime_type: str) -> list[dict]` — firma SIN cambios (el router ya la consume así).

- [ ] **Step 1: Escribir los tests que fallan (retry/fallback)**

Añadir al final de `/home/josemarrufo/Escritorio/DosisYa-Backend/tests/test_gemini_service.py`:

```python
# ─── Fakes del cliente google-genai ──────────────────────────────────────────


class FakeResponse:
    def __init__(self, text: str):
        self.text = text


class FakeModels:
    """Simula client.models — cada item de `respuestas` es una respuesta o
    una excepción a lanzar, consumidos en orden por cada llamada."""

    def __init__(self, respuestas: list):
        self._respuestas = list(respuestas)
        self.modelos_llamados: list[str] = []

    def generate_content(self, *, model: str, contents, config):
        self.modelos_llamados.append(model)
        r = self._respuestas.pop(0)
        if isinstance(r, Exception):
            raise r
        return r


class FakeClient:
    def __init__(self, respuestas: list):
        self.models = FakeModels(respuestas)


@pytest.fixture()
def fake_client(monkeypatch: pytest.MonkeyPatch):
    """Inyecta un FakeClient; el test decide las respuestas por atributo."""

    holder: dict = {}

    def _instalar(respuestas: list) -> FakeClient:
        client = FakeClient(respuestas)
        holder["client"] = client
        monkeypatch.setattr(gs, "_get_client", lambda: client)
        return client

    return _instalar


_JSON_UN_MEDICAMENTO = (
    '[{"medicamento": "Losartán", "cantidad": "2 cajas",'
    ' "alternativas": ["Losartán genérico 50mg"]}]'
)


class TestAnalizarRecipeRetry:
    def test_exito_al_primer_intento_usa_modelo_principal(self, fake_client):
        client = fake_client([FakeResponse(_JSON_UN_MEDICAMENTO)])
        resultado = gs._analizar_recipe_sync(b"png", "image/png")
        assert client.models.modelos_llamados == [gs._MODEL_RECIPE]
        assert resultado == [
            {
                "medicamento": "Losartán",
                "cantidad": "2 cajas",
                "alternativas": ["Losartán genérico 50mg"],
            }
        ]

    def test_429_hace_fallback_al_segundo_modelo(self, fake_client):
        client = fake_client([ErrorConCode(429), FakeResponse(_JSON_UN_MEDICAMENTO)])
        resultado = gs._analizar_recipe_sync(b"png", "image/png")
        assert client.models.modelos_llamados == [
            gs._MODEL_RECIPE,
            gs._MODEL_RECIPE_FALLBACK,
        ]
        assert len(resultado) == 1

    def test_503_tambien_reintenta(self, fake_client):
        client = fake_client([ErrorConCode(503), FakeResponse(_JSON_UN_MEDICAMENTO)])
        gs._analizar_recipe_sync(b"png", "image/png")
        assert len(client.models.modelos_llamados) == 2

    def test_doble_429_lanza_quota_error(self, fake_client):
        fake_client([ErrorConCode(429), ErrorConCode(429)])
        with pytest.raises(gs.GeminiQuotaError):
            gs._analizar_recipe_sync(b"png", "image/png")

    def test_doble_timeout_lanza_timeout_error(self, fake_client):
        fake_client([httpx.ReadTimeout("t1"), httpx.ReadTimeout("t2")])
        with pytest.raises(gs.GeminiTimeoutError):
            gs._analizar_recipe_sync(b"png", "image/png")

    def test_error_no_reintentable_falla_sin_segundo_intento(self, fake_client):
        client = fake_client([ValueError("boom")])
        with pytest.raises(gs.GeminiParsingError):
            gs._analizar_recipe_sync(b"png", "image/png")
        assert client.models.modelos_llamados == [gs._MODEL_RECIPE]

    def test_json_invalido_lanza_parsing_error(self, fake_client):
        fake_client([FakeResponse("esto no es json")])
        with pytest.raises(gs.GeminiParsingError):
            gs._analizar_recipe_sync(b"png", "image/png")

    def test_items_sin_medicamento_se_filtran(self, fake_client):
        fake_client(
            [
                FakeResponse(
                    '[{"medicamento": "Losartán", "cantidad": "", "alternativas": []},'
                    ' {"cantidad": "2 cajas", "alternativas": []}]'
                )
            ]
        )
        resultado = gs._analizar_recipe_sync(b"png", "image/png")
        assert len(resultado) == 1
        assert resultado[0]["medicamento"] == "Losartán"

    def test_quota_error_es_subclase_de_parsing_error(self):
        assert issubclass(gs.GeminiQuotaError, gs.GeminiParsingError)
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `cd /home/josemarrufo/Escritorio/DosisYa-Backend && uv run pytest tests/test_gemini_service.py -v -k "Retry or quota"`
Expected: FAIL — `AttributeError: ... no attribute 'GeminiQuotaError'` y fallos en `_analizar_recipe_sync` (la versión vieja llama `_get_gemini_client`, no `_get_client`, y no reintenta).

- [ ] **Step 3: Implementar GeminiQuotaError, _extraer_lista_json y la nueva _analizar_recipe_sync**

En `gemini_service.py`:

**(a)** Junto a las clases de excepción existentes (después de `GeminiTimeoutError`, ~línea 174), añadir:

```python
class GeminiQuotaError(GeminiParsingError):
    """Todos los intentos contra Gemini fallaron por cuota agotada (429).

    Subclase de GeminiParsingError por la misma razón que GeminiTimeoutError.
    El router la mapea a 503 con mensaje amigable (contrato del frontend).
    """
```

**(b)** Añadir el helper de parsing compartido (antes de `_analizar_recipe_sync`):

```python
def _extraer_lista_json(response: Any, contexto: str, sugerencia: str) -> list[Any]:
    """Extrae response.text, lo parsea como JSON y valida que sea una lista.

    Compartido por el escáner de récipe y el parser de inventario (Task 3).

    Args:
        response: Respuesta de client.models.generate_content.
        contexto: Etiqueta para logs ("récipe" | "inventario").
        sugerencia: Cola del mensaje de error de cara al usuario.

    Raises:
        GeminiParsingError: respuesta bloqueada, JSON inválido o no-lista.
    """
    raw_text = ""
    try:
        raw_text = response.text or ""
    except Exception:
        # Algunos errores de safety/block no tienen .text
        try:
            finish_reason = response.candidates[0].finish_reason
            raise GeminiParsingError(
                f"Gemini bloqueó la respuesta (finish_reason={finish_reason})."
            )
        except (AttributeError, IndexError) as exc:
            raise GeminiParsingError("Gemini no devolvió respuesta válida.") from exc

    try:
        datos = json.loads(raw_text)
    except json.JSONDecodeError as e:
        logger.error(
            "Gemini devolvió JSON inválido (%s): %s\nTexto: %.500s",
            contexto, e, raw_text,
        )
        raise GeminiParsingError(
            f"Gemini devolvió un JSON con formato inválido: {e}. {sugerencia}"
        ) from e

    if not isinstance(datos, list):
        raise GeminiParsingError(
            f"Gemini devolvió {type(datos).__name__} en lugar de una lista. {sugerencia}"
        )
    return datos
```

**(c)** REEMPLAZAR el cuerpo completo de `_analizar_recipe_sync` (mantener nombre y firma):

```python
def _analizar_recipe_sync(imagen_bytes: bytes, mime_type: str) -> list[dict[str, Any]]:
    """Versión síncrona del escáner de récipe — se ejecuta en un thread pool.

    Estrategia free tier: hasta 2 intentos. El primero con _MODEL_RECIPE; si
    falla por cuota (429), transitorio (5xx) o timeout, reintenta con
    _MODEL_RECIPE_FALLBACK (cuota separada en free tier). Errores no
    reintentables se propagan de inmediato.

    Raises:
        GeminiParsingError: API falla de forma no reintentable o JSON inválido.
        GeminiQuotaError: ambos intentos agotaron cuota (429).
        GeminiTimeoutError: ambos intentos excedieron su deadline.
        RuntimeError: GEMINI_API_KEY no configurada.
    """
    client = _get_client()

    from google.genai import types

    parte_imagen = types.Part.from_bytes(data=imagen_bytes, mime_type=mime_type)

    intentos = (
        (_MODEL_RECIPE, _RECIPE_TIMEOUT_INTENTO_1_S),
        (_MODEL_RECIPE_FALLBACK, _RECIPE_TIMEOUT_INTENTO_2_S),
    )
    ultima_clase: str | None = None
    ultimo_error: BaseException | None = None
    response = None

    for numero, (modelo, timeout_s) in enumerate(intentos, start=1):
        try:
            response = client.models.generate_content(
                model=modelo,
                contents=[_PROMPT_RECIPE, parte_imagen],
                config=_config_generacion(
                    timeout_s, response_schema=_RECIPE_RESPONSE_SCHEMA
                ),
            )
            break
        except Exception as e:
            clase = _clasificar_error(e)
            if clase is None:
                logger.error(
                    "Error no reintentable de Gemini Vision (%s): %s", modelo, e
                )
                raise GeminiParsingError(
                    f"Error al consultar Gemini Vision API: {e}"
                ) from e
            ultima_clase, ultimo_error = clase, e
            logger.warning(
                "Intento %d/%d del récipe falló con %s (%s): %s",
                numero, len(intentos), modelo, clase, e,
            )

    if response is None:
        if ultima_clase == "quota":
            raise GeminiQuotaError(
                "Hay mucha demanda en este momento. Intenta de nuevo en un minuto."
            ) from ultimo_error
        if ultima_clase == "timeout":
            raise GeminiTimeoutError(
                "El servicio de IA tardó demasiado en responder. "
                "Intenta de nuevo en un momento."
            ) from ultimo_error
        raise GeminiParsingError(
            f"Error al consultar Gemini Vision API: {ultimo_error}"
        ) from ultimo_error

    medicamentos = _extraer_lista_json(
        response, contexto="récipe", sugerencia="Intenta con una foto más clara."
    )

    # Validar y sanitizar cada item — descarta items sin `medicamento`.
    resultado: list[dict[str, Any]] = []
    for i, item in enumerate(medicamentos):
        if not isinstance(item, dict):
            logger.warning("Item %d ignorado (no es dict): %r", i, item)
            continue
        if not item.get("medicamento"):
            logger.warning("Item %d ignorado (falta 'medicamento'): %r", i, item)
            continue

        alternativas_raw = item.get("alternativas") or []
        if not isinstance(alternativas_raw, list):
            alternativas_raw = []

        resultado.append({
            "medicamento":   str(item["medicamento"]).strip(),
            "cantidad":      str(item.get("cantidad") or "").strip(),
            "alternativas":  [str(a).strip() for a in alternativas_raw if str(a).strip()],
        })

    logger.info(
        "Gemini Vision extrajo %d medicamentos válidos de %d items totales (récipe).",
        len(resultado),
        len(medicamentos),
    )
    return resultado
```

**(d)** En el wrapper async `analizar_recipe`, cambiar SOLO el timeout del techo global:

```python
        return await asyncio.wait_for(
            asyncio.to_thread(_analizar_recipe_sync, imagen_bytes, mime_type),
            timeout=_RECIPE_TIMEOUT_GLOBAL_S,
        )
```

y en el log del `except asyncio.TimeoutError` correspondiente, usar `_RECIPE_TIMEOUT_GLOBAL_S` en lugar de `_GEMINI_TIMEOUT_SECONDS + _TIMEOUT_BUFFER_SECONDS`.

- [ ] **Step 4: Correr los tests del servicio**

Run: `cd /home/josemarrufo/Escritorio/DosisYa-Backend && uv run pytest tests/test_gemini_service.py -v`
Expected: PASS (22 tests).

- [ ] **Step 5: Correr la suite completa**

Run: `cd /home/josemarrufo/Escritorio/DosisYa-Backend && uv run pytest -q`
Expected: todos verdes (los tests del router mockean `analizar_recipe` a nivel router, no les afecta la migración).

- [ ] **Step 6: Commit (repo backend)**

```bash
cd /home/josemarrufo/Escritorio/DosisYa-Backend && git add src/dosisya/services/gemini_service.py tests/test_gemini_service.py && git commit -m "feat(ia): escáner de récipe migrado a google-genai con thinking off y retry flash→flash-lite"
```

---

### Task 3: Migrar el parser de inventario B2B y eliminar el código legacy

**Files:**
- Modify: `/home/josemarrufo/Escritorio/DosisYa-Backend/src/dosisya/services/gemini_service.py` (reemplazar `_parsear_inventario_sync` ~líneas 230-333; borrar `_get_gemini_client` y `_es_timeout`; actualizar docstring del módulo)
- Test: `/home/josemarrufo/Escritorio/DosisYa-Backend/tests/test_gemini_service.py`

**Interfaces:**
- Consumes (Tasks 1-2): `_get_client`, `_clasificar_error`, `_config_generacion`, `_MODEL_INVENTARIO`, `_extraer_lista_json`.
- Produces: `parsear_inventario(csv_text: str) -> list[dict]` — firma SIN cambios (el router b2b ya la consume así). Tras esta task NO queda ningún import de `google.generativeai` ni `google.api_core` en el repo.

- [ ] **Step 1: Escribir los tests que fallan (inventario migrado)**

Añadir al final de `tests/test_gemini_service.py`:

```python
_JSON_INVENTARIO = (
    '[{"principio_activo": "Paracetamol", "marca_comercial": "Atamel",'
    ' "presentacion": "Tabletas 500mg x 10", "precio_usd": 2.5}]'
)


class TestParsearInventarioMigrado:
    def test_exito_usa_modelo_inventario(self, fake_client):
        client = fake_client([FakeResponse(_JSON_INVENTARIO)])
        resultado = gs._parsear_inventario_sync("producto,precio\nAtamel 500mg,2.5")
        assert client.models.modelos_llamados == [gs._MODEL_INVENTARIO]
        assert resultado == [
            {
                "principio_activo": "Paracetamol",
                "marca_comercial": "Atamel",
                "presentacion": "Tabletas 500mg x 10",
                "precio_usd": 2.5,
            }
        ]

    def test_timeout_lanza_timeout_error_sin_reintento(self, fake_client):
        client = fake_client([httpx.ReadTimeout("lento")])
        with pytest.raises(gs.GeminiTimeoutError):
            gs._parsear_inventario_sync("producto,precio\nAtamel,2.5")
        # El inventario NO reintenta (comportamiento actual preservado).
        assert len(client.models.modelos_llamados) == 1

    def test_archivo_vacio_lanza_parsing_error(self):
        with pytest.raises(gs.GeminiParsingError):
            gs._parsear_inventario_sync("   ")

    def test_no_quedan_referencias_al_sdk_legacy(self):
        import inspect

        fuente = inspect.getsource(gs)
        assert "google.generativeai" not in fuente
        assert "google.api_core" not in fuente
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `cd /home/josemarrufo/Escritorio/DosisYa-Backend && uv run pytest tests/test_gemini_service.py::TestParsearInventarioMigrado -v`
Expected: FAIL — la versión vieja llama `_get_gemini_client` (no el fake) y el test de referencias legacy encuentra `google.generativeai` en el fuente.

- [ ] **Step 3: Migrar _parsear_inventario_sync y borrar el código legacy**

**(a)** REEMPLAZAR el bloque try/except de la llamada a Gemini dentro de `_parsear_inventario_sync` (la validación de `csv_text`, el truncado a `LIMITE_CHARS_GEMINI` y la construcción de `prompt_completo` se conservan tal cual):

```python
    client = _get_client()
    try:
        response = client.models.generate_content(
            model=_MODEL_INVENTARIO,
            contents=prompt_completo,
            # Sin response_schema: preserva el comportamiento actual del parser.
            config=_config_generacion(_GEMINI_TIMEOUT_SECONDS),
        )
    except Exception as e:
        if _clasificar_error(e) == "timeout":
            logger.warning(
                "Gemini excedió el timeout de %.0fs.", _GEMINI_TIMEOUT_SECONDS
            )
            raise GeminiTimeoutError(
                f"El servicio de IA tardó más de {_GEMINI_TIMEOUT_SECONDS:.0f}s "
                "en responder. Intenta de nuevo en un momento."
            ) from e
        logger.error("Error llamando a Gemini API: %s", e)
        raise GeminiParsingError(f"Error al consultar Gemini API: {e}") from e
```

**(b)** Reemplazar el bloque de extracción de texto + json.loads + validación de lista de `_parsear_inventario_sync` por:

```python
    medicamentos = _extraer_lista_json(
        response, contexto="inventario", sugerencia="Verifica el formato del archivo."
    )
```

(El bucle de sanitización con `principio_activo`/`presentacion`/`precio_usd` y el `logger.info` final se conservan tal cual.)

> Nota de copy: el mensaje de JSON inválido del inventario pasa de "Intenta con un archivo más limpio." a "Verifica el formato del archivo." — cosmético, solo aparece en el mensaje de error hacia la farmacia B2B.

**(c)** BORRAR completos: la función `_get_gemini_client` y la función `_es_timeout` (ya no tienen llamadores).

**(d)** Actualizar el docstring del módulo (líneas 1-20): reemplazar la mención "Usa gemini-flash-latest" y la sección "Diseño" por:

```python
"""
DosisYa — Servicio de IA con Gemini (SDK google-genai)

Dos consumidores:
  - Parser de inventarios B2B (CSV/Excel → medicamentos normalizados).
  - Escáner de récipes B2C (foto → medicamentos, con retry flash→flash-lite).

Diseño:
  - SDK google-genai (el legacy google-generativeai fue retirado por Google).
  - thinking_budget=0: desactiva el razonamiento de Gemini 2.5 (~20s menos).
  - Modelos configurables por entorno: GEMINI_MODEL_RECIPE,
    GEMINI_MODEL_RECIPE_FALLBACK, GEMINI_MODEL_INVENTARIO.
  - Récipe: 2 intentos con modelos de cuota separada (free tier friendly).
  - response_mime_type="application/json" (+ response_schema en el récipe).
  - Funciones async vía asyncio.to_thread + techo global asyncio.wait_for.

Configuración:
  - GEMINI_API_KEY: variable de entorno requerida (RuntimeError si falta).
  - GEMINI_TIMEOUT_SECONDS: timeout RPC del inventario (default 30s).

Prompt de sistema:
  Ver _PROMPT_SISTEMA (inventario) y _PROMPT_RECIPE (récipe — contiene la
  REGLA MÉDICA de mismo principio activo; NO modificar su texto).
"""
```

- [ ] **Step 4: Correr la suite completa**

Run: `cd /home/josemarrufo/Escritorio/DosisYa-Backend && uv run pytest -q`
Expected: todos verdes (26 en test_gemini_service.py + los 41 del baseline).

- [ ] **Step 5: Commit (repo backend)**

```bash
cd /home/josemarrufo/Escritorio/DosisYa-Backend && git add src/dosisya/services/gemini_service.py tests/test_gemini_service.py && git commit -m "refactor(ia): parser de inventario migrado a google-genai; eliminado SDK legacy"
```

---

### Task 4: Router — mapear GeminiQuotaError a 503

**Files:**
- Modify: `/home/josemarrufo/Escritorio/DosisYa-Backend/src/dosisya/routers/ia.py` (import ~línea 33, bloque try/except ~líneas 130-150, dict `responses` ~líneas 74-79, docstring del módulo ~línea 22)
- Test: `/home/josemarrufo/Escritorio/DosisYa-Backend/tests/test_ia_router.py`

**Interfaces:**
- Consumes (Task 2): `GeminiQuotaError` desde `dosisya.services.gemini_service`.
- Produces: contrato HTTP — cuota agotada → **503** con `detail` amigable. El frontend (`recipeIA.ts`) ya muestra el texto de cualquier respuesta no-2xx, no necesita cambios para esto.

- [ ] **Step 1: Escribir el test que falla**

Añadir a `tests/test_ia_router.py`, dentro de `class TestErroresGemini` (el import de la línea 23 pasa a incluir `GeminiQuotaError`):

```python
    def test_cuota_agotada_devuelve_503(self, monkeypatch: pytest.MonkeyPatch):
        async def fake_analizar_recipe(imagen_bytes: bytes, mime_type: str):
            raise GeminiQuotaError(
                "Hay mucha demanda en este momento. Intenta de nuevo en un minuto."
            )

        monkeypatch.setattr(
            "dosisya.routers.ia.analizar_recipe", fake_analizar_recipe
        )

        resp = client.post(ENDPOINT, files=_files())
        assert resp.status_code == 503
        # resp.text cubre tanto el envelope custom como el {"detail": ...} default
        assert "demanda" in resp.text.lower()
```

Y actualizar el import en la línea 23:

```python
from dosisya.services.gemini_service import (
    GeminiParsingError,
    GeminiQuotaError,
    GeminiTimeoutError,
)
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `cd /home/josemarrufo/Escritorio/DosisYa-Backend && uv run pytest tests/test_ia_router.py::TestErroresGemini::test_cuota_agotada_devuelve_503 -v`
Expected: FAIL — devuelve 200 (GeminiQuotaError es subclase de GeminiParsingError y cae en el branch de "ilegible").

- [ ] **Step 3: Implementar el mapeo en ia.py**

**(a)** Ampliar el import de servicios (~línea 33):

```python
from dosisya.services.gemini_service import (
    GeminiParsingError,
    GeminiQuotaError,
    GeminiTimeoutError,
    analizar_recipe,
)
```

**(b)** En el try/except del endpoint, añadir el branch ANTES de `except GeminiParsingError:` (el orden importa: QuotaError es subclase de ParsingError):

```python
    except GeminiQuotaError as e:
        # Cuota del free tier agotada en ambos modelos: transitorio, que el
        # paciente reintente en un momento — NO es un récipe ilegible.
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(e),
        ) from e
```

**(c)** Añadir al dict `responses` del decorador:

```python
        503: {"description": "Cuota de Gemini agotada temporalmente (free tier) — reintentar"},
```

**(d)** Añadir la línea al docstring del módulo (bloque "Contrato", ~línea 22):

```
  Cuota agotada (ambos modelos) → 503
```

- [ ] **Step 4: Correr la suite completa del backend**

Run: `cd /home/josemarrufo/Escritorio/DosisYa-Backend && uv run pytest -q`
Expected: todos verdes.

- [ ] **Step 5: Commit (repo backend)**

```bash
cd /home/josemarrufo/Escritorio/DosisYa-Backend && git add src/dosisya/routers/ia.py tests/test_ia_router.py && git commit -m "feat(ia): cuota agotada de Gemini responde 503 con mensaje amigable"
```

---

### Task 5: Frontend — compresión de imagen + mock corregido

**Files:**
- Create: `/home/josemarrufo/Escritorio/DosisYa-Frontend/src/lib/comprimirImagen.ts`
- Modify: `/home/josemarrufo/Escritorio/DosisYa-Frontend/src/lib/recipeIA.ts` (mock líneas 63-96, función `analizarRecipe` líneas 106-154)

**Interfaces:**
- Consumes: nada del backend (el contrato HTTP no cambió).
- Produces: `comprimirImagen(file: File): Promise<File>` — SIEMPRE resuelve (nunca lanza); devuelve el original si no puede comprimir. `analizarRecipe(imagen: File)` mantiene su firma — `EscanerRecipe.tsx` no se toca.

- [ ] **Step 1: Crear src/lib/comprimirImagen.ts**

```typescript
// ─────────────────────────────────────────────────────────────────────────────
// Compresión de imagen en el navegador — canvas nativo, sin dependencias.
//
// Las fotos de récipe salen del celular en 3-8 MB; comprimirlas a ~1600px
// JPEG reduce el upload (redes lentas) y el procesamiento de Gemini Vision
// (spec: receta-ia-optimizacion-gemini.md).
//
// Garantía: NUNCA lanza ni bloquea el flujo. Si el navegador no puede
// decodificar (ej. HEIC en Chrome) o el resultado sale más grande, devuelve
// el archivo original — el backend acepta hasta 10 MB igual que antes.
// ─────────────────────────────────────────────────────────────────────────────

/** Lado mayor máximo tras redimensionar. Suficiente para letra manuscrita. */
const MAX_DIMENSION_PX = 1600;

/** Calidad JPEG del resultado (0-1). */
const JPEG_QUALITY = 0.8;

/** Por debajo de este tamaño no vale la pena recomprimir. */
const MIN_BYTES_PARA_COMPRIMIR = 300 * 1024;

/** Reemplaza la extensión por .jpg (el output del canvas siempre es JPEG). */
function nombreJpeg(nombre: string): string {
  const base = nombre.replace(/\.[^.]+$/, "");
  return `${base || "recipe"}.jpg`;
}

/**
 * Comprime una imagen a JPEG de máx. 1600px de lado mayor.
 *
 * @param file - Imagen original de cámara o galería.
 * @returns El archivo comprimido, o el original si comprimir no aplica/falla.
 */
export async function comprimirImagen(file: File): Promise<File> {
  if (file.size < MIN_BYTES_PARA_COMPRIMIR) return file;

  try {
    const bitmap = await createImageBitmap(file);
    try {
      const escala = Math.min(
        1,
        MAX_DIMENSION_PX / Math.max(bitmap.width, bitmap.height),
      );
      const ancho = Math.max(1, Math.round(bitmap.width * escala));
      const alto = Math.max(1, Math.round(bitmap.height * escala));

      const canvas = document.createElement("canvas");
      canvas.width = ancho;
      canvas.height = alto;
      const ctx = canvas.getContext("2d");
      if (!ctx) return file;
      ctx.drawImage(bitmap, 0, 0, ancho, alto);

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
      );

      // Si el canvas falló o "comprimir" agrandó el archivo, usar el original.
      if (!blob || blob.size >= file.size) return file;

      return new File([blob], nombreJpeg(file.name), { type: "image/jpeg" });
    } finally {
      bitmap.close();
    }
  } catch {
    // HEIC en Chrome, imagen corrupta, navegador viejo… → enviar original.
    return file;
  }
}
```

- [ ] **Step 2: Integrar la compresión y corregir el mock en recipeIA.ts**

**(a)** Añadir el import (junto al de `API_BASE`, línea 13):

```typescript
import { comprimirImagen } from "./comprimirImagen";
```

**(b)** Reemplazar la línea 69 (`const MOCK_HABILITADO = import.meta.env.DEV;`) por:

```typescript
// Solo en desarrollo, y desactivable con VITE_RECIPE_MOCK=off para probar
// contra el backend real (uvicorn local vía proxy de Vite).
const MOCK_HABILITADO =
  import.meta.env.DEV && import.meta.env.VITE_RECIPE_MOCK !== "off";
```

**(c)** Reemplazar el contenido de `MOCK_RESPUESTA` (líneas 71-91). Los datos actuales violan la regla médica (sugieren Valsartán como alternativa a Losartán — otro principio activo). Nuevos datos, mismo principio activo siempre:

```typescript
const MOCK_RESPUESTA: RespuestaRecipe = {
  status: "success",
  message: "Récipe analizado exitosamente.",
  data: [
    {
      medicamento: "Losartán",
      cantidad: "2 cajas",
      // REGLA MÉDICA: alternativas = MISMO principio activo (marcas/genéricos).
      alternativas: ["Losartán genérico 50mg", "Cormac (Losartán)"],
    },
    {
      medicamento: "Metformina",
      cantidad: "1 caja",
      alternativas: ["Glucofage (Metformina)"],
    },
    {
      medicamento: "Atorvastatina",
      cantidad: "1 caja",
      alternativas: ["Lipitor (Atorvastatina)"],
    },
  ],
};
```

**(d)** En `analizarRecipe` (línea 106), comprimir ANTES de armar el FormData y de iniciar el timer de abort (la compresión no debe comerse el presupuesto de 45s):

```typescript
export async function analizarRecipe(imagen: File): Promise<RespuestaRecipe> {
  // ── MOCK: quitar este bloque cuando el endpoint exista ──
  if (MOCK_HABILITADO) {
    return mockAnalizarRecipe();
  }
  // ── FIN MOCK ──

  // Comprimir primero (nunca lanza): 3-8 MB de cámara → ~300 KB JPEG.
  const imagenAEnviar = await comprimirImagen(imagen);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), RECIPE_TIMEOUT_MS);

  try {
    const formData = new FormData();
    formData.append("file", imagenAEnviar);
```

(El resto de la función — fetch, manejo de errores, `finally` — queda idéntico.)

- [ ] **Step 3: Verificación de tipos y build (regla pre-commit del repo)**

Run: `cd /home/josemarrufo/Escritorio/DosisYa-Frontend && npx tsc --noEmit && npm run build`
Expected: sin errores de tipos; build exitoso.

- [ ] **Step 4: Verificar la compresión en el navegador (preview)**

Con el dev server corriendo (`npm run dev`, puerto 5173): abrir el escáner, subir una foto grande (>1 MB) con `VITE_RECIPE_MOCK=off` y el backend local corriendo, y confirmar en la pestaña Network que el request a `/api/v1/ia/analizar-recipe` sube un `file` de ~200-500 KB tipo `image/jpeg`. Si no hay backend local disponible en este momento, verificar al menos (con mock activo) que el flujo idle → scanning → results no se rompió.

- [ ] **Step 5: Commit (repo frontend)**

```bash
cd /home/josemarrufo/Escritorio/DosisYa-Frontend && git add src/lib/comprimirImagen.ts src/lib/recipeIA.ts && git commit -m "feat(recipe): compresión de imagen en el navegador + mock conforme a regla médica"
```

---

### Task 6: Verificación end-to-end con Gemini real y medición de latencia

**Files:**
- Ninguno nuevo (verificación manual + posible ajuste de env vars).

**Interfaces:**
- Consumes: todo lo anterior desplegable en local.
- Produces: evidencia de latencia antes/después y confirmación del flujo completo.

- [ ] **Step 1: Levantar el backend local con la API key real**

Run: `cd /home/josemarrufo/Escritorio/DosisYa-Backend && uv run uvicorn dosisya.main:app --port 8000`
Expected: server arriba en :8000. Requiere `GEMINI_API_KEY` en el `.env`/entorno del backend.

- [ ] **Step 2: Medir la latencia del endpoint con una foto real de récipe**

Con una imagen de prueba (cualquier foto de récipe o texto manuscrito en JPEG):

```bash
curl -s -o /dev/null -w "HTTP %{http_code} — %{time_total}s\n" \
  -X POST http://localhost:8000/api/v1/ia/analizar-recipe \
  -F "file=@/ruta/a/recipe-prueba.jpg;type=image/jpeg"
```

Expected: `HTTP 200 — <8s` (meta p50 del spec; antes era ~30s). Correrlo 3 veces para ver la variación. Si responde 503, es la cuota free tier del día — esperar 1 min (RPM) o revisar cuota diaria.

- [ ] **Step 3: Probar el flujo completo desde el navegador**

Frontend con `VITE_RECIPE_MOCK=off` (ej. `VITE_RECIPE_MOCK=off npm run dev`), backend local corriendo: escanear la foto desde el drawer y verificar idle → scanning → results con medicamentos reales del récipe y alternativas del MISMO principio activo.

- [ ] **Step 4: Probar el parser de inventario B2B (regresión de la migración)**

Desde el dashboard admin (o con curl al endpoint B2B correspondiente), subir un CSV pequeño de inventario y confirmar que la normalización sigue funcionando.

- [ ] **Step 5: Anotar resultados y push**

Anotar las latencias medidas en el PR/commit final. Push de ambos repos cuando el usuario lo apruebe (recordar: los builds de Vercel se rompieron dos veces por saltarse `npx tsc --noEmit && npm run build` — ya cubierto en Task 5 Step 3).

```bash
cd /home/josemarrufo/Escritorio/DosisYa-Backend && git log --oneline -5
cd /home/josemarrufo/Escritorio/DosisYa-Frontend && git log --oneline -3
```

Expected: commits de Tasks 1-5 presentes y suites verdes en ambos repos.

---

## Notas para el ejecutor

- **Riesgo conocido — API del SDK nuevo:** los nombres exactos (`types.HttpOptions(timeout=ms)`, `types.ThinkingConfig(thinking_budget=0)`, `types.Part.from_bytes(data=, mime_type=)`) corresponden a google-genai 1.x. Si algún test de Task 1 falla por un campo renombrado, inspeccionar con `uv run python -c "from google.genai import types; help(types.GenerateContentConfig)"` y ajustar el helper `_config_generacion` — la INTENCIÓN (JSON mode, temp 0.1, thinking off, timeout por intento) no cambia.
- **No tocar:** `_PROMPT_RECIPE` (regla médica), `_PROMPT_SISTEMA`, el envelope `RespuestaEstructurada`, ni `EscanerRecipe.tsx`.
- **Vercel (post-merge, manual del usuario):** el deploy del backend instalará `google-genai` desde requirements.txt automáticamente. Las env vars de modelos son opcionales (hay defaults). Cuando el usuario active facturación, podrá subir modelo con `GEMINI_MODEL_RECIPE` sin tocar código.
