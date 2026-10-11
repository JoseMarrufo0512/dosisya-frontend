# Condición de dispensación — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el paciente vea «Requiere récipe» en los medicamentos que lo exigen, que el farmacéutico lo vea en el mensaje de WhatsApp, y que los controlados queden fuera de la búsqueda pública.

**Architecture:** Una tabla de referencia (`principios_activos_dispensacion`) mapea principio activo canónico → condición de dispensación. El emparejamiento se hace con una función SQL `canon_principio()` que normaliza mayúsculas, acentos y sufijos de sal. Las dos queries públicas hacen `LEFT JOIN` contra esa tabla, exponen la condición como campo nuevo y excluyen los controlados con `IS DISTINCT FROM`. El frontend pinta una insignia y añade un marcador al mensaje de WhatsApp.

**Tech Stack:** PostgreSQL 15 + PostGIS + unaccent (Supabase) · Python 3.12 + FastAPI + asyncpg + pytest · React 19 + TanStack Start + TypeScript + Vitest

**Spec:** [`docs/superpowers/specs/2026-10-11-condicion-dispensacion-design.md`](../specs/2026-10-11-condicion-dispensacion-design.md)

## Global Constraints

- **Dos repos.** Backend en `/home/josemarrufo/Escritorio/DosisYa-Backend`, frontend en este worktree. Cada uno commitea por separado.
- **El backend requiere autorización expresa de José para tocarse** (CLAUDE.md §2). Aprobar este plan la concede para los archivos listados aquí y nada más.
- **Aplicar migraciones a Supabase requiere autorización expresa de José** (CLAUDE.md §8). La 010 se aplica cuando él lo diga; la **011 NO se aplica hasta que un farmacéutico la firme**.
- **Los tests del backend mockean la conexión** (`_FakeConn`): la corrección del SQL **no la cubre pytest**. Cada cambio de SQL lleva su propio paso de verificación contra la base real. No escribir tests que finjan cubrirlo.
- **No hay infraestructura de tests de componentes** (sin `@testing-library`). Los 9 archivos `*.test.ts` del frontend son lógica pura. Los cambios presentacionales se verifican con `tsc`, `build` y el navegador — no con tests inventados que no correrían.
- **`main` del backend arrastra 4 tests rojos pre-existentes** en `tests/test_farmacias_inventario_router.py` (contaminación de orden, no relacionados). Pasan en aislamiento. No confundirlos con una regresión propia: el conteo de partida es `4 failed, 298 passed`.
- **Verificación mínima antes de cada commit** — frontend: `npx tsc --noEmit && npm run build` (CLAUDE.md §6). Backend: `.venv/bin/python -m pytest -q`.
- **Valores exactos del contrato**, copiados de la spec: enum `('libre','receta','controlado')`; campo de API `condicion_dispensacion` con valores `"libre" | "receta" | null`; campo de `localStorage` `condicionDispensacion?: "libre" | "receta" | null`; `"controlado"` nunca llega al cliente.
- **`db/schema.sql` es la fuente canónica del esquema** y hay que mantenerlo sincronizado con cada migración nueva.

---

## File Structure

### Backend (`DosisYa-Backend`)

| Archivo | Responsabilidad |
|---|---|
| `db/migrations/010_condicion_dispensacion.sql` | **Crear.** Enum, función `canon_principio`, tabla, índice, trigger |
| `db/migrations/011_seed_dispensacion.sql` | **Crear.** Datos curados. NO se aplica sin firma farmacéutica |
| `db/schema.sql` | **Modificar.** Reflejar la 010 en la fuente canónica |
| `src/dosisya/routers/medicamentos.py` | **Modificar.** `_BUSCAR_MEDICAMENTOS` y `_SELECT_PRODUCTO_UNICO` |
| `tests/test_medicamentos_dispensacion.py` | **Crear.** Cobertura del campo nuevo en ambos endpoints |

### Frontend (este worktree)

| Archivo | Responsabilidad |
|---|---|
| `src/lib/api.ts` | **Modificar.** Campo en `ResultadoFarmacia` |
| `src/hooks/useListaMedica.ts` | **Modificar.** Campo opcional en `ItemLista` |
| `src/components/BadgeReceta.tsx` | **Crear.** Insignia ámbar |
| `src/components/TarjetaResultado.tsx` | **Modificar.** Insignia + pasar el campo a `agregar()` |
| `src/components/lista/ListaMedicaDrawer.tsx` | **Modificar.** Insignia por ítem |
| `src/routes/producto.$farmaciaId.$medicamentoId.tsx` | **Modificar.** Tipo local + insignia |
| `src/lib/whatsapp.ts` | **Modificar.** Marcador en la línea del producto |
| `src/lib/whatsapp.test.ts` | **Modificar.** Cobertura del marcador |
| `src/components/lista/SelectorFarmacia.tsx` | **Modificar.** Recordatorio antes de abrir WhatsApp |

**Corrección a la spec:** la spec lista `src/components/lista/CartSummary.tsx` como punto de contacto. **No lo es** — son 63 líneas sin ningún `map`, es una barra flotante que solo muestra el conteo. El único sitio que renderiza ítems es `ListaMedicaDrawer`.

---

## Task 1: Migración 010 — estructura y canonización

**Files:**
- Create: `DosisYa-Backend/db/migrations/010_condicion_dispensacion.sql`
- Modify: `DosisYa-Backend/db/schema.sql`

**Interfaces:**
- Consumes: nada (primera tarea)
- Produces: tipo `condicion_dispensacion_enum`; función `canon_principio(text) RETURNS text`; tabla `principios_activos_dispensacion(id, principio_canonico, etiqueta, condicion, ambulatorio, fuente, validado_por, validado_en, created_at, updated_at)`; índice `idx_inv_maestro_canon`

- [ ] **Step 1: Escribir la migración**

Crear `db/migrations/010_condicion_dispensacion.sql`:

```sql
-- ============================================================
-- DosisYa — Migración 010: condición de dispensación (hallazgo B-03)
-- Spec: DosisYa-Frontend/docs/superpowers/specs/2026-10-11-condicion-dispensacion-design.md
-- Ejecutar UNA SOLA VEZ contra Supabase (SQL Editor o psql).
--
-- Esta migración solo crea ESTRUCTURA. Los datos curados van en la 011,
-- que NO debe aplicarse sin la firma de un farmacéutico.
-- ============================================================

BEGIN;

CREATE TYPE condicion_dispensacion_enum AS ENUM ('libre','receta','controlado');

-- ------------------------------------------------------------
-- canon_principio(): clave de emparejamiento entre el catálogo y la tabla.
--
-- POR QUÉ EL ENVOLTORIO: unaccent() es STABLE, no IMMUTABLE, y Postgres no
-- permite indexar una expresión que la use. Se declara IMMUTABLE usando la
-- forma de dos argumentos con el diccionario fijado explícitamente — es el
-- truco documentado. Caveat asumido: si el diccionario unaccent cambiara,
-- habría que reindexar.
--
-- POR QUÉ EL GRUPO DE SAL COMPUESTA: medido contra los 422 principios activos
-- reales del catálogo, la variante con sales simples en una sola pasada
-- colapsa 12 de los 15 pares duplicados. Con el grupo opcional
-- (succinato|fosfato|benzoato|besilato) antes del sufijo, colapsa los 15.
-- El regex va en UN solo literal: Postgres concatena literales en líneas
-- distintas, y esa sutileza rompe migraciones en silencio.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION canon_principio(texto text) RETURNS text
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE AS $$
  SELECT regexp_replace(
           regexp_replace(
             lower(unaccent('public.unaccent'::regdictionary, trim(texto))),
             '\s+(succinato|fosfato|benzoato|besilato)?\s*(sodico|sodica|potasico|potasica|calcico|clorhidrato|hcl|maleato|lactato|tartrato|sulfato|acetato|mesilato|dipropionato|valerato|trihidratada|anhidro|base o trihidratada)$',
             ''),
           '\s+', ' ', 'g')
$$;

COMMENT ON FUNCTION canon_principio(text) IS
  'Clave canónica de principio activo: minúsculas, sin acentos, sin sufijo de sal. Usada por el índice idx_inv_maestro_canon y por principios_activos_dispensacion.principio_canonico.';

-- ------------------------------------------------------------
-- Tabla de referencia: una fila por molécula, no por entrada de catálogo.
-- inventario_maestro es compartido entre farmacias, así que clasificar por
-- principio activo cubre todas las marcas y presentaciones de golpe.
-- ------------------------------------------------------------
CREATE TABLE principios_activos_dispensacion (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    principio_canonico  TEXT NOT NULL UNIQUE,
    etiqueta            VARCHAR(255) NOT NULL,
    condicion           condicion_dispensacion_enum NOT NULL,
    ambulatorio         BOOLEAN NOT NULL DEFAULT true,
    fuente              TEXT,
    validado_por        VARCHAR(200),
    validado_en         TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  principios_activos_dispensacion IS
  'Condición de dispensación por principio activo. principio_canonico debe guardarse YA pasado por canon_principio().';
COMMENT ON COLUMN principios_activos_dispensacion.principio_canonico IS
  'Resultado de canon_principio(). Variantes del INN que el canon no unifica (diclofenac/diclofenaco) se insertan como filas separadas con la misma condicion.';
COMMENT ON COLUMN principios_activos_dispensacion.ambulatorio IS
  'false = producto hospitalario (factores de coagulación, soluciones IV, nutrición parenteral) que ninguna farmacia afiliada va a listar.';
COMMENT ON COLUMN principios_activos_dispensacion.validado_por IS
  'Farmacéutico que firmó la clasificación. NULL = borrador sin validar.';

-- Índice funcional sobre el catálogo para que el LEFT JOIN no escanee.
-- CREATE INDEX normal (no CONCURRENTLY): la tabla tiene ~533 filas y
-- CONCURRENTLY no puede correr dentro de una transacción.
CREATE INDEX idx_inv_maestro_canon
    ON inventario_maestro (canon_principio(principio_activo));

CREATE TRIGGER trg_pad_updated_at
    BEFORE UPDATE ON principios_activos_dispensacion
    FOR EACH ROW
    EXECUTE FUNCTION fn_set_updated_at();

COMMIT;
```

- [ ] **Step 2: Reflejar la 010 en `db/schema.sql`**

En `db/schema.sql`, sección 1 (TIPOS ENUMERADOS), añadir después de `origen_lead_enum`:

```sql
CREATE TYPE condicion_dispensacion_enum AS ENUM ('libre','receta','controlado'); -- migración 010 (hallazgo B-03)
```

Y en la sección 10 (TABLAS AÑADIDAS EN MIGRACIONES), al final, pegar el bloque completo de `canon_principio`, `principios_activos_dispensacion`, el índice y el trigger tal cual quedó en el Step 1, precedido de:

```sql
-- --- Migración 010: condición de dispensación (hallazgo B-03) ---
```

Actualizar también la cabecera del archivo: `Últimas migraciones incorporadas: 001 – 006` pasa a `001 – 010 (ver nota)`, y añadir la nota:

```sql
-- NOTA: las migraciones 006 y 007 NO están aplicadas en producción (verificado
--       2026-10-11: los índices unaccent de la 006 no existen, y Supabase solo
--       registra la 008 y la 009). La 006 además falla como está escrita porque
--       unaccent() es STABLE; canon_principio() de la 010 es el patrón correcto.
```

- [ ] **Step 3: Pedirle a José que aplique la 010**

La migración toca Supabase, así que requiere su autorización expresa (CLAUDE.md §8). Pedírsela mostrando el archivo. **No aplicarla por iniciativa propia.**

- [ ] **Step 4: Verificar la función contra datos reales**

Esto es el gate de esta tarea, porque pytest no cubre SQL. Una vez aplicada, correr contra Supabase:

```sql
WITH d AS (SELECT DISTINCT principio_activo p FROM inventario_maestro)
SELECT count(DISTINCT p)                       AS antes,
       count(DISTINCT canon_principio(p))      AS despues,
       count(DISTINCT p) - count(DISTINCT canon_principio(p)) AS colapsan
FROM d;
```

Esperado exactamente: `antes = 422`, `despues = 407`, `colapsan = 15`.

Si `colapsan` sale 12, el regex quedó con sales simples: falta el grupo opcional `(succinato|fosfato|benzoato|besilato)?\s*`. Si sale distinto de 12 o 15, el catálogo cambió desde la medición — reportarlo antes de seguir, no ajustar el número esperado.

El total correcto no garantiza que colapsaran los pares correctos, así que comprobarlos uno por uno:

```sql
WITH d AS (SELECT DISTINCT principio_activo p FROM inventario_maestro)
SELECT canon_principio(p) AS raiz, count(*) AS n,
       string_agg(p, ' | ' ORDER BY p) AS variantes
FROM d GROUP BY 1 HAVING count(*) > 1 ORDER BY 1;
```

Esperado: exactamente estas 15 raíces, cada una con `n = 2` (medido contra producción el 2026-10-11):

```
acido acetilsalicilico   Ácido acetilsalicílico | Ácido Acetilsalicílico
amiodarona               Amiodarona | Amiodarona clorhidrato
amoxicilina              Amoxicilina | Amoxicilina base o trihidratada
biperideno               Biperideno | Biperideno lactato
clindamicina             Clindamicina | Clindamicina clorhidrato
clorfeniramina           Clorfeniramina | Clorfeniramina maleato
dexametasona             Dexametasona | Dexametasona fosfato sódico
diclofenac               Diclofenac | Diclofenac sódico
diclofenaco              Diclofenaco | Diclofenaco sódico
gentamicina              Gentamicina | Gentamicina sulfato
hidrocortisona           Hidrocortisona | Hidrocortisona succinato sódico
metformina clorhidrato   Metformina clorhidrato | Metformina Clorhidrato
morfina                  Morfina | Morfina sulfato
propranolol              Propranolol | Propranolol clorhidrato
verapamilo               Verapamilo | Verapamilo clorhidrato
```

`diclofenac` y `diclofenaco` siguen separadas a propósito: son variantes del INN, no sales, y se
resuelven con dos filas en la tabla curada (§9 de la spec). Si `dexametasona` o `hidrocortisona`
**no** aparecen en la lista, falta el grupo de sal compuesta.

- [ ] **Step 5: Verificar que el índice existe de verdad**

El antecedente de la migración 006 es justamente que prometía índices que nunca se crearon:

```sql
SELECT indexname FROM pg_indexes
WHERE tablename = 'inventario_maestro' AND indexname = 'idx_inv_maestro_canon';
```

Esperado: una fila. Si sale vacío, la creación del índice falló (lo más probable: `canon_principio` no quedó `IMMUTABLE`) — no seguir a la Task 2 sin resolverlo.

- [ ] **Step 6: Commit**

```bash
cd /home/josemarrufo/Escritorio/DosisYa-Backend
git add db/migrations/010_condicion_dispensacion.sql db/schema.sql
git commit -m "feat(db): tabla y función de condición de dispensación (migración 010)"
```

---

## Task 2: Las queries públicas exponen la condición y excluyen controlados

**Files:**
- Modify: `DosisYa-Backend/src/dosisya/routers/medicamentos.py` (`_BUSCAR_MEDICAMENTOS` y `_SELECT_PRODUCTO_UNICO`)
- Test: `DosisYa-Backend/tests/test_medicamentos_dispensacion.py`

**Interfaces:**
- Consumes: de Task 1 — `canon_principio(text)`, `principios_activos_dispensacion.principio_canonico`, `principios_activos_dispensacion.condicion`
- Produces: campo `condicion_dispensacion` (valores `"libre"`, `"receta"` o `null`) en cada objeto de `data.resultados[]` de `GET /api/v1/medicamentos/buscar` y en `data` de `GET /api/v1/medicamentos/{medicamento_id}/farmacias/{farmacia_id}`

- [ ] **Step 1: Escribir los tests fallidos**

Crear `tests/test_medicamentos_dispensacion.py`. `_FakeConn` del repo solo implementa `fetchrow`; el endpoint de búsqueda usa `fetch`, así que aquí se extiende:

```python
"""
DosisYa — Tests del campo condicion_dispensacion (hallazgo B-03)

Cubre que el campo viaje del SELECT a la respuesta JSON en los dos endpoints
públicos. OJO: estos tests mockean la conexión, así que NO verifican el SQL
(ni el LEFT JOIN ni el filtro de controlados). Eso se verifica contra la base
real en los pasos de verificación del plan.
"""

from __future__ import annotations

import uuid

from fastapi.testclient import TestClient

from dosisya.main import app

client = TestClient(app)

MEDICAMENTO_ID = str(uuid.uuid4())
FARMACIA_ID = str(uuid.uuid4())

_FILA_BASE = {
    "farmacia_id": uuid.UUID(FARMACIA_ID),
    "farmacia_nombre": "Farmacia San Rafael",
    "direccion": "Av. Bolívar",
    "whatsapp": "+584121234567",
    "nivel_suscripcion": "premium",
    "es_premium": True,
    "tiene_delivery": True,
    "lat": 9.5597,
    "lng": -69.2036,
    "medicamento_id": uuid.UUID(MEDICAMENTO_ID),
    "medicamento_nombre": "Losartán",
    "marca_comercial": "Genfar",
    "presentacion": "Tabletas 50mg x30",
    "precio_usd": 3.5,
    "precio_ves": 511.0,
    "stock_disponible": True,
}

FILA_BUSQUEDA = {**_FILA_BASE, "distancia_m": 1172.0, "score_similitud": 0.5}


class _FakeConn:
    """fetchrow() consume respuestas en orden; fetch() devuelve la lista fijada."""

    def __init__(self, respuestas: list, filas: list | None = None):
        self._respuestas = list(respuestas)
        self._filas = list(filas or [])

    async def fetchrow(self, query, *args):
        return self._respuestas.pop(0)

    async def fetch(self, query, *args):
        return self._filas


class _Ctx:
    def __init__(self, conn):
        self._conn = conn

    async def __aenter__(self):
        return self._conn

    async def __aexit__(self, *exc):
        return False


def _mock_conn(monkeypatch, respuestas: list, filas: list | None = None):
    monkeypatch.setattr(
        "dosisya.routers.medicamentos.get_connection",
        lambda: _Ctx(_FakeConn(respuestas, filas)),
    )


BUSCAR = "/api/v1/medicamentos/buscar?q=losartan&lat=9.55&lng=-69.20"
DETALLE = f"/api/v1/medicamentos/{MEDICAMENTO_ID}/farmacias/{FARMACIA_ID}"


class TestCondicionEnBusqueda:
    def test_receta_llega_al_cliente(self, monkeypatch):
        fila = {**FILA_BUSQUEDA, "condicion_dispensacion": "receta"}
        _mock_conn(monkeypatch, [{"tasa_existe": True}], [fila])

        r = client.get(BUSCAR)

        assert r.status_code == 200
        assert r.json()["data"]["resultados"][0]["condicion_dispensacion"] == "receta"

    def test_libre_llega_al_cliente(self, monkeypatch):
        fila = {**FILA_BUSQUEDA, "condicion_dispensacion": "libre"}
        _mock_conn(monkeypatch, [{"tasa_existe": True}], [fila])

        r = client.get(BUSCAR)

        assert r.json()["data"]["resultados"][0]["condicion_dispensacion"] == "libre"

    def test_desconocido_viaja_como_null(self, monkeypatch):
        """Sin fila en la tabla curada el LEFT JOIN da NULL, y el producto
        SIGUE siendo visible (decisión 4 de la spec)."""
        fila = {**FILA_BUSQUEDA, "condicion_dispensacion": None}
        _mock_conn(monkeypatch, [{"tasa_existe": True}], [fila])

        r = client.get(BUSCAR)

        data = r.json()["data"]
        assert data["total"] == 1
        assert data["resultados"][0]["condicion_dispensacion"] is None


class TestCondicionEnDetalle:
    def test_receta_llega_al_cliente(self, monkeypatch):
        fila = {**_FILA_BASE, "condicion_dispensacion": "receta"}
        _mock_conn(monkeypatch, [{"tasa_existe": True}, fila])

        r = client.get(DETALLE)

        assert r.status_code == 200
        assert r.json()["data"]["condicion_dispensacion"] == "receta"

    def test_desconocido_viaja_como_null(self, monkeypatch):
        fila = {**_FILA_BASE, "condicion_dispensacion": None}
        _mock_conn(monkeypatch, [{"tasa_existe": True}, fila])

        r = client.get(DETALLE)

        assert r.status_code == 200
        assert r.json()["data"]["condicion_dispensacion"] is None
```

- [ ] **Step 2: Correr los tests y confirmar que fallan**

```bash
cd /home/josemarrufo/Escritorio/DosisYa-Backend
.venv/bin/python -m pytest tests/test_medicamentos_dispensacion.py -v
```

Esperado: los 5 fallan con `KeyError: 'condicion_dispensacion'` o `assert None == 'receta'`, porque el SELECT todavía no trae la columna.

**Si en cambio salen 429:** es la contaminación del limiter de slowapi documentada en el hallazgo B-17 (el endpoint de búsqueda tiene `@limiter.limit("60/minute")` y el almacenamiento es `memory://` compartido entre tests). Correr el archivo aislado antes de diagnosticar otra cosa.

- [ ] **Step 3: Añadir el JOIN y la columna a `_BUSCAR_MEDICAMENTOS`**

En `src/dosisya/routers/medicamentos.py`, dentro de `_BUSCAR_MEDICAMENTOS`:

En la lista del SELECT, después de la línea de `stock_disponible`, añadir:

```sql
        pad.condicion::TEXT                     AS condicion_dispensacion,
```

Después de `JOIN inventario_maestro im  ON im.id            = il.medicamento_id` y **antes** del `CROSS JOIN LATERAL`, añadir:

```sql
    LEFT JOIN principios_activos_dispensacion pad
           ON pad.principio_canonico = canon_principio(im.principio_activo)
```

Y en el `WHERE`, después de `AND ($5 = false OR f.tiene_delivery = true)`, añadir:

```sql
      -- Controlados y psicotrópicos fuera de la búsqueda pública hasta tener
      -- criterio legal firme (decisión 5 de la spec). IS DISTINCT FROM es la
      -- pieza clave: con NULL evalúa verdadero, así que lo DESCONOCIDO sigue
      -- visible. Un `<>` normal lo filtraría por el NULL y vaciaría el
      -- buscador de todo lo no clasificado.
      AND pad.condicion IS DISTINCT FROM 'controlado'
```

- [ ] **Step 4: Añadir el JOIN y la columna a `_SELECT_PRODUCTO_UNICO`**

En la misma manera, en `_SELECT_PRODUCTO_UNICO`:

En el SELECT, después de `il.stock_disponible AS stock_disponible`, cambiar esa línea para que lleve coma y añadir:

```sql
        il.stock_disponible                     AS stock_disponible,
        pad.condicion::TEXT                     AS condicion_dispensacion
```

Después de `JOIN inventario_maestro im  ON im.id = il.medicamento_id`, añadir:

```sql
    LEFT JOIN principios_activos_dispensacion pad
           ON pad.principio_canonico = canon_principio(im.principio_activo)
```

Y en el `WHERE`, cambiar la última línea para añadir el filtro antes del punto y coma:

```sql
      AND f.estado_afiliacion = 'activa'
      -- Un controlado accedido por URL directa responde 404: si no se lista,
      -- no se sirve (§6.2 de la spec).
      AND pad.condicion IS DISTINCT FROM 'controlado';
```

- [ ] **Step 5: Correr los tests y confirmar que pasan**

```bash
.venv/bin/python -m pytest tests/test_medicamentos_dispensacion.py -v
```

Esperado: `5 passed`.

- [ ] **Step 6: Correr la suite completa**

```bash
.venv/bin/python -m pytest -q
```

Esperado: `4 failed, 303 passed` — los 4 rojos pre-existentes de `test_farmacias_inventario_router.py` y nada más. Si aparece un quinto fallo, es propio.

- [ ] **Step 7: Verificar el SQL contra la base real**

Los tests mockean la conexión, así que este paso es el único que prueba el SQL. Con la 010 aplicada y la tabla **vacía** (la 011 no se aplica todavía), todo el catálogo está en estado desconocido:

```bash
curl -s "https://proyecto-dosis-ya.vercel.app/api/v1/medicamentos/buscar?q=losartan&lat=9.55&lng=-69.20" | head -c 400
```

Esperado: sigue devolviendo resultados (`"status":"success"`, `total` > 0) y cada resultado trae `"condicion_dispensacion":null`. Si `total` cae a 0, el `IS DISTINCT FROM` se escribió como `<>` y está filtrando los NULL.

Luego insertar **una** fila de prueba para ver los tres caminos, y borrarla al terminar:

```sql
INSERT INTO principios_activos_dispensacion (principio_canonico, etiqueta, condicion, fuente)
VALUES (canon_principio('Losartán Potásico'), 'Losartán (prueba)', 'receta', 'prueba-plan-010');
-- buscar losartan → debe traer "condicion_dispensacion":"receta"

UPDATE principios_activos_dispensacion SET condicion = 'controlado'
WHERE fuente = 'prueba-plan-010';
-- buscar losartan → el losartán debe DESAPARECER de los resultados

DELETE FROM principios_activos_dispensacion WHERE fuente = 'prueba-plan-010';
-- buscar losartan → vuelve con "condicion_dispensacion":null
```

Las tres comprobaciones tienen que dar el resultado descrito antes de commitear.

- [ ] **Step 8: Commit**

```bash
cd /home/josemarrufo/Escritorio/DosisYa-Backend
git add src/dosisya/routers/medicamentos.py tests/test_medicamentos_dispensacion.py
git commit -m "feat(medicamentos): expone condicion_dispensacion y excluye controlados"
```

---

## Task 3: El contrato en el frontend

**Files:**
- Modify: `src/lib/api.ts`
- Modify: `src/hooks/useListaMedica.ts`
- Modify: `src/routes/producto.$farmaciaId.$medicamentoId.tsx` (solo el tipo local)
- Test: `src/hooks/useListaMedica.test.ts`

**Interfaces:**
- Consumes: de Task 2 — el campo `condicion_dispensacion` de la API
- Produces: `type CondicionDispensacion = "libre" | "receta" | null` exportado desde `src/lib/api.ts`; `ResultadoFarmacia.condicion_dispensacion: CondicionDispensacion`; `ItemLista.condicionDispensacion?: CondicionDispensacion`

**Esta tarea no lleva tests nuevos, y es deliberado.** La «lectura tolerante» de la spec §7.1 no
es lógica: es que el campo sea opcional en el tipo y que nadie lo desreferencie sin comprobarlo.
`leerStorage()` (línea 68 de `useListaMedica.ts`) **no está exportada**, y exportarla solo para
afirmar que `JSON.parse` conserva u omite una clave sería teatro de tests, no cobertura. El gate
real de esta tarea es `npx tsc --noEmit`, que es exactamente la herramienta que verifica un cambio
de contrato de tipos. La cobertura *de comportamiento* del caso «condición desconocida» vive en la
Task 4, donde `construirMensajeLista` recibe un ítem sin el campo y se comprueba que no marca nada.

Dato de contexto para quien implemente: la clave real es `STORAGE_KEY = "dosisya:lista-medica:v1"`
y los tests de ese archivo usan `test(` (no `it(`) e importan solo funciones puras
(`claveItem`, `farmaciaUnicaDeLista`).

- [ ] **Step 1: Añadir el tipo compartido en `src/lib/api.ts`**

Antes de `export interface ResultadoFarmacia`, añadir:

```ts
/**
 * Condición de dispensación del medicamento (hallazgo B-03).
 *
 * `null` = desconocido: el principio activo no está en la tabla curada. NO
 * significa "venta libre" — la app nunca afirma eso (decisión 4 de la spec).
 * `"controlado"` no aparece en esta unión a propósito: el backend lo filtra en
 * SQL y nunca llega al cliente.
 */
export type CondicionDispensacion = "libre" | "receta" | null;
```

Y dentro de `ResultadoFarmacia`, después de `stock_disponible: boolean;`:

```ts
  condicion_dispensacion: CondicionDispensacion;
```

- [ ] **Step 2: Añadir el campo opcional a `ItemLista`**

En `src/hooks/useListaMedica.ts`, importar el tipo y añadir el campo dentro de `ItemLista`, después de `farmaciaWhatsapp`:

```ts
  /**
   * Condición de dispensación vista al añadir. Ausente en items guardados
   * antes de esta feature y en los del escáner de récipe (sin entrada de
   * catálogo). Se trata igual que `null`: sin insignia.
   */
  condicionDispensacion?: CondicionDispensacion;
```

El import va junto a los que ya existan de `@/lib/api`:

```ts
import type { CondicionDispensacion } from "@/lib/api";
```

- [ ] **Step 3: Añadir el campo al tipo local de la ficha de producto**

En `src/routes/producto.$farmaciaId.$medicamentoId.tsx`, dentro de `interface ProductoDetalle` (línea 9), después del campo de `stock_disponible` si existe, o al final de la interfaz:

```ts
  condicion_dispensacion: CondicionDispensacion;
```

Con su import:

```ts
import type { CondicionDispensacion } from "@/lib/api";
```

- [ ] **Step 4: Verificación mínima y commit**

```bash
npx tsc --noEmit && npm run build && npm test
```

Esperado: `tsc` sin errores, build exitoso, `75 passed` (sin cambio — esta tarea no añade tests).

Si `tsc` falla con «Property 'condicion_dispensacion' is missing» en algún sitio, es la señal de
que el cambio de contrato alcanzó un consumidor que el plan no listó: reportarlo antes de añadir
un `?` para silenciarlo, porque el campo **no** es opcional en la respuesta de la API.

```bash
git add src/lib/api.ts src/hooks/useListaMedica.ts "src/routes/producto.\$farmaciaId.\$medicamentoId.tsx"
git commit -m "feat(tipos): contrato de condicion_dispensacion en el frontend"
```

---

## Task 4: El marcador en el mensaje de WhatsApp

**Files:**
- Modify: `src/lib/whatsapp.ts`
- Test: `src/lib/whatsapp.test.ts`

**Interfaces:**
- Consumes: de Task 3 — `ItemLista.condicionDispensacion`, `CondicionDispensacion`
- Produces: `construirMensajeLista` marca las líneas de récipe con ` (requiere récipe)`; `construirMensajeProducto` acepta un cuarto parámetro `condicion` y añade el mismo marcador

Esta tarea va antes que la insignia porque es lógica pura y **sí** tiene tests de verdad. La insignia es presentacional y se verifica en el navegador.

- [ ] **Step 1: Escribir los tests fallidos**

En `src/lib/whatsapp.test.ts`, añadir al final:

```ts
describe("construirMensajeLista — marcador de récipe (hallazgo B-03)", () => {
  it("marca solo las líneas que requieren récipe", () => {
    const mensaje = construirMensajeLista("Farmacia San Rafael", [
      item({ nombre: "Losartán", condicionDispensacion: "receta" }),
      item({ medicamentoId: "med-2", nombre: "Acetaminofén", condicionDispensacion: "libre" }),
    ]);

    expect(mensaje).toContain("1. Losartán · Tabletas 50mg x 30 (requiere récipe)");
    expect(mensaje).toContain("2. Acetaminofén · Tabletas 50mg x 30");
    expect(mensaje).not.toContain("Acetaminofén · Tabletas 50mg x 30 (requiere récipe)");
  });

  it("no marca nada cuando la condición es desconocida", () => {
    const mensaje = construirMensajeLista("Farmacia San Rafael", [
      item({ nombre: "Vitamina C" }), // sin condicionDispensacion
    ]);

    expect(mensaje).not.toContain("requiere récipe");
  });

  it("nunca afirma que el paciente tiene el récipe", () => {
    // Decisión explícita de la spec: el mensaje no pone palabras en boca del
    // paciente. El recordatorio va en la app, no en el texto.
    const mensaje = construirMensajeLista("Farmacia San Rafael", [
      item({ condicionDispensacion: "receta" }),
    ]);

    expect(mensaje).not.toMatch(/tengo (el|mi) récipe/i);
    expect(mensaje).not.toMatch(/llevo (el|mi) récipe/i);
  });

  it("el marcador convive con la nota del escáner de récipe", () => {
    const mensaje = construirMensajeLista("Farmacia San Rafael", [
      item({ origen: "escaner_recipe", condicionDispensacion: "receta" }),
    ]);

    expect(mensaje).toContain("(requiere récipe)");
    expect(mensaje).toContain("leídos por IA");
  });
});

describe("construirMensajeProducto — marcador de récipe", () => {
  it("añade el marcador cuando el producto requiere récipe", () => {
    const mensaje = construirMensajeProducto(
      "Farmacia San Rafael",
      "Losartán",
      "Tabletas 50mg x 30",
      3.5,
      "receta",
    );

    expect(mensaje).toContain("(requiere récipe)");
  });

  it("no añade nada si es libre o desconocido", () => {
    expect(
      construirMensajeProducto("F", "Vitamina C", "Tabletas x 10", 1.5, "libre"),
    ).not.toContain("requiere récipe");
    expect(
      construirMensajeProducto("F", "Vitamina C", "Tabletas x 10", 1.5, null),
    ).not.toContain("requiere récipe");
  });
});
```

- [ ] **Step 2: Correr los tests y confirmar que fallan**

```bash
npx vitest run src/lib/whatsapp.test.ts
```

Esperado: los casos nuevos fallan; los de `construirMensajeProducto` fallan en compilación por el cuarto argumento que todavía no existe.

- [ ] **Step 3: Implementar el marcador**

En `src/lib/whatsapp.ts`, dentro de `construirMensajeLista`, reemplazar el cuerpo del `map`:

```ts
export function construirMensajeLista(farmaciaNombre: string, lista: ItemLista[]): string {
  const lineas = lista.map((item, i) => {
    const marca = item.marcaComercial ? ` (${item.marcaComercial})` : "";
    const cantidad = item.cantidad > 1 ? ` — x${item.cantidad}` : "";
    // Marcador para el farmacéutico. NO se afirma que el paciente traiga el
    // récipe: eso le pondría en la boca algo que puede no ser cierto. El
    // recordatorio al paciente vive en SelectorFarmacia (spec §7.2).
    const receta = item.condicionDispensacion === "receta" ? " (requiere récipe)" : "";
    return `${i + 1}. ${item.nombre}${marca} · ${item.presentacion}${cantidad}${receta}`;
  });
```

El resto de la función queda igual.

Y en `construirMensajeProducto`, añadir el cuarto parámetro:

```ts
export function construirMensajeProducto(
  farmaciaNombre: string,
  nombre: string,
  presentacion: string,
  precioUsd: number,
  condicion: CondicionDispensacion = null,
): string {
  const receta = condicion === "receta" ? " (requiere récipe)" : "";
  return (
    `Hola ${farmaciaNombre} 👋 Vi en *DosisYa* ${nombre} (${presentacion})${receta} ` +
    `a $${precioUsd.toFixed(2)}. ¿Lo tienen disponible?`
  );
}
```

Con el import del tipo al principio del archivo:

```ts
import type { CondicionDispensacion } from "@/lib/api";
```

El parámetro lleva `= null` por defecto para no romper a los llamadores existentes.

- [ ] **Step 4: Pasar la condición desde la ficha de producto**

En `src/routes/producto.$farmaciaId.$medicamentoId.tsx`, en la llamada a `construirMensajeProducto` (alrededor de la línea 107), añadir el cuarto argumento:

```ts
        p.condicion_dispensacion,
```

- [ ] **Step 5: Correr los tests y confirmar que pasan**

```bash
npx vitest run src/lib/whatsapp.test.ts
```

Esperado: todos los casos del archivo pasan.

- [ ] **Step 6: Verificación mínima y commit**

```bash
npx tsc --noEmit && npm run build && npm test
```

Esperado: sin errores y `81 passed` (75 + 6 nuevos).

```bash
git add src/lib/whatsapp.ts src/lib/whatsapp.test.ts "src/routes/producto.\$farmaciaId.\$medicamentoId.tsx"
git commit -m "feat(whatsapp): marca las líneas que requieren récipe en el mensaje"
```

---

## Task 5: La insignia

**Files:**
- Create: `src/components/BadgeReceta.tsx`
- Modify: `src/components/TarjetaResultado.tsx`
- Modify: `src/components/lista/ListaMedicaDrawer.tsx`
- Modify: `src/routes/producto.$farmaciaId.$medicamentoId.tsx`

**Interfaces:**
- Consumes: de Task 3 — `ResultadoFarmacia.condicion_dispensacion`, `ItemLista.condicionDispensacion`, `ProductoDetalle.condicion_dispensacion`
- Produces: componente `BadgeReceta` sin props

Sin tests unitarios: este repo no tiene `@testing-library` y los 9 archivos de test son lógica pura. El gate es `tsc`, `build` y verificación en el navegador. No inventar tests de render que no correrían.

- [ ] **Step 1: Crear el componente**

Crear `src/components/BadgeReceta.tsx`:

```tsx
/**
 * Insignia de "Requiere récipe" (hallazgo B-03).
 *
 * Es la ÚNICA insignia de condición de dispensación que existe en la app: no
 * hay una de "venta libre". Ausencia de insignia no afirma nada — ni que el
 * producto es libre ni que no lo es (decisión 4 de la spec). Los errores no
 * son simétricos y el diseño solo hace la afirmación cautelosa.
 *
 * Usa los tokens --ambar-receta / --ambar-fondo, que la paleta ya reservaba
 * para este aviso antes de que el dato existiera. BadgePremium y BadgeDelivery
 * usan clases Tailwind planas; aquí se usan los tokens porque es el sitio para
 * el que se crearon y porque TarjetaResultado ya trabaja con var() en línea.
 */
export function BadgeReceta() {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold"
      style={{ background: "var(--ambar-fondo)", color: "var(--ambar-receta)" }}
    >
      Requiere récipe
    </span>
  );
}
```

- [ ] **Step 2: Pintarla en la tarjeta de resultado y propagar el campo al carrito**

En `src/components/TarjetaResultado.tsx`, añadir el import:

```tsx
import { BadgeReceta } from "@/components/BadgeReceta";
```

En el bloque de medicamento + presentación (alrededor de la línea 180), después del `<p>` que muestra nombre y presentación, añadir:

```tsx
          {resultado.condicion_dispensacion === "receta" && (
            <div className="mt-1.5">
              <BadgeReceta />
            </div>
          )}
```

Y en `handleAgregar`, dentro del objeto que se pasa a `agregar({...})`, después de `farmaciaWhatsapp: resultado.whatsapp,`:

```tsx
      condicionDispensacion: resultado.condicion_dispensacion,
```

- [ ] **Step 3: Pintarla en la Lista Médica**

En `src/components/lista/ListaMedicaDrawer.tsx`, añadir el import:

```tsx
import { BadgeReceta } from "@/components/BadgeReceta";
```

Después del `<p className="truncate text-xs text-muted-foreground">` que muestra `item.presentacion` y el nombre de la farmacia (línea ~117-120), añadir:

```tsx
                          {item.condicionDispensacion === "receta" && (
                            <div className="mt-1">
                              <BadgeReceta />
                            </div>
                          )}
```

- [ ] **Step 4: Pintarla en la ficha de producto**

En `src/routes/producto.$farmaciaId.$medicamentoId.tsx`, añadir el import y, después del bloque que muestra `p.medicamento_nombre` y `p.presentacion` (línea ~164-166), añadir:

```tsx
          {p.condicion_dispensacion === "receta" && (
            <div className="mt-2">
              <BadgeReceta />
            </div>
          )}
```

- [ ] **Step 5: Verificación mínima**

```bash
npx tsc --noEmit && npm run build && npm test
```

Esperado: sin errores y `81 passed` (sin cambio respecto a Task 4).

- [ ] **Step 6: Verificar en el navegador contra datos reales**

Levantar el preview con la configuración que proxea a producción:

```
preview_start con name "dev-proxy-prod"
```

Con la 010 aplicada y la tabla vacía, ninguna tarjeta debe mostrar insignia (todo es desconocido). Para ver la insignia, insertar temporalmente la fila de prueba de la Task 2 Step 7, buscar «losartan» en la app, confirmar visualmente que la insignia aparece en la tarjeta y en la Lista Médica al añadirlo, y **borrar la fila al terminar**.

Tomar una captura de la tarjeta con la insignia para adjuntarla al cierre de la tarea.

- [ ] **Step 7: Commit**

```bash
git add src/components/BadgeReceta.tsx src/components/TarjetaResultado.tsx src/components/lista/ListaMedicaDrawer.tsx "src/routes/producto.\$farmaciaId.\$medicamentoId.tsx"
git commit -m "feat(ui): insignia 'Requiere récipe' en tarjeta, lista y ficha"
```

---

## Task 6: El recordatorio al paciente antes de abrir WhatsApp

**Files:**
- Modify: `src/components/lista/SelectorFarmacia.tsx`

**Interfaces:**
- Consumes: de Task 3 — `ItemLista.condicionDispensacion`
- Produces: nada que consuman otras tareas

- [ ] **Step 1: Añadir el recordatorio**

En `src/components/lista/SelectorFarmacia.tsx`, calcular si la lista tiene algún ítem de récipe. Junto a las demás derivaciones del componente (antes del `return` del estado normal):

```tsx
  const hayReceta = lista.some((i) => i.condicionDispensacion === "receta");
```

Y en el render, encima de la lista de farmacias con sus botones de contactar, añadir:

```tsx
      {hayReceta && (
        <p
          className="mx-5 mb-2 rounded-lg px-3 py-2 text-xs leading-relaxed"
          style={{ background: "var(--ambar-fondo)", color: "var(--ambar-receta)" }}
        >
          Alguno de tus medicamentos requiere récipe médico. Lleva el tuyo cuando vayas
          a retirarlo — la farmacia está obligada a pedírtelo.
        </p>
      )}
```

Va en el render, no en un `toast`: un toast se pierde justo cuando el paciente ya está saliendo hacia WhatsApp.

- [ ] **Step 2: Verificación mínima**

```bash
npx tsc --noEmit && npm run build && npm test
```

Esperado: sin errores, `81 passed`.

- [ ] **Step 3: Verificar en el navegador**

Con la fila de prueba insertada, añadir el losartán a la Lista Médica, abrir el selector de farmacia y confirmar que el aviso ámbar aparece encima de los botones. Quitar el ítem de récipe de la lista y confirmar que el aviso desaparece. Borrar la fila de prueba al terminar.

- [ ] **Step 4: Commit**

```bash
git add src/components/lista/SelectorFarmacia.tsx
git commit -m "feat(lista): recuerda llevar el récipe antes de abrir WhatsApp"
```

---

## Task 7: El seed curado (se escribe, NO se aplica)

**Files:**
- Create: `DosisYa-Backend/db/migrations/011_seed_dispensacion.sql`

**Interfaces:**
- Consumes: de Task 1 — `canon_principio(text)`, `principios_activos_dispensacion`
- Produces: nada en código. Produce un documento que necesita firma externa.

- [ ] **Step 1: Obtener la lista real de principios activos a clasificar**

Contra Supabase:

```sql
SELECT DISTINCT canon_principio(principio_activo) AS canonico,
       min(principio_activo)                      AS ejemplo
FROM inventario_maestro
GROUP BY 1
ORDER BY 1;
```

Esperado: 407 filas. Guardar el resultado — es la entrada del Step 2.

- [ ] **Step 2: Escribir el borrador**

Crear `db/migrations/011_seed_dispensacion.sql` con esta cabecera **literal**:

```sql
-- ============================================================
-- DosisYa — Migración 011: seed de condición de dispensación
--
-- ⛔ NO APLICAR ESTA MIGRACIÓN SIN LA FIRMA DE UN FARMACÉUTICO.
--
-- Este archivo es un BORRADOR redactado por Claude, que no es farmacéutico
-- venezolano. Aplicarlo sin revisión convertiría suposiciones en afirmaciones
-- regulatorias que la app le hace a un paciente sobre su medicación.
--
-- Procedimiento de validación:
--   1. Un farmacéutico revisa cada fila (condicion y ambulatorio).
--   2. Corrige lo que haga falta.
--   3. Reemplaza en TODAS las filas:
--        fuente='borrador-sin-validar'  →  fuente='<fuente real consultada>'
--        validado_por=NULL              →  validado_por='<nombre y C.I.>'
--        validado_en=NULL               →  validado_en=now()
--   4. Recién entonces se aplica.
--
-- Spec: DosisYa-Frontend/docs/superpowers/specs/2026-10-11-condicion-dispensacion-design.md
-- Alcance (decisión 3): se clasifica el subconjunto AMBULATORIO. Los
-- hospitalarios (factores de coagulación, inmunoglobulinas, soluciones IV,
-- nutrición parenteral) van con ambulatorio=false y condicion='receta' como
-- marca conservadora: ninguna farmacia afiliada los va a listar.
--
-- VARIANTES DEL INN: canon_principio() no unifica 'diclofenac' con
-- 'diclofenaco' ni los combos con distinto conector. Esos van como filas
-- SEPARADAS con la misma condicion — ver §9 de la spec.
-- ============================================================

BEGIN;

INSERT INTO principios_activos_dispensacion
  (principio_canonico, etiqueta, condicion, ambulatorio, fuente)
VALUES
  -- Ejemplos del formato. La lista completa sale del Step 1.
  ('losartan',            'Losartán',            'receta',     true,  'borrador-sin-validar'),
  ('acetaminofen',        'Acetaminofén',        'libre',      true,  'borrador-sin-validar'),
  ('morfina',             'Morfina',             'controlado', true,  'borrador-sin-validar'),
  ('diclofenac',          'Diclofenac',          'receta',     true,  'borrador-sin-validar'),
  ('diclofenaco',         'Diclofenaco',         'receta',     true,  'borrador-sin-validar'),
  ('factor viii antihemofilico humano',
                          'Factor VIII antihemofílico humano',
                                                 'receta',     false, 'borrador-sin-validar')
ON CONFLICT (principio_canonico) DO NOTHING;

COMMIT;
```

Completar con las 407 raíces del Step 1. Reglas de clasificación a aplicar:

- `controlado` — opioides y psicotrópicos: morfina, fentanilo, metadona, codeína, tramadol, alprazolam, clonazepam, diazepam, lorazepam, midazolam, fenobarbital, metilfenidato y similares.
- `receta` — antibióticos, antihipertensivos, antidiabéticos, anticoagulantes, corticoides sistémicos, antiepilépticos, antidepresivos, antipsicóticos, inmunosupresores, oncológicos, inyectables.
- `libre` — solo lo que en Venezuela se dispensa sin récipe: acetaminofén, ibuprofeno a dosis OTC, antiácidos, antihistamínicos de primera generación, vitaminas y suplementos, soluciones de rehidratación oral, antisépticos tópicos.
- `ambulatorio = false` — derivados sanguíneos, factores de coagulación, inmunoglobulinas, soluciones IV, nutrición parenteral, anestésicos, medios de contraste.

Ante la duda, `receta`: es la dirección en la que el error no hace daño (§2 de la spec).

- [ ] **Step 3: Verificar que toda raíz del archivo existe en el catálogo**

Un `principio_canonico` mal escrito no empareja nunca y la insignia no aparece — en silencio, que es el fallo que la spec quiere evitar. Correr contra Supabase, **sin aplicar la migración**, el `VALUES` del archivo contra el catálogo:

```sql
WITH seed(canonico) AS (
  VALUES ('losartan'), ('acetaminofen'), ('morfina') -- …las 407 del archivo
),
catalogo AS (
  SELECT DISTINCT canon_principio(principio_activo) AS canonico FROM inventario_maestro
)
SELECT s.canonico AS no_existe_en_el_catalogo
FROM seed s LEFT JOIN catalogo c ON c.canonico = s.canonico
WHERE c.canonico IS NULL;
```

Esperado: **0 filas**. Cualquier fila devuelta es una raíz mal escrita que hay que corregir antes de entregar el archivo.

- [ ] **Step 4: Commit sin aplicar**

```bash
cd /home/josemarrufo/Escritorio/DosisYa-Backend
git add db/migrations/011_seed_dispensacion.sql
git commit -m "docs(db): borrador del seed de dispensación (requiere firma farmacéutica)"
```

- [ ] **Step 5: Entregárselo a José explícitamente**

Decirle, en estos términos: el archivo está commiteado y **no aplicado**; necesita que un farmacéutico revise y firme las 407 filas antes de ejecutarlo; mientras no se aplique, la app no muestra ninguna insignia y se comporta igual que hoy, sin regresión.

---

## Cierre

Con las Tasks 1-6 aplicadas y la 011 pendiente de firma, el sistema queda en un estado coherente: la estructura existe, los endpoints exponen el campo, la UI sabe pintarlo y el mensaje sabe marcarlo, pero **no se hace ninguna afirmación** porque la tabla está vacía. El hallazgo B-03 queda cerrado en código y abierto en validación farmacéutica — que es exactamente donde debe estar la frontera.

### Deuda relacionada que este plan NO toca

Anotada en §11 de la spec. En particular, `canon_principio()` es la pieza que también arreglaría la **migración 006**, que nunca se aplicó y está rota por el mismo motivo de `unaccent`. Hoy la búsqueda corre sin índice funcional. Merece su propio plan.
