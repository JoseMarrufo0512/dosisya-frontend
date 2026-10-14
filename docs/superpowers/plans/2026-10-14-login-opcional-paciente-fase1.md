# Login opcional del paciente — Fase 1 (Identidad) · Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar al paciente un login opcional sin contraseña (teléfono → código OTP de 6 dígitos por WhatsApp) que persiste una sesión JWT, sin tocar aún la Lista Médica.

**Architecture:** Backend FastAPI nuevo router `pacientes_auth` (tablas `pacientes` + `pacientes_otp`, OTP hasheado con bcrypt, JWT HS256 reutilizando `dosisya.security`, envío del código vía webhook n8n con `BackgroundTasks` + httpx). Frontend: `pacienteAuth.ts` (sesión en localStorage), `pacienteApi.ts` (cliente HTTP mismo-origen), `usePacienteSesion` (hook) y `HojaLoginPaciente.tsx` convertido en flujo real de 2 pasos.

**Tech Stack:** Backend: Python 3.12, FastAPI, asyncpg, bcrypt, PyJWT, httpx, slowapi, pytest. Frontend: React 19, TanStack Start/Router, TypeScript, Zod, vaul, sonner, vitest.

**Repos:** backend en `/home/josemarrufo/Escritorio/DosisYa-Backend`, frontend en `/home/josemarrufo/Escritorio/DosisYa-Frontend`. Spec: `docs/superpowers/specs/2026-10-14-login-opcional-paciente-fase1-design.md`.

## Global Constraints

- **Teléfono E.164**, p.ej. `+584141234567`. Normalizar SIEMPRE antes de consultar la BD.
- **OTP:** 6 dígitos · TTL 5 minutos · máx 5 intentos de verificación · cooldown 60s entre solicitudes.
- **Nunca** almacenar ni loguear el código OTP en claro (bcrypt; `webhook_errors.payload_enviado` va **sin** el código).
- **Anti-enumeración:** `solicitar-codigo` responde `{status:"success"}` 200 exista o no el teléfono; el fallo de `verificar-codigo` es 401 genérico.
- **JWT:** HS256, TTL 7 días, claim `sub`=id, `rol`, `nombre`. Reusar `dosisya.security.create_jwt_token` / `verify_token`.
- **Frontend mismo-origen:** usar `API_BASE` de `src/lib/api.ts` (es `""` en el cliente → ruta relativa proxeada; NO hardcodear el dominio del backend). Rutas `/api/v1/*`.
- **SSR-safe:** todo acceso a `localStorage`/`window` detrás de `typeof window === "undefined"` → early return.
- **Login no bloqueante:** ningún paso obliga a iniciar sesión; "Seguir sin cuenta" siempre disponible. Filosofía "Cero Fricción".
- **SQL:** parámetros posicionales `$N`. UUID por `uuid_generate_v4()` (como el schema existente).
- **Backend NO se toca sin autorización** — autorizada expresamente para esta Fase 1 (ver spec).
- **Verificación mínima frontend antes de commit:** `npx tsc --noEmit && npm run build`. Backend: `pytest`.

---

## Mapa de archivos

**Backend (`DosisYa-Backend`):**
- Crear `db/migrations/014_pacientes_auth.sql` — tablas `pacientes` + `pacientes_otp`.
- Crear `src/dosisya/routers/pacientes_auth.py` — router, modelos, helpers y 4 endpoints.
- Modificar `src/dosisya/security.py` — claim `nombre` + alias `nombre_farmacia`.
- Modificar `src/dosisya/main.py` — registrar el router.
- Crear tests: `tests/test_paciente_auth_helpers.py`, `tests/test_paciente_solicitar_codigo.py`, `tests/test_paciente_verificar_codigo.py`, `tests/test_paciente_me.py`, `tests/test_security_jwt.py`.

**Frontend (`DosisYa-Frontend`):**
- Crear `src/lib/pacienteAuth.ts` (+ `src/lib/pacienteAuth.test.ts`).
- Crear `src/lib/pacienteApi.ts` (+ `src/lib/pacienteApi.test.ts`).
- Crear `src/hooks/usePacienteSesion.ts`.
- Modificar `src/components/paciente/HojaLoginPaciente.tsx`.
- Modificar `src/App.tsx` — surface de sesión en el punto de cuenta.

---

## Task 1: Migración `014_pacientes_auth.sql`

**Files:**
- Create: `db/migrations/014_pacientes_auth.sql`

**Interfaces:**
- Produces: tablas `pacientes(id, telefono, nombre, creado_en, ultimo_acceso)` y `pacientes_otp(id, telefono, codigo_hash, expira_en, intentos, consumido_en, creado_en)`.

- [ ] **Step 1: Escribir la migración**

Create `db/migrations/014_pacientes_auth.sql`:

```sql
-- ============================================================
-- DosisYa — Migración 014: identidad del paciente (login opcional, Fase 1).
-- Ejecutar UNA SOLA VEZ contra Supabase (SQL Editor o psql).
-- Spec: docs/superpowers/specs/2026-10-14-login-opcional-paciente-fase1-design.md
--
-- Dependencia de deploy: este código de backend (router pacientes_auth) NO debe
-- desplegarse antes de aplicar esta migración, o los endpoints fallan con
-- "relation \"pacientes\" does not exist".
-- ============================================================

BEGIN;

-- Identidad del paciente. Sin password: la auth es por OTP de WhatsApp.
CREATE TABLE IF NOT EXISTS pacientes (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    telefono        TEXT        NOT NULL UNIQUE,   -- E.164, p.ej. +584141234567
    nombre          TEXT,                          -- opcional, fijable después
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
    ultimo_acceso   TIMESTAMPTZ
);

-- Códigos OTP de un solo uso. Separada de `pacientes` para poder emitir códigos
-- a teléfonos sin cuenta (el primer verify exitoso crea el paciente).
CREATE TABLE IF NOT EXISTS pacientes_otp (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    telefono        TEXT        NOT NULL,
    codigo_hash     TEXT        NOT NULL,          -- bcrypt del código (nunca en claro)
    expira_en       TIMESTAMPTZ NOT NULL,
    intentos        SMALLINT    NOT NULL DEFAULT 0,
    consumido_en    TIMESTAMPTZ,
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pacientes_otp_telefono ON pacientes_otp (telefono);

COMMIT;
```

- [ ] **Step 2: Validar la sintaxis**

Run (si hay un Postgres local accesible; si no, saltar y revisar a ojo):
`cd /home/josemarrufo/Escritorio/DosisYa-Backend && psql "$DATABASE_URL" -f db/migrations/014_pacientes_auth.sql --dry-run 2>/dev/null || echo "sin psql local — revisar manualmente"`
Expected: sin errores de sintaxis (o el aviso de "revisar manualmente").

- [ ] **Step 3: Commit**

```bash
cd /home/josemarrufo/Escritorio/DosisYa-Backend
git add db/migrations/014_pacientes_auth.sql
git commit -m "feat(db): migración 014 — tablas pacientes y pacientes_otp (login paciente Fase 1)"
```

> **Nota de deploy (no es un paso de código):** aplicar esta migración a Supabase prod vía Supabase MCP ANTES de desplegar el router. Coherente con cómo se aplicaron 008 y 013.

---

## Task 2: Generalizar el claim de nombre en el JWT

**Files:**
- Modify: `src/dosisya/security.py` (función `create_jwt_token`)
- Test: `tests/test_security_jwt.py`

**Interfaces:**
- Produces: `create_jwt_token(sub, rol, nombre="")` → JWT cuyo payload incluye `nombre` (claim nuevo) y `nombre_farmacia` (alias temporal, mismo valor). Mantiene compatibilidad con las llamadas existentes que pasan `nombre_farmacia=...`.

> El firmador hoy tiene la firma `create_jwt_token(farmacia_id, rol, nombre_farmacia="")`. Se renombra el 3er parámetro a `nombre` y se añade un **alias** `nombre_farmacia` como keyword para no romper a los dos llamadores actuales (`auth.py` login/register, admin login).

- [ ] **Step 1: Escribir el test que falla**

Create `tests/test_security_jwt.py`:

```python
"""create_jwt_token emite el claim neutro `nombre` y el alias `nombre_farmacia`."""
from __future__ import annotations

import jwt

from dosisya.security import _get_secret, create_jwt_token  # noqa: PLC2701


def _decode(token: str) -> dict:
    return jwt.decode(token, _get_secret(), algorithms=["HS256"])


def test_token_incluye_claim_nombre_neutro():
    token = create_jwt_token("pac-123", rol="paciente", nombre="Ana")
    payload = _decode(token)
    assert payload["sub"] == "pac-123"
    assert payload["rol"] == "paciente"
    assert payload["nombre"] == "Ana"
    # alias temporal para consumidores B2B existentes
    assert payload["nombre_farmacia"] == "Ana"


def test_alias_nombre_farmacia_sigue_funcionando():
    # Llamada legacy por keyword (como la hace auth.py)
    token = create_jwt_token("farm-9", rol="admin_farmacia", nombre_farmacia="Farmacia X")
    payload = _decode(token)
    assert payload["nombre"] == "Farmacia X"
    assert payload["nombre_farmacia"] == "Farmacia X"
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `cd /home/josemarrufo/Escritorio/DosisYa-Backend && pytest tests/test_security_jwt.py -v`
Expected: FAIL (hoy no existe el claim `nombre`; y la firma no acepta `nombre=`).

- [ ] **Step 3: Implementar el cambio mínimo**

En `src/dosisya/security.py`, reemplazar la firma y el payload de `create_jwt_token`:

```python
def create_jwt_token(
    farmacia_id: str,
    rol: str,
    nombre: str = "",
    nombre_farmacia: str | None = None,
) -> str:
    """Genera un JWT firmado con HS256.

    `nombre` es el nombre para mostrar (neutro: farmacia o paciente). El keyword
    `nombre_farmacia` se mantiene como ALIAS temporal para no romper a los
    llamadores B2B existentes; si se pasa, tiene prioridad. El payload emite
    ambos claims con el mismo valor durante una release.
    """
    display = nombre_farmacia if nombre_farmacia is not None else nombre
    now = datetime.now(UTC)
    ttl_days = int(os.environ.get("JWT_TTL_DAYS", "7"))
    payload = {
        "sub": farmacia_id,
        "rol": rol,
        "nombre": display,
        "nombre_farmacia": display,  # alias temporal (eliminar tras migrar consumidores)
        "iat": now,
        "exp": now + timedelta(days=ttl_days),
    }
    return jwt.encode(payload, _get_secret(), algorithm=_JWT_ALGORITHM)
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `cd /home/josemarrufo/Escritorio/DosisYa-Backend && pytest tests/test_security_jwt.py tests/test_admin_login.py -v`
Expected: PASS (los tests de login B2B existentes siguen verdes).

- [ ] **Step 5: Commit**

```bash
cd /home/josemarrufo/Escritorio/DosisYa-Backend
git add src/dosisya/security.py tests/test_security_jwt.py
git commit -m "feat(auth): claim JWT neutro 'nombre' con alias 'nombre_farmacia'"
```

---

## Task 3: Helpers puros (teléfono, OTP) y modelos del router

**Files:**
- Create: `src/dosisya/routers/pacientes_auth.py` (solo helpers + modelos + router vacío en esta task)
- Test: `tests/test_paciente_auth_helpers.py`

**Interfaces:**
- Produces:
  - `normalizar_telefono(raw: str) -> str` — devuelve E.164 venezolano (`+58...`) o lanza `ValueError`.
  - `generar_codigo() -> str` — 6 dígitos como string (con ceros a la izquierda).
  - `hash_codigo(codigo: str) -> str` / `verificar_codigo_hash(codigo: str, codigo_hash: str) -> bool` — bcrypt.
  - Modelos `SolicitarCodigoRequest(telefono: str)`, `VerificarCodigoRequest(telefono: str, codigo: str)`, `ActualizarNombreRequest(nombre: str)`.
  - `router = APIRouter(prefix="/api/v1/paciente", tags=["Autenticación Paciente"])`.

- [ ] **Step 1: Escribir los tests que fallan**

Create `tests/test_paciente_auth_helpers.py`:

```python
"""Helpers puros del router de auth de paciente."""
from __future__ import annotations

import pytest

from dosisya.routers.pacientes_auth import (
    generar_codigo,
    hash_codigo,
    normalizar_telefono,
    verificar_codigo_hash,
)


@pytest.mark.parametrize(
    ("entrada", "esperado"),
    [
        ("+584141234567", "+584141234567"),
        ("04141234567", "+584141234567"),     # nacional con 0 → +58
        ("4141234567", "+584141234567"),       # sin 0 ni prefijo
        (" +58 414 123 45 67 ", "+584141234567"),  # espacios
        ("+58-414-1234567", "+584141234567"),  # guiones
    ],
)
def test_normalizar_telefono_ok(entrada, esperado):
    assert normalizar_telefono(entrada) == esperado


@pytest.mark.parametrize("malo", ["", "123", "abc", "+1 555 0100", "00000"])
def test_normalizar_telefono_invalido(malo):
    with pytest.raises(ValueError):
        normalizar_telefono(malo)


def test_generar_codigo_son_6_digitos():
    for _ in range(50):
        c = generar_codigo()
        assert len(c) == 6 and c.isdigit()


def test_hash_y_verificacion_bcrypt():
    codigo = "042317"
    h = hash_codigo(codigo)
    assert h != codigo  # nunca en claro
    assert verificar_codigo_hash("042317", h) is True
    assert verificar_codigo_hash("999999", h) is False
```

- [ ] **Step 2: Correr y verificar fallo**

Run: `cd /home/josemarrufo/Escritorio/DosisYa-Backend && pytest tests/test_paciente_auth_helpers.py -v`
Expected: FAIL con `ModuleNotFoundError: dosisya.routers.pacientes_auth`.

- [ ] **Step 3: Implementar helpers + modelos + router vacío**

Create `src/dosisya/routers/pacientes_auth.py`:

```python
"""
DosisYa — Router: Autenticación del Paciente (login opcional, Fase 1).

Login sin contraseña: teléfono → OTP de 6 dígitos por WhatsApp (webhook n8n).
Reutiliza el esquema JWT/bcrypt de dosisya.security. Ver spec:
docs/superpowers/specs/2026-10-14-login-opcional-paciente-fase1-design.md
"""
from __future__ import annotations

import logging
import re
import secrets

import bcrypt
from fastapi import APIRouter
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/paciente", tags=["Autenticación Paciente"])


# ──────────────────────────── Modelos de entrada ────────────────────────────

class SolicitarCodigoRequest(BaseModel):
    telefono: str


class VerificarCodigoRequest(BaseModel):
    telefono: str
    codigo: str


class ActualizarNombreRequest(BaseModel):
    nombre: str


# ──────────────────────────── Helpers puros ────────────────────────────

def normalizar_telefono(raw: str) -> str:
    """Normaliza a E.164 venezolano (+58XXXXXXXXXX, 10 dígitos tras el +58).

    Acepta: +584141234567, 04141234567, 4141234567, con espacios/guiones.
    Lanza ValueError si no es un móvil venezolano válido.
    """
    solo_digitos = re.sub(r"\D", "", raw or "")
    if solo_digitos.startswith("58"):
        nacional = solo_digitos[2:]
    elif solo_digitos.startswith("0"):
        nacional = solo_digitos[1:]
    else:
        nacional = solo_digitos
    # Móvil venezolano: 10 dígitos, operador empieza en 4 (0412/0414/0416/0424/0426).
    if len(nacional) != 10 or not nacional.startswith("4"):
        raise ValueError("Teléfono venezolano inválido")
    return f"+58{nacional}"


def generar_codigo() -> str:
    """6 dígitos criptográficamente aleatorios, con ceros a la izquierda."""
    return f"{secrets.randbelow(1_000_000):06d}"


def hash_codigo(codigo: str) -> str:
    return bcrypt.hashpw(codigo.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verificar_codigo_hash(codigo: str, codigo_hash: str) -> bool:
    try:
        return bcrypt.checkpw(codigo.encode("utf-8"), codigo_hash.encode("utf-8"))
    except (ValueError, TypeError):
        return False
```

- [ ] **Step 4: Correr y verificar que pasa**

Run: `cd /home/josemarrufo/Escritorio/DosisYa-Backend && pytest tests/test_paciente_auth_helpers.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /home/josemarrufo/Escritorio/DosisYa-Backend
git add src/dosisya/routers/pacientes_auth.py tests/test_paciente_auth_helpers.py
git commit -m "feat(paciente-auth): helpers de teléfono/OTP y modelos del router"
```

---

## Task 4: Endpoint `POST /paciente/auth/solicitar-codigo` + registro del router

**Files:**
- Modify: `src/dosisya/routers/pacientes_auth.py`
- Modify: `src/dosisya/main.py` (imports + `include_router`)
- Test: `tests/test_paciente_solicitar_codigo.py`

**Interfaces:**
- Consumes: `normalizar_telefono`, `generar_codigo`, `hash_codigo` (Task 3); `get_connection` (`dosisya.db`); `limiter`, `client_ip` (`dosisya.limiter`).
- Produces:
  - Endpoint `POST /api/v1/paciente/auth/solicitar-codigo` → 200 `{"status":"success"}` o 429.
  - `async def _enviar_codigo_whatsapp(telefono: str, codigo: str) -> None` — POST al webhook n8n; testeable vía monkeypatch de este símbolo.

- [ ] **Step 1: Escribir el test que falla**

Create `tests/test_paciente_solicitar_codigo.py`:

```python
"""POST /api/v1/paciente/auth/solicitar-codigo — emite OTP (anti-enumeración)."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from dosisya.limiter import limiter
from dosisya.main import app

client = TestClient(app)
ENDPOINT = "/api/v1/paciente/auth/solicitar-codigo"


@pytest.fixture(autouse=True)
def _reset_rate_limit():
    limiter.reset()
    yield


class _FakeConn:
    """Registra las SQL ejecutadas; devuelve valores configurables."""

    def __init__(self, cooldown_activo: bool):
        self._cooldown = cooldown_activo
        self.ejecutadas: list[tuple] = []

    async def fetchval(self, query, *args):
        # El endpoint usa fetchval para el chequeo de cooldown (devuelve bool/None).
        return True if self._cooldown else None

    async def execute(self, query, *args):
        self.ejecutadas.append((query, args))
        return "INSERT 0 1"


class _Ctx:
    def __init__(self, conn):
        self._conn = conn

    async def __aenter__(self):
        return self._conn

    async def __aexit__(self, *exc):
        return False


@pytest.fixture()
def envios(monkeypatch):
    registro: list[tuple[str, str]] = []

    async def _fake_envio(telefono: str, codigo: str) -> None:
        registro.append((telefono, codigo))

    monkeypatch.setattr(
        "dosisya.routers.pacientes_auth._enviar_codigo_whatsapp", _fake_envio
    )
    return registro


def _mock_db(monkeypatch, conn):
    monkeypatch.setattr(
        "dosisya.routers.pacientes_auth.get_connection", lambda: _Ctx(conn)
    )


def test_solicitar_codigo_feliz_devuelve_success_y_agenda_envio(monkeypatch, envios):
    conn = _FakeConn(cooldown_activo=False)
    _mock_db(monkeypatch, conn)

    r = client.post(ENDPOINT, json={"telefono": "04141234567"})

    assert r.status_code == 200
    assert r.json() == {"status": "success"}
    # Se insertó un OTP y se agendó el envío al teléfono normalizado.
    assert any("INSERT INTO pacientes_otp" in q for q, _ in conn.ejecutadas)
    assert len(envios) == 1
    assert envios[0][0] == "+584141234567"
    assert len(envios[0][1]) == 6  # código de 6 dígitos


def test_solicitar_codigo_telefono_invalido_tambien_devuelve_success(monkeypatch, envios):
    conn = _FakeConn(cooldown_activo=False)
    _mock_db(monkeypatch, conn)

    r = client.post(ENDPOINT, json={"telefono": "abc"})

    # Anti-enumeración: no se filtra que el teléfono es inválido.
    assert r.status_code == 200
    assert r.json() == {"status": "success"}
    assert len(envios) == 0  # pero no se agenda envío


def test_solicitar_codigo_respeta_cooldown(monkeypatch, envios):
    conn = _FakeConn(cooldown_activo=True)  # ya hay un OTP < 60s
    _mock_db(monkeypatch, conn)

    r = client.post(ENDPOINT, json={"telefono": "04141234567"})

    assert r.status_code == 429
    assert len(envios) == 0
```

- [ ] **Step 2: Correr y verificar fallo**

Run: `cd /home/josemarrufo/Escritorio/DosisYa-Backend && pytest tests/test_paciente_solicitar_codigo.py -v`
Expected: FAIL (404: la ruta no existe / router no registrado).

- [ ] **Step 3: Implementar el endpoint + envío + registro del router**

En `src/dosisya/routers/pacientes_auth.py`, añadir imports arriba:

```python
import json
import os
from datetime import UTC, datetime, timedelta

import httpx
from fastapi import BackgroundTasks, HTTPException, Request, status
from fastapi.responses import JSONResponse

from dosisya.db import get_connection
from dosisya.limiter import limiter
```

Añadir las constantes SQL y el endpoint al final del archivo:

```python
# ──────────────────────────── SQL ────────────────────────────

# Cooldown: ¿hay un OTP para este teléfono creado hace < 60s y no consumido?
_SQL_COOLDOWN = """
    SELECT TRUE
    FROM pacientes_otp
    WHERE telefono = $1
      AND consumido_en IS NULL
      AND creado_en > now() - interval '60 seconds'
    LIMIT 1;
"""

# Limpia OTPs previos del teléfono (un solo código activo a la vez).
_SQL_LIMPIAR_OTP = "DELETE FROM pacientes_otp WHERE telefono = $1;"

# Inserta el nuevo OTP (TTL 5 min).
_SQL_INSERT_OTP = """
    INSERT INTO pacientes_otp (telefono, codigo_hash, expira_en)
    VALUES ($1, $2, now() + interval '5 minutes');
"""

_OK = {"status": "success"}


async def _enviar_codigo_whatsapp(telefono: str, codigo: str) -> None:
    """Dispara el envío del código por WhatsApp vía webhook n8n (fire-and-forget).

    En fallo, loguea un error redactado en webhook_errors (SIN el código) y no
    propaga la excepción: el usuario puede reintentar con "Reenviar".
    """
    url = os.environ.get("N8N_OTP_WEBHOOK_URL", "")
    if not url:
        logger.warning("[OTP] N8N_OTP_WEBHOOK_URL no configurada — no se envió el código.")
        return
    try:
        async with httpx.AsyncClient(timeout=5.0) as http:
            resp = await http.post(url, json={"telefono": telefono, "codigo": codigo})
            resp.raise_for_status()
    except httpx.HTTPError as e:
        logger.error("[OTP] Fallo al enviar código a %s: %s", telefono, e)
        try:
            async with get_connection() as conn:
                await conn.execute(
                    "INSERT INTO webhook_errors (endpoint_origen, payload_enviado, mensaje_error) "
                    "VALUES ($1, $2, $3)",
                    "paciente/solicitar-codigo",
                    json.dumps({"telefono": telefono}),  # SIN el código
                    str(e),
                )
        except Exception:  # noqa: BLE001 — el log de error nunca debe tumbar la request
            logger.exception("[OTP] No se pudo registrar el fallo en webhook_errors")


@router.post(
    "/auth/solicitar-codigo",
    summary="Solicita un código OTP por WhatsApp (login paciente)",
    responses={
        200: {"description": "Siempre success (anti-enumeración)"},
        429: {"description": "Cooldown / demasiados intentos"},
    },
)
@limiter.limit("5/minute")
async def solicitar_codigo(
    body: SolicitarCodigoRequest,
    request: Request,
    background: BackgroundTasks,
) -> JSONResponse:
    # Teléfono inválido → respuesta genérica, sin enviar nada (anti-enumeración).
    try:
        telefono = normalizar_telefono(body.telefono)
    except ValueError:
        return JSONResponse(content=_OK)

    async with get_connection() as conn:
        en_cooldown = await conn.fetchval(_SQL_COOLDOWN, telefono)
        if en_cooldown:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Espera un momento antes de pedir otro código.",
            )
        codigo = generar_codigo()
        await conn.execute(_SQL_LIMPIAR_OTP, telefono)
        await conn.execute(_SQL_INSERT_OTP, telefono, hash_codigo(codigo))

    background.add_task(_enviar_codigo_whatsapp, telefono, codigo)
    return JSONResponse(content=_OK)
```

En `src/dosisya/main.py`:
- Añadir junto a los otros imports de routers (tras la línea `from dosisya.routers.medicamentos import ...`):

```python
from dosisya.routers.pacientes_auth import router as pacientes_auth_router
```

- Añadir junto a los otros `include_router` (tras `app.include_router(medicamentos_router)`):

```python
app.include_router(pacientes_auth_router)
```

- [ ] **Step 4: Correr y verificar que pasa**

Run: `cd /home/josemarrufo/Escritorio/DosisYa-Backend && pytest tests/test_paciente_solicitar_codigo.py -v`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
cd /home/josemarrufo/Escritorio/DosisYa-Backend
git add src/dosisya/routers/pacientes_auth.py src/dosisya/main.py tests/test_paciente_solicitar_codigo.py
git commit -m "feat(paciente-auth): endpoint solicitar-codigo + envío OTP por webhook n8n"
```

---

## Task 5: Endpoint `POST /paciente/auth/verificar-codigo`

**Files:**
- Modify: `src/dosisya/routers/pacientes_auth.py`
- Test: `tests/test_paciente_verificar_codigo.py`

**Interfaces:**
- Consumes: `verificar_codigo_hash`, `normalizar_telefono` (Task 3); `create_jwt_token` (Task 2); `get_connection`.
- Produces: `POST /api/v1/paciente/auth/verificar-codigo` → 200 `{"data":{paciente_id, auth_token, telefono, nombre, es_nuevo}}` o 401 genérico.

- [ ] **Step 1: Escribir el test que falla**

Create `tests/test_paciente_verificar_codigo.py`:

```python
"""POST /api/v1/paciente/auth/verificar-codigo — valida OTP y emite JWT."""
from __future__ import annotations

import bcrypt
import jwt
import pytest
from fastapi.testclient import TestClient

from dosisya.limiter import limiter
from dosisya.main import app
from dosisya.security import _get_secret  # noqa: PLC2701

client = TestClient(app)
ENDPOINT = "/api/v1/paciente/auth/verificar-codigo"
CODIGO = "042317"
HASH = bcrypt.hashpw(CODIGO.encode(), bcrypt.gensalt()).decode()


@pytest.fixture(autouse=True)
def _reset_rate_limit():
    limiter.reset()
    yield


class _FakeConn:
    """Devuelve una fila OTP configurable y simula el upsert de paciente."""

    def __init__(self, otp_row, es_nuevo=True, nombre=None):
        self._otp_row = otp_row
        self._es_nuevo = es_nuevo
        self._nombre = nombre
        self.ejecutadas: list[tuple] = []

    async def fetchrow(self, query, *args):
        if "FROM pacientes_otp" in query:
            return self._otp_row
        if "INTO pacientes" in query:  # upsert → RETURNING id, nombre, es_nuevo
            return {
                "id": "pac-1",
                "nombre": self._nombre,
                "es_nuevo": self._es_nuevo,
            }
        return None

    async def execute(self, query, *args):
        self.ejecutadas.append((query, args))
        return "UPDATE 1"


class _Ctx:
    def __init__(self, conn):
        self._conn = conn

    async def __aenter__(self):
        return self._conn

    async def __aexit__(self, *exc):
        return False


def _mock_db(monkeypatch, conn):
    monkeypatch.setattr(
        "dosisya.routers.pacientes_auth.get_connection", lambda: _Ctx(conn)
    )


def test_verificar_ok_devuelve_token_y_crea_paciente(monkeypatch):
    otp = {"id": "otp-1", "codigo_hash": HASH, "intentos": 0}
    conn = _FakeConn(otp, es_nuevo=True, nombre=None)
    _mock_db(monkeypatch, conn)

    r = client.post(ENDPOINT, json={"telefono": "04141234567", "codigo": CODIGO})

    assert r.status_code == 200
    data = r.json()["data"]
    assert data["paciente_id"] == "pac-1"
    assert data["telefono"] == "+584141234567"
    assert data["es_nuevo"] is True
    payload = jwt.decode(data["auth_token"], _get_secret(), algorithms=["HS256"])
    assert payload["sub"] == "pac-1"
    assert payload["rol"] == "paciente"
    # El OTP se marcó consumido.
    assert any("consumido_en" in q for q, _ in conn.ejecutadas)


def test_verificar_codigo_incorrecto_incrementa_intentos_y_401(monkeypatch):
    otp = {"id": "otp-1", "codigo_hash": HASH, "intentos": 0}
    conn = _FakeConn(otp)
    _mock_db(monkeypatch, conn)

    r = client.post(ENDPOINT, json={"telefono": "04141234567", "codigo": "000000"})

    assert r.status_code == 401
    assert any("intentos = intentos + 1" in q for q, _ in conn.ejecutadas)


def test_verificar_sin_otp_vigente_401(monkeypatch):
    conn = _FakeConn(None)  # no hay OTP vigente
    _mock_db(monkeypatch, conn)

    r = client.post(ENDPOINT, json={"telefono": "04141234567", "codigo": CODIGO})

    assert r.status_code == 401
```

- [ ] **Step 2: Correr y verificar fallo**

Run: `cd /home/josemarrufo/Escritorio/DosisYa-Backend && pytest tests/test_paciente_verificar_codigo.py -v`
Expected: FAIL (404: endpoint no existe).

- [ ] **Step 3: Implementar el endpoint**

En `src/dosisya/routers/pacientes_auth.py`, añadir import de JWT (junto a los demás imports de `dosisya`):

```python
from dosisya.security import create_jwt_token
```

Añadir SQL y endpoint al final:

```python
# OTP vigente más reciente del teléfono (no consumido, no expirado, < 5 intentos).
_SQL_OTP_VIGENTE = """
    SELECT id, codigo_hash, intentos
    FROM pacientes_otp
    WHERE telefono = $1
      AND consumido_en IS NULL
      AND expira_en > now()
      AND intentos < 5
    ORDER BY creado_en DESC
    LIMIT 1;
"""

_SQL_INCREMENTAR_INTENTOS = "UPDATE pacientes_otp SET intentos = intentos + 1 WHERE id = $1;"

_SQL_CONSUMIR_OTP = "UPDATE pacientes_otp SET consumido_en = now() WHERE id = $1;"

# Upsert del paciente. (xmax = 0) distingue INSERT (nuevo) de UPDATE (existente).
_SQL_UPSERT_PACIENTE = """
    INSERT INTO pacientes (telefono)
    VALUES ($1)
    ON CONFLICT (telefono)
    DO UPDATE SET ultimo_acceso = now()
    RETURNING id, nombre, (xmax = 0) AS es_nuevo;
"""

_MSG_OTP_INVALIDO = "Código incorrecto o vencido."


@router.post(
    "/auth/verificar-codigo",
    summary="Verifica el código OTP y devuelve un JWT de paciente",
    responses={
        200: {"description": "Verificación OK — auth_token + perfil"},
        401: {"description": "Código incorrecto, vencido o agotado"},
    },
)
@limiter.limit("10/minute")
async def verificar_codigo(body: VerificarCodigoRequest, request: Request) -> JSONResponse:
    try:
        telefono = normalizar_telefono(body.telefono)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=_MSG_OTP_INVALIDO) from e

    async with get_connection() as conn:
        otp = await conn.fetchrow(_SQL_OTP_VIGENTE, telefono)
        if otp is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=_MSG_OTP_INVALIDO)

        if not verificar_codigo_hash(body.codigo, otp["codigo_hash"]):
            await conn.execute(_SQL_INCREMENTAR_INTENTOS, otp["id"])
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=_MSG_OTP_INVALIDO)

        await conn.execute(_SQL_CONSUMIR_OTP, otp["id"])
        paciente = await conn.fetchrow(_SQL_UPSERT_PACIENTE, telefono)

    paciente_id = str(paciente["id"])
    nombre = paciente["nombre"] or ""
    token = create_jwt_token(paciente_id, rol="paciente", nombre=nombre)
    return JSONResponse(
        content={
            "data": {
                "paciente_id": paciente_id,
                "auth_token": token,
                "telefono": telefono,
                "nombre": nombre,
                "es_nuevo": bool(paciente["es_nuevo"]),
            }
        }
    )
```

- [ ] **Step 4: Correr y verificar que pasa**

Run: `cd /home/josemarrufo/Escritorio/DosisYa-Backend && pytest tests/test_paciente_verificar_codigo.py -v`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
cd /home/josemarrufo/Escritorio/DosisYa-Backend
git add src/dosisya/routers/pacientes_auth.py tests/test_paciente_verificar_codigo.py
git commit -m "feat(paciente-auth): endpoint verificar-codigo (upsert paciente + JWT)"
```

---

## Task 6: Endpoints protegidos `GET`/`PATCH /paciente/me`

**Files:**
- Modify: `src/dosisya/routers/pacientes_auth.py`
- Test: `tests/test_paciente_me.py`

**Interfaces:**
- Consumes: `verify_token` (`dosisya.security`); `get_connection`.
- Produces: `GET /api/v1/paciente/me` y `PATCH /api/v1/paciente/me`, ambos exigen `rol=="paciente"` (si no, 403).

- [ ] **Step 1: Escribir el test que falla**

Create `tests/test_paciente_me.py`:

```python
"""GET/PATCH /api/v1/paciente/me — perfil del paciente (requiere JWT rol=paciente)."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from dosisya.limiter import limiter
from dosisya.main import app
from dosisya.security import create_jwt_token

client = TestClient(app)
ENDPOINT = "/api/v1/paciente/me"


@pytest.fixture(autouse=True)
def _reset_rate_limit():
    limiter.reset()
    yield


class _FakeConn:
    def __init__(self, row):
        self._row = row

    async def fetchrow(self, query, *args):
        return self._row

    async def execute(self, query, *args):
        return "UPDATE 1"


class _Ctx:
    def __init__(self, row):
        self._row = row

    async def __aenter__(self):
        return _FakeConn(self._row)

    async def __aexit__(self, *exc):
        return False


def _mock_db(monkeypatch, row):
    monkeypatch.setattr(
        "dosisya.routers.pacientes_auth.get_connection", lambda: _Ctx(row)
    )


def _auth(rol="paciente"):
    token = create_jwt_token("pac-1", rol=rol, nombre="Ana")
    return {"Authorization": f"Bearer {token}"}


def test_get_me_sin_token_401():
    r = client.get(ENDPOINT)
    assert r.status_code == 401


def test_get_me_con_rol_farmacia_403(monkeypatch):
    _mock_db(monkeypatch, {"id": "pac-1", "telefono": "+584141234567", "nombre": "Ana"})
    r = client.get(ENDPOINT, headers=_auth(rol="admin_farmacia"))
    assert r.status_code == 403


def test_get_me_ok(monkeypatch):
    _mock_db(monkeypatch, {"id": "pac-1", "telefono": "+584141234567", "nombre": "Ana"})
    r = client.get(ENDPOINT, headers=_auth())
    assert r.status_code == 200
    data = r.json()["data"]
    assert data["paciente_id"] == "pac-1"
    assert data["telefono"] == "+584141234567"
    assert data["nombre"] == "Ana"


def test_patch_me_actualiza_nombre(monkeypatch):
    _mock_db(monkeypatch, {"id": "pac-1", "telefono": "+584141234567", "nombre": "Ana María"})
    r = client.patch(ENDPOINT, headers=_auth(), json={"nombre": "Ana María"})
    assert r.status_code == 200
    assert r.json()["data"]["nombre"] == "Ana María"
```

- [ ] **Step 2: Correr y verificar fallo**

Run: `cd /home/josemarrufo/Escritorio/DosisYa-Backend && pytest tests/test_paciente_me.py -v`
Expected: FAIL (404 en /me).

- [ ] **Step 3: Implementar los endpoints**

En `src/dosisya/routers/pacientes_auth.py`, ampliar el import de seguridad y añadir `Depends`:

```python
from fastapi import BackgroundTasks, Depends, HTTPException, Request, status
from dosisya.security import create_jwt_token, verify_token
```

Añadir al final:

```python
_SQL_PERFIL = "SELECT id, telefono, nombre FROM pacientes WHERE id = $1 LIMIT 1;"
_SQL_SET_NOMBRE = "UPDATE pacientes SET nombre = $2 WHERE id = $1;"


def _exigir_paciente(token_data: dict) -> str:
    """Devuelve el paciente_id si el token es de un paciente; si no, 403."""
    if token_data.get("rol") != "paciente":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Este recurso es solo para pacientes.",
        )
    return str(token_data["sub"])


def _perfil_response(row) -> JSONResponse:
    return JSONResponse(
        content={
            "data": {
                "paciente_id": str(row["id"]),
                "telefono": row["telefono"],
                "nombre": row["nombre"] or "",
            }
        }
    )


@router.get("/me", summary="Perfil del paciente autenticado")
async def obtener_perfil(token_data: dict = Depends(verify_token)) -> JSONResponse:  # noqa: B008
    paciente_id = _exigir_paciente(token_data)
    async with get_connection() as conn:
        row = await conn.fetchrow(_SQL_PERFIL, paciente_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Paciente no encontrado.")
    return _perfil_response(row)


@router.patch("/me", summary="Actualiza el nombre del paciente")
async def actualizar_perfil(
    body: ActualizarNombreRequest,
    token_data: dict = Depends(verify_token),  # noqa: B008
) -> JSONResponse:
    paciente_id = _exigir_paciente(token_data)
    async with get_connection() as conn:
        await conn.execute(_SQL_SET_NOMBRE, paciente_id, body.nombre.strip())
        row = await conn.fetchrow(_SQL_PERFIL, paciente_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Paciente no encontrado.")
    return _perfil_response(row)
```

- [ ] **Step 4: Correr y verificar que pasa**

Run: `cd /home/josemarrufo/Escritorio/DosisYa-Backend && pytest tests/test_paciente_me.py tests/ -k "paciente or security" -v`
Expected: PASS (todos los tests de paciente + security verdes).

- [ ] **Step 5: Commit**

```bash
cd /home/josemarrufo/Escritorio/DosisYa-Backend
git add src/dosisya/routers/pacientes_auth.py tests/test_paciente_me.py
git commit -m "feat(paciente-auth): endpoints protegidos GET/PATCH /paciente/me"
```

---

## Task 7: Frontend — `pacienteAuth.ts` (sesión en localStorage)

**Files:**
- Create: `src/lib/pacienteAuth.ts`
- Test: `src/lib/pacienteAuth.test.ts`

**Interfaces:**
- Produces:
  - `interface PacientePerfil { paciente_id: string; telefono: string; nombre: string }`
  - `interface VerificarCodigoResponse { paciente_id: string; auth_token: string; telefono: string; nombre: string; es_nuevo: boolean }`
  - `guardarSesionPaciente(r: VerificarCodigoResponse): void`
  - `actualizarPerfilGuardado(perfil: PacientePerfil): void` — actualiza SOLO el perfil guardado, sin tocar el token.
  - `getPacienteToken(): string | null`
  - `esPacienteLogueado(): boolean`
  - `getPacientePerfil(): PacientePerfil | null`
  - `cerrarSesionPaciente(): void`

- [ ] **Step 1: Escribir el test que falla**

Create `src/lib/pacienteAuth.test.ts`:

```ts
import { afterEach, describe, expect, it } from "vitest";
import {
  cerrarSesionPaciente,
  esPacienteLogueado,
  getPacientePerfil,
  getPacienteToken,
  guardarSesionPaciente,
} from "./pacienteAuth";

afterEach(() => localStorage.clear());

const RESP = {
  paciente_id: "pac-1",
  auth_token: "tok-abc",
  telefono: "+584141234567",
  nombre: "Ana",
  es_nuevo: false,
};

describe("pacienteAuth", () => {
  it("guarda y recupera la sesión", () => {
    guardarSesionPaciente(RESP);
    expect(getPacienteToken()).toBe("tok-abc");
    expect(esPacienteLogueado()).toBe(true);
    expect(getPacientePerfil()).toEqual({
      paciente_id: "pac-1",
      telefono: "+584141234567",
      nombre: "Ana",
    });
  });

  it("sin sesión devuelve null/false", () => {
    expect(getPacienteToken()).toBeNull();
    expect(esPacienteLogueado()).toBe(false);
    expect(getPacientePerfil()).toBeNull();
  });

  it("cerrar sesión limpia todo", () => {
    guardarSesionPaciente(RESP);
    cerrarSesionPaciente();
    expect(getPacienteToken()).toBeNull();
    expect(getPacientePerfil()).toBeNull();
  });

  it("actualizarPerfilGuardado cambia el perfil sin tocar el token", () => {
    guardarSesionPaciente(RESP);
    actualizarPerfilGuardado({ paciente_id: "pac-1", telefono: "+584141234567", nombre: "Ana María" });
    expect(getPacienteToken()).toBe("tok-abc"); // token intacto
    expect(getPacientePerfil()?.nombre).toBe("Ana María");
  });
});
```

(añade `actualizarPerfilGuardado` al import del test).

- [ ] **Step 2: Correr y verificar fallo**

Run: `cd /home/josemarrufo/Escritorio/DosisYa-Frontend && npx vitest run src/lib/pacienteAuth.test.ts`
Expected: FAIL (módulo `./pacienteAuth` no existe).

- [ ] **Step 3: Implementar**

Create `src/lib/pacienteAuth.ts`:

```ts
// Sesión del paciente (login opcional). Espejo de adminAuth.ts pero para el
// paciente B2C. Guardado en localStorage; SSR-safe.

const K_TOKEN = "paciente_token";
const K_PERFIL = "paciente_perfil";

export interface PacientePerfil {
  paciente_id: string;
  telefono: string;
  nombre: string;
}

export interface VerificarCodigoResponse {
  paciente_id: string;
  auth_token: string;
  telefono: string;
  nombre: string;
  es_nuevo: boolean;
}

export function guardarSesionPaciente(r: VerificarCodigoResponse): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(K_TOKEN, r.auth_token);
  const perfil: PacientePerfil = {
    paciente_id: r.paciente_id,
    telefono: r.telefono,
    nombre: r.nombre,
  };
  localStorage.setItem(K_PERFIL, JSON.stringify(perfil));
}

export function actualizarPerfilGuardado(perfil: PacientePerfil): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(K_PERFIL, JSON.stringify(perfil));
}

export function getPacienteToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(K_TOKEN);
}

export function esPacienteLogueado(): boolean {
  return getPacienteToken() !== null;
}

export function getPacientePerfil(): PacientePerfil | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(K_PERFIL);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PacientePerfil;
  } catch {
    return null;
  }
}

export function cerrarSesionPaciente(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(K_TOKEN);
  localStorage.removeItem(K_PERFIL);
}
```

- [ ] **Step 4: Correr y verificar que pasa**

Run: `cd /home/josemarrufo/Escritorio/DosisYa-Frontend && npx vitest run src/lib/pacienteAuth.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /home/josemarrufo/Escritorio/DosisYa-Frontend
git add src/lib/pacienteAuth.ts src/lib/pacienteAuth.test.ts
git commit -m "feat(paciente): sesión del paciente en localStorage (pacienteAuth)"
```

---

## Task 8: Frontend — `pacienteApi.ts` (cliente HTTP)

**Files:**
- Create: `src/lib/pacienteApi.ts`
- Test: `src/lib/pacienteApi.test.ts`

**Interfaces:**
- Consumes: `API_BASE` (`src/lib/api.ts`); `getPacienteToken`, `VerificarCodigoResponse`, `PacientePerfil` (Task 7).
- Produces:
  - `solicitarCodigo(telefono: string): Promise<void>`
  - `verificarCodigo(telefono: string, codigo: string): Promise<VerificarCodigoResponse>`
  - `obtenerPerfil(): Promise<PacientePerfil>`
  - `actualizarNombre(nombre: string): Promise<PacientePerfil>`

- [ ] **Step 1: Escribir el test que falla**

Create `src/lib/pacienteApi.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { solicitarCodigo, verificarCodigo } from "./pacienteApi";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});
afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

function ok(json: unknown) {
  return { ok: true, status: 200, json: async () => json } as Response;
}

describe("pacienteApi", () => {
  it("solicitarCodigo hace POST con el teléfono", async () => {
    fetchMock.mockResolvedValue(ok({ status: "success" }));
    await solicitarCodigo("04141234567");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/paciente/auth/solicitar-codigo",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ telefono: "04141234567" }),
      }),
    );
  });

  it("verificarCodigo devuelve la sesión parseada de data", async () => {
    const resp = {
      paciente_id: "pac-1",
      auth_token: "tok",
      telefono: "+584141234567",
      nombre: "",
      es_nuevo: true,
    };
    fetchMock.mockResolvedValue(ok({ data: resp }));
    const r = await verificarCodigo("04141234567", "042317");
    expect(r).toEqual(resp);
  });

  it("verificarCodigo lanza en 401", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401, json: async () => ({}) } as Response);
    await expect(verificarCodigo("04141234567", "000000")).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Correr y verificar fallo**

Run: `cd /home/josemarrufo/Escritorio/DosisYa-Frontend && npx vitest run src/lib/pacienteApi.test.ts`
Expected: FAIL (módulo `./pacienteApi` no existe).

- [ ] **Step 3: Implementar**

Create `src/lib/pacienteApi.ts`:

```ts
// Cliente HTTP de la auth del paciente. Mismo-origen: usa API_BASE ("" en
// cliente → ruta relativa proxeada). Respuestas de auth llegan envueltas en
// { data: ... } (igual que adminApi).

import { z } from "zod";
import { API_BASE } from "@/lib/api";
import {
  getPacienteToken,
  type PacientePerfil,
  type VerificarCodigoResponse,
} from "@/lib/pacienteAuth";

const PREFIX = "/api/v1/paciente";

const sesionSchema = z.object({
  paciente_id: z.string(),
  auth_token: z.string(),
  telefono: z.string(),
  nombre: z.string(),
  es_nuevo: z.boolean(),
});

const perfilSchema = z.object({
  paciente_id: z.string(),
  telefono: z.string(),
  nombre: z.string(),
});

async function leerData(res: Response): Promise<unknown> {
  const json = (await res.json()) as { data?: unknown };
  return json.data;
}

export async function solicitarCodigo(telefono: string): Promise<void> {
  const res = await fetch(`${API_BASE}${PREFIX}/auth/solicitar-codigo`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ telefono }),
  });
  if (res.status === 429) throw new Error("Espera un momento antes de pedir otro código.");
  if (!res.ok) throw new Error("No se pudo enviar el código. Intenta de nuevo.");
}

export async function verificarCodigo(
  telefono: string,
  codigo: string,
): Promise<VerificarCodigoResponse> {
  const res = await fetch(`${API_BASE}${PREFIX}/auth/verificar-codigo`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ telefono, codigo }),
  });
  if (!res.ok) throw new Error("Código incorrecto o vencido.");
  return sesionSchema.parse(await leerData(res));
}

export async function obtenerPerfil(): Promise<PacientePerfil> {
  const token = getPacienteToken();
  if (!token) throw new Error("UNAUTHORIZED");
  const res = await fetch(`${API_BASE}${PREFIX}/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401 || res.status === 403) throw new Error("UNAUTHORIZED");
  if (!res.ok) throw new Error("No se pudo cargar el perfil.");
  return perfilSchema.parse(await leerData(res));
}

export async function actualizarNombre(nombre: string): Promise<PacientePerfil> {
  const token = getPacienteToken();
  if (!token) throw new Error("UNAUTHORIZED");
  const res = await fetch(`${API_BASE}${PREFIX}/me`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ nombre }),
  });
  if (res.status === 401 || res.status === 403) throw new Error("UNAUTHORIZED");
  if (!res.ok) throw new Error("No se pudo guardar el nombre.");
  return perfilSchema.parse(await leerData(res));
}
```

- [ ] **Step 4: Correr y verificar que pasa**

Run: `cd /home/josemarrufo/Escritorio/DosisYa-Frontend && npx vitest run src/lib/pacienteApi.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /home/josemarrufo/Escritorio/DosisYa-Frontend
git add src/lib/pacienteApi.ts src/lib/pacienteApi.test.ts
git commit -m "feat(paciente): cliente HTTP de auth del paciente (pacienteApi)"
```

---

## Task 9: Frontend — hook `usePacienteSesion`

**Files:**
- Create: `src/hooks/usePacienteSesion.ts`

**Interfaces:**
- Consumes: `getPacientePerfil`, `getPacienteToken`, `cerrarSesionPaciente` (Task 7); `obtenerPerfil` (Task 8).
- Produces: `usePacienteSesion(): { logueado: boolean; perfil: PacientePerfil | null; cerrarSesion: () => void }`.

> Al montar, si hay token guardado, valida con `GET /paciente/me`; ante `UNAUTHORIZED` limpia la sesión en silencio y actualiza el estado.

- [ ] **Step 1: Implementar el hook**

Create `src/hooks/usePacienteSesion.ts`:

```ts
import { useCallback, useEffect, useState } from "react";
import {
  cerrarSesionPaciente,
  getPacientePerfil,
  getPacienteToken,
  type PacientePerfil,
} from "@/lib/pacienteAuth";
import { obtenerPerfil } from "@/lib/pacienteApi";

export function usePacienteSesion(): {
  logueado: boolean;
  perfil: PacientePerfil | null;
  cerrarSesion: () => void;
} {
  const [perfil, setPerfil] = useState<PacientePerfil | null>(null);

  useEffect(() => {
    // Lectura inicial tras hidratar (evita desajuste SSR/CSR).
    setPerfil(getPacientePerfil());
    if (!getPacienteToken()) return;
    // Valida el token guardado; si es inválido, limpia en silencio.
    let cancelado = false;
    obtenerPerfil()
      .then((p) => {
        if (!cancelado) setPerfil(p);
      })
      .catch(() => {
        if (cancelado) return;
        cerrarSesionPaciente();
        setPerfil(null);
      });
    return () => {
      cancelado = true;
    };
  }, []);

  const cerrarSesion = useCallback(() => {
    cerrarSesionPaciente();
    setPerfil(null);
  }, []);

  return { logueado: perfil !== null, perfil, cerrarSesion };
}
```

- [ ] **Step 2: Verificar tipos y build**

Run: `cd /home/josemarrufo/Escritorio/DosisYa-Frontend && npx tsc --noEmit`
Expected: sin errores (el hook PostToolUse de tsc también corre al guardar).

- [ ] **Step 3: Commit**

```bash
cd /home/josemarrufo/Escritorio/DosisYa-Frontend
git add src/hooks/usePacienteSesion.ts
git commit -m "feat(paciente): hook usePacienteSesion (valida token al montar)"
```

---

## Task 10: Frontend — `HojaLoginPaciente` flujo real de 2 pasos

**Files:**
- Modify: `src/components/paciente/HojaLoginPaciente.tsx`

**Interfaces:**
- Consumes: `solicitarCodigo`, `verificarCodigo`, `actualizarNombre` (Task 8); `guardarSesionPaciente` (Task 7).
- Produces: `HojaLoginPaciente({ open, onOpenChange, onSesionIniciada? })` — mantiene la firma actual (`open`, `onOpenChange`) y añade un callback opcional `onSesionIniciada?: () => void` que se dispara tras login exitoso (para que `App.tsx` refresque el estado).

> Mantener el markup/estilos existentes (tokens `--verde-cruz`, `--papel`, clases `dy-foco`, el Drawer de vaul). Se añade estado interno de pasos. "Seguir sin cuenta" cierra el Drawer sin loguear, en todos los pasos.

- [ ] **Step 1: Reemplazar el componente**

Replace el contenido de `src/components/paciente/HojaLoginPaciente.tsx`:

```tsx
/*
 * HojaLoginPaciente — hoja de "Iniciar sesión" (opcional) del paciente.
 *
 * Flujo de 2 pasos: teléfono → código OTP por WhatsApp. El login es OPCIONAL por
 * diseño ("Cero Fricción"): "Seguir sin cuenta" está disponible en todo momento.
 */

import { useEffect, useRef, useState } from "react";
import { Drawer } from "vaul";
import { toast } from "sonner";
import { ArrowLeft, Smartphone, X } from "lucide-react";
import { solicitarCodigo, verificarCodigo, actualizarNombre } from "@/lib/pacienteApi";
import { actualizarPerfilGuardado, guardarSesionPaciente } from "@/lib/pacienteAuth";

type Paso = "telefono" | "codigo" | "nombre";

const COOLDOWN_S = 60;

export function HojaLoginPaciente({
  open,
  onOpenChange,
  onSesionIniciada,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSesionIniciada?: () => void;
}) {
  const [paso, setPaso] = useState<Paso>("telefono");
  const [telefono, setTelefono] = useState("");
  const [codigo, setCodigo] = useState("");
  const [nombre, setNombre] = useState("");
  const [cargando, setCargando] = useState(false);
  const [restante, setRestante] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Reinicia el formulario cada vez que se abre la hoja.
  useEffect(() => {
    if (open) {
      setPaso("telefono");
      setTelefono("");
      setCodigo("");
      setNombre("");
      setCargando(false);
      setRestante(0);
    }
  }, [open]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const iniciarCooldown = () => {
    setRestante(COOLDOWN_S);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setRestante((s) => {
        if (s <= 1 && timerRef.current) clearInterval(timerRef.current);
        return s - 1;
      });
    }, 1000);
  };

  const pedirCodigo = async () => {
    setCargando(true);
    try {
      await solicitarCodigo(telefono);
      setPaso("codigo");
      iniciarCooldown();
      toast("Te enviamos un código por WhatsApp.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo enviar el código.");
    } finally {
      setCargando(false);
    }
  };

  const confirmarCodigo = async () => {
    setCargando(true);
    try {
      const sesion = await verificarCodigo(telefono, codigo);
      guardarSesionPaciente(sesion);
      onSesionIniciada?.();
      if (sesion.es_nuevo) {
        setPaso("nombre");
        toast("¡Listo! ¿Cómo te llamamos?");
      } else {
        toast(sesion.nombre ? `¡Hola de nuevo, ${sesion.nombre}!` : "¡Sesión iniciada!");
        onOpenChange(false);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Código incorrecto o vencido.");
    } finally {
      setCargando(false);
    }
  };

  const guardarNombre = async () => {
    setCargando(true);
    try {
      const perfil = await actualizarNombre(nombre.trim());
      actualizarPerfilGuardado(perfil); // actualiza el nombre sin tocar el token
      onSesionIniciada?.();
    } catch {
      // No bloqueante: el nombre es opcional, la sesión ya existe.
    } finally {
      setCargando(false);
      onOpenChange(false);
      toast("¡Bienvenido a DosisYa!");
    }
  };

  const puedeEnviarTelefono = telefono.replace(/\D/g, "").length >= 10;
  const puedeVerificar = codigo.replace(/\D/g, "").length === 6;

  const estiloPrimario = {
    height: 48,
    background: "var(--verde-cruz)",
    color: "var(--papel)",
    border: 0,
    borderRadius: 13,
    fontSize: 14,
    fontWeight: 500,
    opacity: cargando ? 0.6 : 1,
  } as const;

  const estiloSecundario = {
    height: 48,
    marginTop: 10,
    background: "var(--blanco)",
    color: "var(--verde-cruz)",
    border: "1px solid #d8dad3",
    borderRadius: 13,
    fontSize: 14,
    fontWeight: 500,
  } as const;

  const estiloInput = {
    height: 48,
    width: "100%",
    borderRadius: 13,
    border: "1px solid #d8dad3",
    background: "var(--blanco)",
    padding: "0 14px",
    fontSize: 15,
    color: "var(--tinta)",
  } as const;

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <Drawer.Content
          className="dosisya-ui fixed inset-x-0 bottom-0 z-50 mx-auto flex max-w-md flex-col rounded-t-3xl outline-none"
          style={{ background: "var(--papel)", padding: "10px 18px 26px" }}
          aria-describedby={undefined}
        >
          <div
            aria-hidden="true"
            style={{ width: 38, height: 4, borderRadius: 999, background: "#d8dad3", margin: "2px auto 14px" }}
          />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {paso === "codigo" && (
                <button
                  type="button"
                  aria-label="Volver"
                  onClick={() => setPaso("telefono")}
                  className="dy-foco flex h-[34px] w-[34px] items-center justify-center rounded-[11px]"
                  style={{ background: "var(--fondo-suave)", border: 0, color: "var(--tinta-suave)" }}
                >
                  <ArrowLeft className="h-[18px] w-[18px]" aria-hidden="true" />
                </button>
              )}
              <Drawer.Title style={{ fontSize: 17, fontWeight: 500, color: "var(--tinta)", letterSpacing: "-0.02em" }}>
                {paso === "nombre" ? "¿Cómo te llamamos?" : "Iniciar sesión"}
              </Drawer.Title>
            </div>
            <button
              type="button"
              aria-label="Cerrar"
              onClick={() => onOpenChange(false)}
              className="dy-foco flex h-[34px] w-[34px] items-center justify-center rounded-[11px]"
              style={{ background: "var(--fondo-suave)", border: 0, color: "var(--tinta-suave)" }}
            >
              <X className="h-[18px] w-[18px]" aria-hidden="true" />
            </button>
          </div>

          {paso === "telefono" && (
            <>
              <p style={{ fontSize: 13, color: "var(--tinta-suave)", lineHeight: 1.5, margin: "10px 0 16px" }}>
                Es <span style={{ color: "var(--tinta)", fontWeight: 500 }}>opcional</span>. Inicia sesión para
                guardar tu Lista Médica y acceder a beneficios.
              </p>
              <input
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="Tu teléfono (ej. 0414 123 4567)"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                style={estiloInput}
                aria-label="Teléfono"
              />
              <button
                type="button"
                onClick={pedirCodigo}
                disabled={cargando || !puedeEnviarTelefono}
                className="dy-foco mt-3 flex w-full items-center justify-center gap-2"
                style={estiloPrimario}
              >
                <Smartphone className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden="true" />
                Continuar con teléfono
              </button>
              <button type="button" onClick={() => onOpenChange(false)} className="dy-foco w-full" style={estiloSecundario}>
                Seguir sin cuenta
              </button>
            </>
          )}

          {paso === "codigo" && (
            <>
              <p style={{ fontSize: 13, color: "var(--tinta-suave)", lineHeight: 1.5, margin: "10px 0 16px" }}>
                Escribe el código de 6 dígitos que te enviamos por WhatsApp.
              </p>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="______"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
                style={{ ...estiloInput, letterSpacing: "0.4em", textAlign: "center", fontSize: 20 }}
                aria-label="Código de verificación"
              />
              <button
                type="button"
                onClick={confirmarCodigo}
                disabled={cargando || !puedeVerificar}
                className="dy-foco mt-3 w-full"
                style={estiloPrimario}
              >
                Verificar
              </button>
              <button
                type="button"
                onClick={pedirCodigo}
                disabled={cargando || restante > 0}
                className="dy-foco w-full"
                style={{ ...estiloSecundario, opacity: restante > 0 ? 0.6 : 1 }}
              >
                {restante > 0 ? `Reenviar en ${restante}s` : "Reenviar código"}
              </button>
            </>
          )}

          {paso === "nombre" && (
            <>
              <p style={{ fontSize: 13, color: "var(--tinta-suave)", lineHeight: 1.5, margin: "10px 0 16px" }}>
                Opcional — así personalizamos tu saludo.
              </p>
              <input
                type="text"
                autoComplete="given-name"
                placeholder="Tu nombre"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                style={estiloInput}
                aria-label="Nombre"
              />
              <button
                type="button"
                onClick={guardarNombre}
                disabled={cargando || nombre.trim().length === 0}
                className="dy-foco mt-3 w-full"
                style={estiloPrimario}
              >
                Guardar
              </button>
              <button type="button" onClick={() => onOpenChange(false)} className="dy-foco w-full" style={estiloSecundario}>
                Omitir
              </button>
            </>
          )}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
```

- [ ] **Step 2: Verificar tipos y build**

Run: `cd /home/josemarrufo/Escritorio/DosisYa-Frontend && npx tsc --noEmit && npm run build`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
cd /home/josemarrufo/Escritorio/DosisYa-Frontend
git add src/components/paciente/HojaLoginPaciente.tsx
git commit -m "feat(paciente): HojaLoginPaciente — flujo real teléfono + OTP"
```

---

## Task 11: Frontend — surface de sesión en `App.tsx`

**Files:**
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `usePacienteSesion` (Task 9); el prop `onSesionIniciada` de `HojaLoginPaciente` (Task 10).

> Objetivo mínimo: cuando hay sesión, mostrar el nombre/teléfono en el punto de cuenta y permitir "Cerrar sesión"; cuando no, el tap abre la hoja de login (comportamiento actual). No se cambia el layout del header: solo se cablea el estado. La forma exacta del menú depende del componente que recibe `onAbrirCuenta` (hoy abre `setLoginAbierto(true)`); si ese componente es un menú (`MenuMasPaciente`), añadir allí la entrada de sesión siguiendo su patrón. Si es un simple botón, mantener: logueado → `cerrarSesion()` con confirmación `toast`; no logueado → abrir hoja.

- [ ] **Step 1: Cablear el hook en App.tsx**

En `src/App.tsx`:
- Importar el hook (junto a los otros imports de hooks):

```tsx
import { usePacienteSesion } from "@/hooks/usePacienteSesion";
```

- Dentro del componente, cerca de `const [loginAbierto, setLoginAbierto] = useState(false);` (línea ~86), añadir:

```tsx
const { logueado, perfil, cerrarSesion } = usePacienteSesion();
```

- En el render de `HojaLoginPaciente` (línea ~348), pasar el callback para refrescar al iniciar sesión:

```tsx
<HojaLoginPaciente
  open={loginAbierto}
  onOpenChange={setLoginAbierto}
  onSesionIniciada={() => setLoginAbierto(false)}
/>
```

- En el punto de cuenta (hoy `onAbrirCuenta={() => setLoginAbierto(true)}`, línea ~278), cablear el estado de sesión. Reemplazar por:

```tsx
onAbrirCuenta={() => {
  if (logueado) {
    cerrarSesion();
    toast(perfil?.nombre ? `Hasta pronto, ${perfil.nombre}.` : "Cerraste sesión.");
  } else {
    setLoginAbierto(true);
  }
}}
```

> Si el componente que recibe `onAbrirCuenta` acepta props para mostrar el estado (p.ej. un nombre), pasarle `perfil?.nombre`. Verificar su firma antes de editar; no inventar props. Si `toast` no está importado en `App.tsx`, añadir `import { toast } from "sonner";`.

- [ ] **Step 2: Verificar tipos y build**

Run: `cd /home/josemarrufo/Escritorio/DosisYa-Frontend && npx tsc --noEmit && npm run build`
Expected: sin errores.

- [ ] **Step 3: Verificación manual (navegador)**

Run: `cd /home/josemarrufo/Escritorio/DosisYa-Frontend && npm run dev` (puerto 5173).
Comprobar: tap en cuenta → abre hoja → el flujo teléfono/código funciona contra el backend local (requiere backend corriendo con la migración aplicada y `N8N_OTP_WEBHOOK_URL` configurada, o revisar el código en logs del backend). Buscar y Lista Médica siguen funcionando sin login.

- [ ] **Step 4: Commit**

```bash
cd /home/josemarrufo/Escritorio/DosisYa-Frontend
git add src/App.tsx
git commit -m "feat(paciente): surface de sesión en el punto de cuenta (App)"
```

---

## Verificación final (ambos repos)

- [ ] Backend: `cd /home/josemarrufo/Escritorio/DosisYa-Backend && pytest -q` → todo verde (ojo: `main` arrastra tests rojos preexistentes por contaminación de orden; comparar contra el baseline, no introducir nuevos rojos).
- [ ] Frontend: `cd /home/josemarrufo/Escritorio/DosisYa-Frontend && npx tsc --noEmit && npm run build && npx vitest run` → todo verde.
- [ ] Deploy: aplicar migración 014 a Supabase prod (MCP); crear flujo n8n webhook→OpenWA; configurar `N8N_OTP_WEBHOOK_URL` en Vercel (backend).

## Checklist de cobertura del spec

- Identidad teléfono+OTP WhatsApp → Tasks 1,3,4,5.
- OTP 6/5min/5/60s, hasheado, anti-enumeración → Tasks 1,3,4,5.
- JWT `rol:"paciente"` + claim `nombre` → Task 2,5.
- Endpoints `solicitar-codigo`/`verificar-codigo`/`GET,PATCH /me` → Tasks 4,5,6.
- Envío por webhook n8n + `webhook_errors` redactado → Task 4.
- Sesión localStorage + cliente HTTP mismo-origen → Tasks 7,8.
- Flujo de 2 pasos + nombre opcional + "Seguir sin cuenta" → Task 10.
- Validación de token al cargar + surface de sesión → Tasks 9,11.
- Fuera de alcance (sync Lista/historial/recetas) → no incluido (fases 2–4).
