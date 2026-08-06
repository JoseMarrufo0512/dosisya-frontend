# Modo Farmacéutico del Escáner de Récipe — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar un modo autenticado del escáner de récipe, dentro del panel de farmacia, que extrae campos técnicos de dispensación (sin PII) y los cruza contra el inventario propio de la farmacia — gateado al plan Premium.

**Architecture:** El backend gana un parámetro `modo` ("paciente" | "farmaceutico") que se enhebra desde un nuevo endpoint autenticado (`POST /api/v1/farmacias/{id}/ia/analizar-recipe`) hasta el orquestador Gemini→NVIDIA ya existente, seleccionando prompt/schema/validador distintos según el modo. El frontend agrega un cliente y un componente nuevos en el panel B2B; el cruce de inventario se hace en el cliente contra datos que el dashboard ya carga — sin backend nuevo para eso.

**Tech Stack:** FastAPI + asyncpg + google-genai + openai SDK (backend, Python 3.11); React 19 + TanStack Router + vaul (Drawer) + framer-motion (frontend, TypeScript).

**Repos:** `/home/josemarrufo/Escritorio/DosisYa-Backend` (tasks 1-5) y `/home/josemarrufo/Escritorio/DosisYa-Frontend` (tasks 6-8), cada uno con su propio historial de commits — no son el mismo repo.

## Global Constraints

- **Sin PII**: nunca extraer/guardar nombre de paciente, número de historia clínica, ni colegiado del médico. Solo datos del medicamento.
- **Gating**: la función solo está disponible si `nivel_suscripcion == "premium"` (o `rol == "superadmin"`). Farmacias gratuitas ven el botón deshabilitado con badge "Premium".
- **Sin `alternativas`** en el modo farmacéutico — ese campo es exclusivo del modo paciente.
- **Cruce de inventario en el cliente**: sin endpoint de búsqueda nuevo; se usa el array `inventario` que el dashboard ya carga.
- **Reutiliza `ia_orchestrator.py`** (Gemini→NVIDIA, ya en `main` del backend desde el PR #5 del 2026-08-05) — no se llama a ningún proveedor de IA directamente desde el nuevo endpoint.
- **Verificación obligatoria antes de cada commit** (regla del repo, CLAUDE.md): backend → `pytest -q` (suite completa en verde) + `ruff check` sobre los archivos tocados; frontend → `npx tsc --noEmit && npm run build`.
- **Rate limit** del nuevo endpoint: `15/minute` por IP (autenticado, más permisivo que el público de 5/min).
- **No modificar el endpoint público** `/api/v1/ia/analizar-recipe` ni su contrato — el parámetro `modo` es aditivo con default `"paciente"` en todas las capas.

---

## Backend (`/home/josemarrufo/Escritorio/DosisYa-Backend`)

### Task 1: Prompt, schema y validación del modo farmacéutico

**Files:**
- Modify: `src/dosisya/services/ia_prompts.py`
- Test: `tests/test_ia_prompts.py`

**Interfaces:**
- Produces: `ia_prompts.PROMPT_RECIPE_FARMACIA: str`, `ia_prompts.RECIPE_FARMACIA_RESPONSE_SCHEMA: dict`, `ia_prompts.validar_items_medicamento_farmacia(items: list[Any]) -> list[dict[str, Any]]` (claves: `nombre_comercial`, `principio_activo`, `concentracion_mg`, `forma_farmaceutica`, `cantidad_total_unidades`, `posologia_detallada`, `via_administracion`).

- [ ] **Step 1: Escribir los tests que fallan**

Añade al final de `tests/test_ia_prompts.py`:

```python
class TestValidarItemsMedicamentoFarmacia:
    def test_item_valido_se_conserva(self):
        items = [
            {
                "nombre_comercial": "Atamel",
                "principio_activo": "Paracetamol",
                "concentracion_mg": "500mg",
                "forma_farmaceutica": "comprimido",
                "cantidad_total_unidades": "20 tabletas",
                "posologia_detallada": "cada 8 horas",
                "via_administracion": "oral",
            }
        ]
        resultado = ia_prompts.validar_items_medicamento_farmacia(items)
        assert resultado == items

    def test_item_sin_principio_activo_se_descarta(self):
        items = [{"nombre_comercial": "Atamel", "concentracion_mg": "500mg"}]
        assert ia_prompts.validar_items_medicamento_farmacia(items) == []

    def test_item_no_dict_se_descarta(self):
        assert ia_prompts.validar_items_medicamento_farmacia(["no es un dict"]) == []

    def test_campos_tecnicos_ausentes_usan_ilegible(self):
        items = [{"principio_activo": "Paracetamol"}]
        resultado = ia_prompts.validar_items_medicamento_farmacia(items)
        assert resultado[0]["concentracion_mg"] == "ilegible"
        assert resultado[0]["forma_farmaceutica"] == "ilegible"
        assert resultado[0]["cantidad_total_unidades"] == "ilegible"
        assert resultado[0]["posologia_detallada"] == "ilegible"
        assert resultado[0]["via_administracion"] == "ilegible"

    def test_nombre_comercial_ausente_usa_cadena_vacia(self):
        items = [{"principio_activo": "Paracetamol"}]
        resultado = ia_prompts.validar_items_medicamento_farmacia(items)
        assert resultado[0]["nombre_comercial"] == ""


class TestPromptYSchemaFarmacia:
    def test_prompt_prohibe_pii(self):
        assert "NUNCA extraigas ni infieras nombre del" in ia_prompts.PROMPT_RECIPE_FARMACIA

    def test_schema_requiere_seis_campos_tecnicos(self):
        requeridos = ia_prompts.RECIPE_FARMACIA_RESPONSE_SCHEMA["items"]["required"]
        assert set(requeridos) == {
            "principio_activo",
            "concentracion_mg",
            "forma_farmaceutica",
            "cantidad_total_unidades",
            "posologia_detallada",
            "via_administracion",
        }

    def test_schema_no_requiere_nombre_comercial(self):
        requeridos = ia_prompts.RECIPE_FARMACIA_RESPONSE_SCHEMA["items"]["required"]
        assert "nombre_comercial" not in requeridos

    def test_schema_no_incluye_alternativas(self):
        propiedades = ia_prompts.RECIPE_FARMACIA_RESPONSE_SCHEMA["items"]["properties"]
        assert "alternativas" not in propiedades
```

- [ ] **Step 2: Confirmar que los tests fallan**

Run: `cd /home/josemarrufo/Escritorio/DosisYa-Backend && python -m pytest tests/test_ia_prompts.py -v`
Expected: FAIL — `AttributeError: module 'dosisya.services.ia_prompts' has no attribute 'validar_items_medicamento_farmacia'` (y similares para `PROMPT_RECIPE_FARMACIA` / `RECIPE_FARMACIA_RESPONSE_SCHEMA`).

- [ ] **Step 3: Implementar en `ia_prompts.py`**

Añade después de `PROMPT_RECIPE` (antes de `def validar_items_medicamento`):

```python
RECIPE_FARMACIA_RESPONSE_SCHEMA = {
    "type": "array",
    "items": {
        "type": "object",
        "properties": {
            "nombre_comercial": {
                "type": "string",
                "description": "Nombre de marca si se lee; cadena vacía si no aplica/no se lee",
            },
            "principio_activo": {
                "type": "string",
                "description": "Nombre genérico INN; 'ilegible' si no se puede determinar",
            },
            "concentracion_mg": {
                "type": "string",
                "description": "Dosis tal como está escrita (ej: '500mg'); 'ilegible' si no se lee",
            },
            "forma_farmaceutica": {
                "type": "string",
                "description": "Comprimido, jarabe, cápsula, inyectable, etc.; 'ilegible' si no se lee",
            },
            "cantidad_total_unidades": {
                "type": "string",
                "description": "Cantidad total recetada tal como está escrita; 'ilegible' si no se lee",
            },
            "posologia_detallada": {
                "type": "string",
                "description": "Frecuencia/duración tal como está escrita; 'ilegible' si no se lee",
            },
            "via_administracion": {
                "type": "string",
                "description": "Oral, tópica, intramuscular, etc.; 'ilegible' si no se indica",
            },
        },
        "required": [
            "principio_activo",
            "concentracion_mg",
            "forma_farmaceutica",
            "cantidad_total_unidades",
            "posologia_detallada",
            "via_administracion",
        ],
    },
}

# ─────────────────────────────────────────────────────────────────────────
# MODO FARMACÉUTICO (panel B2B, autenticado — ver
# docs/superpowers/specs/2026-08-05-modo-farmaceutico-escaner-recipe-design.md
# del repo DosisYa-Frontend). Datos técnicos de dispensación, NUNCA datos de
# paciente/médico: si se edita este prompt, esa restricción NO debe
# eliminarse ni suavizarse. Sin `alternativas` — el farmacéutico dispensa lo
# recetado, no sugiere sustitutos (eso es exclusivo del modo paciente).
# ─────────────────────────────────────────────────────────────────────────

PROMPT_RECIPE_FARMACIA = """Eres un auxiliar de farmacia venezolano. Tu tarea es extraer
EXACTAMENTE lo que está escrito en este récipe médico, en JSON estructurado, para que un
farmacéutico dispense con precisión.

Reglas de extracción:
1. Estos son datos de MEDICAMENTO únicamente. NUNCA extraigas ni infieras nombre del
   paciente, número de historia clínica, ni datos del médico — no son parte de esta tarea.
2. Si un campo no es legible o no está presente, usa el string "ilegible" (o cadena vacía
   "" para nombre_comercial). PROHIBIDO inventar o inferir valores para completar campos
   ilegibles.
3. principio_activo: nombre genérico INN si lo reconoces (ej. "Atamel" → "Paracetamol");
   si no lo reconoces con certeza, usa el nombre/marca tal como aparece escrito.
4. concentracion_mg: la dosis tal como está escrita (ej. "500mg", "5mg/ml").
5. forma_farmaceutica: comprimido, jarabe, cápsula, inyectable, etc.
6. cantidad_total_unidades: cantidad total recetada tal como está escrita.
7. posologia_detallada: frecuencia/duración tal como está escrita (ej. "cada 8 horas x 7 días").
8. via_administracion: oral, tópica, intramuscular, etc. — solo si está indicada.
9. Si la imagen NO es un récipe médico legible, devuelve una lista vacía [].
10. Devuelve SOLO el JSON — sin texto adicional, sin markdown.
"""
```

Añade después de `validar_items_medicamento` (antes de `def validar_items_inventario`):

```python
def validar_items_medicamento_farmacia(items: list[Any]) -> list[dict[str, Any]]:
    """Valida y sanitiza items del escáner de récipe en modo farmacéutico
    (post-JSON, cualquier proveedor). Descarta items sin `principio_activo`;
    cualquier campo técnico ausente se rellena con "ilegible" (en vez de
    fallar) para que el farmacéutico lo vea y lo corrija a mano.
    """
    campos_ilegible = (
        "principio_activo",
        "concentracion_mg",
        "forma_farmaceutica",
        "cantidad_total_unidades",
        "posologia_detallada",
        "via_administracion",
    )
    resultado: list[dict[str, Any]] = []
    for i, item in enumerate(items):
        if not isinstance(item, dict):
            logger.warning("Item %d ignorado (no es dict): %r", i, item)
            continue
        if not item.get("principio_activo"):
            logger.warning("Item %d ignorado (falta 'principio_activo'): %r", i, item)
            continue

        fila = {
            campo: (str(item.get(campo) or "ilegible").strip() or "ilegible")
            for campo in campos_ilegible
        }
        fila["nombre_comercial"] = str(item.get("nombre_comercial") or "").strip()
        resultado.append(fila)
    return resultado
```

- [ ] **Step 4: Confirmar que los tests pasan**

Run: `cd /home/josemarrufo/Escritorio/DosisYa-Backend && python -m pytest tests/test_ia_prompts.py -v`
Expected: PASS (todos los tests, incluidos los ya existentes).

- [ ] **Step 5: Commit**

```bash
cd /home/josemarrufo/Escritorio/DosisYa-Backend
git add src/dosisya/services/ia_prompts.py tests/test_ia_prompts.py
git commit -m "feat(ia): prompt y schema del modo farmacéutico del escáner de récipe"
```

---

### Task 2: Enhebrar `modo` en `gemini_service.py`

**Files:**
- Modify: `src/dosisya/services/gemini_service.py`
- Test: `tests/test_gemini_service.py`

**Interfaces:**
- Consumes: `ia_prompts.PROMPT_RECIPE_FARMACIA`, `ia_prompts.RECIPE_FARMACIA_RESPONSE_SCHEMA`, `ia_prompts.validar_items_medicamento_farmacia` (Task 1).
- Produces: `gemini_service._analizar_recipe_sync(imagen_bytes: bytes, mime_type: str, modo: str = "paciente") -> list[dict[str, Any]]`, `gemini_service.analizar_recipe(imagen_bytes: bytes, mime_type: str, modo: str = "paciente") -> list[dict[str, Any]]`.

- [ ] **Step 1: Escribir los tests que fallan**

Añade al final de `tests/test_gemini_service.py`:

```python
_JSON_FARMACIA_UN_MEDICAMENTO = (
    '[{"nombre_comercial": "Atamel", "principio_activo": "Paracetamol",'
    ' "concentracion_mg": "500mg", "forma_farmaceutica": "comprimido",'
    ' "cantidad_total_unidades": "20 tabletas", "posologia_detallada": "cada 8 horas",'
    ' "via_administracion": "oral"}]'
)


class TestAnalizarRecipeModoFarmaceutico:
    def test_modo_farmaceutico_usa_schema_tecnico(self, fake_client):
        fake_client([FakeResponse(_JSON_FARMACIA_UN_MEDICAMENTO)])
        resultado = gs._analizar_recipe_sync(b"png", "image/png", modo="farmaceutico")
        assert resultado == [
            {
                "nombre_comercial": "Atamel",
                "principio_activo": "Paracetamol",
                "concentracion_mg": "500mg",
                "forma_farmaceutica": "comprimido",
                "cantidad_total_unidades": "20 tabletas",
                "posologia_detallada": "cada 8 horas",
                "via_administracion": "oral",
            }
        ]

    def test_modo_paciente_por_default_no_cambia(self, fake_client):
        fake_client([FakeResponse(_JSON_UN_MEDICAMENTO)])
        resultado = gs._analizar_recipe_sync(b"png", "image/png")
        assert resultado == [
            {
                "medicamento": "Losartán",
                "cantidad": "2 cajas",
                "alternativas": ["Losartán genérico 50mg"],
            }
        ]


class TestAnalizarRecipeAsyncModo:
    @pytest.mark.asyncio
    async def test_analizar_recipe_reenvia_modo_al_sync(self, monkeypatch: pytest.MonkeyPatch):
        capturado = {}

        def fake_sync(imagen_bytes, mime_type, modo="paciente"):
            capturado["modo"] = modo
            return []

        monkeypatch.setattr(gs, "_analizar_recipe_sync", fake_sync)
        await gs.analizar_recipe(b"png", "image/png", modo="farmaceutico")
        assert capturado["modo"] == "farmaceutico"
```

- [ ] **Step 2: Confirmar que los tests fallan**

Run: `cd /home/josemarrufo/Escritorio/DosisYa-Backend && python -m pytest tests/test_gemini_service.py -k "Modo" -v`
Expected: FAIL — `TypeError: _analizar_recipe_sync() got an unexpected keyword argument 'modo'`.

- [ ] **Step 3: Implementar en `gemini_service.py`**

Reemplaza la firma y el cuerpo de `_analizar_recipe_sync` (selecciona prompt/schema/validador al inicio, y pasa esas variables donde antes iban `_PROMPT_RECIPE`, `_RECIPE_RESPONSE_SCHEMA` y `validar_items_medicamento`):

```python
def _analizar_recipe_sync(
    imagen_bytes: bytes, mime_type: str, modo: str = "paciente"
) -> list[dict[str, Any]]:
    """Versión síncrona del escáner de récipe — se ejecuta en un thread pool.

    Estrategia free tier: hasta 2 intentos. El primero con _MODEL_RECIPE; si
    falla por cuota (429), transitorio (5xx) o timeout, reintenta con
    _MODEL_RECIPE_FALLBACK (cuota separada en free tier). Errores no
    reintentables se propagan de inmediato — salvo que ocurran con
    thinking_config activo, en cuyo caso se reintenta UNA vez el MISMO
    modelo sin thinking_config antes de rendirse (ver `_config_generacion`):
    un alias "-latest" puede rotar a un modelo que rechaza ese campo con 400
    INVALID_ARGUMENT sin que el código de DosisYa haya cambiado.

    Args:
        modo: "paciente" (default, resumen simple con alternativas) |
            "farmaceutico" (datos técnicos de dispensación, sin PII).

    Raises:
        GeminiParsingError: API falla de forma no reintentable o JSON inválido.
        GeminiQuotaError: ambos intentos agotaron cuota (429).
        GeminiTimeoutError: ambos intentos excedieron su deadline.
        RuntimeError: GEMINI_API_KEY no configurada.
    """
    if modo == "farmaceutico":
        prompt = ia_prompts.PROMPT_RECIPE_FARMACIA
        schema = ia_prompts.RECIPE_FARMACIA_RESPONSE_SCHEMA
        validador = ia_prompts.validar_items_medicamento_farmacia
    else:
        prompt = _PROMPT_RECIPE
        schema = _RECIPE_RESPONSE_SCHEMA
        validador = validar_items_medicamento

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
        for incluir_thinking in (True, False):
            try:
                response = client.models.generate_content(
                    model=modelo,
                    contents=[prompt, parte_imagen],
                    config=_config_generacion(
                        timeout_s,
                        response_schema=schema,
                        incluir_thinking_config=incluir_thinking,
                    ),
                )
                break
            except Exception as e:
                clase = _clasificar_error(e)
                if clase is None:
                    if incluir_thinking:
                        logger.warning(
                            "Intento %d/%d con thinking_config falló no-reintentable "
                            "en %s (%s); reintentando sin thinking_config.",
                            numero, len(intentos), modelo, e,
                        )
                        continue
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
                break
        if response is not None:
            break

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
    resultado = validador(medicamentos)

    logger.info(
        "Gemini Vision extrajo %d medicamentos válidos de %d items totales "
        "(récipe, modo=%s).",
        len(resultado),
        len(medicamentos),
        modo,
    )
    return resultado
```

Reemplaza la firma y el cuerpo de `analizar_recipe` (async wrapper):

```python
async def analizar_recipe(
    imagen_bytes: bytes, mime_type: str, modo: str = "paciente"
) -> list[dict[str, Any]]:
    """Función asíncrona: analiza la imagen de un récipe con Gemini Vision.

    Delega el trabajo síncrono (llamada HTTP a Gemini) a un thread pool
    con asyncio.to_thread para mantener la app FastAPI completamente reactiva.

    Args:
        imagen_bytes: Bytes crudos de la imagen del récipe.
        mime_type: MIME type de la imagen (ej: "image/jpeg").
        modo: "paciente" (default) | "farmaceutico".

    Returns:
        Lista de medicamentos extraídos (forma según `modo`).
        Lista vacía si la imagen no es un récipe legible.

    Raises:
        GeminiParsingError: Si la imagen es inválida o Gemini falla.
        GeminiTimeoutError: Si Gemini excede el timeout configurado.
        RuntimeError: Si GEMINI_API_KEY no está configurada.
    """
    try:
        return await asyncio.wait_for(
            asyncio.to_thread(_analizar_recipe_sync, imagen_bytes, mime_type, modo),
            timeout=_RECIPE_TIMEOUT_GLOBAL_S,
        )
    except TimeoutError as e:
        logger.warning(
            "analizar_recipe abortado por techo global (%.0fs).",
            _RECIPE_TIMEOUT_GLOBAL_S,
        )
        raise GeminiTimeoutError(
            "El procesamiento con IA tardó demasiado. Intenta de nuevo en un momento."
        ) from e
```

- [ ] **Step 4: Confirmar que los tests pasan**

Run: `cd /home/josemarrufo/Escritorio/DosisYa-Backend && python -m pytest tests/test_gemini_service.py -v`
Expected: PASS (todos, incluidos los preexistentes — el default `modo="paciente"` preserva el comportamiento actual).

- [ ] **Step 5: Commit**

```bash
cd /home/josemarrufo/Escritorio/DosisYa-Backend
git add src/dosisya/services/gemini_service.py tests/test_gemini_service.py
git commit -m "feat(ia): gemini_service enhebra modo paciente/farmaceutico en analizar_recipe"
```

---

### Task 3: Enhebrar `modo` en `nvidia_service.py`

**Files:**
- Modify: `src/dosisya/services/nvidia_service.py`
- Test: `tests/test_nvidia_service.py`

**Interfaces:**
- Consumes: `ia_prompts.PROMPT_RECIPE_FARMACIA`, `ia_prompts.validar_items_medicamento_farmacia` (Task 1).
- Produces: `nvidia_service._analizar_recipe_sync(imagen_bytes: bytes, mime_type: str, modo: str = "paciente") -> list[dict[str, Any]]`, `nvidia_service.analizar_recipe(imagen_bytes: bytes, mime_type: str, modo: str = "paciente") -> list[dict[str, Any]]`.

- [ ] **Step 1: Escribir los tests que fallan**

Añade al final de `tests/test_nvidia_service.py` (dentro o después de `class TestAnalizarRecipe`, como clases nuevas):

```python
_JSON_FARMACIA_UN_MEDICAMENTO = (
    '[{"nombre_comercial": "Atamel", "principio_activo": "Paracetamol",'
    ' "concentracion_mg": "500mg", "forma_farmaceutica": "comprimido",'
    ' "cantidad_total_unidades": "20 tabletas", "posologia_detallada": "cada 8 horas",'
    ' "via_administracion": "oral"}]'
)


class TestAnalizarRecipeModoFarmaceutico:
    def test_modo_farmaceutico_usa_prompt_tecnico(self, fake_client):
        fake_client([FakeCompletionResponse(_JSON_FARMACIA_UN_MEDICAMENTO)])
        resultado = ns._analizar_recipe_sync(b"png", "image/png", modo="farmaceutico")
        assert resultado == [
            {
                "nombre_comercial": "Atamel",
                "principio_activo": "Paracetamol",
                "concentracion_mg": "500mg",
                "forma_farmaceutica": "comprimido",
                "cantidad_total_unidades": "20 tabletas",
                "posologia_detallada": "cada 8 horas",
                "via_administracion": "oral",
            }
        ]

    def test_modo_paciente_por_default_no_cambia(self, fake_client):
        fake_client([FakeCompletionResponse(_JSON_UN_MEDICAMENTO)])
        resultado = ns._analizar_recipe_sync(b"png", "image/png")
        assert resultado == [
            {
                "medicamento": "Losartán",
                "cantidad": "2 cajas",
                "alternativas": ["Losartán genérico 50mg"],
            }
        ]
```

- [ ] **Step 2: Confirmar que los tests fallan**

Run: `cd /home/josemarrufo/Escritorio/DosisYa-Backend && python -m pytest tests/test_nvidia_service.py -k "ModoFarmaceutico" -v`
Expected: FAIL — `TypeError: _analizar_recipe_sync() got an unexpected keyword argument 'modo'`.

- [ ] **Step 3: Implementar en `nvidia_service.py`**

Reemplaza el bloque de import de `ia_prompts` (arriba del todo):

```python
from dosisya.services.ia_prompts import (
    PROMPT_RECIPE,
    PROMPT_RECIPE_FARMACIA,
    PROMPT_SISTEMA,
    validar_items_inventario,
    validar_items_medicamento,
    validar_items_medicamento_farmacia,
)
```

Reemplaza la firma y el cuerpo de `_analizar_recipe_sync`:

```python
def _analizar_recipe_sync(
    imagen_bytes: bytes, mime_type: str, modo: str = "paciente"
) -> list[dict[str, Any]]:
    """Versión síncrona del escáner de récipe contra NVIDIA — un solo intento.

    Args:
        modo: "paciente" (default) | "farmaceutico".

    Raises:
        NvidiaParsingError: API falla de forma no reintentable o JSON inválido.
        NvidiaQuotaError: cuota agotada (429).
        NvidiaTimeoutError: el RPC excedió su deadline.
        RuntimeError: NVIDIA_API_KEY no configurada.
    """
    if modo == "farmaceutico":
        prompt = PROMPT_RECIPE_FARMACIA
        validador = validar_items_medicamento_farmacia
    else:
        prompt = PROMPT_RECIPE
        validador = validar_items_medicamento

    client = _get_client()
    b64 = base64.b64encode(imagen_bytes).decode("ascii")

    try:
        response = client.chat.completions.create(
            model=_MODEL_RECIPE,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:{mime_type};base64,{b64}"},
                        },
                    ],
                }
            ],
            temperature=0.1,
            max_tokens=8192,
            timeout=_RECIPE_TIMEOUT_S,
        )
    except Exception as e:
        clase = _clasificar_error(e)
        if clase == "quota":
            raise NvidiaQuotaError(
                "Hay mucha demanda en este momento. Intenta de nuevo en un minuto."
            ) from e
        if clase == "timeout":
            raise NvidiaTimeoutError(
                "El servicio de IA tardó demasiado en responder. "
                "Intenta de nuevo en un momento."
            ) from e
        logger.error("Error no reintentable de NVIDIA (%s): %s", _MODEL_RECIPE, e)
        raise NvidiaParsingError(f"Error al consultar NVIDIA API: {e}") from e

    medicamentos = _extraer_lista_json(
        response, contexto="récipe", sugerencia="Intenta con una foto más clara."
    )
    resultado = validador(medicamentos)
    logger.info(
        "NVIDIA extrajo %d medicamentos válidos de %d items totales (récipe, modo=%s).",
        len(resultado), len(medicamentos), modo,
    )
    return resultado
```

Reemplaza la firma y el cuerpo de `analizar_recipe` (async wrapper):

```python
async def analizar_recipe(
    imagen_bytes: bytes, mime_type: str, modo: str = "paciente"
) -> list[dict[str, Any]]:
    """Función asíncrona: analiza la imagen de un récipe con NVIDIA Nemotron.

    Delega el trabajo síncrono a un thread pool con asyncio.to_thread.

    Raises:
        NvidiaParsingError, NvidiaQuotaError, NvidiaTimeoutError, RuntimeError.
    """
    try:
        return await asyncio.wait_for(
            asyncio.to_thread(_analizar_recipe_sync, imagen_bytes, mime_type, modo),
            timeout=_RECIPE_TIMEOUT_GLOBAL_S,
        )
    except TimeoutError as e:
        logger.warning(
            "analizar_recipe (NVIDIA) abortado por techo global (%.0fs).",
            _RECIPE_TIMEOUT_GLOBAL_S,
        )
        raise NvidiaTimeoutError(
            "El procesamiento con IA tardó demasiado. Intenta de nuevo en un momento."
        ) from e
```

- [ ] **Step 4: Confirmar que los tests pasan**

Run: `cd /home/josemarrufo/Escritorio/DosisYa-Backend && python -m pytest tests/test_nvidia_service.py -v`
Expected: PASS (todos, incluidos los preexistentes).

- [ ] **Step 5: Commit**

```bash
cd /home/josemarrufo/Escritorio/DosisYa-Backend
git add src/dosisya/services/nvidia_service.py tests/test_nvidia_service.py
git commit -m "feat(ia): nvidia_service enhebra modo paciente/farmaceutico en analizar_recipe"
```

---

### Task 4: Enhebrar `modo` en `ia_orchestrator.py`

**Files:**
- Modify: `src/dosisya/services/ia_orchestrator.py`
- Test: `tests/test_ia_orchestrator.py`

**Interfaces:**
- Consumes: `gemini_service.analizar_recipe(imagen_bytes, mime_type, modo)` (Task 2), `nvidia_service.analizar_recipe(imagen_bytes, mime_type, modo)` (Task 3).
- Produces: `ia_orchestrator.analizar_recipe(imagen_bytes: bytes, mime_type: str, modo: str = "paciente") -> list[dict[str, Any]]`.

- [ ] **Step 1: Escribir el test que falla**

Añade al final de `tests/test_ia_orchestrator.py`:

```python
class TestAnalizarRecipeModo:
    @pytest.mark.asyncio
    async def test_modo_se_reenvia_a_gemini_y_a_nvidia_si_falla(
        self, monkeypatch: pytest.MonkeyPatch
    ):
        capturado = {"gemini": None, "nvidia": None}

        async def fake_gemini(imagen_bytes, mime_type, modo="paciente"):
            capturado["gemini"] = modo
            raise gemini_service.GeminiParsingError("gemini caído")

        async def fake_nvidia(imagen_bytes, mime_type, modo="paciente"):
            capturado["nvidia"] = modo
            return []

        monkeypatch.setattr(gemini_service, "analizar_recipe", fake_gemini)
        monkeypatch.setattr(nvidia_service, "analizar_recipe", fake_nvidia)

        await ia_orchestrator.analizar_recipe(b"png", "image/png", modo="farmaceutico")
        assert capturado["gemini"] == "farmaceutico"
        assert capturado["nvidia"] == "farmaceutico"

    @pytest.mark.asyncio
    async def test_modo_default_es_paciente(self, monkeypatch: pytest.MonkeyPatch):
        capturado = {}

        async def fake_gemini(imagen_bytes, mime_type, modo="paciente"):
            capturado["modo"] = modo
            return _MEDICAMENTOS_GEMINI

        monkeypatch.setattr(gemini_service, "analizar_recipe", fake_gemini)

        await ia_orchestrator.analizar_recipe(b"png", "image/png")
        assert capturado["modo"] == "paciente"
```

- [ ] **Step 2: Confirmar que el test falla**

Run: `cd /home/josemarrufo/Escritorio/DosisYa-Backend && python -m pytest tests/test_ia_orchestrator.py -k "Modo" -v`
Expected: FAIL — `TypeError: analizar_recipe() got an unexpected keyword argument 'modo'`.

- [ ] **Step 3: Implementar en `ia_orchestrator.py`**

Reemplaza la función `analizar_recipe`:

```python
async def analizar_recipe(
    imagen_bytes: bytes, mime_type: str, modo: str = "paciente"
) -> list[dict[str, Any]]:
    """Analiza un récipe: Gemini primero, NVIDIA como respaldo si Gemini falla.

    Args:
        modo: "paciente" (default, resumen simple) | "farmaceutico" (datos
            técnicos de dispensación, sin PII) — se reenvía a ambos
            proveedores sin cambiar la lógica de fallback.

    Raises:
        IAParsingError, IAQuotaError, IATimeoutError: si AMBOS proveedores
            fallaron (el mensaje refleja el error de NVIDIA, el último
            intento).
    """
    try:
        return await gemini_service.analizar_recipe(imagen_bytes, mime_type, modo)
    except Exception as e_gemini:
        logger.warning(
            "Gemini falló analizando récipe (%s); probando NVIDIA como respaldo.",
            e_gemini,
        )
        try:
            return await nvidia_service.analizar_recipe(imagen_bytes, mime_type, modo)
        except Exception as e_nvidia:
            logger.error(
                "NVIDIA también falló analizando récipe (%s); ambos proveedores caídos.",
                e_nvidia,
            )
            _relanzar_unificado(e_nvidia)
            raise  # pragma: no cover — _relanzar_unificado siempre lanza
```

- [ ] **Step 4: Confirmar que los tests pasan**

Run: `cd /home/josemarrufo/Escritorio/DosisYa-Backend && python -m pytest tests/test_ia_orchestrator.py -v`
Expected: PASS (todos, incluidos los preexistentes).

- [ ] **Step 5: Commit**

```bash
cd /home/josemarrufo/Escritorio/DosisYa-Backend
git add src/dosisya/services/ia_orchestrator.py tests/test_ia_orchestrator.py
git commit -m "feat(ia): ia_orchestrator enhebra modo paciente/farmaceutico"
```

---

### Task 5: Endpoint autenticado + gating Premium en `farmacias.py`

**Files:**
- Modify: `src/dosisya/routers/farmacias.py`
- Test: `tests/test_farmacias_ia_router.py` (nuevo)

**Interfaces:**
- Consumes: `ia_orchestrator.analizar_recipe(imagen_bytes, mime_type, modo)` (Task 4), `security.verify_token`, `db.get_connection`, `limiter` (`dosisya.limiter`).
- Produces: endpoint `POST /api/v1/farmacias/{farmacia_id}/ia/analizar-recipe`.

- [ ] **Step 1: Escribir los tests que fallan**

Crea `tests/test_farmacias_ia_router.py`:

```python
"""
DosisYa — Tests del router: POST /api/v1/farmacias/{id}/ia/analizar-recipe
(modo farmacéutico del escáner de récipe).

Cubre: auth (401/403), autorización por recurso, gating por plan Premium,
validación de imagen, mapeo de errores de IA, y éxito con el schema técnico.
IA y BD se mockean vía monkeypatch — nunca se llama a un proveedor real ni
a una base de datos real.
"""

from __future__ import annotations

import io

import pytest
from fastapi.testclient import TestClient

from dosisya.limiter import limiter
from dosisya.main import app
from dosisya.security import verify_token
from dosisya.services.ia_orchestrator import IAParsingError, IAQuotaError, IATimeoutError

client = TestClient(app)

FARMACIA_ID = "11111111-1111-1111-1111-111111111111"
OTRA_FARMACIA_ID = "22222222-2222-2222-2222-222222222222"
ENDPOINT = f"/api/v1/farmacias/{FARMACIA_ID}/ia/analizar-recipe"

_PNG_BYTES = b"\x89PNG\r\n\x1a\n" + b"0" * 100


def _files(content: bytes = _PNG_BYTES, mime: str = "image/png", name: str = "recipe.png"):
    return {"file": (name, io.BytesIO(content), mime)}


class _FakeConn:
    def __init__(self, nivel_suscripcion: str | None):
        self._nivel = nivel_suscripcion

    async def fetchrow(self, query, *args):
        if self._nivel is None:
            return None
        return {"nivel_suscripcion": self._nivel}


class _Ctx:
    def __init__(self, conn):
        self._conn = conn

    async def __aenter__(self):
        return self._conn

    async def __aexit__(self, *exc):
        return False


@pytest.fixture(autouse=True)
def _reset_rate_limit():
    limiter.reset()
    yield


@pytest.fixture(autouse=True)
def _limpiar_auth():
    yield
    app.dependency_overrides.pop(verify_token, None)


def _auth(rol: str = "admin_farmacia", sub: str = FARMACIA_ID):
    app.dependency_overrides[verify_token] = lambda: {"sub": sub, "rol": rol}


def _mock_conn(monkeypatch: pytest.MonkeyPatch, nivel_suscripcion: str | None):
    monkeypatch.setattr(
        "dosisya.routers.farmacias.get_connection",
        lambda: _Ctx(_FakeConn(nivel_suscripcion)),
    )


class TestAutenticacion:
    def test_sin_token_devuelve_401(self):
        resp = client.post(ENDPOINT, files=_files())
        assert resp.status_code == 401

    def test_farmacia_distinta_devuelve_403(self):
        _auth(rol="admin_farmacia", sub=OTRA_FARMACIA_ID)
        resp = client.post(ENDPOINT, files=_files())
        assert resp.status_code == 403


class TestGatingPremium:
    def test_farmacia_gratuita_devuelve_403(self, monkeypatch: pytest.MonkeyPatch):
        _auth()
        _mock_conn(monkeypatch, "gratuita")
        resp = client.post(ENDPOINT, files=_files())
        assert resp.status_code == 403
        assert "Premium" in resp.text

    def test_farmacia_premium_pasa_el_gating(self, monkeypatch: pytest.MonkeyPatch):
        _auth()
        _mock_conn(monkeypatch, "premium")

        async def fake_analizar(imagen_bytes, mime_type, modo):
            return []

        monkeypatch.setattr("dosisya.routers.farmacias.analizar_recipe_ia", fake_analizar)
        resp = client.post(ENDPOINT, files=_files())
        assert resp.status_code == 200  # ilegible (lista vacía), no 403

    def test_superadmin_no_requiere_premium(self, monkeypatch: pytest.MonkeyPatch):
        _auth(rol="superadmin", sub="99999999-9999-9999-9999-999999999999")
        _mock_conn(monkeypatch, "gratuita")

        async def fake_analizar(imagen_bytes, mime_type, modo):
            return []

        monkeypatch.setattr("dosisya.routers.farmacias.analizar_recipe_ia", fake_analizar)
        resp = client.post(ENDPOINT, files=_files())
        assert resp.status_code == 200

    def test_farmacia_inexistente_devuelve_404(self, monkeypatch: pytest.MonkeyPatch):
        _auth()
        _mock_conn(monkeypatch, None)
        resp = client.post(ENDPOINT, files=_files())
        assert resp.status_code == 404


class TestValidacionImagen:
    def test_mime_invalido_rechazado_400(self, monkeypatch: pytest.MonkeyPatch):
        _auth()
        _mock_conn(monkeypatch, "premium")
        resp = client.post(ENDPOINT, files=_files(b"hola", "text/plain", "archivo.txt"))
        assert resp.status_code == 400

    def test_imagen_mayor_a_10mb_rechazada_400(self, monkeypatch: pytest.MonkeyPatch):
        _auth()
        _mock_conn(monkeypatch, "premium")
        contenido_grande = b"0" * (10 * 1024 * 1024 + 1)
        resp = client.post(ENDPOINT, files=_files(contenido_grande, "image/jpeg", "grande.jpg"))
        assert resp.status_code == 400


class TestAnalisisExitoso:
    def test_exito_devuelve_campos_tecnicos(self, monkeypatch: pytest.MonkeyPatch):
        _auth()
        _mock_conn(monkeypatch, "premium")

        async def fake_analizar(imagen_bytes, mime_type, modo):
            assert modo == "farmaceutico"
            return [
                {
                    "nombre_comercial": "Atamel",
                    "principio_activo": "Paracetamol",
                    "concentracion_mg": "500mg",
                    "forma_farmaceutica": "comprimido",
                    "cantidad_total_unidades": "20 tabletas",
                    "posologia_detallada": "cada 8 horas",
                    "via_administracion": "oral",
                }
            ]

        monkeypatch.setattr("dosisya.routers.farmacias.analizar_recipe_ia", fake_analizar)
        resp = client.post(ENDPOINT, files=_files())
        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "success"
        assert body["data"][0]["principio_activo"] == "Paracetamol"
        assert body["data"][0]["via_administracion"] == "oral"


class TestMapeoErroresIA:
    def test_timeout_devuelve_504(self, monkeypatch: pytest.MonkeyPatch):
        _auth()
        _mock_conn(monkeypatch, "premium")

        async def fake_analizar(imagen_bytes, mime_type, modo):
            raise IATimeoutError("timeout")

        monkeypatch.setattr("dosisya.routers.farmacias.analizar_recipe_ia", fake_analizar)
        resp = client.post(ENDPOINT, files=_files())
        assert resp.status_code == 504

    def test_cuota_agotada_devuelve_503(self, monkeypatch: pytest.MonkeyPatch):
        _auth()
        _mock_conn(monkeypatch, "premium")

        async def fake_analizar(imagen_bytes, mime_type, modo):
            raise IAQuotaError("sin cuota")

        monkeypatch.setattr("dosisya.routers.farmacias.analizar_recipe_ia", fake_analizar)
        resp = client.post(ENDPOINT, files=_files())
        assert resp.status_code == 503

    def test_parsing_error_devuelve_error_200(self, monkeypatch: pytest.MonkeyPatch):
        _auth()
        _mock_conn(monkeypatch, "premium")

        async def fake_analizar(imagen_bytes, mime_type, modo):
            raise IAParsingError("récipe ilegible")

        monkeypatch.setattr("dosisya.routers.farmacias.analizar_recipe_ia", fake_analizar)
        resp = client.post(ENDPOINT, files=_files())
        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "error"
        assert body["data"] is None

    def test_api_key_ausente_devuelve_500(self, monkeypatch: pytest.MonkeyPatch):
        _auth()
        _mock_conn(monkeypatch, "premium")

        async def fake_analizar(imagen_bytes, mime_type, modo):
            raise RuntimeError("ninguna API key configurada")

        monkeypatch.setattr("dosisya.routers.farmacias.analizar_recipe_ia", fake_analizar)
        resp = client.post(ENDPOINT, files=_files())
        assert resp.status_code == 500
```

- [ ] **Step 2: Confirmar que los tests fallan**

Run: `cd /home/josemarrufo/Escritorio/DosisYa-Backend && python -m pytest tests/test_farmacias_ia_router.py -v`
Expected: FAIL — `404 Not Found` en todos (la ruta no existe todavía) o `AttributeError` al monkeypatchear `analizar_recipe_ia` (no existe aún ese nombre en el módulo).

- [ ] **Step 3: Implementar en `farmacias.py`**

Reemplaza el bloque de imports (líneas 31-56 aprox.) para agregar `Request`, `limiter`, y los símbolos de `ia_orchestrator` que faltan:

```python
from __future__ import annotations

import io
import logging
from datetime import date
from decimal import Decimal
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status

from dosisya.db import get_connection
from dosisya.limiter import limiter
from dosisya.models import FarmaciaConfigUpdate, RespuestaEstructurada
from dosisya.repository import (
    RepositoryError,
    RepositoryNotFoundError,
    listar_facturas,
    upsert_inventario_lote,
)
from dosisya.security import verify_token
from dosisya.services.gemini_service import LIMITE_CHARS_IA
from dosisya.services.ia_orchestrator import (
    IAParsingError,
    IAQuotaError,
    IATimeoutError,
    analizar_recipe as analizar_recipe_ia,
    parsear_inventario,
)
```

Añade la línea del nuevo endpoint al listado de endpoints en el docstring del módulo. Reemplaza:

```python
Endpoints:
  GET   /api/v1/farmacias/{farmacia_id}/dashboard         — Métricas del Dashboard B2B
  GET   /api/v1/farmacias/{farmacia_id}/facturas          — Historial de facturas CPC
  GET   /api/v1/farmacias/{farmacia_id}/leads             — Detalle de leads por periodo (auditoría)
  PATCH /api/v1/farmacias/{farmacia_id}                   — Editar datos (panel B2B)
  POST  /api/v1/farmacias/{farmacia_id}/inventario/upload — Subir inventario (IA)
  GET   /api/v1/sectores                                  — Catálogo de sectores
```

por:

```python
Endpoints:
  GET   /api/v1/farmacias/{farmacia_id}/dashboard         — Métricas del Dashboard B2B
  GET   /api/v1/farmacias/{farmacia_id}/facturas          — Historial de facturas CPC
  GET   /api/v1/farmacias/{farmacia_id}/leads             — Detalle de leads por periodo (auditoría)
  PATCH /api/v1/farmacias/{farmacia_id}                   — Editar datos (panel B2B)
  POST  /api/v1/farmacias/{farmacia_id}/inventario/upload — Subir inventario (IA)
  POST  /api/v1/farmacias/{farmacia_id}/ia/analizar-recipe — Escáner récipe modo farmacéutico (Premium)
  GET   /api/v1/sectores                                  — Catálogo de sectores
```

Añade al final del archivo (después del endpoint `upload_inventario`):

```python
# ==============================================================================
# Endpoint: POST /api/v1/farmacias/{farmacia_id}/ia/analizar-recipe
# ==============================================================================
# Modo farmacéutico del escáner de récipe (spec en DosisYa-Frontend:
# docs/superpowers/specs/2026-08-05-modo-farmaceutico-escaner-recipe-design.md).
# Mismo orquestador Gemini→NVIDIA que el endpoint público de paciente
# (/api/v1/ia/analizar-recipe), pero:
#   - autenticado (solo la propia farmacia o superadmin)
#   - gateado a nivel_suscripcion=premium
#   - devuelve campos técnicos de dispensación en vez del resumen simple
#   - NUNCA extrae PII de paciente/médico (ver PROMPT_RECIPE_FARMACIA)

_TIPOS_MIME_ACEPTADOS_RECIPE = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/heic",
    "image/heif",
}
_MAX_BYTES_RECIPE = 10 * 1024 * 1024  # 10 MB — igual que el endpoint público de récipe

_MENSAJE_ILEGIBLE_FARMACIA = (
    "No pudimos leer los medicamentos del récipe. Intenta con una foto más clara."
)

# Solo el nivel de suscripción — consulta liviana, sin traer inventario.
# $1 → farmacia_id UUID
_SELECT_NIVEL_SUSCRIPCION = """
    SELECT nivel_suscripcion::TEXT AS nivel_suscripcion
    FROM farmacias
    WHERE id = $1;
"""


@router.post(
    "/api/v1/farmacias/{farmacia_id}/ia/analizar-recipe",
    response_model=RespuestaEstructurada,
    summary="Escáner de récipe — modo farmacéutico (Premium, protegido con JWT)",
    description=(
        "Analiza una foto de récipe médico y devuelve datos técnicos de "
        "dispensación (principio activo, concentración, forma farmacéutica, "
        "posología, vía de administración) — NUNCA datos del paciente o "
        "del médico.\n\n"
        "**Requiere plan Premium** (`nivel_suscripcion=premium`) y "
        "**autenticación**: Header `Authorization: Bearer <auth_token>`.\n\n"
        "Formatos aceptados: JPEG, PNG, WebP, HEIC, HEIF (máx. 10 MB). "
        "Rate limit: 15 solicitudes por minuto por IP."
    ),
    responses={
        200: {"description": "Récipe analizado (éxito o ilegible, ver 'status' del envelope)"},
        400: {"description": "Imagen inválida: MIME no soportado, supera 10 MB, o farmacia_id no es UUID"},
        401: {"description": "Token JWT ausente, inválido o expirado"},
        403: {"description": "No autoriza esta farmacia, o no tiene plan Premium"},
        404: {"description": "Farmacia no encontrada"},
        500: {"description": "Error interno o ningún proveedor de IA configurado"},
        503: {"description": "Cuota de IA agotada temporalmente (Gemini y NVIDIA) — reintentar"},
        504: {"description": "Ningún proveedor de IA respondió dentro del timeout"},
    },
)
@limiter.limit("15/minute")
async def analizar_recipe_farmacia_endpoint(
    request: Request,
    farmacia_id: str,
    file: UploadFile = File(..., description="Foto del récipe médico"),  # noqa: B008
    token_data: dict = Depends(verify_token),  # noqa: B008
) -> RespuestaEstructurada:
    """Valida auth + plan Premium, envía la imagen al orquestador de IA en
    modo farmacéutico, y devuelve los medicamentos con campos técnicos.
    """
    # ─── 1. Validar UUID ────────────────────────────────────────────────────
    try:
        farmacia_uuid = UUID(farmacia_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"'{farmacia_id}' no es un UUID válido.",
        ) from e

    # ─── 2. Autorización por recurso ────────────────────────────────────────
    rol = token_data.get("rol", "")
    token_farmacia_id = token_data.get("sub", "")
    if rol != "superadmin" and token_farmacia_id != farmacia_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permiso para usar el escáner de esta farmacia.",
        )

    # ─── 3. Gating por plan Premium ──────────────────────────────────────────
    try:
        async with get_connection() as conn:
            row = await conn.fetchrow(_SELECT_NIVEL_SUSCRIPCION, farmacia_uuid)
    except asyncpg.PostgresError as e:
        logger.error(
            "Error de BD al verificar plan [farmacia_id=%s]: %s", farmacia_id, e
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error interno al verificar tu plan.",
        ) from e

    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No existe una farmacia con id '{farmacia_id}'.",
        )

    if rol != "superadmin" and row["nivel_suscripcion"] != "premium":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Esta función requiere el plan Premium.",
        )

    # ─── 4. Validar MIME ─────────────────────────────────────────────────────
    mime_type = file.content_type or ""
    if mime_type not in _TIPOS_MIME_ACEPTADOS_RECIPE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Formato de imagen '{mime_type or 'desconocido'}' no soportado. "
                f"Sube una imagen JPEG, PNG, WebP o HEIC."
            ),
        )

    # ─── 5. Leer y validar tamaño ────────────────────────────────────────────
    try:
        imagen_bytes = await file.read()
    except Exception as e:
        logger.error(
            "Error al leer UploadFile de récipe [farmacia=%s]: %s", farmacia_id, e
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se pudo leer la imagen. Verifica que no esté corrupta.",
        ) from e

    if not imagen_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se recibió ninguna imagen.",
        )

    if len(imagen_bytes) > _MAX_BYTES_RECIPE:
        mb = len(imagen_bytes) / 1024 / 1024
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"La imagen supera el límite de 10 MB ({mb:.1f} MB).",
        )

    # ─── 6. Analizar con la IA en modo farmacéutico ─────────────────────────
    try:
        medicamentos = await analizar_recipe_ia(imagen_bytes, mime_type, modo="farmaceutico")
    except IATimeoutError as e:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail=str(e),
        ) from e
    except IAQuotaError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(e),
        ) from e
    except IAParsingError:
        return RespuestaEstructurada(
            status="error",
            message=_MENSAJE_ILEGIBLE_FARMACIA,
            data=None,
        )
    except RuntimeError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        ) from e

    if not medicamentos:
        return RespuestaEstructurada(
            status="error",
            message=_MENSAJE_ILEGIBLE_FARMACIA,
            data=None,
        )

    logger.info(
        "IA extrajo %d medicamentos del récipe [modo=farmaceutico farmacia=%s].",
        len(medicamentos), farmacia_id,
    )

    return RespuestaEstructurada(
        status="success",
        message="Récipe analizado exitosamente.",
        data=medicamentos,
    )
```

- [ ] **Step 4: Confirmar que los tests pasan**

Run: `cd /home/josemarrufo/Escritorio/DosisYa-Backend && python -m pytest tests/test_farmacias_ia_router.py -v`
Expected: PASS (los 12 tests).

- [ ] **Step 5: Correr la suite completa y lint**

Run: `cd /home/josemarrufo/Escritorio/DosisYa-Backend && python -m pytest -q`
Expected: `241 passed` (212 antes de este plan + 9 de Task 1 + 3 de Task 2 + 2 de Task 3 + 2 de Task 4 + 13 de este task = 241; si el conteo difiere, revisa que no se haya roto nada existente antes de continuar).

Run: `cd /home/josemarrufo/Escritorio/DosisYa-Backend && ruff check src/dosisya/routers/farmacias.py src/dosisya/services/ia_prompts.py src/dosisya/services/gemini_service.py src/dosisya/services/nvidia_service.py src/dosisya/services/ia_orchestrator.py tests/test_farmacias_ia_router.py tests/test_ia_prompts.py tests/test_gemini_service.py tests/test_nvidia_service.py tests/test_ia_orchestrator.py`
Expected: sin errores nuevos (los 7 preexistentes de `gemini_service.py` documentados como deuda previa al 2026-08-05 pueden seguir apareciendo — no son de este plan).

- [ ] **Step 6: Commit**

```bash
cd /home/josemarrufo/Escritorio/DosisYa-Backend
git add src/dosisya/routers/farmacias.py tests/test_farmacias_ia_router.py
git commit -m "feat(farmacias): endpoint del escáner de récipe modo farmacéutico (Premium)"
```

---

## Frontend (`/home/josemarrufo/Escritorio/DosisYa-Frontend`)

### Task 6: Cliente API — `recipeIAFarmacia.ts`

**Files:**
- Create: `src/lib/recipeIAFarmacia.ts`

**Interfaces:**
- Consumes: `API_BASE` (`src/lib/api.ts`), `comprimirImagen` (`src/lib/comprimirImagen.ts`), `validarImagen` (`src/lib/recipeIA.ts`).
- Produces: `analizarRecipeFarmacia(imagen: File): Promise<RespuestaRecipeFarmacia>`, tipos `MedicamentoRecetaFarmacia`, `MedicamentoRecetaFarmaciaUI`, `RespuestaRecipeFarmacia`.

- [ ] **Step 1: Crear el archivo**

Crea `src/lib/recipeIAFarmacia.ts`:

```ts
// ─────────────────────────────────────────────────────────────────────────────
// Escáner de Récipe con IA — modo farmacéutico (panel B2B, protegido con JWT)
//
// Igual que recipeIA.ts: el frontend solo transporta la imagen, SOLO el
// backend habla con el proveedor de IA (regla #5 de CLAUDE.md). Este modo
// devuelve campos técnicos de dispensación en vez del resumen simple del
// escáner público — nunca datos de paciente/médico.
//
// Contrato verificado contra DosisYa-Backend/src/dosisya/routers/farmacias.py:
//   POST /api/v1/farmacias/{farmacia_id}/ia/analizar-recipe — requiere
//   Authorization: Bearer <token> y plan Premium. Mismos límites de imagen
//   (MIME, 10 MB) que el escáner público. Envelope:
//   {status, message, data:[{nombre_comercial, principio_activo,
//   concentracion_mg, forma_farmaceutica, cantidad_total_unidades,
//   posologia_detallada, via_administracion}]}
//
// Spec: docs/superpowers/specs/2026-08-05-modo-farmaceutico-escaner-recipe-design.md
// ─────────────────────────────────────────────────────────────────────────────

import { API_BASE } from "./api";
import { comprimirImagen } from "./comprimirImagen";
import { validarImagen } from "./recipeIA";

export { validarImagen };

/** Un medicamento extraído por la IA en modo farmacéutico. */
export interface MedicamentoRecetaFarmacia {
  nombre_comercial: string;
  principio_activo: string;
  concentracion_mg: string;
  forma_farmaceutica: string;
  cantidad_total_unidades: string;
  posologia_detallada: string;
  via_administracion: string;
}

/**
 * Igual que MedicamentoRecetaFarmacia, con un id estable de sesión de
 * escaneo (no persiste, no viene del backend) — usado como `key` de React.
 */
export interface MedicamentoRecetaFarmaciaUI extends MedicamentoRecetaFarmacia {
  id: string;
}

/** Respuesta envuelta del endpoint POST .../ia/analizar-recipe (farmacia). */
export interface RespuestaRecipeFarmacia {
  status: "success" | "error";
  message: string;
  data: MedicamentoRecetaFarmacia[] | null;
}

const RECIPE_TIMEOUT_MS = 45_000;

/** Lee credenciales de sesión guardadas por el login del panel B2B. */
function credencialesSesion(): { farmaciaId: string; token: string } | null {
  if (typeof window === "undefined") return null;
  const farmaciaId = localStorage.getItem("farmacia_id");
  const token = localStorage.getItem("auth_token");
  if (!farmaciaId || !token) return null;
  return { farmaciaId, token };
}

/**
 * Envía la imagen del récipe al backend para análisis en modo farmacéutico.
 * Requiere sesión de farmacia activa (login del panel B2B) y plan Premium.
 */
export async function analizarRecipeFarmacia(
  imagen: File,
): Promise<RespuestaRecipeFarmacia> {
  const cred = credencialesSesion();
  if (!cred) {
    return {
      status: "error",
      message: "Sesión no encontrada. Inicia sesión de nuevo.",
      data: null,
    };
  }

  const imagenAEnviar = await comprimirImagen(imagen);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), RECIPE_TIMEOUT_MS);

  try {
    const formData = new FormData();
    formData.append("file", imagenAEnviar);

    const res = await fetch(
      `${API_BASE}/api/v1/farmacias/${cred.farmaciaId}/ia/analizar-recipe`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${cred.token}` },
        body: formData,
        signal: controller.signal,
      },
    );

    if (res.status === 403) {
      return {
        status: "error",
        message: "Esta función requiere el plan Premium.",
        data: null,
      };
    }

    if (res.status === 401) {
      return {
        status: "error",
        message: "Tu sesión expiró. Inicia sesión de nuevo.",
        data: null,
      };
    }

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      return {
        status: "error",
        message: txt || `Error del servidor (${res.status})`,
        data: null,
      };
    }

    const json = (await res.json()) as RespuestaRecipeFarmacia;
    return json;
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      return {
        status: "error",
        message:
          "El análisis tardó demasiado. Intenta con una foto más clara o con mejor iluminación.",
        data: null,
      };
    }
    return {
      status: "error",
      message: "Error de conexión. Revisa tu internet e intenta de nuevo.",
      data: null,
    };
  } finally {
    clearTimeout(timeout);
  }
}
```

- [ ] **Step 2: Verificar tipos**

Run: `cd /home/josemarrufo/Escritorio/DosisYa-Frontend && npx tsc --noEmit`
Expected: sin errores nuevos relacionados a `recipeIAFarmacia.ts`.

- [ ] **Step 3: Commit**

```bash
cd /home/josemarrufo/Escritorio/DosisYa-Frontend
git add src/lib/recipeIAFarmacia.ts
git commit -m "feat(panel-farmacia): cliente API del escáner de récipe modo farmacéutico"
```

---

### Task 7: Componente `EscanerRecipeFarmacia.tsx`

**Files:**
- Create: `src/components/panel/EscanerRecipeFarmacia.tsx`

**Interfaces:**
- Consumes: `analizarRecipeFarmacia`, `validarImagen`, `MedicamentoRecetaFarmaciaUI` (Task 6, `src/lib/recipeIAFarmacia.ts`).
- Produces: componente `EscanerRecipeFarmacia({ abierto, onOpenChange, inventario }: EscanerRecipeFarmaciaProps)`, donde `inventario: Array<{ nombre: string; stock?: boolean; precio_usd?: number }>`.

- [ ] **Step 1: Crear el archivo**

Crea `src/components/panel/EscanerRecipeFarmacia.tsx`:

```tsx
import { useCallback, useRef, useState } from "react";
import { Drawer } from "vaul";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Camera,
  ScanLine,
  Sparkles,
  CheckCircle2,
  RotateCcw,
  ImageOff,
  Pencil,
  AlertTriangle,
} from "lucide-react";
import {
  analizarRecipeFarmacia,
  validarImagen,
  type MedicamentoRecetaFarmaciaUI,
} from "@/lib/recipeIAFarmacia";

// ─────────────────────────────────────────────────────────────────────────────
// EscanerRecipeFarmacia — modo farmacéutico del escáner de récipe, dentro del
// panel B2B (sección "Mi Inventario"). Extrae campos técnicos de dispensación
// (nunca datos de paciente/médico) y los cruza contra el inventario propio de
// la farmacia, ya cargado por el dashboard.
//
// Estados: idle → scanning → results | error
//
// Spec: docs/superpowers/specs/2026-08-05-modo-farmaceutico-escaner-recipe-design.md
// Regla #5 CLAUDE.md: la imagen va al backend, nunca a un proveedor de IA desde React.
// ─────────────────────────────────────────────────────────────────────────────

type Estado = "idle" | "scanning" | "results" | "error";

type ItemInventario = {
  nombre: string;
  stock?: boolean;
  precio_usd?: number;
};

interface EscanerRecipeFarmaciaProps {
  abierto: boolean;
  onOpenChange: (abierto: boolean) => void;
  inventario: ItemInventario[];
}

const CAMPOS_TECNICOS = [
  "concentracion_mg",
  "forma_farmaceutica",
  "cantidad_total_unidades",
  "posologia_detallada",
  "via_administracion",
] as const;

const CAMPOS_EDITABLES = [
  ["nombre_comercial", "Nombre comercial"],
  ["principio_activo", "Principio activo"],
  ["concentracion_mg", "Concentración"],
  ["forma_farmaceutica", "Forma farmacéutica"],
  ["cantidad_total_unidades", "Cantidad"],
  ["posologia_detallada", "Posología"],
  ["via_administracion", "Vía de administración"],
] as const;

function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

function tieneIlegibles(med: MedicamentoRecetaFarmaciaUI): boolean {
  if (med.principio_activo === "ilegible") return true;
  return CAMPOS_TECNICOS.some((campo) => med[campo] === "ilegible");
}

function estadoInventario(
  principioActivo: string,
  inventario: ItemInventario[],
): { texto: string; tono: "verde" | "ambar" | "gris" } {
  const buscado = normalizar(principioActivo);
  const match = inventario.find((it) => normalizar(it.nombre) === buscado);
  if (!match) return { texto: "No está en tu inventario", tono: "gris" };
  if (match.stock) {
    return { texto: `En stock — $${(match.precio_usd ?? 0).toFixed(2)}`, tono: "verde" };
  }
  return { texto: "Sin stock", tono: "ambar" };
}

const TONO_BADGE: Record<"verde" | "ambar" | "gris", { color: string; bg: string }> = {
  verde: { color: "#065f46", bg: "#ecfdf5" },
  ambar: { color: "#92400e", bg: "#fffbeb" },
  gris: { color: "#4b5563", bg: "#f3f4f6" },
};

export function EscanerRecipeFarmacia({
  abierto,
  onOpenChange,
  inventario,
}: EscanerRecipeFarmaciaProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [estado, setEstado] = useState<Estado>("idle");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [resultados, setResultados] = useState<MedicamentoRecetaFarmaciaUI[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [borrador, setBorrador] = useState<MedicamentoRecetaFarmaciaUI | null>(null);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (open) {
        setEstado("idle");
        setPreviewUrl(null);
        setResultados([]);
        setErrorMsg("");
        setEditandoId(null);
      }
      onOpenChange(open);
    },
    [onOpenChange],
  );

  const procesarImagen = useCallback(async (file: File) => {
    const error = validarImagen(file);
    if (error) {
      toast.error(error);
      return;
    }

    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setEstado("scanning");

    const respuesta = await analizarRecipeFarmacia(file);

    if (respuesta.status === "success" && respuesta.data && respuesta.data.length > 0) {
      const conId: MedicamentoRecetaFarmaciaUI[] = respuesta.data.map((med) => ({
        ...med,
        id: crypto.randomUUID(),
      }));
      setResultados(conId);
      setEstado("results");
    } else {
      setErrorMsg(respuesta.message || "No pudimos leer los medicamentos del récipe.");
      setEstado("error");
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void procesarImagen(file);
    e.target.value = "";
  };

  const volverAIdle = () => {
    setEstado("idle");
    setPreviewUrl(null);
    setResultados([]);
    setErrorMsg("");
    setEditandoId(null);
  };

  const iniciarEdicion = (med: MedicamentoRecetaFarmaciaUI) => {
    setEditandoId(med.id);
    setBorrador({ ...med });
  };

  const cancelarEdicion = () => {
    setEditandoId(null);
    setBorrador(null);
  };

  const guardarEdicion = () => {
    if (!borrador) return;
    setResultados((prev) => prev.map((m) => (m.id === borrador.id ? borrador : m)));
    setEditandoId(null);
    setBorrador(null);
  };

  return (
    <Drawer.Root open={abierto} onOpenChange={handleOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <Drawer.Content
          className="fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col rounded-t-3xl bg-background outline-none"
          aria-describedby={undefined}
        >
          <div className="mx-auto mt-3 h-1.5 w-10 shrink-0 rounded-full bg-border" aria-hidden />

          <AnimatePresence mode="wait">
            {estado === "idle" && (
              <motion.div
                key="idle"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="flex flex-col px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-3"
              >
                <Drawer.Title className="text-lg font-bold text-foreground">
                  Escanear récipe (modo farmacéutico)
                </Drawer.Title>
                <p className="text-xs text-muted-foreground mb-5">
                  Extrae los datos técnicos para dispensar y los cruza con tu inventario.
                </p>

                <input
                  ref={inputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleFileChange}
                />

                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-emerald-300 bg-emerald-50/50 px-6 py-12 transition-colors hover:border-emerald-400 hover:bg-emerald-50 active:scale-[0.99]"
                >
                  <div className="relative">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
                      <Camera className="h-8 w-8" />
                    </div>
                    <div className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white">
                      <ScanLine className="h-3.5 w-3.5" />
                    </div>
                  </div>
                  <div className="text-center">
                    <p className="font-semibold text-foreground">Toma una foto del récipe</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      o selecciona una imagen de tu galería
                    </p>
                  </div>
                </button>
              </motion.div>
            )}

            {estado === "scanning" && (
              <motion.div
                key="scanning"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-3"
              >
                <Drawer.Title className="sr-only">Analizando récipe</Drawer.Title>
                <div className="relative mt-2 w-full max-w-sm overflow-hidden rounded-2xl">
                  {previewUrl && (
                    <img
                      src={previewUrl}
                      alt="Récipe capturado"
                      className="h-64 w-full object-cover"
                      style={{ filter: "blur(1.5px) brightness(0.85)" }}
                    />
                  )}
                  <div className="absolute inset-0">
                    <div className="animate-scan-line absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_12px_rgba(52,211,153,0.6)]" />
                  </div>
                </div>
                <div className="mt-6 flex flex-col items-center gap-2 text-center">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-emerald-500 animate-pulse" />
                    <p className="font-semibold text-foreground">Extrayendo datos técnicos...</p>
                  </div>
                  <p className="text-xs text-muted-foreground">Esto puede tardar unos segundos</p>
                </div>
              </motion.div>
            )}

            {estado === "results" && (
              <motion.div
                key="results"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex min-h-0 flex-col"
              >
                <div className="shrink-0 px-5 pb-2 pt-3">
                  <Drawer.Title className="text-lg font-bold text-foreground flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    {resultados.length} medicamento{resultados.length !== 1 ? "s" : ""} detectado
                    {resultados.length !== 1 ? "s" : ""}
                  </Drawer.Title>
                  <p className="text-xs text-muted-foreground">
                    Corrige los campos marcados como ilegibles antes de dispensar.
                  </p>
                </div>

                <ul className="min-h-0 flex-1 divide-y divide-border overflow-y-auto px-5">
                  {resultados.map((med) => {
                    const ilegible = tieneIlegibles(med);
                    const inv = estadoInventario(med.principio_activo, inventario);
                    const badge = TONO_BADGE[inv.tono];

                    return (
                      <li key={med.id} className="py-3.5">
                        {editandoId === med.id && borrador ? (
                          <div className="rounded-xl bg-sky-50/60 p-3 space-y-2">
                            {CAMPOS_EDITABLES.map(([campo, etiqueta]) => (
                              <div key={campo}>
                                <label
                                  className="text-xs font-medium text-muted-foreground"
                                  htmlFor={`${campo}-${med.id}`}
                                >
                                  {etiqueta}
                                </label>
                                <input
                                  id={`${campo}-${med.id}`}
                                  type="text"
                                  value={borrador[campo] === "ilegible" ? "" : borrador[campo]}
                                  placeholder="ilegible — escribe el valor correcto"
                                  onChange={(e) =>
                                    setBorrador({ ...borrador, [campo]: e.target.value })
                                  }
                                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                                />
                              </div>
                            ))}
                            <div className="flex gap-2 pt-1">
                              <button
                                type="button"
                                onClick={guardarEdicion}
                                disabled={!borrador.principio_activo.trim()}
                                className="flex-1 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-opacity disabled:opacity-40"
                              >
                                Guardar
                              </button>
                              <button
                                type="button"
                                onClick={cancelarEdicion}
                                className="flex-1 rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted-foreground"
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div
                            className={`rounded-xl p-3 ${ilegible ? "border border-amber-300 bg-amber-50/60" : ""}`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="font-medium text-foreground">
                                    {med.principio_activo}
                                  </p>
                                  {med.nombre_comercial && (
                                    <span className="text-xs text-muted-foreground">
                                      ({med.nombre_comercial})
                                    </span>
                                  )}
                                  {ilegible && (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                                      <AlertTriangle className="h-3 w-3" /> Revisar
                                    </span>
                                  )}
                                </div>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {med.concentracion_mg} · {med.forma_farmaceutica} ·{" "}
                                  {med.cantidad_total_unidades}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {med.posologia_detallada} · vía {med.via_administracion}
                                </p>
                                <span
                                  className="mt-2 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium"
                                  style={{ color: badge.color, background: badge.bg }}
                                >
                                  {inv.texto}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => iniciarEdicion(med)}
                                aria-label={`Editar ${med.principio_activo}`}
                                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-sky-600"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>

                <div className="shrink-0 space-y-2 border-t border-border px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3">
                  <button
                    type="button"
                    onClick={volverAIdle}
                    className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Escanear otro récipe
                  </button>
                </div>
              </motion.div>
            )}

            {estado === "error" && (
              <motion.div
                key="error"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-3 text-center"
              >
                <Drawer.Title className="sr-only">Error al analizar récipe</Drawer.Title>
                <div className="mt-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 text-amber-600">
                  <ImageOff className="h-8 w-8" />
                </div>
                <p className="mt-4 font-semibold text-foreground">No pudimos leer el récipe</p>
                <p className="mt-1.5 max-w-xs text-sm text-muted-foreground">{errorMsg}</p>
                <div className="mt-6 w-full">
                  <button
                    type="button"
                    onClick={volverAIdle}
                    className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Intentar de nuevo
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
```

- [ ] **Step 2: Verificar tipos**

Run: `cd /home/josemarrufo/Escritorio/DosisYa-Frontend && npx tsc --noEmit`
Expected: sin errores nuevos relacionados a `EscanerRecipeFarmacia.tsx`.

- [ ] **Step 3: Commit**

```bash
cd /home/josemarrufo/Escritorio/DosisYa-Frontend
git add src/components/panel/EscanerRecipeFarmacia.tsx
git commit -m "feat(panel-farmacia): componente del escáner de récipe modo farmacéutico"
```

---

### Task 8: Integrar en `admin.dashboard.tsx`

**Files:**
- Modify: `src/routes/admin.dashboard.tsx`

**Interfaces:**
- Consumes: `EscanerRecipeFarmacia` (Task 7, `src/components/panel/EscanerRecipeFarmacia.tsx`).

- [ ] **Step 1: Agregar `nivel_suscripcion` al tipo `DashboardData`**

En `src/routes/admin.dashboard.tsx`, reemplaza:

```tsx
type DashboardData = {
  nombre_farmacia?: string;
  pacientes_interesados_hoy?: number;
```

por:

```tsx
type DashboardData = {
  nombre_farmacia?: string;
  nivel_suscripcion?: string;
  pacientes_interesados_hoy?: number;
```

- [ ] **Step 2: Importar el componente y el ícono nuevo**

Reemplaza:

```tsx
import {
  LogOut,
  Home,
  Package,
  Settings,
  LifeBuoy,
  Search,
  MessageCircle,
  MapPin,
  Boxes,
  AlertTriangle,
  RefreshCw,
  Receipt,
  Clock,
  Loader2,
} from "lucide-react";
import { UploadInventory } from "@/components/UploadInventory";
```

por:

```tsx
import {
  LogOut,
  Home,
  Package,
  Settings,
  LifeBuoy,
  Search,
  MessageCircle,
  MapPin,
  Boxes,
  AlertTriangle,
  RefreshCw,
  Receipt,
  Clock,
  Loader2,
  ScanLine,
} from "lucide-react";
import { UploadInventory } from "@/components/UploadInventory";
import { EscanerRecipeFarmacia } from "@/components/panel/EscanerRecipeFarmacia";
```

- [ ] **Step 3: Agregar el botón, el estado y el drawer en `InventarioSection`**

Reemplaza la firma y el cuerpo inicial de `InventarioSection`:

```tsx
function InventarioSection({
  loading,
  data,
  onUploaded,
}: {
  loading: boolean;
  data: DashboardData | null;
  onUploaded: (count: number) => void;
}) {
  const items = data?.inventario ?? [];
  const [q, setQ] = useState("");
```

por:

```tsx
function InventarioSection({
  loading,
  data,
  onUploaded,
}: {
  loading: boolean;
  data: DashboardData | null;
  onUploaded: (count: number) => void;
}) {
  const items = data?.inventario ?? [];
  const [q, setQ] = useState("");
  const [escanerAbierto, setEscanerAbierto] = useState(false);
  const esPremium = data?.nivel_suscripcion === "premium";
```

Reemplaza el inicio del `return` de `InventarioSection` (justo antes de `<UploadInventory`):

```tsx
  return (
    <div className="space-y-6">
      <UploadInventory
```

por:

```tsx
  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={() => {
          if (!esPremium) {
            toast.info("Escanear récipes en el mostrador es una función del plan Premium.");
            return;
          }
          setEscanerAbierto(true);
        }}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-emerald-300 bg-emerald-50/50 px-4 py-3 text-sm font-semibold text-emerald-800 transition-colors hover:bg-emerald-50"
        style={!esPremium ? { opacity: 0.6 } : undefined}
      >
        <ScanLine className="h-4 w-4" />
        Escanear récipe en mostrador
        {!esPremium && (
          <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
            Premium
          </span>
        )}
      </button>

      <EscanerRecipeFarmacia
        abierto={escanerAbierto}
        onOpenChange={setEscanerAbierto}
        inventario={items}
      />

      <UploadInventory
```

- [ ] **Step 4: Verificar tipos y build**

Run: `cd /home/josemarrufo/Escritorio/DosisYa-Frontend && npx tsc --noEmit`
Expected: sin errores.

Run: `cd /home/josemarrufo/Escritorio/DosisYa-Frontend && npm run build`
Expected: build exitoso.

- [ ] **Step 5: Commit**

```bash
cd /home/josemarrufo/Escritorio/DosisYa-Frontend
git add src/routes/admin.dashboard.tsx
git commit -m "feat(panel-farmacia): integra el escáner de récipe modo farmacéutico en Mi Inventario"
```

---

### Task 9: Verificación end-to-end

No hay cambios de código en este task — es la verificación final de que todo el plan, en ambos repos, queda consistente (equivalente al gate de `verification-before-completion` antes de dar el trabajo por terminado).

- [ ] **Step 1: Suite completa del backend**

Run: `cd /home/josemarrufo/Escritorio/DosisYa-Backend && python -m pytest -q`
Expected: todos los tests pasan (línea base 212 + los agregados en Tasks 1-5).

- [ ] **Step 2: Lint del backend**

Run: `cd /home/josemarrufo/Escritorio/DosisYa-Backend && ruff check src/dosisya/`
Expected: sin errores nuevos (la deuda preexistente de `gemini_service.py`, documentada antes del 2026-08-05, puede seguir apareciendo).

- [ ] **Step 3: Verificación completa del frontend**

Run: `cd /home/josemarrufo/Escritorio/DosisYa-Frontend && npx tsc --noEmit && npm run build`
Expected: ambos comandos terminan sin error (regla obligatoria de CLAUDE.md antes de cualquier push).

- [ ] **Step 4: Prueba manual en preview (dev server)**

Con `npm run dev` corriendo: login en `/admin/login` con una farmacia de prueba, entrar a "Mi Inventario", confirmar que el botón "Escanear récipe en mostrador" aparece deshabilitado con badge "Premium" si la farmacia es gratuita, y habilitado si es premium (verificar/ajustar `nivel_suscripcion` de la farmacia de prueba en la base de datos si hace falta). Con una farmacia premium: escanear una foto de récipe, confirmar que los resultados muestran los 7 campos técnicos, que un campo "ilegible" se resalta en ámbar, que "Editar" permite corregirlo, y que el badge de inventario (verde/ámbar/gris) aparece por cada medicamento.

No hay commit en este task — es solo verificación de lo ya commiteado en los Tasks 1-8.
