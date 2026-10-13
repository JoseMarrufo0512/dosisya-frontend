# Consentimiento antes de subir un récipe — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que ninguna foto de récipe salga del dispositivo sin que la persona que la sube haya visto qué va a pasar con ella y lo haya autorizado explícitamente.

**Architecture:** Un estado `confirmando` entre `idle` y `scanning` parte `procesarImagen` en dos: `prepararImagen` (valida y genera preview, no transmite) y `enviarImagen` (solo alcanzable desde el botón de consentimiento). Los dos endpoints exigen un campo nuevo en el formulario y responden 422 sin él. El del panel, además, registra la declaración del farmacéutico en una tabla nueva.

**Tech Stack:** React 19 + TanStack Start + TypeScript + Vitest · Python 3.12 + FastAPI + asyncpg + pytest · PostgreSQL (Supabase)

**Spec:** [`docs/superpowers/specs/2026-10-12-consentimiento-escaner-recipe-design.md`](../specs/2026-10-12-consentimiento-escaner-recipe-design.md)

## Global Constraints

- **ORDEN DE DESPLIEGUE: frontend primero, backend después.** Es el inverso de B-03 y es crítico. FastAPI ignora los campos de formulario que no declara, así que el frontend nuevo contra el backend viejo funciona sin problema. Al revés **no**: el backend nuevo contra el frontend viejo rechazaría con 422 **todos** los escaneos.
- **La pantalla de consentimiento y el envío del campo van en el MISMO commit.** Mandar `consentimiento=true` sin haber preguntado es peor que no mandar nada: sería afirmar un consentimiento que no existe.
- **Dos repos.** Backend en `/home/josemarrufo/Escritorio/DosisYa-Backend`, frontend en este worktree.
- **El backend requiere autorización expresa de José** (CLAUDE.md §2), y **aplicar la migración 012 a Supabase también** (CLAUDE.md §8).
- **Textos exactos, copiados de la spec, que no se pueden parafrasear:** el botón del paciente dice **«Enviar para que la lean»**; el secundario, **«Cancelar»**. Nunca un «Aceptar» genérico. El de la farmacia dice **«Enviar para analizar»** y está deshabilitado hasta marcar la casilla.
- **El texto de la declaración del farmacéutico va marcado como pendiente de revisión legal**, igual que la migración 011 de B-03. No se inventa la base de tratamiento.
- **El aviso al paciente NO dice qué hace Google con la imagen**, porque no se sabe (hallazgo B-05b, abierto). Dice lo que sabemos y calla lo que no. No rellenar ese hueco con suposiciones.
- **No hay infraestructura de tests de componentes** (sin `@testing-library`). La garantía estructural se verifica leyendo el código y en el navegador. No inventar tests de render.
- **`main` del backend arrastra 4 tests rojos pre-existentes** en `tests/test_farmacias_inventario_router.py`. El conteo de partida tras B-03 es `4 failed, 302 passed`.
- **Verificación mínima antes de cada commit** — frontend: `npx tsc --noEmit && npm run build && npm test`. Backend: `.venv/bin/python -m pytest -q`.

---

## File Structure

### Frontend (este worktree)

| Archivo | Responsabilidad |
|---|---|
| `src/components/EscanerRecipe.tsx` | **Modificar.** Estado `confirmando`, split de `procesarImagen`, pantalla de consentimiento |
| `src/lib/recipeIA.ts` | **Modificar.** Añadir `consentimiento` al FormData |
| `src/components/panel/EscanerRecipeFarmacia.tsx` | **Modificar.** Lo mismo + casilla de declaración |
| `src/lib/recipeIAFarmacia.ts` | **Modificar.** Añadir `declaracion_autorizacion` al FormData |

### Backend (`DosisYa-Backend`)

| Archivo | Responsabilidad |
|---|---|
| `db/migrations/012_consentimientos_recipe.sql` | **Crear.** Tabla de registro |
| `db/schema.sql` | **Modificar.** Reflejar la 012 |
| `src/dosisya/routers/ia.py` | **Modificar.** Exigir `consentimiento` |
| `src/dosisya/routers/farmacias.py` | **Modificar.** Exigir `declaracion_autorizacion` y registrar |
| `tests/test_ia_consentimiento.py` | **Crear.** Cobertura del endpoint del paciente |
| `tests/test_farmacias_consentimiento.py` | **Crear.** Cobertura del endpoint de farmacia + registro |

### Pista para el hallazgo B-17 (fuera de este plan)

Al explorar se verificó que `tests/test_ia_router.py` tiene un fixture `autouse` que llama a
`limiter.reset()` antes de cada test, y que `tests/test_farmacias_inventario_router.py` tiene
**cero** apariciones de `limiter.reset`. Esa es casi con seguridad la causa de los 4 tests rojos
pre-existentes. No se arregla aquí —no es el objeto de este plan— pero queda anotado.

---

## Task 1: El paciente ve y autoriza antes de enviar

**Files:**
- Modify: `src/components/EscanerRecipe.tsx`
- Modify: `src/lib/recipeIA.ts`

**Interfaces:**
- Consumes: nada (primera tarea)
- Produces: el formulario de `POST /api/v1/ia/analizar-recipe` incluye el campo `consentimiento` con el valor `"true"`

La pantalla y el envío del campo van juntos a propósito: ver las Global Constraints.

- [ ] **Step 1: Añadir el estado `confirmando` y partir `procesarImagen`**

En `src/components/EscanerRecipe.tsx`, cambiar el tipo de estado (línea 34):

```tsx
type Estado = "idle" | "confirmando" | "scanning" | "results" | "error";
```

Y reemplazar `procesarImagen` entero por estas dos funciones. **Fíjate en que `prepararImagen` no
llama a nada de red:** esa es la garantía, y es estructural, no un flag.

```tsx
  // ── Preparación: valida y muestra, NO transmite ──────────────────────────
  // La separación es la garantía del hallazgo B-04: la función que transmite
  // (enviarImagen) no es alcanzable sin pasar por la pantalla de
  // consentimiento. No es un flag que alguien pueda olvidar comprobar.
  const prepararImagen = useCallback((file: File) => {
    const error = validarImagen(file);
    if (error) {
      toast.error(error);
      return;
    }
    setArchivo(file);
    setPreviewUrl(URL.createObjectURL(file));
    setEstado("confirmando");
  }, []);

  // ── Transmisión: solo desde el botón de consentimiento ───────────────────
  const enviarImagen = useCallback(async () => {
    if (!archivo) return;
    setEstado("scanning");

    try {
      const respuesta = await analizarRecipe(archivo);

      if (respuesta.status === "success" && respuesta.data && respuesta.data.length > 0) {
        track("receta_escaneada", { medicamentos: respuesta.data?.length ?? 0 });
        const conId: MedicamentoRecetaUI[] = respuesta.data.map((med) => ({
          ...med,
          id: `recipe-${med.medicamento.toLowerCase().replace(/\s+/g, "-")}`,
        }));
        setResultados(conId);
        setEstado("results");
      } else {
        const errorMsg = respuesta.message || "No pudimos leer el récipe.";
        setErrorMsg(errorMsg);
        track("receta_error", { motivo: errorMsg });
        setEstado("error");
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Error inesperado";
      setErrorMsg(errorMsg);
      track("receta_error", { motivo: errorMsg });
      Sentry.captureException(err);
      setEstado("error");
    }
  }, [archivo]);

  // ── Cancelar: la foto nunca sale del dispositivo ─────────────────────────
  const cancelarEnvio = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setArchivo(null);
    setEstado("idle");
  }, [previewUrl]);
```

Añadir el estado del archivo junto a los demás `useState` (alrededor de la línea 44):

```tsx
  const [archivo, setArchivo] = useState<File | null>(null);
```

Y en `handleOpenChange`, donde se resetea al abrir, añadir `setArchivo(null);` junto a
`setPreviewUrl(null);`.

El `handleFileChange` que hoy llama a `procesarImagen` pasa a llamar a `prepararImagen`.

- [ ] **Step 2: Añadir la pantalla de consentimiento**

En el `AnimatePresence`, **entre** el bloque `estado === "idle"` y el bloque
`estado === "scanning"`, insertar:

```tsx
            {/* ── CONFIRMANDO: consentimiento previo (hallazgo B-04) ──── */}
            {estado === "confirmando" && (
              <motion.div
                key="confirmando"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="flex flex-col px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-3"
              >
                <Drawer.Title className="text-lg font-bold text-foreground">
                  ¿Enviamos esta foto?
                </Drawer.Title>

                {previewUrl && (
                  <img
                    src={previewUrl}
                    alt="Récipe que estás por enviar"
                    className="mt-3 h-48 w-full rounded-2xl object-cover"
                  />
                )}

                <div
                  className="mt-4 rounded-xl px-4 py-3 text-xs leading-relaxed"
                  style={{ background: "var(--ambar-fondo)", color: "var(--ambar-receta)" }}
                >
                  <p>
                    Para leer los medicamentos, esta foto se envía a nuestro servidor y de ahí al
                    servicio de inteligencia artificial de <strong>Google (Gemini)</strong>.
                  </p>
                  <p className="mt-2">
                    <strong>DosisYa no la guarda.</strong> Ten en cuenta que un récipe suele llevar
                    tu nombre y el de tu médico.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => void enviarImagen()}
                  className="mt-5 flex min-h-12 w-full items-center justify-center rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white transition-opacity hover:opacity-90"
                >
                  Enviar para que la lean
                </button>
                <button
                  type="button"
                  onClick={cancelarEnvio}
                  className="mt-2 flex min-h-12 w-full items-center justify-center rounded-xl border border-border px-4 py-3 font-medium text-foreground transition-colors hover:bg-muted"
                >
                  Cancelar
                </button>
              </motion.div>
            )}
```

El texto **no dice qué hace Google con la imagen** porque no lo sabemos (B-05b). No rellenar ese
hueco.

- [ ] **Step 3: Mandar el campo en el cliente**

En `src/lib/recipeIA.ts`, dentro de `analizarRecipe`, junto al `formData.append("file", …)`:

```ts
    const formData = new FormData();
    formData.append("file", imagenAEnviar);
    // Hallazgo B-04: el backend lo exige y responde 422 sin él. Es una guarda
    // contra nuestra propia regresión — si alguien se lleva por delante la
    // pantalla de consentimiento, esto falla ruidosamente en vez de en silencio.
    formData.append("consentimiento", "true");
```

- [ ] **Step 4: Verificación mínima**

```bash
npx tsc --noEmit && npm run build && npm test
```

Esperado: sin errores, build limpio, `81 passed` (sin cambio: esta tarea no añade tests).

- [ ] **Step 5: Verificar en el navegador que cancelar NO transmite**

Esto es lo que ningún test de este repo cubre. Levantar el preview:

```
preview_start con name "dev-proxy-prod"
```

Abrir el escáner, elegir una imagen cualquiera, y con el panel de red abierto comprobar las dos
mitades:

1. Al elegir la foto aparece la pantalla «¿Enviamos esta foto?» y **no hay ninguna petición** a
   `analizar-recipe`.
2. Al pulsar **Cancelar**, se vuelve a la pantalla inicial y **sigue sin haber ninguna petición**.
3. Solo al pulsar **«Enviar para que la lean»** aparece la petición.

Si en el paso 1 o 2 aparece una petición, el split de `procesarImagen` quedó mal y la garantía no
existe. Tomar captura de la pantalla de consentimiento para el cierre de la tarea.

- [ ] **Step 6: Commit**

```bash
git add src/components/EscanerRecipe.tsx src/lib/recipeIA.ts
git commit -m "feat(recipe): consentimiento explícito antes de enviar la foto del récipe"
```

---

## Task 2: El farmacéutico declara antes de enviar

**Files:**
- Modify: `src/components/panel/EscanerRecipeFarmacia.tsx`
- Modify: `src/lib/recipeIAFarmacia.ts`

**Interfaces:**
- Consumes: de Task 1 — el mismo patrón `confirmando` / `prepararImagen` / `enviarImagen` / `cancelarEnvio`
- Produces: el formulario de `POST /api/v1/farmacias/{id}/ia/analizar-recipe` incluye `declaracion_autorizacion` con el valor `"true"`

La diferencia con la Task 1 no es cosmética: aquí **el titular del dato no está presente**, así que
son dos actos (marcar la casilla, luego enviar) en vez de uno.

- [ ] **Step 1: Añadir el estado y partir `procesarImagen`**

En `src/components/panel/EscanerRecipeFarmacia.tsx`, línea 33:

```tsx
type Estado = "idle" | "confirmando" | "scanning" | "results" | "error";
```

Junto a los `useState` existentes (alrededor de la línea 99), añadir:

```tsx
  const [archivo, setArchivo] = useState<File | null>(null);
  const [declaracionMarcada, setDeclaracionMarcada] = useState(false);
```

Reemplazar `procesarImagen` (línea 120) por:

```tsx
  // ── Preparación: valida y muestra, NO transmite ──────────────────────────
  // Igual que en el escáner del paciente (hallazgo B-04): la función que
  // transmite no es alcanzable sin pasar por la declaración.
  const prepararImagen = useCallback((file: File) => {
    const error = validarImagen(file);
    if (error) {
      toast.error(error);
      return;
    }
    setArchivo(file);
    setPreviewUrl(URL.createObjectURL(file));
    setDeclaracionMarcada(false);
    setEstado("confirmando");
  }, []);

  // ── Transmisión: solo desde el botón, y solo con la casilla marcada ──────
  const enviarImagen = useCallback(async () => {
    if (!archivo || !declaracionMarcada) return;
    setEstado("scanning");

    try {
      const respuesta = await analizarRecipeFarmacia(archivo);

      if (respuesta.status === "success" && respuesta.data && respuesta.data.length > 0) {
        setResultados(respuesta.data);
        setEstado("results");
      } else {
        setErrorMsg(respuesta.message || "No pudimos leer el récipe.");
        setEstado("error");
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Error inesperado");
      Sentry.captureException(err);
      setEstado("error");
    }
  }, [archivo, declaracionMarcada]);

  const cancelarEnvio = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setArchivo(null);
    setDeclaracionMarcada(false);
    setEstado("idle");
  }, [previewUrl]);
```

El bloque de arriba refleja el `procesarImagen` del archivo en el momento de escribir este plan.
Si al abrirlo el manejo de resultados o de errores difiere, **manda el archivo**: copiarlo tal cual
y mover solo lo que corresponde. El reparto es lo que no cambia — validación y preview en
`prepararImagen`, llamada de red en `enviarImagen`.

Donde hoy se llama a `procesarImagen`, llamar a `prepararImagen`. Y en el reseteo al abrir el
drawer, añadir `setArchivo(null); setDeclaracionMarcada(false);`.

- [ ] **Step 2: Añadir la pantalla con la casilla**

Entre el bloque `estado === "idle"` y el bloque `estado === "scanning"`:

```tsx
            {/* ── CONFIRMANDO: declaración del farmacéutico (B-04) ────── */}
            {estado === "confirmando" && (
              <motion.div
                key="confirmando"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="flex flex-col px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-3"
              >
                <Drawer.Title className="text-lg font-bold text-foreground">
                  Confirma antes de analizar
                </Drawer.Title>

                {previewUrl && (
                  <img
                    src={previewUrl}
                    alt="Récipe que estás por enviar"
                    className="mt-3 h-48 w-full rounded-2xl object-cover"
                  />
                )}

                <div
                  className="mt-4 rounded-xl px-4 py-3 text-xs leading-relaxed"
                  style={{ background: "var(--ambar-fondo)", color: "var(--ambar-receta)" }}
                >
                  <p>
                    Esta foto se envía a nuestro servidor y de ahí al servicio de inteligencia
                    artificial de <strong>Google (Gemini)</strong> para extraer los datos de
                    dispensación. <strong>DosisYa no la guarda.</strong>
                  </p>
                  <p className="mt-2">
                    El récipe contiene datos del paciente y del médico, y esa persona no está aquí
                    para autorizarlo.
                  </p>
                </div>

                {/* TEXTO PENDIENTE DE REVISIÓN LEGAL — ver §6 de la spec.
                    No corresponde a esta implementación decidir cuál es la base
                    de tratamiento cuando el paciente no está presente. */}
                <label className="mt-4 flex cursor-pointer items-start gap-3 text-xs leading-relaxed text-foreground">
                  <input
                    type="checkbox"
                    checked={declaracionMarcada}
                    onChange={(e) => setDeclaracionMarcada(e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0"
                  />
                  <span>
                    Declaro que estoy autorizado para procesar este récipe en el ejercicio de la
                    dispensación.
                  </span>
                </label>

                <button
                  type="button"
                  onClick={() => void enviarImagen()}
                  disabled={!declaracionMarcada}
                  className="mt-5 flex min-h-12 w-full items-center justify-center rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Enviar para analizar
                </button>
                <button
                  type="button"
                  onClick={cancelarEnvio}
                  className="mt-2 flex min-h-12 w-full items-center justify-center rounded-xl border border-border px-4 py-3 font-medium text-foreground transition-colors hover:bg-muted"
                >
                  Cancelar
                </button>
              </motion.div>
            )}
```

- [ ] **Step 3: Mandar el campo en el cliente**

En `src/lib/recipeIAFarmacia.ts`, dentro de `analizarRecipeFarmacia`:

```ts
    const formData = new FormData();
    formData.append("file", imagenAEnviar);
    // Hallazgo B-04: el backend lo exige, responde 422 sin él, y registra la
    // declaración en consentimientos_recipe.
    formData.append("declaracion_autorizacion", "true");
```

- [ ] **Step 4: Verificación mínima**

```bash
npx tsc --noEmit && npm run build && npm test
```

Esperado: sin errores, build limpio, `81 passed`.

- [ ] **Step 5: Verificar la casilla en el navegador**

El panel exige sesión de farmacia y plan Premium, así que esta verificación necesita credenciales
de una farmacia Premium. Si no están disponibles, **decirlo explícitamente al cerrar la tarea en
vez de darla por verificada** — y comprobar al menos que `npm run build` pasa y que el bloque se
renderiza revisando el código.

Con acceso: elegir una foto, comprobar que el botón «Enviar para analizar» está **deshabilitado**
hasta marcar la casilla, y que con el panel de red abierto no hay ninguna petición a
`analizar-recipe` hasta pulsarlo.

- [ ] **Step 6: Commit**

```bash
git add src/components/panel/EscanerRecipeFarmacia.tsx src/lib/recipeIAFarmacia.ts
git commit -m "feat(panel): declaración del farmacéutico antes de analizar un récipe"
```

---

## Task 3: La tabla de registro

**Files:**
- Create: `DosisYa-Backend/db/migrations/012_consentimientos_recipe.sql`
- Modify: `DosisYa-Backend/db/schema.sql`

**Interfaces:**
- Consumes: nada
- Produces: tabla `consentimientos_recipe(id, farmacia_id, fecha_hora, ip_origen)` con índice `idx_consentimientos_farmacia_fecha`

- [ ] **Step 1: Escribir la migración**

Crear `db/migrations/012_consentimientos_recipe.sql`:

```sql
-- ============================================================
-- DosisYa — Migración 012: registro de declaraciones del escáner de récipe
-- Spec: DosisYa-Frontend/docs/superpowers/specs/2026-10-12-consentimiento-escaner-recipe-design.md
-- Ejecutar UNA SOLA VEZ contra Supabase (SQL Editor o psql).
--
-- QUÉ GUARDA Y QUÉ NO
--   Guarda: qué farmacia declaró estar autorizada, cuándo, y desde qué IP.
--   NO guarda: la imagen, los medicamentos extraídos, ni ningún identificador
--   del paciente. El titular del dato no está presente cuando el farmacéutico
--   sube el récipe; registrar algo suyo aquí sería crear un dato personal
--   nuevo sin su conocimiento.
--
-- POR QUÉ NO HAY TABLA EQUIVALENTE PARA EL PACIENTE
--   El paciente no tiene cuenta y la app no lo identifica a propósito.
--   Registrar su consentimiento crearía el ÚNICO rastro persistente de su
--   interacción — justo lo contrario de lo que promete la política de
--   privacidad. Decisión 4 de la spec.
-- ============================================================

BEGIN;

CREATE TABLE consentimientos_recipe (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    farmacia_id  UUID        NOT NULL REFERENCES farmacias(id) ON DELETE CASCADE,
    fecha_hora   TIMESTAMPTZ NOT NULL DEFAULT now(),
    ip_origen    INET
);

COMMENT ON TABLE consentimientos_recipe IS
  'Declaración del farmacéutico al subir un récipe al escáner del panel (hallazgo B-04). No guarda nada del paciente ni de la imagen.';

CREATE INDEX idx_consentimientos_farmacia_fecha
    ON consentimientos_recipe (farmacia_id, fecha_hora DESC);

COMMIT;
```

- [ ] **Step 2: Reflejar la 012 en `db/schema.sql`**

En la sección 10 (TABLAS AÑADIDAS EN MIGRACIONES), antes de la sección 11, pegar el bloque de
`CREATE TABLE`, el `COMMENT` y el `CREATE INDEX` tal cual quedaron en el Step 1, precedido de:

```sql
-- --- Migración 012: registro de declaraciones del escáner (hallazgo B-04) ---
```

Y actualizar la línea de la cabecera `Últimas migraciones incorporadas: 001 – 010 (ver nota)` a
`001 – 012 (ver nota)`.

- [ ] **Step 3: Pedirle a José que aplique la 012**

Requiere su autorización expresa (CLAUDE.md §8). Pedírsela mostrando el archivo. **No aplicarla por
iniciativa propia.** Preferir `apply_migration` sobre `execute_sql` para que quede registrada en el
tracking de Supabase, como se hizo con la 010.

- [ ] **Step 4: Verificar que la tabla existe**

```sql
SELECT (SELECT count(*) FROM pg_tables  WHERE tablename = 'consentimientos_recipe')          AS tabla,
       (SELECT count(*) FROM pg_indexes WHERE indexname = 'idx_consentimientos_farmacia_fecha') AS indice,
       (SELECT count(*) FROM consentimientos_recipe)                                          AS filas;
```

Esperado: `tabla = 1`, `indice = 1`, `filas = 0`.

- [ ] **Step 5: Commit**

```bash
cd /home/josemarrufo/Escritorio/DosisYa-Backend
git add db/migrations/012_consentimientos_recipe.sql db/schema.sql
git commit -m "feat(db): tabla de declaraciones del escáner de récipe (migración 012)"
```

---

## Task 4: Los endpoints exigen el consentimiento

**Files:**
- Modify: `DosisYa-Backend/src/dosisya/routers/ia.py`
- Modify: `DosisYa-Backend/src/dosisya/routers/farmacias.py`
- Test: `DosisYa-Backend/tests/test_ia_consentimiento.py`
- Test: `DosisYa-Backend/tests/test_farmacias_consentimiento.py`

**Interfaces:**
- Consumes: de Task 3 — tabla `consentimientos_recipe`. De Tasks 1 y 2 — los clientes ya mandan `consentimiento` y `declaracion_autorizacion`
- Produces: ambos endpoints responden 422 sin el campo; el de farmacia inserta una fila por subida aceptada

**NO DESPLEGAR ESTA TAREA ANTES QUE LAS TASKS 1 Y 2.** Ver Global Constraints.

- [ ] **Step 1: Escribir los tests fallidos del endpoint del paciente**

Crear `tests/test_ia_consentimiento.py`:

```python
"""
DosisYa — Tests del consentimiento en POST /api/v1/ia/analizar-recipe

Hallazgo B-04: ninguna foto de récipe debe transmitirse sin que quien la sube
haya autorizado explícitamente el envío a un tercero.

El campo `consentimiento` en un endpoint público no es una barrera contra un
cliente malicioso —cualquiera puede mandar true— sino una GUARDA CONTRA NUESTRA
PROPIA REGRESIÓN: si alguien se lleva por delante la pantalla de consentimiento
del frontend, estos 422 lo delatan de inmediato en vez de fallar en silencio.
"""

from __future__ import annotations

import io

import pytest
from fastapi.testclient import TestClient

from dosisya.limiter import limiter
from dosisya.main import app

client = TestClient(app)

ENDPOINT = "/api/v1/ia/analizar-recipe"


@pytest.fixture(autouse=True)
def _reset_rate_limit():
    """Mismo patrón que test_ia_router.py: sin reset, el límite de 5/min se
    agota entre tests y contamina los resultados con 429."""
    limiter.reset()
    yield


_PNG_BYTES = b"\x89PNG\r\n\x1a\n" + b"0" * 100


def _files():
    return {"file": ("recipe.png", io.BytesIO(_PNG_BYTES), "image/png")}


class TestConsentimientoObligatorio:
    def test_sin_el_campo_responde_422(self):
        resp = client.post(ENDPOINT, files=_files())
        assert resp.status_code == 422

    def test_con_el_campo_en_false_responde_422(self):
        resp = client.post(ENDPOINT, files=_files(), data={"consentimiento": "false"})
        assert resp.status_code == 422

    def test_con_el_campo_en_true_no_lo_bloquea_el_consentimiento(self, monkeypatch):
        """Con consentimiento=true el endpoint sigue su curso normal. Se mockea
        Gemini para no llamar a la API real."""

        async def fake_analizar_recipe(imagen_bytes: bytes, mime_type: str):
            return [{"medicamento": "Losartán", "cantidad": "1 caja", "alternativas": []}]

        monkeypatch.setattr("dosisya.routers.ia.analizar_recipe", fake_analizar_recipe)

        resp = client.post(ENDPOINT, files=_files(), data={"consentimiento": "true"})

        assert resp.status_code == 200
        assert resp.json()["status"] == "success"
```

- [ ] **Step 2: Correr los tests y confirmar que fallan**

```bash
cd /home/josemarrufo/Escritorio/DosisYa-Backend
.venv/bin/python -m pytest tests/test_ia_consentimiento.py -v
```

Esperado: los dos primeros fallan (devuelven 200 o 400, no 422) porque el campo todavía no existe.
El tercero pasa desde ya — es la guarda de que exigir el campo no rompe el camino feliz.

- [ ] **Step 3: Exigir el campo en el endpoint del paciente**

En `src/dosisya/routers/ia.py`, añadir `Form` al import de FastAPI:

```python
from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile, status
```

(Si el import ya trae otros nombres, conservarlos y añadir solo `Form`.)

En la firma de `analizar_recipe_endpoint`, añadir el parámetro:

```python
async def analizar_recipe_endpoint(
    request: Request,
    file: UploadFile = File(..., description="Foto del récipe médico"),  # noqa: B008
    consentimiento: bool = Form(  # noqa: B008
        ...,
        description=(
            "El paciente autorizó explícitamente enviar la foto de su récipe a "
            "Gemini. Obligatorio (hallazgo B-04)."
        ),
    ),
) -> RespuestaEstructurada:
```

Y como primera comprobación del cuerpo, antes de validar el MIME:

```python
    # ─── 0. Consentimiento (hallazgo B-04) ───────────────────────────────
    # Sin autorización explícita no se transmite nada a un tercero. En un
    # endpoint público esto no frena a un cliente malicioso: frena una
    # regresión nuestra, que es el riesgo real.
    if not consentimiento:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Falta el consentimiento para enviar la imagen del récipe.",
        )
```

- [ ] **Step 4: Correr los tests y confirmar que pasan**

```bash
.venv/bin/python -m pytest tests/test_ia_consentimiento.py -v
```

Esperado: `3 passed`.

- [ ] **Step 5: Escribir los tests fallidos del endpoint de farmacia**

Crear `tests/test_farmacias_consentimiento.py`:

```python
"""
DosisYa — Tests de la declaración en el escáner de récipe del panel B2B

Hallazgo B-04. A diferencia del escáner del paciente, aquí el titular del dato
NO está presente, así que además de exigir la declaración se registra quién la
hizo y cuándo en `consentimientos_recipe`.
"""

from __future__ import annotations

import io
import uuid

import pytest
from fastapi.testclient import TestClient

from dosisya.limiter import limiter
from dosisya.main import app
from dosisya.security import create_jwt_token

client = TestClient(app)

FARMACIA_ID = str(uuid.uuid4())
ENDPOINT = f"/api/v1/farmacias/{FARMACIA_ID}/ia/analizar-recipe"


@pytest.fixture(autouse=True)
def _reset_rate_limit():
    limiter.reset()
    yield


_PNG_BYTES = b"\x89PNG\r\n\x1a\n" + b"0" * 100


def _files():
    return {"file": ("recipe.png", io.BytesIO(_PNG_BYTES), "image/png")}


def _auth():
    token = create_jwt_token(FARMACIA_ID, rol="admin_farmacia", nombre_farmacia="Farmacia Test")
    return {"Authorization": f"Bearer {token}"}


class TestDeclaracionObligatoria:
    def test_sin_el_campo_responde_422(self):
        resp = client.post(ENDPOINT, files=_files(), headers=_auth())
        assert resp.status_code == 422

    def test_con_el_campo_en_false_responde_422(self):
        resp = client.post(
            ENDPOINT,
            files=_files(),
            data={"declaracion_autorizacion": "false"},
            headers=_auth(),
        )
        assert resp.status_code == 422

    def test_el_422_ocurre_antes_de_tocar_la_base(self):
        """La validación de la declaración va antes del gating por plan y de
        cualquier consulta: sin ella no se hace nada."""
        resp = client.post(ENDPOINT, files=_files(), headers=_auth())
        assert resp.status_code == 422
        assert "declaraci" in resp.json()["detail"].lower()


class TestRegistroDeLaDeclaracion:
    def test_no_se_registra_nada_cuando_la_declaracion_falta(self, monkeypatch):
        """Un 422 no debe dejar rastro: si no se procesa el récipe, no hay
        declaración que registrar."""
        ejecutadas: list[str] = []

        class _Conn:
            async def fetchrow(self, query, *args):
                ejecutadas.append(query)
                return None

            async def execute(self, query, *args):
                ejecutadas.append(query)

        class _Ctx:
            async def __aenter__(self):
                return _Conn()

            async def __aexit__(self, *exc):
                return False

        monkeypatch.setattr("dosisya.routers.farmacias.get_connection", lambda: _Ctx())

        resp = client.post(ENDPOINT, files=_files(), headers=_auth())

        assert resp.status_code == 422
        assert not any("consentimientos_recipe" in q for q in ejecutadas), (
            "se tocó consentimientos_recipe en una petición rechazada"
        )
```

**Por qué no hay un test de "escribe exactamente una fila" con datos reales:** los tests de este
repo mockean la conexión, así que lo máximo verificable aquí es que la query **no** se ejecute
cuando no debe. Que la fila se escriba de verdad se comprueba contra la base en el Step 10. Decir
que un mock prueba la escritura sería el mismo teatro de tests que se descartó en B-03.

- [ ] **Step 6: Correr los tests y confirmar que fallan**

```bash
.venv/bin/python -m pytest tests/test_farmacias_consentimiento.py -v
```

Esperado: los cuatro fallan — sin el campo el endpoint hoy intenta seguir y devuelve 403, 500 o lo
que corresponda, pero no 422.

- [ ] **Step 7: Exigir el campo y registrar la declaración**

En `src/dosisya/routers/farmacias.py`, añadir `Form` al import de FastAPI (conservando lo que ya
importe).

Añadir la constante de la query junto a las demás constantes SQL del módulo:

```python
_INSERT_CONSENTIMIENTO = """
    INSERT INTO consentimientos_recipe (farmacia_id, ip_origen)
    VALUES ($1, $2);
"""
```

En la firma de `analizar_recipe_farmacia_endpoint`, añadir el parámetro:

```python
    declaracion_autorizacion: bool = Form(  # noqa: B008
        ...,
        description=(
            "El farmacéutico declara estar autorizado para procesar este récipe. "
            "Obligatorio (hallazgo B-04). Texto de la declaración pendiente de "
            "revisión legal — ver la spec."
        ),
    ),
```

Como **primera** comprobación del cuerpo, antes de validar el UUID:

```python
    # ─── 0. Declaración del farmacéutico (hallazgo B-04) ────────────────────
    # Va primero a propósito: sin declaración no se hace nada, ni siquiera
    # consultar la base. El titular del dato no está presente aquí.
    if not declaracion_autorizacion:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Falta la declaración de autorización para procesar el récipe.",
        )
```

Y justo después del bloque que valida el plan Premium —es decir, cuando ya se sabe que la subida va
a proceder— registrar la declaración:

```python
    # ─── Registro de la declaración (hallazgo B-04) ─────────────────────────
    # Se escribe dentro de la petición que ya existe: no hace falta endpoint
    # aparte y queda atómico — no se puede escanear sin que quede registrado.
    # No se guarda nada del paciente ni de la imagen.
    try:
        async with get_connection() as conn:
            await conn.execute(_INSERT_CONSENTIMIENTO, farmacia_uuid, client_ip(request))
    except asyncpg.PostgresError as e:
        logger.error("Error al registrar la declaración [farmacia=%s]: %s", farmacia_id, e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error interno al registrar la declaración.",
        ) from e
```

Si `client_ip` no está importado en este módulo, añadir `from dosisya.limiter import client_ip`.

**Este fallo NO es silencioso a propósito.** Si no se puede registrar la declaración, no se procesa
el récipe: el registro es parte de la garantía, no un efecto secundario opcional.

- [ ] **Step 8: Correr los tests y confirmar que pasan**

```bash
.venv/bin/python -m pytest tests/test_farmacias_consentimiento.py -v
```

Esperado: `4 passed`.

- [ ] **Step 9: Correr la suite completa**

```bash
.venv/bin/python -m pytest -q
```

Esperado: `4 failed, 309 passed` — los 4 rojos pre-existentes de
`test_farmacias_inventario_router.py` y ninguno nuevo (302 + 7 de esta tarea: 3 del paciente, 4 de
la farmacia). Si aparece un quinto fallo, es propio.

- [ ] **Step 10: Verificar el registro contra la base real**

Los tests mockean la conexión, así que no comprueban que la fila se escriba de verdad. Con la 012
aplicada, hacer una subida real desde el panel de una farmacia Premium y comprobar:

```sql
SELECT farmacia_id, fecha_hora, ip_origen
FROM consentimientos_recipe
ORDER BY fecha_hora DESC
LIMIT 5;
```

Esperado: una fila nueva por cada subida aceptada, con la `farmacia_id` correcta. Si no hay acceso
a una farmacia Premium para probarlo, **decirlo al cerrar la tarea en vez de darlo por verificado.**

- [ ] **Step 11: Commit**

```bash
git add src/dosisya/routers/ia.py src/dosisya/routers/farmacias.py tests/test_ia_consentimiento.py tests/test_farmacias_consentimiento.py
git commit -m "feat(ia): exige consentimiento para analizar un récipe y registra la declaración"
```

---

## Cierre

Con las cuatro tareas desplegadas **en el orden correcto** (frontend, luego backend), ninguna foto
de récipe sale de un dispositivo sin que quien la sube haya visto qué va a pasar con ella.

### Lo que esto NO cierra

- **B-05b** sigue abierto, y por eso el aviso al paciente es **honesto pero incompleto**: le dice
  que su récipe viaja a Google, no qué hace Google con él. Cuando se resuelva, hay que volver al
  texto del Step 2 de la Task 1 y completarlo.
- **La base legal del caso de la farmacia.** El mecanismo queda listo; el texto de la declaración
  sigue pendiente de abogado.
- **B-04 en su conjunto.** Los textos de términos y privacidad siguen diciendo «Borrador» en
  pantalla, y siguen necesitando entidad legal, plazos de conservación y un canal de contacto —
  que a su vez necesita el dominio.
