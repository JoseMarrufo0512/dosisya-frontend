# Fallback a NVIDIA Nemotron para IA del backend — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar NVIDIA Nemotron Nano 12B v2 VL como respaldo automático del escáner de récipe y el parser de inventario B2B, para que sigan funcionando si Gemini falla (como ya pasó dos veces).

**Architecture:** Un orquestador delgado (`ia_orchestrator.py`) es el único punto de entrada que los routers llaman; internamente intenta `gemini_service` primero y, solo si falla por cualquier motivo, intenta `nvidia_service` (SDK `openai` contra el endpoint OpenAI-compatible de NVIDIA NIM). Los prompts y la validación de items post-JSON viven en un módulo compartido (`ia_prompts.py`) para que la REGLA MÉDICA no pueda quedar desactualizada en un proveedor y no en el otro.

**Tech Stack:** Python 3.11+, FastAPI, `google-genai` (ya presente), `openai` (nuevo), pytest + monkeypatch (sin llamadas reales a ninguna API en tests).

**Repo:** `DosisYa-Backend` (todos los cambios de este plan son ahí — sin cambios en `DosisYa-Frontend`).

## Global Constraints

- El contrato HTTP de `POST /api/v1/ia/analizar-recipe` y
  `POST /api/v1/farmacias/{id}/inventario/upload` NO cambia (mismos códigos
  de estado, mismo envelope) — verificado por los tests existentes que no
  se tocan salvo el import de las excepciones.
- Ningún test llama a una API real (ni Gemini ni NVIDIA) — todo mockeado por
  monkeypatch, siguiendo el patrón ya establecido en `test_gemini_service.py`.
- El sistema debe funcionar exactamente igual que hoy (Gemini-only) mientras
  `NVIDIA_API_KEY` no esté configurada en el entorno — sin crashear.
- No modificar el texto de `PROMPT_RECIPE` (contiene la REGLA MÉDICA) al
  moverlo — copiar tal cual.
- Verificación antes de cada commit: `pytest` completo en verde + `ruff check`
  sin errores nuevos (los 3 pre-existentes de `UP041`/`N818` no son de este
  plan, no se tocan).

---

### Task 1: `ia_prompts.py` — prompts, schemas y validación compartida

**Files:**
- Create: `src/dosisya/services/ia_prompts.py`
- Test: `tests/test_ia_prompts.py`

**Interfaces:**
- Produces: `PROMPT_RECIPE: str`, `PROMPT_SISTEMA: str`,
  `RECIPE_RESPONSE_SCHEMA: dict`, `RESPONSE_SCHEMA: dict`,
  `validar_items_medicamento(items: list[Any]) -> list[dict[str, Any]]`,
  `validar_items_inventario(items: list[Any]) -> list[dict[str, Any]]`.

- [ ] **Step 1: Escribir los tests de los validadores (fallan: el módulo no existe)**

Crear `tests/test_ia_prompts.py`:

```python
"""
DosisYa — Tests de ia_prompts.py: validación de items post-JSON compartida
entre gemini_service.py y nvidia_service.py.
"""

from __future__ import annotations

from dosisya.services import ia_prompts


class TestValidarItemsMedicamento:
    def test_item_valido_se_conserva(self):
        items = [{"medicamento": "Losartán", "cantidad": "2 cajas", "alternativas": ["Cozaar"]}]
        resultado = ia_prompts.validar_items_medicamento(items)
        assert resultado == [
            {"medicamento": "Losartán", "cantidad": "2 cajas", "alternativas": ["Cozaar"]}
        ]

    def test_item_sin_medicamento_se_descarta(self):
        items = [{"cantidad": "2 cajas", "alternativas": []}]
        assert ia_prompts.validar_items_medicamento(items) == []

    def test_item_no_dict_se_descarta(self):
        assert ia_prompts.validar_items_medicamento(["no es un dict"]) == []

    def test_cantidad_y_alternativas_ausentes_usan_default(self):
        items = [{"medicamento": "Paracetamol"}]
        resultado = ia_prompts.validar_items_medicamento(items)
        assert resultado == [{"medicamento": "Paracetamol", "cantidad": "", "alternativas": []}]

    def test_alternativas_no_lista_se_ignora(self):
        items = [{"medicamento": "Paracetamol", "cantidad": "", "alternativas": "no es lista"}]
        resultado = ia_prompts.validar_items_medicamento(items)
        assert resultado[0]["alternativas"] == []

    def test_alternativas_con_strings_vacios_se_filtran(self):
        items = [{"medicamento": "Paracetamol", "cantidad": "", "alternativas": ["Atamel", "  ", ""]}]
        resultado = ia_prompts.validar_items_medicamento(items)
        assert resultado[0]["alternativas"] == ["Atamel"]


class TestValidarItemsInventario:
    def test_item_valido_se_conserva(self):
        items = [
            {
                "principio_activo": "Paracetamol",
                "marca_comercial": "Atamel",
                "presentacion": "Tabletas 500mg x 10",
                "precio_usd": 2.5,
            }
        ]
        resultado = ia_prompts.validar_items_inventario(items)
        assert resultado == [
            {
                "principio_activo": "Paracetamol",
                "marca_comercial": "Atamel",
                "presentacion": "Tabletas 500mg x 10",
                "precio_usd": 2.5,
            }
        ]

    def test_item_sin_principio_activo_se_descarta(self):
        items = [{"presentacion": "Tabletas 500mg x 10", "precio_usd": 2.5}]
        assert ia_prompts.validar_items_inventario(items) == []

    def test_item_sin_presentacion_se_descarta(self):
        items = [{"principio_activo": "Paracetamol", "precio_usd": 2.5}]
        assert ia_prompts.validar_items_inventario(items) == []

    def test_marca_comercial_ausente_usa_cadena_vacia(self):
        items = [
            {"principio_activo": "Paracetamol", "presentacion": "Tabletas 500mg x 10", "precio_usd": 2.5}
        ]
        resultado = ia_prompts.validar_items_inventario(items)
        assert resultado[0]["marca_comercial"] == ""

    def test_precio_ausente_usa_cero(self):
        items = [
            {"principio_activo": "Paracetamol", "marca_comercial": "", "presentacion": "Tabletas 500mg x 10"}
        ]
        resultado = ia_prompts.validar_items_inventario(items)
        assert resultado[0]["precio_usd"] == 0.0


class TestPromptsYSchemas:
    def test_prompt_recipe_contiene_regla_medica(self):
        assert "REGLA MÉDICA" in ia_prompts.PROMPT_RECIPE
        assert "mismo principio activo" in ia_prompts.PROMPT_RECIPE

    def test_recipe_response_schema_requiere_medicamento(self):
        assert "medicamento" in ia_prompts.RECIPE_RESPONSE_SCHEMA["items"]["required"]

    def test_response_schema_requiere_principio_activo(self):
        assert "principio_activo" in ia_prompts.RESPONSE_SCHEMA["items"]["required"]
```

- [ ] **Step 2: Correr los tests para confirmar que fallan**

Run: `cd /home/josemarrufo/Escritorio/DosisYa-Backend && source .venv/bin/activate && python -m pytest tests/test_ia_prompts.py -v`
Expected: FAIL con `ModuleNotFoundError: No module named 'dosisya.services.ia_prompts'`

- [ ] **Step 3: Crear `src/dosisya/services/ia_prompts.py`**

```python
"""
DosisYa — Prompts, schemas y validación compartidos entre proveedores de IA.

Única fuente de verdad para:
  - Los prompts que cada proveedor (Gemini, NVIDIA) envía al modelo.
  - La REGLA MÉDICA (alternativas solo del mismo principio activo) — vive
    aquí para que no pueda quedar desactualizada en un proveedor y no en
    el otro si se edita.
  - La validación/sanitización de items que YA vinieron parseados como
    lista de dicts (post-JSON) — la extracción del JSON crudo desde la
    respuesta del SDK SÍ es específica de cada proveedor (ver
    gemini_service._extraer_lista_json vs nvidia_service._extraer_lista_json)
    porque la forma del objeto respuesta difiere por SDK.
"""

from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)


# Schema JSON que el proveedor debe respetar en su respuesta (solo Gemini lo
# usa como response_schema estructurado; NVIDIA se apoya en la instrucción
# del prompt).
RESPONSE_SCHEMA = {
    "type": "array",
    "items": {
        "type": "object",
        "properties": {
            "principio_activo": {
                "type": "string",
                "description": (
                    "Nombre genérico INN del medicamento "
                    "(ej: 'Lostartán', 'Paracetamol')"
                ),
            },
            "marca_comercial": {
                "type": "string",
                "description": "Nombre de marca si existe, o cadena vacía si no aplica",
            },
            "presentacion": {
                "type": "string",
                "description": "Forma farmacéutica + dosis + cantidad (ej: 'Tabletas 50mg x 30')",
            },
            "precio_usd": {
                "type": "number",
                "description": "Precio en dólares USD como número decimal",
            },
        },
        "required": ["principio_activo", "presentacion", "precio_usd"],
    },
}

PROMPT_SISTEMA = """Eres un farmacéutico experto en normalización de inventarios venezolanos.
Tu tarea es extraer medicamentos de un texto CSV/tabla y devolverlos en formato JSON estructurado.

Reglas de normalización:
1. principio_activo: Nombre genérico INN en español. Capitaliza solo la primera letra.
   - "ACETAMINOFEN", "acetaminofén", "Paracetamol" → "Paracetamol"
   - "LOSARTAN POTASICO" → "Losartán"
2. marca_comercial: Nombre comercial si está presente, si no usa cadena vacía "".
3. presentacion: Estandariza como "[Forma] [Dosis] x [Cantidad]".
   - "tab 500mg 30un" → "Tabletas 500mg x 30"
   - "jarabe 120ml" → "Jarabe 120ml"
4. precio_usd: Extrae el valor numérico. Si el precio está en Bs, conviértelo a USD
   usando la tasa más reciente implícita en los datos. Si no hay tasa, deja precio_usd=0.0.
5. Ignora filas de encabezado, totales, subtotales o filas vacías.
6. Devuelve SOLO el JSON — sin texto adicional, sin markdown, sin bloques de código.

Datos del inventario a procesar:
"""


RECIPE_RESPONSE_SCHEMA = {
    "type": "array",
    "items": {
        "type": "object",
        "properties": {
            "medicamento": {
                "type": "string",
                "description": (
                    "Nombre del principio activo o marca detectada en el récipe "
                    "(ej: 'Losartán', 'Atamel')"
                ),
            },
            "cantidad": {
                "type": "string",
                "description": (
                    "Cantidad recetada tal como está escrita en el récipe "
                    "(ej: '2 cajas', '30 tabletas'); cadena vacía si no se lee"
                ),
            },
            "alternativas": {
                "type": "array",
                "items": {"type": "string"},
                "description": (
                    "Presentaciones/equivalentes del MISMO principio activo. "
                    "Puede ser una lista vacía."
                ),
            },
        },
        "required": ["medicamento", "cantidad", "alternativas"],
    },
}

# ─────────────────────────────────────────────────────────────────────────
# REGLA MÉDICA (obligatoria, prevalece sobre cualquier mock del frontend):
# `alternativas` SOLO puede contener presentaciones/equivalentes del MISMO
# principio activo que el medicamento detectado (ej: récipe dice "Atamel" →
# alternativa "Paracetamol (genérico)"). PROHIBIDO sugerir principios
# activos distintos (ej: Losartán → Valsartán): un cambio de molécula lo
# decide un médico, no nuestra IA. Esta regla está reforzada en el prompt
# `PROMPT_RECIPE` — si se edita el prompt, esta restricción NO debe
# eliminarse ni suavizarse. Es la ÚNICA copia de este prompt: la usan tanto
# gemini_service.py como nvidia_service.py.
# ─────────────────────────────────────────────────────────────────────────

PROMPT_RECIPE = """Eres un farmacéutico venezolano experto en leer récipes médicos,
incluyendo letra manuscrita difícil. Tu tarea es extraer los medicamentos
recetados de la imagen y devolverlos en formato JSON estructurado.

Reglas de extracción:
1. medicamento: Normaliza el nombre al principio activo si lo reconoces
   (ej: "Atamel" → "Paracetamol"); si no lo reconoces con certeza, usa el
   nombre/marca tal como aparece escrito.
2. cantidad: Texto de la cantidad recetada TAL COMO está escrita en el récipe
   (ej: "2 cajas", "30 tabletas", "1 frasco"). Si no se puede leer, usa "".
3. alternativas: Lista de presentaciones o marcas equivalentes que compartan
   EXACTAMENTE el mismo principio activo que el medicamento detectado.
   REGLA MÉDICA ESTRICTA — PROHIBIDO sugerir un principio activo distinto
   (ej: si el récipe dice "Losartán", NUNCA sugieras "Valsartán" ni ningún
   otro antihipertensivo de otra familia: cambiar de molécula es una
   decisión médica, no de esta IA). Si no hay alternativas seguras, usa
   una lista vacía [].
4. Si la imagen NO es un récipe médico legible, o no contiene medicamentos
   identificables, devuelve una lista vacía [].
5. Devuelve SOLO el JSON — sin texto adicional, sin markdown, sin bloques
   de código.
"""


def validar_items_medicamento(items: list[Any]) -> list[dict[str, Any]]:
    """Valida y sanitiza items del escáner de récipe (post-JSON, cualquier
    proveedor). Descarta items sin `medicamento`.
    """
    resultado: list[dict[str, Any]] = []
    for i, item in enumerate(items):
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
            "medicamento": str(item["medicamento"]).strip(),
            "cantidad": str(item.get("cantidad") or "").strip(),
            "alternativas": [str(a).strip() for a in alternativas_raw if str(a).strip()],
        })
    return resultado


def validar_items_inventario(items: list[Any]) -> list[dict[str, Any]]:
    """Valida y sanitiza items del parser de inventario (post-JSON, cualquier
    proveedor). Descarta items sin `principio_activo` o `presentacion`.
    """
    resultado: list[dict[str, Any]] = []
    for i, item in enumerate(items):
        if not isinstance(item, dict):
            logger.warning("Item %d ignorado (no es dict): %r", i, item)
            continue
        if not item.get("principio_activo") or not item.get("presentacion"):
            logger.warning("Item %d ignorado (faltan campos obligatorios): %r", i, item)
            continue

        resultado.append({
            "principio_activo": str(item["principio_activo"]).strip(),
            "marca_comercial": str(item.get("marca_comercial") or "").strip(),
            "presentacion": str(item["presentacion"]).strip(),
            "precio_usd": float(item.get("precio_usd") or 0.0),
        })
    return resultado
```

- [ ] **Step 4: Correr los tests, deben pasar**

Run: `python -m pytest tests/test_ia_prompts.py -v`
Expected: PASS (16 tests)

- [ ] **Step 5: Commit**

```bash
cd /home/josemarrufo/Escritorio/DosisYa-Backend
git add src/dosisya/services/ia_prompts.py tests/test_ia_prompts.py
git commit -m "feat(ia): extraer prompts y validación compartida a ia_prompts.py

Única fuente de verdad de la REGLA MÉDICA y de la validación de items
post-JSON, para que un futuro segundo proveedor (NVIDIA) no pueda quedar
desalineado con Gemini si se edita el prompt."
```

---

### Task 2: Refactorizar `gemini_service.py` para consumir `ia_prompts.py`

**Refactor puro — cero cambio de comportamiento.** Los 31 tests existentes de
`test_gemini_service.py` deben seguir pasando sin modificarlos.

**Files:**
- Modify: `src/dosisya/services/gemini_service.py`

**Interfaces:**
- Consumes: `ia_prompts.PROMPT_RECIPE`, `ia_prompts.PROMPT_SISTEMA`,
  `ia_prompts.RECIPE_RESPONSE_SCHEMA`, `ia_prompts.RESPONSE_SCHEMA`,
  `ia_prompts.validar_items_medicamento`, `ia_prompts.validar_items_inventario`.
- Produces: sin cambios (misma API pública que ya tenía).

- [ ] **Step 1: Correr la suite actual como baseline**

Run: `python -m pytest tests/test_gemini_service.py -v`
Expected: PASS (31 tests) — este es el estado ANTES del refactor, para comparar después.

- [ ] **Step 2: Reemplazar el bloque de imports para traer los símbolos de `ia_prompts`**

En `src/dosisya/services/gemini_service.py`, el bloque de imports actual es:

```python
from __future__ import annotations

import asyncio
import json
import logging
import os
from typing import Any

logger = logging.getLogger(__name__)
```

Reemplazar por:

```python
from __future__ import annotations

import asyncio
import json
import logging
import os
from typing import Any

from dosisya.services.ia_prompts import (
    PROMPT_RECIPE as _PROMPT_RECIPE,
    PROMPT_SISTEMA as _PROMPT_SISTEMA,
    RECIPE_RESPONSE_SCHEMA as _RECIPE_RESPONSE_SCHEMA,
    RESPONSE_SCHEMA as _RESPONSE_SCHEMA,
    validar_items_inventario,
    validar_items_medicamento,
)

logger = logging.getLogger(__name__)
```

- [ ] **Step 3: Eliminar las definiciones locales de schemas y prompts**

Buscar el bloque que va desde el comentario `# Schema JSON que Gemini debe
respetar...` hasta el final del docstring de `_PROMPT_RECIPE` (justo antes de
`class GeminiParsingError`). Es este bloque completo (líneas ~150-267 del
archivo original):

```python
# Schema JSON que Gemini debe respetar en su respuesta.
# Cada item de la lista representa un medicamento normalizado.
_RESPONSE_SCHEMA = {
    "type": "array",
    "items": {
        "type": "object",
        "properties": {
            "principio_activo": {
                "type": "string",
                "description": (
                    "Nombre genérico INN del medicamento "
                    "(ej: 'Lostartán', 'Paracetamol')"
                ),
            },
            "marca_comercial": {
                "type": "string",
                "description": "Nombre de marca si existe, o cadena vacía si no aplica",
            },
            "presentacion": {
                "type": "string",
                "description": "Forma farmacéutica + dosis + cantidad (ej: 'Tabletas 50mg x 30')",
            },
            "precio_usd": {
                "type": "number",
                "description": "Precio en dólares USD como número decimal",
            },
        },
        "required": ["principio_activo", "presentacion", "precio_usd"],
    },
}

_PROMPT_SISTEMA = """Eres un farmacéutico experto en normalización de inventarios venezolanos.
Tu tarea es extraer medicamentos de un texto CSV/tabla y devolverlos en formato JSON estructurado.

Reglas de normalización:
1. principio_activo: Nombre genérico INN en español. Capitaliza solo la primera letra.
   - "ACETAMINOFEN", "acetaminofén", "Paracetamol" → "Paracetamol"
   - "LOSARTAN POTASICO" → "Losartán"
2. marca_comercial: Nombre comercial si está presente, si no usa cadena vacía "".
3. presentacion: Estandariza como "[Forma] [Dosis] x [Cantidad]".
   - "tab 500mg 30un" → "Tabletas 500mg x 30"
   - "jarabe 120ml" → "Jarabe 120ml"
4. precio_usd: Extrae el valor numérico. Si el precio está en Bs, conviértelo a USD
   usando la tasa más reciente implícita en los datos. Si no hay tasa, deja precio_usd=0.0.
5. Ignora filas de encabezado, totales, subtotales o filas vacías.
6. Devuelve SOLO el JSON — sin texto adicional, sin markdown, sin bloques de código.

Datos del inventario a procesar:
"""


# Schema JSON para el escáner de récipe (Gemini Vision). Cada item representa
# un medicamento leído del récipe manuscrito/impreso.
_RECIPE_RESPONSE_SCHEMA = {
    "type": "array",
    "items": {
        "type": "object",
        "properties": {
            "medicamento": {
                "type": "string",
                "description": (
                    "Nombre del principio activo o marca detectada en el récipe "
                    "(ej: 'Losartán', 'Atamel')"
                ),
            },
            "cantidad": {
                "type": "string",
                "description": (
                    "Cantidad recetada tal como está escrita en el récipe "
                    "(ej: '2 cajas', '30 tabletas'); cadena vacía si no se lee"
                ),
            },
            "alternativas": {
                "type": "array",
                "items": {"type": "string"},
                "description": (
                    "Presentaciones/equivalentes del MISMO principio activo. "
                    "Puede ser una lista vacía."
                ),
            },
        },
        "required": ["medicamento", "cantidad", "alternativas"],
    },
}

# ─────────────────────────────────────────────────────────────────────────
# REGLA MÉDICA (obligatoria, prevalece sobre cualquier mock del frontend):
# `alternativas` SOLO puede contener presentaciones/equivalentes del MISMO
# principio activo que el medicamento detectado (ej: récipe dice "Atamel" →
# alternativa "Paracetamol (genérico)"). PROHIBIDO sugerir principios
# activos distintos (ej: Losartán → Valsartán): un cambio de molécula lo
# decide un médico, no nuestra IA. Esta regla está reforzada en el prompt
# `_PROMPT_RECIPE` — si se edita el prompt, esta restricción NO debe
# eliminarse ni suavizarse.
# ─────────────────────────────────────────────────────────────────────────

_PROMPT_RECIPE = """Eres un farmacéutico venezolano experto en leer récipes médicos,
incluyendo letra manuscrita difícil. Tu tarea es extraer los medicamentos
recetados de la imagen y devolverlos en formato JSON estructurado.

Reglas de extracción:
1. medicamento: Normaliza el nombre al principio activo si lo reconoces
   (ej: "Atamel" → "Paracetamol"); si no lo reconoces con certeza, usa el
   nombre/marca tal como aparece escrito.
2. cantidad: Texto de la cantidad recetada TAL COMO está escrita en el récipe
   (ej: "2 cajas", "30 tabletas", "1 frasco"). Si no se puede leer, usa "".
3. alternativas: Lista de presentaciones o marcas equivalentes que compartan
   EXACTAMENTE el mismo principio activo que el medicamento detectado.
   REGLA MÉDICA ESTRICTA — PROHIBIDO sugerir un principio activo distinto
   (ej: si el récipe dice "Losartán", NUNCA sugieras "Valsartán" ni ningún
   otro antihipertensivo de otra familia: cambiar de molécula es una
   decisión médica, no de esta IA). Si no hay alternativas seguras, usa
   una lista vacía [].
4. Si la imagen NO es un récipe médico legible, o no contiene medicamentos
   identificables, devuelve una lista vacía [].
5. Devuelve SOLO el JSON — sin texto adicional, sin markdown, sin bloques
   de código.
"""
```

Reemplazar TODO ese bloque por un único comentario (los símbolos ya se
importaron en el Step 2):

```python
# Prompts, schemas y REGLA MÉDICA: ver dosisya.services.ia_prompts
# (única fuente de verdad, compartida con nvidia_service.py).
```

- [ ] **Step 4: Reemplazar el loop de validación en `_parsear_inventario_sync`**

Buscar:

```python
    medicamentos = _extraer_lista_json(
        response, contexto="inventario", sugerencia="Verifica el formato del archivo."
    )

    # Validar y sanitizar cada item
    resultado: list[dict[str, Any]] = []
    for i, item in enumerate(medicamentos):
        if not isinstance(item, dict):
            logger.warning("Item %d ignorado (no es dict): %r", i, item)
            continue
        if not item.get("principio_activo") or not item.get("presentacion"):
            logger.warning("Item %d ignorado (faltan campos obligatorios): %r", i, item)
            continue

        resultado.append({
            "principio_activo": str(item["principio_activo"]).strip(),
            "marca_comercial":  str(item.get("marca_comercial") or "").strip(),
            "presentacion":     str(item["presentacion"]).strip(),
            "precio_usd":       float(item.get("precio_usd") or 0.0),
        })

    logger.info(
        "Gemini parseó %d medicamentos válidos de %d items totales.",
        len(resultado),
        len(medicamentos),
    )
    return resultado
```

Reemplazar por:

```python
    medicamentos = _extraer_lista_json(
        response, contexto="inventario", sugerencia="Verifica el formato del archivo."
    )
    resultado = validar_items_inventario(medicamentos)

    logger.info(
        "Gemini parseó %d medicamentos válidos de %d items totales.",
        len(resultado),
        len(medicamentos),
    )
    return resultado
```

- [ ] **Step 5: Reemplazar el loop de validación en `_analizar_recipe_sync`**

Buscar:

```python
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

Reemplazar por:

```python
    medicamentos = _extraer_lista_json(
        response, contexto="récipe", sugerencia="Intenta con una foto más clara."
    )
    resultado = validar_items_medicamento(medicamentos)

    logger.info(
        "Gemini Vision extrajo %d medicamentos válidos de %d items totales (récipe).",
        len(resultado),
        len(medicamentos),
    )
    return resultado
```

- [ ] **Step 6: Actualizar el docstring del módulo (referencia a dónde viven los prompts)**

Buscar, cerca del inicio del archivo:

```python
Prompt de sistema:
  Ver _PROMPT_SISTEMA (inventario) y _PROMPT_RECIPE (récipe — contiene la
  REGLA MÉDICA de mismo principio activo; NO modificar su texto).
"""
```

Reemplazar por:

```python
Prompt de sistema:
  Los prompts y la REGLA MÉDICA viven en dosisya.services.ia_prompts
  (compartidos con nvidia_service.py) — NO modificar su texto sin revisar
  ambos consumidores.
"""
```

- [ ] **Step 7: Correr la suite completa de gemini_service — debe seguir en verde, sin tocar los tests**

Run: `python -m pytest tests/test_gemini_service.py -v`
Expected: PASS (31 tests, exactamente los mismos que en el Step 1 — cero
cambio de comportamiento).

- [ ] **Step 8: Correr `ruff check` sobre el archivo modificado**

Run: `ruff check src/dosisya/services/gemini_service.py`
Expected: Los mismos 2 warnings `UP041` pre-existentes (líneas de
`asyncio.TimeoutError`), ninguno nuevo.

- [ ] **Step 9: Commit**

```bash
git add src/dosisya/services/gemini_service.py
git commit -m "refactor(ia): gemini_service consume prompts/validación desde ia_prompts

Sin cambio de comportamiento — los 31 tests existentes pasan sin
modificarse. Prepara el terreno para nvidia_service.py, que reutilizará
los mismos prompts y validadores."
```

---

### Task 3: Agregar dependencia `openai`

**Files:**
- Modify: `pyproject.toml`

- [ ] **Step 1: Agregar la dependencia**

En `pyproject.toml`, buscar:

```toml
    "google-genai>=1.0,<2.0",   # SDK unificado Gemini (inventario + escáner de récipe; permite thinking_budget=0)
]
```

Reemplazar por:

```toml
    "google-genai>=1.0,<2.0",   # SDK unificado Gemini (inventario + escáner de récipe; permite thinking_budget=0)
    "openai>=1.0,<2.0",         # SDK usado contra el endpoint OpenAI-compatible de NVIDIA NIM (respaldo de Gemini)
]
```

- [ ] **Step 2: Instalar**

Run: `cd /home/josemarrufo/Escritorio/DosisYa-Backend && source .venv/bin/activate && pip install -e ".[dev]"`
Expected: instala `openai` y sus dependencias sin errores.

- [ ] **Step 3: Verificar el import**

Run: `python -c "from openai import OpenAI; print('ok')"`
Expected: `ok`

- [ ] **Step 4: Commit**

```bash
git add pyproject.toml
git commit -m "chore(deps): agregar SDK openai para el respaldo de IA con NVIDIA NIM"
```

**Nota:** `uv.lock` está en `.gitignore` de este repo (no se versiona) — no
agregarlo al commit; `git add uv.lock` fallaría con "the following paths are
ignored".

---

### Task 4: `nvidia_service.py` — cliente, excepciones y escáner de récipe

**Files:**
- Create: `src/dosisya/services/nvidia_service.py`
- Test: `tests/test_nvidia_service.py`

**Interfaces:**
- Consumes: `ia_prompts.PROMPT_RECIPE`, `ia_prompts.validar_items_medicamento`.
- Produces: `_get_client()`, `_clasificar_error(exc) -> str | None`,
  `NvidiaParsingError`, `NvidiaQuotaError(NvidiaParsingError)`,
  `NvidiaTimeoutError(NvidiaParsingError)`,
  `async def analizar_recipe(imagen_bytes: bytes, mime_type: str) -> list[dict[str, Any]]`.

- [ ] **Step 1: Escribir los tests (fallan: el módulo no existe)**

Crear `tests/test_nvidia_service.py`:

```python
"""
DosisYa — Tests del servicio NVIDIA NIM (SDK openai, endpoint compatible).

NVIDIA NUNCA se llama de verdad: el cliente se falsea monkeypatcheando
`dosisya.services.nvidia_service._get_client`. Los errores del SDK se
simulan con excepciones duck-typed (atributo `.status_code`), igual que
hace `_clasificar_error` (mismo patrón que test_gemini_service.py).
"""

from __future__ import annotations

import httpx
import pytest

from dosisya.services import nvidia_service as ns


class ErrorConStatusCode(Exception):
    """Simula openai.APIStatusError (duck typing sobre .status_code)."""

    def __init__(self, status_code: int):
        super().__init__(f"HTTP {status_code}")
        self.status_code = status_code


class TestClasificarError:
    def test_429_es_quota(self):
        assert ns._clasificar_error(ErrorConStatusCode(429)) == "quota"

    @pytest.mark.parametrize("status_code", [500, 502, 503, 504])
    def test_5xx_es_transitorio(self, status_code: int):
        assert ns._clasificar_error(ErrorConStatusCode(status_code)) == "transitorio"

    def test_timeout_httpx(self):
        assert ns._clasificar_error(httpx.ReadTimeout("lento")) == "timeout"

    def test_timeout_builtin(self):
        assert ns._clasificar_error(TimeoutError()) == "timeout"

    def test_error_generico_no_reintentable(self):
        assert ns._clasificar_error(ValueError("boom")) is None

    def test_400_no_reintentable(self):
        assert ns._clasificar_error(ErrorConStatusCode(400)) is None


class TestGetClient:
    def test_api_key_ausente_lanza_runtime_error(self, monkeypatch: pytest.MonkeyPatch):
        monkeypatch.setenv("NVIDIA_API_KEY", "")
        with pytest.raises(RuntimeError, match="NVIDIA_API_KEY"):
            ns._get_client()

    def test_api_key_placeholder_lanza_runtime_error(self, monkeypatch: pytest.MonkeyPatch):
        monkeypatch.setenv("NVIDIA_API_KEY", "your-nvidia-api-key-here")
        with pytest.raises(RuntimeError, match="NVIDIA_API_KEY"):
            ns._get_client()

    def test_api_key_valida_devuelve_cliente(self, monkeypatch: pytest.MonkeyPatch):
        monkeypatch.setenv("NVIDIA_API_KEY", "test-key-123")
        client = ns._get_client()
        assert hasattr(client, "chat")


# ─── Fakes del cliente openai ────────────────────────────────────────────────


class FakeMessage:
    def __init__(self, content: str):
        self.content = content


class FakeChoice:
    def __init__(self, content: str):
        self.message = FakeMessage(content)


class FakeCompletionResponse:
    def __init__(self, content: str):
        self.choices = [FakeChoice(content)]


class FakeChatCompletions:
    """Simula client.chat.completions — cada item de `respuestas` es una
    respuesta o una excepción a lanzar, consumidos en orden."""

    def __init__(self, respuestas: list):
        self._respuestas = list(respuestas)
        self.modelos_llamados: list[str] = []

    def create(self, *, model: str, messages, **kwargs):
        self.modelos_llamados.append(model)
        r = self._respuestas.pop(0)
        if isinstance(r, Exception):
            raise r
        return r


class FakeChat:
    def __init__(self, respuestas: list):
        self.completions = FakeChatCompletions(respuestas)


class FakeClient:
    def __init__(self, respuestas: list):
        self.chat = FakeChat(respuestas)


@pytest.fixture()
def fake_client(monkeypatch: pytest.MonkeyPatch):
    """Inyecta un FakeClient; el test decide las respuestas por atributo."""

    def _instalar(respuestas: list) -> FakeClient:
        client = FakeClient(respuestas)
        monkeypatch.setattr(ns, "_get_client", lambda: client)
        return client

    return _instalar


_JSON_UN_MEDICAMENTO = (
    '[{"medicamento": "Losartán", "cantidad": "2 cajas",'
    ' "alternativas": ["Losartán genérico 50mg"]}]'
)


class TestAnalizarRecipe:
    def test_exito_devuelve_medicamentos(self, fake_client):
        client = fake_client([FakeCompletionResponse(_JSON_UN_MEDICAMENTO)])
        resultado = ns._analizar_recipe_sync(b"png", "image/png")
        assert client.chat.completions.modelos_llamados == [ns._MODEL_RECIPE]
        assert resultado == [
            {
                "medicamento": "Losartán",
                "cantidad": "2 cajas",
                "alternativas": ["Losartán genérico 50mg"],
            }
        ]

    def test_respuesta_con_fence_markdown_se_parsea(self, fake_client):
        contenido = "```json\n" + _JSON_UN_MEDICAMENTO + "\n```"
        fake_client([FakeCompletionResponse(contenido)])
        resultado = ns._analizar_recipe_sync(b"png", "image/png")
        assert len(resultado) == 1

    def test_json_invalido_lanza_parsing_error(self, fake_client):
        fake_client([FakeCompletionResponse("esto no es json")])
        with pytest.raises(ns.NvidiaParsingError):
            ns._analizar_recipe_sync(b"png", "image/png")

    def test_429_lanza_quota_error(self, fake_client):
        fake_client([ErrorConStatusCode(429)])
        with pytest.raises(ns.NvidiaQuotaError):
            ns._analizar_recipe_sync(b"png", "image/png")

    def test_timeout_lanza_timeout_error(self, fake_client):
        fake_client([httpx.ReadTimeout("lento")])
        with pytest.raises(ns.NvidiaTimeoutError):
            ns._analizar_recipe_sync(b"png", "image/png")

    def test_error_no_reintentable_lanza_parsing_error(self, fake_client):
        fake_client([ValueError("boom")])
        with pytest.raises(ns.NvidiaParsingError):
            ns._analizar_recipe_sync(b"png", "image/png")

    def test_items_sin_medicamento_se_filtran(self, fake_client):
        fake_client(
            [
                FakeCompletionResponse(
                    '[{"medicamento": "Losartán", "cantidad": "", "alternativas": []},'
                    ' {"cantidad": "2 cajas", "alternativas": []}]'
                )
            ]
        )
        resultado = ns._analizar_recipe_sync(b"png", "image/png")
        assert len(resultado) == 1
        assert resultado[0]["medicamento"] == "Losartán"

    @pytest.mark.asyncio
    async def test_analizar_recipe_async_delega_a_sync(self, fake_client):
        fake_client([FakeCompletionResponse(_JSON_UN_MEDICAMENTO)])
        resultado = await ns.analizar_recipe(b"png", "image/png")
        assert len(resultado) == 1
```

- [ ] **Step 2: Correr los tests para confirmar que fallan**

Run: `python -m pytest tests/test_nvidia_service.py -v`
Expected: FAIL con `ModuleNotFoundError: No module named 'dosisya.services.nvidia_service'`

- [ ] **Step 3: Crear `src/dosisya/services/nvidia_service.py`**

```python
"""
DosisYa — Servicio de IA con NVIDIA NIM (SDK openai, endpoint compatible)

Respaldo de gemini_service.py: mismo consumidor B2C (escáner de récipe),
pero contra NVIDIA Nemotron Nano 12B v2 VL vía el endpoint OpenAI-compatible
de NVIDIA NIM (https://integrate.api.nvidia.com/v1). Solo lo invoca
ia_orchestrator.py, y solo si Gemini falla — nunca directamente desde un
router.

Diseño:
  - Un solo modelo, sin retry interno entre 2 modelos (a diferencia de
    Gemini) — NVIDIA YA ES el respaldo del respaldo.
  - Prompts y validación compartidos con Gemini vía ia_prompts.py — la
    REGLA MÉDICA vive en un solo lugar.
  - No se usa response_format={"type":"json_object"} (algunos NIM exigen
    JSON *objeto*, no *arreglo*, y nuestro contrato es un arreglo) — se
    confía en la instrucción "Devuelve SOLO el JSON" del prompt + un parser
    tolerante que descarta fences de markdown si aparecen.

Configuración:
  - NVIDIA_API_KEY: variable de entorno requerida (RuntimeError si falta).
  - NVIDIA_BASE_URL: default https://integrate.api.nvidia.com/v1
  - NVIDIA_MODEL_RECIPE: default "nvidia/nemotron-nano-12b-v2-vl"
    (confirmar slug exacto en build.nvidia.com al activar la key).
"""

from __future__ import annotations

import asyncio
import base64
import json
import logging
import os
from typing import Any

from dosisya.services.ia_prompts import PROMPT_RECIPE, validar_items_medicamento

logger = logging.getLogger(__name__)

_RECIPE_TIMEOUT_S = 25.0
_TIMEOUT_BUFFER_SECONDS = 15.0
_RECIPE_TIMEOUT_GLOBAL_S = _RECIPE_TIMEOUT_S + _TIMEOUT_BUFFER_SECONDS

_MODEL_RECIPE = os.environ.get("NVIDIA_MODEL_RECIPE", "nvidia/nemotron-nano-12b-v2-vl")


def _get_client():
    """Crea el cliente openai apuntando al endpoint NIM de NVIDIA.

    Raises:
        RuntimeError: si NVIDIA_API_KEY falta, es placeholder, o el paquete
            openai no está instalado.
    """
    api_key = os.environ.get("NVIDIA_API_KEY", "")
    if not api_key or api_key == "your-nvidia-api-key-here":
        raise RuntimeError(
            "NVIDIA_API_KEY no está configurada. "
            "Añádela en Vercel → Settings → Environment Variables."
        )
    try:
        from openai import OpenAI
    except ImportError as e:
        raise RuntimeError(
            "Paquete openai no instalado. Añade 'openai>=1.0' a pyproject.toml."
        ) from e
    base_url = os.environ.get("NVIDIA_BASE_URL", "https://integrate.api.nvidia.com/v1")
    return OpenAI(api_key=api_key, base_url=base_url)


def _clasificar_error(exc: BaseException) -> str | None:
    """Clasifica un error de NVIDIA para decidir el tipo de excepción a lanzar.

    Mismo esquema que gemini_service._clasificar_error: duck typing sobre
    `.status_code` (atributo real de openai.APIStatusError) en vez de
    isinstance, para no acoplar los tests al constructor del SDK.
    """
    status_code = getattr(exc, "status_code", None)
    if status_code == 429:
        return "quota"
    if status_code in (500, 502, 503, 504):
        return "transitorio"
    try:
        import httpx

        if isinstance(exc, httpx.TimeoutException):
            return "timeout"
    except ImportError:
        pass
    return "timeout" if isinstance(exc, TimeoutError) else None


class NvidiaParsingError(Exception):
    """Error durante el parsing/consulta a NVIDIA NIM."""


class NvidiaTimeoutError(NvidiaParsingError):
    """NVIDIA no respondió dentro del timeout configurado."""


class NvidiaQuotaError(NvidiaParsingError):
    """Cuota de NVIDIA agotada (429)."""


def _extraer_lista_json(response: Any, contexto: str, sugerencia: str) -> list[Any]:
    """Extrae el texto de la respuesta de NVIDIA, tolera fences de markdown,
    lo parsea como JSON y valida que sea una lista.

    Raises:
        NvidiaParsingError: JSON inválido o el resultado no es una lista.
    """
    raw_text = (response.choices[0].message.content or "").strip()
    if raw_text.startswith("```"):
        raw_text = raw_text.strip("`").strip()
        if raw_text.lower().startswith("json"):
            raw_text = raw_text[4:].strip()

    try:
        datos = json.loads(raw_text)
    except json.JSONDecodeError as e:
        logger.error(
            "NVIDIA devolvió JSON inválido (%s): %s\nTexto: %.500s",
            contexto, e, raw_text,
        )
        raise NvidiaParsingError(
            f"NVIDIA devolvió un JSON con formato inválido: {e}. {sugerencia}"
        ) from e

    if not isinstance(datos, list):
        raise NvidiaParsingError(
            f"NVIDIA devolvió {type(datos).__name__} en lugar de una lista. {sugerencia}"
        )
    return datos


def _analizar_recipe_sync(imagen_bytes: bytes, mime_type: str) -> list[dict[str, Any]]:
    """Versión síncrona del escáner de récipe contra NVIDIA — un solo intento.

    Raises:
        NvidiaParsingError: API falla de forma no reintentable o JSON inválido.
        NvidiaQuotaError: cuota agotada (429).
        NvidiaTimeoutError: el RPC excedió su deadline.
        RuntimeError: NVIDIA_API_KEY no configurada.
    """
    client = _get_client()
    b64 = base64.b64encode(imagen_bytes).decode("ascii")

    try:
        response = client.chat.completions.create(
            model=_MODEL_RECIPE,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": PROMPT_RECIPE},
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
    resultado = validar_items_medicamento(medicamentos)
    logger.info(
        "NVIDIA extrajo %d medicamentos válidos de %d items totales (récipe).",
        len(resultado), len(medicamentos),
    )
    return resultado


async def analizar_recipe(imagen_bytes: bytes, mime_type: str) -> list[dict[str, Any]]:
    """Función asíncrona: analiza la imagen de un récipe con NVIDIA Nemotron.

    Delega el trabajo síncrono a un thread pool con asyncio.to_thread.

    Raises:
        NvidiaParsingError, NvidiaQuotaError, NvidiaTimeoutError, RuntimeError.
    """
    try:
        return await asyncio.wait_for(
            asyncio.to_thread(_analizar_recipe_sync, imagen_bytes, mime_type),
            timeout=_RECIPE_TIMEOUT_GLOBAL_S,
        )
    except asyncio.TimeoutError as e:
        logger.warning(
            "analizar_recipe (NVIDIA) abortado por techo global (%.0fs).",
            _RECIPE_TIMEOUT_GLOBAL_S,
        )
        raise NvidiaTimeoutError(
            "El procesamiento con IA tardó demasiado. Intenta de nuevo en un momento."
        ) from e
```

- [ ] **Step 4: Correr los tests, deben pasar**

Run: `python -m pytest tests/test_nvidia_service.py -v`
Expected: PASS (todos los tests de récipe + get_client + clasificar_error)

- [ ] **Step 5: Commit**

```bash
git add src/dosisya/services/nvidia_service.py tests/test_nvidia_service.py
git commit -m "feat(ia): nvidia_service — escáner de récipe contra NVIDIA NIM

Cliente openai, clasificación de errores (mismo patrón duck-typed que
Gemini) y analizar_recipe() usando los prompts/validación compartidos de
ia_prompts.py. Aún no se invoca desde ningún router — eso es Task 6."
```

---

### Task 5: `nvidia_service.py` — parser de inventario

**Files:**
- Modify: `src/dosisya/services/nvidia_service.py`
- Modify: `tests/test_nvidia_service.py`

**Interfaces:**
- Consumes: `ia_prompts.PROMPT_SISTEMA`, `ia_prompts.validar_items_inventario`.
- Produces: `async def parsear_inventario(csv_text: str) -> list[dict[str, Any]]`.

- [ ] **Step 1: Añadir los tests (fallan: `parsear_inventario` no existe)**

Al final de `tests/test_nvidia_service.py`, agregar:

```python
_JSON_INVENTARIO = (
    '[{"principio_activo": "Paracetamol", "marca_comercial": "Atamel",'
    ' "presentacion": "Tabletas 500mg x 10", "precio_usd": 2.5}]'
)


class TestParsearInventario:
    def test_exito_devuelve_medicamentos(self, fake_client):
        client = fake_client([FakeCompletionResponse(_JSON_INVENTARIO)])
        resultado = ns._parsear_inventario_sync("producto,precio\nAtamel 500mg,2.5")
        assert client.chat.completions.modelos_llamados == [ns._MODEL_INVENTARIO]
        assert resultado == [
            {
                "principio_activo": "Paracetamol",
                "marca_comercial": "Atamel",
                "presentacion": "Tabletas 500mg x 10",
                "precio_usd": 2.5,
            }
        ]

    def test_archivo_vacio_lanza_parsing_error(self):
        with pytest.raises(ns.NvidiaParsingError):
            ns._parsear_inventario_sync("   ")

    def test_timeout_lanza_timeout_error(self, fake_client):
        fake_client([httpx.ReadTimeout("lento")])
        with pytest.raises(ns.NvidiaTimeoutError):
            ns._parsear_inventario_sync("producto,precio\nAtamel,2.5")

    @pytest.mark.asyncio
    async def test_parsear_inventario_async_delega_a_sync(self, fake_client):
        fake_client([FakeCompletionResponse(_JSON_INVENTARIO)])
        resultado = await ns.parsear_inventario("producto,precio\nAtamel 500mg,2.5")
        assert len(resultado) == 1
```

- [ ] **Step 2: Correr los tests para confirmar que fallan**

Run: `python -m pytest tests/test_nvidia_service.py -v -k Inventario`
Expected: FAIL con `AttributeError: module 'dosisya.services.nvidia_service' has no attribute '_parsear_inventario_sync'`

- [ ] **Step 3: Agregar `_parsear_inventario_sync` y `parsear_inventario` a `nvidia_service.py`**

En `src/dosisya/services/nvidia_service.py`, actualizar el import de
`ia_prompts` (Step 1 de Task 4 solo trajo `PROMPT_RECIPE` y
`validar_items_medicamento`):

Buscar:

```python
from dosisya.services.ia_prompts import PROMPT_RECIPE, validar_items_medicamento
```

Reemplazar por:

```python
from dosisya.services.ia_prompts import (
    PROMPT_RECIPE,
    PROMPT_SISTEMA,
    validar_items_inventario,
    validar_items_medicamento,
)
```

Agregar la constante de modelo/timeout de inventario junto a las existentes.
Buscar:

```python
_MODEL_RECIPE = os.environ.get("NVIDIA_MODEL_RECIPE", "nvidia/nemotron-nano-12b-v2-vl")
```

Reemplazar por:

```python
_MODEL_RECIPE = os.environ.get("NVIDIA_MODEL_RECIPE", "nvidia/nemotron-nano-12b-v2-vl")
_MODEL_INVENTARIO = os.environ.get(
    "NVIDIA_MODEL_INVENTARIO", "nvidia/nemotron-nano-12b-v2-vl"
)
_INVENTARIO_TIMEOUT_S = 30.0
_INVENTARIO_TIMEOUT_GLOBAL_S = _INVENTARIO_TIMEOUT_S + _TIMEOUT_BUFFER_SECONDS

LIMITE_CHARS_NVIDIA = 50_000
```

Al final del archivo (después de `async def analizar_recipe(...)`), agregar:

```python


def _parsear_inventario_sync(csv_text: str) -> list[dict[str, Any]]:
    """Versión síncrona del parser de inventario contra NVIDIA — un intento.

    Raises:
        NvidiaParsingError: API falla o JSON inválido.
        NvidiaQuotaError: cuota agotada (429).
        NvidiaTimeoutError: el RPC excedió su deadline.
        RuntimeError: NVIDIA_API_KEY no configurada.
    """
    if not csv_text or not csv_text.strip():
        raise NvidiaParsingError("El archivo está vacío o no contiene datos válidos.")

    texto_truncado = csv_text[:LIMITE_CHARS_NVIDIA]
    if len(csv_text) > LIMITE_CHARS_NVIDIA:
        logger.warning(
            "Archivo de inventario truncado de %d a %d chars para NVIDIA.",
            len(csv_text), LIMITE_CHARS_NVIDIA,
        )

    client = _get_client()
    try:
        response = client.chat.completions.create(
            model=_MODEL_INVENTARIO,
            messages=[
                {"role": "user", "content": PROMPT_SISTEMA + "\n" + texto_truncado}
            ],
            temperature=0.1,
            max_tokens=8192,
            timeout=_INVENTARIO_TIMEOUT_S,
        )
    except Exception as e:
        clase = _clasificar_error(e)
        if clase == "timeout":
            raise NvidiaTimeoutError(
                f"El servicio de IA tardó más de {_INVENTARIO_TIMEOUT_S:.0f}s "
                "en responder. Intenta de nuevo en un momento."
            ) from e
        if clase == "quota":
            raise NvidiaQuotaError(
                "Hay mucha demanda en este momento. Intenta de nuevo en un minuto."
            ) from e
        logger.error("Error llamando a NVIDIA API: %s", e)
        raise NvidiaParsingError(f"Error al consultar NVIDIA API: {e}") from e

    medicamentos = _extraer_lista_json(
        response, contexto="inventario", sugerencia="Verifica el formato del archivo."
    )
    resultado = validar_items_inventario(medicamentos)
    logger.info(
        "NVIDIA parseó %d medicamentos válidos de %d items totales.",
        len(resultado), len(medicamentos),
    )
    return resultado


async def parsear_inventario(csv_text: str) -> list[dict[str, Any]]:
    """Función asíncrona: parsea el CSV con NVIDIA sin bloquear el event loop."""
    try:
        return await asyncio.wait_for(
            asyncio.to_thread(_parsear_inventario_sync, csv_text),
            timeout=_INVENTARIO_TIMEOUT_GLOBAL_S,
        )
    except asyncio.TimeoutError as e:
        logger.warning(
            "parsear_inventario (NVIDIA) abortado por techo global (%.0fs).",
            _INVENTARIO_TIMEOUT_GLOBAL_S,
        )
        raise NvidiaTimeoutError(
            "El procesamiento con IA tardó demasiado. Intenta de nuevo en un momento."
        ) from e
```

- [ ] **Step 4: Correr toda la suite de nvidia_service, debe pasar**

Run: `python -m pytest tests/test_nvidia_service.py -v`
Expected: PASS (todos los tests, récipe + inventario)

- [ ] **Step 5: `ruff check`**

Run: `ruff check src/dosisya/services/nvidia_service.py tests/test_nvidia_service.py`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add src/dosisya/services/nvidia_service.py tests/test_nvidia_service.py
git commit -m "feat(ia): nvidia_service — parser de inventario B2B contra NVIDIA NIM

Mismo patrón que analizar_recipe: un intento, sin retry interno, prompts
y validación compartidos con Gemini vía ia_prompts.py."
```

---

### Task 6: `ia_orchestrator.py` — fallback del escáner de récipe

**Files:**
- Create: `src/dosisya/services/ia_orchestrator.py`
- Test: `tests/test_ia_orchestrator.py`

**Interfaces:**
- Consumes: `gemini_service.analizar_recipe`, `gemini_service.GeminiParsingError`,
  `nvidia_service.analizar_recipe`, `nvidia_service.NvidiaParsingError`,
  `nvidia_service.NvidiaQuotaError`, `nvidia_service.NvidiaTimeoutError`.
- Produces: `IAParsingError`, `IAQuotaError(IAParsingError)`,
  `IATimeoutError(IAParsingError)`,
  `async def analizar_recipe(imagen_bytes: bytes, mime_type: str) -> list[dict[str, Any]]`.

- [ ] **Step 1: Escribir los tests (fallan: el módulo no existe)**

Crear `tests/test_ia_orchestrator.py`:

```python
"""
DosisYa — Tests del orquestador de IA: Gemini primero, NVIDIA como respaldo
automático si Gemini falla por cualquier motivo.

gemini_service y nvidia_service se mockean por separado vía monkeypatch —
nunca se llama a ninguna API real.
"""

from __future__ import annotations

import pytest

from dosisya.services import gemini_service, ia_orchestrator, nvidia_service

_MEDICAMENTOS_GEMINI = [{"medicamento": "Losartán", "cantidad": "2 cajas", "alternativas": []}]
_MEDICAMENTOS_NVIDIA = [{"medicamento": "Paracetamol", "cantidad": "1 caja", "alternativas": []}]


class TestAnalizarRecipeOrchestrator:
    @pytest.mark.asyncio
    async def test_gemini_exitoso_nvidia_nunca_se_llama(self, monkeypatch: pytest.MonkeyPatch):
        async def fake_gemini(imagen_bytes, mime_type):
            return _MEDICAMENTOS_GEMINI

        async def fake_nvidia(imagen_bytes, mime_type):
            raise AssertionError("NVIDIA no debía llamarse si Gemini tuvo éxito")

        monkeypatch.setattr(gemini_service, "analizar_recipe", fake_gemini)
        monkeypatch.setattr(nvidia_service, "analizar_recipe", fake_nvidia)

        resultado = await ia_orchestrator.analizar_recipe(b"png", "image/png")
        assert resultado == _MEDICAMENTOS_GEMINI

    @pytest.mark.asyncio
    async def test_gemini_falla_nvidia_responde_bien(self, monkeypatch: pytest.MonkeyPatch):
        async def fake_gemini(imagen_bytes, mime_type):
            raise gemini_service.GeminiParsingError("Gemini rotó de modelo otra vez")

        async def fake_nvidia(imagen_bytes, mime_type):
            return _MEDICAMENTOS_NVIDIA

        monkeypatch.setattr(gemini_service, "analizar_recipe", fake_gemini)
        monkeypatch.setattr(nvidia_service, "analizar_recipe", fake_nvidia)

        resultado = await ia_orchestrator.analizar_recipe(b"png", "image/png")
        assert resultado == _MEDICAMENTOS_NVIDIA

    @pytest.mark.asyncio
    async def test_gemini_api_key_ausente_tambien_dispara_nvidia(
        self, monkeypatch: pytest.MonkeyPatch
    ):
        async def fake_gemini(imagen_bytes, mime_type):
            raise RuntimeError("GEMINI_API_KEY no está configurada.")

        async def fake_nvidia(imagen_bytes, mime_type):
            return _MEDICAMENTOS_NVIDIA

        monkeypatch.setattr(gemini_service, "analizar_recipe", fake_gemini)
        monkeypatch.setattr(nvidia_service, "analizar_recipe", fake_nvidia)

        resultado = await ia_orchestrator.analizar_recipe(b"png", "image/png")
        assert resultado == _MEDICAMENTOS_NVIDIA

    @pytest.mark.asyncio
    async def test_ambos_fallan_lanza_ia_parsing_error(self, monkeypatch: pytest.MonkeyPatch):
        async def fake_gemini(imagen_bytes, mime_type):
            raise gemini_service.GeminiParsingError("gemini caído")

        async def fake_nvidia(imagen_bytes, mime_type):
            raise nvidia_service.NvidiaParsingError("nvidia también caído")

        monkeypatch.setattr(gemini_service, "analizar_recipe", fake_gemini)
        monkeypatch.setattr(nvidia_service, "analizar_recipe", fake_nvidia)

        with pytest.raises(ia_orchestrator.IAParsingError, match="nvidia también caído"):
            await ia_orchestrator.analizar_recipe(b"png", "image/png")

    @pytest.mark.asyncio
    async def test_ambos_fallan_nvidia_con_quota_lanza_ia_quota_error(
        self, monkeypatch: pytest.MonkeyPatch
    ):
        async def fake_gemini(imagen_bytes, mime_type):
            raise gemini_service.GeminiParsingError("gemini caído")

        async def fake_nvidia(imagen_bytes, mime_type):
            raise nvidia_service.NvidiaQuotaError("nvidia sin cuota")

        monkeypatch.setattr(gemini_service, "analizar_recipe", fake_gemini)
        monkeypatch.setattr(nvidia_service, "analizar_recipe", fake_nvidia)

        with pytest.raises(ia_orchestrator.IAQuotaError):
            await ia_orchestrator.analizar_recipe(b"png", "image/png")

    @pytest.mark.asyncio
    async def test_ambos_fallan_nvidia_con_timeout_lanza_ia_timeout_error(
        self, monkeypatch: pytest.MonkeyPatch
    ):
        async def fake_gemini(imagen_bytes, mime_type):
            raise gemini_service.GeminiTimeoutError("gemini lento")

        async def fake_nvidia(imagen_bytes, mime_type):
            raise nvidia_service.NvidiaTimeoutError("nvidia también lento")

        monkeypatch.setattr(gemini_service, "analizar_recipe", fake_gemini)
        monkeypatch.setattr(nvidia_service, "analizar_recipe", fake_nvidia)

        with pytest.raises(ia_orchestrator.IATimeoutError):
            await ia_orchestrator.analizar_recipe(b"png", "image/png")

    @pytest.mark.asyncio
    async def test_nvidia_sin_configurar_no_revienta_cae_a_error_unificado(
        self, monkeypatch: pytest.MonkeyPatch
    ):
        """Simula el estado actual (sin NVIDIA_API_KEY): el comportamiento
        observable debe ser idéntico al de hoy (Gemini-only)."""

        async def fake_gemini(imagen_bytes, mime_type):
            raise gemini_service.GeminiParsingError("gemini caído")

        async def fake_nvidia(imagen_bytes, mime_type):
            raise RuntimeError("NVIDIA_API_KEY no está configurada.")

        monkeypatch.setattr(gemini_service, "analizar_recipe", fake_gemini)
        monkeypatch.setattr(nvidia_service, "analizar_recipe", fake_nvidia)

        with pytest.raises(ia_orchestrator.IAParsingError):
            await ia_orchestrator.analizar_recipe(b"png", "image/png")

    def test_ia_quota_error_es_subclase_de_ia_parsing_error(self):
        assert issubclass(ia_orchestrator.IAQuotaError, ia_orchestrator.IAParsingError)

    def test_ia_timeout_error_es_subclase_de_ia_parsing_error(self):
        assert issubclass(ia_orchestrator.IATimeoutError, ia_orchestrator.IAParsingError)
```

- [ ] **Step 2: Correr los tests para confirmar que fallan**

Run: `python -m pytest tests/test_ia_orchestrator.py -v`
Expected: FAIL con `ModuleNotFoundError: No module named 'dosisya.services.ia_orchestrator'`

- [ ] **Step 3: Crear `src/dosisya/services/ia_orchestrator.py`**

```python
"""
DosisYa — Orquestador de IA: único punto de entrada para los routers.

Intenta Gemini primero (gemini_service.py); si falla por CUALQUIER motivo
(cuota, timeout, error no reintentable, o incluso GEMINI_API_KEY mal
configurada), intenta NVIDIA (nvidia_service.py) antes de rendirse. No se
enumeran tipos de excepción de Gemini — cualquier fallo dispara el
respaldo, para no dejar un hueco si Gemini falla de una forma nueva que no
anticipamos (motivado por el incidente de rotación de modelo del
2026-07-23, ver docs/superpowers/specs/2026-07-23-fallback-ia-nvidia-design.md).

Mientras NVIDIA_API_KEY no esté configurada, nvidia_service también falla
(RuntimeError) y el comportamiento observable es idéntico al actual
(Gemini-only) — seguro de desplegar antes de tener la key.

Los routers importan las excepciones de ESTE módulo (IAParsingError,
IAQuotaError, IATimeoutError), no las de gemini_service/nvidia_service —
así el contrato HTTP no depende de qué proveedor falló.
"""

from __future__ import annotations

import logging
from typing import Any

from dosisya.services import gemini_service, nvidia_service

logger = logging.getLogger(__name__)


class IAParsingError(Exception):
    """Ni Gemini ni NVIDIA pudieron procesar la solicitud."""


class IATimeoutError(IAParsingError):
    """Ni Gemini ni NVIDIA respondieron dentro de su timeout."""


class IAQuotaError(IAParsingError):
    """Ambos proveedores agotaron su cuota (429)."""


def _relanzar_unificado(e: BaseException) -> None:
    """Traduce la excepción final de NVIDIA a la jerarquía unificada.

    Se llama solo cuando NVIDIA (el último intento) también falló.
    """
    if isinstance(e, nvidia_service.NvidiaQuotaError):
        raise IAQuotaError(str(e)) from e
    if isinstance(e, nvidia_service.NvidiaTimeoutError):
        raise IATimeoutError(str(e)) from e
    raise IAParsingError(str(e)) from e


async def analizar_recipe(imagen_bytes: bytes, mime_type: str) -> list[dict[str, Any]]:
    """Analiza un récipe: Gemini primero, NVIDIA como respaldo si Gemini falla.

    Raises:
        IAParsingError, IAQuotaError, IATimeoutError: si AMBOS proveedores
            fallaron (el mensaje refleja el error de NVIDIA, el último
            intento).
    """
    try:
        return await gemini_service.analizar_recipe(imagen_bytes, mime_type)
    except Exception as e_gemini:
        logger.warning(
            "Gemini falló analizando récipe (%s); probando NVIDIA como respaldo.",
            e_gemini,
        )
        try:
            return await nvidia_service.analizar_recipe(imagen_bytes, mime_type)
        except Exception as e_nvidia:
            logger.error(
                "NVIDIA también falló analizando récipe (%s); ambos proveedores caídos.",
                e_nvidia,
            )
            _relanzar_unificado(e_nvidia)
            raise  # pragma: no cover — _relanzar_unificado siempre lanza
```

- [ ] **Step 4: Correr los tests, deben pasar**

Run: `python -m pytest tests/test_ia_orchestrator.py -v`
Expected: PASS (todos los tests de récipe del orquestador)

- [ ] **Step 5: Commit**

```bash
git add src/dosisya/services/ia_orchestrator.py tests/test_ia_orchestrator.py
git commit -m "feat(ia): ia_orchestrator — fallback automático a NVIDIA para récipe

Gemini primero; si falla por CUALQUIER motivo, prueba NVIDIA antes de
rendirse. Excepciones unificadas (IAParsingError/IAQuotaError/
IATimeoutError) para que los routers no dependan de qué proveedor falló.
Aún no lo usa ningún router — eso es Task 8."
```

---

### Task 7: `ia_orchestrator.py` — fallback del parser de inventario

**Files:**
- Modify: `src/dosisya/services/ia_orchestrator.py`
- Modify: `tests/test_ia_orchestrator.py`

**Interfaces:**
- Consumes: `gemini_service.parsear_inventario`, `nvidia_service.parsear_inventario`.
- Produces: `async def parsear_inventario(csv_text: str) -> list[dict[str, Any]]`.

- [ ] **Step 1: Añadir los tests (fallan: `parsear_inventario` no existe en el orquestador)**

Al final de `tests/test_ia_orchestrator.py`, agregar:

```python
_INVENTARIO_GEMINI = [
    {"principio_activo": "Losartán", "marca_comercial": "Cozaar", "presentacion": "50mg x 30", "precio_usd": 12.0}
]
_INVENTARIO_NVIDIA = [
    {"principio_activo": "Paracetamol", "marca_comercial": "Atamel", "presentacion": "500mg x 10", "precio_usd": 2.5}
]


class TestParsearInventarioOrchestrator:
    @pytest.mark.asyncio
    async def test_gemini_exitoso_nvidia_nunca_se_llama(self, monkeypatch: pytest.MonkeyPatch):
        async def fake_gemini(csv_text):
            return _INVENTARIO_GEMINI

        async def fake_nvidia(csv_text):
            raise AssertionError("NVIDIA no debía llamarse si Gemini tuvo éxito")

        monkeypatch.setattr(gemini_service, "parsear_inventario", fake_gemini)
        monkeypatch.setattr(nvidia_service, "parsear_inventario", fake_nvidia)

        resultado = await ia_orchestrator.parsear_inventario("csv,precio\nAtamel,2.5")
        assert resultado == _INVENTARIO_GEMINI

    @pytest.mark.asyncio
    async def test_gemini_falla_nvidia_responde_bien(self, monkeypatch: pytest.MonkeyPatch):
        async def fake_gemini(csv_text):
            raise gemini_service.GeminiTimeoutError("gemini lento")

        async def fake_nvidia(csv_text):
            return _INVENTARIO_NVIDIA

        monkeypatch.setattr(gemini_service, "parsear_inventario", fake_gemini)
        monkeypatch.setattr(nvidia_service, "parsear_inventario", fake_nvidia)

        resultado = await ia_orchestrator.parsear_inventario("csv,precio\nAtamel,2.5")
        assert resultado == _INVENTARIO_NVIDIA

    @pytest.mark.asyncio
    async def test_ambos_fallan_lanza_ia_parsing_error(self, monkeypatch: pytest.MonkeyPatch):
        async def fake_gemini(csv_text):
            raise gemini_service.GeminiParsingError("gemini caído")

        async def fake_nvidia(csv_text):
            raise nvidia_service.NvidiaParsingError("nvidia también caído")

        monkeypatch.setattr(gemini_service, "parsear_inventario", fake_gemini)
        monkeypatch.setattr(nvidia_service, "parsear_inventario", fake_nvidia)

        with pytest.raises(ia_orchestrator.IAParsingError):
            await ia_orchestrator.parsear_inventario("csv,precio\nAtamel,2.5")
```

- [ ] **Step 2: Correr los tests para confirmar que fallan**

Run: `python -m pytest tests/test_ia_orchestrator.py -v -k Inventario`
Expected: FAIL con `AttributeError: module 'dosisya.services.ia_orchestrator' has no attribute 'parsear_inventario'`

- [ ] **Step 3: Agregar `parsear_inventario` a `ia_orchestrator.py`**

Al final de `src/dosisya/services/ia_orchestrator.py`, agregar:

```python


async def parsear_inventario(csv_text: str) -> list[dict[str, Any]]:
    """Parsea un inventario B2B: Gemini primero, NVIDIA como respaldo.

    Raises:
        IAParsingError, IAQuotaError, IATimeoutError: si AMBOS proveedores
            fallaron.
    """
    try:
        return await gemini_service.parsear_inventario(csv_text)
    except Exception as e_gemini:
        logger.warning(
            "Gemini falló parseando inventario (%s); probando NVIDIA como respaldo.",
            e_gemini,
        )
        try:
            return await nvidia_service.parsear_inventario(csv_text)
        except Exception as e_nvidia:
            logger.error(
                "NVIDIA también falló parseando inventario (%s); ambos proveedores caídos.",
                e_nvidia,
            )
            _relanzar_unificado(e_nvidia)
            raise  # pragma: no cover — _relanzar_unificado siempre lanza
```

- [ ] **Step 4: Correr toda la suite del orquestador, debe pasar**

Run: `python -m pytest tests/test_ia_orchestrator.py -v`
Expected: PASS (récipe + inventario)

- [ ] **Step 5: `ruff check`**

Run: `ruff check src/dosisya/services/ia_orchestrator.py tests/test_ia_orchestrator.py`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add src/dosisya/services/ia_orchestrator.py tests/test_ia_orchestrator.py
git commit -m "feat(ia): ia_orchestrator — fallback automático a NVIDIA para inventario

Mismo patrón que analizar_recipe: Gemini primero, NVIDIA si falla,
excepciones unificadas."
```

---

### Task 8: Rewire `routers/ia.py` al orquestador

**Files:**
- Modify: `src/dosisya/routers/ia.py`
- Modify: `tests/test_ia_router.py`

- [ ] **Step 1: Actualizar el import en `routers/ia.py`**

Buscar (cerca del inicio del archivo):

```python
from dosisya.services.gemini_service import (
    GeminiParsingError,
    GeminiQuotaError,
    GeminiTimeoutError,
    analizar_recipe,
)
```

Reemplazar por:

```python
from dosisya.services.ia_orchestrator import (
    IAParsingError,
    IAQuotaError,
    IATimeoutError,
    analizar_recipe,
)
```

- [ ] **Step 2: Actualizar los `except` del endpoint**

Buscar, dentro de `analizar_recipe_endpoint`:

```python
    try:
        medicamentos = await analizar_recipe(imagen_bytes, mime_type)
    except GeminiTimeoutError as e:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail=str(e),
        ) from e
    except GeminiQuotaError as e:
        # Cuota del free tier agotada en ambos modelos: transitorio, que el
        # paciente reintente en un momento — NO es un récipe ilegible.
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(e),
        ) from e
    except GeminiParsingError:
        # Récipe ilegible / JSON inválido: no es un error de servidor, es un
        # resultado esperado del flujo B2C — 200 con envelope de error.
        return RespuestaEstructurada(
            status="error",
            message=_MENSAJE_ILEGIBLE,
            data=None,
        )
    except RuntimeError as e:
        # GEMINI_API_KEY no configurada
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        ) from e
```

Reemplazar por:

```python
    try:
        medicamentos = await analizar_recipe(imagen_bytes, mime_type)
    except IATimeoutError as e:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail=str(e),
        ) from e
    except IAQuotaError as e:
        # Cuota agotada en Gemini Y en NVIDIA: transitorio, que el paciente
        # reintente en un momento — NO es un récipe ilegible.
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(e),
        ) from e
    except IAParsingError:
        # Récipe ilegible / ambos proveedores fallaron: no es un error de
        # servidor, es un resultado esperado del flujo B2C — 200 con
        # envelope de error.
        return RespuestaEstructurada(
            status="error",
            message=_MENSAJE_ILEGIBLE,
            data=None,
        )
    except RuntimeError as e:
        # Ni GEMINI_API_KEY ni NVIDIA_API_KEY configuradas (caso extremo:
        # ninguno de los dos proveedores tiene credenciales).
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        ) from e
```

- [ ] **Step 3: Actualizar `tests/test_ia_router.py` para usar las excepciones del orquestador**

Buscar:

```python
from dosisya.services.gemini_service import (
    GeminiParsingError,
    GeminiQuotaError,
    GeminiTimeoutError,
)
```

Reemplazar por:

```python
from dosisya.services.ia_orchestrator import (
    IAParsingError,
    IAQuotaError,
    IATimeoutError,
)
```

En el resto del archivo, reemplazar cada uso de `GeminiTimeoutError` por
`IATimeoutError`, `GeminiQuotaError` por `IAQuotaError`, y `GeminiParsingError`
por `IAParsingError` (son 4 apariciones en total, una por test en
`TestErroresGemini`). El resto del test (mocks de
`dosisya.routers.ia.analizar_recipe`, aserciones de status code) no cambia.

- [ ] **Step 4: Correr el test del router**

Run: `python -m pytest tests/test_ia_router.py -v`
Expected: PASS (todos los tests, mismos códigos de estado que antes)

- [ ] **Step 5: `ruff check`**

Run: `ruff check src/dosisya/routers/ia.py tests/test_ia_router.py`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add src/dosisya/routers/ia.py tests/test_ia_router.py
git commit -m "feat(ia): router de récipe usa ia_orchestrator (Gemini + respaldo NVIDIA)

Mismo contrato HTTP de siempre — el frontend no necesita cambios. Los
except ahora capturan las excepciones unificadas del orquestador en vez
de las de gemini_service directamente."
```

---

### Task 9: Rewire `routers/farmacias.py` al orquestador + test de cobertura

**Files:**
- Modify: `src/dosisya/routers/farmacias.py`
- Create: `tests/test_farmacias_inventario_router.py`

- [ ] **Step 1: Actualizar el import en `routers/farmacias.py`**

Buscar (dentro del bloque de imports, cerca de la línea 47):

```python
from dosisya.services.gemini_service import (
    GeminiParsingError,
    GeminiTimeoutError,
    parsear_inventario,
)
```

Reemplazar por:

```python
from dosisya.services.ia_orchestrator import (
    IAParsingError,
    IATimeoutError,
    parsear_inventario,
)
```

- [ ] **Step 2: Actualizar los `except` del endpoint de upload**

Buscar, dentro de `upload_inventario`:

```python
    try:
        medicamentos = await parsear_inventario(csv_text)
    except GeminiTimeoutError as e:
        # El servicio de IA tardó demasiado — no es culpa del archivo.
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail=str(e),
        ) from e
    except GeminiParsingError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Error al procesar el archivo con IA: {e}",
        ) from e
    except RuntimeError as e:
        # GEMINI_API_KEY no configurada
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        ) from e
```

Reemplazar por:

```python
    try:
        medicamentos = await parsear_inventario(csv_text)
    except IATimeoutError as e:
        # Ni Gemini ni NVIDIA respondieron a tiempo — no es culpa del archivo.
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail=str(e),
        ) from e
    except IAParsingError as e:
        # Cubre también cuota agotada en ambos proveedores (IAQuotaError es
        # subclase de IAParsingError) — mismo comportamiento que antes.
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Error al procesar el archivo con IA: {e}",
        ) from e
    except RuntimeError as e:
        # Ni GEMINI_API_KEY ni NVIDIA_API_KEY configuradas.
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        ) from e
```

- [ ] **Step 3: Crear un test de cobertura para el mapeo de errores de este endpoint**

No existía ningún test para `upload_inventario` antes de este plan. Como
este task cambia directamente qué excepciones captura, se agrega cobertura
mínima del mapeo de errores (no de todo el endpoint — el resto, como el
parseo de CSV/Excel con pandas y el UPSERT en BD, queda fuera de alcance de
este plan).

Crear `tests/test_farmacias_inventario_router.py`:

```python
"""
DosisYa — Tests del mapeo de errores de IA en
POST /api/v1/farmacias/{id}/inventario/upload.

Cubre específicamente que el router traduce las excepciones de
ia_orchestrator a los códigos HTTP correctos — no repite la cobertura de
parseo de CSV/Excel ni de UPSERT en BD, que están fuera de alcance de este
cambio. IA y BD se mockean vía monkeypatch; la auth se mockea con
app.dependency_overrides (mismo patrón que tests/test_farmacias_config.py).
"""

from __future__ import annotations

import io

import pytest
from fastapi.testclient import TestClient

from dosisya.main import app
from dosisya.security import verify_token
from dosisya.services import ia_orchestrator

client = TestClient(app)

FARMACIA_ID = "11111111-1111-1111-1111-111111111111"
ENDPOINT = f"/api/v1/farmacias/{FARMACIA_ID}/inventario/upload"


def _archivo_csv() -> dict:
    contenido = b"principio_activo,presentacion,precio_usd\nParacetamol,Tabletas 500mg x 10,2.5\n"
    return {"file": ("inventario.csv", io.BytesIO(contenido), "text/csv")}


@pytest.fixture(autouse=True)
def _auth_como_farmacia():
    """Override de verify_token: token de la propia farmacia (rol admin_farmacia)."""
    app.dependency_overrides[verify_token] = lambda: {
        "sub": FARMACIA_ID,
        "rol": "admin_farmacia",
    }
    yield
    app.dependency_overrides.pop(verify_token, None)


@pytest.fixture(autouse=True)
def _mockear_upsert(monkeypatch: pytest.MonkeyPatch):
    """Evita que el test llegue a tocar una base de datos real — solo nos
    interesa el mapeo de errores de IA, que ocurre ANTES del UPSERT."""

    async def fake_upsert(farmacia_id: str, medicamentos: list):
        return medicamentos

    monkeypatch.setattr(
        "dosisya.routers.farmacias.upsert_inventario_lote", fake_upsert
    )


class TestMapeoErroresIA:
    def test_timeout_devuelve_504(self, monkeypatch: pytest.MonkeyPatch):
        async def fake_parsear(csv_text: str):
            raise ia_orchestrator.IATimeoutError("Ni Gemini ni NVIDIA respondieron a tiempo.")

        monkeypatch.setattr(
            "dosisya.routers.farmacias.parsear_inventario", fake_parsear
        )

        resp = client.post(ENDPOINT, files=_archivo_csv())
        assert resp.status_code == 504

    def test_parsing_error_devuelve_422(self, monkeypatch: pytest.MonkeyPatch):
        async def fake_parsear(csv_text: str):
            raise ia_orchestrator.IAParsingError("Ambos proveedores fallaron.")

        monkeypatch.setattr(
            "dosisya.routers.farmacias.parsear_inventario", fake_parsear
        )

        resp = client.post(ENDPOINT, files=_archivo_csv())
        assert resp.status_code == 422

    def test_quota_error_tambien_devuelve_422(self, monkeypatch: pytest.MonkeyPatch):
        """IAQuotaError es subclase de IAParsingError — debe caer en el
        mismo except (comportamiento ya existente, preservado)."""

        async def fake_parsear(csv_text: str):
            raise ia_orchestrator.IAQuotaError("Cuota agotada en ambos proveedores.")

        monkeypatch.setattr(
            "dosisya.routers.farmacias.parsear_inventario", fake_parsear
        )

        resp = client.post(ENDPOINT, files=_archivo_csv())
        assert resp.status_code == 422

    def test_api_key_ausente_devuelve_500(self, monkeypatch: pytest.MonkeyPatch):
        async def fake_parsear(csv_text: str):
            raise RuntimeError("GEMINI_API_KEY no está configurada.")

        monkeypatch.setattr(
            "dosisya.routers.farmacias.parsear_inventario", fake_parsear
        )

        resp = client.post(ENDPOINT, files=_archivo_csv())
        assert resp.status_code == 500

    def test_exito_devuelve_200(self, monkeypatch: pytest.MonkeyPatch):
        async def fake_parsear(csv_text: str):
            return [
                {
                    "principio_activo": "Paracetamol",
                    "marca_comercial": "",
                    "presentacion": "Tabletas 500mg x 10",
                    "precio_usd": 2.5,
                }
            ]

        monkeypatch.setattr(
            "dosisya.routers.farmacias.parsear_inventario", fake_parsear
        )

        resp = client.post(ENDPOINT, files=_archivo_csv())
        assert resp.status_code == 200
```

- [ ] **Step 4: Correr el test nuevo**

Run: `python -m pytest tests/test_farmacias_inventario_router.py -v`
Expected: PASS (5 tests). Si falla por el helper de JWT, ajustar el Step 3
según la nota de arriba y volver a correr.

- [ ] **Step 5: Correr toda la suite de farmacias para confirmar que no se rompió nada más**

Run: `python -m pytest tests/test_farmacias_config.py tests/test_farmacias_inventario_router.py -v`
Expected: PASS

- [ ] **Step 6: `ruff check`**

Run: `ruff check src/dosisya/routers/farmacias.py tests/test_farmacias_inventario_router.py`
Expected: sin errores.

- [ ] **Step 7: Commit**

```bash
git add src/dosisya/routers/farmacias.py tests/test_farmacias_inventario_router.py
git commit -m "feat(ia): router de inventario B2B usa ia_orchestrator (Gemini + respaldo NVIDIA)

Mismo contrato HTTP de siempre. Se agrega cobertura de test para el
mapeo de errores de este endpoint, que no la tenía."
```

---

### Task 10: Verificación final de la suite completa

**Files:** ninguno (solo verificación).

- [ ] **Step 1: Correr toda la suite de pytest**

Run: `cd /home/josemarrufo/Escritorio/DosisYa-Backend && source .venv/bin/activate && python -m pytest -v`
Expected: PASS — todos los tests (los 93 originales + los nuevos de
`ia_prompts`, `nvidia_service`, `ia_orchestrator` y
`test_farmacias_inventario_router`).

- [ ] **Step 2: `ruff check` sobre todo el proyecto**

Run: `ruff check .`
Expected: solo los 3 warnings pre-existentes (`UP041` x2, `N818` x1, ya
documentados en Task 2) — cero errores nuevos.

- [ ] **Step 3: Confirmar que el sistema es seguro sin `NVIDIA_API_KEY`**

Run:
```bash
python -c "
import os
os.environ.pop('NVIDIA_API_KEY', None)
os.environ['GEMINI_API_KEY'] = 'fake-para-import'
from dosisya.services import nvidia_service
try:
    nvidia_service._get_client()
    print('FALLO: debería haber lanzado RuntimeError')
except RuntimeError as e:
    print('OK:', e)
"
```
Expected: `OK: NVIDIA_API_KEY no está configurada. ...`

- [ ] **Step 4: Confirmar en el log de git que todo quedó commiteado**

Run: `git status --short`
Expected: sin salida (working tree limpio).

- [ ] **Step 5: Verificar el diff completo antes de considerar el trabajo terminado**

Run: `git log --oneline -10`
Expected: ver los 8 commits de este plan (Tasks 1-9, uno de ellos es
dependencias) en orden, sobre `main`.

**No hacer push todavía** — este plan deja el trabajo listo en `main` local.
Avisar al usuario y esperar confirmación explícita antes de `git push`
(sigue el mismo patrón de autorización que ya se usó en los fixes
anteriores de esta sesión).

---

## Pendiente fuera de este plan (bloqueado en `NVIDIA_API_KEY`)

Cuando José tenga la API key de NVIDIA:
1. Agregar `NVIDIA_API_KEY` en Vercel → Settings → Environment Variables.
2. Confirmar en build.nvidia.com el slug exacto del modelo (puede no ser
   exactamente `nvidia/nemotron-nano-12b-v2-vl`) y actualizar
   `NVIDIA_MODEL_RECIPE`/`NVIDIA_MODEL_INVENTARIO` en Vercel si difiere.
3. Probar manualmente `nvidia_service.analizar_recipe` contra la API real
   con una foto de récipe (checklist del spec, ítem 3).
4. Verificar en logs de producción que, con Gemini funcionando con
   normalidad, NVIDIA nunca se invoca (checklist del spec, ítem 4).
