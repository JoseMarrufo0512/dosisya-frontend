# Spec: Rediseño visual de `/acerca-de`

**Fecha:** 2026-08-06
**Estado:** Aprobado, pendiente de plan de implementación

## Contexto

La página `/acerca-de` (creada el mismo día, ver `docs/superpowers/specs/2026-08-06-acerca-de-landing-design.md`) quedó visualmente plana: hero centrado + tres bloques idénticos de título/párrafo/botón, sin separación visual ni jerarquía. El usuario la calificó de "horrible" y pidió mejorar estructura y diseño.

Como referencia se revisaron 5 sitios (Vamos, Yummy SuperApp, Ridery, Farmatodo —bloqueado por protección anti-bot, no se pudo ver—, Farmacia SAAS). El más relevante fue **Yummy SuperApp** (superapp venezolana, el mismo partner de delivery que menciona el CLAUDE.md del proyecto): landing armada con tarjetas de ancho completo, cada una con su propio color sólido de fondo, esquinas muy redondeadas, texto blanco bold, e íconos/ilustraciones — cada tarjeta dirigida a una audiencia distinta (una es literalmente "Sign up with your merchant"). Es la misma estructura que necesita `/acerca-de` (3 audiencias en una sola página), resuelta con color en vez de texto plano.

## Objetivo

Rediseñar visualmente `/acerca-de` adoptando el patrón de "tarjetas de color por sección", reusando exclusivamente los colores ya definidos en `src/styles/dosisya-ui.css` (ninguno nuevo). **Sin cambios de contenido, copy, rutas ni funcionalidad** — es un rediseño puramente visual sobre la página ya aprobada.

## Alcance

### Archivo afectado
`src/routes/acerca-de.tsx` — se reescribe el JSX/estilos del componente `AcercaDe`. El `Route`/`head()` no cambian. La lógica de `construirUrlWhatsApp` y los mensajes de WhatsApp no cambian.

### Hero
- Fondo sólido `var(--verde-cruz)`, ancho completo (`full-bleed`, no limitado al `max-w-2xl` del contenido — igual que el resto de la página tiene fondo `--papel` de ancho completo hoy).
- Wordmark "DosisYa": ambas mitades en blanco (ya no puede usar el verde `--verde-cruz` para "Ya" porque el fondo ahora es ese mismo verde — sin contraste). Usar blanco puro para "Dosis" y un verde claro (`--verde-claro: #5fd6a4`) para "Ya", que sí contrasta sobre `--verde-cruz`.
- Frase de marketing (la misma que ya existe) en un tono claro semitransparente sobre el verde — por ejemplo `rgba(255,255,255,0.85)` o el token `--verde-claro`.
- Link "Volver a DosisYa" (arriba del todo): pasa de `--tinta-tenue` a blanco/semitransparente (`rgba(255,255,255,0.85)`) para verse sobre el fondo oscuro. Mismo ícono `ArrowLeft`, misma posición y comportamiento (`Link to="/"`).
- Padding vertical generoso (más que el resto de la página) para que el hero se sienta como un bloque propio, no un header angosto.

### Tarjeta "Para pacientes"
- Fondo sólido `var(--disp-fondo)` (`#eaf7f1`, el mismo verde clarito que ya usa la app para el estado "disponible" en tarjetas de resultado — coherente con el resto del sitio).
- Texto: título en `var(--verde-cruz)`, cuerpo en `var(--tinta)`.
- Ícono: `Search` (lucide-react) en un círculo/badge pequeño con `var(--verde-cruz)` como color de ícono.
- Mismo copy y botón "Buscar medicamentos" que ya existen (`Link to="/"`), sólido `var(--verde-cruz)` con texto blanco — sin cambios respecto a la versión actual.

### Tarjeta "Para farmacias"
- Fondo sólido `var(--ambar-receta)` (`#b45309`, el mismo ámbar que ya usa la app para el estado "borrador"/récipe).
- Texto: blanco (título y cuerpo) — necesario por contraste sobre el ámbar sólido.
- Ícono: `Building2` (lucide-react, ya se usa en `HeroBusqueda.tsx` para el link de farmacias) en blanco.
- Mismo copy que ya existe. Botón "Quiero unir mi farmacia" (mismo link de WhatsApp, mismo mensaje): pill blanco sólido con texto `var(--ambar-receta)` — invierte el esquema de color de la tarjeta, mismo patrón que Yummy usa para sus CTAs sobre tarjetas de color.

### Tarjeta "Para inversores y prensa"
- Fondo sólido `var(--tinta)` (`#16181a`, casi negro — tono deliberadamente distinto y más "serio/corporativo" que las otras dos tarjetas).
- Texto: blanco.
- Ícono: `TrendingUp` (lucide-react) en blanco.
- Mismo copy que ya existe. Botón "Contactar al equipo" (mismo link de WhatsApp, mismo mensaje): pill blanco sólido con texto `var(--tinta)`.

### Estructura común de las 3 tarjetas
- Ancho completo dentro del contenedor `max-w-2xl` de la página (a diferencia del hero, que es full-bleed).
- Esquinas muy redondeadas: `rounded-3xl` (Tailwind, ~24px).
- Padding generoso (`p-6` a `p-8`).
- Separación vertical entre tarjetas (`space-y-4` a `space-y-6`) — ya no hay que depender de `<h2>`/`<p>` con márgenes para diferenciarlas, el color ya las separa.
- Los `id` de anclas (`#pacientes`, `#farmacias`, `#inversores`) se mantienen en cada tarjeta.

### Fuera de alcance
- No cambia el copy de ninguna sección.
- No cambia el número de WhatsApp (`+584245928624`) ni los mensajes prellenados.
- No cambia el link agregado en `HeroBusqueda.tsx` (el que apunta a `/acerca-de` desde el home) — ese sigue igual, no forma parte de este rediseño.
- No se agrega una burbuja flotante de WhatsApp (patrón visto en Farmacia SAAS) — las 2 tarjetas con CTA de WhatsApp ya cubren ese contacto; agregar una burbuja persistente sería redundante y no fue pedido.
- No se introduce ningún color que no exista ya en `src/styles/dosisya-ui.css`.

## Verificación

Sin lógica nueva (solo cambios de estilos/estructura en un componente estático), la verificación es:
1. `npm run dev`, revisar visualmente `/acerca-de` en desktop y mobile — confirmar que las 4 zonas de color (hero + 3 tarjetas) tienen buen contraste de texto y se ven como bloques diferenciados, no como un texto plano.
2. Confirmar que los 3 CTAs siguen apuntando a los mismos destinos que antes (sin cambios funcionales).
3. `npx tsc --noEmit && npm run build` antes de dar por terminado (regla de CLAUDE.md).
