# Rediseño visual /acerca-de Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat text layout of `/acerca-de` with a hero + three color-block cards (one per audience), following the approved design.

**Architecture:** Single-file rewrite of `src/routes/acerca-de.tsx`'s JSX/styles — no new files, no new dependencies, no logic changes. The hero becomes a full-bleed `--verde-cruz` band; the three sections become rounded, solid-color cards using existing `dosisya-ui.css` tokens.

**Tech Stack:** React 19, TanStack Router, TailwindCSS 4, lucide-react icons, existing `src/lib/whatsapp.ts` helpers (unchanged).

## Global Constraints

- No content/copy changes — every paragraph and heading stays word-for-word identical to the current file.
- No functional changes — same WhatsApp number `+584245928624`, same two prellenado messages, same `construirUrlWhatsApp` calls, same `to="/"` links, same anchor `id`s (`pacientes`, `farmacias`, `inversores`).
- Only colors already defined in `src/styles/dosisya-ui.css` may be used: `--verde-cruz`, `--verde-claro`, `--disp-fondo`, `--ambar-receta`, `--tinta`, plus white (`#ffffff`) and semi-transparent white (`rgba(255,255,255,*)`) for text-on-color contrast — no new hex colors invented.
- No floating WhatsApp bubble, no new components/files — this is a rewrite of the existing single-file route.
- Verification: `npx tsc --noEmit && npm run build` must pass before this is done (CLAUDE.md rule — Vercel builds broke twice from skipping this).
- No automated component test exists or is expected (project convention — vitest only covers `src/lib/`); verification is manual via dev server.

---

### Task 1: Rewrite `/acerca-de` with hero + color-block cards

**Files:**
- Modify: `src/routes/acerca-de.tsx` (entire file — imports and the `AcercaDe` component body; the `Route`/`head()` block and the `WHATSAPP_COMERCIAL`/`urlFarmacias`/`urlInversores` declarations above the `return` do NOT change)

**Interfaces:**
- Consumes: `construirUrlWhatsApp` from `src/lib/whatsapp.ts` (unchanged, already imported) — no new consumption.
- Produces: nothing new consumed elsewhere — this route is a leaf page.

- [ ] **Step 1: Replace the lucide-react import line**

In `src/routes/acerca-de.tsx:2`, replace:

```tsx
import { ArrowLeft } from "lucide-react";
```

with:

```tsx
import { ArrowLeft, Building2, Search, TrendingUp } from "lucide-react";
```

- [ ] **Step 2: Replace the entire `return (...)` block of `AcercaDe`**

In `src/routes/acerca-de.tsx`, the current file has this structure starting at line 31 (`return (`) through line 124 (the closing `);` before the function's closing `}` on line 124-125). Replace that whole `return (...)` statement — everything from `return (` down to the matching `);` — with:

```tsx
  return (
    <div className="dosisya-ui min-h-screen" style={{ background: "var(--papel)" }}>
      <div style={{ background: "var(--verde-cruz)" }} className="px-5 py-12">
        <div className="mx-auto max-w-2xl">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm"
            style={{ color: "rgba(255,255,255,0.85)" }}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Volver a DosisYa
          </Link>

          <div className="mt-8 text-center">
            <h1 className="text-3xl font-black" style={{ letterSpacing: "-0.02em" }}>
              <span style={{ color: "#ffffff" }}>Dosis</span>
              <span style={{ color: "var(--verde-claro)" }}>Ya</span>
            </h1>
            <p
              className="mt-3 text-[15px] leading-relaxed"
              style={{ color: "rgba(255,255,255,0.85)" }}
            >
              Marketplace hiperlocal de medicamentos en Acarigua y Araure. Buscamos que
              cualquier paciente encuentre, compare y contacte a la farmacia más cercana con
              su medicamento en stock — sin registrarse, sin fricción.
            </p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-2xl space-y-6 px-5 py-10">
        <section
          id="pacientes"
          className="rounded-3xl p-7"
          style={{ background: "var(--disp-fondo)" }}
        >
          <div
            className="flex h-11 w-11 items-center justify-center rounded-2xl"
            style={{ background: "var(--verde-cruz)" }}
          >
            <Search className="h-5 w-5 text-white" aria-hidden="true" />
          </div>
          <h2 className="mt-4 text-lg font-semibold" style={{ color: "var(--verde-cruz)" }}>
            Para pacientes
          </h2>
          <p className="mt-2 text-[15px] leading-relaxed" style={{ color: "var(--tinta)" }}>
            Busca tu medicamento, compara precio y disponibilidad entre farmacias cercanas,
            arma tu Lista Médica si necesitas varios productos, y contacta a la farmacia
            directo por WhatsApp. Todo sin crear cuenta ni iniciar sesión.
          </p>
          <Link
            to="/"
            className="mt-5 inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: "var(--verde-cruz)" }}
          >
            Buscar medicamentos
          </Link>
        </section>

        <section
          id="farmacias"
          className="rounded-3xl p-7"
          style={{ background: "var(--ambar-receta)" }}
        >
          <div
            className="flex h-11 w-11 items-center justify-center rounded-2xl"
            style={{ background: "rgba(255,255,255,0.2)" }}
          >
            <Building2 className="h-5 w-5 text-white" aria-hidden="true" />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-white">Para farmacias</h2>
          <p
            className="mt-2 text-[15px] leading-relaxed"
            style={{ color: "rgba(255,255,255,0.92)" }}
          >
            Aparece frente a pacientes de Acarigua y Araure que ya están buscando ese
            medicamento cerca de ti. Cobramos por cada contacto que te llega por WhatsApp —
            no cobramos comisión por venta, y tu logística de entrega sigue siendo tuya
            (motorizado propio o Yummy).
          </p>
          {urlFarmacias && (
            <a
              href={urlFarmacias}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90"
              style={{ background: "#ffffff", color: "var(--ambar-receta)" }}
            >
              Quiero unir mi farmacia
            </a>
          )}
        </section>

        <section
          id="inversores"
          className="mb-2 rounded-3xl p-7"
          style={{ background: "var(--tinta)" }}
        >
          <div
            className="flex h-11 w-11 items-center justify-center rounded-2xl"
            style={{ background: "rgba(255,255,255,0.12)" }}
          >
            <TrendingUp className="h-5 w-5 text-white" aria-hidden="true" />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-white">Para inversores y prensa</h2>
          <p
            className="mt-2 text-[15px] leading-relaxed"
            style={{ color: "rgba(255,255,255,0.85)" }}
          >
            DosisYa conecta oferta y demanda de medicamentos a nivel hiperlocal con un
            modelo de leads B2B: las farmacias pagan por cada contacto que reciben, no por
            transacción. La última milla la resuelve cada farmacia, lo que nos permite
            crecer sin operar flota propia.
          </p>
          {urlInversores && (
            <a
              href={urlInversores}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90"
              style={{ background: "#ffffff", color: "var(--tinta)" }}
            >
              Contactar al equipo
            </a>
          )}
        </section>
      </div>
    </div>
  );
```

The function's closing `}` (currently line 124-125, right after the `return`'s closing `);`) stays as-is.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0, no errors.

- [ ] **Step 4: Visual verification via dev server**

Run: `npm run dev` (port 5173)

Open `http://localhost:5173/acerca-de` and confirm:
- A full-width green (`--verde-cruz`) hero band at the top with the white/light-green "DosisYa" wordmark, the tagline, and a light "Volver a DosisYa" link — all legible against the dark green.
- Three separate rounded cards below the hero, each a distinct solid color: light green (pacientes), amber/orange (farmacias), near-black (inversores) — clearly distinguishable from each other, not blending into one block.
- Each card shows its icon badge (magnifying glass / building / trending-up), heading, paragraph, and CTA button with good contrast (no gray-on-gray or white-on-white text).
- The "Buscar medicamentos" button still navigates to `/`.
- The "Quiero unir mi farmacia" and "Contactar al equipo" buttons still open the same `wa.me/584245928624` links with their respective prellenado messages (check via the link `href`, no need to actually send).

Resize to a mobile width (e.g. 375px) and confirm the cards and hero still look correct — text doesn't overflow, padding doesn't look cramped.

Expected: no console errors, no layout breakage, all four color zones (hero + 3 cards) visually distinct with readable text.

- [ ] **Step 5: Commit**

```bash
git add src/routes/acerca-de.tsx
git commit -m "redesign(marketing): tarjetas de color por sección en /acerca-de

Reemplaza el layout de texto plano por un hero a color y 3 tarjetas
(pacientes/farmacias/inversores), cada una con su propio fondo sólido
reusando tokens ya existentes en dosisya-ui.css. Inspirado en el
patrón de landing de Yummy SuperApp. Sin cambios de copy ni de
funcionalidad."
```

---

### Task 2: Verificación final de build

**Files:** ninguno (solo comandos de verificación)

**Interfaces:**
- Consumes: el cambio de Task 1.
- Produces: nada — gate final antes de dar la feature por terminada.

- [ ] **Step 1: Build de producción**

Run: `npm run build`
Expected: build completa sin errores.

- [ ] **Step 2: Suite de tests**

Run: `npm run test`
Expected: todos los tests existentes siguen pasando (este cambio no toca `src/lib/`, así que el conteo de tests no debería cambiar).

- [ ] **Step 3: Si algo falla, arreglar y repetir Steps 1-2 antes de continuar**

No hacer commit de este task salvo que haya cambios (los fixes, si los hay, se commitean junto con el arreglo correspondiente).
