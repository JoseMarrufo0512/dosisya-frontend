# Quitar/Reformular Medicamentos del Escáner — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir quitar o corregir manualmente un medicamento mal leído por el escáner de récipe antes de añadirlo al carrito, y dejar explícito (para el paciente y para el farmacéutico) que el resultado es generado por IA y debe verificarse.

**Architecture:** Cambios exclusivamente en `DosisYa-Frontend`. Cada medicamento detectado recibe un `id` estable de sesión (reemplaza el índice de array usado hoy como key/estado), lo que permite quitar ítems sin desalinear qué alternativas están expandidas. "Reformular" es edición manual en línea (el usuario escribe lo que ve en la receta física) — nunca una inferencia de la IA. Un banner de aviso se muestra siempre en resultados; una nota condicional se añade al mensaje de WhatsApp cuando el pedido incluye ítems del escáner.

**Tech Stack:** React 19 + TypeScript, lucide-react (iconos), sin dependencias nuevas. Sin framework de tests en este repo — verificación vía `npx tsc --noEmit && npm run build` + prueba manual en navegador (mismo patrón usado en el plan anterior de este repo).

**Spec:** `docs/superpowers/specs/2026-07-14-quitar-reformular-recipe-design.md` (aprobado 2026-07-14).

## Global Constraints

- **Sin framework de tests:** cada task se verifica con `npx tsc --noEmit && npm run build` (ambos deben pasar) + los pasos manuales descritos en cada task. Regla del repo: los builds de Vercel se rompieron dos veces por saltarse esto.
- **Contrato del backend intacto:** `analizarRecipe()` en `recipeIA.ts` sigue devolviendo `MedicamentoReceta[]` (sin `id`) — el `id` se añade en el componente al recibir la respuesta, no en la capa de red.
- **REGLA MÉDICA (invariante):** al reformular, `alternativas` se limpia a `[]` — **nunca** se vuelve a llamar al backend/Gemini para pedir nuevas alternativas de un texto que el usuario tecleó. La corrección viene de lo que el usuario observa en la receta física, jamás de una inferencia de la IA basada en síntomas o en los otros medicamentos del récipe.
- **Dos sistemas de ID distintos, no unificar:** `recipeId(nombre)` (existente, deriva del nombre, se usa para comparar contra el carrito vía `estaEnLista`) vs. el nuevo `id: string` (UUID, de sesión de escaneo, solo para `key` de React y para saber qué ítem está en modo edición).
- **Iconos:** usar `lucide-react` (ya importado en el archivo) para los elementos estructurales nuevos — `Pencil` (reformular), `Trash2` (quitar), `AlertTriangle` (banner). No usar emoji para estos tres; los emoji ya existentes en badges (`📋 Receta`, `🤖 Alternativa IA`) no se tocan.
- **Un solo ítem editable a la vez** (`editandoId: string | null`).
- **Nota al farmacéutico:** se añade al mensaje de WhatsApp siempre que **algún** ítem del pedido tenga `origen === "escaner_recipe"` — sin importar si el usuario reformuló algo o no.
- Archivos afectados: `src/lib/recipeIA.ts`, `src/components/EscanerRecipe.tsx`, `src/lib/whatsapp.ts`. No se toca el backend ni el contrato HTTP.

---

### Task 1: IDs estables (`MedicamentoRecetaUI`)

**Files:**
- Modify: `src/lib/recipeIA.ts:19-33`
- Modify: `src/components/EscanerRecipe.tsx` (import, estado, `procesarImagen`, `toggleAlternativas`, JSX del `map`)

**Interfaces:**
- Consumes: nada nuevo (primera task).
- Produces: `MedicamentoRecetaUI` (exportado desde `recipeIA.ts`) — `{ medicamento: string; cantidad: string; alternativas: string[]; id: string }`. Usado por todas las tasks siguientes como el tipo de `resultados`.

Este task es un refactor puro — no cambia comportamiento visible. Se verifica con `tsc`+`build` y confirmando manualmente que el flujo de escaneo (mock) sigue funcionando igual que antes (expandir/colapsar alternativas).

- [ ] **Step 1: Añadir el tipo `MedicamentoRecetaUI` en `recipeIA.ts`**

En `src/lib/recipeIA.ts`, reemplazar:

```ts
export interface MedicamentoReceta {
  /** Nombre del principio activo o marca detectada (ej: "Losartán") */
  medicamento: string;
  /** Cantidad recetada (ej: "2 cajas", "30 tabletas") */
  cantidad: string;
  /** Alternativas sugeridas por principio activo (pueden ser 0..N) */
  alternativas: string[];
}

/** Respuesta envuelta del endpoint POST /api/v1/ia/analizar-recipe */
```

por:

```ts
export interface MedicamentoReceta {
  /** Nombre del principio activo o marca detectada (ej: "Losartán") */
  medicamento: string;
  /** Cantidad recetada (ej: "2 cajas", "30 tabletas") */
  cantidad: string;
  /** Alternativas sugeridas por principio activo (pueden ser 0..N) */
  alternativas: string[];
}

/**
 * Medicamento extraído del récipe, enriquecido con un ID estable de sesión
 * de escaneo (no persiste, no viene del backend) — usado como `key` de React
 * y para rastrear qué ítem está en modo edición. No confundir con el ID
 * derivado del nombre (`recipeId()` en EscanerRecipe.tsx), que se usa para
 * comparar contra el carrito.
 */
export interface MedicamentoRecetaUI extends MedicamentoReceta {
  id: string;
}

/** Respuesta envuelta del endpoint POST /api/v1/ia/analizar-recipe */
```

- [ ] **Step 2: Actualizar el import en `EscanerRecipe.tsx`**

Reemplazar:

```ts
import { analizarRecipe, validarImagen, type MedicamentoReceta } from "@/lib/recipeIA";
```

por:

```ts
import { analizarRecipe, validarImagen, type MedicamentoRecetaUI } from "@/lib/recipeIA";
```

- [ ] **Step 3: Cambiar los tipos de estado**

Reemplazar:

```ts
  const [resultados, setResultados] = useState<MedicamentoReceta[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [expandidos, setExpandidos] = useState<Set<number>>(new Set());
```

por:

```ts
  const [resultados, setResultados] = useState<MedicamentoRecetaUI[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());
```

- [ ] **Step 4: Generar el `id` al recibir la respuesta**

En `procesarImagen`, reemplazar:

```ts
      if (respuesta.status === "success" && respuesta.data && respuesta.data.length > 0) {
        setResultados(respuesta.data);
        setEstado("results");
      } else {
```

por:

```ts
      if (respuesta.status === "success" && respuesta.data && respuesta.data.length > 0) {
        const conId: MedicamentoRecetaUI[] = respuesta.data.map((med) => ({
          ...med,
          id: crypto.randomUUID(),
        }));
        setResultados(conId);
        setEstado("results");
      } else {
```

- [ ] **Step 5: Cambiar `toggleAlternativas` a string**

Reemplazar:

```ts
  const toggleAlternativas = (idx: number) => {
    setExpandidos((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };
```

por:

```ts
  const toggleAlternativas = (id: string) => {
    setExpandidos((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
```

- [ ] **Step 6: Usar `med.id` en el `map` de resultados**

Reemplazar:

```tsx
                  {resultados.map((med, idx) => {
                    const enLista = estaEnLista(recipeId(med.medicamento));
                    const altExpandidas = expandidos.has(idx);

                    return (
                      <li key={idx} className="py-3.5">
```

por:

```tsx
                  {resultados.map((med) => {
                    const enLista = estaEnLista(recipeId(med.medicamento));
                    const altExpandidas = expandidos.has(med.id);

                    return (
                      <li key={med.id} className="py-3.5">
```

Y, dentro del bloque de alternativas del mismo `<li>`, reemplazar:

```tsx
                              onClick={() => toggleAlternativas(idx)}
```

por:

```tsx
                              onClick={() => toggleAlternativas(med.id)}
```

- [ ] **Step 7: Verificar tipos y build**

Run: `npx tsc --noEmit && npm run build`
Expected: sin errores (client + SSR compilan limpio).

- [ ] **Step 8: Verificación manual**

Con `npm run dev` corriendo: abrir el escáner de récipe (mock activo por defecto en DEV), escanear cualquier imagen, confirmar que aparecen los 3 medicamentos del mock (Losartán, Metformina, Atorvastatina) y que expandir/colapsar "alternativas" en cualquiera de ellos sigue funcionando igual que antes.

- [ ] **Step 9: Commit**

```bash
git add src/lib/recipeIA.ts src/components/EscanerRecipe.tsx
git commit -m "refactor(recipe): IDs estables por medicamento (MedicamentoRecetaUI)"
```

---

### Task 2: Botón "Quitar"

**Files:**
- Modify: `src/components/EscanerRecipe.tsx` (import de icono, handler, JSX)

**Interfaces:**
- Consumes (Task 1): `MedicamentoRecetaUI`, `resultados: MedicamentoRecetaUI[]`, `med.id`.
- Produces: `quitarMedicamento(id: string): void` — usado por el botón de esta task; no lo consume ninguna task posterior directamente, pero establece el patrón de mutación de `resultados` por `id`.

- [ ] **Step 1: Importar el icono `Trash2`**

Reemplazar:

```ts
import {
  Camera,
  ScanLine,
  Sparkles,
  Plus,
  CheckCircle2,
  RotateCcw,
  MessageCircle,
  ChevronDown,
  ChevronUp,
  ImageOff,
} from "lucide-react";
```

por:

```ts
import {
  Camera,
  ScanLine,
  Sparkles,
  Plus,
  CheckCircle2,
  RotateCcw,
  MessageCircle,
  ChevronDown,
  ChevronUp,
  ImageOff,
  Trash2,
} from "lucide-react";
```

- [ ] **Step 2: Añadir el handler `quitarMedicamento`**

Reemplazar:

```ts
    toast.success(`${añadidos} medicamentos añadidos a tu lista`, {
      style: { background: "#ecfdf5", color: "#065f46", borderColor: "#a7f3d0" },
    });
  };

  // ── Toggle alternativas ──────────────────────────────────────────────────
```

por:

```ts
    toast.success(`${añadidos} medicamentos añadidos a tu lista`, {
      style: { background: "#ecfdf5", color: "#065f46", borderColor: "#a7f3d0" },
    });
  };

  // ── Quitar medicamento ───────────────────────────────────────────────────

  const quitarMedicamento = (id: string) => {
    setResultados((prev) => prev.filter((m) => m.id !== id));
  };

  // ── Toggle alternativas ──────────────────────────────────────────────────
```

- [ ] **Step 3: Añadir el botón en la fila de acciones**

Reemplazar el bloque completo de acciones del medicamento (desde `<div className="flex items-start gap-3">` hasta el `</div>` que cierra ese contenedor, antes del comentario `{/* Alternativas */}`):

```tsx
                        <div className="flex items-start gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-foreground">{med.medicamento}</p>
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800">
                                📋 Receta
                              </span>
                            </div>
                            {med.cantidad && (
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                Cantidad: {med.cantidad}
                              </p>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => handleAgregarMedicamento(med.medicamento, med.cantidad)}
                            className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all active:scale-[0.97] ${
                              enLista
                                ? "border border-emerald-300 bg-emerald-50 text-emerald-700"
                                : "bg-primary text-primary-foreground hover:opacity-90"
                            }`}
                          >
                            {enLista ? (
                              <>
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                En lista
                              </>
                            ) : (
                              <>
                                <Plus className="h-3.5 w-3.5" />
                                Añadir
                              </>
                            )}
                          </button>
                        </div>
```

por:

```tsx
                        <div className="flex items-start gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-foreground">{med.medicamento}</p>
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800">
                                📋 Receta
                              </span>
                            </div>
                            {med.cantidad && (
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                Cantidad: {med.cantidad}
                              </p>
                            )}
                          </div>

                          <div className="flex shrink-0 items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => quitarMedicamento(med.id)}
                              aria-label={`Quitar ${med.medicamento} de los resultados`}
                              className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-red-600"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleAgregarMedicamento(med.medicamento, med.cantidad)}
                              className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all active:scale-[0.97] ${
                                enLista
                                  ? "border border-emerald-300 bg-emerald-50 text-emerald-700"
                                  : "bg-primary text-primary-foreground hover:opacity-90"
                              }`}
                            >
                              {enLista ? (
                                <>
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  En lista
                                </>
                              ) : (
                                <>
                                  <Plus className="h-3.5 w-3.5" />
                                  Añadir
                                </>
                              )}
                            </button>
                          </div>
                        </div>
```

- [ ] **Step 4: Verificar tipos y build**

Run: `npx tsc --noEmit && npm run build`
Expected: sin errores.

- [ ] **Step 5: Verificación manual — el caso central de este plan**

Con `npm run dev`: escanear (mock) → **expandir las alternativas de Metformina** (2º ítem) → **quitar Losartán** (1er ítem, botón papelera) → confirmar que Losartán desaparece de la lista Y que las alternativas de Metformina **siguen expandidas correctamente** (no se desalinean con Atorvastatina). Esto prueba que el arreglo de IDs estables del Task 1 realmente evita el bug de desalineación por índice.

- [ ] **Step 6: Commit**

```bash
git add src/components/EscanerRecipe.tsx
git commit -m "feat(recipe): botón para quitar un medicamento mal detectado"
```

---

### Task 3: Botón "Reformular" + edición en línea

**Files:**
- Modify: `src/components/EscanerRecipe.tsx` (import de icono, estado, handlers, reset en `handleOpenChange`/`volverAIdle`, JSX)

**Interfaces:**
- Consumes (Task 1): `MedicamentoRecetaUI`. (Task 2): patrón de `setResultados` por `id`, botón de acciones ya envuelto en `<div className="flex shrink-0 items-center gap-1.5">`.
- Produces: `editandoId: string | null`, `iniciarReformular(med: MedicamentoRecetaUI): void`, `cancelarReformular(): void`, `guardarReformular(): void`. No consumidos por tasks posteriores (Task 4 y 5 son independientes).

- [ ] **Step 1: Importar el icono `Pencil`**

Reemplazar:

```ts
import {
  Camera,
  ScanLine,
  Sparkles,
  Plus,
  CheckCircle2,
  RotateCcw,
  MessageCircle,
  ChevronDown,
  ChevronUp,
  ImageOff,
  Trash2,
} from "lucide-react";
```

por:

```ts
import {
  Camera,
  ScanLine,
  Sparkles,
  Plus,
  CheckCircle2,
  RotateCcw,
  MessageCircle,
  ChevronDown,
  ChevronUp,
  ImageOff,
  Trash2,
  Pencil,
} from "lucide-react";
```

- [ ] **Step 2: Añadir el estado de edición**

Reemplazar:

```ts
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());
  const { agregar, estaEnLista } = useListaMedica();
```

por:

```ts
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [borradorMedicamento, setBorradorMedicamento] = useState("");
  const [borradorCantidad, setBorradorCantidad] = useState("");
  const { agregar, estaEnLista } = useListaMedica();
```

- [ ] **Step 3: Resetear `editandoId` al abrir el drawer**

Reemplazar:

```ts
  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (open) {
        setEstado("idle");
        setPreviewUrl(null);
        setResultados([]);
        setErrorMsg("");
        setExpandidos(new Set());
      }
      onOpenChange(open);
    },
    [onOpenChange],
  );
```

por:

```ts
  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (open) {
        setEstado("idle");
        setPreviewUrl(null);
        setResultados([]);
        setErrorMsg("");
        setExpandidos(new Set());
        setEditandoId(null);
      }
      onOpenChange(open);
    },
    [onOpenChange],
  );
```

- [ ] **Step 4: Resetear `editandoId` en `volverAIdle`**

Reemplazar:

```ts
  const volverAIdle = () => {
    setEstado("idle");
    setPreviewUrl(null);
    setResultados([]);
    setErrorMsg("");
    setExpandidos(new Set());
  };
```

por:

```ts
  const volverAIdle = () => {
    setEstado("idle");
    setPreviewUrl(null);
    setResultados([]);
    setErrorMsg("");
    setExpandidos(new Set());
    setEditandoId(null);
  };
```

- [ ] **Step 5: Añadir los handlers de reformulación**

Reemplazar:

```ts

  // ── Quitar medicamento ───────────────────────────────────────────────────

  const quitarMedicamento = (id: string) => {
    setResultados((prev) => prev.filter((m) => m.id !== id));
  };

  // ── Toggle alternativas ──────────────────────────────────────────────────
```

por:

```ts

  // ── Quitar medicamento ───────────────────────────────────────────────────

  const quitarMedicamento = (id: string) => {
    setResultados((prev) => prev.filter((m) => m.id !== id));
  };

  // ── Reformular medicamento ───────────────────────────────────────────────
  // Corrección manual del usuario (lo que ÉL ve en la receta física) — NUNCA
  // una inferencia de la IA a partir de síntomas u otros medicamentos.

  const iniciarReformular = (med: MedicamentoRecetaUI) => {
    setEditandoId(med.id);
    setBorradorMedicamento(med.medicamento);
    setBorradorCantidad(med.cantidad);
  };

  const cancelarReformular = () => {
    setEditandoId(null);
  };

  const guardarReformular = () => {
    const nombre = borradorMedicamento.trim();
    if (!nombre) return;
    setResultados((prev) =>
      prev.map((m) =>
        m.id === editandoId
          ? { ...m, medicamento: nombre, cantidad: borradorCantidad.trim(), alternativas: [] }
          : m,
      ),
    );
    setEditandoId(null);
  };

  // ── Toggle alternativas ──────────────────────────────────────────────────
```

- [ ] **Step 6: Envolver el contenido del `<li>` en modo edición vs. visualización**

Reemplazar el bloque completo desde `return (` (el que abre cada `<li>`) hasta el `);` que lo cierra dentro del `.map`:

```tsx
                    return (
                      <li key={med.id} className="py-3.5">
                        {/* Medicamento original */}
                        <div className="flex items-start gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-foreground">{med.medicamento}</p>
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800">
                                📋 Receta
                              </span>
                            </div>
                            {med.cantidad && (
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                Cantidad: {med.cantidad}
                              </p>
                            )}
                          </div>

                          <div className="flex shrink-0 items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => quitarMedicamento(med.id)}
                              aria-label={`Quitar ${med.medicamento} de los resultados`}
                              className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-red-600"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleAgregarMedicamento(med.medicamento, med.cantidad)}
                              className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all active:scale-[0.97] ${
                                enLista
                                  ? "border border-emerald-300 bg-emerald-50 text-emerald-700"
                                  : "bg-primary text-primary-foreground hover:opacity-90"
                              }`}
                            >
                              {enLista ? (
                                <>
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  En lista
                                </>
                              ) : (
                                <>
                                  <Plus className="h-3.5 w-3.5" />
                                  Añadir
                                </>
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Alternativas */}
                        {med.alternativas.length > 0 && (
                          <div className="mt-2">
                            <button
                              type="button"
                              onClick={() => toggleAlternativas(med.id)}
                              className="flex items-center gap-1 text-xs font-medium text-sky-700 hover:text-sky-800 transition-colors"
                            >
                              {altExpandidas ? (
                                <ChevronUp className="h-3.5 w-3.5" />
                              ) : (
                                <ChevronDown className="h-3.5 w-3.5" />
                              )}
                              {med.alternativas.length} alternativa
                              {med.alternativas.length !== 1 ? "s" : ""} sugerida
                              {med.alternativas.length !== 1 ? "s" : ""} por IA
                            </button>

                            <AnimatePresence>
                              {altExpandidas && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  className="overflow-hidden"
                                >
                                  <div className="mt-2 space-y-2 rounded-xl bg-sky-50/60 p-3">
                                    {med.alternativas.map((alt) => {
                                      const altEnLista = estaEnLista(recipeId(alt));
                                      return (
                                        <div
                                          key={alt}
                                          className="flex items-center justify-between"
                                        >
                                          <div className="flex items-center gap-2">
                                            <p className="text-sm text-foreground">{alt}</p>
                                            <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-medium text-sky-800">
                                              🤖 Alternativa IA
                                            </span>
                                          </div>
                                          <button
                                            type="button"
                                            onClick={() => handleAgregarMedicamento(alt, "")}
                                            className={`flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-all active:scale-[0.97] ${
                                              altEnLista
                                                ? "text-emerald-700"
                                                : "text-sky-700 hover:bg-sky-100"
                                            }`}
                                          >
                                            {altEnLista ? (
                                              <CheckCircle2 className="h-3 w-3" />
                                            ) : (
                                              <Plus className="h-3 w-3" />
                                            )}
                                            {altEnLista ? "Añadido" : "Añadir"}
                                          </button>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        )}
                      </li>
                    );
```

por:

```tsx
                    return (
                      <li key={med.id} className="py-3.5">
                        {editandoId === med.id ? (
                          /* Modo edición: el usuario corrige lo que ÉL ve en la receta física */
                          <div className="rounded-xl bg-sky-50/60 p-3">
                            <label
                              className="text-xs font-medium text-muted-foreground"
                              htmlFor={`med-${med.id}`}
                            >
                              Medicamento
                            </label>
                            <input
                              id={`med-${med.id}`}
                              type="text"
                              value={borradorMedicamento}
                              onChange={(e) => setBorradorMedicamento(e.target.value)}
                              placeholder="Nombre del medicamento"
                              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                            />
                            <label
                              className="mt-2 block text-xs font-medium text-muted-foreground"
                              htmlFor={`cant-${med.id}`}
                            >
                              Cantidad (opcional)
                            </label>
                            <input
                              id={`cant-${med.id}`}
                              type="text"
                              value={borradorCantidad}
                              onChange={(e) => setBorradorCantidad(e.target.value)}
                              placeholder="Ej: 30 tabletas"
                              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                            />
                            <div className="mt-3 flex gap-2">
                              <button
                                type="button"
                                onClick={guardarReformular}
                                disabled={!borradorMedicamento.trim()}
                                className="flex-1 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-opacity disabled:opacity-40"
                              >
                                Guardar
                              </button>
                              <button
                                type="button"
                                onClick={cancelarReformular}
                                className="flex-1 rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted-foreground"
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            {/* Medicamento original */}
                            <div className="flex items-start gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <p className="font-medium text-foreground">{med.medicamento}</p>
                                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800">
                                    📋 Receta
                                  </span>
                                </div>
                                {med.cantidad && (
                                  <p className="mt-0.5 text-xs text-muted-foreground">
                                    Cantidad: {med.cantidad}
                                  </p>
                                )}
                              </div>

                              <div className="flex shrink-0 items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => iniciarReformular(med)}
                                  aria-label={`Reformular ${med.medicamento}`}
                                  className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-sky-600"
                                >
                                  <Pencil className="h-4 w-4" />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => quitarMedicamento(med.id)}
                                  aria-label={`Quitar ${med.medicamento} de los resultados`}
                                  className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-red-600"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleAgregarMedicamento(med.medicamento, med.cantidad)}
                                  className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all active:scale-[0.97] ${
                                    enLista
                                      ? "border border-emerald-300 bg-emerald-50 text-emerald-700"
                                      : "bg-primary text-primary-foreground hover:opacity-90"
                                  }`}
                                >
                                  {enLista ? (
                                    <>
                                      <CheckCircle2 className="h-3.5 w-3.5" />
                                      En lista
                                    </>
                                  ) : (
                                    <>
                                      <Plus className="h-3.5 w-3.5" />
                                      Añadir
                                    </>
                                  )}
                                </button>
                              </div>
                            </div>

                            {/* Alternativas */}
                            {med.alternativas.length > 0 && (
                              <div className="mt-2">
                                <button
                                  type="button"
                                  onClick={() => toggleAlternativas(med.id)}
                                  className="flex items-center gap-1 text-xs font-medium text-sky-700 hover:text-sky-800 transition-colors"
                                >
                                  {altExpandidas ? (
                                    <ChevronUp className="h-3.5 w-3.5" />
                                  ) : (
                                    <ChevronDown className="h-3.5 w-3.5" />
                                  )}
                                  {med.alternativas.length} alternativa
                                  {med.alternativas.length !== 1 ? "s" : ""} sugerida
                                  {med.alternativas.length !== 1 ? "s" : ""} por IA
                                </button>

                                <AnimatePresence>
                                  {altExpandidas && (
                                    <motion.div
                                      initial={{ height: 0, opacity: 0 }}
                                      animate={{ height: "auto", opacity: 1 }}
                                      exit={{ height: 0, opacity: 0 }}
                                      className="overflow-hidden"
                                    >
                                      <div className="mt-2 space-y-2 rounded-xl bg-sky-50/60 p-3">
                                        {med.alternativas.map((alt) => {
                                          const altEnLista = estaEnLista(recipeId(alt));
                                          return (
                                            <div
                                              key={alt}
                                              className="flex items-center justify-between"
                                            >
                                              <div className="flex items-center gap-2">
                                                <p className="text-sm text-foreground">{alt}</p>
                                                <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-medium text-sky-800">
                                                  🤖 Alternativa IA
                                                </span>
                                              </div>
                                              <button
                                                type="button"
                                                onClick={() => handleAgregarMedicamento(alt, "")}
                                                className={`flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-all active:scale-[0.97] ${
                                                  altEnLista
                                                    ? "text-emerald-700"
                                                    : "text-sky-700 hover:bg-sky-100"
                                                }`}
                                              >
                                                {altEnLista ? (
                                                  <CheckCircle2 className="h-3 w-3" />
                                                ) : (
                                                  <Plus className="h-3 w-3" />
                                                )}
                                                {altEnLista ? "Añadido" : "Añadir"}
                                              </button>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            )}
                          </>
                        )}
                      </li>
                    );
```

- [ ] **Step 7: Verificar tipos y build**

Run: `npx tsc --noEmit && npm run build`
Expected: sin errores.

- [ ] **Step 8: Verificación manual**

Con `npm run dev`: escanear (mock) → presionar el lápiz (Reformular) en Atorvastatina → confirmar que aparecen los inputs precargados con "Atorvastatina" y "1 caja" → borrar y escribir "Rosuvastatina" en el campo de nombre → "Guardar" → confirmar que la tarjeta vuelve a modo visualización mostrando "Rosuvastatina" y que **ya no tiene sección de alternativas** (se limpiaron a `[]`). Repetir y presionar "Cancelar" en otro ítem — confirmar que no cambia nada. Intentar guardar con el campo de nombre vacío — confirmar que "Guardar" está deshabilitado.

- [ ] **Step 9: Commit**

```bash
git add src/components/EscanerRecipe.tsx
git commit -m "feat(recipe): reformular manualmente un medicamento mal leído"
```

---

### Task 4: Banner de aviso "generado por IA"

**Files:**
- Modify: `src/components/EscanerRecipe.tsx` (import de icono, JSX)

**Interfaces:**
- Consumes: nada de las tasks anteriores (independiente).
- Produces: nada consumido por tasks posteriores.

- [ ] **Step 1: Importar el icono `AlertTriangle`**

Reemplazar:

```ts
import {
  Camera,
  ScanLine,
  Sparkles,
  Plus,
  CheckCircle2,
  RotateCcw,
  MessageCircle,
  ChevronDown,
  ChevronUp,
  ImageOff,
  Trash2,
  Pencil,
} from "lucide-react";
```

por:

```ts
import {
  Camera,
  ScanLine,
  Sparkles,
  Plus,
  CheckCircle2,
  RotateCcw,
  MessageCircle,
  ChevronDown,
  ChevronUp,
  ImageOff,
  Trash2,
  Pencil,
  AlertTriangle,
} from "lucide-react";
```

- [ ] **Step 2: Insertar el banner antes de la lista**

Reemplazar:

```tsx
                  <p className="text-xs text-muted-foreground">
                    Añádelos a tu lista y elige farmacia después.
                  </p>
                </div>

                {/* Lista scrollable */}
```

por:

```tsx
                  <p className="text-xs text-muted-foreground">
                    Añádelos a tu lista y elige farmacia después.
                  </p>
                </div>

                {/* Aviso: resultado generado por IA, requiere verificación humana */}
                <div className="mx-5 mb-2 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <p>
                    <strong>Resultado generado por IA.</strong> Puede contener errores —
                    verifica los medicamentos antes de continuar. El farmacéutico también
                    debe confirmarlos.
                  </p>
                </div>

                {/* Lista scrollable */}
```

- [ ] **Step 3: Verificar tipos y build**

Run: `npx tsc --noEmit && npm run build`
Expected: sin errores.

- [ ] **Step 4: Verificación manual**

Con `npm run dev`: escanear (mock) → confirmar que el banner ámbar aparece justo debajo del título "N medicamentos detectados" y antes de la lista, en todo momento mientras haya resultados.

- [ ] **Step 5: Commit**

```bash
git add src/components/EscanerRecipe.tsx
git commit -m "feat(recipe): banner de aviso — resultado generado por IA, verificar"
```

---

### Task 5: Nota al farmacéutico en el mensaje de WhatsApp

**Files:**
- Modify: `src/lib/whatsapp.ts:8-26`

**Interfaces:**
- Consumes: `ItemLista.origen` (ya existe, tipo `OrigenLead`, definido en `src/lib/leads.ts:30` — incluye el literal `"escaner_recipe"`, ya asignado por `EscanerRecipe.tsx` en `handleAgregarMedicamento`/`handleAgregarTodos`, sin cambios de esta task).
- Produces: `construirMensajeLista` mantiene su firma `(farmaciaNombre: string, lista: ItemLista[]) => string`; ningún consumidor externo cambia.

- [ ] **Step 1: Añadir la nota condicional**

Reemplazar:

```ts
/**
 * Mensaje multi-producto: saludo con branding, lista numerada con cantidades
 * y una pregunta clara. WhatsApp renderiza *asteriscos* como negrita.
 */
export function construirMensajeLista(farmaciaNombre: string, lista: ItemLista[]): string {
  const lineas = lista.map((item, i) => {
    const marca = item.marcaComercial ? ` (${item.marcaComercial})` : "";
    const cantidad = item.cantidad > 1 ? ` — x${item.cantidad}` : "";
    return `${i + 1}. ${item.nombre}${marca} · ${item.presentacion}${cantidad}`;
  });

  return [
    `Hola ${farmaciaNombre} 👋 Vengo de *DosisYa* y quiero pedir:`,
    "",
    ...lineas,
    "",
    "¿Tienen disponibilidad? ¡Gracias!",
  ].join("\n");
}
```

por:

```ts
/**
 * Mensaje multi-producto: saludo con branding, lista numerada con cantidades
 * y una pregunta clara. WhatsApp renderiza *asteriscos* como negrita.
 *
 * Si algún ítem viene del escáner de récipe con IA (`origen: "escaner_recipe"`),
 * añade una nota para el farmacéutico — la IA puede leer mal un medicamento
 * y quien despacha debe confirmar contra la receta física, sin importar si el
 * paciente reformuló algo o no (spec: quitar-reformular-recipe-design.md).
 */
export function construirMensajeLista(farmaciaNombre: string, lista: ItemLista[]): string {
  const lineas = lista.map((item, i) => {
    const marca = item.marcaComercial ? ` (${item.marcaComercial})` : "";
    const cantidad = item.cantidad > 1 ? ` — x${item.cantidad}` : "";
    return `${i + 1}. ${item.nombre}${marca} · ${item.presentacion}${cantidad}`;
  });

  const tieneItemsDeEscaner = lista.some((item) => item.origen === "escaner_recipe");
  const notaFarmaceutico = tieneItemsDeEscaner
    ? [
        "",
        "⚠️ Algunos productos fueron leídos por IA desde una foto de récipe — " +
          "por favor confirma contra la receta física antes de despachar.",
      ]
    : [];

  return [
    `Hola ${farmaciaNombre} 👋 Vengo de *DosisYa* y quiero pedir:`,
    "",
    ...lineas,
    ...notaFarmaceutico,
    "",
    "¿Tienen disponibilidad? ¡Gracias!",
  ].join("\n");
}
```

- [ ] **Step 2: Verificar tipos y build**

Run: `npx tsc --noEmit && npm run build`
Expected: sin errores.

- [ ] **Step 3: Verificación**

Este repo no tiene framework de tests ni `tsx`/`vite-node` instalado para correr la función de forma aislada (confirmado: `grep` en `package.json` no encuentra ninguno). Verificar de dos formas:

1. **Por inspección:** releer la función y confirmar que `tieneItemsDeEscaner` usa `.some()` (no `.every()`) y que `notaFarmaceutico` se inserta con spread (`...notaFarmaceutico`) entre `lineas` y la línea vacía final — un array vacío `[]` no añade nada al `join("\n")` cuando no hay ítems del escáner.
2. **End-to-end (si hay backend local con al menos una farmacia):** con `npm run dev` y el backend corriendo, escanear (mock) → añadir un medicamento a la lista → abrir el carrito (`CartSummary`/`ListaMedicaDrawer`) → elegir una farmacia → "Contactar Farmacia" → confirmar que el mensaje de WhatsApp que se abre incluye la línea de advertencia al farmacéutico.

- [ ] **Step 4: Commit**

```bash
git add src/lib/whatsapp.ts
git commit -m "feat(leads): nota al farmacéutico cuando el pedido incluye ítems del escáner IA"
```

---

## Notas para el ejecutor

- **No tocar:** el backend, el contrato HTTP de `/api/v1/ia/analizar-recipe`, el prompt de Gemini, ni `recipeId()` (el helper de comparación contra el carrito — ver Global Constraints).
- **Orden de tasks:** 1 → 2 → 3 son estrictamente secuenciales (cada una modifica el mismo bloque JSX que dejó la anterior). Task 4 y Task 5 son independientes entre sí y de las 1-3, pero se listan después por claridad — pueden ejecutarse en cualquier orden relativo entre ellas dos, siempre después de la 1-3 si se quiere evitar reconciliar diffs solapados en el mismo archivo.
