# Completar el Admin de Farmacia — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Completar el panel admin de farmacia: corregir bugs de datos en Inicio, añadir una sección de Facturación con datos reales, y hacer que Configuración guarde de verdad vía un endpoint nuevo.

**Architecture:** El backend (`DosisYa-Backend`, FastAPI) ya expone `GET /api/v1/farmacias/{id}/dashboard` con casi toda la data. Se extiende esa respuesta con 3 campos de contacto y se añade `PATCH /api/v1/farmacias/{id}` para editar. El frontend (`admin.dashboard.tsx`, TanStack Router) consume esa data — cero llamadas nuevas salvo el PATCH de Configuración.

**Tech Stack:** Backend: Python 3, FastAPI, asyncpg, Pydantic, pytest. Frontend: React 19, TanStack Router, TypeScript, TailwindCSS 4, Zod, sonner (toasts), lucide-react.

## Global Constraints

- **Backend autorizado por José** solo para lo definido en este plan (extender dashboard GET + nuevo PATCH). Cualquier otro cambio de backend requiere autorización aparte.
- **SQL siempre con parámetros posicionales `$N`** (regla de seguridad del proyecto). Nunca interpolar valores en el string SQL.
- **Enum canónico de `tipo_interaccion`:** `clic_whatsapp`, `clic_llamar`, `ver_mapa`, `ver_detalle`, `compartir`, `capture_pantalla` (existen alias legacy `click_whatsapp`, etc. — mapear ambos en el frontend).
- **El frontend NO tiene test runner de unidades hoy** (no vitest). La verificación de tareas frontend es: `npx tsc --noEmit && npm run build` (ambos limpios) + observación manual con `npm run dev`. No inventar un runner.
- **Verificación mínima antes de cada commit de frontend:** `npx tsc --noEmit && npm run build`.
- **Backend tests con pytest**; la BD SIEMPRE se mockea (monkeypatch de la función de repositorio + override de `verify_token`), nunca se toca Postgres real en tests.
- `rif` y `correo` NO son editables en este sub-proyecto.
- No tocar `src/routes/admin.login.tsx` ni `src/routeTree.gen.ts`.

---

## File Structure

**Backend (`/home/josemarrufo/Escritorio/DosisYa-Backend`):**
- Modify: `src/dosisya/routers/farmacias.py` — extender SELECT + response del dashboard; añadir ruta PATCH.
- Modify: `src/dosisya/models.py` — añadir modelo `FarmaciaUpdate`.
- Modify: `src/dosisya/repository.py` — añadir `actualizar_farmacia_b2b(...)`.
- Create: `tests/test_farmacias_router.py` — tests del PATCH.

**Frontend (`/home/josemarrufo/Escritorio/DosisYa-Frontend`):**
- Modify: `src/routes/admin.dashboard.tsx` — único archivo frontend tocado (fixes de Inicio, sección Facturación, Configuración funcional). Es un archivo grande pero cohesivo por ruta; se mantiene el patrón existente de secciones internas.

---

## Task 1: Backend — extender el dashboard GET con campos de contacto

El dashboard GET hoy devuelve `nombre_farmacia`, `estado_afiliacion`, `nivel_suscripcion`, etc., pero **no** `whatsapp`, `sector` ni `punto_referencia`. Configuración (Task 5) los necesita para precargar el formulario.

**Files:**
- Modify: `src/dosisya/routers/farmacias.py` (query `_SELECT_FARMACIA_CON_INVENTARIO` ~línea 93; función `get_dashboard_farmacia`; bloque `return RespuestaEstructurada(...)`)
- Test: `tests/test_farmacias_router.py` (se crea en Task 2; esta task no añade test propio — se cubre manualmente vía el smoke del dashboard y por el consumo del frontend, y el SELECT extendido no cambia el shape existente)

**Interfaces:**
- Produces: la respuesta de `GET /api/v1/farmacias/{id}/dashboard` gana en `data`: `whatsapp: str | null`, `sector: str | null`, `punto_referencia: str | null`.

- [ ] **Step 1: Extender el SELECT para traer los campos de contacto**

En `src/dosisya/routers/farmacias.py`, en `_SELECT_FARMACIA_CON_INVENTARIO`, añadir tres columnas escalares de la farmacia junto a las que ya existen (`f.nombre`, `f.sector`, etc.). El bloque de columnas de `f` debe quedar así:

```sql
        f.id                                AS farmacia_id,
        f.nombre                            AS nombre_farmacia,
        f.estado_afiliacion::TEXT           AS estado_afiliacion,
        f.nivel_suscripcion::TEXT           AS nivel_suscripcion,
        f.sector,
        f.telefono_whatsapp                 AS whatsapp,
        f.punto_referencia,
```

(El resto del SELECT — inventario, JOINs, WHERE, ORDER BY — no cambia.)

- [ ] **Step 2: Leer los nuevos campos del primer row**

En `get_dashboard_farmacia`, donde hoy se leen `farmacia_nombre`, `estado`, `nivel` de `inv_rows[0]`, añadir debajo:

```python
            farmacia_whatsapp: str | None = inv_rows[0]["whatsapp"]
            farmacia_sector: str | None = inv_rows[0]["sector"]
            farmacia_referencia: str | None = inv_rows[0]["punto_referencia"]
```

- [ ] **Step 3: Incluir los campos en la respuesta**

En el `return RespuestaEstructurada(...)`, dentro de `data`, en el bloque `# ── Identidad ──`, añadir tras `"nivel_suscripcion": nivel,`:

```python
            "whatsapp": farmacia_whatsapp,
            "sector": farmacia_sector,
            "punto_referencia": farmacia_referencia,
```

- [ ] **Step 4: Verificar que el módulo carga sin errores**

Run: `cd /home/josemarrufo/Escritorio/DosisYa-Backend && python -c "import dosisya.routers.farmacias"`
Expected: sin salida (import OK, sin SyntaxError).

- [ ] **Step 5: Commit**

```bash
cd /home/josemarrufo/Escritorio/DosisYa-Backend
git add src/dosisya/routers/farmacias.py
git commit -m "feat(dashboard): exponer whatsapp, sector y punto_referencia en el GET"
```

---

## Task 2: Backend — `PATCH /api/v1/farmacias/{id}` para editar la farmacia

**Files:**
- Modify: `src/dosisya/models.py` (junto a `FarmaciaRegistroB2B`, ~línea 587)
- Modify: `src/dosisya/repository.py` (junto a `upsert_registro_parcial_b2b`, ~línea 542)
- Modify: `src/dosisya/routers/farmacias.py` (nueva ruta tras `get_dashboard_farmacia`)
- Create: `tests/test_farmacias_router.py`

**Interfaces:**
- Consumes: `verify_token` (dep FastAPI, devuelve `{"sub": farmacia_id, "rol": ...}`), `get_connection`, `RepositoryError`, `RespuestaEstructurada`.
- Produces:
  - `FarmaciaUpdate` (Pydantic): `nombre_farmacia: str | None`, `whatsapp: str | None`, `sector: str | None`, `punto_referencia: str | None`.
  - `actualizar_farmacia_b2b(farmacia_id: str, cambios: dict[str, str]) -> dict` — hace el UPDATE dinámico y devuelve el row actualizado (`id`, `nombre`, `telefono_whatsapp`, `sector`, `punto_referencia`). Lanza `RepositoryNotFoundError` si no existe, `RepositoryError` en fallo de BD.
  - Ruta `PATCH /api/v1/farmacias/{farmacia_id}`.

- [ ] **Step 1: Añadir el modelo `FarmaciaUpdate` en `models.py`**

Tras la definición de `FarmaciaRegistroB2B` (~línea 636), añadir:

```python
class FarmaciaUpdate(BaseModel):
    """PATCH parcial de los datos editables de una farmacia (panel B2B).

    Todos los campos son opcionales: solo se actualizan los presentes.
    `rif` y `correo` NO son editables por este endpoint (identidad/login).
    """
    nombre_farmacia: str | None = Field(None, min_length=2, max_length=200)
    whatsapp: str | None = Field(None, pattern=r"^\+58\d{10}$")
    sector: str | None = Field(None, max_length=100)
    punto_referencia: str | None = Field(None, max_length=500)
```

- [ ] **Step 2: Añadir la función de repositorio `actualizar_farmacia_b2b`**

En `src/dosisya/repository.py`, tras `upsert_registro_parcial_b2b` (~línea 572), añadir. El UPDATE se arma dinámicamente pero **solo con nombres de columna de una allow-list fija** (nunca con valores del usuario en el string) y valores por parámetro posicional:

```python
# Mapa campo-de-modelo → columna real en la tabla farmacias.
# Allow-list fija: la clave del dict de entrada SIEMPRE sale de este mapa,
# nunca directo del request. Los valores van por parámetro posicional ($N).
_FARMACIA_UPDATE_COLUMNAS: dict[str, str] = {
    "nombre_farmacia": "nombre",
    "whatsapp": "telefono_whatsapp",
    "sector": "sector",
    "punto_referencia": "punto_referencia",
}


async def actualizar_farmacia_b2b(farmacia_id: str, cambios: dict[str, str]) -> dict:
    """Actualiza los datos editables de una farmacia (nombre, whatsapp, sector, ref).

    Args:
        farmacia_id: UUID de la farmacia (string, ya validado por el router).
        cambios:     dict {campo_modelo: valor} — solo campos presentes en el PATCH.

    Returns:
        Dict con id, nombre, telefono_whatsapp, sector, punto_referencia actualizados.

    Raises:
        RepositoryNotFoundError: si no existe una farmacia con ese id.
        RepositoryError:         cualquier otro error irrecuperable de BD.
    """
    set_fragmentos: list[str] = []
    valores: list[str] = []
    for campo, valor in cambios.items():
        columna = _FARMACIA_UPDATE_COLUMNAS[campo]  # KeyError imposible: router valida antes
        valores.append(valor)
        set_fragmentos.append(f"{columna} = ${len(valores)}")

    # updated_at se refresca por trigger; igual lo tocamos explícito por claridad.
    set_fragmentos.append("updated_at = now()")
    farmacia_pos = len(valores) + 1
    sql = (
        "UPDATE farmacias SET "
        + ", ".join(set_fragmentos)
        + f" WHERE id = ${farmacia_pos} "
        + "RETURNING id, nombre, telefono_whatsapp, sector, punto_referencia;"
    )

    try:
        async with get_connection() as conn:
            row = await conn.fetchrow(sql, *valores, farmacia_id)
    except asyncpg.PostgresError as e:
        logger.error("Error de BD en actualizar_farmacia_b2b [id=%s]: %s", farmacia_id, e)
        raise RepositoryError("Error interno al actualizar la farmacia.") from e

    if row is None:
        raise RepositoryNotFoundError(f"No existe una farmacia con id '{farmacia_id}'.")

    return dict(row)
```

- [ ] **Step 3: Añadir la ruta PATCH en `farmacias.py`**

Primero, extender el import de repository (líneas 39-43) para incluir la función y el error nuevos:

```python
from dosisya.repository import (
    RepositoryError,
    RepositoryNotFoundError,
    actualizar_farmacia_b2b,
    upsert_inventario_lote,
)
```

Y añadir a los imports de models (línea 38):

```python
from dosisya.models import FarmaciaUpdate, RespuestaEstructurada
```

Luego, tras la función `get_dashboard_farmacia` (antes de la sección de upload, ~línea 350), añadir la ruta:

```python
@router.patch(
    "/api/v1/farmacias/{farmacia_id}",
    response_model=RespuestaEstructurada,
    summary="Actualiza datos editables de la farmacia (protegido con JWT)",
    responses={
        200: {"description": "Farmacia actualizada"},
        400: {"description": "farmacia_id no es un UUID válido"},
        401: {"description": "Token ausente, inválido o expirado"},
        403: {"description": "El token no autoriza editar esta farmacia"},
        404: {"description": "Farmacia no encontrada"},
        422: {"description": "Datos inválidos o sin campos para actualizar"},
        500: {"description": "Error interno"},
    },
)
async def patch_farmacia(
    farmacia_id: str,
    body: FarmaciaUpdate,
    token_data: dict = Depends(verify_token),  # noqa: B008
) -> RespuestaEstructurada:
    """Actualiza nombre, whatsapp, sector o punto de referencia de una farmacia.

    Autorización por recurso: admin_farmacia solo edita su propia farmacia;
    superadmin puede editar cualquiera. Mismo patrón que get_dashboard_farmacia.
    """
    # ─── Validar UUID ────────────────────────────────────────────────────────
    try:
        UUID(farmacia_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"'{farmacia_id}' no es un UUID válido.",
        ) from e

    # ─── Autorización por recurso ────────────────────────────────────────────
    rol = token_data.get("rol", "")
    token_farmacia_id = token_data.get("sub", "")
    if rol != "superadmin" and token_farmacia_id != farmacia_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permiso para editar esta farmacia.",
        )

    # ─── Solo los campos presentes en el PATCH ───────────────────────────────
    cambios = body.model_dump(exclude_unset=True, exclude_none=True)
    if not cambios:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No se envió ningún campo para actualizar.",
        )

    try:
        row = await actualizar_farmacia_b2b(farmacia_id, cambios)
    except RepositoryNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e)) from e
    except RepositoryError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error interno al actualizar la farmacia.",
        ) from e

    return RespuestaEstructurada(
        status="success",
        message="Datos de la farmacia actualizados.",
        data={
            "farmacia_id": str(row["id"]),
            "nombre_farmacia": row["nombre"],
            "whatsapp": row["telefono_whatsapp"],
            "sector": row["sector"],
            "punto_referencia": row["punto_referencia"],
        },
    )
```

- [ ] **Step 4: Escribir los tests (fallan primero)**

Crear `tests/test_farmacias_router.py`:

```python
"""DosisYa — Tests del router de farmacias: PATCH /api/v1/farmacias/{id}."""

from __future__ import annotations

import uuid

import pytest
from fastapi.testclient import TestClient

from dosisya.main import app
from dosisya.security import verify_token

client = TestClient(app)

FARMACIA_ID = str(uuid.uuid4())
OTRA_FARMACIA_ID = str(uuid.uuid4())


def _override_token(sub: str, rol: str = "admin_farmacia"):
    return lambda: {"sub": sub, "rol": rol, "nombre_farmacia": "Test"}


@pytest.fixture(autouse=True)
def _clear_overrides():
    yield
    app.dependency_overrides.clear()


@pytest.fixture()
def mock_repo(monkeypatch):
    """Captura los cambios y devuelve un row simulado."""
    llamadas: list[tuple[str, dict]] = []

    async def fake_actualizar(farmacia_id: str, cambios: dict) -> dict:
        llamadas.append((farmacia_id, cambios))
        return {
            "id": uuid.UUID(farmacia_id),
            "nombre": cambios.get("nombre_farmacia", "Farmacia Test"),
            "telefono_whatsapp": cambios.get("whatsapp", "+584120000000"),
            "sector": cambios.get("sector", "acarigua"),
            "punto_referencia": cambios.get("punto_referencia", "Av. Principal"),
        }

    monkeypatch.setattr(
        "dosisya.routers.farmacias.actualizar_farmacia_b2b", fake_actualizar
    )
    return llamadas


class TestPatchFarmacia:
    def test_actualiza_su_propia_farmacia(self, mock_repo):
        app.dependency_overrides[verify_token] = _override_token(FARMACIA_ID)
        resp = client.patch(
            f"/api/v1/farmacias/{FARMACIA_ID}",
            json={"nombre_farmacia": "Farmacia Nueva"},
        )
        assert resp.status_code == 200
        assert resp.json()["data"]["nombre_farmacia"] == "Farmacia Nueva"
        assert mock_repo[0] == (FARMACIA_ID, {"nombre_farmacia": "Farmacia Nueva"})

    def test_403_si_edita_farmacia_ajena(self, mock_repo):
        app.dependency_overrides[verify_token] = _override_token(FARMACIA_ID)
        resp = client.patch(
            f"/api/v1/farmacias/{OTRA_FARMACIA_ID}",
            json={"nombre_farmacia": "Hackeo"},
        )
        assert resp.status_code == 403
        assert mock_repo == []

    def test_superadmin_edita_cualquier_farmacia(self, mock_repo):
        app.dependency_overrides[verify_token] = _override_token(
            FARMACIA_ID, rol="superadmin"
        )
        resp = client.patch(
            f"/api/v1/farmacias/{OTRA_FARMACIA_ID}",
            json={"sector": "araure"},
        )
        assert resp.status_code == 200
        assert mock_repo[0][0] == OTRA_FARMACIA_ID

    def test_422_sin_campos(self, mock_repo):
        app.dependency_overrides[verify_token] = _override_token(FARMACIA_ID)
        resp = client.patch(f"/api/v1/farmacias/{FARMACIA_ID}", json={})
        assert resp.status_code == 422
        assert mock_repo == []

    def test_422_whatsapp_invalido(self, mock_repo):
        app.dependency_overrides[verify_token] = _override_token(FARMACIA_ID)
        resp = client.patch(
            f"/api/v1/farmacias/{FARMACIA_ID}",
            json={"whatsapp": "04120000000"},
        )
        assert resp.status_code == 422
        assert mock_repo == []

    def test_400_uuid_invalido(self, mock_repo):
        app.dependency_overrides[verify_token] = _override_token("no-es-uuid")
        resp = client.patch(
            "/api/v1/farmacias/no-es-uuid", json={"nombre_farmacia": "X"}
        )
        assert resp.status_code == 400
```

- [ ] **Step 5: Correr los tests (verificar que pasan)**

Run: `cd /home/josemarrufo/Escritorio/DosisYa-Backend && python -m pytest tests/test_farmacias_router.py -v`
Expected: 6 passed.

Nota: si `test_422_whatsapp_invalido` diera 400 en vez de 422 por orden de validación, revisar que FastAPI valida el body (422) antes de entrar al handler — es el comportamiento por defecto, así que 422 es correcto.

- [ ] **Step 6: Commit**

```bash
cd /home/josemarrufo/Escritorio/DosisYa-Backend
git add src/dosisya/models.py src/dosisya/repository.py src/dosisya/routers/farmacias.py tests/test_farmacias_router.py
git commit -m "feat(farmacias): PATCH para editar datos de la farmacia (auth por recurso)"
```

---

## Task 3: Frontend — corregir bugs de datos en Inicio

**Files:**
- Modify: `src/routes/admin.dashboard.tsx` (tipo `DashboardData` ~línea 52; `InicioSection` ~línea 301; `InventarioSection` ~línea 400)

**Interfaces:**
- Consumes: la respuesta del dashboard GET (ya extendida en Task 1).
- Produces: `DashboardData` gana `busquedas_zona_disponible?: boolean`, `whatsapp?: string`, `sector?: string`, `punto_referencia?: string`, y campos de facturación (usados en Task 4): `total_leads_mes_actual?`, `deuda_estimada_usd?`, `tarifa_por_lead_usd?`, `leads_recientes?`.

- [ ] **Step 1: Extender el tipo `DashboardData`**

Reemplazar el tipo `DashboardData` (líneas 52-65) por:

```tsx
type LeadReciente = {
  lead_id: string;
  fecha_hora: string;
  tipo_interaccion: string;
  medicamento_buscado_id?: string | null;
  medicamento_nombre?: string | null;
  medicamento_marca?: string | null;
};

type DashboardData = {
  nombre_farmacia?: string;
  pacientes_interesados_hoy?: number;
  busquedas_zona?: number | null;
  busquedas_zona_disponible?: boolean;
  total_inventario?: number;
  leads_recipe_mes_actual?: number;
  total_leads_mes_actual?: number;
  deuda_estimada_usd?: number;
  tarifa_por_lead_usd?: number;
  leads_recientes?: LeadReciente[];
  whatsapp?: string;
  sector?: string;
  punto_referencia?: string;
  inventario?: Array<{
    id?: string;
    nombre: string;
    presentacion?: string;
    stock?: number;
    precio_usd?: number;
  }>;
};
```

- [ ] **Step 2: Corregir "Total en Inventario" para contar el array real**

En `InicioSection` (línea 316), reemplazar:

```tsx
  const totalInv = inventoryCount ?? data?.total_inventario ?? 0;
```

por:

```tsx
  const totalInv = inventoryCount ?? data?.inventario?.length ?? 0;
```

- [ ] **Step 3: Comunicar "Búsquedas cerca de ti" como próximamente**

En `InicioSection`, en el `MetricCard` de "Búsquedas cerca de ti" (líneas 359-365), reemplazar el bloque por:

```tsx
        <MetricCard
          label="Búsquedas cerca de ti"
          value={
            loading
              ? null
              : data?.busquedas_zona_disponible === false
                ? "Pronto"
                : (data?.busquedas_zona?.toString() ?? "—")
          }
          hint={
            data?.busquedas_zona_disponible === false
              ? "Métrica en camino"
              : "Personas buscando medicinas en tu zona"
          }
          icon={<Search className="h-5 w-5" />}
          accent="bg-primary/10 text-primary"
        />
```

- [ ] **Step 4: Eliminar el fallback de inventario falso**

En `InventarioSection` (líneas 409-414), reemplazar:

```tsx
  const items = data?.inventario ?? [
    { nombre: "Acetaminofén 500mg", presentacion: "Tabletas x 10", stock: 45, precio_usd: 1.2 },
    { nombre: "Ibuprofeno 400mg", presentacion: "Tabletas x 20", stock: 30, precio_usd: 2.5 },
    { nombre: "Amoxicilina 500mg", presentacion: "Cápsulas x 21", stock: 12, precio_usd: 4.8 },
    { nombre: "Loratadina 10mg", presentacion: "Tabletas x 10", stock: 28, precio_usd: 1.8 },
  ];
```

por:

```tsx
  const items = data?.inventario ?? [];
```

(El estado vacío existente — "Aún no tienes inventario cargado..." — cubre tanto la farmacia sin stock como el caso `data === null` por error, que además ya muestra el banner de error rojo en Inicio.)

- [ ] **Step 5: Verificar tipos y build**

Run: `cd /home/josemarrufo/Escritorio/DosisYa-Frontend && npx tsc --noEmit && npm run build`
Expected: ambos comandos terminan sin errores.

- [ ] **Step 6: Verificación manual**

Run: `npm run dev` y abrir `http://localhost:5173/admin/dashboard` (con sesión iniciada). Confirmar: "Total en Inventario" muestra el conteo real; "Búsquedas cerca de ti" dice "Pronto" / "Métrica en camino"; la tabla de inventario NO muestra Acetaminofén/Ibuprofeno de ejemplo cuando no hay datos.

- [ ] **Step 7: Commit**

```bash
cd /home/josemarrufo/Escritorio/DosisYa-Frontend
git add src/routes/admin.dashboard.tsx
git commit -m "fix(dashboard): conteo real de inventario, busquedas_zona 'pronto', sin mock de inventario"
```

---

## Task 4: Frontend — sección Facturación

**Files:**
- Modify: `src/routes/admin.dashboard.tsx` (tipo `SectionId` ~línea 50; import de iconos ~línea 4; array `nav` ~línea 128; render de secciones ~línea 204; añadir componente `FacturacionSection` y helper de etiquetas)

**Interfaces:**
- Consumes: `DashboardData.total_leads_mes_actual`, `deuda_estimada_usd`, `tarifa_por_lead_usd`, `leads_recientes` (definidos en Task 3).
- Produces: componente `FacturacionSection({ loading, data })`.

- [ ] **Step 1: Añadir `"facturacion"` al tipo `SectionId` e importar iconos**

Línea 50, reemplazar:

```tsx
type SectionId = "inicio" | "inventario" | "configuracion" | "soporte";
```

por:

```tsx
type SectionId = "inicio" | "inventario" | "facturacion" | "configuracion" | "soporte";
```

En el import de `lucide-react` (líneas 4-21), añadir `Receipt` y `Clock` a la lista:

```tsx
  Receipt,
  Clock,
```

- [ ] **Step 2: Añadir el ítem de navegación**

En el array `nav` (líneas 128-133), añadir el ítem entre Inventario y Configuración:

```tsx
    { id: "inventario", label: "Mi Inventario", icon: <Package className="h-4 w-4" /> },
    { id: "facturacion", label: "Facturación", icon: <Receipt className="h-4 w-4" /> },
    { id: "configuracion", label: "Configuración", icon: <Settings className="h-4 w-4" /> },
```

- [ ] **Step 3: Renderizar la sección**

En el `AnimatePresence` de `main` (tras el bloque `{section === "inventario" && (...)}`, ~línea 223), añadir:

```tsx
              {section === "facturacion" && (
                <FacturacionSection loading={loading} data={data} />
              )}
```

- [ ] **Step 4: Añadir el helper de etiquetas de tipo de interacción**

Cerca del final del archivo, antes de `function MetricCard(`, añadir un mapa que traduce los enums (canónicos y alias legacy) a texto legible:

```tsx
const ETIQUETA_INTERACCION: Record<string, string> = {
  clic_whatsapp: "Clic a WhatsApp",
  click_whatsapp: "Clic a WhatsApp",
  clic_llamar: "Llamada",
  ver_mapa: "Vio el mapa",
  abrir_mapa: "Vio el mapa",
  ver_detalle: "Vio el detalle",
  expandir_detalle: "Vio el detalle",
  compartir: "Compartió",
  capture_pantalla: "Captura de pantalla",
};

function etiquetaInteraccion(tipo: string): string {
  return ETIQUETA_INTERACCION[tipo] ?? tipo;
}

function formatoFechaLead(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-VE", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
```

- [ ] **Step 5: Añadir el componente `FacturacionSection`**

Antes de `function MetricCard(`, añadir:

```tsx
function FacturacionSection({
  loading,
  data,
}: {
  loading: boolean;
  data: DashboardData | null;
}) {
  const leadsMes = data?.total_leads_mes_actual ?? 0;
  const tarifa = data?.tarifa_por_lead_usd ?? 0;
  const deuda = data?.deuda_estimada_usd ?? 0;
  const leads = data?.leads_recientes ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Facturación</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Lo que has generado este mes en DosisYa.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard
          label="Leads este mes"
          value={loading ? null : leadsMes.toString()}
          hint="Interacciones facturables"
          icon={<TrendingUp className="h-5 w-5" />}
          accent="bg-primary/10 text-primary"
        />
        <MetricCard
          label="Tarifa por lead"
          value={loading ? null : `$${tarifa.toFixed(2)}`}
          hint="Costo por cada interacción"
          icon={<Receipt className="h-5 w-5" />}
          accent="bg-secondary/20 text-[#0a2463]"
        />
        <MetricCard
          label="Deuda estimada del mes"
          value={loading ? null : `$${deuda.toFixed(2)}`}
          hint="Total a facturar este mes"
          icon={<MessageCircle className="h-5 w-5" />}
          accent="bg-[#25d366]/10 text-[#0f7c3a]"
        />
      </div>

      <div>
        <h2 className="text-lg font-bold text-foreground mb-3">Leads recientes</h2>
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-[0_4px_20px_-12px_rgba(10,36,99,0.15)]">
          {loading ? (
            <div className="p-6 space-y-3">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : leads.length === 0 ? (
            <div className="p-12 text-center">
              <Clock className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                Aún no hay leads este período. Aparecerán aquí en cuanto lleguen.
              </p>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden sm:block">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="px-6">Fecha</TableHead>
                      <TableHead>Interacción</TableHead>
                      <TableHead>Medicamento</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leads.map((l) => (
                      <TableRow key={l.lead_id}>
                        <TableCell className="px-6 text-muted-foreground whitespace-nowrap">
                          {formatoFechaLead(l.fecha_hora)}
                        </TableCell>
                        <TableCell className="font-medium">
                          {etiquetaInteraccion(l.tipo_interaccion)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {l.medicamento_nombre
                            ? `${l.medicamento_nombre}${l.medicamento_marca ? ` · ${l.medicamento_marca}` : ""}`
                            : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile cards */}
              <ul className="sm:hidden divide-y divide-border">
                {leads.map((l) => (
                  <li key={l.lead_id} className="p-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium">
                        {etiquetaInteraccion(l.tipo_interaccion)}
                      </span>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatoFechaLead(l.fecha_hora)}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 truncate">
                      {l.medicamento_nombre
                        ? `${l.medicamento_nombre}${l.medicamento_marca ? ` · ${l.medicamento_marca}` : ""}`
                        : "Sin medicamento asociado"}
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Verificar tipos y build**

Run: `cd /home/josemarrufo/Escritorio/DosisYa-Frontend && npx tsc --noEmit && npm run build`
Expected: ambos limpios.

- [ ] **Step 7: Verificación manual**

`npm run dev` → dashboard → clic en "Facturación" en el sidebar. Confirmar: aparecen las 3 tarjetas (leads, tarifa `$0.10`, deuda) y la tabla de leads recientes (o el estado vacío si no hay). Probar en móvil (375px) que la tabla cae a cards.

- [ ] **Step 8: Commit**

```bash
cd /home/josemarrufo/Escritorio/DosisYa-Frontend
git add src/routes/admin.dashboard.tsx
git commit -m "feat(dashboard): sección Facturación con deuda, leads del mes y leads recientes"
```

---

## Task 5: Frontend — Configuración funcional

**Files:**
- Modify: `src/routes/admin.dashboard.tsx` (imports; añadir `SECTORES` + schema Zod; reescribir `ConfiguracionSection`; el helper `Field` local de esta sección)

**Interfaces:**
- Consumes: `DashboardData` (nombre, whatsapp, sector, punto_referencia), `API_BASE`, `toast` de sonner.
- Produces: `ConfiguracionSection` conectada al `PATCH /api/v1/farmacias/{id}`.

- [ ] **Step 1: Añadir imports necesarios**

Tres cambios de import:

1. En el import de `lucide-react` (líneas 4-21, que ya incluye `MapPin`, y tras Task 4 también `Receipt`/`Clock`), añadir `Loader2` a la lista:

```tsx
  Loader2,
```

2. Tras el import de `Input` (~línea 25), añadir el import de `Label` (el componente ya existe en `@/components/ui/label`, lo usa el login):

```tsx
import { Label } from "@/components/ui/label";
```

3. Cerca de los imports de librería, añadir Zod y el toast (ambos ya son parte del stack):

```tsx
import { z } from "zod";
import { toast } from "sonner";
```

`MapPin` ya está importado — se reutiliza tal cual en el selector de sector. No re-importar iconos existentes.

- [ ] **Step 2: Añadir el catálogo de sectores y el schema de validación**

Antes de `function ConfiguracionSection(`, añadir (mismo catálogo que usa el wizard de registro en `admin.login.tsx`):

```tsx
const SECTORES_CONFIG: { value: string; label: string }[] = [
  { value: "acarigua", label: "Acarigua" },
  { value: "araure", label: "Araure" },
];

const configSchema = z.object({
  nombre_farmacia: z
    .string()
    .trim()
    .min(2, "Mínimo 2 caracteres")
    .max(200, "Máximo 200 caracteres"),
  whatsapp: z
    .string()
    .regex(/^\+58\d{10}$/, "Formato: +58 seguido de 10 dígitos"),
  sector: z.string().min(1, "Selecciona un sector"),
  punto_referencia: z
    .string()
    .trim()
    .min(5, "Describe brevemente (mín. 5 caracteres)")
    .max(180, "Máximo 180 caracteres"),
});

const formatoTelefonoVE = (raw: string) => {
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("58")) d = d.slice(2);
  if (d.startsWith("0")) d = d.slice(1);
  d = d.slice(0, 10);
  return d ? `+58${d}` : "";
};
```

- [ ] **Step 3: Reescribir `ConfiguracionSection`**

`ConfiguracionSection` hoy recibe solo `nombre`. Cambiar su firma para recibir `data` y una forma de refrescar el nombre del sidebar. Reemplazar toda la función `ConfiguracionSection` (líneas 507-526) por:

```tsx
function ConfiguracionSection({
  data,
  onNombreActualizado,
}: {
  data: DashboardData | null;
  onNombreActualizado: (nombre: string) => void;
}) {
  const [nombre, setNombre] = useState(data?.nombre_farmacia ?? "");
  const [whatsapp, setWhatsapp] = useState(data?.whatsapp ?? "");
  const [sector, setSector] = useState(data?.sector ?? "");
  const [referencia, setReferencia] = useState(data?.punto_referencia ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Precargar cuando llegue/cambie la data del dashboard.
  useEffect(() => {
    if (!data) return;
    setNombre(data.nombre_farmacia ?? "");
    setWhatsapp(data.whatsapp ?? "");
    setSector(data.sector ?? "");
    setReferencia(data.punto_referencia ?? "");
  }, [data]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const parsed = configSchema.safeParse({
      nombre_farmacia: nombre,
      whatsapp,
      sector,
      punto_referencia: referencia,
    });
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const k = issue.path[0] as string;
        if (k && !errs[k]) errs[k] = issue.message;
      }
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});

    const farmaciaId =
      typeof window !== "undefined" ? localStorage.getItem("farmacia_id") : null;
    const token =
      typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
    if (!farmaciaId) {
      setError("Sesión no encontrada. Inicia sesión de nuevo.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/farmacias/${farmaciaId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(parsed.data),
      });
      if (res.status === 401 || res.status === 403) {
        setError("Tu sesión expiró. Inicia sesión de nuevo.");
        return;
      }
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          json?.detail || json?.error?.message || "No se pudieron guardar los cambios",
        );
      }
      const nombreGuardado: string = json?.data?.nombre_farmacia ?? parsed.data.nombre_farmacia;
      if (typeof window !== "undefined") {
        localStorage.setItem("nombre_farmacia", nombreGuardado);
      }
      onNombreActualizado(nombreGuardado);
      toast.success("Datos actualizados con éxito");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Configuración</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Actualiza los datos de tu farmacia.
        </p>
      </div>

      <form
        onSubmit={onSubmit}
        className="bg-card border border-border rounded-2xl p-5 sm:p-6 space-y-4 shadow-[0_4px_20px_-12px_rgba(10,36,99,0.15)]"
        noValidate
      >
        <div className="space-y-1.5">
          <Label htmlFor="cfg-nombre">Nombre de la farmacia</Label>
          <Input
            id="cfg-nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            maxLength={200}
            aria-invalid={Boolean(fieldErrors.nombre_farmacia)}
          />
          {fieldErrors.nombre_farmacia && (
            <p className="text-xs text-destructive">{fieldErrors.nombre_farmacia}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="cfg-whatsapp">WhatsApp</Label>
          <Input
            id="cfg-whatsapp"
            value={whatsapp}
            onChange={(e) => setWhatsapp(formatoTelefonoVE(e.target.value))}
            placeholder="+584121234567"
            inputMode="tel"
            maxLength={13}
            aria-invalid={Boolean(fieldErrors.whatsapp)}
          />
          {fieldErrors.whatsapp && (
            <p className="text-xs text-destructive">{fieldErrors.whatsapp}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label>Sector / Ciudad</Label>
          <div className="grid grid-cols-2 gap-2">
            {SECTORES_CONFIG.map((s) => {
              const active = sector === s.value;
              return (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setSector(s.value)}
                  className={`h-11 rounded-md border text-sm font-medium transition-colors inline-flex items-center justify-center gap-2 ${
                    active
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background border-input hover:bg-accent"
                  }`}
                >
                  <MapPin className="h-4 w-4" /> {s.label}
                </button>
              );
            })}
          </div>
          {fieldErrors.sector && (
            <p className="text-xs text-destructive">{fieldErrors.sector}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="cfg-ref">Punto de referencia</Label>
          <Input
            id="cfg-ref"
            value={referencia}
            onChange={(e) => setReferencia(e.target.value)}
            placeholder="Ej. A 2 cuadras de la plaza Bolívar"
            maxLength={180}
            aria-invalid={Boolean(fieldErrors.punto_referencia)}
          />
          {fieldErrors.punto_referencia && (
            <p className="text-xs text-destructive">{fieldErrors.punto_referencia}</p>
          )}
        </div>

        {error && (
          <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
            {error}
          </div>
        )}

        <Button type="submit" disabled={saving} className="w-full sm:w-auto">
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Guardando…
            </>
          ) : (
            "Guardar cambios"
          )}
        </Button>
      </form>
    </div>
  );
}
```

- [ ] **Step 4: Actualizar la llamada a `ConfiguracionSection` y el estado del nombre**

El nombre mostrado hoy es una constante derivada (línea 123 `const nombre = ...`). Para que "Guardar" actualice el saludo sin recargar, convertirlo en estado.

En `AdminDashboard`, reemplazar la constante `nombre` (líneas 123-126) por un estado que se sincroniza con la data:

```tsx
  const [nombre, setNombre] = useState<string>(
    typeof window !== "undefined"
      ? localStorage.getItem("nombre_farmacia") ?? "tu farmacia"
      : "tu farmacia",
  );

  useEffect(() => {
    if (data?.nombre_farmacia) setNombre(data.nombre_farmacia);
  }, [data]);
```

Luego, en el render, reemplazar la llamada existente (línea 224):

```tsx
              {section === "configuracion" && <ConfiguracionSection nombre={nombre} />}
```

por:

```tsx
              {section === "configuracion" && (
                <ConfiguracionSection data={data} onNombreActualizado={setNombre} />
              )}
```

- [ ] **Step 5: Verificar tipos y build**

Run: `cd /home/josemarrufo/Escritorio/DosisYa-Frontend && npx tsc --noEmit && npm run build`
Expected: ambos limpios. (Si `tsc` marca `nombre` o `useEffect` sin usar/duplicado, resolver: `useEffect` ya está importado en la línea 2 del archivo.)

- [ ] **Step 6: Verificación manual end-to-end**

Con backend corriendo (`localhost:8000`) y `npm run dev`:
1. Login real → Configuración muestra nombre/whatsapp/sector/referencia reales precargados.
2. Cambiar el nombre → Guardar → aparece toast de éxito y el saludo "Hola, {nombre}" cambia sin recargar.
3. Poner WhatsApp inválido (ej. borrar dígitos) → error de validación inline, no se envía.
4. Recargar la página → el cambio persiste (viene del backend).

- [ ] **Step 7: Commit**

```bash
cd /home/josemarrufo/Escritorio/DosisYa-Frontend
git add src/routes/admin.dashboard.tsx
git commit -m "feat(dashboard): Configuración editable con PATCH real + validación Zod"
```

---

## Verificación final del sub-proyecto

- [ ] Backend: `cd /home/josemarrufo/Escritorio/DosisYa-Backend && python -m pytest tests/ -q` → todo en verde.
- [ ] Frontend: `cd /home/josemarrufo/Escritorio/DosisYa-Frontend && npx tsc --noEmit && npm run build` → limpios.
- [ ] Manual: login → Inicio (conteos reales, sin mocks) → Facturación (deuda/leads) → Configuración (editar + persistir).
- [ ] `scripts/test-leads-cpc.sh` NO aplica (no se tocó `leads*.ts` ni `whatsapp.ts`).
