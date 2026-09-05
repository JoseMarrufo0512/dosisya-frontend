# Fix regresión fan-out de leads (Lista Médica) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Arreglar la regresión introducida en el commit `4ae5e6c` que dejó el fan-out de leads de la Lista Médica sin serializar de verdad (el `await` espera una promesa vacía, no el fetch real) y que rompió 3 de 5 tests de `leadsLista.test.ts` desde el 12 de agosto de 2026 sin que nadie lo notara.

**Architecture:** `postLead()` (en `src/lib/leads.ts`) pasa de fire-and-forget interno (`void fetch(...)`) a retornar la promesa real del fetch (`return fetch(...).catch(...)`). `registrarLeadLista()` (en `src/lib/leadsLista.ts`) deja de envolver el fan-out en un IIFE no retornado y pasa a ser ella misma `async`, devolviendo la promesa del fan-out — así el `await` interno sí sirve para serializar los N POST, y los tests pueden `await` el resultado sin sondear timing con mocks síncronos. Los call-sites de UI (`SelectorFarmacia.tsx`, `ListaMedicaDrawer.tsx`) no cambian: siguen llamando sin `await` (fire-and-forget desde la UI, cumpliendo la regla "no bloquees la UI" de CLAUDE.md §4.2), pero ahora la promesa queda disponible para quien la necesite (tests, o futuro manejo de errores).

**Tech Stack:** TypeScript, Vitest, fetch nativo.

## Global Constraints

- CLAUDE.md §4.2: los POST de leads deben seguir siendo fire-and-forget desde la UI (no bloquear el flujo de "abrir WhatsApp"); esta regla no cambia, solo se corrige la implementación interna.
- CLAUDE.md §5: el campo canónico es `tipo_interaccion`, `POST /api/v1/leads/` lleva trailing slash — no tocar el contrato, solo el timing.
- CLAUDE.md §6: correr `npx tsc --noEmit && npm run build` antes de cerrar, y `scripts/test-leads-cpc.sh` por tocar `leads*.ts`.
- No renombrar exports públicos (`postLead`, `registrarLead`, `registrarLeadLista`) — son usados desde componentes de UI reales.
- No añadir dependencias nuevas.

---

### Task 1: `postLead` debe retornar la promesa real del fetch

**Files:**
- Modify: `src/lib/leads.ts:63-95`
- Test: `src/lib/leads.test.ts` (ya existen 10 tests que cubren `postLead`; ninguno debe romperse)

**Interfaces:**
- Consumes: nada nuevo (usa `API_BASE` de `./api`, `track` de `./analytics`, `Sentry` de `@sentry/tanstackstart-react`, ya importados).
- Produces: `postLead(p: LeadPayload): Promise<void>` (antes `: void`). El `.catch()` interno sigue tragando errores de red (nunca rechaza), así que **el contrato de "nunca lanza" se mantiene** para quien no haga `await`.

- [ ] **Step 1: Escribir el test que exige que `postLead` sea awaitable de verdad**

Añadir al final de `src/lib/leads.test.ts`, dentro de un nuevo `describe`:

```typescript
describe("postLead — retorna una promesa que resuelve tras el fetch real", () => {
  it("el await se resuelve DESPUÉS de que el fetch resuelva, no en el mismo tick", async () => {
    let fetchResuelto = false;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => {
              fetchResuelto = true;
              resolve(new Response(null, { status: 201 }));
            }, 0);
          }),
      ),
    );

    await postLead({ farmaciaId: "f1", tipo: "clic_whatsapp", origen: "busqueda" });

    expect(fetchResuelto).toBe(true);
  });

  it("el await no lanza aunque el fetch rechace (sigue fire-and-forget)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    await expect(
      postLead({ farmaciaId: "f1", tipo: "clic_whatsapp", origen: "busqueda" }),
    ).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run src/lib/leads.test.ts -t "retorna una promesa"`
Expected: FAIL — `fetchResuelto` es `false` cuando se evalúa el `expect` (porque hoy `postLead` retorna `undefined` de inmediato, el `await` externo no espera al `setTimeout`).

- [ ] **Step 3: Implementar el fix mínimo**

En `src/lib/leads.ts`, reemplazar la función completa:

```typescript
export function postLead(p: LeadPayload): Promise<void> {
  track(p.tipo, {
    farmacia_id: p.farmaciaId,
    medicamento_id: p.medicamentoId,
    origen: p.origen,
  });
  return fetch(`${API_BASE}/api/v1/leads/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      farmacia_id: p.farmaciaId,
      tipo_interaccion: p.tipo,
      medicamento_buscado_id: medicamentoIdOrNull(p.medicamentoId),
      origen: p.origen,
    }),
    // keepalive: la petición sobrevive si el navegador abandona la página
    // (crítico cuando el clic abre wa.me).
    keepalive: p.keepalive ?? false,
  })
    .then(() => undefined)
    .catch((err) => {
      // Fire-and-forget: los leads CPC nunca deben romper el UX,
      // pero SÍ reportamos a Sentry para detectar pérdida de revenue.
      Sentry.captureMessage("lead_perdido", {
        level: "warning",
        extra: {
          farmacia_id: p.farmaciaId,
          tipo: p.tipo,
          medicamento_id: p.medicamentoId,
          origen: p.origen,
          error: err instanceof Error ? err.message : String(err),
        },
      });
    });
}
```

También actualizar el comentario JSDoc de la función (líneas 56-62) para que ya no diga "Fire-and-forget" a secas, sino:

```typescript
/**
 * Único punto de envío de leads CPC (POST /api/v1/leads/, con trailing slash).
 * Nunca rechaza (los errores de red se tragan internamente) para no romper
 * el UX del caller — pero SÍ retorna la promesa del fetch, para que quien
 * necesite serializar varios leads (ver registrarLeadLista) pueda hacer
 * `await postLead(...)` de verdad.
 *
 * ⚠️ Si el backend añade soporte de array en medicamento_buscado_id, este es el
 * único lugar (junto a registrarLeadLista) que hay que cambiar.
 */
```

- [ ] **Step 4: Correr los tests y verificar que todo pasa**

Run: `npx vitest run src/lib/leads.test.ts`
Expected: PASS — los 12 tests (10 existentes + 2 nuevos) en verde. Los existentes siguen pasando porque ninguno depende de que `postLead` retorne `void`; los que llaman `postLead(...)` sin `await` (fire-and-forget) siguen funcionando igual, y el test `"nunca lanza si fetch rechaza"` sigue en verde porque `postLead` nunca lanza síncronamente.

- [ ] **Step 5: Commit**

```bash
git add src/lib/leads.ts src/lib/leads.test.ts
git commit -m "fix(leads): postLead retorna la promesa real del fetch en vez de void

Necesario para que registrarLeadLista pueda serializar el fan-out con
await de verdad (ver Task 2).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: `registrarLeadLista` pasa a ser `async` y retorna la promesa del fan-out

**Files:**
- Modify: `src/lib/leadsLista.ts:24-47`
- Test: `src/lib/leadsLista.test.ts` (reescribir los 5 tests para que sean `async` y usen `await`)

**Interfaces:**
- Consumes: `postLead(p: LeadPayload): Promise<void>` de Task 1 (ya real, awaitable).
- Produces: `registrarLeadLista(farmaciaId: string | number, items: ItemLeadLista[]): Promise<void>`. Los call-sites de UI (`SelectorFarmacia.tsx:125`, `ListaMedicaDrawer.tsx:61`) **no necesitan cambiar** — seguir llamándola sin `await` sigue siendo válido (fire-and-forget desde la UI) y no genera warnings de TypeScript (una `Promise<void>` no consumida no es error).

- [ ] **Step 1: Reescribir `leadsLista.test.ts` para awaitear el fan-out**

Reemplazar el archivo completo `src/lib/leadsLista.test.ts`:

```typescript
import { describe, expect, it, vi } from "vitest";
import * as leadsModule from "./leads";
import { registrarLeadLista } from "./leadsLista";

describe("registrarLeadLista — fan-out (un POST por medicamento)", () => {
  it("emite exactamente un lead por cada item de la lista", async () => {
    const postLeadSpy = vi
      .spyOn(leadsModule, "postLead")
      .mockResolvedValue(undefined);

    await registrarLeadLista("farmacia-1", [
      { medicamentoId: "med-a" },
      { medicamentoId: "med-b" },
      { medicamentoId: "med-c" },
    ]);

    expect(postLeadSpy).toHaveBeenCalledTimes(3);
    expect(postLeadSpy.mock.calls.map((c) => c[0].medicamentoId)).toEqual([
      "med-a",
      "med-b",
      "med-c",
    ]);
    postLeadSpy.mockRestore();
  });

  it("lista vacía no emite ningún lead", async () => {
    const postLeadSpy = vi
      .spyOn(leadsModule, "postLead")
      .mockResolvedValue(undefined);

    await registrarLeadLista("farmacia-1", []);

    expect(postLeadSpy).not.toHaveBeenCalled();
    postLeadSpy.mockRestore();
  });

  it("usa origen 'lista_medica' por defecto cuando el item no lo especifica", async () => {
    const postLeadSpy = vi
      .spyOn(leadsModule, "postLead")
      .mockResolvedValue(undefined);

    await registrarLeadLista("farmacia-1", [{ medicamentoId: "med-a" }]);

    expect(postLeadSpy.mock.calls[0][0].origen).toBe("lista_medica");
    postLeadSpy.mockRestore();
  });

  it("respeta el origen explícito de cada item (p. ej. escaner_recipe)", async () => {
    const postLeadSpy = vi
      .spyOn(leadsModule, "postLead")
      .mockResolvedValue(undefined);

    await registrarLeadLista("farmacia-1", [
      { medicamentoId: "med-a", origen: "escaner_recipe" },
      { medicamentoId: "med-b" },
    ]);

    expect(postLeadSpy.mock.calls[0][0].origen).toBe("escaner_recipe");
    expect(postLeadSpy.mock.calls[1][0].origen).toBe("lista_medica");
    postLeadSpy.mockRestore();
  });

  it("cada lead se envía con tipo_interaccion clic_whatsapp y keepalive:true", async () => {
    const postLeadSpy = vi
      .spyOn(leadsModule, "postLead")
      .mockResolvedValue(undefined);

    await registrarLeadLista("farmacia-1", [{ medicamentoId: "med-a" }]);

    const arg = postLeadSpy.mock.calls[0][0];
    expect(arg.tipo).toBe("clic_whatsapp");
    expect(arg.keepalive).toBe(true);
    postLeadSpy.mockRestore();
  });

  it("serializa las llamadas: no dispara el siguiente POST hasta que el anterior resuelve", async () => {
    const orden: string[] = [];
    const postLeadSpy = vi
      .spyOn(leadsModule, "postLead")
      .mockImplementation(
        (p) =>
          new Promise((resolve) => {
            orden.push(`start:${p.medicamentoId}`);
            setTimeout(() => {
              orden.push(`end:${p.medicamentoId}`);
              resolve(undefined);
            }, 0);
          }),
      );

    await registrarLeadLista("farmacia-1", [
      { medicamentoId: "med-a" },
      { medicamentoId: "med-b" },
    ]);

    expect(orden).toEqual([
      "start:med-a",
      "end:med-a",
      "start:med-b",
      "end:med-b",
    ]);
    postLeadSpy.mockRestore();
  });
});
```

Nota: el sexto test (`"serializa las llamadas"`) es nuevo — es el que prueba el comportamiento que el commit `4ae5e6c` decía implementar (serializar para no saturar la cola de 6 conexiones por origen) y que hoy NO se cumple.

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `npx vitest run src/lib/leadsLista.test.ts`
Expected: FAIL en los 6 tests (o cuelgan/timeout) — hoy `registrarLeadLista` retorna `void` y el `await` del test no espera nada real; el test de serialización en particular debería mostrar `orden` vacío o desordenado en el momento del `expect`.

- [ ] **Step 3: Implementar el fix mínimo**

Reemplazar en `src/lib/leadsLista.ts` la función `registrarLeadLista` (líneas 24-47):

```typescript
export async function registrarLeadLista(
  farmaciaId: string | number,
  items: ItemLeadLista[],
): Promise<void> {
  if (items.length === 0) return;

  // Fan-out: un lead por medicamento (schema actual de leads_interacciones).
  // Serializamos los fetch con await (postLead ahora retorna la promesa real
  // del fetch) para evitar saturar la cola de conexiones del navegador
  // (max 6 por origen), lo cual provocaba que leads masivos se abortaran
  // o perdieran.
  for (const { medicamentoId, origen } of items) {
    await postLead({
      farmaciaId,
      tipo: "clic_whatsapp",
      medicamentoId,
      // Items previos a la feature no traen origen → lista_medica (nunca
      // premium por accidente, misma regla que el backend)
      origen: origen ?? "lista_medica",
      keepalive: true,
    });
  }
}
```

(Solo cambia: la firma gana `async`/`Promise<void>`, y se elimina el IIFE `(async () => { ... })()` — el `for` queda directo en el cuerpo de la función async, y ahora sí se retorna al caller.)

- [ ] **Step 4: Correr los tests y verificar que todo pasa**

Run: `npx vitest run src/lib/leadsLista.test.ts`
Expected: PASS — los 6 tests en verde, sin contaminación entre tests (cada `await registrarLeadLista(...)` termina de verdad antes del siguiente `it`).

- [ ] **Step 5: Verificar que TypeScript sigue contento en los call-sites de UI**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos. `SelectorFarmacia.tsx:125` y `ListaMedicaDrawer.tsx:61` llaman `registrarLeadLista(...)` sin `await` ni capturar el retorno — una `Promise<void>` no manejada no es un error de TypeScript (solo lo sería con la regla de lint `no-floating-promises`, que este proyecto no tiene activada; confirmar con el Step 6 de todas formas).

- [ ] **Step 6: Confirmar que ESLint no marca la promesa flotante en los call-sites**

Run: `npm run lint`
Expected: sin errores nuevos en `SelectorFarmacia.tsx` ni `ListaMedicaDrawer.tsx`. Si el linter SÍ marca `no-floating-promises` en esas dos líneas, prefijar la llamada con `void` en ambos archivos (`void registrarLeadLista(farmaciaId, items);`) — es la forma idiomática de declarar "fire-and-forget intencional" sin silenciar la regla globalmente. No tocar nada más de esos componentes.

- [ ] **Step 7: Commit**

```bash
git add src/lib/leadsLista.ts src/lib/leadsLista.test.ts
git commit -m "fix(leads): registrarLeadLista serializa el fan-out con await real

postLead ahora retorna la promesa del fetch (commit anterior), así que
convertir registrarLeadLista en async y retornar su promesa hace que el
await interno sirva de verdad para serializar los N POST del fan-out,
en vez de resolver en un tick vacío como antes.

Efecto colateral corregido: 3 de 5 tests de leadsLista.test.ts estaban
rojos en main desde el 12 de agosto (commit 4ae5e6c) por contaminación
de mocks entre tests — el IIFE no retornado seguía ejecutándose después
de que el test síncrono ya había hecho sus asserts y restaurado el spy.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Verificación end-to-end y suite completa

**Files:**
- No se modifican archivos de producto en esta tarea — solo verificación.

**Interfaces:**
- Consumes: todo lo de Task 1 y Task 2.
- Produces: nada nuevo — confirma que el resto del árbol de tests y el build siguen verdes.

- [ ] **Step 1: Correr la suite completa de Vitest**

Run: `npx vitest run`
Expected: todos los archivos de test en verde, incluyendo `src/lib/leads.test.ts` y `src/lib/leadsLista.test.ts`. Cero regresiones en otros archivos que puedan importar `postLead`/`registrarLead`/`registrarLeadLista` indirectamente.

- [ ] **Step 2: Correr el script de prueba end-to-end de leads CPC**

Run: `bash scripts/test-leads-cpc.sh`
Expected: exit code 0. Este script está explícitamente requerido por CLAUDE.md §6 tras tocar `leads*.ts`.

- [ ] **Step 3: Verificación mínima de build (obligatoria antes de push por CLAUDE.md §6)**

Run: `npx tsc --noEmit && npm run build`
Expected: ambos comandos terminan sin error. (El build de Vercel ya se rompió dos veces en este proyecto por saltarse este paso — no omitirlo.)

- [ ] **Step 4: Prueba manual en navegador del flujo real (Lista Médica → WhatsApp)**

Con `npm run dev` corriendo, abrir la app, agregar 2-3 medicamentos a la Lista Médica, seleccionar una farmacia y hacer clic en "Contactar por WhatsApp". Confirmar en la pestaña Network del navegador que:
- Se disparan N requests `POST /api/v1/leads/` (uno por medicamento).
- Los requests salen en orden, cada uno iniciando después de que el anterior completa (no los N simultáneos como antes del fix).
- La apertura de `wa.me` no se bloquea ni se retrasa de forma perceptible para el usuario (la ventana de WhatsApp se abre de inmediato — el fan-out sigue sin bloquear la UI, solo se serializa a sí mismo internamente).

- [ ] **Step 5: (Opcional, proponer a José) Cerrar el hueco de proceso que permitió que esto pasara inadvertido**

CLAUDE.md §6 solo exige `npx tsc --noEmit && npm run build` antes de commit/push — no exige correr la suite de tests, que es como esta regresión estuvo 3 semanas en `main` sin que nadie la detectara. Proponer añadir una línea a CLAUDE.md §6:

```markdown
- Verificación mínima antes de commit/push: `npx tsc --noEmit && npm run build && npx vitest run`.
```

No aplicar este cambio sin confirmación explícita de José — es una decisión de proceso del equipo, no solo código.

- [ ] **Step 6: Commit final (si Step 5 fue aprobado)**

```bash
git add CLAUDE.md
git commit -m "docs: exigir npx vitest run en la verificación previa a commit/push

La regresión del fan-out de leads (ver commits anteriores) estuvo 3
semanas en main con 3 tests rojos porque el checklist de CLAUDE.md §6
no incluía correr la suite de tests.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Addendum (post-implementation, final whole-branch review)

Tasks 1-3 were implemented and task-reviewed as written above. The final
whole-branch review then raised two findings that changed the shipped
design — recorded here for anyone reading this plan later:

1. **Important — `postLead`'s "never rejects" invariant had a hole:** if
   `Sentry.captureMessage` throws inside the `.catch()` handler, that throw
   makes the returned promise reject, which (now that callers really
   `await` it) can abort the rest of a fan-out and surface as an unhandled
   rejection. **Decision (José): fix it** — wrap the `Sentry.captureMessage`
   call in its own `try/catch` inside `postLead`.

2. **Important, plan-mandated — serialized fan-out risks losing leads 2..N
   on mobile.** Task 2 serialized the fan-out (`for` + `await`) per the
   original commit's stated goal of not saturating the browser's
   per-origin connection limit. The reviewer argued that goal likely
   doesn't hold (Vercel backend serves HTTP/2, which multiplexes; even
   HTTP/1.1 queues rather than aborts excess requests) while the
   serialized approach introduces a real new risk: opening `wa.me`
   backgrounds the tab immediately, and only lead #1 is guaranteed to have
   been dispatched before that happens — leads #2..N depend on the
   backgrounded tab staying alive long enough to keep awaiting, which
   mobile browsers do not guarantee. **Decision (José): switch to parallel
   dispatch** (`Promise.all` over `items.map(postLead)`) instead of the
   sequential loop — this preserves the actual win of this plan (`postLead`
   returning a real, testable promise) while dispatching all N leads in the
   same tick, each protected individually by `keepalive: true`. `Promise.all`
   is safe here specifically because finding #1 is fixed first (`postLead`
   truly never rejects).

Both fixes were implemented as Task 4 below (dispatched as a single fix
subagent per subagent-driven-development's guidance to batch a review's
findings rather than fixing one-by-one).

### Task 4: Fix Sentry try/catch + switch fan-out to parallel dispatch

**Files:**
- Modify: `src/lib/leads.ts:86-99` (wrap `Sentry.captureMessage` in try/catch)
- Modify: `src/lib/leads.test.ts` (add a test proving postLead never rejects even if Sentry throws)
- Modify: `src/lib/leadsLista.ts:24-46` (replace serialized `for`+`await` with `Promise.all(items.map(...))`)
- Modify: `src/lib/leadsLista.test.ts` (replace the "serializa las llamadas" test with one proving parallel dispatch)

This task's exact code was specified directly in the fix-subagent dispatch (not pre-written here, since it was generated interactively after the final review) — see commits for the applied diff.

## Self-Review Notes

- **Cobertura del diagnóstico:** las 3 causas descritas en la memoria (`postLead: void` sin promesa real, IIFE no retornado en `registrarLeadLista`, tests síncronos que no calzan con el timing) están cubiertas: Task 1 arregla la primera, Task 2 arregla la segunda y reescribe los tests para la tercera.
- **Sin placeholders:** cada step trae el código completo a escribir, no descripciones.
- **Consistencia de tipos:** `postLead(p: LeadPayload): Promise<void>` (Task 1) es exactamente lo que Task 2 consume vía `await postLead(...)`; `registrarLeadLista(...): Promise<void>` (Task 2) es lo que los call-sites de UI ya toleran sin cambios (no capturan el retorno).
- **No se tocan contratos de API:** `tipo_interaccion`, trailing slash, `medicamento_buscado_id` nullable — todo intacto, solo cambia el timing interno del envío.
