# Verificación de habilitación sanitaria — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que ninguna farmacia se publique sin datos de regente y permiso del SACS, que dos farmacias activas no puedan compartir regente, y que aprobar deje de ser un botón.

**Architecture:** Seis columnas de datos y cuatro de verificación en `farmacias`, más un índice `UNIQUE` parcial que solo cubre las `activa`. La farmacia llena los datos desde Configuración del panel; el superadmin no puede pasarla a `activa` sin ellos, sin resolver el conflicto de regente, y sin dos confirmaciones separadas que quedan selladas con quién y cuándo.

**Tech Stack:** PostgreSQL (Supabase) · Python 3.12 + FastAPI + asyncpg + pytest · React 19 + TanStack Start + TypeScript + Vitest

**Spec:** [`docs/superpowers/specs/2026-10-12-verificacion-habilitacion-design.md`](../specs/2026-10-12-verificacion-habilitacion-design.md)

## Global Constraints

- **ORDEN DE DESPLIEGUE: backend primero.** El frontend lee dos booleanos que solo existen tras desplegar el backend, y los marca opcionales (`?`) igual que `ubicacion_configurada`, que ya lleva ese tratamiento *«porque un backend viejo no lo devuelve»*. Con el orden correcto nunca se ve el caso degradado.
- **Dos repos.** Backend en `/home/josemarrufo/Escritorio/DosisYa-Backend`, frontend en este worktree.
- **El backend requiere autorización expresa de José** (CLAUDE.md §2), y **aplicar la migración 013 a Supabase también** (CLAUDE.md §8). Usar `apply_migration`, no `execute_sql`, para que quede registrada.
- **Los seis campos obligatorios para aprobar**, copiados de la spec §7: `regente_nombre`, `regente_colegiatura`, `regente_colegio_entidad`, `regente_inh`, `sacs_autorizacion`, `sacs_fecha`. Los cuatro de verificación los escribe el sistema, no la farmacia.
- **El índice `UNIQUE` cubre SOLO `estado_afiliacion = 'activa'`.** Si cubriera las no-inactivas, el `INSERT` del registro fallaría ante una colisión y bloquearía registrarse — contradiciendo la decisión 4 de la spec. Dos `pendiente` con el mismo regente **deben** poder coexistir.
- **Suspender o devolver a pendiente no exige nada.** Solo la transición a `activa` tiene gate: poder suspender una farmacia problemática no puede depender de que sus datos estén completos.
- **Cero cambios en el wizard de registro** (spec §6). Los campos van en Configuración del panel.
- **Los tests del backend mockean la conexión**: el SQL no lo cubre pytest. Cada cambio de SQL lleva su verificación contra la base real.
- **No hay infraestructura de tests de componentes** (sin `@testing-library`). La lógica del gate va en una **función pura** en `adminApi.ts` —siguiendo el patrón de `requiereConfirmacionUbicacion`— que sí se testea; el render se verifica en navegador.
- **`main` del backend arrastra 4 tests rojos pre-existentes** en `tests/test_farmacias_inventario_router.py`. Conteo de partida: `4 failed, 310 passed`.
- **Verificación mínima antes de cada commit** — frontend: `npx tsc --noEmit && npm run build && npm test`. Backend: `.venv/bin/python -m pytest -q`.

---

## File Structure

### Backend (`DosisYa-Backend`)

| Archivo | Responsabilidad |
|---|---|
| `db/migrations/013_habilitacion_sanitaria.sql` | **Crear.** Diez columnas + índice único parcial |
| `db/schema.sql` | **Modificar.** Reflejar la 013 |
| `src/dosisya/models.py` | **Modificar.** Campos en `FarmaciaConfigUpdate` y `CambioEstadoFarmacia` |
| `src/dosisya/routers/farmacias.py` | **Modificar.** `_UPDATE_FARMACIA_CONFIG` guarda los seis campos |
| `src/dosisya/routers/admin_super.py` | **Modificar.** Gate de aprobación + dos booleanos en la lista |
| `tests/test_admin_habilitacion.py` | **Crear.** Gate de aprobación |
| `tests/test_farmacias_habilitacion.py` | **Crear.** Guardado desde el panel |

### Frontend (este worktree)

| Archivo | Responsabilidad |
|---|---|
| `src/lib/adminApi.ts` | **Modificar.** Tipos + función pura `faltaHabilitacion` + firma de `cambiarEstadoFarmacia` |
| `src/lib/adminApi.test.ts` | **Modificar.** Tests de la función pura |
| `src/routes/admin.dashboard.tsx` | **Modificar.** Campos de habilitación en Configuración |
| `src/components/super/TablaFarmacias.tsx` | **Modificar.** Pintar los dos booleanos |
| `src/components/super/EditarFarmaciaDrawer.tsx` | **Modificar.** Dos casillas de confirmación |

---

## Task 1: La migración 013

**Files:**
- Create: `DosisYa-Backend/db/migrations/013_habilitacion_sanitaria.sql`
- Modify: `DosisYa-Backend/db/schema.sql`

**Interfaces:**
- Consumes: nada
- Produces: columnas `regente_nombre`, `regente_colegiatura`, `regente_colegio_entidad`, `regente_inh`, `sacs_autorizacion`, `sacs_fecha`, `regente_verificado_por`, `regente_verificado_en`, `sacs_verificado_por`, `sacs_verificado_en` en `farmacias`; índice `uq_regente_un_establecimiento`

- [ ] **Step 1: Escribir la migración**

Crear `db/migrations/013_habilitacion_sanitaria.sql`:

```sql
-- ============================================================
-- DosisYa — Migración 013: habilitación sanitaria (hallazgo B-02, fase 1)
-- Spec: DosisYa-Frontend/docs/superpowers/specs/2026-10-12-verificacion-habilitacion-design.md
-- Ejecutar UNA SOLA VEZ contra Supabase (SQL Editor o psql).
--
-- POR QUÉ ESTAS COLUMNAS VIVEN EN `farmacias` Y NO EN UNA TABLA APARTE
--   La intención inicial era una tabla 1:1 para no ensanchar `farmacias`. No
--   se puede: el índice UNIQUE parcial de abajo necesita filtrar por
--   estado_afiliacion, y un índice parcial NO puede referenciar otra tabla.
--   Además es el patrón que el esquema ya usa para rif y correo.
--
-- FASE 1: datos declarados, sin documentos. Almacenar los PDF/fotos del
--   permiso requiere infraestructura de archivos que el backend no tiene, y
--   es una spec aparte.
-- ============================================================

BEGIN;

ALTER TABLE farmacias
  ADD COLUMN regente_nombre           VARCHAR(200),
  ADD COLUMN regente_colegiatura      VARCHAR(50),
  ADD COLUMN regente_colegio_entidad  VARCHAR(100),
  ADD COLUMN regente_inh              VARCHAR(50),
  ADD COLUMN sacs_autorizacion        VARCHAR(100),
  ADD COLUMN sacs_fecha               DATE,
  ADD COLUMN regente_verificado_por   UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  ADD COLUMN regente_verificado_en    TIMESTAMPTZ,
  ADD COLUMN sacs_verificado_por      UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  ADD COLUMN sacs_verificado_en       TIMESTAMPTZ;

COMMENT ON COLUMN farmacias.regente_colegiatura IS
  'Número de inscripción del farmacéutico regente en el Colegio de Farmacéuticos de su entidad.';
COMMENT ON COLUMN farmacias.regente_inh IS
  'Registro del regente en el Instituto Nacional de Higiene.';
COMMENT ON COLUMN farmacias.sacs_autorizacion IS
  'Autorización de funcionamiento del Servicio Autónomo de Contraloría Sanitaria (Ministerio de Salud).';
COMMENT ON COLUMN farmacias.regente_verificado_por IS
  'Superadmin que confirmó haber contrastado la colegiatura. NULL = sin verificar.';

-- Un regente, un establecimiento (Ley de Ejercicio de la Farmacia).
--
-- EL FILTRO `= 'activa'` ES DELIBERADO Y NO SE PUEDE RELAJAR A
-- `<> 'inactiva'`: con ese filtro, el INSERT del registro fallaría ante una
-- colisión y BLOQUEARÍA REGISTRARSE. Un regente que cambia de farmacia es un
-- caso legítimo, no fraude, y esa persona no puede resolverlo sola. Cubriendo
-- solo 'activa', dos farmacias 'pendiente' pueden declarar el mismo regente y
-- lo que falla es la transición a 'activa' — donde debe fallar.
--
-- lower() porque un número de colegiatura puede traer letra de entidad y
-- nadie escribe las mayúsculas igual dos veces.
CREATE UNIQUE INDEX uq_regente_un_establecimiento
    ON farmacias (lower(regente_colegiatura))
    WHERE regente_colegiatura IS NOT NULL
      AND estado_afiliacion = 'activa';

COMMIT;
```

- [ ] **Step 2: Reflejar la 013 en `db/schema.sql`**

En la definición de `CREATE TABLE farmacias` (sección 2), añadir las diez columnas después de
`punto_referencia    TEXT,` y antes de `correo`:

```sql
    -- Columnas añadidas en migración 013 (habilitación sanitaria, hallazgo B-02)
    regente_nombre          VARCHAR(200),
    regente_colegiatura     VARCHAR(50),
    regente_colegio_entidad VARCHAR(100),
    regente_inh             VARCHAR(50),
    sacs_autorizacion       VARCHAR(100),
    sacs_fecha              DATE,
    regente_verificado_por  UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    regente_verificado_en   TIMESTAMPTZ,
    sacs_verificado_por     UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    sacs_verificado_en      TIMESTAMPTZ,
```

**Atención al orden de creación:** estas columnas tienen FK a `usuarios`, que en `schema.sql` se
crea en la sección 7, después de `farmacias`. En un `schema.sql` ejecutado de cero eso falla. Añadir
las dos FK como `ALTER TABLE` al final de la sección 7, justo después de crear `usuarios`:

```sql
-- FK de las columnas de verificación de habilitación (migración 013). Van aquí
-- y no en la definición de farmacias porque `usuarios` se crea después.
ALTER TABLE farmacias
  ADD CONSTRAINT fk_farmacias_regente_verificado_por
      FOREIGN KEY (regente_verificado_por) REFERENCES usuarios(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_farmacias_sacs_verificado_por
      FOREIGN KEY (sacs_verificado_por) REFERENCES usuarios(id) ON DELETE SET NULL;
```

Y entonces las columnas de la sección 2 van **sin** el `REFERENCES`:

```sql
    regente_verificado_por  UUID,
    regente_verificado_en   TIMESTAMPTZ,
    sacs_verificado_por     UUID,
    sacs_verificado_en      TIMESTAMPTZ,
```

Añadir también el índice al final de la sección 10, y actualizar la cabecera
`Últimas migraciones incorporadas: 001 – 012 (ver nota)` → `001 – 013 (ver nota)`.

- [ ] **Step 3: Pedirle a José que aplique la 013**

Requiere autorización expresa (CLAUDE.md §8). Mostrarle el archivo. **No aplicarla por iniciativa
propia.** Usar `apply_migration` para que quede registrada.

- [ ] **Step 4: Verificar la estructura**

```sql
SELECT count(*) AS columnas_nuevas
FROM information_schema.columns
WHERE table_name = 'farmacias'
  AND column_name IN ('regente_nombre','regente_colegiatura','regente_colegio_entidad',
                      'regente_inh','sacs_autorizacion','sacs_fecha',
                      'regente_verificado_por','regente_verificado_en',
                      'sacs_verificado_por','sacs_verificado_en');
```

Esperado: `10`.

```sql
SELECT indexdef FROM pg_indexes WHERE indexname = 'uq_regente_un_establecimiento';
```

Esperado: una fila cuyo `indexdef` contenga `estado_afiliacion = 'activa'`. Si contiene
`<> 'inactiva'` o no tiene `WHERE`, el índice está mal y bloquearía el registro.

- [ ] **Step 5: Verificar el comportamiento del índice contra datos reales**

Este es el gate de la tarea, y prueba justo lo que distingue este diseño del obvio.

```sql
-- Dos farmacias 'pendiente' con el mismo regente DEBEN poder coexistir.
INSERT INTO farmacias (nombre, direccion, ubicacion, telefono_whatsapp,
                       estado_afiliacion, regente_colegiatura)
VALUES ('ZZZ Prueba A', 'calle 1', ST_SetSRID(ST_MakePoint(-69.2, 9.55),4326)::geography,
        '+584120000001', 'pendiente', 'FV-99999'),
       ('ZZZ Prueba B', 'calle 2', ST_SetSRID(ST_MakePoint(-69.2, 9.55),4326)::geography,
        '+584120000002', 'pendiente', 'fv-99999');
```

Esperado: **inserta las dos**. Si falla, el índice está mal.

```sql
-- La primera puede activarse.
UPDATE farmacias SET estado_afiliacion = 'activa' WHERE nombre = 'ZZZ Prueba A';
-- La segunda NO (y la mayúscula distinta no debe salvarla: el índice usa lower()).
UPDATE farmacias SET estado_afiliacion = 'activa' WHERE nombre = 'ZZZ Prueba B';
```

Esperado: el primero funciona, **el segundo falla** con violación de
`uq_regente_un_establecimiento`.

```sql
DELETE FROM farmacias WHERE nombre LIKE 'ZZZ Prueba %';
SELECT count(*) AS restos FROM farmacias WHERE nombre LIKE 'ZZZ Prueba %';
```

Esperado: `0`. **Borrar siempre**, aunque algún paso haya fallado.

- [ ] **Step 6: Commit**

```bash
cd /home/josemarrufo/Escritorio/DosisYa-Backend
git add db/migrations/013_habilitacion_sanitaria.sql db/schema.sql
git commit -m "feat(db): columnas de habilitación sanitaria y regente único (migración 013)"
```

---

## Task 2: La farmacia guarda sus datos desde el panel

**Files:**
- Modify: `DosisYa-Backend/src/dosisya/models.py` (`FarmaciaConfigUpdate`)
- Modify: `DosisYa-Backend/src/dosisya/routers/farmacias.py` (`_UPDATE_FARMACIA_CONFIG`)
- Test: `DosisYa-Backend/tests/test_farmacias_habilitacion.py`

**Interfaces:**
- Consumes: de Task 1 — las seis columnas de datos
- Produces: `PATCH /api/v1/farmacias/{id}` acepta y persiste `regente_nombre`, `regente_colegiatura`, `regente_colegio_entidad`, `regente_inh`, `sacs_autorizacion`, `sacs_fecha`; el `RETURNING` los devuelve

- [ ] **Step 1: Escribir los tests fallidos**

Crear `tests/test_farmacias_habilitacion.py`:

```python
"""
DosisYa — Tests del guardado de datos de habilitación (hallazgo B-02)

La farmacia los llena desde Configuración del panel. Son OPCIONALES aquí:
registrarse y editar nunca se bloquean. Lo que se bloquea es aprobar, y eso
vive en el gate del superadmin (test_admin_habilitacion.py).
"""

from __future__ import annotations

import uuid

import pytest
from fastapi.testclient import TestClient

from dosisya.main import app
from dosisya.security import verify_token

client = TestClient(app)
FID = str(uuid.uuid4())
ENDPOINT = f"/api/v1/farmacias/{FID}"


def _row(**over):
    base = {
        "nombre_farmacia": "Farmacia A",
        "whatsapp": "+584121234567",
        "sector": "acarigua-centro",
        "punto_referencia": "frente a la plaza",
        "lat": 9.55,
        "lng": -69.2,
        "regente_nombre": None,
        "regente_colegiatura": None,
        "regente_colegio_entidad": None,
        "regente_inh": None,
        "sacs_autorizacion": None,
        "sacs_fecha": None,
    }
    base.update(over)
    return base


class _Conn:
    def __init__(self, row, captura):
        self._row = row
        self._captura = captura

    async def fetchrow(self, query, *args):
        self._captura.append(args)
        return self._row


class _Ctx:
    def __init__(self, row, captura):
        self._row = row
        self._captura = captura

    async def __aenter__(self):
        return _Conn(self._row, self._captura)

    async def __aexit__(self, *exc):
        return False


@pytest.fixture()
def mock_db(monkeypatch):
    captura: list = []

    def _set(row):
        monkeypatch.setattr(
            "dosisya.routers.farmacias.get_connection", lambda: _Ctx(row, captura)
        )
        return captura

    return _set


@pytest.fixture(autouse=True)
def _auth():
    app.dependency_overrides[verify_token] = lambda: {"sub": FID, "rol": "admin_farmacia"}
    yield
    app.dependency_overrides.pop(verify_token, None)


_BASE = {
    "nombre_farmacia": "Farmacia A",
    "whatsapp": "+584121234567",
    "sector": "acarigua-centro",
    "punto_referencia": "frente a la plaza",
}


class TestGuardadoDeHabilitacion:
    def test_los_seis_campos_llegan_a_la_query(self, mock_db):
        captura = mock_db(
            _row(
                regente_nombre="María Pérez",
                regente_colegiatura="FV-1234",
                regente_colegio_entidad="Portuguesa",
                regente_inh="INH-77",
                sacs_autorizacion="SACS-2026-001",
                sacs_fecha="2026-03-15",
            )
        )

        resp = client.patch(
            ENDPOINT,
            json={
                **_BASE,
                "regente_nombre": "María Pérez",
                "regente_colegiatura": "FV-1234",
                "regente_colegio_entidad": "Portuguesa",
                "regente_inh": "INH-77",
                "sacs_autorizacion": "SACS-2026-001",
                "sacs_fecha": "2026-03-15",
            },
        )

        assert resp.status_code == 200
        enviados = captura[0]
        assert "María Pérez" in enviados
        assert "FV-1234" in enviados
        assert "SACS-2026-001" in enviados

    def test_sin_los_campos_sigue_funcionando(self, mock_db):
        """Son opcionales: un cliente viejo que no los manda no debe romperse."""
        mock_db(_row())

        resp = client.patch(ENDPOINT, json=_BASE)

        assert resp.status_code == 200

    def test_la_respuesta_devuelve_los_campos(self, mock_db):
        mock_db(_row(regente_nombre="María Pérez", regente_colegiatura="FV-1234"))

        resp = client.patch(ENDPOINT, json=_BASE)

        data = resp.json()["data"]
        assert data["regente_nombre"] == "María Pérez"
        assert data["regente_colegiatura"] == "FV-1234"
```

- [ ] **Step 2: Correr los tests y confirmar que fallan**

```bash
cd /home/josemarrufo/Escritorio/DosisYa-Backend
.venv/bin/python -m pytest tests/test_farmacias_habilitacion.py -v
```

Esperado: el primero y el tercero fallan (los campos no llegan ni vuelven); el segundo pasa desde
ya, y es la guarda de que añadirlos no rompe a quien no los manda.

- [ ] **Step 3: Añadir los campos al modelo**

En `src/dosisya/models.py`, dentro de `FarmaciaConfigUpdate`, después de los campos `lat`/`lng`:

```python
    # ── Habilitación sanitaria (hallazgo B-02) ──────────────────────────────
    # Opcionales aquí a propósito: editar la configuración nunca se bloquea.
    # Lo que se bloquea es APROBAR sin ellos, y eso vive en el gate del
    # superadmin. Ver la spec 2026-10-12-verificacion-habilitacion-design.md.
    regente_nombre: str | None = Field(default=None, max_length=200)
    regente_colegiatura: str | None = Field(default=None, max_length=50)
    regente_colegio_entidad: str | None = Field(default=None, max_length=100)
    regente_inh: str | None = Field(default=None, max_length=50)
    sacs_autorizacion: str | None = Field(default=None, max_length=100)
    sacs_fecha: date | None = Field(default=None)
```

Añadir `date` al import de `datetime` al principio del archivo si no está:

```python
from datetime import date
```

- [ ] **Step 4: Persistirlos en la query**

En `src/dosisya/routers/farmacias.py`, en `_UPDATE_FARMACIA_CONFIG`, añadir al `SET` (después de
la línea de `ubicacion` y antes de `updated_at`):

```sql
           regente_nombre          = COALESCE($6, regente_nombre),
           regente_colegiatura     = COALESCE($7, regente_colegiatura),
           regente_colegio_entidad = COALESCE($8, regente_colegio_entidad),
           regente_inh             = COALESCE($9, regente_inh),
           sacs_autorizacion       = COALESCE($10, sacs_autorizacion),
           sacs_fecha              = COALESCE($11::date, sacs_fecha),
```

**`COALESCE` y no asignación directa**, por el mismo motivo que `lat`/`lng` usan `CASE`: omitir un
campo debe **conservar** lo guardado, no borrarlo. Un cliente viejo que mande solo los cuatro
campos de siempre no puede vaciar la habilitación.

Y al `RETURNING`, después de `lng`:

```sql
        regente_nombre,
        regente_colegiatura,
        regente_colegio_entidad,
        regente_inh,
        sacs_autorizacion,
        sacs_fecha
```

En la llamada a `conn.fetchrow(_UPDATE_FARMACIA_CONFIG, ...)`, añadir los seis argumentos nuevos en
orden tras los cinco existentes:

```python
                payload.regente_nombre,
                payload.regente_colegiatura,
                payload.regente_colegio_entidad,
                payload.regente_inh,
                payload.sacs_autorizacion,
                payload.sacs_fecha,
```

- [ ] **Step 5: Correr los tests y la suite**

```bash
.venv/bin/python -m pytest tests/test_farmacias_habilitacion.py -v
.venv/bin/python -m pytest -q
```

Esperado: `3 passed` en el archivo, y `4 failed, 313 passed` en la suite (310 + 3). Los 4 son los
pre-existentes de `test_farmacias_inventario_router.py`.

- [ ] **Step 6: Commit**

```bash
git add src/dosisya/models.py src/dosisya/routers/farmacias.py tests/test_farmacias_habilitacion.py
git commit -m "feat(panel): la farmacia puede guardar sus datos de habilitación sanitaria"
```

---

## Task 3: El gate de aprobación

**Files:**
- Modify: `DosisYa-Backend/src/dosisya/models.py` (`CambioEstadoFarmacia`)
- Modify: `DosisYa-Backend/src/dosisya/routers/admin_super.py`
- Test: `DosisYa-Backend/tests/test_admin_habilitacion.py`

**Interfaces:**
- Consumes: de Task 1 — las diez columnas y el índice
- Produces: `PATCH /api/v1/admin/farmacias/{id}/estado` con `estado_afiliacion='activa'` responde 422 sin los seis campos, 409 con conflicto de regente, 422 sin `verificacion_regente` y `verificacion_sacs` en `true`; al aprobar sella las cuatro columnas de verificación

- [ ] **Step 1: Escribir los tests fallidos**

Crear `tests/test_admin_habilitacion.py`:

```python
"""
DosisYa — Tests del gate de aprobación por habilitación (hallazgo B-02)

Solo la transición a 'activa' tiene gate. Suspender o devolver a pendiente no
exige nada: poder suspender una farmacia problemática no puede depender de que
sus datos estén completos.
"""

from __future__ import annotations

import uuid

import pytest
from fastapi.testclient import TestClient

from dosisya.main import app
from dosisya.security import verify_token

client = TestClient(app)
FID = str(uuid.uuid4())
SUPERADMIN_ID = str(uuid.uuid4())
ENDPOINT = f"/api/v1/admin/farmacias/{FID}/estado"

_COMPLETO = {
    "regente_nombre": "María Pérez",
    "regente_colegiatura": "FV-1234",
    "regente_colegio_entidad": "Portuguesa",
    "regente_inh": "INH-77",
    "sacs_autorizacion": "SACS-2026-001",
    "sacs_fecha": "2026-03-15",
    "conflicto_con": None,
}

_FILA_UPDATE = {
    "id": FID,
    "nombre": "Farmacia A",
    "estado_afiliacion": "activa",
    "lat": 9.55,
    "lng": -69.2,
}


class _Conn:
    """fetchrow() devuelve las filas en orden: [habilitacion, update]."""

    def __init__(self, respuestas, captura):
        self._respuestas = list(respuestas)
        self._captura = captura

    async def fetchrow(self, query, *args):
        self._captura.append((query, args))
        return self._respuestas.pop(0) if self._respuestas else None


class _Ctx:
    def __init__(self, respuestas, captura):
        self._respuestas = respuestas
        self._captura = captura

    async def __aenter__(self):
        return _Conn(self._respuestas, self._captura)

    async def __aexit__(self, *exc):
        return False


@pytest.fixture()
def mock_db(monkeypatch):
    captura: list = []

    def _set(*respuestas):
        monkeypatch.setattr(
            "dosisya.routers.admin_super.get_connection",
            lambda: _Ctx(list(respuestas), captura),
        )
        return captura

    return _set


@pytest.fixture(autouse=True)
def _auth():
    app.dependency_overrides[verify_token] = lambda: {
        "sub": SUPERADMIN_ID,
        "rol": "superadmin",
    }
    yield
    app.dependency_overrides.pop(verify_token, None)


def _aprobar(**over):
    body = {
        "estado_afiliacion": "activa",
        "verificacion_regente": True,
        "verificacion_sacs": True,
    }
    body.update(over)
    return body


class TestCamposObligatorios:
    def test_sin_los_campos_no_se_puede_aprobar(self, mock_db):
        incompleto = {**_COMPLETO, "sacs_autorizacion": None, "regente_inh": None}
        mock_db(incompleto, _FILA_UPDATE)

        resp = client.patch(ENDPOINT, json=_aprobar())

        assert resp.status_code == 422

    def test_el_422_dice_qué_campos_faltan(self, mock_db):
        incompleto = {**_COMPLETO, "sacs_autorizacion": None, "regente_inh": None}
        mock_db(incompleto, _FILA_UPDATE)

        resp = client.patch(ENDPOINT, json=_aprobar())

        detalle = str(resp.json()).lower()
        assert "sacs_autorizacion" in detalle
        assert "regente_inh" in detalle

    def test_con_todo_completo_aprueba(self, mock_db):
        mock_db(_COMPLETO, _FILA_UPDATE)

        resp = client.patch(ENDPOINT, json=_aprobar())

        assert resp.status_code == 200


class TestConflictoDeRegente:
    def test_regente_en_otra_activa_responde_409(self, mock_db):
        conflicto = {**_COMPLETO, "conflicto_con": "Farmacia Vecina"}
        mock_db(conflicto, _FILA_UPDATE)

        resp = client.patch(ENDPOINT, json=_aprobar())

        assert resp.status_code == 409

    def test_el_409_nombra_la_otra_farmacia(self, mock_db):
        """Sin el nombre, el superadmin no puede resolver el conflicto."""
        conflicto = {**_COMPLETO, "conflicto_con": "Farmacia Vecina"}
        mock_db(conflicto, _FILA_UPDATE)

        resp = client.patch(ENDPOINT, json=_aprobar())

        assert "Farmacia Vecina" in str(resp.json())


class TestConfirmaciones:
    def test_sin_la_del_regente_responde_422(self, mock_db):
        mock_db(_COMPLETO, _FILA_UPDATE)

        resp = client.patch(ENDPOINT, json=_aprobar(verificacion_regente=False))

        assert resp.status_code == 422

    def test_sin_la_del_sacs_responde_422(self, mock_db):
        mock_db(_COMPLETO, _FILA_UPDATE)

        resp = client.patch(ENDPOINT, json=_aprobar(verificacion_sacs=False))

        assert resp.status_code == 422

    def test_al_aprobar_se_sella_quien_verifico(self, mock_db):
        captura = mock_db(_COMPLETO, _FILA_UPDATE)

        client.patch(ENDPOINT, json=_aprobar())

        _, args_update = captura[-1]
        assert SUPERADMIN_ID in [str(a) for a in args_update], (
            "el id del superadmin no llegó al UPDATE: no se sella quién verificó"
        )


class TestOtrosEstadosNoExigenNada:
    def test_suspender_no_exige_habilitacion(self, mock_db):
        """Poder suspender una farmacia problemática no puede depender de que
        sus datos estén completos."""
        vacio = {k: None for k in _COMPLETO}
        mock_db(vacio, {**_FILA_UPDATE, "estado_afiliacion": "inactiva"})

        resp = client.patch(ENDPOINT, json={"estado_afiliacion": "inactiva"})

        assert resp.status_code == 200

    def test_devolver_a_pendiente_no_exige_habilitacion(self, mock_db):
        vacio = {k: None for k in _COMPLETO}
        mock_db(vacio, {**_FILA_UPDATE, "estado_afiliacion": "pendiente"})

        resp = client.patch(ENDPOINT, json={"estado_afiliacion": "pendiente"})

        assert resp.status_code == 200
```

- [ ] **Step 2: Correr los tests y confirmar que fallan**

```bash
.venv/bin/python -m pytest tests/test_admin_habilitacion.py -v
```

Esperado: fallan los de 422, 409 y el del sellado. Los de «otros estados» y el de aprobar completo
pueden pasar desde ya — son las guardas de que el gate no rompe lo que ya funcionaba.

- [ ] **Step 3: Añadir las confirmaciones al modelo**

En `src/dosisya/models.py`, dentro de `CambioEstadoFarmacia`, después de `lat`/`lng`:

```python
    # ── Confirmaciones de verificación (hallazgo B-02) ──────────────────────
    # Separadas y no una sola casilla a propósito: son dos trabajos distintos
    # contra dos organismos distintos (Colegio de Farmacéuticos e INH por un
    # lado, SACS por otro). Una casilla única se marca sin leer.
    # Solo se exigen al pasar a 'activa'.
    verificacion_regente: bool = Field(
        default=False,
        description="El superadmin confirma haber contrastado la colegiatura del regente.",
    )
    verificacion_sacs: bool = Field(
        default=False,
        description="El superadmin confirma haber verificado la autorización del SACS.",
    )
```

- [ ] **Step 4: Implementar el gate**

En `src/dosisya/routers/admin_super.py`, añadir la query de lectura junto a `_UPDATE_ESTADO`:

```python
# Lee la habilitación de la farmacia y, de paso, si su regente ya figura en
# otra farmacia ACTIVA. Una sola ida a la base en vez de dos.
_SELECT_HABILITACION = """
    SELECT
        f.regente_nombre,
        f.regente_colegiatura,
        f.regente_colegio_entidad,
        f.regente_inh,
        f.sacs_autorizacion,
        f.sacs_fecha,
        (SELECT o.nombre
           FROM farmacias o
          WHERE o.id <> f.id
            AND o.estado_afiliacion = 'activa'
            AND f.regente_colegiatura IS NOT NULL
            AND lower(o.regente_colegiatura) = lower(f.regente_colegiatura)
          LIMIT 1)                        AS conflicto_con
    FROM farmacias f
    WHERE f.id = $1;
"""

# Campos que la farmacia debe tener para poder publicarse. El orden es el que
# se le muestra al superadmin en el 422.
_CAMPOS_HABILITACION = (
    "regente_nombre",
    "regente_colegiatura",
    "regente_colegio_entidad",
    "regente_inh",
    "sacs_autorizacion",
    "sacs_fecha",
)
```

Extender `_UPDATE_ESTADO` para sellar las columnas de verificación. Añadir al `SET`, antes de
`updated_at`:

```sql
           regente_verificado_por = CASE WHEN $5::uuid IS NOT NULL
                                         THEN $5::uuid ELSE regente_verificado_por END,
           regente_verificado_en  = CASE WHEN $5::uuid IS NOT NULL
                                         THEN now() ELSE regente_verificado_en END,
           sacs_verificado_por    = CASE WHEN $5::uuid IS NOT NULL
                                         THEN $5::uuid ELSE sacs_verificado_por END,
           sacs_verificado_en     = CASE WHEN $5::uuid IS NOT NULL
                                         THEN now() ELSE sacs_verificado_en END,
```

**El `::uuid` explícito es obligatorio**, no cosmético: sin él, asyncpg falla con *"could not
determine data type"* cuando el parámetro llega en `NULL` — el mismo problema que ya documenta
CLAUDE.md §5 para los `::float8` de `lat`/`lng`.

En `cambiar_estado`, después de validar el UUID y las coordenadas y **antes** del `UPDATE`:

```python
    # ─── Gate de habilitación (hallazgo B-02) ───────────────────────────────
    # Solo al APROBAR. Suspender o devolver a pendiente nunca se bloquea.
    verificador: UUID | None = None
    if payload.estado_afiliacion.value == "activa":
        try:
            async with get_connection() as conn:
                hab = await conn.fetchrow(_SELECT_HABILITACION, farmacia_uuid)
        except asyncpg.PostgresError as e:
            logger.error("[ADMIN] Error BD al leer habilitación [id=%s]: %s", farmacia_id, e)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error interno al verificar la habilitación.",
            ) from e

        if hab is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No existe una farmacia con id '{farmacia_id}'.",
            )

        faltantes = [c for c in _CAMPOS_HABILITACION if not hab[c]]
        if faltantes:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=(
                    "No se puede publicar sin los datos de habilitación. "
                    f"Faltan: {', '.join(faltantes)}."
                ),
            )

        if hab["conflicto_con"]:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"Ese regente ya figura en '{hab['conflicto_con']}', que está activa. "
                    "Ninguna persona puede ser regente de más de un establecimiento: "
                    "suspende la otra farmacia antes de aprobar esta."
                ),
            )

        if not (payload.verificacion_regente and payload.verificacion_sacs):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=(
                    "Confirma haber verificado la colegiatura del regente Y la "
                    "autorización del SACS antes de publicar la farmacia."
                ),
            )

        verificador = UUID(token_data["sub"])
```

Y en la llamada al `UPDATE`, añadir `verificador` como quinto argumento:

```python
            row = await conn.fetchrow(
                _UPDATE_ESTADO,
                farmacia_uuid,
                payload.estado_afiliacion.value,
                payload.lat,
                payload.lng,
                verificador,
            )
```

**El chequeo de conflicto se hace antes del `UPDATE` para dar un 409 con el nombre de la otra
farmacia.** El índice `UNIQUE` sigue siendo la garantía real ante dos aprobaciones simultáneas: el
chequeo previo es para el mensaje, no para la integridad.

- [ ] **Step 5: Correr los tests y la suite**

```bash
.venv/bin/python -m pytest tests/test_admin_habilitacion.py -v
.venv/bin/python -m pytest -q
```

Esperado: `10 passed` en el archivo, y `4 failed, 323 passed` en la suite (313 + 10).

- [ ] **Step 6: Verificar el 409 contra la base real**

Los tests mockean la conexión, así que el `SELECT` del conflicto no está cubierto. Con la 013
aplicada:

```sql
-- Dos farmacias con el mismo regente; una activa.
INSERT INTO farmacias (nombre, direccion, ubicacion, telefono_whatsapp,
                       estado_afiliacion, regente_colegiatura, regente_nombre,
                       regente_colegio_entidad, regente_inh, sacs_autorizacion, sacs_fecha)
VALUES ('ZZZ Activa', 'calle 1', ST_SetSRID(ST_MakePoint(-69.2,9.55),4326)::geography,
        '+584120000003','activa','FV-88888','Ana','Portuguesa','INH-1','SACS-1','2026-01-01'),
       ('ZZZ Pendiente', 'calle 2', ST_SetSRID(ST_MakePoint(-69.2,9.55),4326)::geography,
        '+584120000004','pendiente','fv-88888','Ana','Portuguesa','INH-1','SACS-1','2026-01-01');
```

Luego, ejecutando el `_SELECT_HABILITACION` con el id de `ZZZ Pendiente`, `conflicto_con` debe
devolver **`ZZZ Activa`** — y la mayúscula distinta no debe impedirlo.

```sql
DELETE FROM farmacias WHERE nombre LIKE 'ZZZ %';
```

**Borrar siempre.** Confirmar con `SELECT count(*) FROM farmacias WHERE nombre LIKE 'ZZZ %';` → `0`.

- [ ] **Step 7: Commit**

```bash
git add src/dosisya/models.py src/dosisya/routers/admin_super.py tests/test_admin_habilitacion.py
git commit -m "feat(admin): el gate de aprobación exige habilitación y regente único"
```

---

## Task 4: Los dos booleanos en la lista del superadmin

**Files:**
- Modify: `DosisYa-Backend/src/dosisya/routers/admin_super.py` (`_SELECT_FARMACIAS_ADMIN` y el armado de la respuesta)
- Test: `DosisYa-Backend/tests/test_admin_habilitacion.py` (añadir)

**Interfaces:**
- Consumes: de Task 1 — las seis columnas de datos
- Produces: cada elemento de `GET /api/v1/admin/farmacias` trae `habilitacion_completa: bool` y `conflicto_regente: str | None` (el nombre de la otra farmacia, o `null`)

- [ ] **Step 1: Escribir el test fallido**

Añadir al final de `tests/test_admin_habilitacion.py`:

```python
class TestListaDelSuperadmin:
    def test_expone_habilitacion_completa_y_conflicto(self, monkeypatch):
        """El superadmin tiene que ver el riesgo ANTES de abrir el detalle,
        igual que ya ve ubicacion_configurada."""
        fila = {
            "id": FID,
            "nombre": "Farmacia A",
            "whatsapp": "+584121234567",
            "sector": "acarigua-centro",
            "punto_referencia": "frente a la plaza",
            "estado_afiliacion": "pendiente",
            "nivel_suscripcion": "gratuita",
            "created_at": "2026-01-01T00:00:00+00:00",
            "lat": 9.55,
            "lng": -69.2,
            "leads_mes": 0,
            "habilitacion_completa": False,
            "conflicto_regente": "Farmacia Vecina",
        }

        class _C:
            async def fetch(self, query, *args):
                return [fila]

        class _X:
            async def __aenter__(self):
                return _C()

            async def __aexit__(self, *exc):
                return False

        monkeypatch.setattr("dosisya.routers.admin_super.get_connection", lambda: _X())

        resp = client.get("/api/v1/admin/farmacias")

        assert resp.status_code == 200
        f = resp.json()["data"]["farmacias"][0]
        assert f["habilitacion_completa"] is False
        assert f["conflicto_regente"] == "Farmacia Vecina"
```

- [ ] **Step 2: Correr el test y confirmar que falla**

```bash
.venv/bin/python -m pytest tests/test_admin_habilitacion.py::TestListaDelSuperadmin -v
```

Esperado: `KeyError` o `assert None == False` — los campos no existen en la respuesta.

- [ ] **Step 3: Calcularlos en la query**

En `_SELECT_FARMACIAS_ADMIN`, añadir al `SELECT` después de `lng`:

```sql
        -- Los seis campos presentes. Se calcula en SQL y no en Python para que
        -- la lista y el gate de aprobación no puedan divergir.
        (f.regente_nombre          IS NOT NULL AND
         f.regente_colegiatura     IS NOT NULL AND
         f.regente_colegio_entidad IS NOT NULL AND
         f.regente_inh             IS NOT NULL AND
         f.sacs_autorizacion       IS NOT NULL AND
         f.sacs_fecha              IS NOT NULL)   AS habilitacion_completa,
        (SELECT o.nombre
           FROM farmacias o
          WHERE o.id <> f.id
            AND o.estado_afiliacion = 'activa'
            AND f.regente_colegiatura IS NOT NULL
            AND lower(o.regente_colegiatura) = lower(f.regente_colegiatura)
          LIMIT 1)                                 AS conflicto_regente,
```

**Ojo con el `GROUP BY f.id`:** la query agrupa por `f.id`, y en PostgreSQL eso permite
referenciar cualquier columna de `f` sin añadirla al `GROUP BY` (porque `f.id` es su clave
primaria). Las dos expresiones nuevas solo usan columnas de `f` y una subconsulta, así que no hace
falta tocar el `GROUP BY`.

En el armado de la respuesta —el bloque que ya incluye `"ubicacion_configurada": ...`— añadir:

```python
            "habilitacion_completa": r["habilitacion_completa"],
            "conflicto_regente": r["conflicto_regente"],
```

- [ ] **Step 4: Correr los tests y la suite**

```bash
.venv/bin/python -m pytest tests/test_admin_habilitacion.py -v
.venv/bin/python -m pytest -q
```

Esperado: `11 passed` en el archivo, `4 failed, 324 passed` en la suite.

- [ ] **Step 5: Verificar contra la base real**

```sql
SELECT nombre, estado_afiliacion,
       (regente_nombre IS NOT NULL AND regente_colegiatura IS NOT NULL AND
        regente_colegio_entidad IS NOT NULL AND regente_inh IS NOT NULL AND
        sacs_autorizacion IS NOT NULL AND sacs_fecha IS NOT NULL) AS habilitacion_completa
FROM farmacias ORDER BY nombre;
```

Esperado: **todas en `false`**, porque ninguna tiene datos todavía. Es la confirmación de que el
hallazgo era real: hoy no hay una sola farmacia con habilitación registrada.

- [ ] **Step 6: Commit**

```bash
git add src/dosisya/routers/admin_super.py tests/test_admin_habilitacion.py
git commit -m "feat(admin): la lista expone habilitacion_completa y conflicto_regente"
```

---

## Task 5: El contrato y la lógica del gate en el frontend

**Files:**
- Modify: `src/lib/adminApi.ts`
- Test: `src/lib/adminApi.test.ts`

**Interfaces:**
- Consumes: de Tasks 3 y 4 — los dos booleanos de la lista y el contrato del PATCH de estado
- Produces: `FarmaciaAdmin.habilitacion_completa?: boolean` y `.conflicto_regente?: string | null`; función pura `faltaHabilitacion(estado, farmacia): boolean`; `cambiarEstadoFarmacia(id, estado, coords?, verificaciones?)`

Esta tarea sí lleva tests de verdad: la decisión de si se puede aprobar es **lógica pura**, igual
que `requiereConfirmacionUbicacion` que ya existe en este archivo.

- [ ] **Step 1: Escribir los tests fallidos**

Añadir al final de `src/lib/adminApi.test.ts`:

```ts
describe("faltaHabilitacion (hallazgo B-02)", () => {
  it("bloquea aprobar cuando la habilitación está incompleta", () => {
    expect(faltaHabilitacion("activa", { habilitacion_completa: false })).toBe(true);
  });

  it("deja aprobar cuando está completa", () => {
    expect(faltaHabilitacion("activa", { habilitacion_completa: true })).toBe(false);
  });

  it("no bloquea suspender ni devolver a pendiente, aunque falte todo", () => {
    // Poder suspender una farmacia problemática no puede depender de que sus
    // datos estén completos.
    expect(faltaHabilitacion("inactiva", { habilitacion_completa: false })).toBe(false);
    expect(faltaHabilitacion("pendiente", { habilitacion_completa: false })).toBe(false);
  });

  it("con un backend viejo que no manda el campo, no bloquea", () => {
    // Mismo criterio que ubicacion_configurada: undefined no es false. Si el
    // backend no lo informa, el frontend no puede saberlo y no inventa.
    expect(faltaHabilitacion("activa", {})).toBe(false);
  });
});
```

Añadir `faltaHabilitacion` al import del principio del archivo de test.

- [ ] **Step 2: Correr los tests y confirmar que fallan**

```bash
npx vitest run src/lib/adminApi.test.ts
```

Esperado: fallan por `faltaHabilitacion is not a function` o error de compilación de TypeScript.

- [ ] **Step 3: Añadir los campos al tipo**

En `src/lib/adminApi.ts`, dentro de `FarmaciaAdmin`, después de `ubicacion_configurada`:

```ts
  /**
   * Los seis campos de habilitación presentes (hallazgo B-02). Opcional en el
   * tipo por el mismo motivo que `ubicacion_configurada`: un backend viejo no
   * lo devuelve.
   */
  habilitacion_completa?: boolean;
  /** Nombre de otra farmacia ACTIVA con el mismo regente, o null si no hay. */
  conflicto_regente?: string | null;
```

- [ ] **Step 4: Añadir la función pura**

Junto a `requiereConfirmacionUbicacion`, siguiendo su mismo patrón:

```ts
/**
 * ¿Aprobar está bloqueado por falta de habilitación? (hallazgo B-02)
 *
 * Solo aplica al pasar a 'activa': suspender o devolver a pendiente nunca se
 * bloquea. `undefined` NO se trata como `false` — si el backend no informa el
 * campo, el frontend no puede saberlo y no lo inventa; el backend rechazará el
 * PATCH de todas formas, que es la garantía real.
 */
export function faltaHabilitacion(
  estado: EstadoAfiliacion,
  farmacia: Pick<FarmaciaAdmin, "habilitacion_completa">,
): boolean {
  return estado === "activa" && farmacia.habilitacion_completa === false;
}
```

- [ ] **Step 5: Extender `cambiarEstadoFarmacia`**

```ts
export async function cambiarEstadoFarmacia(
  id: string,
  estado: EstadoAfiliacion,
  coords?: { lat: number; lng: number },
  verificaciones?: { verificacion_regente: boolean; verificacion_sacs: boolean },
) {
```

Y en el cuerpo de la petición:

```ts
    body: JSON.stringify({
      estado_afiliacion: estado,
      ...(coords ?? {}),
      ...(verificaciones ?? {}),
    }),
```

El parámetro va opcional para no romper a los llamadores que solo suspenden.

- [ ] **Step 6: Verificación y commit**

```bash
npx tsc --noEmit && npm run build && npm test
```

Esperado: sin errores y los 4 tests nuevos en verde.

```bash
git add src/lib/adminApi.ts src/lib/adminApi.test.ts
git commit -m "feat(admin): contrato y lógica del gate de habilitación en el frontend"
```

---

## Task 6: El formulario en Configuración del panel

**Files:**
- Modify: `src/routes/admin.dashboard.tsx` (`configSchema` y `ConfiguracionSection`)

**Interfaces:**
- Consumes: de Task 2 — el PATCH acepta los seis campos; de Task 5 — nada
- Produces: el panel envía los seis campos en el PATCH de configuración

- [ ] **Step 1: Extender el esquema de validación**

En `src/routes/admin.dashboard.tsx`, dentro de `configSchema`, después de `punto_referencia`:

```ts
  // Habilitación sanitaria (hallazgo B-02). Opcionales: guardar la
  // configuración nunca se bloquea. Lo que se bloquea es publicar la farmacia,
  // y de eso se encarga el superadmin.
  regente_nombre: z.string().trim().max(200).optional().or(z.literal("")),
  regente_colegiatura: z.string().trim().max(50).optional().or(z.literal("")),
  regente_colegio_entidad: z.string().trim().max(100).optional().or(z.literal("")),
  regente_inh: z.string().trim().max(50).optional().or(z.literal("")),
  sacs_autorizacion: z.string().trim().max(100).optional().or(z.literal("")),
  sacs_fecha: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Formato: AAAA-MM-DD")
    .optional()
    .or(z.literal("")),
```

- [ ] **Step 2: Añadir el estado y los campos al formulario**

Junto a los `useState` de `ConfiguracionSection`:

```tsx
  const [regenteNombre, setRegenteNombre] = useState("");
  const [regenteColegiatura, setRegenteColegiatura] = useState("");
  const [regenteEntidad, setRegenteEntidad] = useState("");
  const [regenteInh, setRegenteInh] = useState("");
  const [sacsAutorizacion, setSacsAutorizacion] = useState("");
  const [sacsFecha, setSacsFecha] = useState("");
```

En el JSX del formulario, tras el campo de punto de referencia, un bloque nuevo. El aviso explica
**por qué** importan, que es lo que hace que alguien los llene:

```tsx
          <div className="mt-6 border-t border-border pt-5">
            <h3 className="text-sm font-semibold text-foreground">Habilitación sanitaria</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Tu farmacia no se publica en el buscador hasta que DosisYa verifique estos datos.
              Puedes guardarlos ahora y completarlos después.
            </p>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="cfg-regente-nombre">Farmacéutico regente</Label>
                <Input
                  id="cfg-regente-nombre"
                  value={regenteNombre}
                  onChange={(e) => setRegenteNombre(e.target.value)}
                  maxLength={200}
                  aria-invalid={Boolean(fieldErrors.regente_nombre)}
                />
                {fieldErrors.regente_nombre && (
                  <p className="text-xs text-destructive">{fieldErrors.regente_nombre}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cfg-regente-colegiatura">N.º de colegiatura</Label>
                <Input
                  id="cfg-regente-colegiatura"
                  value={regenteColegiatura}
                  onChange={(e) => setRegenteColegiatura(e.target.value)}
                  maxLength={50}
                  aria-invalid={Boolean(fieldErrors.regente_colegiatura)}
                />
                {fieldErrors.regente_colegiatura && (
                  <p className="text-xs text-destructive">{fieldErrors.regente_colegiatura}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cfg-regente-entidad">Colegio de Farmacéuticos (entidad)</Label>
                <Input
                  id="cfg-regente-entidad"
                  value={regenteEntidad}
                  onChange={(e) => setRegenteEntidad(e.target.value)}
                  maxLength={100}
                  aria-invalid={Boolean(fieldErrors.regente_colegio_entidad)}
                />
                {fieldErrors.regente_colegio_entidad && (
                  <p className="text-xs text-destructive">
                    {fieldErrors.regente_colegio_entidad}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cfg-regente-inh">Registro en el INH</Label>
                <Input
                  id="cfg-regente-inh"
                  value={regenteInh}
                  onChange={(e) => setRegenteInh(e.target.value)}
                  maxLength={50}
                  aria-invalid={Boolean(fieldErrors.regente_inh)}
                />
                {fieldErrors.regente_inh && (
                  <p className="text-xs text-destructive">{fieldErrors.regente_inh}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cfg-sacs-autorizacion">Autorización del SACS</Label>
                <Input
                  id="cfg-sacs-autorizacion"
                  value={sacsAutorizacion}
                  onChange={(e) => setSacsAutorizacion(e.target.value)}
                  maxLength={100}
                  aria-invalid={Boolean(fieldErrors.sacs_autorizacion)}
                />
                {fieldErrors.sacs_autorizacion && (
                  <p className="text-xs text-destructive">{fieldErrors.sacs_autorizacion}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cfg-sacs-fecha">Fecha de la autorización</Label>
                <Input
                  id="cfg-sacs-fecha"
                  type="date"
                  value={sacsFecha}
                  onChange={(e) => setSacsFecha(e.target.value)}
                  aria-invalid={Boolean(fieldErrors.sacs_fecha)}
                />
                {fieldErrors.sacs_fecha && (
                  <p className="text-xs text-destructive">{fieldErrors.sacs_fecha}</p>
                )}
              </div>
            </div>
          </div>
```

Es el mismo patrón que ya usan `nombre` y `whatsapp` en esa sección: `<div className="space-y-1.5">`
con `<Label>`, `<Input>` y el mensaje de error debajo. **No existe un componente `Campo`
reutilizable** en este archivo — solo `CampoUbicacion`, que es para coordenadas y no sirve aquí.

`type="date"` en la fecha hace que el navegador imponga el formato `AAAA-MM-DD` que espera el
backend, así que el regex del esquema es una segunda red y no la única.

- [ ] **Step 3: Enviarlos en el PATCH**

En el `safeParse` del submit, añadir las seis claves; y en el cuerpo de la petición, mandar
`undefined` en vez de cadena vacía para que el `COALESCE` del backend conserve lo guardado:

```ts
    const vacioANull = (v: string) => (v.trim() === "" ? undefined : v.trim());
```

```ts
      regente_nombre: vacioANull(regenteNombre),
      regente_colegiatura: vacioANull(regenteColegiatura),
      regente_colegio_entidad: vacioANull(regenteEntidad),
      regente_inh: vacioANull(regenteInh),
      sacs_autorizacion: vacioANull(sacsAutorizacion),
      sacs_fecha: vacioANull(sacsFecha),
```

Y precargar los seis desde la respuesta del dashboard, igual que se precargan `sector` y
`punto_referencia`.

- [ ] **Step 4: Verificación**

```bash
npx tsc --noEmit && npm run build && npm test
```

Esperado: sin errores, build limpio, tests en verde.

- [ ] **Step 5: Verificar en el navegador**

Esta sección exige sesión de farmacia. Si no hay credenciales disponibles, **decirlo explícitamente
al cerrar la tarea en vez de darla por verificada**, y dejar constancia de que solo se comprobaron
`tsc` y `build`.

Con acceso: guardar con los campos vacíos (debe funcionar), guardar con algunos llenos, recargar y
confirmar que se precargan.

- [ ] **Step 6: Commit**

```bash
git add src/routes/admin.dashboard.tsx
git commit -m "feat(panel): formulario de habilitación sanitaria en Configuración"
```

---

## Task 7: La tabla y el drawer del superadmin

**Files:**
- Modify: `src/components/super/TablaFarmacias.tsx`
- Modify: `src/components/super/EditarFarmaciaDrawer.tsx`

**Interfaces:**
- Consumes: de Task 5 — `habilitacion_completa`, `conflicto_regente`, `faltaHabilitacion`, la firma nueva de `cambiarEstadoFarmacia`
- Produces: nada que consuman otras tareas

- [ ] **Step 1: Pintar los avisos en la tabla**

En `src/components/super/TablaFarmacias.tsx`, junto a donde ya se pinta el aviso de
`ubicacion_configurada === false`, añadir:

```tsx
                {farmacia.habilitacion_completa === false && (
                  <span
                    className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold"
                    style={{ background: "var(--ambar-fondo)", color: "var(--ambar-receta)" }}
                  >
                    Sin habilitación
                  </span>
                )}
                {farmacia.conflicto_regente && (
                  <span
                    className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold"
                    style={{ background: "var(--rojo-fondo)", color: "var(--rojo)" }}
                    title={`El regente ya figura en ${farmacia.conflicto_regente}`}
                  >
                    Regente duplicado
                  </span>
                )}
```

El conflicto va en rojo y la falta de datos en ámbar a propósito: uno es un bloqueo que requiere
resolver algo en el mundo real, el otro es un dato que falta.

- [ ] **Step 2: Las dos casillas en el drawer**

En `src/components/super/EditarFarmaciaDrawer.tsx`, junto a los `useState` existentes:

```tsx
  const [verifRegente, setVerifRegente] = useState(false);
  const [verifSacs, setVerifSacs] = useState(false);
```

Resetearlas cuando cambia la farmacia, en el mismo `useEffect` que ya resetea `lat`/`lng`:

```tsx
      setVerifRegente(false);
      setVerifSacs(false);
```

Y en el JSX, visible solo cuando se va a aprobar:

```tsx
      {farmacia?.estado_afiliacion !== "activa" && (
        <div className="mt-4 rounded-lg border border-border p-3">
          <p className="text-xs font-semibold text-foreground">Antes de publicar</p>

          {farmacia?.conflicto_regente && (
            <p
              className="mt-2 rounded px-2 py-1.5 text-xs"
              style={{ background: "var(--rojo-fondo)", color: "var(--rojo)" }}
            >
              El regente ya figura en <strong>{farmacia.conflicto_regente}</strong>, que está
              activa. Ninguna persona puede ser regente de más de un establecimiento: suspende esa
              antes de aprobar esta.
            </p>
          )}

          <label className="mt-3 flex cursor-pointer items-start gap-2 text-xs text-foreground">
            <input
              type="checkbox"
              checked={verifRegente}
              onChange={(e) => setVerifRegente(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0"
            />
            <span>Contrasté la colegiatura del regente contra el Colegio de Farmacéuticos.</span>
          </label>

          <label className="mt-2 flex cursor-pointer items-start gap-2 text-xs text-foreground">
            <input
              type="checkbox"
              checked={verifSacs}
              onChange={(e) => setVerifSacs(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0"
            />
            <span>Verifiqué la autorización de funcionamiento del SACS.</span>
          </label>
        </div>
      )}
```

- [ ] **Step 3: Bloquear el botón de aprobar y mandar las confirmaciones**

Donde el drawer llama a `cambiarEstadoFarmacia` para aprobar, pasar el cuarto argumento:

```tsx
        await cambiarEstadoFarmacia(farmacia.id, "activa", coords, {
          verificacion_regente: verifRegente,
          verificacion_sacs: verifSacs,
        });
```

Y deshabilitar el botón de aprobar cuando corresponda, importando `faltaHabilitacion` de
`@/lib/adminApi`:

```tsx
  const noSePuedeAprobar =
    faltaHabilitacion("activa", farmacia ?? {}) ||
    Boolean(farmacia?.conflicto_regente) ||
    !verifRegente ||
    !verifSacs;
```

El botón de **suspender** no se toca: nunca se bloquea.

- [ ] **Step 4: Verificación**

```bash
npx tsc --noEmit && npm run build && npm test
```

Esperado: sin errores, build limpio, tests en verde.

- [ ] **Step 5: Verificar en el navegador**

El panel súper admin exige sesión de superadmin. Si no hay credenciales, **decirlo en vez de dar la
tarea por verificada**.

Con acceso: una farmacia sin habilitación debe mostrar «Sin habilitación» y tener el botón de
aprobar deshabilitado aun marcando las dos casillas; suspender debe seguir funcionando siempre.

- [ ] **Step 6: Commit**

```bash
git add src/components/super/TablaFarmacias.tsx src/components/super/EditarFarmaciaDrawer.tsx
git commit -m "feat(super): avisos de habilitación y doble confirmación al aprobar"
```

---

## Cierre

Con las siete tareas desplegadas —**backend primero**—, ninguna farmacia se publica sin datos de
regente y permiso del SACS, dos farmacias activas no pueden compartir regente, y aprobar exige dos
confirmaciones que quedan selladas con quién y cuándo.

### Lo que esto NO cierra

**La verificación sigue siendo declarativa.** El superadmin confirma que contrastó; no se prueba
que lo hiciera. Es mucho mejor que un botón y **no es verificación documental**, que es lo que el
hallazgo B-02 pide literalmente. **B-02 queda abierto hasta la fase 2**, que necesita
infraestructura de almacenamiento de documentos que el backend hoy no tiene.

### Un efecto secundario que hay que anticipar

En cuanto esto se despliegue, **ninguna farmacia existente podrá ser aprobada ni reactivada** hasta
que llene sus datos — incluidas las 8 que hoy están activas, que no tienen ninguno. No se
desactivan solas: el gate solo corre al *pasar* a `activa`. Pero conviene avisarles antes de que
alguien intente reactivar una y se encuentre el 422.
