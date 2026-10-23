# Anti-fraude del lead facturable — A-01 (Fase 0+1) + M-04 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Endurecer el anti-fraude del lead facturable leyendo una IP de cliente no forjable, haciendo el rate-limit compartido (Upstash) y fail-open, y volviendo atómico el dedup de 60s.

**Architecture:** Todo el código vive en el repo `DosisYa-Backend`. Dos cambios independientes: (1) `src/dosisya/limiter.py` deja de confiar en `X-Forwarded-For[0]` y pasa a una cabecera de confianza configurable por env, con el `Limiter` en modo fail-open; (2) `src/dosisya/repository.py` envuelve el INSERT del lead en una transacción con `pg_advisory_xact_lock` para serializar duplicados concurrentes de la misma tupla. El frontend NO se toca.

**Tech Stack:** Python 3.11+, FastAPI, slowapi (sobre `limits`), asyncpg contra Supabase (Transaction Pooler / PgBouncer), pytest + pytest-asyncio (`asyncio_mode = "auto"`).

**Spec:** `docs/superpowers/specs/2026-10-22-antifraude-leads-a01-fase1-m04-design.md`

**Repo de ejecución:** `/home/josemarrufo/Escritorio/DosisYa-Backend`, rama nueva desde `main` (p. ej. `fix/antifraude-leads-a01-m04`). Autorización de José para tocar el backend otorgada el 2026-10-22 (CLAUDE.md §2). Correr los tests con `qa-local-dev-db-constraint` en mente: todo mockea la DB, no se conecta a Supabase.

## Global Constraints

- **Entorno de tests:** el backend usa `.venv` (Python 3.12, pytest 9.1.1). Correr SIEMPRE con `.venv/bin/python -m pytest …` (el `python` global no tiene las deps).
- **Dependencia Redis:** `redis>=5.0,<6.0` (rango exacto). No existe `requirements.txt` en el backend; la dependencia va solo en `pyproject.toml`. `redis` NO está instalado en el `.venv` y NO hace falta instalarlo para los tests (corren en `storage_uri="memory://"`, sin importar `redis`); es dependencia de runtime de producción cuando `RATELIMIT_STORAGE_URI` apunta a `rediss://`.
- **Fail-open:** si el storage del rate-limit (Redis) falla, el backend NO bloquea el lead — `Limiter(..., swallow_errors=True)`.
- **Default de cabecera de confianza:** `TRUSTED_CLIENT_IP_HEADER` por env, con default `"x-vercel-forwarded-for"` (minúsculas). El valor real lo confirma José en la Fase 0 operativa.
- **NUNCA** caer a `X-Forwarded-For[0]` cuando no hay cabecera de confianza: usar `get_remote_address` (IP directa). `X-Forwarded-For[0]` es justo el valor forjable que causa A-01.
- **Advisory lock transaccional, no de sesión:** usar `pg_advisory_xact_lock` dentro de `async with conn.transaction():` (se libera en COMMIT). Un `pg_advisory_lock` de sesión quedaría colgado bajo PgBouncer en modo transacción.
- **Ventana de dedup intacta:** la ventana deslizante de 60s sigue viviendo en el `WHERE NOT EXISTS` de `_INSERT_LEAD`; el advisory lock solo serializa, no reemplaza esa lógica.
- **El comportamiento observable del caller no cambia:** `registrar_interaccion` devuelve `None` cuando el INSERT se suprime (duplicado) y el `Record` completo cuando inserta.
- **Pasos operativos (NO los hace el subagente):** provisionar Upstash, setear `RATELIMIT_STORAGE_URI` y `TRUSTED_CLIENT_IP_HEADER` en Vercel, correr Fase 0 (preview con `FWD_DEBUG=1`) y el E2E de rotación de IP. El plan entrega código + tests.

---

### Task 1: `limiter.py` — IP confiable, fail-open y diagnóstico por flag

**Files:**
- Modify: `src/dosisya/limiter.py` (reescribe `client_ip`, añade log `FWD_DEBUG`, `swallow_errors=True`)
- Modify: `pyproject.toml` (añade `redis>=5.0,<6.0` a `dependencies`)
- Test: `tests/test_limiter.py` (crear)

**Interfaces:**
- Produces: `client_ip(request: starlette.requests.Request) -> str` (misma firma que hoy). `limiter` sigue siendo un `slowapi.Limiter` con `key_func=client_ip`. Módulo lee `TRUSTED_CLIENT_IP_HEADER` y `FWD_DEBUG` de `os.environ`.
- Consumes: nada de tareas previas.

- [ ] **Step 1: Escribir los tests que fallan**

Crear `tests/test_limiter.py`:

```python
"""
DosisYa — Tests de dosisya.limiter.client_ip (anti-fraude A-01, Fase 1).

Cubre el hallazgo A-01: client_ip NO debe confiar en X-Forwarded-For[0]
(forjable por el cliente cuando llama al backend directo). Debe leer una
cabecera de confianza puesta por el edge de Vercel, configurable por env.

La DB no participa aquí; se construyen Requests de starlette a mano.
"""

from __future__ import annotations

import logging

from starlette.requests import Request

from dosisya import limiter as limiter_mod


def _request(headers: dict[str, str], client_host: str = "10.0.0.1") -> Request:
    """Request mínima de starlette: headers como lista de tuplas de bytes."""
    scope = {
        "type": "http",
        "headers": [(k.lower().encode(), v.encode()) for k, v in headers.items()],
        "client": (client_host, 0),
    }
    return Request(scope)


class TestClientIp:
    def test_usa_la_cabecera_de_confianza_cuando_esta_presente(self, monkeypatch):
        monkeypatch.setattr(limiter_mod, "_TRUSTED_IP_HEADER", "x-vercel-forwarded-for")
        req = _request({"x-vercel-forwarded-for": "203.0.113.7"})
        assert limiter_mod.client_ip(req) == "203.0.113.7"

    def test_ignora_x_forwarded_for_forjable_cuando_hay_cabecera_de_confianza(
        self, monkeypatch
    ):
        # El cliente intenta forjar XFF; con cabecera de confianza presente,
        # client_ip la ignora por completo.
        monkeypatch.setattr(limiter_mod, "_TRUSTED_IP_HEADER", "x-vercel-forwarded-for")
        req = _request(
            {
                "x-forwarded-for": "1.1.1.1",  # forjado por el atacante
                "x-vercel-forwarded-for": "203.0.113.7",  # puesto por el edge
            }
        )
        assert limiter_mod.client_ip(req) == "203.0.113.7"

    def test_cae_a_ip_directa_y_NO_a_xff_sin_cabecera_de_confianza(self, monkeypatch):
        # Sin la cabecera de confianza, aunque venga un XFF forjado,
        # client_ip usa la IP directa (get_remote_address), nunca XFF[0].
        monkeypatch.setattr(limiter_mod, "_TRUSTED_IP_HEADER", "x-vercel-forwarded-for")
        req = _request({"x-forwarded-for": "1.1.1.1"}, client_host="198.51.100.9")
        assert limiter_mod.client_ip(req) == "198.51.100.9"

    def test_cabecera_de_confianza_es_configurable_por_env(self, monkeypatch):
        monkeypatch.setattr(limiter_mod, "_TRUSTED_IP_HEADER", "x-real-ip")
        req = _request({"x-real-ip": "203.0.113.42"})
        assert limiter_mod.client_ip(req) == "203.0.113.42"

    def test_toma_la_primera_ip_de_una_lista_en_la_cabecera_de_confianza(
        self, monkeypatch
    ):
        monkeypatch.setattr(limiter_mod, "_TRUSTED_IP_HEADER", "x-vercel-forwarded-for")
        req = _request({"x-vercel-forwarded-for": "203.0.113.7, 70.0.0.1"})
        assert limiter_mod.client_ip(req) == "203.0.113.7"


class TestFwdDebug:
    def test_loguea_solo_cuando_FWD_DEBUG_esta_activo(self, monkeypatch, caplog):
        monkeypatch.setattr(limiter_mod, "_TRUSTED_IP_HEADER", "x-vercel-forwarded-for")
        monkeypatch.setenv("FWD_DEBUG", "1")
        req = _request({"x-vercel-forwarded-for": "203.0.113.7"})
        with caplog.at_level(logging.WARNING, logger="dosisya.limiter"):
            limiter_mod.client_ip(req)
        assert any("FWD-DEBUG" in r.message for r in caplog.records)

    def test_no_loguea_sin_FWD_DEBUG(self, monkeypatch, caplog):
        monkeypatch.setattr(limiter_mod, "_TRUSTED_IP_HEADER", "x-vercel-forwarded-for")
        monkeypatch.delenv("FWD_DEBUG", raising=False)
        req = _request({"x-vercel-forwarded-for": "203.0.113.7"})
        with caplog.at_level(logging.WARNING, logger="dosisya.limiter"):
            limiter_mod.client_ip(req)
        assert not any("FWD-DEBUG" in r.message for r in caplog.records)


class TestLimiterFailOpen:
    def test_limiter_construido_con_swallow_errors(self):
        # Documenta la decisión de fail-open (§2 del diseño): si Redis cae,
        # slowapi deja pasar la request en vez de 500.
        assert limiter_mod.limiter._swallow_errors is True
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run: `cd /home/josemarrufo/Escritorio/DosisYa-Backend && .venv/bin/python -m pytest tests/test_limiter.py -v`
Expected: FAIL (`AttributeError: module 'dosisya.limiter' has no attribute '_TRUSTED_IP_HEADER'` y `limiter._swallow_errors` falso/ausente).

- [ ] **Step 3: Reescribir `src/dosisya/limiter.py`**

Reemplazar el cuerpo del módulo (conservar el docstring de cabecera, actualizándolo) por:

```python
import logging
import os

from slowapi import Limiter
from slowapi.util import get_remote_address
from starlette.requests import Request

logger = logging.getLogger(__name__)

# Cabecera que el edge de Vercel pone/sobre-escribe con la IP real del cliente
# (NO forjable por el cliente). El valor exacto se confirma en la Fase 0
# (diagnóstico en preview) y se fija por env; el default es un arranque razonable.
_TRUSTED_IP_HEADER = os.environ.get(
    "TRUSTED_CLIENT_IP_HEADER", "x-vercel-forwarded-for"
).lower()


def client_ip(request: Request) -> str:
    """Devuelve la IP real del cliente para rate-limit y dedup anti-fraude (A-01).

    Lee la cabecera de confianza que inyecta el edge de Vercel. NO confía en
    X-Forwarded-For[0]: esa primera entrada la puede forjar el cliente cuando
    llama al backend directo, rotándola para evadir rate-limit y dedup.
    Sin la cabecera de confianza (dev local, otro proxy) cae a la IP directa.
    """
    if os.environ.get("FWD_DEBUG"):
        # Diagnóstico de Fase 0: qué cabeceras ve la función por cada camino
        # (directo vs proxy mismo-origen). Activar con FWD_DEBUG=1 en preview.
        logger.warning(
            "FWD-DEBUG xff=%r xri=%r xvff=%r host=%r",
            request.headers.get("x-forwarded-for"),
            request.headers.get("x-real-ip"),
            request.headers.get("x-vercel-forwarded-for"),
            request.client.host if request.client else None,
        )

    trusted = request.headers.get(_TRUSTED_IP_HEADER)
    if trusted:
        ip = trusted.split(",")[0].strip()
        if ip:
            return ip
    # Sin cabecera de confianza: IP directa. NUNCA X-Forwarded-For[0] (forjable).
    return get_remote_address(request)


# Sin RATELIMIT_STORAGE_URI cae a memoria (solo válido en local o instancia única).
# En Vercel serverless hay que apuntarla a un Redis compartido (Upstash), p. ej.:
#   RATELIMIT_STORAGE_URI="rediss://default:<token>@<host>.upstash.io:6379"  (sync; NO async+)
# Usar Redis requiere el cliente `redis` (ya declarado en pyproject.toml).
_storage_uri = os.environ.get("RATELIMIT_STORAGE_URI", "memory://")

# swallow_errors=True → fail-open: si el storage (Redis) falla, slowapi deja
# pasar la request y loguea, en vez de devolver 500. Decisión de negocio:
# nunca perder un lead facturable por una caída de infra; el dedup atómico en
# BD (M-04) sigue protegiendo el doble cobro.
limiter = Limiter(key_func=client_ip, storage_uri=_storage_uri, swallow_errors=True)
```

- [ ] **Step 4: Añadir la dependencia `redis` en `pyproject.toml`**

En el bloque `dependencies` de `pyproject.toml`, tras la línea de `slowapi`, añadir:

```toml
    "redis>=5.0,<6.0",          # Cliente que usa limits/slowapi para RATELIMIT_STORAGE_URI (Upstash)
```

- [ ] **Step 5: Correr los tests para verificar que pasan**

Run: `cd /home/josemarrufo/Escritorio/DosisYa-Backend && .venv/bin/python -m pytest tests/test_limiter.py -v`
Expected: PASS (9 tests).

- [ ] **Step 6: Correr la suite de leads para asegurar que no hay regresión**

Run: `cd /home/josemarrufo/Escritorio/DosisYa-Backend && .venv/bin/python -m pytest tests/test_leads_router.py tests/test_repository.py -v`
Expected: PASS (sin regresión; `client_ip` conserva la firma).

- [ ] **Step 7: Commit**

```bash
cd /home/josemarrufo/Escritorio/DosisYa-Backend
git add src/dosisya/limiter.py pyproject.toml tests/test_limiter.py
git commit -m "fix(a-01): IP de cliente no forjable + rate-limit fail-open compartido

client_ip deja de confiar en X-Forwarded-For[0] (forjable) y lee una cabecera
de confianza del edge de Vercel, configurable por TRUSTED_CLIENT_IP_HEADER.
Limiter pasa a swallow_errors=True (fail-open ante caída de Redis). Añade dep
redis para RATELIMIT_STORAGE_URI (Upstash). Diagnóstico Fase 0 por flag FWD_DEBUG.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: `repository.py` — dedup atómico vía `pg_advisory_xact_lock`

**Files:**
- Modify: `src/dosisya/repository.py` (añade `_clave_dedup`; envuelve el INSERT en transacción + advisory lock)
- Test: `tests/test_repository.py` (actualiza `_FakeConn`; añade tests de lock y de clave)

**Interfaces:**
- Consumes: nada de Task 1 (archivos independientes).
- Produces: `_clave_dedup(farmacia_id, tipo_normalizado: str, ip_origen: str | None, medicamento_buscado_id) -> str`. `registrar_interaccion` conserva su firma y contrato (`None` = duplicado suprimido).

- [ ] **Step 1: Actualizar `_FakeConn` y escribir los tests que fallan**

En `tests/test_repository.py`, reemplazar la clase `_FakeConn` (líneas ~49-60) por una que soporte `transaction()` y `execute()` y registre el orden de las llamadas:

```python
class _FakeConn:
    """Conexión asyncpg falsa: captura args de fetchrow, el advisory lock y el
    orden de las operaciones (para probar que el lock va dentro de la misma
    transacción, antes del INSERT)."""

    def __init__(self, captura: list, resultado, eventos: list | None = None):
        self._captura = captura
        self._resultado = resultado
        self.eventos = eventos if eventos is not None else []

    def transaction(self):
        conn = self

        class _Txn:
            async def __aenter__(self_inner):
                conn.eventos.append("txn_enter")
                return None

            async def __aexit__(self_inner, *exc):
                conn.eventos.append("txn_exit")
                return False

        return _Txn()

    async def execute(self, query, *args):
        self.eventos.append(("execute", query, args))
        return "OK"

    async def fetchrow(self, query, *args):
        self.eventos.append("fetchrow")
        self._captura.append(args)
        if isinstance(self._resultado, Exception):
            raise self._resultado
        return self._resultado
```

Añadir, al final de la clase `TestDeduplicacion` (o como clase nueva tras ella), estos tests:

```python
class TestDedupAtomico:
    """M-04: el INSERT se serializa con pg_advisory_xact_lock dentro de la
    misma transacción para que dos requests concurrentes de la misma tupla no
    inserten ambos (doble cobro). La atomicidad real contra Postgres se verifica
    manualmente contra DB (ver el plan); aquí probamos que el lock se emite en
    la transacción, antes del INSERT."""

    async def test_advisory_lock_se_emite_en_la_misma_txn_antes_del_insert(
        self, monkeypatch
    ):
        captura: list = []
        eventos: list = []
        conn = _FakeConn(captura, _row_exitosa(), eventos)
        monkeypatch.setattr(repository, "get_connection", lambda: _Ctx(conn))

        await repository.registrar_interaccion(_lead())

        # Orden exacto: abrir txn → lock → insert → cerrar txn.
        assert eventos[0] == "txn_enter"
        assert eventos[1][0] == "execute"
        assert "pg_advisory_xact_lock" in eventos[1][1]
        assert eventos[2] == "fetchrow"
        assert eventos[-1] == "txn_exit"

    async def test_lock_usa_la_clave_de_dedup_de_la_tupla(self, monkeypatch):
        captura: list = []
        eventos: list = []
        conn = _FakeConn(captura, _row_exitosa(), eventos)
        monkeypatch.setattr(repository, "get_connection", lambda: _Ctx(conn))

        await repository.registrar_interaccion(_lead())

        _, _, lock_args = eventos[1]  # ("execute", query, args)
        clave = lock_args[0]
        assert clave == repository._clave_dedup(
            FARMACIA_ID, "clic_whatsapp", None, MEDICAMENTO_ID
        )


class TestClaveDedup:
    def test_normaliza_nulls_sin_colapsar_tuplas_distintas(self):
        k_sin_med = repository._clave_dedup(FARMACIA_ID, "clic_whatsapp", None, None)
        k_con_med = repository._clave_dedup(
            FARMACIA_ID, "clic_whatsapp", None, MEDICAMENTO_ID
        )
        assert k_sin_med != k_con_med
        assert k_sin_med == f"{FARMACIA_ID}|clic_whatsapp||"

    def test_distinta_ip_distinta_clave(self):
        k1 = repository._clave_dedup(FARMACIA_ID, "clic_whatsapp", "1.1.1.1", None)
        k2 = repository._clave_dedup(FARMACIA_ID, "clic_whatsapp", "2.2.2.2", None)
        assert k1 != k2
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run: `cd /home/josemarrufo/Escritorio/DosisYa-Backend && .venv/bin/python -m pytest tests/test_repository.py -v`
Expected: FAIL — `AttributeError: module 'dosisya.repository' has no attribute '_clave_dedup'` y `TestDedupAtomico` falla porque aún no se emite el lock.

- [ ] **Step 3: Añadir `_clave_dedup` y envolver el INSERT en transacción + lock**

En `src/dosisya/repository.py`, añadir el helper justo antes de `_INSERT_LEAD`:

```python
def _clave_dedup(
    farmacia_id,
    tipo_normalizado: str,
    ip_origen: str | None,
    medicamento_buscado_id,
) -> str:
    """Clave determinista de la tupla anti-duplicado (farmacia+tipo+ip+medicamento).

    Se pasa a pg_advisory_xact_lock(hashtext(...)) para serializar solo los
    requests concurrentes de la MISMA tupla. Los NULL se normalizan a "" para
    no colapsar tuplas distintas. hashtext puede colisionar (int4): una colisión
    solo causaría una serialización de más (inocua), nunca un falso dedup — la
    supresión real la decide el WHERE NOT EXISTS del SQL, no la clave.
    """
    return "|".join(
        [
            str(farmacia_id),
            tipo_normalizado,
            ip_origen or "",
            str(medicamento_buscado_id) if medicamento_buscado_id else "",
        ]
    )
```

Dentro de `registrar_interaccion`, reemplazar el bloque:

```python
        async with get_connection() as conn:
            row = await conn.fetchrow(
                _INSERT_LEAD,
                lead.farmacia_id,               # $1 UUID
                lead.medicamento_buscado_id,    # $2 UUID | None
                tipo_normalizado,               # $3 str  — normalizado al enum de PG
                lead.ip_origen,                 # $4 str | None  → casteado a INET
                lead.user_agent,                # $5 str | None
                lead.origen.value if lead.origen else None,  # $6 str | None → origen_lead_enum
            )
```

por:

```python
        async with get_connection() as conn:
            # M-04: serializar duplicados concurrentes de la MISMA tupla con un
            # lock de nivel TRANSACCIÓN (se libera en COMMIT → seguro bajo el
            # Transaction Pooler de Supabase/PgBouncer). El WHERE NOT EXISTS del
            # INSERT conserva la ventana deslizante de 60s; el lock solo evita
            # que dos requests casi simultáneos lo evadan por carrera.
            async with conn.transaction():
                await conn.execute(
                    "SELECT pg_advisory_xact_lock(hashtext($1))",
                    _clave_dedup(
                        lead.farmacia_id,
                        tipo_normalizado,
                        lead.ip_origen,
                        lead.medicamento_buscado_id,
                    ),
                )
                row = await conn.fetchrow(
                    _INSERT_LEAD,
                    lead.farmacia_id,               # $1 UUID
                    lead.medicamento_buscado_id,    # $2 UUID | None
                    tipo_normalizado,               # $3 str  — normalizado al enum de PG
                    lead.ip_origen,                 # $4 str | None  → casteado a INET
                    lead.user_agent,                # $5 str | None
                    lead.origen.value if lead.origen else None,  # $6 str | None → origen_lead_enum
                )
```

- [ ] **Step 4: Correr los tests para verificar que pasan**

Run: `cd /home/josemarrufo/Escritorio/DosisYa-Backend && .venv/bin/python -m pytest tests/test_repository.py -v`
Expected: PASS (incluye los tests previos de persistencia/errores/dedup que ahora pasan por la txn y los nuevos de `TestDedupAtomico`/`TestClaveDedup`).

- [ ] **Step 5: Correr la suite completa del backend**

Run: `cd /home/josemarrufo/Escritorio/DosisYa-Backend && .venv/bin/python -m pytest -q`
Expected: la suite completa pasa (o, si arrastra los rojos conocidos por contaminación de orden —ver memoria `backend-sin-ci-tests-rojos`—, confirmar que `tests/test_repository.py` y `tests/test_leads_router.py` pasan en aislamiento y que no hay NUEVOS fallos introducidos por este cambio).

- [ ] **Step 6: Commit**

```bash
cd /home/josemarrufo/Escritorio/DosisYa-Backend
git add src/dosisya/repository.py tests/test_repository.py
git commit -m "fix(m-04): dedup de leads atómico con pg_advisory_xact_lock

Envuelve el INSERT del lead en una transacción y toma un advisory lock de
nivel transacción sobre la tupla (farmacia+tipo+ip+medicamento) antes del
WHERE NOT EXISTS, serializando los requests concurrentes de la misma tupla
sin cambiar la ventana deslizante de 60s. El lock transaccional se libera en
COMMIT, seguro bajo el Transaction Pooler de Supabase.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Verificación operativa (José, NO el subagente)

Tras mergear/desplegar a un preview del backend:

1. **Fase 0:** desplegar con `FWD_DEBUG=1`. Hacer una request desde un dispositivo conocido por los dos caminos (directo a `proyecto-dosis-ya.vercel.app` y vía el proxy mismo-origen del frontend). En los logs, ver qué cabecera (`x-vercel-forwarded-for`, `x-real-ip`, …) trae la IP real por ambos caminos y no la puede forjar el cliente. Fijar `TRUSTED_CLIENT_IP_HEADER` con ese valor; quitar `FWD_DEBUG`.
2. **Fase 1:** provisionar Upstash, setear `RATELIMIT_STORAGE_URI="rediss://…"` (esquema síncrono, **NO** `async+`: slowapi usa storage/estrategias síncronas) y `TRUSTED_CLIENT_IP_HEADER`. Script de rotación (extender `scripts/test-leads-cpc.sh` del frontend): 20 POST con `X-Forwarded-For` rotando → debe dar `429` tras el 5º. Un usuario legítimo (misma IP real, clics espaciados) NO recibe 429 de más. Smoke del buscador (`"status":"success"`) y un lead real E2E.
3. **M-04:** dos POST idénticos casi simultáneos contra el preview → una sola fila en `leads_interacciones` (no hay DB aislada local: `qa-local-dev-db-constraint`).

---

## Self-review del plan (cobertura de la spec)

- Spec §3 (Fase 0, flag FWD_DEBUG) → Task 1, Steps 1/3 (test + log guardado por flag). ✅
- Spec §4.1 (client_ip cabecera confiable, no XFF[0]) → Task 1 (tests `test_ignora_x_forwarded_for_forjable…`, `test_cae_a_ip_directa_y_NO_a_xff…`). ✅
- Spec §4.2 (fail-open + dep redis + RATELIMIT_STORAGE_URI) → Task 1 Steps 3/4 + test `test_limiter_construido_con_swallow_errors`. Env/Upstash = ops de José. ✅
- Spec §5 (M-04 advisory lock transaccional + clave determinista) → Task 2. ✅
- Spec §6 (tests automatizados; concurrencia real = manual) → Task 1 + Task 2 tests + sección de verificación operativa. ✅
- Fuera de alcance (Fase 2, M-03, frontend) → no hay tareas que los toquen. ✅
- Sin placeholders; firmas (`client_ip`, `_clave_dedup`) consistentes entre tareas. ✅
