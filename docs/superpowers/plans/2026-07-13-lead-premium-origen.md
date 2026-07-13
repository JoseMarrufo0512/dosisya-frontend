# Lead Premium por Escáner de Récipe — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Marcar cada lead con su origen (`busqueda` | `lista_medica` | `escaner_recipe`) para poder facturar como premium los leads que nacen del escáner de récipe, y exponer la métrica en el dashboard B2B.

**Architecture:** Columna enum nueva en `leads_interacciones` (PostgreSQL/Supabase), campo opcional en `POST /api/v1/leads/` con default server-side `busqueda`, propagación del origen por ítem en la Lista Médica del frontend (localStorage → fan-out de leads), y un contador nuevo en el dashboard B2B.

**Tech Stack:** FastAPI + asyncpg + Pydantic v2 (backend), React 19 + TanStack Start + TypeScript (frontend), pytest, PostgreSQL en Supabase.

**Spec:** `docs/superpowers/specs/2026-07-13-lead-premium-escaner-design.md`

## Global Constraints

- Valores del enum EXACTOS: `busqueda`, `lista_medica`, `escaner_recipe` — idénticos en PG, Pydantic y TypeScript.
- `POST /api/v1/leads/` lleva **trailing slash** (lección pagada, commit `b071fc0`).
- `origen` es **opcional** en el POST: ausente → el router guarda `busqueda`; valor inválido → 422 (Pydantic).
- Filas históricas quedan `NULL` — nunca se backfillea.
- Leads siguen siendo fire-and-forget (`keepalive: true` en el fan-out); cero latencia añadida.
- No se toca pricing, facturación ni el modelo de IA.
- Backend: repo `/home/josemarrufo/Escritorio/DosisYa-Backend` (autorización ya dada para esta feature). Frontend: `/home/josemarrufo/Escritorio/DosisYa-Frontend`.
- Verificación mínima frontend antes de commit: `npx tsc --noEmit && npm run build`.
- Commits terminan con `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

## Prerrequisitos (antes de la Task 1)

1. **Commitear el fix pendiente del modelo Gemini** (ya está en el working tree del backend, sin commitear):
   ```bash
   cd /home/josemarrufo/Escritorio/DosisYa-Backend
   git add src/dosisya/services/gemini_service.py
   git commit -m "fix(ia): gemini-1.5-flash retirado por Google; usar gemini-flash-latest

   Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
   ```
2. **Ramas de trabajo:**
   - Camino recomendado: mergear los PRs #1 de ambos repos primero, y crear `feature/lead-premium-origen` off `main` en cada repo.
   - Alternativa (PRs sin mergear): backend → rama off `feature/escaner-recipe-ia`; frontend → seguir en `feature/busqueda-v2` (EscanerRecipe.tsx solo existe ahí).
3. **⚠️ ORDEN DE DEPLOY CRÍTICO:** la migración 007 debe ejecutarse en Supabase **ANTES** de desplegar el backend con estos cambios — el nuevo `_INSERT_LEAD` referencia la columna `origen`; sin la migración, TODOS los leads fallarían con 500.

---

### Task 1: Migración 007 + schema.sql (backend)

**Files:**
- Create: `db/migrations/007_lead_origen.sql`
- Modify: `db/schema.sql` (tabla `leads_interacciones`, línea ~178, y sección de enums)

**Interfaces:**
- Produces: tipo PG `origen_lead_enum` y columna `leads_interacciones.origen` (nullable) que las Tasks 3-4 asumen existentes en BD.

- [ ] **Step 1: Crear la migración**

Contenido completo de `db/migrations/007_lead_origen.sql`:

```sql
-- ============================================================
-- DosisYa — Migración 007: origen del lead (lead premium)
-- Ejecutar UNA SOLA VEZ contra Supabase (SQL Editor o psql).
-- Idempotente: DO $$ + IF NOT EXISTS.
-- Spec: DosisYa-Frontend/docs/superpowers/specs/2026-07-13-lead-premium-escaner-design.md
--
-- ⚠️ Ejecutar ANTES de desplegar el backend que usa la columna.
--
-- Semántica:
--   busqueda        → clic directo desde tarjeta de resultados
--   lista_medica    → lead de Lista Médica armada manualmente
--   escaner_recipe  → el medicamento entró vía escáner (PREMIUM facturable)
--   NULL            → lead anterior a esta feature (nunca premium)
-- ============================================================

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'origen_lead_enum') THEN
    CREATE TYPE origen_lead_enum AS ENUM ('busqueda', 'lista_medica', 'escaner_recipe');
  END IF;
END$$;

ALTER TABLE leads_interacciones
  ADD COLUMN IF NOT EXISTS origen origen_lead_enum;

COMMENT ON COLUMN leads_interacciones.origen IS
  'Origen del lead: busqueda | lista_medica | escaner_recipe (premium). NULL = pre-feature.';

CREATE INDEX IF NOT EXISTS idx_leads_origen
  ON leads_interacciones (origen);

COMMIT;
```

- [ ] **Step 2: Actualizar `db/schema.sql` (fuente de verdad)**

Localizar la definición de enums (buscar `tipo_interaccion_enum`) y añadir debajo:

```sql
CREATE TYPE origen_lead_enum AS ENUM ('busqueda', 'lista_medica', 'escaner_recipe');
```

En la tabla `leads_interacciones` (línea ~178), añadir la columna después de `user_agent`:

```sql
    user_agent              VARCHAR(512),
    origen                  origen_lead_enum
```

Y junto a los índices existentes de la tabla (línea ~195):

```sql
-- Índice para reportes de facturación por origen (lead premium)
CREATE INDEX idx_leads_origen
    ON leads_interacciones (origen);
```

- [ ] **Step 3: Verificar que los tests existentes siguen verdes**

Run: `cd /home/josemarrufo/Escritorio/DosisYa-Backend && uv run pytest tests/ -q`
Expected: `29 passed` (los archivos SQL no afectan tests).

- [ ] **Step 4: Commit**

```bash
git add db/migrations/007_lead_origen.sql db/schema.sql
git commit -m "feat(db): migración 007 — columna origen en leads_interacciones (lead premium)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

- [ ] **Step 5 (MANUAL — usuario): ejecutar la migración en Supabase**

Desde el SQL Editor de Supabase o:
```bash
psql "$DATABASE_URL" -f db/migrations/007_lead_origen.sql
```
Verificar: `SELECT column_name FROM information_schema.columns WHERE table_name='leads_interacciones' AND column_name='origen';` → 1 fila.

---

### Task 2: Enum `OrigenLead` + campo en modelos Pydantic (backend, TDD)

**Files:**
- Modify: `src/dosisya/models.py` (enum tras `TipoInteraccion` línea ~70; campo en `LeadInteraccionBase` línea ~263)
- Test: `tests/test_models.py`

**Interfaces:**
- Produces: `OrigenLead(enum.StrEnum)` con miembros `BUSQUEDA`, `LISTA_MEDICA`, `ESCANER_RECIPE`; campo `LeadInteraccionBase.origen: OrigenLead | None = None`. Task 3 los importa desde `dosisya.models`.

- [ ] **Step 1: Escribir los tests que fallan**

Añadir a `tests/test_models.py` (usar los imports ya presentes en el archivo; añadir `OrigenLead` al import de `dosisya.models` y, si faltan, `pytest`, `uuid4` de `uuid` y `ValidationError` de `pydantic`):

```python
class TestOrigenLead:
    """Enum de origen del lead (lead premium — spec 2026-07-13)."""

    def test_valores_canonicos(self):
        assert OrigenLead.BUSQUEDA == "busqueda"
        assert OrigenLead.LISTA_MEDICA == "lista_medica"
        assert OrigenLead.ESCANER_RECIPE == "escaner_recipe"

    def test_lead_acepta_origen(self):
        lead = LeadInteraccionBase(
            farmacia_id=uuid4(),
            tipo_interaccion="clic_whatsapp",
            origen="escaner_recipe",
        )
        assert lead.origen is OrigenLead.ESCANER_RECIPE

    def test_origen_default_none(self):
        lead = LeadInteraccionBase(
            farmacia_id=uuid4(),
            tipo_interaccion="clic_whatsapp",
        )
        assert lead.origen is None

    def test_origen_invalido_rechazado(self):
        with pytest.raises(ValidationError):
            LeadInteraccionBase(
                farmacia_id=uuid4(),
                tipo_interaccion="clic_whatsapp",
                origen="recomendacion",
            )
```

- [ ] **Step 2: Verificar que fallan**

Run: `uv run pytest tests/test_models.py::TestOrigenLead -v`
Expected: FAIL — `ImportError: cannot import name 'OrigenLead'`.

- [ ] **Step 3: Implementar**

En `src/dosisya/models.py`, inmediatamente después de la clase `TipoInteraccion` (línea ~70):

```python
class OrigenLead(enum.StrEnum):
    """Origen del lead — por dónde entró el medicamento antes de generar el lead.

    Debe coincidir EXACTO con el enum PostgreSQL origen_lead_enum (migración 007).
    'escaner_recipe' es el lead premium facturable. NULL en BD = pre-feature.
    """
    BUSQUEDA       = "busqueda"
    LISTA_MEDICA   = "lista_medica"
    ESCANER_RECIPE = "escaner_recipe"
```

En `LeadInteraccionBase` (línea ~263), después de `user_agent`:

```python
    origen: OrigenLead | None = Field(
        default=None,
        description="Origen del lead: busqueda | lista_medica | escaner_recipe (premium)",
    )
```

- [ ] **Step 4: Verificar que pasan**

Run: `uv run pytest tests/test_models.py -v`
Expected: PASS todos (los nuevos y los preexistentes).

- [ ] **Step 5: Commit**

```bash
git add src/dosisya/models.py tests/test_models.py
git commit -m "feat(models): enum OrigenLead + campo origen en LeadInteraccionBase

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Persistencia y endpoint de leads con origen (backend, TDD)

**Files:**
- Modify: `src/dosisya/repository.py` (`_INSERT_LEAD` línea ~89, `registrar_interaccion` línea ~139)
- Modify: `src/dosisya/routers/leads.py` (`LeadCPCCreate` línea ~148, `crear_lead_interaccion` línea ~180)
- Test: `tests/test_leads_router.py` (nuevo)

**Interfaces:**
- Consumes: `OrigenLead` y `LeadInteraccionBase.origen` de Task 2.
- Produces: `POST /api/v1/leads/` acepta `"origen"` opcional; respuesta 201 incluye `data.origen`. El frontend (Task 6) y el script (Task 7) dependen de este contrato.

- [ ] **Step 1: Escribir los tests que fallan**

Crear `tests/test_leads_router.py` completo:

```python
"""
DosisYa — Tests del router de leads CPC: POST /api/v1/leads/

Verifica el contrato del campo `origen` (lead premium — spec 2026-07-13).
La BD SIEMPRE se mockea vía monkeypatch de registrar_interaccion.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

from dosisya.limiter import limiter
from dosisya.main import app
from dosisya.models import LeadInteraccionBase, LeadInteraccionDB, OrigenLead

client = TestClient(app)

ENDPOINT = "/api/v1/leads/"
FARMACIA_ID = str(uuid.uuid4())


@pytest.fixture(autouse=True)
def _reset_rate_limit():
    """Evita 429 entre tests (límite 5/min por IP compartida del TestClient)."""
    limiter.reset()
    yield


@pytest.fixture()
def capturar_lead(monkeypatch):
    """Mockea el repositorio y captura el modelo que el router construyó."""
    capturados: list[LeadInteraccionBase] = []

    async def fake_registrar(lead: LeadInteraccionBase) -> LeadInteraccionDB:
        capturados.append(lead)
        return LeadInteraccionDB(
            id=uuid.uuid4(),
            fecha_hora=datetime.now(timezone.utc),
            **lead.model_dump(),
        )

    monkeypatch.setattr("dosisya.routers.leads.registrar_interaccion", fake_registrar)
    return capturados


class TestOrigenEnLeads:
    def test_origen_escaner_recipe_persistido(self, capturar_lead):
        resp = client.post(ENDPOINT, json={
            "farmacia_id": FARMACIA_ID,
            "tipo_interaccion": "clic_whatsapp",
            "origen": "escaner_recipe",
        })
        assert resp.status_code == 201
        assert capturar_lead[0].origen is OrigenLead.ESCANER_RECIPE
        assert resp.json()["data"]["origen"] == "escaner_recipe"

    def test_origen_lista_medica_persistido(self, capturar_lead):
        resp = client.post(ENDPOINT, json={
            "farmacia_id": FARMACIA_ID,
            "tipo_interaccion": "clic_whatsapp",
            "origen": "lista_medica",
        })
        assert resp.status_code == 201
        assert capturar_lead[0].origen is OrigenLead.LISTA_MEDICA

    def test_sin_origen_aplica_default_busqueda(self, capturar_lead):
        resp = client.post(ENDPOINT, json={
            "farmacia_id": FARMACIA_ID,
            "tipo_interaccion": "clic_whatsapp",
        })
        assert resp.status_code == 201
        assert capturar_lead[0].origen is OrigenLead.BUSQUEDA

    def test_origen_invalido_rechazado_422(self, capturar_lead):
        resp = client.post(ENDPOINT, json={
            "farmacia_id": FARMACIA_ID,
            "tipo_interaccion": "clic_whatsapp",
            "origen": "recomendacion",
        })
        assert resp.status_code == 422
        assert capturar_lead == []
```

- [ ] **Step 2: Verificar que fallan**

Run: `uv run pytest tests/test_leads_router.py -v`
Expected: FAIL — `test_origen_escaner_recipe_persistido` y `test_sin_origen_aplica_default_busqueda` fallan (`origen` es None / falta en data); el de 422 puede pasar ya (Pydantic ignora extra? NO: `LeadCPCCreate` no tiene el campo aún — anotar el resultado real y continuar).

- [ ] **Step 3: Implementar — repositorio**

En `src/dosisya/repository.py`, reemplazar `_INSERT_LEAD` (línea ~89) por:

```python
_INSERT_LEAD = """
    INSERT INTO leads_interacciones (
        farmacia_id,
        medicamento_buscado_id,
        tipo_interaccion,
        ip_origen,
        user_agent,
        origen
    ) VALUES (
        $1, $2, $3, $4::inet, $5, $6
    )
    RETURNING
        id,
        farmacia_id,
        medicamento_buscado_id,
        tipo_interaccion,
        ip_origen,
        user_agent,
        fecha_hora,
        origen;
"""
```

Y en `registrar_interaccion` (línea ~140), añadir el sexto parámetro al `fetchrow`:

```python
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

- [ ] **Step 4: Implementar — router**

En `src/dosisya/routers/leads.py`:

1. Añadir `OrigenLead` al import de `dosisya.models` (línea ~36).
2. En `LeadCPCCreate` (línea ~148), añadir:

```python
    origen: OrigenLead | None = None  # ausente → el endpoint aplica 'busqueda'
```

3. En `crear_lead_interaccion`, al construir `LeadInteraccionBase` (línea ~209), añadir:

```python
        origen=lead.origen or OrigenLead.BUSQUEDA,
```

4. En `n8n_payload` (línea ~237), añadir:

```python
        "origen": lead_db.origen.value if lead_db.origen else None,
```

5. En el `data` de la respuesta final (línea ~258), añadir:

```python
            "origen": lead_db.origen.value if lead_db.origen else None,
```

- [ ] **Step 5: Verificar que pasan todos**

Run: `uv run pytest tests/ -q`
Expected: PASS todos (29 preexistentes + 4 de modelos + 4 nuevos = 37).

- [ ] **Step 6: Commit**

```bash
git add src/dosisya/repository.py src/dosisya/routers/leads.py tests/test_leads_router.py
git commit -m "feat(leads): campo origen en POST /api/v1/leads/ con default busqueda

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Métrica de leads premium en el dashboard B2B (backend)

**Files:**
- Modify: `src/dosisya/routers/farmacias.py` (queries línea ~114; `get_dashboard_farmacia` líneas ~258-330)

**Interfaces:**
- Produces: campo `data.leads_recipe_mes_actual: int` en `GET /api/v1/farmacias/{id}/dashboard`. Task 8 (frontend) lo consume.

- [ ] **Step 1: Añadir la query**

Junto a `_COUNT_LEADS_MES_ACTUAL` (línea ~116):

```python
# Leads premium (origen = escaner_recipe) del mes actual
# $1 → farmacia_id UUID
_COUNT_LEADS_RECIPE_MES = """
    SELECT COUNT(*) AS total
    FROM leads_interacciones
    WHERE farmacia_id = $1
      AND origen = 'escaner_recipe'
      AND fecha_hora >= DATE_TRUNC('month', now());
"""
```

- [ ] **Step 2: Consultarla en el endpoint**

En `get_dashboard_farmacia`, después del bloque "── 2. Total leads del mes actual ──" (línea ~260):

```python
            # ── 2b. Leads premium (récipe digitalizado) del mes ───────────────
            recipe_row = await conn.fetchrow(_COUNT_LEADS_RECIPE_MES, farmacia_uuid)
            leads_recipe_mes: int = recipe_row["total"] if recipe_row else 0
```

Y en el `data` de la respuesta (bloque "── Financiero ──", línea ~323), añadir:

```python
            "leads_recipe_mes_actual": leads_recipe_mes,
```

Actualizar también la `description` del decorador (línea ~187) añadiendo la línea:

```python
        "- `leads_recipe_mes_actual`: leads del mes que llegaron con récipe digitalizado (premium)"
```

- [ ] **Step 3: Verificar y commitear**

Run: `uv run pytest tests/ -q`
Expected: PASS (el dashboard no tiene tests automatizados — no hay infra de mock de BD para él; la verificación real es el smoke manual del Task 9).

```bash
git add src/dosisya/routers/farmacias.py
git commit -m "feat(dashboard): contador de leads premium (escaner_recipe) del mes

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Tipo `OrigenLead` + campo en `ItemLista` (frontend)

**Files:**
- Modify: `src/lib/leads.ts`
- Modify: `src/hooks/useListaMedica.ts` (interface `ItemLista`, línea ~16)

**Interfaces:**
- Produces: `export type OrigenLead` en `@/lib/leads`; `ItemLista.origen?: OrigenLead`. Task 6 los consume.

- [ ] **Step 1: Añadir el tipo en `src/lib/leads.ts`**

Después del tipo `TipoInteraccion`:

```typescript
/**
 * Origen del lead — por dónde entró el medicamento antes de generar el lead.
 * Debe coincidir EXACTO con origen_lead_enum de PostgreSQL (migración 007).
 * "escaner_recipe" es el lead premium facturable.
 */
export type OrigenLead = "busqueda" | "lista_medica" | "escaner_recipe";
```

Y en `registrarLead`, ampliar `opts` y el body:

```typescript
export async function registrarLead(
  farmaciaId: string,
  tipo: TipoInteraccion,
  medicamentoId?: string,
  opts?: { keepalive?: boolean; origen?: OrigenLead },
): Promise<void> {
  try {
    await fetch(`${API_BASE}/api/v1/leads/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        farmacia_id: farmaciaId,
        tipo_interaccion: tipo,
        medicamento_buscado_id: medicamentoId ?? null,
        // Clic directo en tarjeta = "busqueda" salvo que el caller diga otra cosa
        origen: opts?.origen ?? "busqueda",
      }),
      keepalive: opts?.keepalive ?? false,
    });
  } catch {
    // Silencio intencional: los leads CPC nunca deben romper el UX
  }
}
```

- [ ] **Step 2: Añadir el campo en `ItemLista`**

En `src/hooks/useListaMedica.ts`, importar el tipo y ampliar la interface:

```typescript
import type { OrigenLead } from "@/lib/leads";
```

```typescript
export interface ItemLista {
  medicamentoId: string | number;
  nombre: string;
  presentacion: string;
  marcaComercial?: string | null;
  /** Precio de referencia (USD) visto al añadir. Puede variar por farmacia. */
  precioRefUsd?: number;
  cantidad: number;
  agregadoEn: number;
  /** Por dónde entró el item. Ausente en items previos a la feature (= lista_medica). */
  origen?: OrigenLead;
}
```

Nota: `agregarItem` NO cambia — cuando el item ya existe, el spread `{...existente}` conserva el `origen` original (primera entrada gana; el premium no se pisa).

- [ ] **Step 3: Verificar y commitear**

Run: `npx tsc --noEmit`
Expected: sin errores.

```bash
git add src/lib/leads.ts src/hooks/useListaMedica.ts
git commit -m "feat(leads): tipo OrigenLead y campo origen en ItemLista

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Propagar origen en altas y fan-out (frontend)

**Files:**
- Modify: `src/components/TarjetaResultado.tsx` (handleAgregar, línea ~51)
- Modify: `src/components/EscanerRecipe.tsx` (dos llamadas a `agregar`, líneas ~108 y ~124)
- Modify: `src/lib/leadsLista.ts` (firma de `registrarLeadLista`)
- Modify: `src/components/lista/SelectorFarmacia.tsx` (llamada, línea ~124)

**Interfaces:**
- Consumes: `OrigenLead` e `ItemLista.origen` de Task 5; contrato `origen` del POST de Task 3.
- Produces: `registrarLeadLista(farmaciaId, items: Array<{ medicamentoId: string | number; origen?: OrigenLead }>)` — firma nueva.

- [ ] **Step 1: Marcar el alta manual (`TarjetaResultado.tsx`)**

En `handleAgregar` (línea ~51), añadir el campo al objeto:

```typescript
    const item = agregar({
      medicamentoId: resultado.medicamento_id,
      nombre: resultado.medicamento_nombre,
      presentacion: resultado.presentacion,
      marcaComercial: resultado.marca_comercial ?? null,
      precioRefUsd: resultado.precio_usd,
      origen: "lista_medica",
    });
```

- [ ] **Step 2: Marcar el alta desde el escáner (`EscanerRecipe.tsx`)**

En `handleAgregarMedicamento` (línea ~106):

```typescript
    const item = agregar({
      medicamentoId: `recipe-${nombre.toLowerCase().replace(/\s+/g, "-")}`,
      nombre,
      presentacion: cantidad || "según récipe",
      origen: "escaner_recipe",
    });
```

En `handleAgregarTodos` (línea ~122):

```typescript
      agregar({
        medicamentoId: `recipe-${med.medicamento.toLowerCase().replace(/\s+/g, "-")}`,
        nombre: med.medicamento,
        presentacion: med.cantidad || "según récipe",
        origen: "escaner_recipe",
      });
```

- [ ] **Step 3: Fan-out con origen por ítem (`leadsLista.ts`)**

Reemplazar la firma y el cuerpo de `registrarLeadLista`:

```typescript
import type { OrigenLead } from "./leads";

/** Ítem mínimo que el fan-out necesita de la Lista Médica. */
export interface ItemLeadLista {
  medicamentoId: string | number;
  origen?: OrigenLead;
}

export function registrarLeadLista(
  farmaciaId: string | number,
  items: ItemLeadLista[],
): void {
  if (items.length === 0) return;

  // Fan-out: un lead por medicamento (schema actual de leads_interacciones)
  // ⚠️ Si el backend añade soporte de array en el futuro, este es el único
  // lugar que hay que cambiar. Verifica en Supabase que los leads entren con
  // medicamento_buscado_id correcto (uno por fila).
  for (const { medicamentoId, origen } of items) {
    void fetch(`${API_BASE}/api/v1/leads/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        farmacia_id: farmaciaId,
        tipo_interaccion: "clic_whatsapp",
        medicamento_buscado_id: UUID_RE.test(String(medicamentoId)) ? medicamentoId : null,
        // Items previos a la feature no traen origen → lista_medica (nunca
        // premium por accidente, misma regla que el backend)
        origen: origen ?? "lista_medica",
      }),
      keepalive: true,
    }).catch(() => {
      /* fire-and-forget: nunca interrumpe al usuario */
    });
  }
}
```

(El comentario de cabecera del archivo y `UUID_RE` no cambian.)

- [ ] **Step 4: Actualizar la llamada (`SelectorFarmacia.tsx`, línea ~124)**

```typescript
    registrarLeadLista(
      farmacia.farmaciaId,
      lista.map((i) => ({ medicamentoId: i.medicamentoId, origen: i.origen })),
    );
```

- [ ] **Step 5: Verificar y commitear**

Run: `npx tsc --noEmit && npm run build`
Expected: sin errores, build OK.

```bash
git add src/components/TarjetaResultado.tsx src/components/EscanerRecipe.tsx src/lib/leadsLista.ts src/components/lista/SelectorFarmacia.tsx
git commit -m "feat(leads): propagar origen por ítem en el fan-out de la Lista Médica

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: Extender el smoke test end-to-end (frontend, script)

**Files:**
- Modify: `scripts/test-leads-cpc.sh`

**Interfaces:**
- Consumes: respuesta 201 con `data.origen` de Task 3.

- [ ] **Step 1: Añadir casos de origen al script**

Después de los `test_lead` existentes (línea ~77), añadir:

```bash
# ─── Tests de origen (lead premium — spec 2026-07-13) ───────
test_lead_origen() {
  local origen="$1"
  local desc="$2"

  BODY="{\"farmacia_id\":\"$FARMACIA_ID\",\"tipo_interaccion\":\"clic_whatsapp\",\"origen\":\"$origen\"}"
  RESPONSE=$(curl -s -w "\n%{http_code}" \
    -X POST "$API/api/v1/leads/" \
    -H "Content-Type: application/json" \
    -d "$BODY")
  HTTP_CODE=$(echo "$RESPONSE" | tail -1)
  BODY_RESP=$(echo "$RESPONSE" | head -n -1)
  ORIGEN_RESP=$(echo "$BODY_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['data'].get('origen','?'))" 2>/dev/null || echo "parse_error")

  if [ "$HTTP_CODE" = "201" ] && [ "$ORIGEN_RESP" = "$origen" ]; then
    echo -e "  ${GREEN}✅ PASS${NC}  [origen=$origen] $desc → eco correcto"
  elif [ "$HTTP_CODE" = "429" ]; then
    echo -e "  ${YELLOW}⚡ RATE-LIMIT${NC}  [origen=$origen] $desc"
  else
    echo -e "  ${RED}❌ FAIL${NC}  [origen=$origen] $desc → HTTP $HTTP_CODE, origen eco: $ORIGEN_RESP"
  fi
}

test_lead_origen "escaner_recipe" "Lead premium desde escáner"
test_lead_origen "lista_medica"   "Lead de lista manual"

# Origen inválido debe rechazarse con 422
HTTP_INVALIDO=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "$API/api/v1/leads/" \
  -H "Content-Type: application/json" \
  -d "{\"farmacia_id\":\"$FARMACIA_ID\",\"tipo_interaccion\":\"clic_whatsapp\",\"origen\":\"recomendacion\"}")
if [ "$HTTP_INVALIDO" = "422" ]; then
  echo -e "  ${GREEN}✅ PASS${NC}  [origen inválido] rechazado con 422"
elif [ "$HTTP_INVALIDO" = "429" ]; then
  echo -e "  ${YELLOW}⚡ RATE-LIMIT${NC}  [origen inválido]"
else
  echo -e "  ${RED}❌ FAIL${NC}  [origen inválido] → HTTP $HTTP_INVALIDO (esperado 422)"
fi
```

Nota: el rate limit del endpoint es 5/min — el script ya dispara 4-5 POSTs; los nuevos casos pueden caer en 429 si se corre todo seguido. El manejo de 429 ya existe en el patrón (⚡). Actualizar también el comentario de cabecera del script (línea ~10) añadiendo: `#   + origen: escaner_recipe, lista_medica, inválido→422`.

- [ ] **Step 2: Correr el script (requiere backend local en :8000 con la migración aplicada)**

Run: `bash scripts/test-leads-cpc.sh <FARMACIA_UUID_REAL>`
Expected: PASS (o ⚡ RATE-LIMIT) en los casos nuevos; el de origen inválido → PASS con 422.
Si no hay backend local con BD: marcar este step como pendiente y cubrirlo en el smoke del Task 9 contra preview/producción.

- [ ] **Step 3: Commit**

```bash
git add scripts/test-leads-cpc.sh
git commit -m "test(leads): casos de origen en smoke test CPC (premium + 422)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: Métrica "Pedidos con récipe" en el dashboard (frontend)

**Files:**
- Modify: `src/routes/admin.dashboard.tsx` (type `DashboardData` línea ~51; grid de MetricCard línea ~349; imports de lucide)

**Interfaces:**
- Consumes: `data.leads_recipe_mes_actual` de Task 4.

- [ ] **Step 1: Ampliar el tipo**

En `DashboardData` (línea ~51), añadir:

```typescript
  leads_recipe_mes_actual?: number;
```

- [ ] **Step 2: Añadir la tarjeta**

Añadir `ScanLine` al import existente de `lucide-react`. En el grid (línea ~349), cambiar las clases a `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4` y añadir como cuarta tarjeta:

```tsx
        <MetricCard
          label="Pedidos con récipe este mes"
          value={loading ? null : (data?.leads_recipe_mes_actual?.toString() ?? "—")}
          hint="Leads que llegaron con récipe digitalizado"
          icon={<ScanLine className="h-5 w-5" />}
          accent="bg-emerald-100 text-emerald-700"
        />
```

- [ ] **Step 3: Verificar y commitear**

Run: `npx tsc --noEmit && npm run build`
Expected: sin errores.

```bash
git add src/routes/admin.dashboard.tsx
git commit -m "feat(dashboard): tarjeta de pedidos con récipe (leads premium)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 9: Verificación final integrada

**Files:** ninguno (solo verificación).

- [ ] **Step 1: Suite backend completa**

Run: `cd /home/josemarrufo/Escritorio/DosisYa-Backend && uv run pytest tests/ -q`
Expected: 37 passed (29 preexistentes + 8 nuevos).

- [ ] **Step 2: Verificación frontend completa**

Run: `cd /home/josemarrufo/Escritorio/DosisYa-Frontend && npx tsc --noEmit && npm run build`
Expected: sin errores.

- [ ] **Step 3 (MANUAL — requiere migración 007 aplicada): smoke E2E**

Con backend corriendo (local o preview) y la migración aplicada en Supabase:
1. `bash scripts/test-leads-cpc.sh <FARMACIA_UUID_REAL>` → casos de origen en PASS.
2. En Supabase: `SELECT origen, COUNT(*) FROM leads_interacciones WHERE fecha_hora > now() - interval '1 hour' GROUP BY origen;` → filas con `escaner_recipe` y `lista_medica`.
3. Abrir el dashboard admin → la tarjeta "Pedidos con récipe este mes" muestra el conteo.

- [ ] **Step 4: Push y PRs**

Push de ambas ramas y PRs contra `main` de cada repo, describiendo la spec y recordando en el PR del backend el ORDEN DE DEPLOY (migración primero).
```
