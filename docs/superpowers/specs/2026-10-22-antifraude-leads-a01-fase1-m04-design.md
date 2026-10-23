# Diseño — Remediación A-01 (Fase 0+1) + M-04 · Anti-fraude del lead facturable

> **Fecha:** 2026-10-22
> **Origen:** hallazgos A-01 y M-04 de `docs/contexto/auditoria-seguridad-2026-10.md`
> (2026-10-17) y la propuesta `docs/contexto/a01-antifraude-leads-propuesta.md`.
> **Alcance de este plan:** A-01 Fase 0 + Fase 1 + M-04. **Fuera de alcance:** A-01 Fase 2
> (`lead_token` firmado) y M-03 (origen premium server-side) → se planifican en una spec aparte.
> **Repos:** todo el código vive en `DosisYa-Backend` (repo separado). El frontend **no se toca**.
> Autorización expresa de José para tocar el backend otorgada en la sesión del 2026-10-22
> (CLAUDE.md §2).

## 1. Problema

El lead facturable (`POST /api/v1/leads/`) es anónimo por diseño ("cero fricción"). Sus dos
únicas defensas anti-fraude —rate-limit (`5/minute`) y dedup de 60s— se llavean **ambas** por la
misma IP, que `client_ip()` (`src/dosisya/limiter.py`) toma de `X-Forwarded-For.split(",")[0]`:
la **primera** entrada, que un cliente puede forjar cuando llama al backend directo
(`proyecto-dosis-ya.vercel.app`). Rotando ese valor cambia la llave de rate-limit **y** la de
dedup en cada request → fabricación ilimitada de leads contra cualquier `farmacia_id`.

Dos defectos más:
- **Rate-limit en memoria del proceso** (`storage_uri="memory://"` por defecto). En serverless cada
  instancia tiene su contador → el `5/minute` es por-instancia e inefectivo a nivel global si
  `RATELIMIT_STORAGE_URI` no apunta a un Redis compartido.
- **Dedup no atómico (M-04):** `_INSERT_LEAD` usa `INSERT ... SELECT ... WHERE NOT EXISTS` sin
  serialización. Dos requests casi simultáneos de la misma tupla pueden ver ambos "no existe" bajo
  READ COMMITTED e insertar los dos → doble facturación de un clic.

## 2. Decisiones de diseño (fijadas con José, 2026-10-22)

| Tema | Decisión |
|------|----------|
| Alcance | A-01 Fase 0 + Fase 1 + M-04. Fase 2 y M-03 aparte. |
| Modo de falla de Redis | **Fail-open**: si Upstash cae, no se bloquea el lead (no se pierde revenue); el dedup atómico en BD sigue protegiendo el doble cobro. Se loguea la degradación. |
| Dedup atómico (M-04) | **Advisory lock transaccional** (`pg_advisory_xact_lock`), no índice único por bucket. Conserva la ventana deslizante de 60s exacta; cero duplicados en el borde. |
| Fase 0 (diagnóstico) | Log guardado por flag de entorno `FWD_DEBUG`, no "añadir y quitar". El flag queda en el código. |
| Frontend | No se toca. El parche sin commitear de `leads.ts` (observabilidad Sentry) es independiente y queda fuera de este plan. |

## 3. Fase 0 — Diagnóstico de cabecera confiable (paso operativo de José)

No se asume qué cabecera es confiable: hay dos caminos al backend (directo; y proxy mismo-origen
del frontend, el real en prod) que pueden ver IPs distintas.

**Código (subagente):** en `client_ip()`, cuando `os.environ.get("FWD_DEBUG")` es truthy, loguear
a nivel WARNING las cabeceras de reenvío de la request:

```python
if os.environ.get("FWD_DEBUG"):
    logger.warning(
        "FWD-DEBUG xff=%r xri=%r xvff=%r host=%r",
        request.headers.get("x-forwarded-for"),
        request.headers.get("x-real-ip"),
        request.headers.get("x-vercel-forwarded-for"),
        request.client.host if request.client else None,
    )
```

Sin `FWD_DEBUG` presente, cero overhead y cero log. El flag **permanece en el código** (reusable).

**Ops (José):** desplegar preview con `FWD_DEBUG=1`, hacer una request desde un dispositivo conocido
por **ambos** caminos (directo al backend y vía proxy mismo-origen del frontend), decidir qué
cabecera (a) iguala la IP real del cliente por ambos caminos y (b) la pone/sobre-escribe el edge de
Vercel (no forjable). Fijar `TRUSTED_CLIENT_IP_HEADER` con ese valor y quitar `FWD_DEBUG`.

## 4. Fase 1 — IP confiable + storage compartido (backend)

### 4.1 `client_ip()` deja de confiar en un valor forjable

`src/dosisya/limiter.py`:

```python
import os
from slowapi import Limiter
from slowapi.util import get_remote_address
from starlette.requests import Request

# Cabecera que el edge de Vercel pone/sobre-escribe (NO forjable por el cliente).
# El valor exacto se confirma en la Fase 0 y se fija por env; default razonable.
_TRUSTED_IP_HEADER = os.environ.get("TRUSTED_CLIENT_IP_HEADER", "x-vercel-forwarded-for").lower()


def client_ip(request: Request) -> str:
    trusted = request.headers.get(_TRUSTED_IP_HEADER)
    if trusted:
        ip = trusted.split(",")[0].strip()
        if ip:
            return ip
    # Sin la cabecera de confianza (dev local, otro proxy): IP directa.
    # NO caer a X-Forwarded-For[0]: es justo el valor forjable.
    return get_remote_address(request)
```

- Fix en un solo sitio → corrige rate-limit **y** dedup (ambos usan `client_ip`).
- Configurable por env por si Vercel cambia el nombre de la cabecera, sin tocar código.

### 4.2 Rate-limit fail-open con storage compartido

```python
_storage_uri = os.environ.get("RATELIMIT_STORAGE_URI", "memory://")
limiter = Limiter(key_func=client_ip, storage_uri=_storage_uri, swallow_errors=True)
```

- `swallow_errors=True` = **fail-open**: si el backend de storage (Redis) falla, slowapi deja pasar
  la request en vez de 500, y loguea el error. Es exactamente la decisión de la §2.
- **Dependencia:** añadir `redis>=5.0,<6.0` a `pyproject.toml` (y a `requirements.txt` si existe en el
  repo) — es el cliente que usa `limits` (backend de slowapi) para `rediss://`.
- `RATELIMIT_STORAGE_URI` ya se lee: no hay más cambio de código.

**Ops (José):** provisionar Upstash (pago por request, sin costo en reposo → encaja con
`operacion-produccion.md`), setear en Vercel → backend:
```
RATELIMIT_STORAGE_URI="async+rediss://default:<token>@<host>.upstash.io:6379"
TRUSTED_CLIENT_IP_HEADER="<cabecera decidida en Fase 0>"
```

> **Interdependencia:** sin 4.2 el `5/minute` sigue por-instancia; sin 4.1 un atacante evade 4.2
> rotando la cabecera. Las dos subtareas van juntas.

## 5. M-04 — Dedup atómico vía advisory lock transaccional

**Contexto del código actual** (`src/dosisya/repository.py`): `registrar_interaccion` abre
`async with get_connection() as conn` y ejecuta un único `conn.fetchrow(_INSERT_LEAD, …)`. No hay
transacción explícita. `_INSERT_LEAD` es `INSERT ... SELECT ... WHERE NOT EXISTS (… fecha_hora >=
now() - interval '60 seconds') RETURNING …`. La BD es Supabase vía **Transaction Pooler (PgBouncer)**
con `statement_cache_size=0`.

**Fix:** serializar los requests concurrentes de la **misma tupla** con un lock de nivel
transacción, que se libera automáticamente en COMMIT (único tipo de advisory lock seguro bajo
PgBouncer en modo transacción; un lock de sesión **no** lo sería):

```python
async with get_connection() as conn:
    async with conn.transaction():
        # Serializa solo la misma tupla (farmacia|tipo|ip|medicamento). Se libera en COMMIT.
        await conn.execute("SELECT pg_advisory_xact_lock(hashtext($1))", _clave_dedup(lead, tipo_normalizado))
        row = await conn.fetchrow(_INSERT_LEAD, …)   # sin cambios en el SQL
```

donde `_clave_dedup` construye un texto determinista con NULLs normalizados, p. ej.:

```python
def _clave_dedup(lead, tipo_normalizado) -> str:
    return "|".join([
        str(lead.farmacia_id),
        tipo_normalizado,
        lead.ip_origen or "",
        str(lead.medicamento_buscado_id) if lead.medicamento_buscado_id else "",
    ])
```

- `hashtext(text)` → int4; `pg_advisory_xact_lock(bigint)` acepta el int4 promovido. Colisiones de
  hash solo causarían una serialización de más (inocua), nunca un falso dedup.
- La ventana deslizante de 60s **no cambia**: sigue en el `WHERE NOT EXISTS` del SQL.
- Sin cambio de esquema (no hay índice nuevo, no hay migración de DDL).
- El comportamiento observable no cambia para el caller: `row is None` sigue significando duplicado
  suprimido (no facturar, no reenviar a n8n).

## 6. Verificación

### Tests automatizados (subagentes, backend)
- `tests/test_repository.py`: (a) que `registrar_interaccion` ejecuta `pg_advisory_xact_lock` dentro
  de la **misma** transacción que el INSERT (mock de `conn`: aserción de orden de llamadas y de que
  ambas ocurren bajo `conn.transaction()`); (b) que la clave de dedup normaliza NULLs de
  `medicamento_buscado_id`/`ip_origen` sin colapsar tuplas distintas. La concurrencia real
  (dos inserts simultáneos → un solo lead) requiere DB real y se deja como prueba manual (ver abajo),
  documentada en el test como skip.
- `tests/test_leads_router.py` (o test del `limiter`): `client_ip()` devuelve la IP de
  `TRUSTED_CLIENT_IP_HEADER` cuando está presente, y cae a `get_remote_address` cuando no; y
  **nunca** usa `X-Forwarded-For[0]` cuando la cabecera de confianza existe. Test del flag
  `FWD_DEBUG` (loguea solo cuando está activo). Test de que `Limiter` se construye con
  `swallow_errors=True`.

### Verificación operativa (José, en preview)
1. **Fase 0:** desplegar con `FWD_DEBUG=1`, capturar cabeceras por ambos caminos, fijar
   `TRUSTED_CLIENT_IP_HEADER`, quitar `FWD_DEBUG`.
2. **Fase 1:** provisionar Upstash + envs. Script que dispara 20 POST con `X-Forwarded-For`
   **rotando** → debe recibir `429` tras el 5º (ya no evade). Reusar/extender
   `scripts/test-leads-cpc.sh` (vive en el frontend). Un usuario legítimo (misma IP real, clics
   espaciados) NO recibe 429 de más. Smoke del buscador (`"status":"success"`) y un lead real E2E.
3. **M-04:** prueba de concurrencia contra DB real (dos POST idénticos casi simultáneos) → un solo
   lead en `leads_interacciones`.

## 7. Riesgos y mitigaciones

- **Elegir mal la cabecera** agrupa usuarios bajo una IP (over-block) o deja pasar el spoof.
  Mitigación: Fase 0 empírica **obligatoria** antes de desplegar Fase 1.
- **Upstash caído:** cubierto por `swallow_errors=True` (fail-open) + dedup en BD como red.
- **PgBouncer + advisory locks:** solo `pg_advisory_xact_lock` (nivel transacción) es seguro; un
  `pg_advisory_lock` de sesión quedaría colgado bajo pooling de transacción. El diseño usa el
  transaccional dentro de `conn.transaction()`.
- **Deploy:** este plan NO cambia contratos de API → no requiere orden backend-antes-que-frontend.

## 8. Entregable

- Rama nueva en `DosisYa-Backend` con: Fase 0 (log por flag), Fase 1 (`client_ip` + `swallow_errors`
  + dep `redis`), M-04 (advisory lock transaccional + tests). Frontend sin cambios.
- Merge, deploy, provisión de Upstash y las verificaciones operativas (Fase 0 y E2E) los ejecuta
  José. El plan de subagentes entrega el código y los tests; las acciones de entorno quedan
  marcadas como pasos humanos.
