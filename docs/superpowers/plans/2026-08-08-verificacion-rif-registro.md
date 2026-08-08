# Verificación en vivo de RIF duplicado — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** El campo RIF del wizard de registro de farmacias (`admin.login.tsx`) avisa en vivo, al salir del campo, si ese RIF ya está registrado — en vez de esperar hasta el paso 3 final.

**Architecture:** Nuevo endpoint público de solo lectura `GET /api/v1/auth/rif-disponible` en el backend (FastAPI). El frontend lo consume desde una función pura en `src/lib/rifDisponible.ts` (testeable con vitest, sin DOM), que se conecta al campo RIF vía `onBlur`. El paso 3 (`POST /api/v1/auth/register`) no cambia — sigue siendo la fuente de verdad final ante condiciones de carrera.

**Tech Stack:** FastAPI + asyncpg + slowapi (backend, repo separado `DosisYa-Backend`), React 19 + TanStack Start + Zod + vitest (frontend).

## Global Constraints

- Spec fuente: `docs/superpowers/specs/2026-08-08-verificacion-rif-registro-design.md`.
- El backend es un repo git **separado** (`/home/josemarrufo/Escritorio/DosisYa-Backend`, remoto `JoseMarrufo0512/ProyectoDosisYA`, rama `main`). **Ese repo ya tiene cambios sin commitear ajenos a esta tarea** (`src/dosisya/services/ia_orchestrator.py` y `tests/test_ia_orchestrator.py`, verificado en `git status` al momento de escribir este plan). **Nunca uses `git add -A` ni `git add .` en ese repo** — stagea únicamente los archivos exactos que este plan modifica, para no arrastrar ese trabajo ajeno a tu commit.
- Rate limit del nuevo endpoint: `20/minute` (más generoso que login/register porque el usuario puede perder el foco del campo varias veces).
- El chequeo se dispara solo `onBlur` (no debounce mientras escribe) y solo si el RIF ya pasa el regex de formato `^[JVEGP]-\d{8}-\d$`.
- Ante fallo del chequeo (red, 500, 429) el estado es `"error"` y también bloquea "Siguiente" (decisión explícita del usuario — "bloquear por precaución", no fail-open).
- Verificación mínima antes de commit en el frontend (regla del proyecto): `npx tsc --noEmit && npm run build`.
- No existe infraestructura de test de componentes React en este repo (sin `@testing-library/react`, `vitest.config.ts` solo incluye `src/**/*.test.ts`). No se agrega en este plan — la lógica testeable se extrae a un módulo `.ts` puro (Task 2) y el wiring del componente (Task 3) se verifica manualmente en el navegador, siguiendo el patrón ya usado en el repo (`leads.ts`/`leads.test.ts` vs. componentes sin test).

---

### Task 1: Backend — endpoint `GET /api/v1/auth/rif-disponible`

**Files:**
- Modify: `DosisYa-Backend/src/dosisya/routers/auth.py`
- Test: `DosisYa-Backend/tests/test_rif_disponible.py` (crear)

**Interfaces:**
- Consumes: `get_connection` (de `dosisya.db`), `limiter` (de `dosisya.limiter`) — ya importados en `auth.py`.
- Produces: `GET /api/v1/auth/rif-disponible?rif=<RIF>` → `200 {"data": {"disponible": bool}}` | `422` formato inválido | `429` rate limit | `500` error interno. Este es el contrato que Task 2 (frontend) consume.

- [ ] **Step 1: Escribir el test que falla**

Crear `DosisYa-Backend/tests/test_rif_disponible.py`:

```python
"""
GET /api/v1/auth/rif-disponible — verificación en vivo de RIF duplicado,
usada por el wizard de registro (paso 1) antes del submit final. Ver spec:
docs/superpowers/specs/2026-08-08-verificacion-rif-registro-design.md (frontend).
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from dosisya.limiter import limiter
from dosisya.main import app
from dosisya.routers import auth

client = TestClient(app)
ENDPOINT = "/api/v1/auth/rif-disponible"
RIF_VALIDO = "J-12345678-9"


class _FakeConn:
    """Conexión asyncpg falsa: devuelve una fila fija (o None) desde fetchrow."""

    def __init__(self, fila):
        self._fila = fila

    async def fetchrow(self, query, *args):
        return self._fila


class _FakeConnCtx:
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


def _mock_db(monkeypatch, fila):
    monkeypatch.setattr(auth, "get_connection", lambda: _FakeConnCtx(_FakeConn(fila)))


class TestRifDisponible:
    def test_rif_libre_devuelve_disponible_true(self, monkeypatch):
        _mock_db(monkeypatch, fila=None)  # SELECT no encontró ninguna fila

        resp = client.get(ENDPOINT, params={"rif": RIF_VALIDO})

        assert resp.status_code == 200
        assert resp.json() == {"data": {"disponible": True}}

    def test_rif_ya_registrado_devuelve_disponible_false(self, monkeypatch):
        _mock_db(monkeypatch, fila={"?column?": 1})  # SELECT encontró una fila

        resp = client.get(ENDPOINT, params={"rif": RIF_VALIDO})

        assert resp.status_code == 200
        assert resp.json() == {"data": {"disponible": False}}

    def test_rif_con_formato_invalido_devuelve_422(self, monkeypatch):
        _mock_db(monkeypatch, fila=None)

        resp = client.get(ENDPOINT, params={"rif": "no-es-un-rif"})

        assert resp.status_code == 422
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `cd /home/josemarrufo/Escritorio/DosisYa-Backend && .venv/bin/pytest tests/test_rif_disponible.py -v`
Expected: FAIL — `404 Not Found` en las dos primeras aserciones de status (el endpoint no existe todavía). El tercer test también falla (espera 422, recibe 404).

- [ ] **Step 3: Implementar el endpoint**

En `DosisYa-Backend/src/dosisya/routers/auth.py`, cambiar el import de FastAPI (línea 42) de:

```python
from fastapi import APIRouter, HTTPException, Request, status
```

a:

```python
from fastapi import APIRouter, HTTPException, Query, Request, status
```

Luego, insertar el siguiente bloque completo **antes** de la sección `# Endpoint: POST /api/v1/auth/register` (antes del comentario `# ==...==\n# Endpoint: POST /api/v1/auth/register` que hoy está en la línea 326-328):

```python
# ==============================================================================
# Endpoint: GET /api/v1/auth/rif-disponible
# ==============================================================================

# Verifica si un RIF ya existe en farmacias — usado por el wizard de registro
# para dar feedback en vivo (paso 1) antes del submit final en /register.
# $1 → rif
_SELECT_RIF_EXISTE = """
    SELECT 1 FROM farmacias WHERE rif = $1 LIMIT 1;
"""


@router.get(
    "/rif-disponible",
    summary="Verifica si un RIF ya está registrado (wizard de registro, paso 1)",
    responses={
        200: {"description": "disponible: true si el RIF no existe aún en farmacias"},
        422: {"description": "Formato de RIF inválido"},
        429: {"description": "Demasiadas verificaciones — espera un momento"},
        500: {"description": "Error interno"},
    },
)
@limiter.limit("20/minute")
async def rif_disponible(
    request: Request,
    rif: str = Query(
        ...,
        pattern=r"^[JVEGP]-\d{8}-\d$",
        description="RIF venezolano a verificar (ej: J-12345678-9)",
    ),
) -> JSONResponse:
    """Consulta de solo lectura, pública, sin autenticación."""
    try:
        async with get_connection() as conn:
            row = await conn.fetchrow(_SELECT_RIF_EXISTE, rif)
    except asyncpg.PostgresError as e:
        logger.error("Error de BD en rif_disponible [rif=%s]: %s", rif, e)
        raise HTTPException(
            status_code=500, detail="Error interno al verificar el RIF."
        ) from e

    return JSONResponse(content={"data": {"disponible": row is None}})


```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `cd /home/josemarrufo/Escritorio/DosisYa-Backend && .venv/bin/pytest tests/test_rif_disponible.py -v`
Expected: 3 passed

- [ ] **Step 5: Correr toda la suite del backend para descartar regresiones**

Run: `cd /home/josemarrufo/Escritorio/DosisYa-Backend && .venv/bin/pytest -q`
Expected: todos los tests pasan (el mismo número que antes de este cambio, más los 3 nuevos). Si `test_ia_orchestrator.py` falla, es el trabajo ajeno ya modificado que estaba sin commitear — **no lo toques ni lo arregles**, solo confirma que tus 3 tests nuevos pasan y que no rompiste nada que antes pasaba.

- [ ] **Step 6: Commit (solo los archivos de esta tarea)**

```bash
cd /home/josemarrufo/Escritorio/DosisYa-Backend
git add src/dosisya/routers/auth.py tests/test_rif_disponible.py
git commit -m "feat(auth): endpoint GET /rif-disponible para verificación en vivo del wizard de registro"
git status
```

Expected en el `git status` final: `src/dosisya/services/ia_orchestrator.py` y `tests/test_ia_orchestrator.py` siguen apareciendo como modificados sin commitear (son ajenos a esta tarea) — solo `auth.py` y `test_rif_disponible.py` deben aparecer como commiteados.

---

### Task 2: Frontend — módulo `src/lib/rifDisponible.ts`

**Files:**
- Create: `src/lib/rifDisponible.ts`
- Test: `src/lib/rifDisponible.test.ts`

**Interfaces:**
- Consumes: `API_BASE` de `src/lib/api.ts`; endpoint `GET /api/v1/auth/rif-disponible` producido en Task 1.
- Produces: `verificarRifDisponible(rif: string): Promise<RifCheckResult>` y el tipo `RifCheckResult = "available" | "taken" | "error"`. Task 3 importa ambos.

- [ ] **Step 1: Escribir el test que falla**

Crear `src/lib/rifDisponible.test.ts`:

```typescript
import { afterEach, describe, expect, it, vi } from "vitest";
import { verificarRifDisponible } from "./rifDisponible";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("verificarRifDisponible", () => {
  it("devuelve 'available' cuando el backend dice disponible: true", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ data: { disponible: true } }), { status: 200 }),
      ),
    );

    const result = await verificarRifDisponible("J-12345678-9");

    expect(result).toBe("available");
  });

  it("devuelve 'taken' cuando el backend dice disponible: false", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ data: { disponible: false } }), { status: 200 }),
      ),
    );

    const result = await verificarRifDisponible("J-12345678-9");

    expect(result).toBe("taken");
  });

  it("devuelve 'error' cuando el backend responde con status no-2xx", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 500 })));

    const result = await verificarRifDisponible("J-12345678-9");

    expect(result).toBe("error");
  });

  it("devuelve 'error' cuando fetch rechaza (red caída)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    const result = await verificarRifDisponible("J-12345678-9");

    expect(result).toBe("error");
  });

  it("codifica el RIF como query param en la URL correcta", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: { disponible: true } }), { status: 200 }),
    );
    vi.stubGlobal("fetch", mockFetch);

    await verificarRifDisponible("J-12345678-9");

    const [url] = mockFetch.mock.calls[0] as [string];
    expect(url).toContain("/api/v1/auth/rif-disponible");
    expect(url).toContain("rif=J-12345678-9");
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run src/lib/rifDisponible.test.ts`
Expected: FAIL — `Cannot find module './rifDisponible'` (el archivo no existe todavía).

- [ ] **Step 3: Implementar el módulo**

Crear `src/lib/rifDisponible.ts`:

```typescript
import { API_BASE } from "./api";

/** Resultado de verificar si un RIF ya está registrado (wizard de registro, paso 1). */
export type RifCheckResult = "available" | "taken" | "error";

/**
 * Consulta GET /api/v1/auth/rif-disponible. Nunca lanza: una falla de red,
 * un status no-2xx, o un payload inesperado se traducen en "error" para que
 * el wizard pueda mostrar feedback sin romper el flujo de registro.
 */
export async function verificarRifDisponible(rif: string): Promise<RifCheckResult> {
  try {
    const url = `${API_BASE}/api/v1/auth/rif-disponible?rif=${encodeURIComponent(rif)}`;
    const res = await fetch(url);
    if (!res.ok) return "error";
    const json = await res.json().catch(() => null);
    if (json?.data?.disponible === true) return "available";
    if (json?.data?.disponible === false) return "taken";
    return "error";
  } catch {
    return "error";
  }
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx vitest run src/lib/rifDisponible.test.ts`
Expected: 5 passed

- [ ] **Step 5: Commit**

```bash
git add src/lib/rifDisponible.ts src/lib/rifDisponible.test.ts
git commit -m "feat(lib): cliente para GET /api/v1/auth/rif-disponible"
```

---

### Task 3: Frontend — wiring en el wizard de registro (`admin.login.tsx`)

**Files:**
- Modify: `src/routes/admin.login.tsx`

**Interfaces:**
- Consumes: `verificarRifDisponible`, `RifCheckResult` (Task 2, `src/lib/rifDisponible.ts`).
- Produces: comportamiento visible en `/admin/login` (modo registro, paso 1) — no expone ninguna interfaz para otras tasks.

- [ ] **Step 1: Agregar el import del módulo y de `useRef`**

En `src/routes/admin.login.tsx`, línea 2, cambiar:

```typescript
import { useState } from "react";
```

por:

```typescript
import { useState, useRef } from "react";
```

Después de la línea 26 (`import { API_BASE } from "@/lib/api";`), agregar:

```typescript
import { verificarRifDisponible, type RifCheckResult } from "@/lib/rifDisponible";
```

- [ ] **Step 2: Agregar el tipo de estado del campo RIF**

Después del cierre del tipo `RegData` (líneas 354-363, termina en `};`), agregar:

```typescript
type RifFieldStatus = "idle" | "checking" | RifCheckResult;
```

- [ ] **Step 3: Agregar el estado y el ref en `RegisterCard`**

Después de la línea `const [done, setDone] = useState(false);` (línea 381), agregar:

```typescript
  const [rifStatus, setRifStatus] = useState<RifFieldStatus>("idle");
  const rifRef = useRef(data.rif);
```

- [ ] **Step 4: Resetear el estado al editar el campo RIF**

La función `update` actual (líneas 383-391) es:

```typescript
  const update = <K extends keyof RegData>(k: K, v: RegData[K]) => {
    setData((d) => ({ ...d, [k]: v }));
    if (fieldErrors[k as string]) {
      setFieldErrors((e) => {
        const { [k as string]: _omit, ...rest } = e;
        return rest;
      });
    }
  };
```

Reemplazar por:

```typescript
  const update = <K extends keyof RegData>(k: K, v: RegData[K]) => {
    setData((d) => ({ ...d, [k]: v }));
    if (k === "rif") {
      rifRef.current = v as string;
      setRifStatus("idle");
    }
    if (fieldErrors[k as string]) {
      setFieldErrors((e) => {
        const { [k as string]: _omit, ...rest } = e;
        return rest;
      });
    }
  };
```

- [ ] **Step 5: Agregar el handler de `onBlur` del campo RIF**

Inmediatamente después de la función `update` (después del `};` que cierra el Step 4), agregar:

```typescript
  const handleRifBlur = async () => {
    if (!RIF_REGEX.test(data.rif)) return;
    const rifAlVerificar = data.rif;
    setRifStatus("checking");
    const result = await verificarRifDisponible(rifAlVerificar);
    if (rifRef.current !== rifAlVerificar) return; // el usuario ya editó el campo de nuevo
    setRifStatus(result);
  };
```

- [ ] **Step 6: Bloquear el avance del paso 1 mientras el chequeo está pendiente o falló**

En `handleStep1` (línea 402), la primera línea del cuerpo es:

```typescript
  const handleStep1 = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
```

Agregar justo después de `setError(null);`:

```typescript
    if (rifStatus === "checking" || rifStatus === "taken" || rifStatus === "error") return;
```

- [ ] **Step 7: Agregar soporte de `onBlur` al componente `Field` compartido**

En la definición de `Field` (líneas 790-826), agregar `onBlur` a la desestructuración de props (después de `onChange,` en línea 796) y a su tipo (después de `onChange: (v: string) => void;` en línea 810):

Cambiar:

```typescript
function Field({
  id,
  label,
  icon: Icon,
  type = "text",
  value,
  onChange,
  placeholder,
```

por:

```typescript
function Field({
  id,
  label,
  icon: Icon,
  type = "text",
  value,
  onChange,
  onBlur,
  placeholder,
```

Y cambiar:

```typescript
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
```

por:

```typescript
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  placeholder?: string;
```

Luego, en el JSX del `<Input .../>` dentro de `Field` (líneas 833-850), agregar `onBlur={onBlur}` junto a `onChange`:

Cambiar:

```typescript
        <Input
          id={id}
          type={type}
          required={required}
          autoComplete={autoComplete}
          inputMode={inputMode}
          maxLength={maxLength}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
```

por:

```typescript
        <Input
          id={id}
          type={type}
          required={required}
          autoComplete={autoComplete}
          inputMode={inputMode}
          maxLength={maxLength}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder={placeholder}
```

- [ ] **Step 8: Conectar el handler y los mensajes al campo RIF del paso 1**

El bloque `<Field id="rif" .../>` actual (líneas 567-578) es:

```typescript
          <Field
            id="rif"
            label="RIF"
            icon={FileBadge}
            required
            value={data.rif}
            onChange={(v) => update("rif", formatRif(v))}
            placeholder="J-12345678-9"
            error={fieldErrors.rif}
            maxLength={12}
            hint="Empieza con J, V, E, G o P."
          />
```

Reemplazar por:

```typescript
          <Field
            id="rif"
            label="RIF"
            icon={FileBadge}
            required
            value={data.rif}
            onChange={(v) => update("rif", formatRif(v))}
            onBlur={handleRifBlur}
            placeholder="J-12345678-9"
            error={
              fieldErrors.rif ??
              (rifStatus === "taken" ? "Este RIF ya está registrado." : undefined) ??
              (rifStatus === "error" ? "No pudimos verificar el RIF. Intenta de nuevo." : undefined)
            }
            maxLength={12}
            hint={rifStatus === "checking" ? "Verificando disponibilidad…" : "Empieza con J, V, E, G o P."}
          />
```

- [ ] **Step 9: Deshabilitar "Siguiente" del paso 1 mientras el chequeo bloquea el avance**

El botón de submit del paso 1 (líneas 594-598) es:

```typescript
          <Button
            type="submit"
            disabled={saving}
            className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
          >
```

Reemplazar por:

```typescript
          <Button
            type="submit"
            disabled={saving || rifStatus === "checking" || rifStatus === "taken" || rifStatus === "error"}
            className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
          >
```

- [ ] **Step 10: Verificar tipos y build**

Run: `npx tsc --noEmit`
Expected: sin errores.

Run: `npm run build`
Expected: build exitoso, sin errores.

- [ ] **Step 11: Verificación manual en el navegador**

Usar el preview tool (servidor `dev-proxy-prod` de `.claude/launch.json`, que apunta a la API de producción) para confirmar el flujo real de punta a punta:

1. Iniciar el servidor y navegar a `/admin/login`, cambiar a modo "Afíliate aquí".
2. En el campo RIF, escribir `J-12345678-9` (RIF ya existente en producción — farmacia "Prueba Pooler", confirmado en sesión previa) y salir del campo (blur, ej. haciendo clic en el campo "Nombre de la farmacia").
3. Confirmar: aparece "Este RIF ya está registrado." bajo el campo RIF, y el botón "Siguiente" está deshabilitado.
4. Editar el campo RIF a un valor único no registrado (ej. `J-77766655-4`) y salir del campo de nuevo.
5. Confirmar: el mensaje de error desaparece y "Siguiente" vuelve a estar habilitado.
6. Completar los 3 pasos del wizard con datos únicos y confirmar que el registro termina en `201 Created` y redirige al dashboard (mismo flujo ya verificado en la sesión de debugging previa).
7. Capturar screenshot del estado bloqueado (paso 2 de esta verificación) como evidencia.

- [ ] **Step 12: Commit**

```bash
git add src/routes/admin.login.tsx
git commit -m "feat(admin-login): verificación en vivo de RIF duplicado en el wizard de registro"
```
