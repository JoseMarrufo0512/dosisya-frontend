# Spec: Búsqueda v2 (sub-proyecto A) — y hoja de ruta de paneles

**Fecha:** 2026-07-12
**Estado:** aprobado en diseño, pendiente de plan de implementación
**Alcance de este spec:** sub-proyecto A (solo frontend). B y C se documentan como fases futuras con sus propios specs.

## 1. Contexto y decisiones cerradas en esta sesión

José pidió "todos los paneles": panel de búsqueda + panel de usuario registrado. Decisiones tomadas:

1. **La filosofía "Cero Fricción" se mantiene intacta.** El registro de pacientes será **100% opcional**: buscar, armar la Lista Médica y contactar siguen sin login. El registro solo desbloquea beneficios extra.
2. **Backend autorizado.** José autorizó expresamente trabajar en `DosisYa-Backend` para lo que lo requiera (fases B y C). Cada cambio de backend pasa por spec antes de implementarse.
3. **Descomposición y orden aprobados: A → B → C.**
   - **A. Búsqueda v2** — solo frontend (este spec).
   - **B. Farmacias en contexto** — backend chico (lat/lng en búsqueda + perfil público de farmacia) + mapa Leaflet/OSM + vista detalle.
   - **C. Cuenta de paciente + panel de usuario** — cuentas de paciente con Google Sign-In (v1); login por teléfono/OTP WhatsApp queda para después (fragilidad actual de OpenWA). Beneficios: lista médica sincronizada, recordatorios en la cuenta, historial de búsquedas/contactos, perfil y direcciones.
4. **Decisiones visuales (companion):** layout de resultados = **"Lista enfocada"** (evolución del actual); hero = **"Accesos rápidos" + señales de confianza**.

## 2. Sub-proyecto A: Búsqueda v2

### 2.1 Restricción rectora

A trabaja **exclusivamente con la respuesta actual de `GET /api/v1/medicamentos/buscar`** (máx. 20 resultados): farmacia (nombre, dirección, whatsapp, nivel_suscripcion, tiene_delivery), medicamento (principio_activo, marca_comercial, presentacion), precio_usd, precio_ves, distancia_metros, score_similitud. **Cero llamadas nuevas, cero campos inventados.**

Explícitamente fuera de A (faltan campos en BD; van en B/C): filtro "abierto ahora" (`horario`), filtro/badge "verificada" por farmacia (`verificada`), mapa (falta lat/lng en la respuesta), vista detalle de farmacia (falta endpoint público).

### 2.2 Hero (variante C + confianza)

- Buscador grande centrado (comportamiento actual intacto).
- **Chips de categorías**: mapa curado `categoría → término de búsqueda real` en `src/lib/categorias.ts` (la API busca por principio activo/marca, no por categoría). 4–6 categorías iniciales, p. ej.: Dolor y fiebre → `acetaminofen`, Gripe y alergia → `loratadina`, Tensión → `losartan`, Antibióticos → `amoxicilina`. Tocar un chip ejecuta la búsqueda normal con ese término.
- **Recordatorios de resurtido vencidos** al frente (reutiliza `useRecordatorios`; render solo tras `montado`, patrón SSR-safe existente).
- **Búsquedas recientes** como chips (reutiliza `useBusquedasRecientes`).
- **Fila de señales de confianza** bajo el buscador: "✅ Farmacias verificadas · 💵 Precios en $ y Bs · 🛵 Delivery local" (texto estático, mismo espíritu del sello de confianza ya existente; badges por-farmacia llegan con el campo real en B/C).

### 2.3 Resultados (layout "Lista enfocada")

- Una sola columna de tarjetas rediseñadas: **precio USD protagonista** (grande, a la derecha), nombre + presentación arriba, farmacia + distancia + iconos secundarios abajo. Se conservan las pills existentes: Genérico, más económico, delivery, aviso de récipe.
- **`BarraFiltros` sticky** bajo la búsqueda:
  - Rango de precio: slider min/max calculado de los resultados recibidos.
  - Distancia máxima: refina dentro del radio ya buscado, sin nueva llamada.
  - Genérico / marca / todos.
  - Delivery (existente) y orden relevancia/precio (existente) se integran en la misma barra.
- El filtrado es un `useMemo` **puro** sobre los resultados en memoria.

### 2.4 Comparador

- Botón "Comparar" en cada tarjeta → `Set<id>` local, máximo 3.
- Barra inferior fija "Comparar (n)" al haber ≥2 seleccionados.
- Panel lado a lado: drawer (vaul) en móvil, modal en desktop. Columnas: precio USD/VES, distancia, delivery, presentación, pill genérico y botón WhatsApp por farmacia.
- Cada clic de WhatsApp dispara su lead `clic_whatsapp` **fire-and-forget** con la infra existente (`leads.ts`, `whatsapp.ts`). Sin cambios de contrato.

### 2.5 Componentes (descomposición de App.tsx)

`App.tsx` (hoy 354 líneas, concentra demasiado) queda como orquestador delgado (estado hero/resultados, query, composición). Se extraen:

| Unidad | Responsabilidad | Depende de |
|---|---|---|
| `src/components/HeroBusqueda.tsx` | Hero variante C + confianza | `useRecordatorios`, `useBusquedasRecientes`, `categorias.ts` |
| `src/components/BarraFiltros.tsx` | Filtros client-side; emite objeto `Filtros` | resultados (para min/max) |
| `src/components/ComparadorBar.tsx` | Barra inferior "Comparar (n)" | selección local |
| `src/components/ComparadorPanel.tsx` | Panel comparación lado a lado | resultados seleccionados, `leads.ts`, `whatsapp.ts` |
| `src/components/TarjetaResultado.tsx` | Rediseño + botón Comparar (archivo existente) | — |
| `src/lib/categorias.ts` | Mapa categoría → término | — |
| `src/lib/filtros.ts` | Funciones puras de filtrado/orden | — |

### 2.6 Estados y errores

- **0 resultados por filtros** (había resultados, los filtros los ocultan): mensaje "Ningún resultado cumple los filtros" + botón "Limpiar filtros". Distinto del vacío real de la API (que ya ofrece ampliar radio).
- Recordatorios/recientes solo tras `montado` (sin hidratación rota).
- POST de leads nunca bloquea la UI (regla #2 de CLAUDE.md).

### 2.7 Verificación

- `npx tsc --noEmit && npm run build` antes de cada commit.
- `scripts/test-leads-cpc.sh` tras tocar cualquier código que dispare leads.
- Prueba manual móvil (375px) y desktop con `npm run dev`.
- El filtrado vive en funciones puras (`filtros.ts`); no se introduce test runner de unidades en A (el repo no tiene vitest hoy).

## 3. Fases futuras (specs propios, no implementar aún)

### Fase B — Farmacias en contexto
- **Backend (autorizado):** agregar `ST_Y/ST_X(f.ubicacion)` como `lat`/`lng` al SELECT de `_BUSCAR_MEDICAMENTOS`; nuevo `GET /api/v1/farmacias/{id}/perfil` público (info + inventario visible). Evaluar migración para `horario` y `verificada`.
- **Frontend:** mapa de resultados con **Leaflet + OpenStreetMap** (gratis, sin API key); vista detalle de farmacia; filtros "abierto ahora"/"verificadas" cuando existan los campos.

### Fase C — Cuenta de paciente + panel de usuario
- **Auth v1: solo Google Sign-In.** El frontend obtiene el ID token (Google Identity Services); el backend lo verifica y emite JWT propio (`POST /api/v1/auth/google`, rol nuevo p. ej. `paciente`). **Login por teléfono/OTP WhatsApp: v2**, cuando OpenWA sea confiable para OTPs (historial de bloqueos de cuenta).
- **Backend:** tabla de pacientes; endpoints de lista médica, recordatorios, historial de búsquedas/contactos, perfil y direcciones.
- **Frontend:** panel `/mi-cuenta`; al iniciar sesión se hace **merge** de lo que ya vive en localStorage (nada se pierde, nada se exige). El flujo anónimo permanece 100% funcional.
- Sensibilidad: el historial de salud del paciente es dato sensible — el spec de C debe cubrir borrado de cuenta/historial.

## 4. Criterios de éxito de A

1. Buscar sigue funcionando exactamente igual para quien ignore lo nuevo (cero regresiones en leads y Lista Médica).
2. Filtros y comparador operan sin ninguna llamada extra a la API.
3. Hero muestra categorías, recientes, resurtidos vencidos y señales de confianza sin romper SSR.
4. `tsc` + `build` limpios; `test-leads-cpc.sh` en verde.
