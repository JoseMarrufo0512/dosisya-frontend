# Verificación de habilitación sanitaria (B-02, fase 1) — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que una farmacia capture sus datos de habilitación sanitaria (regente + autorización SACS) en el panel, y que el superadmin no pueda aprobarla sin esos datos, sin conflicto de regente único, y confirmando que los verificó.

**Architecture:** El **backend ya está implementado** en el repo `ProyectoDosisYA`, rama `feat/habilitacion-sanitaria` (migración 013 aplicada a prod el 12-oct, el gate de aprobación, los booleanos del listado y la precarga del panel). Este plan es, casi todo, el **frontend** que consume ese contrato, más una tarea backend mínima para exponer el rastro de verificación (§8 de la spec) y el cierre de integración/despliegue de ambos repos.

**Tech Stack:** React 19 + TanStack Start/Router + TypeScript + TailwindCSS 4 + shadcn/ui + Zod + TanStack Query (frontend); FastAPI + asyncpg + PostgreSQL/Supabase (backend). Tests: vitest (frontend, solo lógica — no hay `@testing-library`), pytest (backend).

**Spec:** `docs/superpowers/specs/2026-10-12-verificacion-habilitacion-design.md`

## Global Constraints

- **Cero cambios en el wizard de registro.** Los 6 campos se capturan en **Configuración del panel**, nunca en el registro (spec §6). Registrarse nunca se bloquea.
- **Los 6 campos obligatorios para aprobar, con estos nombres exactos:** `regente_nombre`, `regente_colegiatura`, `regente_colegio_entidad`, `regente_inh`, `sacs_autorizacion`, `sacs_fecha`. Los 4 de verificación (`regente_verificado_por/en`, `sacs_verificado_por/en`) los escribe el sistema, no la farmacia.
- **Opcionales al guardar, obligatorios para aprobar** (spec §4, decisión 2). El `PATCH /api/v1/farmacias/{id}` acepta los 6 como opcionales (COALESCE: omitir conserva); el gate vive solo en la transición a `activa`.
- **La insignia de conflicto no bloquea nada en el frontend** — solo informa. El bloqueo real es el 409 del backend al aprobar.
- `VITE_API_URL` nunca apunta al frontend. Usar `API_BASE` de `src/lib/api.ts`.
- `src/routeTree.gen.ts` es autogenerado: nunca editarlo a mano.
- Verificación mínima antes de commit: `npx tsc --noEmit && npm run build`. Correr `npm test` además (hay 81 tests; esta rama sale de `feat/habilitacion-sanitaria`).

## Contrato backend ya existente (lo que el frontend consume)

Repo `ProyectoDosisYA`, rama `feat/habilitacion-sanitaria`:

- **`GET /api/v1/farmacias/{id}/dashboard`** → `data` incluye los 6 campos para precargar Configuración: `regente_nombre`, `regente_colegiatura`, `regente_colegio_entidad`, `regente_inh`, `sacs_autorizacion`, `sacs_fecha` (ISO `YYYY-MM-DD` o `null`).
- **`PATCH /api/v1/farmacias/{id}`** (`FarmaciaConfigUpdate`) → acepta los 6 (opcionales; `regente_colegiatura` máx 50, `regente_nombre` máx 200, `regente_colegio_entidad` máx 100, `regente_inh` máx 50, `sacs_autorizacion` máx 100, `sacs_fecha` tipo `date`). Omitir un campo conserva el valor.
- **`GET /api/v1/admin/farmacias`** → cada farmacia trae además `habilitacion_completa: boolean` y `conflicto_regente: string | null` (nombre de la otra farmacia `activa` con la misma colegiatura, o `null`).
- **`PATCH /api/v1/admin/farmacias/{id}/estado`** (`CambioEstadoFarmacia`) → además de `estado_afiliacion`, `lat`, `lng`, acepta `verificacion_regente: boolean` y `verificacion_sacs: boolean`. Al pasar a `activa`, en orden:
  - falta cualquiera de los 6 → **422** `"...Faltan: <lista>."`
  - otra farmacia `activa` con esa colegiatura → **409** `"Ese regente ya figura en '<nombre>', que está activa..."`
  - `verificacion_regente` o `verificacion_sacs` no vienen en `true` → **422** `"Confirma haber verificado..."`
  - éxito → sella las 4 columnas de verificación con el superadmin del token y `now()`.
  - Otros estados (`inactiva`, `pendiente`) no exigen nada.

---

## Task 1: Backend — exponer el rastro de verificación en el listado (spec §8)

**Repo:** `ProyectoDosisYA` · **Rama:** `feat/habilitacion-sanitaria`

**Por qué:** la spec §8 pide que el drawer muestre *"quién la hizo y cuándo"* cuando la verificación ya ocurrió. El listado admin hoy solo devuelve `habilitacion_completa` y `conflicto_regente`, no las columnas `*_verificado_*`. Sin esto, el frontend (Task 5) solo puede mostrar casillas, nunca el rastro. Es la única pieza backend que falta.

**Files:**
- Modify: `src/dosisya/routers/admin_super.py` (SELECT `_SELECT_FARMACIAS_ADMIN` ~línea 55-86 y el dict `_fila` ~línea 112-130)
- Test: `tests/test_admin_farmacias_list.py` (o el archivo de tests del listado admin ya existente — localizar con `grep -rl "admin/farmacias" tests/`)

**Interfaces:**
- Produces: en cada farmacia del listado, dos campos nuevos: `verificado_en: str | null` (ISO 8601, `regente_verificado_en`; se sella junto con el de SACS, así que uno basta) y `verificado_por_email: str | null` (email del superadmin que verificó).

- [ ] **Step 1: Escribir el test que falla**

En el archivo de tests del listado admin, añadir (mockeando la conexión como los tests existentes de ese archivo; copiar el patrón de `_FakeConn`/fixture ya presente):

```python
async def test_listado_expone_rastro_de_verificacion(...):
    # fila con regente_verificado_en sellado y un email de superadmin unido
    fila = _fila_fake(
        regente_verificado_en=datetime(2026, 10, 12, 15, 0, tzinfo=timezone.utc),
        verificado_por_email="admin@dosisya.com",
    )
    resp = await listar_farmacias(token_data=_SUPERADMIN)
    f = resp.data["farmacias"][0]
    assert f["verificado_en"] == "2026-10-12T15:00:00+00:00"
    assert f["verificado_por_email"] == "admin@dosisya.com"


async def test_listado_sin_verificar_devuelve_null(...):
    resp = await listar_farmacias(token_data=_SUPERADMIN)
    f = resp.data["farmacias"][0]
    assert f["verificado_en"] is None
    assert f["verificado_por_email"] is None
```

- [ ] **Step 2: Correr el test y verlo fallar**

Run: `PYTHONPATH=src .venv/bin/python -m pytest tests/test_admin_farmacias_list.py -k verificacion -v`
Expected: FAIL con `KeyError: 'verificado_en'`.

- [ ] **Step 3: Implementar**

En `_SELECT_FARMACIAS_ADMIN`, añadir al SELECT (junto a `habilitacion_completa`), con LEFT JOIN a `usuarios` por `f.regente_verificado_por`:

```sql
        f.regente_verificado_en             AS verificado_en,
        uv.email                            AS verificado_por_email,
```
y en el FROM, tras el `LEFT JOIN leads_interacciones ...`:
```sql
    LEFT JOIN usuarios uv ON uv.id = f.regente_verificado_por
```
Añadir `f.regente_verificado_en, uv.email` al `GROUP BY` (o envolver `uv.email` en `MAX(...)` si el GROUP BY por `f.id` se queja; `f.id` es PK así que basta agregar las columnas al GROUP BY).

En `_fila`:
```python
        "verificado_en": r["verificado_en"].isoformat() if r["verificado_en"] else None,
        "verificado_por_email": r["verificado_por_email"],
```

- [ ] **Step 4: Correr el test y verlo pasar**

Run: `PYTHONPATH=src .venv/bin/python -m pytest tests/test_admin_farmacias_list.py -k verificacion -v`
Expected: PASS.

- [ ] **Step 5: Suite completa (confirmar baseline B-17)**

Run: `PYTHONPATH=src .venv/bin/python -m pytest -q -p no:cacheprovider tests`
Expected: los mismos 4 fallos pre-existentes de `test_farmacias_inventario_router.py` (B-17, limiter de slowapi) y el resto en verde. Ningún fallo nuevo.

- [ ] **Step 6: Commit**

```bash
git add src/dosisya/routers/admin_super.py tests/test_admin_farmacias_list.py
git commit -m "feat(admin): el listado expone el rastro de verificación (quién/cuándo) para B-02"
```

---

## Task 2: Frontend — capa API (tipos, confirmaciones y mensajes de error)

**Repo:** `dosisya-frontend` · **Rama:** este plan se ejecuta sobre `feat/habilitacion-sanitaria`

**Files:**
- Modify: `src/lib/adminApi.ts` (`FarmaciaAdmin` ~línea 5-20; `cambiarEstadoFarmacia` ~línea 132-143)
- Modify: `src/lib/dashboardFarmacia.ts` (`DashboardFarmaciaData` ~línea 31-40)
- Test: `src/lib/adminApi.test.ts` (ya existe)

**Interfaces:**
- Produces:
  - `FarmaciaAdmin` gana `habilitacion_completa?: boolean`, `conflicto_regente?: string | null`, `verificado_en?: string | null`, `verificado_por_email?: string | null`.
  - `DashboardFarmaciaData` gana los 6 campos opcionales (`regente_nombre?`, `regente_colegiatura?`, `regente_colegio_entidad?`, `regente_inh?`, `sacs_autorizacion?`, `sacs_fecha?`), todos `string`.
  - `cambiarEstadoFarmacia(token, id, estado, opts?)` donde `opts?: { coords?: {lat:number;lng:number}; verificacionRegente?: boolean; verificacionSacs?: boolean }`. Lanza `Error` con el **mensaje del backend** (el `detail`/`message`) cuando la respuesta no es ok, para que el drawer pueda mostrar el 422/409 textual.

- [ ] **Step 1: Escribir el test que falla**

En `src/lib/adminApi.test.ts`, añadir (mockeando `fetch` como los tests existentes de ese archivo):

```ts
describe("cambiarEstadoFarmacia — B-02", () => {
  it("manda las confirmaciones de verificación en el body", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ status: "success", data: {} }), { status: 200 }),
    );
    await cambiarEstadoFarmacia("tok", "id-1", "activa", {
      verificacionRegente: true,
      verificacionSacs: true,
    });
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body).toMatchObject({
      estado_afiliacion: "activa",
      verificacion_regente: true,
      verificacion_sacs: true,
    });
  });

  it("propaga el mensaje del backend en el error (422/409)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ status: "error", message: "Faltan: regente_inh, sacs_fecha." }),
        { status: 422 },
      ),
    );
    await expect(
      cambiarEstadoFarmacia("tok", "id-1", "activa", { verificacionRegente: true, verificacionSacs: true }),
    ).rejects.toThrow(/Faltan: regente_inh/);
  });
});
```

- [ ] **Step 2: Correr y ver fallar**

Run: `npm test -- adminApi`
Expected: FAIL (la firma vieja ignora `verificacion*` y el error es genérico).

- [ ] **Step 3: Implementar**

En `src/lib/adminApi.ts`, extender el tipo:

```ts
export interface FarmaciaAdmin {
  // ...campos existentes...
  ubicacion_configurada?: boolean;
  /** B-02: los 6 campos de habilitación presentes. */
  habilitacion_completa?: boolean;
  /** B-02: nombre de otra farmacia activa con el mismo regente, o null. */
  conflicto_regente?: string | null;
  /** B-02: ISO del sellado de verificación (null si no verificada). */
  verificado_en?: string | null;
  /** B-02: email del superadmin que verificó, o null. */
  verificado_por_email?: string | null;
}
```

Reemplazar `cambiarEstadoFarmacia`:

```ts
export async function cambiarEstadoFarmacia(
  token: string,
  id: string,
  estado: EstadoAfiliacion,
  opts?: {
    coords?: { lat: number; lng: number };
    verificacionRegente?: boolean;
    verificacionSacs?: boolean;
  },
): Promise<void> {
  const res = await adminFetch(`/api/v1/admin/farmacias/${id}/estado`, token, {
    method: "PATCH",
    body: JSON.stringify({
      estado_afiliacion: estado,
      ...(opts?.coords ?? {}),
      ...(opts?.verificacionRegente !== undefined ? { verificacion_regente: opts.verificacionRegente } : {}),
      ...(opts?.verificacionSacs !== undefined ? { verificacion_sacs: opts.verificacionSacs } : {}),
    }),
  });
  if (!res.ok) {
    // El 422/409 del gate de B-02 trae el detalle en `message` (envelope) o `detail`.
    const json = await res.json().catch(() => null);
    throw new Error(json?.message || json?.detail || "No se pudo cambiar el estado");
  }
}
```

En `src/lib/dashboardFarmacia.ts`, añadir a `DashboardFarmaciaData`:

```ts
  regente_nombre?: string;
  regente_colegiatura?: string;
  regente_colegio_entidad?: string;
  regente_inh?: string;
  sacs_autorizacion?: string;
  sacs_fecha?: string; // ISO YYYY-MM-DD
```

- [ ] **Step 4: Actualizar los call-sites existentes de `cambiarEstadoFarmacia`**

La firma cambió de `(token, id, estado, coords?)` a `(token, id, estado, opts?)`. Buscar y migrar:
Run: `grep -rn "cambiarEstadoFarmacia(" src/ --include=*.tsx --include=*.ts | grep -v adminApi`
En cada llamada que pasaba `coords` como 4º argumento, envolverlo: `cambiarEstadoFarmacia(t, id, e, coords)` → `cambiarEstadoFarmacia(t, id, e, { coords })`.

- [ ] **Step 5: Correr y ver pasar + tsc**

Run: `npm test -- adminApi && npx tsc --noEmit`
Expected: PASS y tsc exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/lib/adminApi.ts src/lib/dashboardFarmacia.ts src/lib/adminApi.test.ts
git commit -m "feat(b-02): capa API expone habilitación y pasa confirmaciones de verificación"
```

---

## Task 3: Frontend — formulario de habilitación en Configuración del panel

**Repo:** `dosisya-frontend` · **Rama:** `feat/habilitacion-sanitaria`

**Por qué:** es donde la farmacia captura los 6 campos (spec §6). El componente `ConfiguracionSection` de `admin.dashboard.tsx` ya edita `whatsapp`/`sector`/`punto_referencia` y hace `PATCH /api/v1/farmacias/{id}` — se añaden los 6 campos siguiendo ese mismo patrón.

**Files:**
- Modify: `src/routes/admin.dashboard.tsx` (`ConfiguracionSection` ~línea 827; esquema zod de config ~línea 810; estado inicial ~839-841; `useEffect` de precarga ~860-862; body del PATCH ~874-876; JSX de inputs ~986+)

**Interfaces:**
- Consumes: `DashboardFarmaciaData` con los 6 campos (Task 2).

- [ ] **Step 1: Extender el esquema zod de Configuración**

Junto al esquema existente (~línea 810), añadir los 6 campos como **opcionales** (guardar nunca se bloquea por faltar uno; el gate vive en el backend al aprobar). `sacs_fecha` validada como fecha ISO:

```ts
  regente_nombre: z.string().max(200).optional().or(z.literal("")),
  regente_colegiatura: z.string().max(50).optional().or(z.literal("")),
  regente_colegio_entidad: z.string().max(100).optional().or(z.literal("")),
  regente_inh: z.string().max(50).optional().or(z.literal("")),
  sacs_autorizacion: z.string().max(100).optional().or(z.literal("")),
  sacs_fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida").optional().or(z.literal("")),
```

- [ ] **Step 2: Estado + precarga**

Añadir `useState` para los 6 (vacío por defecto), espejando `whatsapp`/`sector`/`referencia`:

```ts
  const [regenteNombre, setRegenteNombre] = useState(data?.regente_nombre ?? "");
  const [regenteColegiatura, setRegenteColegiatura] = useState(data?.regente_colegiatura ?? "");
  const [regenteColegioEntidad, setRegenteColegioEntidad] = useState(data?.regente_colegio_entidad ?? "");
  const [regenteInh, setRegenteInh] = useState(data?.regente_inh ?? "");
  const [sacsAutorizacion, setSacsAutorizacion] = useState(data?.sacs_autorizacion ?? "");
  const [sacsFecha, setSacsFecha] = useState(data?.sacs_fecha ?? "");
```
Y en el `useEffect` de precarga (~860), añadir los seis `setX(data.campo ?? "")`.

- [ ] **Step 3: Incluir los 6 en el body del PATCH**

En el objeto que se manda (~874), añadir los 6. Enviar `undefined` cuando el campo esté vacío para no sobreescribir con `""` (el backend hace COALESCE sobre `null`, así que mandar el valor o no mandarlo):

```ts
      regente_nombre: regenteNombre || undefined,
      regente_colegiatura: regenteColegiatura || undefined,
      regente_colegio_entidad: regenteColegioEntidad || undefined,
      regente_inh: regenteInh || undefined,
      sacs_autorizacion: sacsAutorizacion || undefined,
      sacs_fecha: sacsFecha || undefined,
```

- [ ] **Step 4: JSX de los inputs**

Tras el bloque de `punto_referencia` en el JSX (~línea 1000), añadir una subsección "Habilitación sanitaria" con los 6 `Label`+`Input` (mirar el patrón exacto de `cfg-whatsapp` en ~986). `sacs_fecha` usa `<Input type="date">`. Incluir una nota breve de ayuda: *"Estos datos son obligatorios para que tu farmacia aparezca en el buscador. Puedes guardarlos ahora y completarlos después."* Ejemplo de un campo:

```tsx
<div>
  <Label htmlFor="cfg-regente-colegiatura">N.º de colegiatura del regente</Label>
  <Input
    id="cfg-regente-colegiatura"
    value={regenteColegiatura}
    onChange={(e) => setRegenteColegiatura(e.target.value)}
    maxLength={50}
    aria-invalid={Boolean(fieldErrors.regente_colegiatura)}
  />
</div>
```
(repetir para los otros cinco con sus `id`/`label`/`maxLength` correctos; `sacs-fecha` con `type="date"`).

- [ ] **Step 5: Verificar en navegador**

Run: `npx tsc --noEmit && npm run build`
Luego, con la skill de preview (o `preview_start`), abrir el panel → Configuración, confirmar: los 6 campos se precargan desde el dashboard, se guardan (PATCH 200), y al recargar persisten. (No hay tests de componente: `@testing-library` no está — spec §9.)

- [ ] **Step 6: Commit**

```bash
git add src/routes/admin.dashboard.tsx
git commit -m "feat(b-02): la farmacia captura regente y SACS en Configuración del panel"
```

---

## Task 4: Frontend — insignias de habilitación en la tabla del superadmin

**Repo:** `dosisya-frontend` · **Rama:** `feat/habilitacion-sanitaria`

**Files:**
- Modify: `src/components/super/TablaFarmacias.tsx` (render de badges junto a `ubicacion_configurada` ~línea 309; conteo opcional ~línea 90)

**Interfaces:**
- Consumes: `FarmaciaAdmin.habilitacion_completa`, `FarmaciaAdmin.conflicto_regente` (Task 2).

- [ ] **Step 1: Añadir las insignias**

Junto al badge de `f.ubicacion_configurada === false` (~línea 309), añadir, con el mismo patrón de badge ámbar/rojo que ya usa el archivo:

```tsx
{f.habilitacion_completa === false && (
  <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
    Sin habilitación
  </span>
)}
{f.conflicto_regente && (
  <span
    className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800"
    title={`Mismo regente que ${f.conflicto_regente}`}
  >
    Regente duplicado
  </span>
)}
```
(ajustar las clases exactas al patrón que el archivo ya use para `ubicacion_configurada`; reutilizar ese estilo, no inventar uno nuevo.)

- [ ] **Step 2: Verificar en navegador + tsc**

Run: `npx tsc --noEmit && npm run build`
En el navegador, con el superadmin: una farmacia sin los 6 campos muestra "Sin habilitación"; dos `activa` con el mismo regente muestran "Regente duplicado" con el nombre en el tooltip.

- [ ] **Step 3: Commit**

```bash
git add src/components/super/TablaFarmacias.tsx
git commit -m "feat(b-02): la tabla del superadmin marca habilitación y conflicto de regente"
```

---

## Task 5: Frontend — confirmaciones de verificación en el drawer del superadmin

**Repo:** `dosisya-frontend` · **Rama:** `feat/habilitacion-sanitaria`

**Por qué:** es donde el superadmin aprueba (cambia a `activa`). Spec §8: dos casillas separadas que condicionan "Aprobar"; si ya se verificó, mostrar quién y cuándo en vez de las casillas; y mostrar el 422/409 del backend de forma legible.

**Files:**
- Modify: `src/components/super/EditarFarmaciaDrawer.tsx` (estado + submit que llama a `cambiarEstadoFarmacia`; UI de coords ya existe ~línea 56-184)

**Interfaces:**
- Consumes: `cambiarEstadoFarmacia(..., { coords, verificacionRegente, verificacionSacs })` y los campos `habilitacion_completa`, `conflicto_regente`, `verificado_en`, `verificado_por_email` de `FarmaciaAdmin` (Task 2).

- [ ] **Step 1: Estado de las dos casillas**

```ts
const [verifRegente, setVerifRegente] = useState(false);
const [verifSacs, setVerifSacs] = useState(false);
```
Resetearlas a `false` cuando el drawer se abre/cambia de farmacia (en el `useEffect` que ya resetea `lat`/`lng`, ~línea 56).

- [ ] **Step 2: UI condicional (solo relevante al aprobar)**

Mostrar el bloque de verificación **solo cuando el estado objetivo sea `activa`** y la farmacia no esté ya verificada. Si `farmacia.verificado_en` ya tiene valor, mostrar en su lugar una línea de rastro:

```tsx
{farmacia.verificado_en ? (
  <p className="text-xs text-muted-foreground">
    Verificada el {new Date(farmacia.verificado_en).toLocaleDateString("es-VE")}
    {farmacia.verificado_por_email ? ` por ${farmacia.verificado_por_email}` : ""}.
  </p>
) : (
  <fieldset className="mt-3 space-y-2">
    <label className="flex items-start gap-2 text-sm">
      <input type="checkbox" checked={verifRegente} onChange={(e) => setVerifRegente(e.target.checked)} className="mt-0.5" />
      <span>Verifiqué la colegiatura del regente en el Colegio de Farmacéuticos / INH.</span>
    </label>
    <label className="flex items-start gap-2 text-sm">
      <input type="checkbox" checked={verifSacs} onChange={(e) => setVerifSacs(e.target.checked)} className="mt-0.5" />
      <span>Verifiqué la autorización de funcionamiento del SACS.</span>
    </label>
    {farmacia.conflicto_regente && (
      <p className="text-xs text-red-700">
        Este regente ya figura en «{farmacia.conflicto_regente}», que está activa. Suspéndela antes de aprobar esta.
      </p>
    )}
  </fieldset>
)}
```

- [ ] **Step 3: Gate del botón Aprobar + envío de las confirmaciones**

El botón que pasa a `activa` queda `disabled` si `!(verifRegente && verifSacs)` (y la farmacia no está ya verificada). En el submit, pasar las confirmaciones:

```ts
await cambiarEstadoFarmacia(token, farmacia.id, "activa", {
  coords, // el que ya se calcula
  verificacionRegente: verifRegente,
  verificacionSacs: verifSacs,
});
```
Las casillas solo gobiernan el flujo de `activa`; suspender o devolver a `pendiente` no las toca.

- [ ] **Step 4: Mostrar el error del backend**

El `catch` del submit debe pintar `error.message` (ahora trae el texto del 422/409 gracias a Task 2) — por ejemplo en un `toast.error(e.message)` o en el área de error del drawer. Así "Faltan: regente_inh, sacs_fecha." o "Ese regente ya figura en 'X'..." llegan al superadmin tal cual.

- [ ] **Step 5: Verificar en navegador + tsc**

Run: `npx tsc --noEmit && npm run build`
En el navegador: aprobar sin marcar las casillas → botón deshabilitado; aprobar una farmacia sin los 6 campos → toast con "Faltan: ...". Aprobar una con regente ya activo en otra → toast con el 409. Aprobar una completa y verificada → éxito y, al reabrir, muestra el rastro.

- [ ] **Step 6: Commit**

```bash
git add src/components/super/EditarFarmaciaDrawer.tsx
git commit -m "feat(b-02): el superadmin confirma verificación de regente y SACS antes de aprobar"
```

---

## Task 6: Integración, verificación y despliegue

**Repos:** ambos.

- [ ] **Step 1: Verificación frontend completa**

Run: `npx tsc --noEmit && npm run build && npm test`
Expected: tsc 0, build OK, 81 tests (+ los nuevos de `adminApi`) en verde.

- [ ] **Step 2: Verificación backend (si se hizo Task 1)**

En `ProyectoDosisYA`, worktree limpio de la rama: `PYTHONPATH=src .venv/bin/python -m pytest -q -p no:cacheprovider tests`
Expected: solo los 4 fallos pre-existentes de B-17; nada nuevo.

- [ ] **Step 3: Orden de despliegue (crítico)**

La migración 013 **ya está aplicada en prod**. El orden es:
1. **Backend primero** (merge de `feat/habilitacion-sanitaria` en `ProyectoDosisYA`, incluida Task 1). El frontend viejo contra el backend nuevo sigue funcionando: los campos de habilitación quedan vacíos y el gate solo afecta al aprobar.
2. **Frontend después** (merge de `feat/habilitacion-sanitaria` en `dosisya-frontend`).
   - El frontend nuevo contra el backend viejo también degrada sin romper: los tipos nuevos son opcionales, las insignias no aparecen y las confirmaciones viajan como campos que el backend viejo ignora.
   - Verificar el deploy de Vercel en estado READY antes de dar por hecho el despliegue (SSR: una portada 200 no garantiza que el resto del SSR esté sano).

- [ ] **Step 4: Verificación en producción**

- Panel de una farmacia de prueba: guardar los 6 campos → recargar → persisten.
- `GET /api/v1/admin/farmacias` (como superadmin) devuelve `habilitacion_completa` y `conflicto_regente`.
- **Caso que distingue el diseño (spec §9):** dos farmacias `pendiente` con la misma colegiatura coexisten; la segunda solo falla (409) al intentar pasarla a `activa`.
- Recordatorio operativo: las 8 farmacias ya `activa` quedaron bajo el gate 422 por la 013 — no podrán reaprobarse sin los 6 datos. Decidir si se cargan sus datos de regente/SACS o se tratan aparte (es gestión, no código).

---

## Fuera de alcance (spec §10, §11)

- **Los documentos (PDF del contrato del regente, permiso SACS).** Fase 2, spec propia (proveedor de almacenamiento, acceso y retención de datos de un tercero). No hay infraestructura de archivos en el backend.
- **Verificación automática contra el Colegio o el SACS** (no se conoce API pública).
- **Cambios en el wizard de registro.**

B-02 sigue abierto hasta la fase 2: la verificación de fase 1 es **declarativa** (el superadmin confirma que contrastó; no se prueba documentalmente).
