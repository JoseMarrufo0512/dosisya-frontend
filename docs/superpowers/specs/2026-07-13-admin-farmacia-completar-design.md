# Spec: Completar el Admin de Farmacia (sub-proyecto)

**Fecha:** 2026-07-13
**Estado:** aprobado en diseño, pendiente de plan de implementación
**Contexto:** José pidió pausar el trabajo de base de datos/Vercel y continuar con las otras caras de la plataforma. La búsqueda (Búsqueda v2, ver `2026-07-12-busqueda-v2-design.md`) está avanzada; faltan el panel super admin y el admin de farmacia. Se decidió empezar por el admin de farmacia (más chico) y dejar el super admin como sub-proyecto separado, a diseñar después.

## 1. Estado actual (verificado antes de diseñar)

- `src/routes/admin.login.tsx` — login + wizard de registro en 3 pasos. **No se toca en este sub-proyecto.**
- `src/routes/admin.dashboard.tsx` — ya existe con 4 secciones: Inicio, Mi Inventario, Configuración, Soporte.
- Backend: `GET /api/v1/farmacias/{id}/dashboard` (protegido con JWT) ya devuelve mucha más información de la que el frontend usa hoy: `nombre_farmacia`, `estado_afiliacion`, `nivel_suscripcion`, `pacientes_interesados_hoy`, `busquedas_zona` (siempre `null`, MVP), `busquedas_zona_disponible` (`false`), `inventario[]`, `total_leads_mes_actual`, `leads_recipe_mes_actual`, `deuda_estimada_usd`, `tarifa_por_lead_usd`, `leads_recientes[]`.
- Autorización por recurso ya implementada en backend: `admin_farmacia` solo ve/edita su propia farmacia; `superadmin` puede ver cualquiera (`rol` viene en el JWT, claim `sub` = farmacia_id).

## 2. Bugs encontrados (a corregir)

1. **"Total en Inventario" lee un campo que no existe.** El frontend usa `data?.total_inventario`, pero el backend nunca devuelve esa clave (solo `inventario: []`). El conteo real es `data.inventario.length`.
2. **Fallback de inventario con datos falsos.** `InventarioSection` usa un array hardcodeado (Acetaminofén, Ibuprofeno, Amoxicilina, Loratadina) cuando `data` es `null` — si hay un error real de red, el dueño de farmacia ve productos que no son los suyos, sin saberlo.
3. **"Búsquedas cerca de ti" se muestra como dato pendiente de cargar ("—")** cuando en realidad el backend manda `null` a propósito (`busquedas_zona_disponible: false`, feature no implementada aún). Comunica mal el estado.

## 3. Backend — `PATCH /api/v1/farmacias/{id}` (autorizado por José)

Nuevo endpoint en `DosisYa-Backend/src/dosisya/routers/farmacias.py`, siguiendo el mismo patrón de auth que `get_dashboard_farmacia`.

- **Auth:** `Depends(verify_token)`, mismo JWT bearer que el resto del router.
- **Autorización por recurso:** idéntica a la del dashboard — `admin_farmacia` solo edita su propia farmacia (`token_data["sub"] == farmacia_id`); `superadmin` puede editar cualquiera.
- **Body (Pydantic, PATCH parcial — todos los campos opcionales):**
  ```python
  class FarmaciaUpdate(BaseModel):
      nombre_farmacia: str | None = Field(None, min_length=2, max_length=200)
      whatsapp: str | None = Field(None, pattern=r"^\+58\d{10}$")
      sector: str | None = Field(None, max_length=100)
      punto_referencia: str | None = Field(None, max_length=500)
  ```
- **Fuera de alcance a propósito:** `rif` (identidad legal) y `correo` (login) no son editables desde este endpoint.
- **Respuesta:** `RespuestaEstructurada` con los datos actualizados de la farmacia, para que el frontend pueda refrescar nombre/sidebar sin un segundo fetch.
- **Errores:** 400 UUID inválido, 401 sin token, 403 farmacia ajena, 404 no existe, 422 validación Pydantic, 500 error interno — mismo patrón que el resto de `farmacias.py`.
- **SQL:** `UPDATE farmacias SET ... WHERE id = $1`, solo columnas presentes en el body (build dinámico o `COALESCE`), parámetros posicionales (regla de seguridad del proyecto).

## 4. Frontend — Inicio (fixes)

- `MetricCard` de "Total en Inventario": usa `inventoryCount ?? data?.inventario?.length ?? 0` (prioridad al conteo del último upload para reflejo instantáneo, luego el valor real del fetch).
- `MetricCard` de "Búsquedas cerca de ti": cuando `data?.busquedas_zona_disponible === false`, el hint cambia a "Próximamente" en vez de mostrar el valor como si fuera un "—" de carga.
- `InventarioSection`: se elimina el array hardcodeado de fallback. Si `data` es `null` (error real), la tabla no renderiza filas falsas — el banner de error de arriba ya cubre ese caso. Si `data.inventario` es `[]` real, se usa el estado vacío existente ("Aún no tienes inventario cargado...").

## 5. Frontend — Facturación (sección nueva)

Nuevo ítem en el `nav` del sidebar (entre Inventario y Configuración), tipo `SectionId` extendido con `"facturacion"`, ícono `Receipt` o `DollarSign` de lucide-react.

- **3 metric cards:**
  - Leads este mes (`total_leads_mes_actual`)
  - Tarifa por lead (`tarifa_por_lead_usd`, formato `$X.XX`)
  - Deuda estimada del mes (`deuda_estimada_usd`, visualmente destacada — es el dato más sensible para el dueño)
- **Lista/tabla de leads recientes** (`leads_recientes[]`): fecha/hora (formateada legible), tipo de interacción traducido a texto humano (mapa fijo: `clic_whatsapp` → "Clic a WhatsApp", `clic_llamar` → "Llamada", `ver_mapa` → "Vio el mapa", `ver_detalle` → "Vio detalle", `compartir` → "Compartió", `capture_pantalla` → "Captura de pantalla"), medicamento buscado (`medicamento_nombre` + `medicamento_marca` si existen, o "—" si `medicamento_buscado_id` es `null`, ej. leads de Lista Médica multi-producto). Mismo patrón responsive que la tabla de Inventario (tabla en desktop ≥sm, cards en mobile).
- Todo sale del mismo fetch de `cargarDashboard()` que ya existe hoy — **cero llamadas nuevas al backend** para esta sección.

## 6. Frontend — Configuración (conectar de verdad)

- Los campos pasan de no controlados (`defaultValue`) a controlados (`useState`), precargados con `data.nombre_farmacia`, WhatsApp, sector, punto de referencia reales.
- El campo "Sector" deja de ser texto libre: se convierte en el mismo selector de 2 botones (Acarigua/Araure) que usa `RegisterCard` en `admin.login.tsx` (reutilizar el array `SECTORES` — mover a un lugar compartido si hace falta, o duplicar el array pequeño si no vale la pena la abstracción).
- Validación con Zod antes de enviar, mismo criterio que el wizard de registro: nombre 2-200 chars, WhatsApp `+58` + 10 dígitos, sector no vacío, referencia 5-180 chars.
- "Guardar cambios" llama `PATCH /api/v1/farmacias/{farmacia_id}` con `Authorization: Bearer <token>` de `localStorage`. Estados: loading (spinner en botón, disabled), éxito (toast `sonner`), error (mismo componente `ErrorBox` que ya existe en el login).
- Al guardar OK, si cambió el nombre, actualiza `localStorage.nombre_farmacia` para que "Hola, {nombre}" y el sidebar se actualicen sin recargar la página.
- `rif` y `correo` no aparecen en este formulario (decisión de la sección 3).

## 7. Fuera de alcance (explícito)

- El panel super admin (sub-proyecto separado, spec futuro).
- Edición de `rif`, `correo`, o de la ubicación geográfica (`lat`/`lng`) de la farmacia.
- Implementar `busquedas_zona` real (requiere tabla de búsquedas en BD — fuera de este sub-proyecto).
- Cambios a `admin.login.tsx`.

## 8. Criterios de éxito

1. "Total en Inventario" y la tabla de inventario siempre reflejan datos reales del backend (o estados vacíos/error honestos) — cero mocks visibles.
2. Facturación muestra deuda estimada, leads del mes y leads recientes sin ninguna llamada extra a la API.
3. Configuración guarda cambios reales vía `PATCH /api/v1/farmacias/{id}` y persisten al recargar.
4. `npx tsc --noEmit && npm run build` limpios (frontend); backend con sus propias pruebas/lint si aplica.
5. Prueba manual completa: login real → Facturación con datos reales → editar Configuración → guardar → recargar → persiste.
