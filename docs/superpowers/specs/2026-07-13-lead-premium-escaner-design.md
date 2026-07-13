# Diseño: Lead Premium por Escáner de Récipe

**Fecha:** 2026-07-13
**Estado:** Aprobado (pendiente plan de implementación)
**Repos afectados:** DosisYa-Frontend y DosisYa-Backend

## 1. Contexto y objetivo

El escáner de récipe (spec `docs/features/receta-ia-y-carrito.md`, PR `feature/escaner-recipe-ia`
en backend) permite al paciente fotografiar su récipe y obtener la lista de medicamentos.
Farmacias consultadas confirmaron que pagarían bien por esta capacidad, en dos formas:
recibir pedidos ya digitalizados de pacientes, y una herramienta interna para descifrar
récipes que les llegan directo (mostrador / su propio WhatsApp).

**Decisión:** monetizar primero el lado del paciente vía **lead premium** (esta spec).
La herramienta interna queda como **fase 2** (sección 10), no diseñada aún.

**Principios que esta spec NO rompe:**
- Cero Fricción B2C: el paciente escanea gratis, sin registro, sin límites artificiales.
- Modelo CPC existente: se cobra por lead, no por venta ni por uso de la IA.

## 2. Modelo de negocio

**Lead premium** = todo lead (`clic_whatsapp`, `clic_llamar`, etc.) cuyo medicamento entró
a la Lista Médica a través del escáner de récipe.

Por qué vale más para la farmacia:
- Multi-producto: un récipe típico trae 3-5 medicamentos → el fan-out existente
  (un POST por medicamento) ya genera 3-5 leads de un solo paciente.
- Intención de compra probada: nadie escanea un récipe por curiosidad.
- Llega digitalizado: la farmacia no descifra letra de médico.

**Pricing (no se codifica; para cuando empiece la facturación):**
- Lead normal: precio base $X (a negociar).
- Lead-récipe: 2-3x el precio base, a validar con las farmacias.

**Durante la fase de tracción (actual):** no se cobra. Cada lead queda marcado con su
origen desde el día uno; el dashboard admin lo expone como argumento de venta
("este mes te envié N pedidos con récipe digitalizado").

**Costos de IA:** Gemini Flash (`gemini-flash-latest`) con billing habilitado en la cuenta
Google de la API key (~USD 0.001/escaneo). Explícitamente descartado migrar a modelos
más caros (p. ej. GPT-5 vision): 10-30x el costo sin mejora relevante para OCR de récipes.

## 3. Modelo de datos (backend)

Nueva columna en `leads_interacciones`, siguiendo el patrón de enums PG del schema:

```sql
CREATE TYPE origen_lead_enum AS ENUM ('busqueda', 'lista_medica', 'escaner_recipe');
ALTER TABLE leads_interacciones ADD COLUMN origen origen_lead_enum;
CREATE INDEX idx_leads_origen ON leads_interacciones (origen);
```

Semántica de valores:
- `busqueda` — clic directo desde una tarjeta de resultados (sin pasar por la lista).
- `lista_medica` — lead de una Lista Médica armada manualmente.
- `escaner_recipe` — el medicamento entró vía escáner. **Este es el premium facturable.**
- `NULL` — filas anteriores a esta feature (nunca se facturan como premium).

Reglas:
- Granularidad **por medicamento**, no por lista: lista mixta (3 escaneados + 1 manual)
  → 3 leads `escaner_recipe` + 1 `lista_medica`. El premium nunca se contamina.
- La columna es nullable a propósito: distingue "no sabemos" (histórico) de "búsqueda".

## 4. Contrato API

`POST /api/v1/leads/` (trailing slash obligatorio) acepta un campo nuevo **opcional**:

```json
{ "...campos actuales...": "...", "origen": "escaner_recipe" }
```

- Ausente → el backend guarda `busqueda` (default seguro: el premium nunca se infla
  por accidente ni por clientes viejos/bundles cacheados).
- Valor fuera del enum → 422 (validación Pydantic), consistente con el resto de la API.
- Antes de escribir código frontend se valida el contrato real con el skill
  `contrato-api` contra `models.py` / `routers/` del backend.

## 5. Frontend (propagación del origen)

El `origen` viaja con cada ítem desde que entra a la Lista Médica hasta el POST del lead:

- **`useListaMedica`**: cada ítem persiste `origen` en localStorage.
  - Agregado desde resultados del escáner → `escaner_recipe`.
  - Agregado manualmente desde una tarjeta → `lista_medica`.
  - Ítems viejos sin el campo → se tratan como `lista_medica` (nunca premium por accidente).
- **`leadsLista.ts`** (fan-out): cada POST lleva el `origen` de SU ítem.
- **`leads.ts`** (clic directo en tarjeta): envía `origen: 'busqueda'`.
- Leads siguen siendo fire-and-forget (`keepalive: true` cuando aplica); cero latencia añadida.

## 6. Dashboard admin

- El endpoint que alimenta el dashboard agrega desglose de leads por `origen`.
- `admin.dashboard.tsx` muestra junto al conteo actual una columna/badge **"Leads récipe"**
  por farmacia. Sin gráficas ni exportes (YAGNI).

## 7. Errores y compatibilidad

- `origen` opcional en el POST → clientes viejos siguen funcionando sin cambios.
- Valor inválido → 422.
- Filas históricas quedan `NULL`; ninguna migración de datos retroactiva.
- Agregar valores futuros al enum PG: `ALTER TYPE ... ADD VALUE` (no destructivo).

## 8. Testing

- **Backend:** POST con cada valor de `origen`; sin `origen` → persiste `busqueda`;
  valor inválido → 422. La migración no debe romper los 29 tests existentes.
- **Frontend:** `npx tsc --noEmit && npm run build` (regla del repo), y
  `scripts/test-leads-cpc.sh` extendido para verificar el `origen` en el fan-out
  (obligatorio tras tocar `leads*.ts`).

## 9. Fuera de alcance (esta fase)

- Pasarela de pago / facturación automatizada (el cobro sigue siendo manual cuando empiece).
- Cambios de precio en código o base de datos.
- Límites o cobro al paciente (rompería Cero Fricción).
- Migración de modelo de IA (se mantiene Gemini Flash).

## 10. Fase 2 (registrada, no diseñada): herramienta interna para farmacias

Caso de uso confirmado por farmacias: el cliente llega al mostrador con el récipe en papel
(o la foto llega al WhatsApp propio de la farmacia) y la farmacia lo escanea ella misma,
con matching contra SU inventario y cotización lista para responder.

- Modelo: suscripción mensual (orden de USD 20-50/farmacia, a validar).
- Requiere producto nuevo: autenticación de farmacia, panel, matching de inventario.
- Argumento de venta natural desde la fase 1: "ya te digitalizo los récipes que llegan
  por DosisYa; por $X/mes te digitalizo también los tuyos".
- Se diseñará en su propio ciclo (brainstorming → spec → plan) cuando la fase 1 tenga datos.

## Dependencias / prerrequisitos

1. Merge de los PRs del escáner (frontend #1 y backend #1) — el lead premium no tiene
   sentido sin el escáner en producción.
2. Billing habilitado en la cuenta Google de `GEMINI_API_KEY` (hoy el free tier tiene
   cuota 0 para imágenes; bloquea el escáner completo, no solo esta spec).
3. Smoke test real de Gemini Vision pendiente tras habilitar billing.
