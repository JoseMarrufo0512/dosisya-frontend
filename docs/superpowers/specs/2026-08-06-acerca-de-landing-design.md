# Spec: Página `/acerca-de`

**Fecha:** 2026-08-06
**Estado:** Aprobado, pendiente de plan de implementación

## Contexto

DosisYa ya tiene un sitio funcional (buscador de medicamentos en `src/App.tsx`, dashboard de farmacia, panel super-admin, `/producto/...`, `/terminos`, `/privacidad`). No existe ninguna página informativa/institucional que explique qué es DosisYa a las tres audiencias del negocio: pacientes, farmacias potenciales e inversores/prensa.

No existe hoy ningún flujo de alta de farmacias (las agrega el super-admin manualmente vía panel), así que esta página también sirve como punto de entrada de contacto comercial para farmacias interesadas.

## Objetivo

Una sola página landing en `/acerca-de` con tres secciones (una por audiencia), reutilizando el sistema de diseño existente (`dosisya-ui.css`, tokens de color) para que se sienta parte del mismo sitio, no un microsite aparte.

## Alcance

### Ruta
`src/routes/acerca-de.tsx` — ruta file-based, patrón igual a `src/routes/terminos.tsx` (export `Route` con `head()` para SEO + componente).

`head()`:
- `title`: "Acerca de DosisYa"
- `description`: algo tipo "Qué es DosisYa: marketplace hiperlocal de medicamentos en Acarigua/Araure. Para pacientes, farmacias e inversores."

### Layout
`LegalLayout` (`src/components/LegalLayout.tsx`) **no se reutiliza** — está pensado para prosa legal en una columna angosta, sin CTAs ni imágenes. Se crea un layout nuevo específico para esta página (puede vivir inline en `acerca-de.tsx` si no se reutiliza en otro lado, o como `src/components/AcercaDeLayout.tsx` si el archivo crece mucho). Debe:
- Usar la clase `dosisya-ui` y los tokens existentes (`--verde-cruz`, `--papel`, `--tinta`, `--tinta-tenue`, etc.) — mismos que usa `HeroBusqueda` y `LegalLayout`.
- Incluir un link "Volver a DosisYa" hacia `/` (mismo patrón que `LegalLayout`).
- Estructura tipo landing: hero + 3 bloques de sección apilados verticalmente, con anclas (`id="pacientes"`, `id="farmacias"`, `id="inversores"`) para poder linkear directo a una sección si hace falta en el futuro.

### Contenido por sección

**Hero (arriba de todo)**
Una línea explicando qué es DosisYa: marketplace hiperlocal de medicamentos en Acarigua/Araure (Venezuela), sin fricción para el paciente. Reutiliza el mensaje de negocio del CLAUDE.md, sección 1 (Visión y Negocio).

**Para pacientes**
- Cómo funciona: buscar medicamento, comparar precios/disponibilidad entre farmacias cercanas, armar Lista Médica, contactar por WhatsApp — todo sin registro ni cuenta.
- CTA: botón "Buscar medicamentos" → `<Link to="/">` (componente de TanStack Router, no `<a>`).

**Para farmacias**
- Modelo de negocio: DosisYa cobra por lead (interacción hacia WhatsApp de la farmacia), NO comisión por venta. La farmacia mantiene su propia logística de última milla.
- Beneficio: aparecer en el buscador frente a pacientes cercanos que ya están buscando ese medicamento.
- CTA: botón que abre WhatsApp vía `wa.me` con mensaje prellenado, ej.: *"Hola, quiero información sobre unirme a DosisYa como farmacia."*
  - Número: `+584245928624` (número comercial de DosisYa, fijo — no viene de datos de ninguna farmacia).
  - Implementación: reutilizar `sanitizarTelefono` y `construirUrlWhatsApp` de `src/lib/whatsapp.ts` para construir la URL, pasando el número fijo como argumento (no se llama con datos de farmacia, es un uso distinto de la misma utilidad).
  - **No se registra como lead** en `leads_interacciones` — no hay POST a `/api/v1/leads/`. Es contacto comercial con DosisYa mismo, no interacción paciente→farmacia; el modelo de leads del backend es específicamente para esas últimas.

**Para inversores/prensa**
- Visión: marketplace hiperlocal, logística descentralizada (motorizados propios de la farmacia o Yummy), modelo de leads B2B.
- Sin cifras de tracción inventadas — texto genérico institucional; el usuario puede completar números reales más adelante editando el archivo.
- CTA: mismo WhatsApp comercial (`+584245928624`), mensaje distinto, ej.: *"Hola, quiero más información sobre DosisYa."*

### Enlace desde el home

En `src/components/HeroBusqueda.tsx`, debajo del tagline "Encuentra tu medicamento" (línea ~98, dentro del bloque `<div className="text-center mb-6">`), agregar un link de texto pequeño y discreto:

```tsx
<Link to="/acerca-de" className="text-xs text-gray-400 underline underline-offset-2 mt-1 inline-block">
  Acerca de DosisYa
</Link>
```

Estilo tenue (no compite visualmente con el buscador ni con el botón de cuenta/tasa que ya ocupan las esquinas superiores). `HeroBusqueda` no importa `Link` de TanStack Router todavía — hay que agregar el import.

### Fuera de alcance
- No se toca el backend ni ningún endpoint.
- No hay formulario ni captura de datos — todo el contacto es vía WhatsApp externo.
- No se agrega footer persistente al resto del sitio; el único link nuevo es el de `HeroBusqueda`.
- No se traduce ni se hace i18n — español, igual que el resto del sitio.

## Verificación

Sin lógica de negocio nueva (contenido estático + 3 links), la verificación es:
1. `npm run dev`, revisar visualmente `/acerca-de` (desktop y mobile) y el nuevo link en el home.
2. Confirmar que los 3 CTAs apuntan correctamente: `/` (patientes), `wa.me/584245928624` con cada mensaje (farmacias e inversores).
3. `npx tsc --noEmit && npm run build` antes de dar por terminado (regla de CLAUDE.md sección 6 — los builds de Vercel ya se rompieron dos veces por saltarse esto).
