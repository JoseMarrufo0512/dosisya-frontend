# Registro de paciente v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el login OTP-WhatsApp del paciente por registro/login con formulario (correo+contraseña) y con Google, captando nombre, apellido, correo, teléfono, documento (obligatorio) y género (opcional).

**Architecture:** Full-stack en dos repos. **Fase 1 (DosisYa-Backend):** migración 015 + endpoints nuevos en `routers/pacientes_auth.py`, reusando `dosisya.security` (JWT HS256 + cookie HttpOnly) y `bcrypt`. **Fase 2 (DosisYa-Frontend):** UI nueva en `HojaLoginPaciente.tsx`, cliente `pacienteApi.ts`/`pacienteAuth.ts`, Google Identity Services y CSP. El contrato lo fija la Fase 1; la Fase 2 lo consume.

**Tech Stack:** Backend FastAPI + asyncpg + PyJWT + bcrypt + google-auth + slowapi (limiter). Frontend React 19 + TanStack + Zod + React Hook Form + Google Identity Services.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-10-26-registro-paciente-v2-design.md`.
- Backend autorizado expresamente por José para esta feature.
- JWT vía `dosisya.security.create_jwt_token(id, rol, nombre="")`; sesión de paciente = `rol="paciente"`; pre-registro Google = `rol="paciente_preregistro"`.
- Respuestas backend en envelope `{"data": {...}}` (igual que el router actual).
- Contraseña: mínimo 8 caracteres. bcrypt (`hashpw`/`checkpw`, bytes UTF-8).
- Género (valores canónicos en BD): `femenino | masculino | no_binario | no_especifica`.
- `documento` es PII sensible → `pacientes` con RLS, sin lectura anónima.
- Email env vars: `GOOGLE_OAUTH_CLIENT_ID` (backend) y `VITE_GOOGLE_CLIENT_ID` (frontend) = el mismo Client ID (lo aporta José).
- Frontend: verificación `npx tsc --noEmit && npm run build`. Backend: `pytest`.
- Atribución de commit: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- Orden de deploy: migración 015 → env vars → backend → frontend (validar Google y `/api/v1/paciente/*` 200 en preview).

---

## FASE 1 — Backend (repo DosisYa-Backend)

Rutas en este repo son relativas a `/home/josemarrufo/Escritorio/DosisYa-Backend`.

### Task B1: Migración 015 (esquema de pacientes v2)

**Files:**
- Create: `db/migrations/015_pacientes_registro_v2.sql`

**Interfaces:**
- Produces: columnas `apellido, correo, documento, genero, password_hash, google_sub` en `pacientes`; índices únicos parciales `uq_pacientes_correo|documento|google`.

- [ ] **Step 1: Escribir la migración**

```sql
-- ============================================================
-- DosisYa — Migración 015: registro de paciente v2.
-- Añade identidad por correo/contraseña y Google al paciente.
-- Ejecutar UNA SOLA VEZ contra Supabase (SQL Editor o psql).
-- Dependencia de deploy: aplicar ANTES de desplegar el router v2.
-- ============================================================
BEGIN;

ALTER TABLE pacientes
  ADD COLUMN IF NOT EXISTS apellido      TEXT,
  ADD COLUMN IF NOT EXISTS correo        TEXT,
  ADD COLUMN IF NOT EXISTS documento     TEXT,
  ADD COLUMN IF NOT EXISTS genero        TEXT,
  ADD COLUMN IF NOT EXISTS password_hash TEXT,
  ADD COLUMN IF NOT EXISTS google_sub    TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_pacientes_correo
  ON pacientes (lower(correo))  WHERE correo     IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_pacientes_documento
  ON pacientes (documento)      WHERE documento  IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_pacientes_google
  ON pacientes (google_sub)     WHERE google_sub IS NOT NULL;

DO $$ BEGIN
  ALTER TABLE pacientes
    ADD CONSTRAINT chk_pacientes_genero
    CHECK (genero IS NULL OR genero IN ('femenino','masculino','no_binario','no_especifica'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMIT;
```

- [ ] **Step 2: Revisar que `schema.sql` documente el estado final**

Si `db/schema.sql` refleja el DDL consolidado, añadir las 6 columnas y los 3 índices a la definición de `pacientes` allí (solo documentación del estado; la migración es la fuente de aplicación). Si `schema.sql` no incluía `pacientes` (hoy no aparece en el grep), dejar solo la migración y anotarlo.

- [ ] **Step 3: Commit**

```bash
git add db/migrations/015_pacientes_registro_v2.sql db/schema.sql
git commit -m "$(cat <<'EOF'
feat(db): migración 015 — registro de paciente v2 (correo/contraseña + Google)

Añade a pacientes: apellido, correo, documento, genero, password_hash,
google_sub; índices únicos parciales de correo/documento/google y CHECK de
genero. Columnas nullable: la obligatoriedad se exige en la API.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task B2: Extender `create_jwt_token` (claims extra + TTL corto)

**Files:**
- Modify: `src/dosisya/security.py` (función `create_jwt_token`)
- Test: `tests/test_security.py`

**Interfaces:**
- Produces: `create_jwt_token(id, rol, nombre="", nombre_farmacia=None, extra_claims: dict | None = None, ttl_seconds: int | None = None)`. Backward-compatible: sin los dos nuevos kwargs se comporta igual que hoy.

- [ ] **Step 1: Escribir el test**

```python
# tests/test_security.py  (añadir)
import jwt as _jwt
from dosisya.security import create_jwt_token, _get_secret, _JWT_ALGORITHM

def test_create_jwt_token_extra_claims_y_ttl():
    tok = create_jwt_token("pac-1", rol="paciente_preregistro", nombre="Ana",
                            extra_claims={"correo": "a@b.com", "google_sub": "g1"},
                            ttl_seconds=900)
    payload = _jwt.decode(tok, _get_secret(), algorithms=[_JWT_ALGORITHM])
    assert payload["sub"] == "pac-1"
    assert payload["rol"] == "paciente_preregistro"
    assert payload["correo"] == "a@b.com"
    assert payload["google_sub"] == "g1"
    assert payload["exp"] - payload["iat"] == 900
```

- [ ] **Step 2: Correr el test y verlo fallar**

Run: `pytest tests/test_security.py::test_create_jwt_token_extra_claims_y_ttl -v`
Expected: FAIL (TypeError: unexpected keyword argument 'extra_claims').

- [ ] **Step 3: Implementar la extensión**

En `create_jwt_token`, cambiar la firma y el cálculo de `exp`/`payload`:

```python
def create_jwt_token(
    farmacia_id: str,
    rol: str,
    nombre: str = "",
    nombre_farmacia: str | None = None,
    extra_claims: dict | None = None,
    ttl_seconds: int | None = None,
) -> str:
    display = nombre_farmacia if nombre_farmacia is not None else nombre
    now = datetime.now(UTC)
    ttl_days = int(os.environ.get("JWT_TTL_DAYS", "7"))
    exp = now + (timedelta(seconds=ttl_seconds) if ttl_seconds is not None
                 else timedelta(days=ttl_days))
    payload = {
        "sub": farmacia_id,
        "rol": rol,
        "nombre": display,
        "nombre_farmacia": display,
        "iat": now,
        "exp": exp,
    }
    if extra_claims:
        payload.update(extra_claims)
    return jwt.encode(payload, _get_secret(), algorithm=_JWT_ALGORITHM)
```

- [ ] **Step 4: Correr el test y verlo pasar**

Run: `pytest tests/test_security.py::test_create_jwt_token_extra_claims_y_ttl -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/dosisya/security.py tests/test_security.py
git commit -m "feat(security): create_jwt_token admite extra_claims y ttl_seconds

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task B3: Helpers v2 + registro por correo (`POST /paciente/registro`)

**Files:**
- Modify: `src/dosisya/routers/pacientes_auth.py`
- Test: `tests/test_pacientes_auth_v2.py`

**Interfaces:**
- Consumes: `get_connection`, `create_jwt_token`, `bcrypt`, `normalizar_telefono` (ya en el módulo).
- Produces: helpers `hash_password`, `verificar_password`, `normalizar_correo`, `normalizar_documento`, `_sesion_response(row, token)`; endpoint `POST /api/v1/paciente/registro`.

- [ ] **Step 1: Escribir los tests (helpers + registro)**

```python
# tests/test_pacientes_auth_v2.py
import pytest
from httpx import AsyncClient, ASGITransport
from dosisya.main import app  # ajustar si el app vive en otro módulo
from dosisya.routers.pacientes_auth import (
    hash_password, verificar_password, normalizar_correo,
)

def test_hash_y_verificar_password():
    h = hash_password("supersecreta")
    assert h != "supersecreta"
    assert verificar_password("supersecreta", h) is True
    assert verificar_password("otra", h) is False

def test_normalizar_correo():
    assert normalizar_correo("  Ana@B.COM ") == "ana@b.com"

@pytest.mark.anyio
async def test_registro_crea_cuenta_y_devuelve_sesion(db_limpia):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        r = await c.post("/api/v1/paciente/registro", json={
            "nombre": "Ana", "apellido": "Pérez", "correo": "ana@b.com",
            "telefono": "04141234567", "documento": "V12345678",
            "genero": "femenino", "password": "supersecreta",
        })
    assert r.status_code == 201
    data = r.json()["data"]
    assert data["correo"] == "ana@b.com"
    assert data["auth_token"]
    assert "password" not in data and "password_hash" not in data

@pytest.mark.anyio
async def test_registro_correo_duplicado_409(db_con_ana):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        r = await c.post("/api/v1/paciente/registro", json={
            "nombre": "Otra", "apellido": "X", "correo": "ana@b.com",
            "telefono": "04149999999", "documento": "V99999999",
            "password": "supersecreta",
        })
    assert r.status_code == 409
    assert r.json()["detail"]["code"] == "correo_en_uso"
```

> Fixtures `db_limpia`/`db_con_ana`: usar el patrón de fixtures de BD ya existente en `tests/` del backend (conexión a la BD de pruebas). Si no hay BD de pruebas aislada (ver memoria `qa-local-dev-db-constraint`), marcar estos tests `@pytest.mark.integration` y correrlos manualmente con `!`; los tests de helpers (sin BD) corren siempre.

- [ ] **Step 2: Correr y ver fallar**

Run: `pytest tests/test_pacientes_auth_v2.py -v`
Expected: FAIL (ImportError de helpers / 404 del endpoint).

- [ ] **Step 3: Implementar helpers + endpoint de registro**

Añadir imports y helpers al inicio del módulo (junto a los OTP existentes):

```python
import asyncpg
from pydantic import BaseModel, field_validator

_CORREO_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verificar_password(pw: str, pw_hash: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode("utf-8"), pw_hash.encode("utf-8"))
    except (ValueError, TypeError):
        return False

def normalizar_correo(raw: str) -> str:
    return (raw or "").strip().lower()

def normalizar_documento(raw: str) -> str:
    return re.sub(r"\s+", "", (raw or "")).upper()

class RegistroRequest(BaseModel):
    nombre: str
    apellido: str
    correo: str
    telefono: str
    documento: str
    genero: str | None = None
    password: str

    @field_validator("password")
    @classmethod
    def _pw_min(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("La contraseña debe tener al menos 8 caracteres.")
        return v

    @field_validator("genero")
    @classmethod
    def _genero_valido(cls, v: str | None) -> str | None:
        if v is None:
            return None
        if v not in ("femenino", "masculino", "no_binario", "no_especifica"):
            raise ValueError("Género inválido.")
        return v

def _sesion_response(row, token: str, status_code: int = 200) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={"data": {
            "paciente_id": str(row["id"]),
            "auth_token": token,
            "nombre": row["nombre"] or "",
            "apellido": row["apellido"] or "",
            "correo": row["correo"] or "",
            "telefono": row["telefono"] or "",
            "documento": row["documento"] or "",
            "genero": row["genero"],
        }},
    )

def _conflicto_409(constraint: str | None) -> HTTPException:
    mapa = {
        "uq_pacientes_correo": "correo_en_uso",
        "uq_pacientes_documento": "documento_en_uso",
        "pacientes_telefono_key": "telefono_en_uso",
        "uq_pacientes_google": "google_en_uso",
    }
    code = mapa.get(constraint or "", "registro_duplicado")
    return HTTPException(status_code=status.HTTP_409_CONFLICT,
                         detail={"code": code, "message": "Ese dato ya está registrado."})

_SQL_INSERT_PACIENTE_V2 = """
    INSERT INTO pacientes (nombre, apellido, correo, telefono, documento, genero, password_hash)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id, nombre, apellido, correo, telefono, documento, genero;
"""
```

Y el endpoint (incluir `set_auth_cookie` en el import de `dosisya.security`):

```python
from dosisya.security import create_jwt_token, set_auth_cookie, verify_token

@router.post("/registro", summary="Registro de paciente (correo + contraseña)",
             responses={201: {"description": "Cuenta creada — sesión"},
                        409: {"description": "correo/documento/teléfono en uso"}})
@limiter.limit("5/minute")
async def registro(body: RegistroRequest, request: Request) -> JSONResponse:
    try:
        telefono = normalizar_telefono(body.telefono)
    except ValueError as e:
        raise HTTPException(status_code=422, detail="Teléfono venezolano inválido.") from e
    correo = normalizar_correo(body.correo)
    if not _CORREO_RE.match(correo):
        raise HTTPException(status_code=422, detail="Correo inválido.")
    documento = normalizar_documento(body.documento)
    if not documento:
        raise HTTPException(status_code=422, detail="Documento requerido.")
    try:
        async with get_connection() as conn:
            row = await conn.fetchrow(
                _SQL_INSERT_PACIENTE_V2, body.nombre.strip(), body.apellido.strip(),
                correo, telefono, documento, body.genero, hash_password(body.password),
            )
    except asyncpg.UniqueViolationError as e:
        raise _conflicto_409(getattr(e, "constraint_name", None)) from e

    token = create_jwt_token(str(row["id"]), rol="paciente", nombre=row["nombre"] or "")
    resp = _sesion_response(row, token, status_code=201)
    set_auth_cookie(resp, token)
    return resp
```

- [ ] **Step 4: Correr y ver pasar**

Run: `pytest tests/test_pacientes_auth_v2.py -v -k "password or correo or registro"`
Expected: PASS (los de BD, si no hay BD aislada, correr con `!`).

- [ ] **Step 5: Commit**

```bash
git add src/dosisya/routers/pacientes_auth.py tests/test_pacientes_auth_v2.py
git commit -m "feat(paciente): endpoint de registro v2 (correo + contraseña)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task B4: Login por correo (`POST /paciente/login`)

**Files:**
- Modify: `src/dosisya/routers/pacientes_auth.py`
- Test: `tests/test_pacientes_auth_v2.py`

**Interfaces:**
- Consumes: helpers de B3.
- Produces: `POST /api/v1/paciente/login`.

- [ ] **Step 1: Escribir el test**

```python
@pytest.mark.anyio
async def test_login_ok_y_credenciales_invalidas(db_con_ana):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        ok = await c.post("/api/v1/paciente/login",
                          json={"correo": "ana@b.com", "password": "supersecreta"})
        bad = await c.post("/api/v1/paciente/login",
                           json={"correo": "ana@b.com", "password": "mala"})
    assert ok.status_code == 200 and ok.json()["data"]["auth_token"]
    assert bad.status_code == 401 and bad.json()["detail"]["code"] == "credenciales_invalidas"
```

- [ ] **Step 2: Correr y ver fallar**

Run: `pytest tests/test_pacientes_auth_v2.py -v -k login`
Expected: FAIL (404).

- [ ] **Step 3: Implementar**

```python
class LoginPacienteRequest(BaseModel):
    correo: str
    password: str

_SQL_LOGIN = """
    SELECT id, nombre, apellido, correo, telefono, documento, genero, password_hash
    FROM pacientes WHERE lower(correo) = lower($1) LIMIT 1;
"""
_MSG_CRED = {"code": "credenciales_invalidas", "message": "Correo o contraseña incorrectos."}

@router.post("/login", summary="Login de paciente (correo + contraseña)",
             responses={200: {"description": "Sesión"}, 401: {"description": "Credenciales inválidas"}})
@limiter.limit("10/minute")
async def login_paciente(body: LoginPacienteRequest, request: Request) -> JSONResponse:
    async with get_connection() as conn:
        row = await conn.fetchrow(_SQL_LOGIN, normalizar_correo(body.correo))
    if row is None or not row["password_hash"] or not verificar_password(body.password, row["password_hash"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=_MSG_CRED)
    token = create_jwt_token(str(row["id"]), rol="paciente", nombre=row["nombre"] or "")
    resp = _sesion_response(row, token)
    set_auth_cookie(resp, token)
    return resp
```

- [ ] **Step 4: Correr y ver pasar**

Run: `pytest tests/test_pacientes_auth_v2.py -v -k login`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/dosisya/routers/pacientes_auth.py tests/test_pacientes_auth_v2.py
git commit -m "feat(paciente): endpoint de login v2 (correo + contraseña)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task B5: Google (`POST /paciente/google` + `/google/completar`)

**Files:**
- Modify: `src/dosisya/routers/pacientes_auth.py`
- Modify: `pyproject.toml` (añadir `google-auth`)
- Test: `tests/test_pacientes_auth_v2.py`

**Interfaces:**
- Consumes: helpers B3; `create_jwt_token(..., extra_claims=, ttl_seconds=)` de B2.
- Produces: `POST /api/v1/paciente/google` y `POST /api/v1/paciente/google/completar`; util `verificar_id_token_google(token) -> dict`.

- [ ] **Step 1: Añadir dependencia**

En `pyproject.toml`, en dependencies: `"google-auth>=2.0,<3.0",  # verificación de ID tokens de Google`. Instalar: `pip install -e .` (o el gestor del repo).

- [ ] **Step 2: Escribir los tests (con el verificador mockeado)**

```python
from unittest.mock import patch

GOOGLE_FAKE = {"sub": "g-123", "email": "nuevo@gmail.com", "email_verified": True, "name": "Nuevo User"}

@pytest.mark.anyio
async def test_google_primera_vez_pide_completar(db_limpia):
    transport = ASGITransport(app=app)
    with patch("dosisya.routers.pacientes_auth.verificar_id_token_google", return_value=GOOGLE_FAKE):
        async with AsyncClient(transport=transport, base_url="http://test") as c:
            r = await c.post("/api/v1/paciente/google", json={"id_token": "x"})
    body = r.json()["data"]
    assert r.status_code == 200 and body["perfil_incompleto"] is True
    assert body["preregistro_token"] and body["prefill"]["correo"] == "nuevo@gmail.com"

@pytest.mark.anyio
async def test_google_completar_crea_cuenta(db_limpia):
    transport = ASGITransport(app=app)
    with patch("dosisya.routers.pacientes_auth.verificar_id_token_google", return_value=GOOGLE_FAKE):
        async with AsyncClient(transport=transport, base_url="http://test") as c:
            pre = (await c.post("/api/v1/paciente/google", json={"id_token": "x"})).json()["data"]
            r = await c.post("/api/v1/paciente/google/completar",
                             headers={"Authorization": f"Bearer {pre['preregistro_token']}"},
                             json={"telefono": "04141234567", "documento": "V12345678", "genero": "masculino"})
    data = r.json()["data"]
    assert r.status_code == 201 and data["correo"] == "nuevo@gmail.com" and data["auth_token"]

@pytest.mark.anyio
async def test_google_token_invalido_401(db_limpia):
    transport = ASGITransport(app=app)
    with patch("dosisya.routers.pacientes_auth.verificar_id_token_google", side_effect=ValueError("bad")):
        async with AsyncClient(transport=transport, base_url="http://test") as c:
            r = await c.post("/api/v1/paciente/google", json={"id_token": "x"})
    assert r.status_code == 401
```

- [ ] **Step 3: Correr y ver fallar**

Run: `pytest tests/test_pacientes_auth_v2.py -v -k google`
Expected: FAIL.

- [ ] **Step 4: Implementar util + endpoints**

```python
from google.oauth2 import id_token as google_id_token
from google.auth.transport import requests as google_requests

def verificar_id_token_google(token: str) -> dict:
    """Verifica el ID token de Google contra el Client ID. Lanza ValueError si es inválido."""
    client_id = os.environ.get("GOOGLE_OAUTH_CLIENT_ID", "")
    if not client_id:
        raise ValueError("GOOGLE_OAUTH_CLIENT_ID no configurada")
    info = google_id_token.verify_oauth2_token(token, google_requests.Request(), client_id)
    if info.get("iss") not in ("accounts.google.com", "https://accounts.google.com"):
        raise ValueError("Emisor inválido")
    return info

class GoogleLoginRequest(BaseModel):
    id_token: str

class CompletarGoogleRequest(BaseModel):
    telefono: str
    documento: str
    genero: str | None = None

_SQL_BY_GOOGLE = """SELECT id, nombre, apellido, correo, telefono, documento, genero
                    FROM pacientes WHERE google_sub = $1 LIMIT 1;"""
_SQL_BY_CORREO = """SELECT id, nombre, apellido, correo, telefono, documento, genero
                    FROM pacientes WHERE lower(correo) = lower($1) LIMIT 1;"""
_SQL_LINK_GOOGLE = "UPDATE pacientes SET google_sub = $2, ultimo_acceso = now() WHERE id = $1;"
_SQL_INSERT_GOOGLE = """
    INSERT INTO pacientes (nombre, apellido, correo, telefono, documento, genero, google_sub)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id, nombre, apellido, correo, telefono, documento, genero;
"""

@router.post("/google", summary="Login/registro con Google (ID token)")
@limiter.limit("10/minute")
async def google_login(body: GoogleLoginRequest, request: Request) -> JSONResponse:
    try:
        info = verificar_id_token_google(body.id_token)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail={"code": "google_token_invalido", "message": "No se pudo verificar Google."}) from e
    sub = info["sub"]
    correo = normalizar_correo(info.get("email", ""))
    nombre = info.get("name", "") or ""

    async with get_connection() as conn:
        row = await conn.fetchrow(_SQL_BY_GOOGLE, sub)
        if row is None and info.get("email_verified") and correo:
            # Vincular a una cuenta por correo ya existente (email de Google verificado).
            existente = await conn.fetchrow(_SQL_BY_CORREO, correo)
            if existente is not None:
                await conn.execute(_SQL_LINK_GOOGLE, existente["id"], sub)
                row = existente
    if row is not None:
        token = create_jwt_token(str(row["id"]), rol="paciente", nombre=row["nombre"] or "")
        resp = _sesion_response(row, token)
        set_auth_cookie(resp, token)
        return resp

    # Primera vez: token de pre-registro de vida corta (15 min).
    pre = create_jwt_token(sub, rol="paciente_preregistro", nombre=nombre,
                           extra_claims={"correo": correo}, ttl_seconds=900)
    return JSONResponse(content={"data": {
        "perfil_incompleto": True, "preregistro_token": pre,
        "prefill": {"nombre": nombre, "correo": correo},
    }})

@router.post("/google/completar", summary="Completa el perfil tras Google y crea la cuenta")
@limiter.limit("10/minute")
async def google_completar(body: CompletarGoogleRequest, request: Request,
                           token_data: dict = Depends(verify_token)) -> JSONResponse:  # noqa: B008
    if token_data.get("rol") != "paciente_preregistro":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Token de pre-registro requerido.")
    sub = str(token_data["sub"])
    correo = normalizar_correo(token_data.get("correo", ""))
    nombre = token_data.get("nombre", "") or ""
    try:
        telefono = normalizar_telefono(body.telefono)
    except ValueError as e:
        raise HTTPException(status_code=422, detail="Teléfono venezolano inválido.") from e
    documento = normalizar_documento(body.documento)
    if not documento:
        raise HTTPException(status_code=422, detail="Documento requerido.")
    if body.genero is not None and body.genero not in ("femenino","masculino","no_binario","no_especifica"):
        raise HTTPException(status_code=422, detail="Género inválido.")
    try:
        async with get_connection() as conn:
            row = await conn.fetchrow(_SQL_INSERT_GOOGLE, nombre, "", correo,
                                      telefono, documento, body.genero, sub)
    except asyncpg.UniqueViolationError as e:
        raise _conflicto_409(getattr(e, "constraint_name", None)) from e
    token = create_jwt_token(str(row["id"]), rol="paciente", nombre=row["nombre"] or "")
    resp = _sesion_response(row, token, status_code=201)
    set_auth_cookie(resp, token)
    return resp
```

- [ ] **Step 5: Correr y ver pasar**

Run: `pytest tests/test_pacientes_auth_v2.py -v -k google`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/dosisya/routers/pacientes_auth.py tests/test_pacientes_auth_v2.py pyproject.toml
git commit -m "feat(paciente): login/registro con Google (ID token verificado) + completar perfil

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task B6: Ampliar `/me` y decomisar el OTP

**Files:**
- Modify: `src/dosisya/routers/pacientes_auth.py`
- Test: `tests/test_pacientes_auth_v2.py`

**Interfaces:**
- Produces: `GET /me` y `PATCH /me` devuelven los campos v2; endpoints OTP eliminados.

- [ ] **Step 1: Test de /me con campos v2 y de que el OTP ya no existe**

```python
@pytest.mark.anyio
async def test_me_devuelve_campos_v2(sesion_ana):  # sesion_ana: (client, headers con Bearer)
    c, headers = sesion_ana
    r = await c.get("/api/v1/paciente/me", headers=headers)
    d = r.json()["data"]
    assert set(["paciente_id","nombre","apellido","correo","telefono","documento","genero"]).issubset(d)

@pytest.mark.anyio
async def test_otp_endpoints_eliminados():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        r = await c.post("/api/v1/paciente/auth/solicitar-codigo", json={"telefono": "04141234567"})
    assert r.status_code in (404, 410)
```

- [ ] **Step 2: Correr y ver fallar**

Run: `pytest tests/test_pacientes_auth_v2.py -v -k "me_devuelve or otp_endpoints"`
Expected: FAIL.

- [ ] **Step 3: Implementar**

1. Cambiar `_SQL_PERFIL` y `_perfil_response` para incluir los campos v2:

```python
_SQL_PERFIL = ("SELECT id, nombre, apellido, correo, telefono, documento, genero "
               "FROM pacientes WHERE id = $1 LIMIT 1;")

def _perfil_response(row) -> JSONResponse:
    return JSONResponse(content={"data": {
        "paciente_id": str(row["id"]),
        "nombre": row["nombre"] or "", "apellido": row["apellido"] or "",
        "correo": row["correo"] or "", "telefono": row["telefono"] or "",
        "documento": row["documento"] or "", "genero": row["genero"],
    }})
```

2. `PATCH /me`: aceptar `nombre?`, `apellido?`, `genero?` (reemplazar `ActualizarNombreRequest`):

```python
class ActualizarPerfilRequest(BaseModel):
    nombre: str | None = None
    apellido: str | None = None
    genero: str | None = None

_SQL_UPDATE_PERFIL = """
    UPDATE pacientes SET
      nombre   = COALESCE($2, nombre),
      apellido = COALESCE($3, apellido),
      genero   = COALESCE($4, genero)
    WHERE id = $1;
"""
```
Usar este SQL en `actualizar_perfil` (validar `genero` si viene).

3. **Eliminar** las funciones y rutas OTP: `solicitar_codigo`, `verificar_codigo`, sus modelos (`SolicitarCodigoRequest`, `VerificarCodigoRequest`), SQL OTP, `_enviar_codigo_whatsapp`, `generar_codigo`, `hash_codigo`, `verificar_codigo_hash`. Conservar `normalizar_telefono` (lo usa el registro). El import `httpx`/`json`/`secrets` y `BackgroundTasks` se eliminan si quedan sin uso.

- [ ] **Step 4: Correr y ver pasar**

Run: `pytest tests/test_pacientes_auth_v2.py -v`
Expected: PASS. Luego `pytest -q` completo: no introducir rojos nuevos (ver memoria `backend-sin-ci-tests-rojos`: main ya arrastra 4 rojos por orden — comparar contra esa línea base, no contra cero).

- [ ] **Step 5: Commit**

```bash
git add src/dosisya/routers/pacientes_auth.py tests/test_pacientes_auth_v2.py
git commit -m "feat(paciente): /me con campos v2 y decomisión del login OTP WhatsApp

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## FASE 2 — Frontend (repo DosisYa-Frontend)

Rutas relativas a `/home/josemarrufo/Escritorio/DosisYa-Frontend`. Usar el skill `contrato-api` al escribir las llamadas.

### Task F1: Tipos y sesión (`pacienteAuth.ts`)

**Files:**
- Modify: `src/lib/pacienteAuth.ts`

**Interfaces:**
- Produces: `PacientePerfil { paciente_id, nombre, apellido, correo, telefono, documento, genero }`; `SesionPaciente` (perfil + auth_token); `guardarSesionPaciente`, `getPacientePerfil`, `cerrarSesionPaciente` (sin cambios de firma salvo el shape del perfil).

- [ ] **Step 1: Reescribir tipos y guardado**

```ts
export type Genero = "femenino" | "masculino" | "no_binario" | "no_especifica";

export interface PacientePerfil {
  paciente_id: string;
  nombre: string;
  apellido: string;
  correo: string;
  telefono: string;
  documento: string;
  genero: Genero | null;
}

export interface SesionPaciente extends PacientePerfil {
  auth_token: string;
}

export function guardarSesionPaciente(s: SesionPaciente): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(K_TOKEN, s.auth_token);
  const { auth_token: _omit, ...perfil } = s;
  localStorage.setItem(K_PERFIL, JSON.stringify(perfil));
}

export function actualizarPerfilGuardado(perfil: PacientePerfil): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(K_PERFIL, JSON.stringify(perfil));
}
```

Conservar `K_TOKEN`, `K_PERFIL`, `getPacienteToken`, `esPacienteLogueado`, `getPacientePerfil` (ahora devuelve el nuevo `PacientePerfil`), `cerrarSesionPaciente`. Eliminar `VerificarCodigoResponse`.

- [ ] **Step 2: Verificar typecheck**

Run: `npx tsc --noEmit`
Expected: fallará en `pacienteApi.ts` y `HojaLoginPaciente.tsx` (aún usan el shape viejo) — se arreglan en F2/F3. Confirmar que los errores son SOLO esos archivos.

- [ ] **Step 3: Commit (tras F2/F3 compilar)** — ver nota: commitear F1+F2+F3 juntos si el árbol no compila entre pasos. Alternativamente, commitear al final de F3.

---

### Task F2: Cliente API (`pacienteApi.ts`)

**Files:**
- Modify: `src/lib/pacienteApi.ts`
- Test: `src/lib/pacienteApi.test.ts`

**Interfaces:**
- Consumes: `SesionPaciente`, `PacientePerfil` de F1; `API_BASE` de `@/lib/api`.
- Produces: `registro(datos)`, `login(correo, password)`, `googleLogin(idToken)`, `completarPerfilGoogle(preToken, datos)`, `obtenerPerfil()`, `actualizarPerfil(cambios)`. Sin `solicitarCodigo`/`verificarCodigo`.

- [ ] **Step 1: Escribir el test (mock de fetch, env node)**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { registro, login } from "./pacienteApi";

function mockFetchOnce(status: number, data: unknown) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    ok: status < 400, status,
    json: async () => ({ data }),
  }));
}

describe("pacienteApi", () => {
  beforeEach(() => vi.unstubAllGlobals());

  it("registro devuelve la sesión parseada", async () => {
    mockFetchOnce(201, {
      paciente_id: "p1", auth_token: "t", nombre: "Ana", apellido: "P",
      correo: "ana@b.com", telefono: "+584141234567", documento: "V1", genero: "femenino",
    });
    const s = await registro({ nombre: "Ana", apellido: "P", correo: "ana@b.com",
      telefono: "04141234567", documento: "V1", genero: "femenino", password: "supersecreta" });
    expect(s.auth_token).toBe("t");
    expect(s.correo).toBe("ana@b.com");
  });

  it("login lanza con mensaje en 401", async () => {
    mockFetchOnce(401, null);
    await expect(login("ana@b.com", "mala")).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Correr y ver fallar**

Run: `npx vitest run src/lib/pacienteApi.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar el cliente**

```ts
import { z } from "zod";
import { API_BASE } from "@/lib/api";
import {
  getPacienteToken, type Genero, type PacientePerfil, type SesionPaciente,
} from "@/lib/pacienteAuth";

const PREFIX = "/api/v1/paciente";

const generoSchema = z.enum(["femenino", "masculino", "no_binario", "no_especifica"]).nullable();

const sesionSchema = z.object({
  paciente_id: z.string(), auth_token: z.string(), nombre: z.string(),
  apellido: z.string(), correo: z.string(), telefono: z.string(),
  documento: z.string(), genero: generoSchema,
});
const perfilSchema = sesionSchema.omit({ auth_token: true });
const googleSchema = z.union([
  sesionSchema,
  z.object({
    perfil_incompleto: z.literal(true), preregistro_token: z.string(),
    prefill: z.object({ nombre: z.string(), correo: z.string() }),
  }),
]);

async function leerData(res: Response): Promise<unknown> {
  const json = (await res.json()) as { data?: unknown };
  return json.data;
}

export interface DatosRegistro {
  nombre: string; apellido: string; correo: string; telefono: string;
  documento: string; genero: Genero | null; password: string;
}

export async function registro(d: DatosRegistro): Promise<SesionPaciente> {
  const res = await fetch(`${API_BASE}${PREFIX}/registro`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d),
  });
  if (res.status === 409) {
    const code = (((await res.json()) as { detail?: { code?: string } }).detail?.code) ?? "";
    const msg: Record<string, string> = {
      correo_en_uso: "Ese correo ya está registrado.",
      documento_en_uso: "Ese documento ya está registrado.",
      telefono_en_uso: "Ese teléfono ya está registrado.",
    };
    throw new Error(msg[code] ?? "Ese dato ya está registrado.");
  }
  if (!res.ok) throw new Error("No se pudo crear la cuenta. Intenta de nuevo.");
  return sesionSchema.parse(await leerData(res));
}

export async function login(correo: string, password: string): Promise<SesionPaciente> {
  const res = await fetch(`${API_BASE}${PREFIX}/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ correo, password }),
  });
  if (res.status === 401) throw new Error("Correo o contraseña incorrectos.");
  if (!res.ok) throw new Error("No se pudo iniciar sesión. Intenta de nuevo.");
  return sesionSchema.parse(await leerData(res));
}

export type ResultadoGoogle =
  | { tipo: "sesion"; sesion: SesionPaciente }
  | { tipo: "completar"; preregistroToken: string; prefill: { nombre: string; correo: string } };

export async function googleLogin(idToken: string): Promise<ResultadoGoogle> {
  const res = await fetch(`${API_BASE}${PREFIX}/google`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id_token: idToken }),
  });
  if (!res.ok) throw new Error("No se pudo verificar tu cuenta de Google.");
  const data = googleSchema.parse(await leerData(res));
  if ("perfil_incompleto" in data) {
    return { tipo: "completar", preregistroToken: data.preregistro_token, prefill: data.prefill };
  }
  return { tipo: "sesion", sesion: data };
}

export async function completarPerfilGoogle(
  preregistroToken: string,
  d: { telefono: string; documento: string; genero: Genero | null },
): Promise<SesionPaciente> {
  const res = await fetch(`${API_BASE}${PREFIX}/google/completar`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${preregistroToken}` },
    body: JSON.stringify(d),
  });
  if (res.status === 409) throw new Error("Ese teléfono o documento ya está registrado.");
  if (!res.ok) throw new Error("No se pudo completar tu perfil. Intenta de nuevo.");
  return sesionSchema.parse(await leerData(res));
}

export async function obtenerPerfil(): Promise<PacientePerfil> {
  const token = getPacienteToken();
  if (!token) throw new Error("UNAUTHORIZED");
  const res = await fetch(`${API_BASE}${PREFIX}/me`, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 401 || res.status === 403) throw new Error("UNAUTHORIZED");
  if (!res.ok) throw new Error("No se pudo cargar el perfil.");
  return perfilSchema.parse(await leerData(res));
}

export async function actualizarPerfil(
  cambios: { nombre?: string; apellido?: string; genero?: Genero | null },
): Promise<PacientePerfil> {
  const token = getPacienteToken();
  if (!token) throw new Error("UNAUTHORIZED");
  const res = await fetch(`${API_BASE}${PREFIX}/me`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(cambios),
  });
  if (res.status === 401 || res.status === 403) throw new Error("UNAUTHORIZED");
  if (!res.ok) throw new Error("No se pudo guardar.");
  return perfilSchema.parse(await leerData(res));
}
```

- [ ] **Step 4: Correr y ver pasar**

Run: `npx vitest run src/lib/pacienteApi.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/pacienteAuth.ts src/lib/pacienteApi.ts src/lib/pacienteApi.test.ts
git commit -m "feat(paciente): cliente API v2 (registro/login/Google) y tipos de sesión

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task F3: CSP para Google Identity Services

**Files:**
- Modify: `src/lib/csp.ts`
- Test: `src/lib/csp.test.ts`

**Interfaces:**
- Produces: directivas CSP que permiten `https://accounts.google.com/gsi/` en `script-src`, `connect-src` y `frame-src`.

- [ ] **Step 1: Leer `csp.ts` y su test, y escribir un test de inclusión**

```ts
// añadir en src/lib/csp.test.ts
it("permite Google Identity Services", () => {
  const csp = construirCSP(); // usar el export real de csp.ts
  expect(csp).toContain("https://accounts.google.com/gsi/");
  expect(csp).toMatch(/frame-src[^;]*accounts\.google\.com/);
});
```

> Ajustar `construirCSP` al nombre real exportado tras leer `csp.ts`.

- [ ] **Step 2: Correr y ver fallar**

Run: `npx vitest run src/lib/csp.test.ts`
Expected: FAIL.

- [ ] **Step 3: Añadir los orígenes de Google a las directivas correspondientes**

En `csp.ts`: agregar `https://accounts.google.com/gsi/` a `script-src` (script del botón) y `connect-src` (llamadas de GIS), y `https://accounts.google.com` a `frame-src` (iframe de Google). Mantener el resto intacto.

- [ ] **Step 4: Correr y ver pasar**

Run: `npx vitest run src/lib/csp.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/csp.ts src/lib/csp.test.ts
git commit -m "feat(csp): permitir Google Identity Services (registro paciente v2)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task F4: UI de registro/login (`HojaLoginPaciente.tsx`)

**Files:**
- Modify (reescritura): `src/components/paciente/HojaLoginPaciente.tsx`

**Interfaces:**
- Consumes: `registro`, `login`, `googleLogin`, `completarPerfilGoogle` de `pacienteApi`; `guardarSesionPaciente` de `pacienteAuth`.
- Produces: mismo contrato de apertura (`open`, `onOpenChange`, `onSesionIniciada?`) que hoy consume `App.tsx`.

- [ ] **Step 1: Reescribir el componente**

Estados: `modo: "crear" | "entrar" | "completar"`. Reemplaza el flujo OTP. Reglas:
- `"entrar"` (default): correo + contraseña → `login` → `guardarSesionPaciente` → cerrar.
- `"crear"`: formulario (nombre, apellido, correo, teléfono, documento, género opcional, contraseña ≥8) con React Hook Form + Zod → `registro` → sesión.
- Botón **"Continuar con Google"**: carga GIS, obtiene `id_token`, llama `googleLogin`. Si `tipo==="sesion"` → guarda y cierra. Si `tipo==="completar"` → pasa a `"completar"` con `preregistroToken` + prefill.
- `"completar"`: teléfono + documento + género → `completarPerfilGoogle(preToken, …)` → sesión.
- Conservar "Seguir sin cuenta" (`onOpenChange(false)`).
- Género: select con opciones mostradas `Femenino/Masculino/No binario/No especifica` mapeadas a `femenino/masculino/no_binario/no_especifica`.
- Errores: `toast.error(e.message)`. Mantener estilos (`estiloPrimario`, `estiloInput`, etc.) y el chrome del `Drawer` actual.

Esqueleto (completar el JSX de formularios siguiendo los estilos existentes del archivo):

```tsx
import { useEffect, useRef, useState } from "react";
import { Drawer } from "vaul";
import { toast } from "sonner";
import { X } from "lucide-react";
import {
  registro, login, googleLogin, completarPerfilGoogle, type DatosRegistro,
} from "@/lib/pacienteApi";
import { guardarSesionPaciente, type Genero } from "@/lib/pacienteAuth";
import { cargarGoogleIdentity, solicitarIdTokenGoogle } from "@/lib/googleIdentity"; // F5

type Modo = "entrar" | "crear" | "completar";

export function HojaLoginPaciente({
  open, onOpenChange, onSesionIniciada,
}: { open: boolean; onOpenChange: (v: boolean) => void; onSesionIniciada?: () => void }) {
  const [modo, setModo] = useState<Modo>("entrar");
  const [cargando, setCargando] = useState(false);
  const [preToken, setPreToken] = useState<string | null>(null);
  // ...campos controlados (correo, password, nombre, apellido, telefono, documento, genero)...

  const finalizar = (s: Parameters<typeof guardarSesionPaciente>[0]) => {
    guardarSesionPaciente(s);
    onSesionIniciada?.();
    onOpenChange(false);
    toast(`¡Hola, ${s.nombre || "bienvenido"}!`);
  };

  const onGoogle = async () => {
    setCargando(true);
    try {
      await cargarGoogleIdentity();
      const idToken = await solicitarIdTokenGoogle();
      const r = await googleLogin(idToken);
      if (r.tipo === "sesion") finalizar(r.sesion);
      else { setPreToken(r.preregistroToken); setModo("completar"); /* prefill nombre/correo */ }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo continuar con Google.");
    } finally { setCargando(false); }
  };

  // onCrear: valida y llama registro(); onEntrar: login(); onCompletar: completarPerfilGoogle(preToken!, …)
  // ...render Drawer con pestañas "entrar"/"crear", botón Google, "Seguir sin cuenta", y el paso "completar"...
}
```

- [ ] **Step 2: Verificar typecheck y build**

Run: `npx tsc --noEmit && npm run build`
Expected: exit 0. Si falla por tipos del perfil, conciliar con F1/F2.

- [ ] **Step 3: Commit**

```bash
git add src/components/paciente/HojaLoginPaciente.tsx
git commit -m "feat(paciente): UI de registro/login v2 (formulario + Google), retira OTP

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task F5: Integración Google Identity Services (`googleIdentity.ts`)

**Files:**
- Create: `src/lib/googleIdentity.ts`

**Interfaces:**
- Produces: `cargarGoogleIdentity(): Promise<void>` (inyecta el script GIS una vez, SSR-safe) y `solicitarIdTokenGoogle(): Promise<string>` (dispara el flujo y resuelve con el `credential`/ID token).

- [ ] **Step 1: Implementar el loader + flujo**

```ts
// Carga Google Identity Services y obtiene un ID token del usuario.
// SSR-safe: todo detrás de `typeof window`. Lee VITE_GOOGLE_CLIENT_ID.
const GSI_SRC = "https://accounts.google.com/gsi/client";
let cargando: Promise<void> | null = null;

export function cargarGoogleIdentity(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if ((window as unknown as { google?: unknown }).google) return Promise.resolve();
  if (cargando) return cargando;
  cargando = new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = GSI_SRC; s.async = true; s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("No se pudo cargar Google."));
    document.head.appendChild(s);
  });
  return cargando;
}

export function solicitarIdTokenGoogle(): Promise<string> {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
  if (!clientId) return Promise.reject(new Error("Google no está configurado."));
  return new Promise<string>((resolve, reject) => {
    const g = (window as unknown as {
      google?: { accounts: { id: {
        initialize: (o: Record<string, unknown>) => void;
        prompt: () => void;
      } } };
    }).google;
    if (!g) { reject(new Error("Google no disponible.")); return; }
    g.accounts.id.initialize({
      client_id: clientId,
      callback: (resp: { credential?: string }) =>
        resp.credential ? resolve(resp.credential) : reject(new Error("Sin credencial de Google.")),
    });
    g.accounts.id.prompt();
  });
}
```

> Nota: `g.accounts.id.prompt()` usa One Tap. Si en pruebas el prompt no aparece (bloqueo de terceros), la alternativa es renderizar el botón oficial con `g.accounts.id.renderButton` en un contenedor de la hoja; dejarlo como mejora si One Tap no basta.

- [ ] **Step 2: Verificar typecheck y build**

Run: `npx tsc --noEmit && npm run build`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/lib/googleIdentity.ts
git commit -m "feat(paciente): loader de Google Identity Services (ID token)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- Campos (nombre, apellido, correo, teléfono, documento, género) → B1 (esquema), B3/F2 (registro), F4 (UI). ✓
- Auth correo+contraseña → B3/B4 + F2/F4. ✓
- Google (ID token verificado + completar perfil + token pre-registro) → B2/B5 + F2/F4/F5. ✓
- Migración 015 + unicidades + RLS/PII → B1 (+ nota de advisors). ✓
- CSP Google → F3. ✓
- Decomisión OTP → B6 (backend) + F1/F4 (frontend). ✓
- Cuenta opcional / "Seguir sin cuenta" → F4. ✓
- Legales (ya cubren documento+Google) → verificación en el spec, sin tarea de código. ✓

**Placeholder scan:** Sin TODO/TBD de implementación. Los `// ...` del esqueleto F4 son el único punto donde se pide completar JSX siguiendo estilos existentes (contenido UI repetitivo, no lógica); toda la lógica de llamadas está explícita.

**Type consistency:** `SesionPaciente`/`PacientePerfil` (F1) coinciden con lo que parsea `pacienteApi` (F2) y con el envelope backend (B3 `_sesion_response`). `Genero` canónico igual en BD (B1 CHECK), backend (validadores) y frontend (`z.enum`). `create_jwt_token(extra_claims, ttl_seconds)` de B2 lo usan B5. `_conflicto_409`/`_sesion_response`/helpers definidos en B3 y reusados en B4/B5/B6.

## Notas de secuenciación y despliegue

- **Orden:** Fase 1 (B1→B6) antes que Fase 2 en despliegue. En desarrollo, F1–F3/F5 pueden escribirse en paralelo contra el contrato; F4 integra todo.
- **Deploy:** migración 015 a Supabase → env vars (`GOOGLE_OAUTH_CLIENT_ID`, `VITE_GOOGLE_CLIENT_ID`, y `JWT_SECRET_KEY` ya existente) → deploy backend → deploy frontend. **Validar en preview** el flujo Google y que `/api/v1/paciente/*` responda 200 con adblocker activo (proxy mismo-origen).
- **José aporta:** OAuth Client ID en Google Cloud (orígenes autorizados de dev/preview/prod) y las env vars en Vercel. Sin esto, el flujo Google no funciona (el de correo/contraseña sí).
- **Legales:** al salir v2 a prod, verificar consistencia de Privacidad §4 y retirar el banner "Borrador" junto con la revisión legal (gates del PR #53).
```
