# Página /acerca-de Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a single landing page at `/acerca-de` with three sections (pacientes, farmacias, inversores/prensa), plus a discreet link to it from the home hero.

**Architecture:** One new file-based route (`src/routes/acerca-de.tsx`) rendering static content styled with the existing `dosisya-ui` design tokens — no new layout component, no new lib functions, no backend calls. One small addition to `src/components/HeroBusqueda.tsx` to link to the new route, following the exact pattern already used there for the `/admin/login` link.

**Tech Stack:** React 19, TanStack Router (file-based routing, auto-regenerates `src/routeTree.gen.ts` — never edit that file by hand), TailwindCSS 4, lucide-react icons, existing `src/lib/whatsapp.ts` helpers.

## Global Constraints

- WhatsApp comercial fijo para todos los CTAs de esta página: `+584245928624`.
- Los clics en los CTAs de WhatsApp de esta página **no** se registran como lead (no hay POST a `/api/v1/leads/`) — son contacto comercial con DosisYa, no interacción paciente→farmacia.
- Sin formularios, sin captura de datos, sin nuevos endpoints ni cambios de backend.
- Español, sin i18n — igual que el resto del sitio.
- Usar únicamente los tokens de color definidos en `src/styles/dosisya-ui.css` (`--verde-cruz`, `--whatsapp`, `--tinta`, `--tinta-suave`, `--tinta-tenue`, `--papel`, `--borde`, `--fondo-suave`), no colores hardcodeados nuevos.
- Verificación final obligatoria antes de dar por terminado: `npx tsc --noEmit && npm run build` (regla de CLAUDE.md — los builds de Vercel ya se rompieron dos veces por saltarse esto).
- Este proyecto no tiene tests de componentes/rutas (no hay `@testing-library/react` ni `jsdom` instalado — `vitest` solo cubre funciones puras en `src/lib/`). La verificación de esta feature es manual vía dev server, no un test automatizado nuevo.

---

### Task 1: Crear la ruta `/acerca-de`

**Files:**
- Create: `src/routes/acerca-de.tsx`

**Interfaces:**
- Consumes: `construirUrlWhatsApp(telefono, mensaje)` de `src/lib/whatsapp.ts` — firma `(telefono: string | null | undefined, mensaje: string) => string | null`.
- Produces: ruta `/acerca-de` navegable vía `<Link to="/acerca-de">` (usada por Task 2).

- [ ] **Step 1: Crear el archivo de la ruta con el contenido completo**

```tsx
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { construirUrlWhatsApp } from "@/lib/whatsapp";

const WHATSAPP_COMERCIAL = "+584245928624";

export const Route = createFileRoute("/acerca-de")({
  head: () => ({
    meta: [
      { title: "Acerca de DosisYa" },
      {
        name: "description",
        content:
          "Qué es DosisYa: marketplace hiperlocal de medicamentos en Acarigua/Araure. Información para pacientes, farmacias e inversores.",
      },
    ],
  }),
  component: AcercaDe,
});

function AcercaDe() {
  const urlFarmacias = construirUrlWhatsApp(
    WHATSAPP_COMERCIAL,
    "Hola, quiero información sobre unirme a DosisYa como farmacia.",
  );
  const urlInversores = construirUrlWhatsApp(
    WHATSAPP_COMERCIAL,
    "Hola, quiero más información sobre DosisYa.",
  );

  return (
    <div className="dosisya-ui min-h-screen" style={{ background: "var(--papel)" }}>
      <div className="mx-auto max-w-2xl px-5 py-10">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm"
          style={{ color: "var(--tinta-tenue)" }}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Volver a DosisYa
        </Link>

        <div className="mt-8 text-center">
          <h1 className="text-3xl font-black" style={{ letterSpacing: "-0.02em" }}>
            <span style={{ color: "var(--tinta)" }}>Dosis</span>
            <span style={{ color: "var(--verde-cruz)" }}>Ya</span>
          </h1>
          <p
            className="mt-3 text-[15px] leading-relaxed"
            style={{ color: "var(--tinta-suave)" }}
          >
            Marketplace hiperlocal de medicamentos en Acarigua y Araure. Buscamos que
            cualquier paciente encuentre, compare y contacte a la farmacia más cercana con
            su medicamento en stock — sin registrarse, sin fricción.
          </p>
        </div>

        <section id="pacientes" className="mt-12">
          <h2 className="text-lg font-semibold" style={{ color: "var(--verde-cruz)" }}>
            Para pacientes
          </h2>
          <p className="mt-2 text-[15px] leading-relaxed" style={{ color: "var(--tinta)" }}>
            Busca tu medicamento, compara precio y disponibilidad entre farmacias cercanas,
            arma tu Lista Médica si necesitas varios productos, y contacta a la farmacia
            directo por WhatsApp. Todo sin crear cuenta ni iniciar sesión.
          </p>
          <Link
            to="/"
            className="mt-4 inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: "var(--verde-cruz)" }}
          >
            Buscar medicamentos
          </Link>
        </section>

        <section id="farmacias" className="mt-10">
          <h2 className="text-lg font-semibold" style={{ color: "var(--verde-cruz)" }}>
            Para farmacias
          </h2>
          <p className="mt-2 text-[15px] leading-relaxed" style={{ color: "var(--tinta)" }}>
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
              className="mt-4 inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: "var(--whatsapp)" }}
            >
              Quiero unir mi farmacia
            </a>
          )}
        </section>

        <section id="inversores" className="mt-10 mb-10">
          <h2 className="text-lg font-semibold" style={{ color: "var(--verde-cruz)" }}>
            Para inversores y prensa
          </h2>
          <p className="mt-2 text-[15px] leading-relaxed" style={{ color: "var(--tinta)" }}>
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
              className="mt-4 inline-flex items-center justify-center rounded-full border px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-[var(--fondo-suave)]"
              style={{ borderColor: "var(--verde-cruz)", color: "var(--verde-cruz)" }}
            >
              Contactar al equipo
            </a>
          )}
        </section>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Levantar el dev server y verificar la ruta manualmente**

Run: `npm run dev` (puerto 5173)

En el navegador (o con las herramientas de preview), abrir `http://localhost:5173/acerca-de` y confirmar:
- Se ven las tres secciones (Para pacientes / Para farmacias / Para inversores y prensa) con el hero arriba.
- El link "Volver a DosisYa" navega a `/`.
- El botón "Buscar medicamentos" navega a `/`.
- El botón "Quiero unir mi farmacia" abre `https://wa.me/584245928624?text=Hola%2C%20quiero%20informaci%C3%B3n%20sobre%20unirme%20a%20DosisYa%20como%20farmacia.` (revisar con la pestaña de red o inspeccionando el `href`, no hace falta enviar el mensaje real).
- El botón "Contactar al equipo" abre `https://wa.me/584245928624?text=Hola%2C%20quiero%20m%C3%A1s%20informaci%C3%B3n%20sobre%20DosisYa.`

Expected: la página renderiza sin errores en consola, ningún CTA da 404 ni queda vacío.

- [ ] **Step 3: Commit**

```bash
git add src/routes/acerca-de.tsx
git commit -m "feat(marketing): agrega página /acerca-de con secciones para pacientes, farmacias e inversores"
```

---

### Task 2: Enlazar `/acerca-de` desde el home

**Files:**
- Modify: `src/components/HeroBusqueda.tsx:3` (import), `src/components/HeroBusqueda.tsx:179-185` (JSX, agregar link después del existente)

**Interfaces:**
- Consumes: ruta `/acerca-de` creada en Task 1.
- Produces: nada consumido por otras tareas — es el punto final de descubribilidad.

- [ ] **Step 1: Agregar el ícono `Info` al import de lucide-react**

En `src/components/HeroBusqueda.tsx:3`, reemplazar:

```tsx
import { Building2, User } from "lucide-react";
```

por:

```tsx
import { Building2, Info, User } from "lucide-react";
```

- [ ] **Step 2: Agregar el link discreto justo después del link de "¿Tienes una farmacia?"**

En `src/components/HeroBusqueda.tsx:179-185`, el bloque actual es:

```tsx
      {/* Acceso B2B: discreto a propósito — es para dueños de farmacia,
          no para el paciente, y su panel vive en otra ruta (/admin/login). */}
      <Link
        to="/admin/login"
        className="dy-foco mt-8 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-gray-400 transition-colors hover:text-[color:var(--verde-cruz)]"
      >
        <Building2 className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
        ¿Tienes una farmacia? Accede a tu panel
      </Link>
```

Reemplazarlo por (agrega un segundo link inmediatamente debajo, mismo estilo):

```tsx
      {/* Acceso B2B: discreto a propósito — es para dueños de farmacia,
          no para el paciente, y su panel vive en otra ruta (/admin/login). */}
      <Link
        to="/admin/login"
        className="dy-foco mt-8 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-gray-400 transition-colors hover:text-[color:var(--verde-cruz)]"
      >
        <Building2 className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
        ¿Tienes una farmacia? Accede a tu panel
      </Link>
      <Link
        to="/acerca-de"
        className="dy-foco mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-gray-400 transition-colors hover:text-[color:var(--verde-cruz)]"
      >
        <Info className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
        Acerca de DosisYa
      </Link>
```

- [ ] **Step 3: Levantar el dev server y verificar manualmente**

Run: `npm run dev` (si ya estaba corriendo desde el Task 1, alcanza con recargar)

En `http://localhost:5173/` (hero inicial, sin buscar nada), confirmar:
- Debajo de "¿Tienes una farmacia? Accede a tu panel" aparece el nuevo link "Acerca de DosisYa" con el ícono `Info`.
- Al hacer clic navega a `/acerca-de`.

Expected: ambos links visibles, discretos (texto gris chico), sin romper el layout del hero.

- [ ] **Step 4: Commit**

```bash
git add src/components/HeroBusqueda.tsx
git commit -m "feat(marketing): enlaza /acerca-de desde el hero de búsqueda"
```

---

### Task 3: Verificación final de tipos y build

**Files:** ninguno (solo comandos de verificación)

**Interfaces:**
- Consumes: todo lo creado en Task 1 y Task 2.
- Produces: nada — es el gate final antes de considerar la feature terminada.

- [ ] **Step 1: Chequeo de tipos**

Run: `npx tsc --noEmit`
Expected: sin errores (exit code 0).

- [ ] **Step 2: Build de producción**

Run: `npm run build`
Expected: build completa sin errores. Confirmar en el output que `routeTree.gen.ts` se regeneró incluyendo `/acerca-de` (TanStack Router lo hace automáticamente durante `dev`/`build` — no se edita a mano).

- [ ] **Step 3: Si algo falla, arreglar y repetir Steps 1-2 antes de continuar**

No hacer commit de este task salvo que haya cambios (los fixes, si los hay, se commitean junto con el arreglo correspondiente).
