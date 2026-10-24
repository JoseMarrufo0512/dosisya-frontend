# Fase 2 anti-fraude de leads — `lead_token` firmado + M-03 · Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** El backend firma un permiso efímero (`lead_token`) al buscar/ver detalle/escanear, y deriva de él el origen premium del lead — nunca del cliente (cierra M-03) — sin rechazar jamás un lead.

**Architecture:** JWT HS256 (reusa `security._get_secret()` + PyJWT) con claim `typ:"lead"`, emitido en 3 endpoints y verificado en `/leads/`. Comportamiento gobernado por el flag `LEAD_TOKEN_MODE ∈ {off, shadow, derive}`. El frontend captura el token de la respuesta, lo guarda junto al resultado/ítem y lo adjunta al `POST /leads/`. Sin cambios de BD ni de enum.

**Tech Stack:** Backend Python/FastAPI, PyJWT (ya dependencia), pytest (`.venv/bin/python -m pytest`, DB mockeada). Frontend React/TanStack, vitest (env `node`, sin jsdom).

**Spec:** `docs/superpowers/specs/2026-10-24-antifraude-leads-fase2-lead-token-design.md`

## Global Constraints

- **NUNCA se rechaza un lead** en ningún modo. Token ausente/inválido/vencido → el lead se registra.
- **Solo `escaner_recipe` (premium) se gatea por el token.** `busqueda` y `lista_medica` (mismo escalón de cobro base) se respetan tal cual los manda el cliente.
- `lead_token` = JWT **HS256**, claim `typ:"lead"`, reusa `security._get_secret()`. TTL **24 h** (env `LEAD_TOKEN_TTL_HOURS`, default `24`).
- Flag backend `LEAD_TOKEN_MODE` leído vía `os.environ.get("LEAD_TOKEN_MODE","off")` en tiempo de request; valores `off|shadow|derive`, **default `off`**.
- Sin cambios en `db/schema.sql` ni en el enum `origen_lead_enum`.
- `POST /api/v1/leads/` lleva **trailing slash**.
- Tocar `DosisYa-Backend` requiere OK expreso de José (CLAUDE.md §2) — ya concedido para esta fase; reconfirmar al ejecutar.
- Backend: valores de enum canónicos (`busqueda`, `lista_medica`, `escaner_recipe`), nunca alias legacy.

## Review Focus

- **Token vencido en modo `derive`** → degrada a `busqueda` y el lead se registra (NO 401/500). → Task 1 (verify) + Task 4 (endpoint).
- **JWT de auth del dashboard u otro `typ` usado como `lead_token`** → `verify_lead_token` lo rechaza (`typ≠lead`), no concede premium, no crashea. → Task 1.
- **`lead_token` malformado (string aleatorio, no-JWT)** → `verify_lead_token` retorna `None`, el lead se registra. → Task 1 + Task 4.
- **Token premium reusado para N leads** (reusable, sin nonce, por el fan-out) → permitido por diseño; ningún camino lo trata como single-use. → Task 4 + Task 8.
- **`JWT_SECRET_KEY` ausente en test/dev** → usa el secreto dev de `_get_secret()` sin crashear. → Task 1.

---

## Task 1: Módulo `lead_token` (firmar + verificar)

**Files:**
- Create: `DosisYa-Backend/src/dosisya/lead_token.py`
- Test: `DosisYa-Backend/tests/test_lead_token.py`

**Interfaces:**
- Produces:
  - `create_lead_token(origen: str, scope: str) -> str` — JWT HS256 firmado con `security._get_secret()`, claims `{typ:"lead", origen, scope, iat, exp}`, `exp = now + LEAD_TOKEN_TTL_HOURS`.
  - `verify_lead_token(token: str | None) -> dict | None` — retorna el payload si es un JWT válido, no vencido y con `typ=="lead"`; en cualquier otro caso (None, vacío, firma mala, vencido, `typ` distinto, malformado) retorna `None`. **Nunca lanza.**

- [ ] **Step 1: Write the failing tests**

```python
# test_lead_token.py
def test_roundtrip_busqueda():
    t = create_lead_token("busqueda", "buscar")
    p = verify_lead_token(t)
    assert p["origen"] == "busqueda" and p["scope"] == "buscar" and p["typ"] == "lead"

def test_roundtrip_premium():
    assert verify_lead_token(create_lead_token("escaner_recipe", "recipe"))["origen"] == "escaner_recipe"

def test_none_and_garbage_return_none():
    assert verify_lead_token(None) is None
    assert verify_lead_token("") is None
    assert verify_lead_token("no-es-un-jwt") is None

def test_bad_signature_returns_none(monkeypatch):
    t = create_lead_token("busqueda", "buscar")
    # alterar el secreto → la firma deja de validar
    monkeypatch.setenv("JWT_SECRET_KEY", "otro-secreto-distinto-de-32-caracteres!!")
    assert verify_lead_token(t) is None

def test_expired_returns_none(monkeypatch):
    monkeypatch.setenv("LEAD_TOKEN_TTL_HOURS", "-1")   # exp en el pasado
    assert verify_lead_token(create_lead_token("busqueda", "buscar")) is None

def test_auth_jwt_rejected():
    # un JWT sin typ="lead" (el de security.create_jwt_token) NO es lead_token
    from dosisya.security import create_jwt_token
    assert verify_lead_token(create_jwt_token("fid", "admin_farmacia")) is None
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `.venv/bin/python -m pytest tests/test_lead_token.py -v`
Expected: FAIL (módulo inexistente).

- [ ] **Step 3: Implement `lead_token.py`**

Reusar `from dosisya.security import _get_secret, _JWT_ALGORITHM` y `import jwt`. `create_lead_token` lee `LEAD_TOKEN_TTL_HOURS` en tiempo de invocación (default `24`, acepta negativo para tests). `verify_lead_token` envuelve `jwt.decode(..., algorithms=[_JWT_ALGORITHM])` en try/except de `jwt.InvalidTokenError` (incluye `ExpiredSignatureError`) → `None`; tras decodificar, si `payload.get("typ") != "lead"` → `None`.

- [ ] **Step 4: Run tests, verify they pass**

Run: `.venv/bin/python -m pytest tests/test_lead_token.py -v` → PASS.

- [ ] **Step 5: Commit** — `git commit -m "feat(seguridad): módulo lead_token (JWT HS256, verify fail-safe)"`

---

## Task 2: Emitir token en búsqueda y detalle

**Files:**
- Modify: `DosisYa-Backend/src/dosisya/routers/medicamentos.py` (buscar `:245`, detalle `:378`)
- Test: `DosisYa-Backend/tests/test_medicamentos_lead_token.py`

**Interfaces:**
- Consumes: `create_lead_token` (Task 1).
- Produces: `data.lead_token` (string) en ambas respuestas, con `origen="busqueda"`, `scope="buscar"` (búsqueda) / `"detalle"` (detalle).

- [ ] **Step 1: Write the failing test** — con la DB mockeada (patrón de `test_medicamentos_producto.py`), un GET a `/api/v1/medicamentos/buscar` devuelve `data.lead_token` y `verify_lead_token(data["lead_token"])["origen"] == "busqueda"` y `["scope"]=="buscar"`; ídem detalle con `scope=="detalle"`.
- [ ] **Step 2: Run, verify fail** (`lead_token` ausente en `data`).
- [ ] **Step 3: Implement** — añadir `"lead_token": create_lead_token("busqueda","buscar")` al dict `data` del `return` de `buscar_medicamentos` (`:245`) y `"...","detalle")` en `obtener_producto` (`:378`). Aditivo; no toca el resto.
- [ ] **Step 4: Run, verify pass.**
- [ ] **Step 5: Commit** — `feat(seguridad): emitir lead_token en buscar/detalle`

---

## Task 3: Emitir token premium en el scanner

**Files:**
- Modify: `DosisYa-Backend/src/dosisya/routers/ia.py` (`analizar_recipe_endpoint`, return `:197`)
- Test: `DosisYa-Backend/tests/test_ia_lead_token.py`

**Interfaces:**
- Consumes: `create_lead_token` (Task 1).
- Produces: `data.lead_token` con `origen="escaner_recipe"`, `scope="recipe"` en la respuesta exitosa del scanner.

- [ ] **Step 1: Write the failing test** — con Gemini mockeado (patrón `test_ia_router.py`), un POST exitoso a `/api/v1/ia/analizar-recipe` devuelve `data.lead_token` y `verify_lead_token(...)["origen"]=="escaner_recipe"`.
- [ ] **Step 2: Run, verify fail.**
- [ ] **Step 3: Implement** — añadir `lead_token` premium al `data` del `return` exitoso (`:197`). No tocar las ramas de error (`:175`, `:189`).
- [ ] **Step 4: Run, verify pass.**
- [ ] **Step 5: Commit** — `feat(seguridad): emitir lead_token premium en analizar-recipe`

---

## Task 4: Verificar/derivar en `/leads/` (el corazón de M-03)

**Files:**
- Modify: `DosisYa-Backend/src/dosisya/models.py` (`LeadInteraccionCreate` `:420`)
- Modify: `DosisYa-Backend/src/dosisya/routers/leads.py` (handler del POST, antes de construir `lead_completo` ~`:224`)
- Test: `DosisYa-Backend/tests/test_leads_lead_token.py`

**Interfaces:**
- Consumes: `verify_lead_token` (Task 1).
- Produces: el `origen` efectivo con que se registra el lead, según el flag.

**Lógica (gobernada por Global Constraints):** leer `modo = os.environ.get("LEAD_TOKEN_MODE","off")` y `payload = verify_lead_token(body.lead_token)`.
- `off` → ignorar el token; `origen` = el del cliente (comportamiento actual).
- `shadow` → NO cambiar el `origen`; `logger.info("LEAD-TOKEN shadow present=%s valid=%s origen_token=%s origen_cliente=%s", ...)`.
- `derive` → si el cliente pidió `escaner_recipe`: usar premium **solo si** `payload and payload["origen"]=="escaner_recipe"`, si no degradar a `busqueda`. Si pidió `busqueda`/`lista_medica`: respetar. **En ningún modo se rechaza el lead.**

- [ ] **Step 1: Write the failing tests** (DB mockeada, patrón `test_leads_router.py`):

```python
def test_mode_off_respeta_cliente(monkeypatch):
    monkeypatch.setenv("LEAD_TOKEN_MODE", "off")
    # POST origen=escaner_recipe SIN token → 201 y el lead se registra con escaner_recipe (igual que hoy)

def test_mode_shadow_no_cambia_origen(monkeypatch):
    monkeypatch.setenv("LEAD_TOKEN_MODE", "shadow")
    # POST origen=escaner_recipe sin token → 201, origen efectivo sigue escaner_recipe (shadow no degrada)

def test_mode_derive_premium_sin_token_degrada(monkeypatch):
    monkeypatch.setenv("LEAD_TOKEN_MODE", "derive")
    # POST origen=escaner_recipe SIN token → 201 y registrar_interaccion recibe origen=busqueda

def test_mode_derive_premium_con_token_valido(monkeypatch):
    monkeypatch.setenv("LEAD_TOKEN_MODE", "derive")
    # POST origen=escaner_recipe con lead_token premium válido → 201, origen=escaner_recipe

def test_mode_derive_busqueda_siempre_se_respeta(monkeypatch):
    monkeypatch.setenv("LEAD_TOKEN_MODE", "derive")
    # POST origen=busqueda sin token → 201, origen=busqueda (nunca rechaza)

def test_lead_token_malformado_no_rompe(monkeypatch):
    monkeypatch.setenv("LEAD_TOKEN_MODE", "derive")
    # POST con lead_token="basura" origen=escaner_recipe → 201, origen=busqueda
```

Assert sobre el `origen` con que se llama a `registrar_interaccion` (mock), no sobre la BD.

- [ ] **Step 2: Run, verify fail.**
- [ ] **Step 3: Implement** — añadir `lead_token: str | None = None` a `LeadInteraccionCreate` (`models.py:420`); en `leads.py`, antes de armar `lead_completo`, calcular el `origen` efectivo con la lógica de arriba y usarlo. No tocar rate-limit ni M-04.
- [ ] **Step 4: Run, verify pass** (y correr `tests/test_leads_router.py` para no regresar).
- [ ] **Step 5: Commit** — `feat(seguridad): derivar origen premium del lead_token (M-03) con flag LEAD_TOKEN_MODE`

---

## Task 5: Frontend — tipos + captura del token en búsqueda

**Files:**
- Modify: `src/lib/api.ts` (`RespuestaAPI.data` `:59`, `buscarMedicamentos` `:114`)
- Modify: `src/hooks/useBuscarMedicamentos.ts` (estado + return `:82`)
- Test: `src/lib/api.test.ts` (o el existente de api)

**Interfaces:**
- Produces: `RespuestaAPI.data.lead_token?: string`; `useBuscarMedicamentos()` retorna además `leadToken: string | null`.

- [ ] **Step 1: Write the failing test** — parsear una respuesta de búsqueda con `lead_token` y afirmar que `buscarMedicamentos` lo propaga en `data.lead_token`.
- [ ] **Step 2: Run, verify fail** (`vitest run src/lib/api.test.ts`).
- [ ] **Step 3: Implement** — añadir `lead_token?: string` al tipo `data` de `RespuestaAPI`; en `useBuscarMedicamentos` guardar `resp.data.lead_token ?? null` en estado `leadToken` y exponerlo en el return.
- [ ] **Step 4: Run, verify pass.**
- [ ] **Step 5: Commit** — `feat(seguridad): capturar lead_token de la búsqueda (frontend)`

---

## Task 6: Frontend — `postLead`/`leadsLista` adjuntan el token

**Files:**
- Modify: `src/lib/leads.ts` (`LeadPayload` `:46`, `postLead` `:83`, `registrarLead` `:130`)
- Modify: `src/lib/leadsLista.ts` (`:39`)
- Test: `src/lib/leads.test.ts`

**Interfaces:**
- Consumes: nada nuevo.
- Produces: `LeadPayload.leadToken?: string`; el body de `POST /leads/` incluye `lead_token` cuando está presente; `registrarLead(..., opts?: {..., leadToken?: string})`.

- [ ] **Step 1: Write the failing test** — `postLead({..., leadToken:"tok"})` hace `fetch` con body que contiene `lead_token:"tok"`; sin `leadToken`, el body **no** incluye la clave (o la incluye como `undefined`/omitida). Usar el mock de `fetch` existente en `leads.test.ts`.
- [ ] **Step 2: Run, verify fail.**
- [ ] **Step 3: Implement** — añadir `leadToken?` a `LeadPayload`; en `postLead` incluir `lead_token: p.leadToken` en el body solo si está definido; propagar por `registrarLead` (nuevo `opts.leadToken`) y por `leadsLista.ts` (`postLead({..., leadToken})`).
- [ ] **Step 4: Run, verify pass** (y `scripts/test-leads-cpc.sh` queda para QA manual).
- [ ] **Step 5: Commit** — `feat(seguridad): postLead adjunta lead_token (frontend)`

---

## Task 7: Frontend — cablear búsqueda y deep-link

**Files:**
- Modify: `src/components/ComparadorPanel.tsx` (`:42`), `src/components/TarjetaResultado.tsx` (`:109,:120`)
- Modify: `src/routes/producto.$farmaciaId.$medicamentoId.tsx` (cargar token del detalle + usarlo en `:119`)

**Interfaces:**
- Consumes: `leadToken` de `useBuscarMedicamentos` (Task 5); `RespuestaAPI.data.lead_token` del fetch de detalle (Task 2).
- Produces: cada `registrarLead` de estos sitios pasa `{ leadToken }`.

- [ ] **Step 1:** Pasar el `leadToken` de la búsqueda desde la vista de resultados a `ComparadorPanel`/`TarjetaResultado` (prop) y adjuntarlo en sus `registrarLead`. En `producto.$...tsx`, leer `lead_token` del JSON del detalle (`cargarProducto`/loader) y pasarlo al `registrarLead` del deep-link.
- [ ] **Step 2:** Verificación — `npx tsc --noEmit && npm run build` (el env de tests es `node` sin jsdom; estos componentes se validan por tipos + build, siguiendo el patrón del repo). Smoke manual opcional con `scripts/test-leads-cpc.sh`.
- [ ] **Step 3: Commit** — `feat(seguridad): cablear lead_token en búsqueda y deep-link`

---

## Task 8: Frontend — scanner premium + persistencia en lista médica

**Files:**
- Modify: `src/lib/recipeIA.ts` (`RespuestaRecipe` `:41`, `analizarRecipe` `:84`)
- Modify: `src/components/EscanerRecipe.tsx` (`:152,:169`)
- Modify: `src/hooks/useListaMedica.ts` (`ItemLista` `:19`, `agregarItem` `:135`)
- Modify: `src/components/lista/ListaMedicaDrawer.tsx` (`:63`), `src/components/lista/SelectorFarmacia.tsx` (`:126`)
- Test: `src/hooks/useListaMedica.test.ts` (stub de `localStorage`, ver memoria `vitest-env-node-sin-jsdom`)

**Interfaces:**
- Consumes: `data.lead_token` del scanner (Task 3); `leadToken` en `LeadPayload`/`registrarLeadLista` (Task 6).
- Produces: `RespuestaRecipe.lead_token?: string`; `ItemLista.leadToken?: string`; `registrarLeadLista(..., items: {medicamentoId, origen, leadToken?}[])` adjunta el token por ítem.

- [ ] **Step 1: Write the failing test** — `agregarItem` con `leadToken` lo persiste en `ItemLista` (round-trip por el store/localStorage stub); `claveItem` intacto.
- [ ] **Step 2: Run, verify fail.**
- [ ] **Step 3: Implement** — `recipeIA.ts`: añadir `lead_token?` a `RespuestaRecipe` y propagarlo. `EscanerRecipe.tsx`: al agregar ítems del scanner, setear `leadToken` del token premium y pasarlo al `registrarLead`/ítem. `useListaMedica`: `ItemLista.leadToken?`, `agregarItem` lo guarda. `ListaMedicaDrawer`/`SelectorFarmacia`/`leadsLista`: incluir `leadToken` por ítem en el fan-out.
- [ ] **Step 4: Run, verify pass** + `npx tsc --noEmit && npm run build`.
- [ ] **Step 5: Commit** — `feat(seguridad): lead_token premium del scanner + persistencia en lista médica`

---

## Despliegue (tras implementar — operación de José)

1. Deploy backend con `LEAD_TOKEN_MODE=off` (Fase 0, inerte) + frontend. Verificar que nada cambió.
2. `LEAD_TOKEN_MODE=shadow` (Fase A). Medir % de leads con token válido por fuente en los logs. Criterio A→B: ≥ 98 % de `escaner_recipe` con token premium válido durante 2 semanas y cero pérdida nueva en Sentry.
3. `LEAD_TOKEN_MODE=derive` (Fase B, M-03 activo). Rollback = `off`.
Fase C (rechazo duro) fuera de alcance.
