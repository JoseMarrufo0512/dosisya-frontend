# Panel Súper Admin (v1) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Panel aislado donde el operador DosisYa se autentica como `superadmin` para aprobar/suspender farmacias, editar sus datos y ver facturación por farmacia.

**Architecture:** Enfoque A (namespace aislado). Backend: login superadmin contra la tabla `usuarios`, router nuevo `admin_super.py` con endpoints `/api/v1/admin/*` protegidos por rol, gate de aprobación vía nuevo estado `pendiente`. Frontend: rutas `super.*` con guard de rol, TanStack Query. No se toca el login de farmacias ni `admin.dashboard.tsx`.

**Tech Stack:** Backend FastAPI + asyncpg + bcrypt + pytest. Frontend React 19 + TanStack Start/Router/Query + Tailwind 4 + shadcn/ui + vaul + sonner. Dos repos: `DosisYa-Backend` y `DosisYa-Frontend`.

## Global Constraints

- Backend es fuente de verdad; verificar cada contrato contra `models.py`/`schema.sql` (regla CLAUDE.md #3).
- Nunca tocar el login de farmacias (`farmacias_auth`) ni `admin.dashboard.tsx` (salvo el mensaje del wizard, Task 12).
- Respuestas backend con `RespuestaEstructurada` (`{status, message, data}`).
- Queries SQL con parámetros posicionales (`$N`) — nunca interpolar.
- Autorización `/admin/*`: `rol != "superadmin"` → **403**; token ausente/expirado → 401.
- JWT: `create_jwt_token(sub, rol, nombre_farmacia="")`. Para superadmin `sub = usuario_id`.
- `TARIFA_BASE_CPC_USD = Decimal("0.10")` (ya en `routers/farmacias.py`).
- Backend tests: patrón `tests/test_farmacias_config.py` (TestClient + `app.dependency_overrides[verify_token]` + monkeypatch de `get_connection`). Correr con `.venv/bin/python -m pytest`.
- Frontend: **no hay runner de tests**. La verificación de cada task frontend es `npx tsc --noEmit && npm run build` (regla CLAUDE.md #6) + preview cuando aplique.
- Verificación mínima backend antes de commit: `.venv/bin/python -m pytest -q`.

---

## PARTE A — BACKEND (repo `DosisYa-Backend`)

### Task 1: Gate de aprobación — enum `pendiente` + registro entra pendiente

**Files:**
- Create: `db/migrations/005_estado_pendiente.sql`
- Modify: `src/dosisya/routers/auth.py` (literal `'activa'` → `'pendiente'` en `_INSERT_FARMACIA`, ~línea 137)
- Test: `tests/test_registro_pendiente.py`

**Interfaces:**
- Produces: enum `estado_afiliacion_enum` con valor `'pendiente'`; farmacias nuevas quedan `pendiente`.

- [ ] **Step 1: Crear la migración**

Create `db/migrations/005_estado_pendiente.sql`:
```sql
-- Migración 005: estado 'pendiente' para el gate de aprobación del súper admin.
-- ALTER TYPE ... ADD VALUE no puede correr dentro de un bloque transaccional
-- junto a otros cambios, por eso va solo en su propio archivo.
ALTER TYPE estado_afiliacion_enum ADD VALUE IF NOT EXISTS 'pendiente';
```

- [ ] **Step 2: Escribir el test que falla**

Create `tests/test_registro_pendiente.py`:
```python
"""El registro B2B debe crear farmacias en estado 'pendiente' (gate de aprobación)."""
from __future__ import annotations

from dosisya.routers import auth


def test_insert_farmacia_usa_estado_pendiente():
    # El INSERT de registro NO debe activar la farmacia automáticamente.
    assert "'pendiente'" in auth._INSERT_FARMACIA
    assert "'activa'" not in auth._INSERT_FARMACIA
```

- [ ] **Step 3: Ejecutar el test — debe FALLAR**

Run: `.venv/bin/python -m pytest tests/test_registro_pendiente.py -v`
Expected: FAIL (`_INSERT_FARMACIA` aún contiene `'activa'`).

- [ ] **Step 4: Cambiar el literal en `auth.py`**

En `src/dosisya/routers/auth.py`, dentro de `_INSERT_FARMACIA`, cambiar la línea:
```sql
        'activa',
```
por:
```sql
        'pendiente',
```
(Es la línea del `VALUES` que corresponde a la columna `estado_afiliacion`, ~137.)

- [ ] **Step 5: Ejecutar el test — debe PASAR**

Run: `.venv/bin/python -m pytest tests/test_registro_pendiente.py -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add db/migrations/005_estado_pendiente.sql src/dosisya/routers/auth.py tests/test_registro_pendiente.py
git commit -m "feat(afiliacion): estado pendiente + registro entra pendiente (gate súper admin)"
```

---

### Task 2: Script para fijar la contraseña del superadmin

**Files:**
- Create: `scripts/set_superadmin_password.py`
- Test: `tests/test_superadmin_password_script.py`

**Interfaces:**
- Produces: `generar_hash(password: str) -> str` (bcrypt) usado por el script.

- [ ] **Step 1: Escribir el test que falla**

Create `tests/test_superadmin_password_script.py`:
```python
"""El hash generado para el superadmin debe verificar con bcrypt."""
from __future__ import annotations

import bcrypt

from scripts.set_superadmin_password import generar_hash


def test_hash_verifica_con_bcrypt():
    h = generar_hash("clave-de-prueba-123")
    assert h.startswith("$2")
    assert bcrypt.checkpw(b"clave-de-prueba-123", h.encode())
    assert not bcrypt.checkpw(b"otra", h.encode())
```

- [ ] **Step 2: Ejecutar el test — debe FALLAR**

Run: `.venv/bin/python -m pytest tests/test_superadmin_password_script.py -v`
Expected: FAIL (módulo inexistente).

- [ ] **Step 3: Crear el script**

Create `scripts/set_superadmin_password.py`:
```python
"""Fija la contraseña del superadmin (tabla `usuarios`).

Uso:
    .venv/bin/python -m scripts.set_superadmin_password admin@dosisya.com

Pide la contraseña por stdin (no la pases como argumento para no dejarla en el
historial del shell). Requiere DATABASE_URL en el entorno.
"""
from __future__ import annotations

import asyncio
import getpass
import sys

import bcrypt

from dosisya.db import get_connection

_UPDATE = """
    UPDATE usuarios
       SET password_hash = $2, updated_at = now()
     WHERE email = $1 AND rol = 'superadmin'
    RETURNING id;
"""


def generar_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


async def _run(email: str, password: str) -> None:
    pw_hash = generar_hash(password)
    async with get_connection() as conn:
        row = await conn.fetchrow(_UPDATE, email, pw_hash)
    if row is None:
        print(f"✗ No existe un superadmin con email {email!r}.")
        sys.exit(1)
    print(f"✓ Contraseña actualizada para {email}.")


def main() -> None:
    if len(sys.argv) != 2:
        print("Uso: python -m scripts.set_superadmin_password <email>")
        sys.exit(2)
    email = sys.argv[1]
    password = getpass.getpass("Nueva contraseña del superadmin: ")
    if len(password) < 8:
        print("✗ La contraseña debe tener al menos 8 caracteres.")
        sys.exit(1)
    asyncio.run(_run(email, password))


if __name__ == "__main__":
    main()
```

Si `scripts/` no tiene `__init__.py`, crear `scripts/__init__.py` vacío para que sea importable en el test.

- [ ] **Step 4: Ejecutar el test — debe PASAR**

Run: `.venv/bin/python -m pytest tests/test_superadmin_password_script.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/set_superadmin_password.py scripts/__init__.py tests/test_superadmin_password_script.py
git commit -m "feat(scripts): set_superadmin_password para sembrar el hash del superadmin"
```

---

### Task 3: Endpoint `POST /api/v1/auth/admin/login`

**Files:**
- Modify: `src/dosisya/routers/auth.py` (añadir query, modelo request local y endpoint)
- Test: `tests/test_admin_login.py`

**Interfaces:**
- Consumes: `create_jwt_token`, `get_connection`, `bcrypt` (ya importados en `auth.py`).
- Produces: `POST /api/v1/auth/admin/login`, body `{correo, password}` → 200 `data: {auth_token, rol, email, usuario_id}`.

- [ ] **Step 1: Escribir el test que falla**

Create `tests/test_admin_login.py`:
```python
"""Login del superadmin: POST /api/v1/auth/admin/login (valida contra `usuarios`)."""
from __future__ import annotations

import uuid

import bcrypt
import pytest
from fastapi.testclient import TestClient

from dosisya.main import app

client = TestClient(app)
ENDPOINT = "/api/v1/auth/admin/login"

SUPER_ID = str(uuid.uuid4())
HASH = bcrypt.hashpw(b"superclave123", bcrypt.gensalt()).decode()


class _FakeConn:
    def __init__(self, row):
        self._row = row

    async def fetchrow(self, query, *args):
        return self._row


class _Ctx:
    def __init__(self, row):
        self._row = row

    async def __aenter__(self):
        return _FakeConn(self._row)

    async def __aexit__(self, *exc):
        return False


@pytest.fixture()
def mock_usuario(monkeypatch):
    def _set(row):
        monkeypatch.setattr(
            "dosisya.routers.auth.get_connection", lambda: _Ctx(row)
        )
    return _set


def test_login_ok(mock_usuario):
    mock_usuario({
        "id": SUPER_ID, "email": "admin@dosisya.com",
        "password_hash": HASH, "activo": True, "rol": "superadmin",
    })
    r = client.post(ENDPOINT, json={"correo": "admin@dosisya.com", "password": "superclave123"})
    assert r.status_code == 200
    d = r.json()["data"]
    assert d["rol"] == "superadmin"
    assert d["usuario_id"] == SUPER_ID
    assert d["auth_token"]


def test_login_password_incorrecta(mock_usuario):
    mock_usuario({
        "id": SUPER_ID, "email": "admin@dosisya.com",
        "password_hash": HASH, "activo": True, "rol": "superadmin",
    })
    r = client.post(ENDPOINT, json={"correo": "admin@dosisya.com", "password": "mala"})
    assert r.status_code == 401


def test_login_usuario_inactivo(mock_usuario):
    mock_usuario({
        "id": SUPER_ID, "email": "admin@dosisya.com",
        "password_hash": HASH, "activo": False, "rol": "superadmin",
    })
    r = client.post(ENDPOINT, json={"correo": "admin@dosisya.com", "password": "superclave123"})
    assert r.status_code == 401


def test_login_correo_inexistente(mock_usuario):
    mock_usuario(None)
    r = client.post(ENDPOINT, json={"correo": "nadie@x.com", "password": "x"})
    assert r.status_code == 401
```

- [ ] **Step 2: Ejecutar el test — debe FALLAR**

Run: `.venv/bin/python -m pytest tests/test_admin_login.py -v`
Expected: FAIL (404, endpoint inexistente).

- [ ] **Step 3: Añadir query, modelo y endpoint en `auth.py`**

En `src/dosisya/routers/auth.py`, junto a `_SELECT_AUTH_POR_CORREO`, añadir:
```python
# Login superadmin: busca en `usuarios` por email (CITEXT, case-insensitive).
# $1 → email
_SELECT_SUPERADMIN_POR_EMAIL = """
    SELECT id, email, password_hash, activo, rol::TEXT AS rol
    FROM usuarios
    WHERE email = $1 AND rol = 'superadmin'
    LIMIT 1;
"""
```

Junto a `LoginRequest` (clase Pydantic ~línea 60), reusar el mismo modelo (tiene `correo` y `password`). Añadir el endpoint después del `login` de farmacia:
```python
@router.post(
    "/api/v1/auth/admin/login",
    summary="Login del súper admin (valida contra tabla usuarios)",
    responses={
        200: {"description": "Login OK — auth_token, usuario_id, email, rol"},
        401: {"description": "Credenciales inválidas o usuario inactivo"},
    },
)
async def admin_login(body: LoginRequest, request: Request) -> JSONResponse:
    """Autentica a un superadmin contra la tabla `usuarios` y emite un JWT."""
    correo_normalizado = body.correo.strip().lower()

    try:
        async with get_connection() as conn:
            row = await conn.fetchrow(_SELECT_SUPERADMIN_POR_EMAIL, correo_normalizado)
    except Exception as e:  # noqa: BLE001
        logger.error("[ADMIN_LOGIN] Error BD [correo=%s]: %s", correo_normalizado, e)
        return JSONResponse(status_code=500, content={"detail": "Error interno."})

    # 401 genérico: no revelar si el correo existe.
    if row is None or not row["activo"]:
        return JSONResponse(status_code=401, content={"detail": "Credenciales inválidas."})

    try:
        ok = bcrypt.checkpw(body.password.encode("utf-8"), row["password_hash"].encode("utf-8"))
    except ValueError:
        ok = False
    if not ok:
        return JSONResponse(status_code=401, content={"detail": "Credenciales inválidas."})

    usuario_id = str(row["id"])
    token = create_jwt_token(usuario_id, rol="superadmin", nombre_farmacia="")
    logger.info("[ADMIN_LOGIN] ✅ superadmin autenticado [id=%s]", usuario_id)
    return JSONResponse(content={
        "status": "success",
        "message": "Login de superadmin exitoso.",
        "data": {
            "auth_token": token,
            "rol": "superadmin",
            "email": str(row["email"]),
            "usuario_id": usuario_id,
        },
    })
```
Confirmar que `Request`, `JSONResponse`, `logger`, `bcrypt`, `create_jwt_token`, `get_connection` ya están importados (lo están para el login de farmacia).

- [ ] **Step 4: Ejecutar los tests — deben PASAR**

Run: `.venv/bin/python -m pytest tests/test_admin_login.py -v`
Expected: 4 passed

- [ ] **Step 5: Commit**

```bash
git add src/dosisya/routers/auth.py tests/test_admin_login.py
git commit -m "feat(auth): POST /api/v1/auth/admin/login para el súper admin"
```

---

### Task 4: Router `admin_super.py` — `GET /api/v1/admin/farmacias`

**Files:**
- Create: `src/dosisya/routers/admin_super.py`
- Modify: `src/dosisya/main.py` (incluir el router)
- Test: `tests/test_admin_farmacias.py`

**Interfaces:**
- Consumes: `verify_token` (dep), `get_connection`, `RespuestaEstructurada`, `TARIFA_BASE_CPC_USD` (importar desde `dosisya.routers.farmacias`).
- Produces: `GET /api/v1/admin/farmacias?estado=` → `data: {farmacias:[{id,nombre,whatsapp,sector,punto_referencia,estado_afiliacion,nivel_suscripcion,created_at,leads_mes,deuda_usd}], totales:{total_farmacias,pendientes,leads_mes_red,deuda_red_usd}}`. Helper `_exigir_superadmin(token_data)`.

- [ ] **Step 1: Escribir el test que falla**

Create `tests/test_admin_farmacias.py`:
```python
"""GET /api/v1/admin/farmacias — lista + totales, solo superadmin."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

from dosisya.main import app
from dosisya.security import verify_token

client = TestClient(app)
ENDPOINT = "/api/v1/admin/farmacias"

FILA = {
    "id": uuid.uuid4(),
    "nombre": "Farmacia A",
    "whatsapp": "+584121112233",
    "sector": "Acarigua",
    "punto_referencia": "Plaza Bolívar",
    "estado_afiliacion": "pendiente",
    "nivel_suscripcion": "gratuita",
    "created_at": datetime.now(timezone.utc),
    "leads_mes": 3,
}


class _FakeConn:
    def __init__(self, rows):
        self._rows = rows

    async def fetch(self, query, *args):
        return self._rows


class _Ctx:
    def __init__(self, rows):
        self._rows = rows

    async def __aenter__(self):
        return _FakeConn(self._rows)

    async def __aexit__(self, *exc):
        return False


@pytest.fixture()
def mock_db(monkeypatch):
    monkeypatch.setattr(
        "dosisya.routers.admin_super.get_connection", lambda: _Ctx([FILA])
    )


@pytest.fixture()
def as_superadmin():
    app.dependency_overrides[verify_token] = lambda: {"sub": str(uuid.uuid4()), "rol": "superadmin"}
    yield
    app.dependency_overrides.pop(verify_token, None)


@pytest.fixture()
def as_farmacia():
    app.dependency_overrides[verify_token] = lambda: {"sub": str(uuid.uuid4()), "rol": "admin_farmacia"}
    yield
    app.dependency_overrides.pop(verify_token, None)


def test_superadmin_ve_lista_y_totales(mock_db, as_superadmin):
    r = client.get(ENDPOINT)
    assert r.status_code == 200
    data = r.json()["data"]
    assert len(data["farmacias"]) == 1
    f = data["farmacias"][0]
    assert f["leads_mes"] == 3
    assert f["deuda_usd"] == 0.30  # 3 * 0.10
    assert data["totales"]["total_farmacias"] == 1
    assert data["totales"]["pendientes"] == 1
    assert data["totales"]["leads_mes_red"] == 3
    assert data["totales"]["deuda_red_usd"] == 0.30


def test_farmacia_recibe_403(mock_db, as_farmacia):
    r = client.get(ENDPOINT)
    assert r.status_code == 403
```

- [ ] **Step 2: Ejecutar el test — debe FALLAR**

Run: `.venv/bin/python -m pytest tests/test_admin_farmacias.py -v`
Expected: FAIL (404, router inexistente).

- [ ] **Step 3: Crear el router**

Create `src/dosisya/routers/admin_super.py`:
```python
"""DosisYa — Router Súper Admin: gestión de la red de farmacias.

Endpoints (todos exigen rol=superadmin en el JWT):
  GET   /api/v1/admin/farmacias           — lista + totales (gestión + facturación)
  PATCH /api/v1/admin/farmacias/{id}/estado — aprobar/suspender/reactivar/rechazar
"""
from __future__ import annotations

import logging
from decimal import Decimal

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, status

from dosisya.db import get_connection
from dosisya.models import RespuestaEstructurada
from dosisya.routers.farmacias import TARIFA_BASE_CPC_USD
from dosisya.security import verify_token

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Súper Admin"])


def _exigir_superadmin(token_data: dict) -> None:
    """403 si el token no es de un superadmin."""
    if token_data.get("rol") != "superadmin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Requiere rol de superadmin.",
        )


# Lista de farmacias + leads del mes actual (LEFT JOIN para incluir las de 0 leads).
# $1 → estado opcional (NULL = todas). Los totales se calculan en Python sobre TODAS.
_SELECT_FARMACIAS_ADMIN = """
    SELECT
        f.id,
        f.nombre,
        f.telefono_whatsapp                 AS whatsapp,
        f.sector,
        f.punto_referencia,
        f.estado_afiliacion::TEXT           AS estado_afiliacion,
        f.nivel_suscripcion::TEXT           AS nivel_suscripcion,
        f.created_at,
        COUNT(li.id) FILTER (
            WHERE li.fecha_hora >= DATE_TRUNC('month', now())
        )                                    AS leads_mes
    FROM farmacias f
    LEFT JOIN leads_interacciones li ON li.farmacia_id = f.id
    GROUP BY f.id
    ORDER BY (f.estado_afiliacion = 'pendiente') DESC, f.created_at DESC;
"""


@router.get(
    "/api/v1/admin/farmacias",
    response_model=RespuestaEstructurada,
    summary="Lista de farmacias + totales de red (solo superadmin)",
)
async def listar_farmacias(
    estado: str | None = None,
    token_data: dict = Depends(verify_token),  # noqa: B008
) -> RespuestaEstructurada:
    _exigir_superadmin(token_data)

    try:
        async with get_connection() as conn:
            rows = await conn.fetch(_SELECT_FARMACIAS_ADMIN)
    except asyncpg.PostgresError as e:
        logger.error("[ADMIN] Error BD al listar farmacias: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error interno al listar farmacias.",
        ) from e

    tarifa = TARIFA_BASE_CPC_USD

    def _fila(r: asyncpg.Record) -> dict:
        leads = int(r["leads_mes"])
        return {
            "id": str(r["id"]),
            "nombre": r["nombre"],
            "whatsapp": r["whatsapp"],
            "sector": r["sector"],
            "punto_referencia": r["punto_referencia"],
            "estado_afiliacion": r["estado_afiliacion"],
            "nivel_suscripcion": r["nivel_suscripcion"],
            "created_at": r["created_at"].isoformat(),
            "leads_mes": leads,
            "deuda_usd": float(Decimal(leads) * tarifa),
        }

    todas = [_fila(r) for r in rows]

    # Totales SIEMPRE sobre toda la red (independientes del filtro `estado`).
    leads_red = sum(f["leads_mes"] for f in todas)
    totales = {
        "total_farmacias": len(todas),
        "pendientes": sum(1 for f in todas if f["estado_afiliacion"] == "pendiente"),
        "leads_mes_red": leads_red,
        "deuda_red_usd": float(Decimal(leads_red) * tarifa),
    }

    # El filtro `estado` solo recorta la lista devuelta.
    farmacias = [f for f in todas if estado is None or f["estado_afiliacion"] == estado]

    return RespuestaEstructurada(
        status="success",
        message=f"{len(farmacias)} farmacias.",
        data={"farmacias": farmacias, "totales": totales},
    )
```

- [ ] **Step 4: Incluir el router en `main.py`**

En `src/dosisya/main.py`, donde se registran los routers (`app.include_router(...)`), añadir:
```python
from dosisya.routers import admin_super  # junto a los otros imports de routers
...
app.include_router(admin_super.router)
```
(Seguir el estilo exacto de cómo se incluyen `farmacias`, `auth`, etc. en ese archivo.)

- [ ] **Step 5: Ejecutar los tests — deben PASAR**

Run: `.venv/bin/python -m pytest tests/test_admin_farmacias.py -v`
Expected: 2 passed

- [ ] **Step 6: Commit**

```bash
git add src/dosisya/routers/admin_super.py src/dosisya/main.py tests/test_admin_farmacias.py
git commit -m "feat(admin): GET /api/v1/admin/farmacias (lista + totales, solo superadmin)"
```

---

### Task 5: `PATCH /api/v1/admin/farmacias/{id}/estado`

**Files:**
- Modify: `src/dosisya/routers/admin_super.py` (query, modelo, endpoint)
- Modify: `src/dosisya/models.py` (modelo `CambioEstadoFarmacia`)
- Test: `tests/test_admin_estado.py`

**Interfaces:**
- Consumes: `_exigir_superadmin`, `get_connection`, `EstadoAfiliacion` (enum en `models.py`).
- Produces: `PATCH /api/v1/admin/farmacias/{id}/estado`, body `{estado_afiliacion}` → 200 `data:{id,nombre,estado_afiliacion}`.

- [ ] **Step 1a: Añadir `PENDIENTE` al enum `EstadoAfiliacion`**

En `src/dosisya/models.py`, la clase `EstadoAfiliacion` (StrEnum, ~línea 38) hoy solo
tiene `ACTIVA`/`INACTIVA`. Añadir el valor:
```python
class EstadoAfiliacion(enum.StrEnum):
    PENDIENTE = "pendiente"
    ACTIVA = "activa"
    INACTIVA = "inactiva"
```
(Sin esto, `CambioEstadoFarmacia` rechazaría `"pendiente"` con 422 y el súper admin
no podría dejar una farmacia pendiente de nuevo.)

- [ ] **Step 1b: Añadir el modelo `CambioEstadoFarmacia` en `models.py`**

Junto a `FarmaciaConfigUpdate`:
```python
class CambioEstadoFarmacia(BaseModel):
    """Cambio de estado de afiliación disparado por el superadmin."""
    model_config = ConfigDict(str_strip_whitespace=True)

    estado_afiliacion: EstadoAfiliacion
```

- [ ] **Step 2: Escribir el test que falla**

Create `tests/test_admin_estado.py`:
```python
"""PATCH /api/v1/admin/farmacias/{id}/estado — solo superadmin."""
from __future__ import annotations

import uuid

import pytest
from fastapi.testclient import TestClient

from dosisya.main import app
from dosisya.security import verify_token

client = TestClient(app)
FID = str(uuid.uuid4())


class _FakeConn:
    def __init__(self, row):
        self._row = row

    async def fetchrow(self, query, *args):
        return self._row


class _Ctx:
    def __init__(self, row):
        self._row = row

    async def __aenter__(self):
        return _FakeConn(self._row)

    async def __aexit__(self, *exc):
        return False


@pytest.fixture()
def mock_db(monkeypatch):
    def _set(row):
        monkeypatch.setattr("dosisya.routers.admin_super.get_connection", lambda: _Ctx(row))
    return _set


@pytest.fixture()
def as_superadmin():
    app.dependency_overrides[verify_token] = lambda: {"sub": str(uuid.uuid4()), "rol": "superadmin"}
    yield
    app.dependency_overrides.pop(verify_token, None)


@pytest.fixture()
def as_farmacia():
    app.dependency_overrides[verify_token] = lambda: {"sub": str(uuid.uuid4()), "rol": "admin_farmacia"}
    yield
    app.dependency_overrides.pop(verify_token, None)


def test_aprobar_ok(mock_db, as_superadmin):
    mock_db({"id": FID, "nombre": "Farmacia A", "estado_afiliacion": "activa"})
    r = client.patch(f"/api/v1/admin/farmacias/{FID}/estado", json={"estado_afiliacion": "activa"})
    assert r.status_code == 200
    assert r.json()["data"]["estado_afiliacion"] == "activa"


def test_estado_invalido_422(mock_db, as_superadmin):
    mock_db({"id": FID, "nombre": "x", "estado_afiliacion": "activa"})
    r = client.patch(f"/api/v1/admin/farmacias/{FID}/estado", json={"estado_afiliacion": "zombi"})
    assert r.status_code == 422


def test_farmacia_inexistente_404(mock_db, as_superadmin):
    mock_db(None)
    r = client.patch(f"/api/v1/admin/farmacias/{FID}/estado", json={"estado_afiliacion": "inactiva"})
    assert r.status_code == 404


def test_uuid_invalido_400(mock_db, as_superadmin):
    r = client.patch("/api/v1/admin/farmacias/no-uuid/estado", json={"estado_afiliacion": "activa"})
    assert r.status_code == 400


def test_farmacia_rol_403(mock_db, as_farmacia):
    r = client.patch(f"/api/v1/admin/farmacias/{FID}/estado", json={"estado_afiliacion": "activa"})
    assert r.status_code == 403
```

- [ ] **Step 3: Ejecutar el test — debe FALLAR**

Run: `.venv/bin/python -m pytest tests/test_admin_estado.py -v`
Expected: FAIL (404, endpoint inexistente).

- [ ] **Step 4: Añadir query y endpoint en `admin_super.py`**

Añadir el import del modelo y `UUID`:
```python
from uuid import UUID
from dosisya.models import CambioEstadoFarmacia, RespuestaEstructurada
```
Query:
```python
_UPDATE_ESTADO = """
    UPDATE farmacias
       SET estado_afiliacion = $2, updated_at = now()
     WHERE id = $1
    RETURNING id, nombre, estado_afiliacion::TEXT AS estado_afiliacion;
"""
```
Endpoint:
```python
@router.patch(
    "/api/v1/admin/farmacias/{farmacia_id}/estado",
    response_model=RespuestaEstructurada,
    summary="Cambiar estado de afiliación (aprobar/suspender/reactivar/rechazar)",
    responses={
        200: {"description": "Estado actualizado"},
        400: {"description": "UUID inválido"},
        403: {"description": "Requiere superadmin"},
        404: {"description": "Farmacia no encontrada"},
        422: {"description": "Estado inválido"},
    },
)
async def cambiar_estado(
    farmacia_id: str,
    payload: CambioEstadoFarmacia,
    token_data: dict = Depends(verify_token),  # noqa: B008
) -> RespuestaEstructurada:
    _exigir_superadmin(token_data)
    try:
        farmacia_uuid = UUID(farmacia_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"'{farmacia_id}' no es un UUID válido.",
        ) from e

    try:
        async with get_connection() as conn:
            row = await conn.fetchrow(
                _UPDATE_ESTADO, farmacia_uuid, payload.estado_afiliacion.value
            )
    except asyncpg.PostgresError as e:
        logger.error("[ADMIN] Error BD cambiar estado [id=%s]: %s", farmacia_id, e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error interno al cambiar el estado.",
        ) from e

    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No existe una farmacia con id '{farmacia_id}'.",
        )

    return RespuestaEstructurada(
        status="success",
        message="Estado actualizado.",
        data={
            "id": str(row["id"]),
            "nombre": row["nombre"],
            "estado_afiliacion": row["estado_afiliacion"],
        },
    )
```
Nota: `payload.estado_afiliacion.value` porque `EstadoAfiliacion` es `StrEnum`.

- [ ] **Step 5: Ejecutar los tests — deben PASAR**

Run: `.venv/bin/python -m pytest tests/test_admin_estado.py -v`
Expected: 5 passed

- [ ] **Step 6: Suite completa + lint + commit**

```bash
.venv/bin/python -m pytest -q
.venv/bin/ruff check src/dosisya/routers/admin_super.py src/dosisya/models.py src/dosisya/routers/auth.py
git add src/dosisya/routers/admin_super.py src/dosisya/models.py tests/test_admin_estado.py
git commit -m "feat(admin): PATCH /api/v1/admin/farmacias/{id}/estado"
```
Expected: toda la suite en PASS, ruff limpio.

---

## PARTE B — FRONTEND (repo `DosisYa-Frontend`)

> Verificación de cada task: `npx tsc --noEmit && npm run build`. No hay runner de tests.

### Task 6: Tipos + cliente API del súper admin

**Files:**
- Create: `src/lib/adminApi.ts`

**Interfaces:**
- Produces: tipos `FarmaciaAdmin`, `TotalesRed`, `AdminFarmaciasResponse`; funciones `adminLogin(correo,password)`, `getFarmaciasAdmin(token)`, `cambiarEstadoFarmacia(token,id,estado)`. Reusa `API_BASE` de `src/lib/api.ts`.

- [ ] **Step 1: Crear el cliente**

Create `src/lib/adminApi.ts`:
```ts
import { API_BASE } from "@/lib/api";

export type EstadoAfiliacion = "pendiente" | "activa" | "inactiva";

export interface FarmaciaAdmin {
  id: string;
  nombre: string;
  whatsapp: string;
  sector: string;
  punto_referencia: string;
  estado_afiliacion: EstadoAfiliacion;
  nivel_suscripcion: "gratuita" | "premium";
  created_at: string;
  leads_mes: number;
  deuda_usd: number;
}

export interface TotalesRed {
  total_farmacias: number;
  pendientes: number;
  leads_mes_red: number;
  deuda_red_usd: number;
}

export interface AdminFarmaciasResponse {
  farmacias: FarmaciaAdmin[];
  totales: TotalesRed;
}

export interface AdminLoginResponse {
  auth_token: string;
  rol: "superadmin";
  email: string;
  usuario_id: string;
}

export async function adminLogin(
  correo: string,
  password: string,
): Promise<AdminLoginResponse> {
  const res = await fetch(`${API_BASE}/api/v1/auth/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ correo, password }),
  });
  if (!res.ok) throw new Error("Credenciales inválidas");
  const json = await res.json();
  return json.data as AdminLoginResponse;
}

export async function getFarmaciasAdmin(
  token: string,
): Promise<AdminFarmaciasResponse> {
  const res = await fetch(`${API_BASE}/api/v1/admin/farmacias`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401 || res.status === 403) throw new Error("UNAUTHORIZED");
  if (!res.ok) throw new Error("No se pudo cargar la lista de farmacias");
  const json = await res.json();
  return json.data as AdminFarmaciasResponse;
}

export async function cambiarEstadoFarmacia(
  token: string,
  id: string,
  estado: EstadoAfiliacion,
): Promise<void> {
  const res = await fetch(`${API_BASE}/api/v1/admin/farmacias/${id}/estado`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ estado_afiliacion: estado }),
  });
  if (res.status === 401 || res.status === 403) throw new Error("UNAUTHORIZED");
  if (!res.ok) throw new Error("No se pudo cambiar el estado");
}
```

- [ ] **Step 2: Verificar tipos y commit**

Run: `npx tsc --noEmit && npm run build`
Expected: sin errores.
```bash
git add src/lib/adminApi.ts
git commit -m "feat(super): cliente API del súper admin (adminApi.ts)"
```

---

### Task 7: Guard de rol

**Files:**
- Create: `src/lib/adminAuth.ts`

**Interfaces:**
- Produces: `guardarSesionSuper(r: AdminLoginResponse)`, `getSuperToken(): string | null`, `esSuperadmin(): boolean`, `cerrarSesionSuper()`. Claves localStorage: `super_token`, `super_rol`, `super_email` (namespaced, distintas de las de farmacia).

- [ ] **Step 1: Crear el helper**

Create `src/lib/adminAuth.ts`:
```ts
import type { AdminLoginResponse } from "@/lib/adminApi";

const K_TOKEN = "super_token";
const K_ROL = "super_rol";
const K_EMAIL = "super_email";

export function guardarSesionSuper(r: AdminLoginResponse): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(K_TOKEN, r.auth_token);
  localStorage.setItem(K_ROL, r.rol);
  localStorage.setItem(K_EMAIL, r.email);
}

export function getSuperToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(K_TOKEN);
}

export function esSuperadmin(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(localStorage.getItem(K_TOKEN)) &&
    localStorage.getItem(K_ROL) === "superadmin";
}

export function cerrarSesionSuper(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(K_TOKEN);
  localStorage.removeItem(K_ROL);
  localStorage.removeItem(K_EMAIL);
}
```

- [ ] **Step 2: Verificar y commit**

Run: `npx tsc --noEmit && npm run build`
```bash
git add src/lib/adminAuth.ts
git commit -m "feat(super): guard de sesión del súper admin (adminAuth.ts)"
```

---

### Task 8: Ruta `super.login.tsx`

**Files:**
- Create: `src/routes/super.login.tsx`

**Interfaces:**
- Consumes: `adminLogin`, `guardarSesionSuper`. Navega a `/super/dashboard` al éxito.

- [ ] **Step 1: Crear la ruta**

Create `src/routes/super.login.tsx`:
```tsx
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2, Lock, Mail, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adminLogin } from "@/lib/adminApi";
import { guardarSesionSuper } from "@/lib/adminAuth";

export const Route = createFileRoute("/super/login")({
  head: () => ({ meta: [{ title: "DosisYa — Súper Admin" }] }),
  component: SuperLogin,
});

function SuperLogin() {
  const navigate = useNavigate();
  const [correo, setCorreo] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const r = await adminLogin(correo.trim().toLowerCase(), password);
      guardarSesionSuper(r);
      navigate({ to: "/super/dashboard" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-muted via-background to-accent px-4">
      <div className="w-full max-w-sm rounded-2xl border bg-card p-6 sm:p-8 shadow-[0_20px_60px_-20px_rgba(10,36,99,0.25)]">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <div className="text-lg font-bold">Panel Súper Admin</div>
            <div className="text-xs text-muted-foreground">Acceso restringido</div>
          </div>
        </div>

        <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="s-correo">Correo</Label>
            <div className="relative">
              <Mail className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input id="s-correo" type="email" autoComplete="email" required
                value={correo} onChange={(e) => setCorreo(e.target.value)}
                placeholder="admin@dosisya.com" className="pl-9 h-11" maxLength={255} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="s-pass">Contraseña</Label>
            <div className="relative">
              <Lock className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input id="s-pass" type="password" autoComplete="current-password" required
                value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••" className="pl-9 h-11" maxLength={128} />
            </div>
          </div>
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
              {error}
            </div>
          )}
          <Button type="submit" disabled={loading}
            className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold">
            {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Ingresando…</> : "Iniciar sesión"}
          </Button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar (rutas se regeneran en build) y commit**

Run: `npx tsc --noEmit && npm run build`
Expected: `src/routeTree.gen.ts` se regenera con `/super/login`; sin errores.
```bash
git add src/routes/super.login.tsx src/routeTree.gen.ts
git commit -m "feat(super): ruta /super/login"
```

---

### Task 9: Ruta `super.dashboard.tsx` — shell + guard + data

**Files:**
- Create: `src/routes/super.dashboard.tsx`
- Create: `src/components/super/TablaFarmacias.tsx` (stub que se completa en Task 10)
- Create: `src/components/super/TablaFacturacion.tsx` (stub que se completa en Task 11)

**Interfaces:**
- Consumes: `getFarmaciasAdmin`, `getSuperToken`, `esSuperadmin`, `cerrarSesionSuper`, `useQuery`.
- Produces: pasa `data: AdminFarmaciasResponse`, `token`, `onReload` a los componentes hijos.

- [ ] **Step 1: Crear stubs de los componentes hijos**

Create `src/components/super/TablaFarmacias.tsx`:
```tsx
import type { AdminFarmaciasResponse } from "@/lib/adminApi";

export function TablaFarmacias({ data }: { data: AdminFarmaciasResponse; token: string; onReload: () => void }) {
  return <div className="text-sm text-muted-foreground">Farmacias: {data.farmacias.length}</div>;
}
```

Create `src/components/super/TablaFacturacion.tsx`:
```tsx
import type { AdminFarmaciasResponse } from "@/lib/adminApi";

export function TablaFacturacion({ data }: { data: AdminFarmaciasResponse }) {
  return <div className="text-sm text-muted-foreground">Deuda red: ${data.totales.deuda_red_usd.toFixed(2)}</div>;
}
```

- [ ] **Step 2: Crear el dashboard con guard + useQuery**

Create `src/routes/super.dashboard.tsx`:
```tsx
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Building2, Receipt, LogOut, Loader2 } from "lucide-react";
import { getFarmaciasAdmin } from "@/lib/adminApi";
import { getSuperToken, esSuperadmin, cerrarSesionSuper } from "@/lib/adminAuth";
import { TablaFarmacias } from "@/components/super/TablaFarmacias";
import { TablaFacturacion } from "@/components/super/TablaFacturacion";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/super/dashboard")({
  head: () => ({ meta: [{ title: "Súper Admin — DosisYa" }] }),
  component: SuperDashboard,
});

type Seccion = "farmacias" | "facturacion";

function SuperDashboard() {
  const navigate = useNavigate();
  const [seccion, setSeccion] = useState<Seccion>("farmacias");
  const [ready, setReady] = useState(false);

  // Guard: sin sesión superadmin → login.
  useEffect(() => {
    if (!esSuperadmin()) {
      navigate({ to: "/super/login" });
      return;
    }
    setReady(true);
  }, [navigate]);

  const token = getSuperToken() ?? "";
  const query = useQuery({
    queryKey: ["admin-farmacias"],
    queryFn: () => getFarmaciasAdmin(token),
    enabled: ready && Boolean(token),
  });

  // 401/403 → cerrar sesión.
  useEffect(() => {
    if (query.error instanceof Error && query.error.message === "UNAUTHORIZED") {
      cerrarSesionSuper();
      navigate({ to: "/super/login" });
    }
  }, [query.error, navigate]);

  if (!ready) return null;

  const logout = () => {
    cerrarSesionSuper();
    navigate({ to: "/super/login" });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="font-bold">DosisYa · Súper Admin</div>
          <Button variant="ghost" size="sm" onClick={logout}>
            <LogOut className="h-4 w-4 mr-1" /> Salir
          </Button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6">
        <nav className="flex gap-2 mb-6">
          <TabBtn active={seccion === "farmacias"} onClick={() => setSeccion("farmacias")}
            icon={<Building2 className="h-4 w-4" />} label="Farmacias" />
          <TabBtn active={seccion === "facturacion"} onClick={() => setSeccion("facturacion")}
            icon={<Receipt className="h-4 w-4" />} label="Facturación" />
        </nav>

        {query.isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : query.isError ? (
          <div className="text-sm text-destructive">
            No pudimos cargar los datos. <button className="underline" onClick={() => query.refetch()}>Reintentar</button>
          </div>
        ) : query.data ? (
          seccion === "farmacias" ? (
            <TablaFarmacias data={query.data} token={token} onReload={() => query.refetch()} />
          ) : (
            <TablaFacturacion data={query.data} />
          )
        ) : null}
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, icon, label }: {
  active: boolean; onClick: () => void; icon: React.ReactNode; label: string;
}) {
  return (
    <button onClick={onClick}
      className={`inline-flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium transition-colors ${
        active ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-accent"
      }`}>
      {icon} {label}
    </button>
  );
}
```

- [ ] **Step 3: Verificar y commit**

Run: `npx tsc --noEmit && npm run build`
Expected: `/super/dashboard` en `routeTree.gen.ts`; sin errores.
```bash
git add src/routes/super.dashboard.tsx src/components/super/ src/routeTree.gen.ts
git commit -m "feat(super): dashboard shell con guard de rol y carga de datos"
```

---

### Task 10: `TablaFarmacias` — filtro + acciones de estado

**Files:**
- Modify: `src/components/super/TablaFarmacias.tsx` (reemplazar el stub)

**Interfaces:**
- Consumes: `cambiarEstadoFarmacia`, `useMutation`, `useQueryClient`, `AdminFarmaciasResponse`, `EstadoAfiliacion`. Renderiza `EditarFarmaciaDrawer` (Task 11) — hasta entonces, botón Editar no-op.

- [ ] **Step 1: Implementar la tabla con filtro y mutación de estado**

Replace `src/components/super/TablaFarmacias.tsx`:
```tsx
import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cambiarEstadoFarmacia, type AdminFarmaciasResponse, type EstadoAfiliacion, type FarmaciaAdmin } from "@/lib/adminApi";
import { Button } from "@/components/ui/button";

const FILTROS: Array<{ value: "todas" | EstadoAfiliacion; label: string }> = [
  { value: "todas", label: "Todas" },
  { value: "pendiente", label: "Pendientes" },
  { value: "activa", label: "Activas" },
  { value: "inactiva", label: "Suspendidas" },
];

const BADGE: Record<EstadoAfiliacion, string> = {
  pendiente: "bg-amber-100 text-amber-800 border-amber-200",
  activa: "bg-emerald-100 text-emerald-800 border-emerald-200",
  inactiva: "bg-rose-100 text-rose-800 border-rose-200",
};

export function TablaFarmacias({
  data, token, onReload,
}: { data: AdminFarmaciasResponse; token: string; onReload: () => void }) {
  const qc = useQueryClient();
  const [filtro, setFiltro] = useState<"todas" | EstadoAfiliacion>("todas");

  const mut = useMutation({
    mutationFn: ({ id, estado }: { id: string; estado: EstadoAfiliacion }) =>
      cambiarEstadoFarmacia(token, id, estado),
    onSuccess: () => {
      toast.success("Estado actualizado");
      qc.invalidateQueries({ queryKey: ["admin-farmacias"] });
      onReload();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });

  const filas = useMemo(
    () => data.farmacias.filter((f) => filtro === "todas" || f.estado_afiliacion === filtro),
    [data.farmacias, filtro],
  );

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {FILTROS.map((f) => (
          <button key={f.value} onClick={() => setFiltro(f.value)}
            className={`h-8 px-3 rounded-full text-xs font-medium border ${
              filtro === f.value ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-accent"
            }`}>
            {f.label}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="text-left font-medium px-3 py-2">Farmacia</th>
              <th className="text-left font-medium px-3 py-2">Sector</th>
              <th className="text-left font-medium px-3 py-2">Estado</th>
              <th className="text-right font-medium px-3 py-2">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <Fila key={f.id} f={f} pending={mut.isPending}
                onEstado={(estado) => mut.mutate({ id: f.id, estado })} />
            ))}
            {filas.length === 0 && (
              <tr><td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">Sin farmacias en este filtro.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Fila({ f, pending, onEstado }: {
  f: FarmaciaAdmin; pending: boolean; onEstado: (e: EstadoAfiliacion) => void;
}) {
  return (
    <tr className="border-t">
      <td className="px-3 py-2">
        <div className="font-medium text-foreground">{f.nombre}</div>
        <div className="text-xs text-muted-foreground">{f.whatsapp}</div>
      </td>
      <td className="px-3 py-2 text-muted-foreground">{f.sector}</td>
      <td className="px-3 py-2">
        <span className={`inline-block text-xs px-2 py-0.5 rounded-full border ${BADGE[f.estado_afiliacion]}`}>
          {f.estado_afiliacion}
        </span>
      </td>
      <td className="px-3 py-2">
        <div className="flex gap-1.5 justify-end">
          {f.estado_afiliacion === "pendiente" && (
            <>
              <Button size="sm" disabled={pending} onClick={() => onEstado("activa")}>Aprobar</Button>
              <Button size="sm" variant="outline" disabled={pending} onClick={() => onEstado("inactiva")}>Rechazar</Button>
            </>
          )}
          {f.estado_afiliacion === "activa" && (
            <Button size="sm" variant="outline" disabled={pending} onClick={() => onEstado("inactiva")}>Suspender</Button>
          )}
          {f.estado_afiliacion === "inactiva" && (
            <Button size="sm" disabled={pending} onClick={() => onEstado("activa")}>Reactivar</Button>
          )}
        </div>
      </td>
    </tr>
  );
}
```

- [ ] **Step 2: Verificar en el navegador (preview)**

Levantar el dev server, iniciar sesión en `/super/login` (con el superadmin sembrado en Task 2 contra tu BD de dev), y verificar que la tabla lista farmacias, el filtro funciona y "Aprobar" cambia el estado (toast + refetch). Si no hay backend de dev con datos, verificar al menos el render y tipos.

Run: `npx tsc --noEmit && npm run build`

- [ ] **Step 3: Commit**

```bash
git add src/components/super/TablaFarmacias.tsx
git commit -m "feat(super): tabla de farmacias con filtro y acciones de estado"
```

---

### Task 11: `EditarFarmaciaDrawer` — editar cualquier farmacia

**Files:**
- Create: `src/components/super/EditarFarmaciaDrawer.tsx`
- Modify: `src/components/super/TablaFarmacias.tsx` (integrar el drawer en el botón Editar)

**Interfaces:**
- Consumes: `PATCH /api/v1/farmacias/{id}` (endpoint existente, superadmin-aware) con body `{nombre_farmacia, whatsapp, sector, punto_referencia}`; `getSuperToken`; `vaul` Drawer; `FarmaciaAdmin`.
- Produces: `EditarFarmaciaDrawer({ farmacia, token, open, onOpenChange, onSaved })`.

- [ ] **Step 1: Crear el drawer**

Create `src/components/super/EditarFarmaciaDrawer.tsx`:
```tsx
import { useState } from "react";
import { Drawer } from "vaul";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { API_BASE } from "@/lib/api";
import type { FarmaciaAdmin } from "@/lib/adminApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const formatoTelefonoVE = (raw: string) => {
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("58")) d = d.slice(2);
  if (d.startsWith("0")) d = d.slice(1);
  d = d.slice(0, 10);
  return d ? `+58${d}` : "";
};

export function EditarFarmaciaDrawer({
  farmacia, token, open, onOpenChange, onSaved,
}: {
  farmacia: FarmaciaAdmin | null;
  token: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
}) {
  const [nombre, setNombre] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [sector, setSector] = useState("");
  const [referencia, setReferencia] = useState("");
  const [saving, setSaving] = useState(false);

  // Precargar al abrir.
  const cargar = (f: FarmaciaAdmin) => {
    setNombre(f.nombre); setWhatsapp(f.whatsapp);
    setSector(f.sector); setReferencia(f.punto_referencia);
  };

  const onOpen = (o: boolean) => {
    if (o && farmacia) cargar(farmacia);
    onOpenChange(o);
  };

  const guardar = async () => {
    if (!farmacia) return;
    if (!/^\+58\d{10}$/.test(whatsapp)) {
      toast.error("WhatsApp: +58 seguido de 10 dígitos");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/farmacias/${farmacia.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          nombre_farmacia: nombre, whatsapp, sector, punto_referencia: referencia,
        }),
      });
      if (!res.ok) throw new Error("No se pudo guardar");
      toast.success("Farmacia actualizada");
      onSaved();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer.Root open={open} onOpenChange={onOpen}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/40 z-50" />
        <Drawer.Content className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl bg-card p-6 max-h-[90vh] overflow-auto">
          <Drawer.Title className="text-lg font-bold">Editar farmacia</Drawer.Title>
          <div className="mt-4 space-y-4 max-w-md">
            <div className="space-y-1.5">
              <Label htmlFor="e-nombre">Nombre</Label>
              <Input id="e-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={200} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="e-wa">WhatsApp</Label>
              <Input id="e-wa" value={whatsapp} onChange={(e) => setWhatsapp(formatoTelefonoVE(e.target.value))}
                placeholder="+584121234567" maxLength={13} inputMode="tel" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="e-sector">Sector</Label>
              <Input id="e-sector" value={sector} onChange={(e) => setSector(e.target.value)} maxLength={100} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="e-ref">Punto de referencia</Label>
              <Input id="e-ref" value={referencia} onChange={(e) => setReferencia(e.target.value)} maxLength={180} />
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
              <Button onClick={guardar} disabled={saving} className="flex-1">
                {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Guardando…</> : "Guardar cambios"}
              </Button>
            </div>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
```

- [ ] **Step 2: Integrar el drawer en `TablaFarmacias.tsx`**

En `src/components/super/TablaFarmacias.tsx`:
1. Importar: `import { EditarFarmaciaDrawer } from "@/components/super/EditarFarmaciaDrawer";`
2. Añadir estado en `TablaFarmacias`: `const [editar, setEditar] = useState<FarmaciaAdmin | null>(null);`
3. Pasar `onEditar={() => setEditar(f)}` a cada `<Fila>` y añadir el prop en `Fila` para renderizar un botón "Editar" en los estados `activa` e `inactiva`:
```tsx
<Button size="sm" variant="ghost" disabled={pending} onClick={onEditar}>Editar</Button>
```
4. Antes del cierre de `TablaFarmacias`, renderizar:
```tsx
<EditarFarmaciaDrawer
  farmacia={editar}
  token={token}
  open={editar !== null}
  onOpenChange={(o) => { if (!o) setEditar(null); }}
  onSaved={() => { onReload(); }}
/>
```
5. Actualizar la firma de `Fila` para aceptar `onEditar: () => void`.

- [ ] **Step 3: Verificar y commit**

Run: `npx tsc --noEmit && npm run build`
Verificar en preview: abrir Editar, cambiar WhatsApp, guardar → toast + refetch.
```bash
git add src/components/super/EditarFarmaciaDrawer.tsx src/components/super/TablaFarmacias.tsx
git commit -m "feat(super): editar cualquier farmacia vía drawer (reusa PATCH existente)"
```

---

### Task 12: `TablaFacturacion` — tabla por farmacia + totales

**Files:**
- Modify: `src/components/super/TablaFacturacion.tsx` (reemplazar el stub)

**Interfaces:**
- Consumes: `AdminFarmaciasResponse`.

- [ ] **Step 1: Implementar la tabla de facturación**

Replace `src/components/super/TablaFacturacion.tsx`:
```tsx
import type { AdminFarmaciasResponse } from "@/lib/adminApi";

export function TablaFacturacion({ data }: { data: AdminFarmaciasResponse }) {
  const { farmacias, totales } = data;
  const conDeuda = [...farmacias].sort((a, b) => b.deuda_usd - a.deuda_usd);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Kpi label="Farmacias" value={totales.total_farmacias.toString()} />
        <Kpi label="Pendientes" value={totales.pendientes.toString()} />
        <Kpi label="Leads del mes (red)" value={totales.leads_mes_red.toString()} />
        <Kpi label="Deuda red (USD)" value={`$${totales.deuda_red_usd.toFixed(2)}`} />
      </div>

      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="text-left font-medium px-3 py-2">Farmacia</th>
              <th className="text-left font-medium px-3 py-2">Estado</th>
              <th className="text-right font-medium px-3 py-2">Leads mes</th>
              <th className="text-right font-medium px-3 py-2">Deuda (USD)</th>
            </tr>
          </thead>
          <tbody>
            {conDeuda.map((f) => (
              <tr key={f.id} className="border-t">
                <td className="px-3 py-2 font-medium text-foreground">{f.nombre}</td>
                <td className="px-3 py-2 text-muted-foreground">{f.estado_afiliacion}</td>
                <td className="px-3 py-2 text-right">{f.leads_mes}</td>
                <td className="px-3 py-2 text-right font-semibold">${f.deuda_usd.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xl font-bold text-foreground mt-1">{value}</div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar y commit**

Run: `npx tsc --noEmit && npm run build`
Verificar en preview: la pestaña Facturación muestra KPIs y la tabla por farmacia.
```bash
git add src/components/super/TablaFacturacion.tsx
git commit -m "feat(super): tabla de facturación por farmacia + totales de red"
```

---

### Task 13: Mensaje del wizard de registro (farmacia queda pendiente)

**Files:**
- Modify: `src/routes/admin.login.tsx` (bloque `done` de `RegisterCard`, ~líneas 496-510, y el `setTimeout` que navega al dashboard ~488)

**Interfaces:**
- Consumes: —. Ajusta copy y evita mandar a `/admin/dashboard` como si estuviera activa.

- [ ] **Step 1: Cambiar el copy y el destino post-registro**

En `src/routes/admin.login.tsx`, dentro de `handleStep3`, reemplazar:
```tsx
      setDone(true);
      setTimeout(() => navigate({ to: "/admin/dashboard" }), 900);
```
por:
```tsx
      setDone(true);
      // La farmacia entra en estado 'pendiente' (gate de aprobación del súper admin):
      // no aparece en búsquedas hasta que un superadmin la apruebe. Igual la llevamos
      // a su panel; el dashboard funciona, solo que aún no recibe leads.
      setTimeout(() => navigate({ to: "/admin/dashboard" }), 1600);
```
Y en el bloque `if (done)` reemplazar el texto:
```tsx
        <h2 className="mt-4 text-xl font-bold text-foreground">
          ¡Bienvenido a DosisYa!
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Llevándote a tu panel…
        </p>
```
por:
```tsx
        <h2 className="mt-4 text-xl font-bold text-foreground">
          ¡Recibimos tu afiliación!
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Estamos revisando tu farmacia. Te activaremos pronto para que empieces a
          recibir pacientes. Mientras, ya puedes preparar tu inventario en el panel.
        </p>
```

- [ ] **Step 2: Verificar y commit**

Run: `npx tsc --noEmit && npm run build`
```bash
git add src/routes/admin.login.tsx
git commit -m "feat(registro): copy de afiliación pendiente (gate de aprobación)"
```

---

## Cierre — verificación integral (manual, operador)

1. **Backend:** correr `db/migrations/005_estado_pendiente.sql` en Supabase; correr `.venv/bin/python -m scripts.set_superadmin_password admin@dosisya.com` para fijar la contraseña.
2. **Desplegar** backend y frontend juntos (el gate cambia el comportamiento de registro en producción).
3. **E2E:** registrar una farmacia de prueba → confirmar que entra `pendiente` y NO aparece en búsquedas → entrar a `/super/login` → aprobarla → confirmar que ya aparece → suspenderla → confirmar que desaparece → editar sus datos → revisar la pestaña Facturación.

## Notas de riesgo

- `ALTER TYPE ... ADD VALUE` corre en su propia migración (Task 1).
- El superadmin sembrado tiene hash placeholder hasta correr el script (Task 2) — sin eso, el login siempre da 401.
- `sub` del JWT superadmin = `usuario_id` (no farmacia). Los endpoints `/admin/*` no asumen que `sub` sea farmacia.
