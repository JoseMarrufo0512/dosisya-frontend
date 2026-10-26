# Feature: Localizador de Farmacias en Mapa

> **Estado:** SPEC / diseño para tu revisión (2026-10-26). **No implementado.**
> Coordina **dos repos**: añade un endpoint público en `DosisYa-Backend`
> (autorización expresa dada — CLAUDE.md §2) y una ruta nueva en el frontend.
> Relacionado: la lección del `(0,0)` y `ubicacion_configurada` (CLAUDE.md §5).

## 1. Objetivo
Una página pública (sin login, Cero Fricción) que muestre en un **mapa + lista
sincronizados** las farmacias afiliadas a DosisYa. Página **híbrida**:

- **Cobertura:** por defecto pinta *todas* las farmacias activas y ubicadas →
  sirve de prueba social ("mira cuántas ya están") y de descubrimiento.
- **Cercanía:** si el paciente concede GPS, centra el mapa en su posición y
  ordena la lista por distancia. Si no, centra en Acarigua/Araure y muestra todo.

Desde cada farmacia el paciente puede **contactar por WhatsApp**, generando un
lead CPC (el activo que se cobra).

## 2. Alcance
**Incluye:** endpoint público de listado, ruta `/farmacias`, mapa Leaflet
client-only, lista filtrable, sincronía lista↔mapa, orden por cercanía opcional,
botón WhatsApp → lead.
**No incluye (por ahora):** ruteo/navegación paso a paso, clustering avanzado
(ver §9), búsqueda de inventario desde el mapa, perfiles de farmacia con horarios.

## 3. Decisiones confirmadas
- **Tipo de página:** híbrida (todas + resaltar cercanas con GPS).
- **Tecnología de mapa:** **Leaflet + `react-leaflet`**, tiles OSM en MVP
  (MapTiler free-tier en producción si el volumen lo exige). Gratis/free-tier,
  sin tarjeta, ligero, sin vendor-lock → encaja con la operación consciente de
  costos.
- **Render:** mapa **client-only + lazy** (Leaflet necesita `window`); la lista
  renderiza en SSR. Patrón `.client()`/`.server()` ya usado en
  `src/routes/producto.$farmaciaId.$medicamentoId.tsx`.

## 4. Decisiones PENDIENTES (confirmar antes de implementar)
1. **Nombre de ruta:** recomiendo `/farmacias` (alternativas `/tiendas`,
   `/cobertura`).
2. **¿El contacto desde el mapa es lead facturable?** Recomendación: **sí**, con
   `tipo_interaccion: "clic_whatsapp"` (es intención de compra válida). Opcional:
   emitir `ver_mapa` (no facturable, analítica) al abrir el popup de un pin.
   **Confirmar con el skill `contrato-api`** antes de cablear.
3. **Riesgo competitivo:** mostrar públicamente *toda* la red afiliada permite que
   un competidor la mapee. La ubicación de un negocio es pública, así que
   recomiendo mostrarla; decisión de negocio.
4. **Volumen de farmacias:** define si hace falta clustering/paginación desde el
   MVP (ver §9).

## 5. Contrato backend (Fase 0 — skill `contrato-api`)
Endpoint **nuevo, público, read-only** (hoy no existe fuente pública de todas las
farmacias con coordenadas: el buscador exige medicamento + radio 50 km, y
`/admin/farmacias` está protegido y expone facturación).

- **Ruta propuesta:** `GET /api/v1/farmacias/` (confirmar nombre y trailing slash
  con `contrato-api`, para no colisionar con rutas existentes).
- **Respuesta (JSON, array). Cero PII, cero facturación:**
  | Campo | Tipo | Nota |
  |---|---|---|
  | `id` | uuid | |
  | `nombre` | string | |
  | `sector` | string\|null | para filtro por zona |
  | `punto_referencia` | string\|null | ayuda a ubicar |
  | `whatsapp` | string | para el lead |
  | `lat` | float | `ST_Y(ubicacion)` |
  | `lng` | float | `ST_X(ubicacion)` |
  | `nivel` | `"gratuita"\|"premium"` | estilar pin premium (opcional) |
- **Filtro server-side obligatorio:** solo farmacias **activas/aprobadas** y con
  **`ubicacion_configurada`** → reusar el predicado de `dosisya/geo.py` (epsilon
  compartido), **nunca** devolver una farmacia en `(0,0)`.
- **No auth. Rate-limit suave. `Cache-Control` generoso** (el listado cambia poco;
  importa en conexiones lentas).
- **Seguridad:** encaja con la auditoría 2026-10 (sin PII, sin datos de cobro,
  solo lectura). No expone `correo`, `password_hash`, `facturas`, ni pacientes.

## 6. Modelo de datos frontend
- Nuevo tipo `FarmaciaMapa` y función `listarFarmaciasMapa()` en `src/lib/`
  (archivo `farmaciasMapa.ts` o extensión de `api.ts`), siguiendo el patrón de
  `API_BASE` (`""` relativo en cliente vía proxy mismo-origen; URL absoluta en
  SSR por `import.meta.env.SSR`).
- Fetch + caché con **TanStack Query** (`staleTime` alto; el listado es estable).
- Distancia en cliente con **haversine** usando `lat`/`lng` del endpoint (no se
  pide al backend; evita un round-trip por-usuario).

## 7. Arquitectura frontend
- **Ruta:** `src/routes/farmacias.tsx` (pública, sin login).
- **Nuevo dominio `src/components/mapa/`** (sigue la convención por dominio):
  - `MapaFarmacias` — el `<MapContainer>` de Leaflet. **Client-only + lazy**
    (import diferido); SSR muestra placeholder/skeleton.
  - `ListaFarmaciasMapa` — lista lateral (SSR), ordenable por cercanía.
  - `TarjetaFarmaciaMapa` — nombre, sector, punto de referencia, botón WhatsApp.
  - `FiltrosMapa` — por sector/ciudad y búsqueda por nombre.
- **Estado compartido** (farmacia seleccionada) en la página: seleccionar en la
  lista centra el pin y abre su popup; click en el pin resalta la tarjeta.
- **Pin de marca** (color salud, sin gradientes genéricos); pin distinto para
  premium si se incluye `nivel`.

## 8. Flujo (Happy Path)
1. SSR renderiza header + `ListaFarmaciasMapa` con skeleton; el mapa hidrata en
   cliente (lazy).
2. `listarFarmaciasMapa()` trae el array (cacheado).
3. **GPS opcional** (`useGeolocalizacion`): si se concede permiso → centrar en la
   posición del paciente y ordenar la lista por cercanía (haversine). Si no →
   centrar en Acarigua/Araure y mostrar todas, sin bloquear.
4. Pines en el mapa + tarjetas en la lista, sincronizados.
5. Click en "Contactar por WhatsApp" de una tarjeta:
   - Disparar `postLead(...)` (único emisor; `tipo_interaccion` según §4.2;
     `medicamento_buscado_id = null` → el guard UUID de `postLead` ya lo maneja).
     Fire-and-forget, `keepalive: true` porque se abre `wa.me` acto seguido.
   - Abrir `wa.me/<whatsapp>?text=<mensaje prellenado>`.

## 9. Edge cases, rendimiento y conexiones lentas
- **Lazy-load de Leaflet JS/CSS** → no engorda landing ni buscador.
- **Estado vacío:** "Aún no hay farmacias en tu zona" (lista y mapa).
- **Fallo de red del listado:** diseño de "conexión inestable" + reintentar.
- **GPS denegado/no soportado:** fallback silencioso al centro de la zona (como el
  buscador público); nunca error bloqueante.
- **Defensa contra `(0,0)`:** ya filtrado server-side; filtrar también en cliente
  por si acaso.
- **Clustering** (`leaflet.markercluster`) **solo si el volumen lo amerita**
  (decisión §4.4); en MVP, probablemente innecesario.
- **Anti-spam del lead:** deshabilitar el botón WhatsApp ~2 s tras el primer clic
  (igual que el buscador).
- **Tiles cross-origin:** son imágenes de otro dominio (no la API); verificar que
  no los bloquee un adblocker y que carguen en preview.

## 10. Plan de implementación (TDD)
1. **Fase 0** — Contrato del endpoint (`contrato-api`); cerrar §4 y §5.
2. **Fase 1** — Backend: implementar `GET /api/v1/farmacias/` (con tu OK, commit a
   commit; validar contra `schema.sql`/`models.py`).
3. **Fase 2** — Frontend infra: instalar Leaflet, wrapper SSR-safe, `FarmaciaMapa`
   + `listarFarmaciasMapa()` (tests primero).
4. **Fase 3** — Ruta `/farmacias` + componentes `mapa/`, sincronía, GPS, lead.
5. **Fase 4** — Rendimiento, edge cases, pulido de marca.

## 11. Verificación
- Tests unitarios: `listarFarmaciasMapa` (fetch/parse), orden por cercanía
  (haversine), filtros, guard `(0,0)`.
- `npx tsc --noEmit && npm run build` antes de cualquier commit.
- `scripts/test-leads-cpc.sh` tras cablear el lead del mapa.
- **Preview deploy:** `/api/v1/farmacias/` devuelve 200 por el proxy mismo-origen;
  tiles cargan (probar con adblocker activo); flujo en **móvil** con GPS
  concedido y denegado.

## 12. Riesgos
- **Elegir mal el `tipo_interaccion`** del lead del mapa corrompe la métrica
  facturable → cerrar §4.2 con `contrato-api` antes de implementar.
- **Tile usage policy de OSM** en producción con tráfico real → migrar a MapTiler
  free-tier si hace falta.
- **Exposición de la red afiliada** (§4.3) — decisión de negocio.
- **Backend cambia contrato** → desplegar backend antes que frontend y tolerar la
  ausencia del endpoint durante la transición (la página degrada a solo-lista
  vacía, no rompe).
