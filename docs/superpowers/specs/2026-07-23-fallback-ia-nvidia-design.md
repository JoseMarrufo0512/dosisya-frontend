# Feature: Fallback a NVIDIA Nemotron cuando Gemini falla

> Diseño aprobado el 2026-07-23. Alcance: solo backend (`DosisYa-Backend`), sin
> cambios de contrato para el frontend. Motivado por el incidente del
> 2026-07-23 (`escaner-recipe-bug-2026-07`, resuelto en commit `e4f7803`):
> Google rotó el modelo detrás de `gemini-flash-lite-latest` sin aviso y tumbó
> el escáner de récipe en producción.

## Problema

Hoy el escáner de récipe (`gemini_service.py::analizar_recipe`) y el parser de
inventario B2B (`gemini_service.py::parsear_inventario`) dependen 100% de
Gemini. Ya hubo dos incidentes de disponibilidad de modelo fuera de nuestro
control (`gemini-2.5-flash` retirado, commit `6810a28`; rotación de
`gemini-flash-lite-latest` a un modelo incompatible con `thinking_config`,
2026-07-23) que tumbaron features de cara al paciente sin que el código de
DosisYa hubiera cambiado. José quiere un segundo proveedor de IA (NVIDIA
Nemotron Nano 12B v2 VL, vía NVIDIA NIM) como respaldo automático para ambas
funciones.

## Objetivo

1. Si Gemini falla (por cualquier motivo) al analizar un récipe o parsear un
   inventario, reintentar automáticamente con NVIDIA Nemotron antes de
   devolver un error al usuario/farmacia.
2. No cambiar el contrato HTTP que ya consumen `DosisYa-Frontend` (récipe) ni
   el dashboard B2B (inventario) — mismos códigos de estado, mismo envelope
   de respuesta.
3. La REGLA MÉDICA (alternativas solo del mismo principio activo) debe regir
   para ambos proveedores desde una única fuente de verdad — no se permite
   que quede desactualizada en uno de los dos si se edita el prompt.
4. Debe poder mergearse y desplegarse ANTES de tener la API key de NVIDIA,
   sin romper ni cambiar el comportamiento actual (Gemini-only).

## Fuera de alcance

- Cambios en el frontend (el contrato no cambia).
- Un tercer proveedor o un patrón de "N proveedores" genérico — se diseña
  específicamente para 2 (Gemini primario, NVIDIA respaldo), sin
  sobre-ingeniería para casos hipotéticos futuros.
- Selección manual de proveedor por variable de entorno (fallback es siempre
  automático: Gemini primero, NVIDIA solo si Gemini falla).

## Diseño

### Estructura de archivos

```
src/dosisya/services/
  ia_prompts.py        (NUEVO)
  gemini_service.py    (MODIFICADO — sin cambios de comportamiento)
  nvidia_service.py    (NUEVO)
  ia_orchestrator.py   (NUEVO)

src/dosisya/routers/
  ia.py                (MODIFICADO — cambia el import)
  farmacias.py         (MODIFICADO — cambia el import)
```

### `ia_prompts.py` (nuevo)

Se mueven aquí, tal cual, sin editar su contenido:
- `_PROMPT_RECIPE` (incluye la REGLA MÉDICA — comentario de advertencia se
  mueve con el texto).
- `_PROMPT_SISTEMA` (prompt del parser de inventario).
- `_RECIPE_RESPONSE_SCHEMA`, `_RESPONSE_SCHEMA` (los dos JSON schemas).
- `_validar_items_medicamento(items: list) -> list[dict]` y
  `_validar_items_inventario(items: list) -> list[dict]` (NUEVO — se extraen
  del cuerpo de `_analizar_recipe_sync`/`_parsear_inventario_sync`, que hoy
  filtran items sin `medicamento`/`principio_activo` inline). Es la única
  parte de la validación que es 100% genérica entre proveedores.

`gemini_service.py` y `nvidia_service.py` importan de aquí — ninguno define
su propia copia del prompt ni de esta validación. Si mañana se edita la
regla médica o el criterio de descarte de items, se edita en un solo lugar.

**Lo que NO se comparte:** la extracción del texto JSON crudo desde la
respuesta del SDK (`response.text` en Gemini vs.
`response.choices[0].message.content` en NVIDIA/OpenAI) es inherentemente
distinta por SDK — cada servicio se queda con su propia versión de
`_extraer_lista_json`, ya que solo son ~10 líneas y no hay regla de negocio
involucrada, solo diferencia de forma del objeto respuesta.

### `gemini_service.py` (modificado)

Solo cambia el origen de los prompts/schemas (ahora importados). La lógica de
reintento entre `_MODEL_RECIPE`/`_MODEL_RECIPE_FALLBACK`, el fix de
`thinking_config` del 2026-07-23, las excepciones (`GeminiParsingError`,
`GeminiQuotaError`, `GeminiTimeoutError`) y las funciones públicas
`analizar_recipe()` / `parsear_inventario()` quedan igual. Estas excepciones
pasan a ser **internas** al módulo — los routers dejan de importarlas
directamente.

### `nvidia_service.py` (nuevo)

Mismo patrón/forma que `gemini_service.py`, pero contra NVIDIA NIM:

- Cliente: SDK `openai` (NIM expone un endpoint compatible con
  `/v1/chat/completions`), `base_url` configurable, apuntando por defecto a
  `https://integrate.api.nvidia.com/v1`.
- `_get_client()`: mismo patrón que Gemini — `RuntimeError` si
  `NVIDIA_API_KEY` no está seteada o es un placeholder.
- `analizar_recipe(imagen_bytes, mime_type)`: arma un chat completion con la
  imagen en base64 (formato `image_url` con data URI, estilo OpenAI vision) +
  `_PROMPT_RECIPE`, pide salida JSON, parsea y valida cada item con el mismo
  criterio que Gemini (descarta items sin `medicamento`).
- `parsear_inventario(csv_text)`: mismo patrón, con `_PROMPT_SISTEMA`, sin
  imagen.
- Excepciones propias: `NvidiaParsingError`, `NvidiaQuotaError`,
  `NvidiaTimeoutError` (mismo árbol que Gemini, para que el orquestador las
  trate de forma simétrica).
- Un solo modelo (no hay estrategia de 2 modelos como en Gemini): NVIDIA es
  ya el "respaldo del respaldo", no necesita su propio fallback interno.

**Riesgo abierto (a validar cuando llegue la API key):** el nombre exacto del
modelo en la API (`NVIDIA_MODEL_RECIPE`, default tentativo
`"nvidia/nemotron-nano-12b-v2-vl"`) y si el formato exacto de `response_format`
para forzar JSON coincide 1:1 con lo documentado hoy — NIM es compatible con
OpenAI pero puede haber diferencias menores en soporte de JSON mode. Se
valida en el primer test de integración manual, no bloquea el diseño.

### `ia_orchestrator.py` (nuevo)

Único punto de entrada para los routers. Dos funciones públicas, mismos
nombres/firmas que hoy tienen en `gemini_service.py` (para que el cambio en
los routers sea solo el import):

```python
async def analizar_recipe(imagen_bytes: bytes, mime_type: str) -> list[dict]: ...
async def parsear_inventario(csv_text: str) -> list[dict]: ...
```

Lógica (idéntica para ambas funciones):

1. Intenta `gemini_service.<funcion>(...)`.
2. Si Gemini devuelve resultado → se retorna tal cual. NVIDIA nunca se llama.
3. Si Gemini lanza **cualquier excepción** (no se enumeran tipos — cualquier
   fallo dispara el respaldo, incluyendo un `RuntimeError` por
   `GEMINI_API_KEY` mal configurada): se loguea como warning y se intenta
   `nvidia_service.<funcion>(...)`.
4. Si NVIDIA responde bien → se retorna su resultado.
5. Si NVIDIA también lanza cualquier excepción → se relanza como la
   excepción unificada correspondiente (ver abajo), usando el mensaje del
   error de NVIDIA (el último intento).

**Excepciones unificadas** (nuevas, viven en `ia_orchestrator.py`):

```python
class IAParsingError(Exception): ...
class IAQuotaError(IAParsingError): ...
class IATimeoutError(IAParsingError): ...
```

Los routers importan y capturan estas, no las de `gemini_service` ni
`nvidia_service`. El mapeo a HTTP (200 con envelope de error / 503 / 504 /
500) no cambia — mismo comportamiento observable de hoy.

### Routers (`ia.py`, `farmacias.py`)

Único cambio: el import pasa de
`from dosisya.services.gemini_service import (analizar_recipe, GeminiParsingError, ...)`
a
`from dosisya.services.ia_orchestrator import (analizar_recipe, IAParsingError, ...)`
(mismo patrón para `parsear_inventario`). Los `except` ya existentes solo
renombran la excepción capturada; la estructura del router no cambia.

### Comportamiento sin `NVIDIA_API_KEY` configurada

`nvidia_service._get_client()` lanza `RuntimeError` en cuanto se le llama. El
orquestador lo trata igual que cualquier otro fallo de NVIDIA (paso 5 de
arriba) — cae al mismo error unificado que ya se vería hoy si solo existiera
Gemini. **El sistema es seguro de mergear y desplegar antes de tener la key**:
cero cambio de comportamiento observable hasta que se agregue.

### Configuración (Vercel)

| Variable | Default | Notas |
|---|---|---|
| `NVIDIA_API_KEY` | *(requerida)* | Sin ella, fallback queda inactivo (ver arriba). |
| `NVIDIA_MODEL_RECIPE` | `nvidia/nemotron-nano-12b-v2-vl` | Confirmar slug exacto al activar. |
| `NVIDIA_BASE_URL` | `https://integrate.api.nvidia.com/v1` | Endpoint NIM en la nube. |

## Testing

Mismo enfoque que `tests/test_gemini_service.py` (fakes por monkeypatch,
nunca se llama a una API real):

- **`tests/test_nvidia_service.py`** (nuevo): espejo de
  `test_gemini_service.py` — `_get_client`, construcción de request, parseo y
  validación de respuesta, con un `FakeClient` que simula el SDK `openai`.
- **`tests/test_ia_orchestrator.py`** (nuevo), con `gemini_service` y
  `nvidia_service` mockeados por separado vía monkeypatch:
  - Gemini responde bien → NVIDIA nunca se llama (verificar con un mock que
    lanza `AssertionError` si se invoca).
  - Gemini falla (parametrizado sobre varios tipos de excepción, incluyendo
    `RuntimeError`) → se llama a NVIDIA → NVIDIA responde bien → resultado
    correcto.
  - Ambos fallan → se lanza `IAParsingError`/`IAQuotaError`/`IATimeoutError`
    según el tipo de fallo de NVIDIA.
  - `NVIDIA_API_KEY` ausente + Gemini falla → no revienta, cae al error
    unificado sin diferencia observable respecto al comportamiento actual.
- **`tests/test_ia_router.py`** y el test del router de farmacias: se
  actualizan los mocks para apuntar a `ia_orchestrator`; las aserciones de
  códigos HTTP y envelopes no cambian.

## Checklist de verificación antes de mergear

- [ ] `pytest` completo en verde (incluye los tests nuevos).
- [ ] `ruff check` sin errores nuevos.
- [ ] Confirmar manualmente (una vez exista `NVIDIA_API_KEY`) que
      `nvidia_service.analizar_recipe` funciona contra la API real de NVIDIA
      con una imagen de prueba, antes de considerar el fallback "operativo".
- [ ] Verificar en logs de producción que, con Gemini funcionando con
      normalidad, NVIDIA nunca se invoca (cero costo/latencia agregada en el
      camino feliz).
