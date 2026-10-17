# Propuesta de remediación — A-01 · Anti-fraude del lead facturable

> **Estado:** PROPUESTA para revisión. **No aplicada.** Toca `DosisYa-Backend` (repo
> separado) → requiere autorización expresa (CLAUDE.md §2).
> **Origen:** hallazgo A-01 de `docs/contexto/auditoria-seguridad-2026-10.md` (2026-10-17).

## 1. El problema, en corto

El lead facturable (`POST /api/v1/leads/`) es anónimo por diseño. Sus dos únicas defensas
anti-fraude —el **rate-limit** (`5/minute`) y el **dedup de 60s**— se llavean **ambas** por la
misma IP, que sale de `client_ip()` en `src/dosisya/limiter.py`:

```python
def client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        primera_ip = forwarded.split(",")[0].strip()   # ← PRIMERA entrada
        if primera_ip:
            return primera_ip
    return get_remote_address(request)
```

Dos defectos:

1. **IP spoofeable (CONFIRMADO en código).** Tomar `X-Forwarded-For.split(",")[0]` confía en la
   **primera** entrada de la cabecera, que un cliente puede rellenar a voluntad cuando llama al
   backend **directo** (`proyecto-dosis-ya.vercel.app`). Rotando ese valor en cada request cambia
   la llave de rate-limit **y** la de dedup → fabricación ilimitada de leads contra cualquier
   `farmacia_id`.
2. **Rate-limit en memoria del proceso (A VERIFICAR en Vercel).** `limiter.py` usa
   `storage_uri="memory://"` por defecto. En serverless cada instancia tiene su propio contador;
   si `RATELIMIT_STORAGE_URI` no está configurada, el `5/minute` es por-instancia → inefectivo a
   nivel global. El propio módulo lo documenta.

Como las dos defensas comparten `client_ip()`, **arreglar esa función corrige rate-limit y dedup
a la vez**. Pero una IP, aun leída bien, es una llave débil (CGNAT móvil agrupa usuarios; una
botnet rota IPs). Por eso la propuesta tiene dos fases: endurecer la IP (rápido) y añadir una
señal que no dependa de la IP (estructural).

---

## 2. Fase 0 — Diagnóstico obligatorio (antes de tocar código)

**No asumir qué cabecera es confiable.** Hay DOS caminos hasta el backend y pueden ver IPs
distintas:

- Directo: navegador → edge del backend → función.
- Proxy mismo-origen (el real en prod): navegador → edge del **frontend** → edge del backend →
  función. Aquí el riesgo es el opuesto: que la función vea la IP del *edge del frontend* y
  agrupe a todos los usuarios bajo una sola llave.

Loguear, en un **preview deploy**, todas las cabeceras de reenvío para una request de un
dispositivo conocido, por los dos caminos:

```python
# Temporal, solo para el diagnóstico (quitar después):
logger.info("FWD-DEBUG xff=%r xri=%r xvff=%r cc=%r host=%r",
    request.headers.get("x-forwarded-for"),
    request.headers.get("x-real-ip"),
    request.headers.get("x-vercel-forwarded-for"),
    request.headers.get("x-vercel-ip-country"),
    request.client.host if request.client else None)
```

Con eso se decide qué cabecera **(a)** iguala la IP real del cliente por ambos caminos y
**(b)** la pone/sobre-escribe Vercel en su edge (no la puede forjar el cliente). Las `x-vercel-*`
son candidatas fuertes porque Vercel sobre-escribe sus propias cabeceras en el borde, pero hay
que confirmarlo empíricamente — de ahí esta fase.

---

## 3. Fase 1 — Endurecer la IP + storage compartido (rápido, bajo riesgo)

### 3.1 `client_ip()` deja de confiar en un valor forjable

Reemplazo propuesto para `src/dosisya/limiter.py` (header confiable configurable; el nombre exacto
sale de la Fase 0):

```python
import os
from slowapi import Limiter
from slowapi.util import get_remote_address
from starlette.requests import Request

# Cabecera que Vercel pone/sobre-escribe en el borde (NO forjable por el cliente).
# Confirmar el valor exacto en el diagnóstico de Fase 0 antes de desplegar.
_TRUSTED_IP_HEADER = os.environ.get("TRUSTED_CLIENT_IP_HEADER", "x-vercel-forwarded-for").lower()


def client_ip(request: Request) -> str:
    # 1) Cabecera de confianza puesta por el edge (no la controla el cliente).
    trusted = request.headers.get(_TRUSTED_IP_HEADER)
    if trusted:
        ip = trusted.split(",")[0].strip()
        if ip:
            return ip
    # 2) Sin la cabecera de confianza (dev local, otro proxy): IP directa.
    #    NO caer a X-Forwarded-For[0]: es justo el valor forjable.
    return get_remote_address(request)
```

Notas:
- Hace el fix en UN solo sitio → corrige rate-limit **y** dedup (ambos usan `client_ip`).
- Es configurable por env (`TRUSTED_CLIENT_IP_HEADER`) por si Vercel cambia el nombre o se migra
  de proveedor, sin tocar código.
- Si el diagnóstico muestra que por el proxy mismo-origen la función ve la IP del edge del
  frontend (no la del cliente), la cabecera correcta será la que Vercel propague con la IP real;
  esa es exactamente la decisión que cierra la Fase 0.

### 3.2 Rate-limit con storage compartido (Upstash Redis)

- **Dependencia** (`pyproject.toml`): añadir el cliente Redis que usa `limits` (el backend de
  slowapi):
  ```toml
  "redis>=5.0,<6.0",   # Backend compartido de rate-limit (slowapi/limits) en serverless
  ```
- **Env var** en Vercel → proyecto del backend → Settings → Environment Variables:
  ```
  RATELIMIT_STORAGE_URI="async+rediss://default:<token>@<host>.upstash.io:6379"
  ```
  (El esquema `async+rediss://` usa TLS + cliente async, apropiado para funciones async en
  serverless. `limiter.py` ya lee `RATELIMIT_STORAGE_URI` — no hay que cambiar código.)
- **Por qué Upstash:** pago por request, sin costo en reposo → encaja con la operación consciente
  de costos de `operacion-produccion.md`. Alternativa: cualquier Redis gestionado.

> Sin 3.2, el `5/minute` sigue siendo por-instancia. Sin 3.1, un atacante evade 3.2 rotando la
> cabecera. **Las dos subtareas van juntas** o el beneficio es parcial.

---

## 4. Fase 2 — Señal que NO depende de la IP (estructural, recomendada)

La IP, aun confiable, no detiene una botnet ni distingue a un atacante de un edificio con CGNAT.
El fix estructural es **atar cada lead a una búsqueda real previa** mediante un token efímero
firmado por el backend.

Flujo:

1. En `GET /api/v1/medicamentos/buscar`, el backend incluye en la respuesta un
   **`lead_token`**: un HMAC-SHA256 (reusa `JWT_SECRET_KEY`) con `{ exp: ~10 min, origen,
   nonce }`, opcionalmente ligado a la IP de confianza de Fase 1.
2. `POST /api/v1/leads/` **exige** ese `lead_token`. El backend verifica firma + expiración y
   **deriva `origen` del token**, no del body del cliente.
3. Un `nonce` de un solo uso (en Redis, TTL corto) evita reusar el mismo token para N leads.

Beneficios:
- Fabricar leads exige primero ejecutar búsquedas reales (rate-limited y costosas para el
  atacante), subiendo el costo del fraude órdenes de magnitud.
- **Cierra M-03 de paso:** como `origen` (incl. `escaner_recipe` premium) sale del token firmado
  por el backend, el cliente ya no puede declararse premium. Para el escáner, el token lo emite
  `POST /api/v1/ia/analizar-recipe`.

Costo: toca el contrato búsqueda→lead (frontend `src/lib/api.ts`, `leads.ts`, `whatsapp.ts` /
`SelectorFarmacia`) + backend. Es un cambio coordinado de los dos repos; por eso va como fase 2,
después de que Fase 1 tape lo barato.

---

## 5. Plan de despliegue y verificación

1. **Fase 0** en preview: desplegar el log de diagnóstico, capturar cabeceras por ambos caminos,
   decidir `TRUSTED_CLIENT_IP_HEADER`. Quitar el log.
2. **Fase 1** en preview:
   - Provisionar Upstash, poner `RATELIMIT_STORAGE_URI` y `TRUSTED_CLIENT_IP_HEADER`.
   - Verificar anti-fraude de verdad: un script que dispara 20 POST con `X-Forwarded-For`
     **rotando** debe recibir `429` tras el 5º (ya no debe poder evadir). Reusar/extender
     `scripts/test-leads-cpc.sh`.
   - Verificar que un usuario legítimo (misma IP real, clics espaciados) NO recibe 429 de más.
   - Smoke test del buscador (`"status":"success"`) y de un lead real end-to-end.
3. **Fase 2** (planificar aparte): spec del `lead_token`, luego implementar backend + frontend
   coordinados, con el mismo set de pruebas.

## 6. Riesgos

- **Elegir mal la cabecera** agrupa a todos los usuarios bajo una IP (over-block) o deja pasar el
  spoof. Mitigación: Fase 0 empírica obligatoria antes de desplegar Fase 1.
- **Upstash caído** → slowapi podría fallar abierto o cerrado según config de `limits`; definir el
  comportamiento (preferible: fail-open en rate-limit pero el dedup en BD sigue de red).
- **Fase 2** cambia un contrato; coordinar deploy backend-antes-que-frontend y tolerar tokens
  ausentes durante la transición (grace period) para no tumbar leads en el corte.

## 7. Qué NO hace esta propuesta

- No aplica nada: es un documento para tu revisión.
- No resuelve M-04 (dedup no atómico) — es complementario: ver auditoría. Un índice único parcial
  o `ON CONFLICT` en `leads_interacciones` endurece el dedup aunque la IP falle.
