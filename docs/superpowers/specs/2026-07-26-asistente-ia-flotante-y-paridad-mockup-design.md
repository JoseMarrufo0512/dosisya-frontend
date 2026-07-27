# Asistente IA flotante + paridad con el mockup de navegación — Diseño

**Fecha:** 2026-07-26
**Estado:** Aprobado (diseño). Pendiente de plan de implementación.
**Origen:** `docs/design_handoff_dosisya/NavegacionInferior.dc.html` (handoff Design Companion).

## En una frase

Cerrar la paridad entre el mockup de navegación y la app real del paciente, que ya
implementa ~90 % del handoff, agregando: un **Asistente IA flotante y arrastrable**
global, manejo del **botón atrás del teléfono** para todos los overlays, un **chip de
tasa** (frontend listo, backend pendiente), el **placeholder de mapa** en Farmacias, y
la **consolidación** de la ruta demo `/busqueda` duplicada.

## Contexto y estado actual

La app real (`src/App.tsx` + `src/components/navegacion/` + `src/components/paciente/`)
**ya implementa** casi todo el mockup: navegación inferior (Buscar/Farmacias/FAB
escáner/Lista/Más) con la animación `packFly`, la pantalla de inicio (`HeroBusqueda`)
con buscador+cámara, chips de categoría, chips de recientes con reloj (`BarraBusqueda`),
ubicación, señales de confianza y toggle de delivery; la hoja "Más" (`MenuMasPaciente`)
con sus cuatro sub-hojas (Recordatorios, Comparar, Ayuda, Asistente IA); la Lista Médica
(`ListaMedicaDrawer`), el escáner de récipe (`EscanerRecipe`), el login opcional
(`HojaLoginPaciente`) y el comparador sobre resultados (`ComparadorPanel`).

Existe además una **ruta demo aislada** `src/routes/busqueda.tsx` que ensambla una copia
paralela de componentes en `src/components/busqueda/*` con datos mock. **Verificado:**
nada de la app real la importa ni enlaza a `/busqueda`; es un islote seguro de eliminar.

Los únicos huecos reales frente al mockup son los cinco de este spec.

## Piezas

### 1 · Asistente IA flotante y arrastrable (función nueva)

**Problema:** hoy el Asistente IA está enterrado dentro de la hoja "Más". Se quiere una
burbuja siempre visible en cualquier pantalla, movible por el usuario.

**Diseño:**

- **Extracción del chat.** `HojaChatIA` vive hoy como función anidada dentro de
  `src/components/paciente/MenuMasPaciente.tsx`. Se extrae a su propio archivo
  `src/components/paciente/HojaChatIA.tsx` (exportando también las piezas compartidas
  `HojaBase`/`Asa` a un `src/components/paciente/_hoja.tsx` si conviene evitar duplicar).
  El comportamiento del chat no cambia (sigue siendo UI con respuesta "en desarrollo"
  hasta que exista endpoint de chat en backend).
- **Estado único del chat en `App`.** Se agrega `chatIAAbierto` a `App.tsx`. Tanto la
  burbuja como el ítem "Asistente IA" de `MenuMasPaciente` abren **la misma** instancia.
  `MenuMasPaciente` recibe una prop `onAbrirChatIA` en lugar de manejar el chat
  internamente (se elimina el sub-estado `"ia"` de su `SubHoja`).
- **`src/components/paciente/BurbujaAsistenteIA.tsx`.** Montada una sola vez en `App`,
  fija sobre toda la UI (`position: fixed`, `z-index` por encima de la nav pero por
  debajo de los overlays abiertos). Burbuja verde circular (`var(--verde-cruz)`, ícono
  `Sparkles`), ~56 px.
  - **Arrastre:** framer-motion `drag` con `dragConstraints` al viewport y
    `dragMomentum={false}`. Posición inicial: abajo-derecha, por encima de la nav y de la
    barra de Lista.
  - **Persistencia:** la posición se guarda en `localStorage` (clave
    `dosisya:burbujaIA:pos`) y se restaura al montar; se re-encaja (clamp) al viewport en
    `resize` para no quedar fuera de pantalla.
  - **Tap vs arrastre:** se distingue por umbral de desplazamiento en `onDragEnd`
    (p. ej. < 6 px de movimiento total ⇒ tap ⇒ abre el chat; si hubo arrastre real, no
    dispara la apertura).
  - **Visibilidad:** oculta mientras el chat está abierto; respeta
    `prefers-reduced-motion` (sin animación de entrada).
  - **Accesibilidad:** `role="button"`, `aria-label="Abrir asistente IA"`, foco visible
    (`dy-foco`), operable con teclado (Enter/Espacio abre el chat).

### 2 · Botón atrás del teléfono → cierra todos los overlays

**Problema:** en móvil, el back de Android / gesto cierra la app cuando hay una hoja
abierta, en vez de cerrar la hoja.

**Diseño:**

- **`src/hooks/useBackDismiss.ts`** — `useBackDismiss(open: boolean, onClose: () => void)`.
  - En la transición `false → true`: `history.pushState({ dosisyaOverlay: true }, "")`.
  - Listener de `popstate` mientras `open`: llama `onClose()` (el usuario presionó atrás).
  - Cierre **programático** (open pasa a `false` sin venir de `popstate`, p. ej. botón X o
    tap en el backdrop): hace `history.back()` para consumir la entrada que empujamos.
  - **Guardas:** un `ref` marca si nosotros empujamos la entrada y otro flag distingue el
    cierre-por-back del cierre-programático, para evitar bucles y dobles `pop`.
- **Aplicación:** el hook se usa en cada overlay: `MenuMasPaciente` (y sus sub-hojas),
  `HojaLoginPaciente`, `EscanerRecipe`, `ListaMedicaDrawer`, `ComparadorPanel` y el Chat
  flotante. Para los que usan vaul (`Drawer.Root` con `onOpenChange`), el hook se integra
  con ese `onOpenChange` sin duplicar el manejo de cierre.
- **Apilamiento:** cada overlay abierto empuja su propia entrada; back cierra el de más
  arriba primero (comportamiento tipo pila, coherente con nativo).

### 3 · Chip de tasa (frontend listo, backend pendiente)

**Restricción verificada:** el backend solo aplica la tasa **dentro** de la búsqueda
(`precio_ves = precio_usd × tasa`, router `medicamentos.py`, tabla `tasas_cambio`). El
tipo `ResultadoFarmacia` del frontend **no** trae `tasa_aplicada`/`tasa_fecha`, y **no
existe** un endpoint GET de tasa vigente. Mostrar la tasa en el inicio (antes de buscar)
requiere backend.

**Decisión (usuario):** pedir el endpoint al backend. El backend está fuera de alcance
sin autorización expresa (regla #3 del CLAUDE.md), así que este spec **redacta el
contrato** para solicitarlo y deja el frontend listo con degradación elegante.

**Contrato solicitado al backend:**

```
GET /api/v1/tasa-actual        (sin trailing slash, como PATCH /farmacias/{id})
200 OK
{
  "status": "success",
  "message": "Tasa vigente",
  "data": {
    "tasa": 145.20,                       // USD → VES, Decimal > 0
    "fecha": "2026-07-26T08:15:00-04:00"  // timestamp de la tasa aplicada
  }
}
```

Fuente en backend: la misma fila usada por `_OBTENER_TASA` en `medicamentos.py`
(`SELECT tasa FROM tasas_cambio … ORDER BY … LIMIT 1`) más su timestamp. Es un endpoint
de solo lectura, público (sin auth), coherente con la búsqueda.

**Frontend:**

- **`src/hooks/useTasa.ts`** — TanStack Query contra `GET /api/v1/tasa-actual`; devuelve
  `{ tasa, fecha }` o `null`. Sin reintentos agresivos; `staleTime` alto (p. ej. 5 min).
- **Chip de tasa** en el header del inicio (esquina superior derecha de `HeroBusqueda`),
  formato venezolano (`Bs 145,20/$`, coma decimal, `.dy-num`).
  **Degradación:** si `useTasa` no tiene dato (endpoint aún inexistente, error o
  cargando) el chip **no se renderiza** — nada roto, la app funciona igual que hoy.
- **No** hardcodear la tasa. El chip solo muestra dato real del endpoint.

### 4 · Placeholder de mapa en Farmacias

**Diseño:** en `vistaFarmacias` (`App.tsx`), sobre la lista de farmacias cercanas, se
añade la caja del mockup: fondo de rayas diagonales (`repeating-linear-gradient`), un par
de pines (`MapPin`) y la etiqueta monoespaciada "mapa · farmacias cercanas". Es un
**placeholder visual** idéntico al handoff (que también es placeholder), no un mapa real
ni una integración de mapas. `aria-hidden` en los adornos.

### 5 · Consolidar la ruta demo `/busqueda`

**Diseño:** eliminar `src/routes/busqueda.tsx` y toda la carpeta
`src/components/busqueda/*` (`BarraBusqueda`, `BloquePrecio`, `CabeceraTasa`,
`EstadoVacio`, `NavegacionInferior`, `SkeletonResultado`, `TarjetaMedicamento`). Islote
verificado: solo la propia demo se importa a sí misma. Tras borrar, TanStack Router
regenera `src/routeTree.gen.ts` (auto-generado; no editar a mano) al correr `npm run dev`
o el build. La app real queda como única implementación de la pantalla de búsqueda.

## Componentes y archivos afectados

**Nuevos:**
- `src/components/paciente/HojaChatIA.tsx` (extraído de `MenuMasPaciente`)
- `src/components/paciente/BurbujaAsistenteIA.tsx`
- `src/hooks/useBackDismiss.ts`
- `src/hooks/useTasa.ts`

**Modificados:**
- `src/App.tsx` — estado `chatIAAbierto`, monta `BurbujaAsistenteIA` + `HojaChatIA`, chip
  de tasa vía `useTasa`, placeholder de mapa en `vistaFarmacias`, back-dismiss en los
  overlays que orquesta.
- `src/components/paciente/MenuMasPaciente.tsx` — quita el chat interno; "Asistente IA"
  llama `onAbrirChatIA`; back-dismiss.
- `src/components/HeroBusqueda.tsx` — chip de tasa en el header.
- `src/components/paciente/HojaLoginPaciente.tsx`, `src/components/EscanerRecipe.tsx`,
  `src/components/lista/ListaMedicaDrawer.tsx`, `src/components/ComparadorPanel.tsx` —
  integran `useBackDismiss`.

**Eliminados:**
- `src/routes/busqueda.tsx`, `src/components/busqueda/*`.

## Flujo de datos

- **Chat IA:** `App` posee `chatIAAbierto`; burbuja y "Más" lo togglean; `HojaChatIA` lo
  consume. Mensajes locales (sin backend de chat todavía).
- **Tasa:** `useTasa` (Query) → chip; independiente de la búsqueda. Sin endpoint ⇒ `null`
  ⇒ chip oculto.
- **Back-dismiss:** cada overlay empuja/consume su propia entrada de `history`; no hay
  estado global compartido más allá del `history` del navegador.

## Manejo de errores y casos borde

- **Tasa sin endpoint / error / offline:** chip oculto (no bloquea, no muestra "0").
- **Burbuja fuera de viewport tras `resize` o rotación:** clamp a los bordes al restaurar
  y en `resize`.
- **`prefers-reduced-motion`:** burbuja sin animación de entrada; arrastre sigue
  disponible (es interacción directa, no animación decorativa).
- **Back con varios overlays apilados:** cierra el superior primero.
- **Cierre programático vs back:** las guardas del hook evitan `history.back()` duplicado
  o bucles de `popstate`.
- **SSR (TanStack Start):** `useBackDismiss` y la lectura de `localStorage`/`history` solo
  tocan `window` tras montar en cliente (patrón `montado` ya usado en `App`).

## Testing / verificación

- **Obligatorio antes de commit** (CLAUDE.md §6): `npx tsc --noEmit && npm run build`.
- **Manual en preview:** abrir cada overlay y confirmar que el back del navegador/teléfono
  lo cierra sin salir de la app; arrastrar la burbuja y recargar para confirmar que
  recuerda su posición; verificar que el chip de tasa está oculto mientras no exista el
  endpoint (comportamiento actual) y que aparece si se simula la respuesta.
- **No** se toca el flujo de leads ni `whatsapp.ts`, así que `scripts/test-leads-cpc.sh`
  no aplica.

## Fuera de alcance

- Implementar el endpoint `GET /api/v1/tasa-actual` en el backend (requiere autorización
  expresa; queda como solicitud redactada).
- Respuesta real del Asistente IA (no hay endpoint de chat; sigue "en desarrollo").
- Un mapa real de farmacias (solo placeholder visual, como el handoff).
- Cualquier refactor no relacionado con estas cinco piezas.
