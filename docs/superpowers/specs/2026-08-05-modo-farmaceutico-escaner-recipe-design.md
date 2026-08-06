# Diseño: Modo Farmacéutico del Escáner de Récipe

**Fecha:** 2026-08-05
**Estado:** Propuesto (pendiente plan de implementación)
**Repos afectados:** DosisYa-Frontend y DosisYa-Backend
**Implementa:** la Fase 2 descrita en `docs/superpowers/specs/2026-07-13-lead-premium-escaner-design.md`
(sección 10: "herramienta interna para farmacias"), que quedó registrada pero no diseñada.

## 1. Contexto y objetivo

El escáner de récipe actual (`POST /api/v1/ia/analizar-recipe`, spec
`docs/features/receta-ia-y-carrito.md`) es público, sin auth, y devuelve un resumen simple
pensado para que el paciente arme su Lista Médica (`medicamento`, `cantidad`, `alternativas`).

Las farmacias necesitan algo distinto para dispensar en mostrador: cuando les llega un récipe
en papel o por su propio WhatsApp, hoy lo leen a mano. Esta spec agrega un **modo farmacéutico**
del mismo escáner, dentro del panel autenticado (`/admin/dashboard`), que:

1. Extrae datos técnicos de dispensación (no un resumen para paciente).
2. Cruza cada medicamento contra el inventario propio de la farmacia (stock/precio).
3. Obliga a corregir manualmente cualquier campo que la IA no pudo leer con certeza.

Origen del pedido: propuesta pegada de un chat externo (ver `integrar-codigo-externo`) que
mezclaba ideas válidas (dos modos de análisis) con alucinaciones (modelo `deepseek-chat`
inexistente en este repo, extracción de datos de paciente/historia clínica). Esta spec conserva
solo lo verificado contra el estado real del código.

## 2. Decisiones cerradas en esta sesión

- **Sin PII.** No se extrae nombre de paciente, número de historia clínica ni colegiado del
  médico. Solo datos del medicamento. Evita que DosisYa se convierta en un sistema de registros
  médicos con las obligaciones legales que eso implica.
- **Gateada por `nivel_suscripcion = "premium"`.** La spec previa (2026-07-13, sección 10) ya
  documentó este producto como suscripción de pago (~$20-50/mes). En vez de inventar un modelo
  de negocio nuevo, esta spec reutiliza la columna `nivel_suscripcion` (`NivelSuscripcion` enum
  en `models.py`: `GRATUITA` | `PREMIUM`) que ya existe y ya se usa para filtrar otras features.
  No se implementa aquí el flujo de cobro/upgrade — solo el gating de acceso, igual que
  cualquier otra feature premium existente.
- **Cruce de inventario en el cliente**, no un endpoint de búsqueda nuevo. El dashboard
  (`GET /api/v1/farmacias/{id}/dashboard`) ya devuelve `inventario: [{nombre, marca_comercial,
  presentacion, stock, precio_usd}]` completo al cargar el panel. Se reutiliza ese array ya en
  memoria; no hay round-trip adicional por medicamento.
- **Reutiliza el orquestador Gemini→NVIDIA** mergeado hoy (`ia_orchestrator.py`, PR #5 de
  DosisYa-Backend) en vez de hablar directo con un proveedor — este modo hereda el fallback
  automático sin trabajo extra.
- **Sin `alternativas`.** Ese campo (sugerir sustitutos del mismo principio activo) tiene sentido
  para un paciente decidiendo qué buscar; el farmacéutico dispensa lo que el médico recetó, no
  negocia moléculas en este flujo.

## 3. Backend (DosisYa-Backend)

### 3.1 Prompts y schema — `src/dosisya/services/ia_prompts.py`

Nuevo prompt y schema, mismo archivo que ya centraliza `PROMPT_RECIPE` (single source of truth
consumida por `gemini_service.py` y `nvidia_service.py`):

```python
RECIPE_FARMACIA_RESPONSE_SCHEMA = {
    "type": "array",
    "items": {
        "type": "object",
        "properties": {
            "nombre_comercial": {"type": "string"},   # "" si no aplica/no se lee
            "principio_activo": {"type": "string"},   # "ilegible" si no se puede determinar
            "concentracion_mg": {"type": "string"},   # ej. "50mg"; "ilegible" si no se lee
            "forma_farmaceutica": {"type": "string"}, # ej. "comprimido", "jarabe"; "ilegible"
            "cantidad_total_unidades": {"type": "string"}, # ej. "30 tabletas"; "ilegible"
            "posologia_detallada": {"type": "string"},     # ej. "cada 8 horas"; "ilegible"
            "via_administracion": {"type": "string"},      # ej. "oral"; "ilegible"
        },
        "required": [
            "principio_activo", "concentracion_mg", "forma_farmaceutica",
            "cantidad_total_unidades", "posologia_detallada", "via_administracion",
        ],
    },
}

PROMPT_RECIPE_FARMACIA = """Eres un auxiliar de farmacia venezolano. Tu tarea es extraer
EXACTAMENTE lo que está escrito en este récipe médico, en JSON estructurado, para que un
farmacéutico dispense con precisión.

Reglas de extracción:
1. Estos son datos de MEDICAMENTO únicamente. NUNCA extraigas ni infieras nombre del
   paciente, número de historia clínica, ni datos del médico — no son parte de esta tarea.
2. Si un campo no es legible o no está presente, usa el string "ilegible". PROHIBIDO
   inventar o inferir valores para completar campos ilegibles.
3. principio_activo: nombre genérico INN si lo reconoces (ej. "Atamel" → "Paracetamol");
   si no lo reconoces con certeza, usa el nombre/marca tal como aparece escrito.
4. concentracion_mg: la dosis tal como está escrita (ej. "500mg", "5mg/ml").
5. forma_farmaceutica: comprimido, jarabe, cápsula, inyectable, etc.
6. cantidad_total_unidades: cantidad total recetada tal como está escrita.
7. posologia_detallada: frecuencia/duración tal como está escrita (ej. "cada 8 horas x 7 días").
8. via_administracion: oral, tópica, intramuscular, etc. — solo si está indicada.
9. Si la imagen NO es un récipe médico legible, devuelve una lista vacía [].
10. Devuelve SOLO el JSON — sin texto adicional, sin markdown.
"""
```

Se añade `validar_items_medicamento_farmacia()` en el mismo archivo (análoga a
`validar_items_medicamento`), que descarta items sin `principio_activo` y rellena cualquier
campo faltante con `"ilegible"` en vez de fallar.

### 3.2 Orquestador — `ia_orchestrator.py`

`analizar_recipe` gana un parámetro `modo` con default que preserva el comportamiento actual
(cero riesgo para el endpoint público existente):

```python
async def analizar_recipe(
    imagen_bytes: bytes, mime_type: str, modo: str = "paciente"
) -> list[dict[str, Any]]:
    ...
    return await gemini_service.analizar_recipe(imagen_bytes, mime_type, modo)
    # (y el fallback a nvidia_service.analizar_recipe con el mismo modo)
```

`gemini_service.py` / `nvidia_service.py` seleccionan `PROMPT_RECIPE`/`RESPONSE_SCHEMA` vs.
`PROMPT_RECIPE_FARMACIA`/`RECIPE_FARMACIA_RESPONSE_SCHEMA` según `modo`, y llaman a
`validar_items_medicamento` o `validar_items_medicamento_farmacia` según corresponda.

### 3.3 Endpoint nuevo — `src/dosisya/routers/farmacias.py`

```
POST /api/v1/farmacias/{farmacia_id}/ia/analizar-recipe
```

- **Auth:** `Depends(verify_token)`, mismo patrón que `/dashboard` y `PATCH /farmacias/{id}`:
  el `farmacia_id` del JWT debe coincidir con el de la URL (403 si no coincide).
- **Gating premium:** tras verificar el token, consulta `nivel_suscripcion` de la farmacia.
  Si no es `PREMIUM` → `403` con `detail="Esta función requiere el plan Premium."` (mismo
  código que el mismatch de farmacia_id, pero mensaje distinto para que el frontend lo detecte).
- **Validación de imagen:** idéntica a la del endpoint público (whitelist MIME, ≤10MB).
- **Rate limit:** `15/minute` (más permisivo que el público de 5/min porque ya está
  autenticado y el abuso es menos probable, pero sigue protegiendo cuota de IA).
- **Llamada:** `ia_orchestrator.analizar_recipe(imagen_bytes, mime_type, modo="farmaceutico")`.
- **Errores:** mismo mapeo que el endpoint público (`IATimeoutError`→504, `IAQuotaError`→503,
  `IAParsingError`→200 con `status="error"`, `RuntimeError`→500).

Respuesta de éxito:
```json
{
  "status": "success",
  "message": "Récipe analizado exitosamente.",
  "data": [
    {
      "nombre_comercial": "Atamel",
      "principio_activo": "Paracetamol",
      "concentracion_mg": "500mg",
      "forma_farmaceutica": "comprimido",
      "cantidad_total_unidades": "20 tabletas",
      "posologia_detallada": "cada 8 horas",
      "via_administracion": "oral"
    }
  ]
}
```

## 4. Frontend (DosisYa-Frontend)

### 4.1 Ubicación UI

Nuevo botón "Escanear récipe" dentro de la sección `"inventario"` de
[admin.dashboard.tsx](src/routes/admin.dashboard.tsx) (la sección "Mi Inventario" ya existe,
línea ~148). Si `data.nivel_suscripcion !== "premium"`, el botón se muestra deshabilitado con
un tooltip/badge "Función Premium" en vez de ocultarse — para que la farmacia gratuita sepa que
existe (upsell), sin exponer nunca la función real a quien no paga.

### 4.2 Componente nuevo

`src/components/panel/EscanerRecipeFarmacia.tsx` — mismo patrón de Drawer y máquina de estados
(`idle → scanning → results → error`) que [EscanerRecipe.tsx](src/components/EscanerRecipe.tsx),
pero:
- Sin botón "Añadir a mi lista" (no hay Lista Médica en el panel de farmacia).
- Campos técnicos en vez del resumen simple (ver 4.4).
- Sin sección de alternativas.

### 4.3 Cliente API

Nueva función en `src/lib/recipeIA.ts` (o archivo hermano `recipeIAFarmacia.ts` si el archivo
actual crece demasiado — decisión de implementación, no de diseño):

```ts
async function analizarRecipeFarmacia(
  file: File,
  farmaciaId: string,
  authToken: string,
): Promise<RespuestaEstructurada<MedicamentoRecetaFarmaciaUI[]>>
```

POST a `${API_BASE}/api/v1/farmacias/${farmaciaId}/ia/analizar-recipe`, header
`Authorization: Bearer ${authToken}` (mismo patrón que el resto de llamadas del panel — ver
`adminAuth.ts`). Mismas validaciones de imagen (MIME, tamaño) que `validarImagen()` ya expone.

### 4.4 Cruce de inventario

Por cada item de la respuesta, normaliza `principio_activo` (lowercase, sin tildes) y lo
compara contra `data.inventario[].nombre` normalizado igual. El dashboard ya trae este array al
entrar al panel — no se hace ninguna llamada nueva para esto.

Badge por ítem:
- Match con `stock === true` → verde, `"En stock — $precio_usd"`.
- Match con `stock === false` → ámbar, `"Sin stock"`.
- Sin match → gris, `"No está en tu inventario"`.

### 4.5 Validación obligatoria de ilegibles

Cualquier campo con valor `"ilegible"` se resalta (borde ámbar + ícono, igual que el patrón de
aviso ya usado en `EscanerRecipe.tsx`). El botón para marcar un ítem como "revisado" queda
deshabilitado mientras tenga campos `"ilegible"` sin editar manualmente — el farmacéutico corrige
tocando el campo, igual que el flujo de "reformular" ya existente en el escáner público.

## 5. Testing

**Backend:**
- `tests/test_farmacias_ia_router.py` (nuevo, sigue el patrón de `test_ia_router.py`): auth
  requerida, `farmacia_id` mismatch → 403, no-premium → 403, éxito → 200 con schema farmacéutico,
  mapeo de errores IA idéntico al público.
- Casos de `modo` en `test_ia_orchestrator.py` y `test_ia_prompts.py`: verificar que
  `modo="farmaceutico"` selecciona el prompt/schema correcto y que `modo="paciente"` (o el
  default sin argumento) no cambia el comportamiento actual — regresión cero para el endpoint
  público.
- Suite completa debe seguir en verde (línea base tras el merge de hoy: 212 passed).

**Frontend:**
- No hay suite formal de tests para componentes UI en este repo. Verificación:
  `npx tsc --noEmit && npm run build` (regla obligatoria del repo antes de commit/push).
  No toca `leads*.ts` ni `whatsapp.ts`, así que `scripts/test-leads-cpc.sh` no aplica.
- Prueba manual en preview: login de farmacia premium vs. gratuita, escaneo con récipe legible
  e ilegible, verificar badges de inventario con al menos un match y un no-match.

## 6. Fuera de alcance (esta fase)

- Flujo de cobro/upgrade a premium (se asume que `nivel_suscripcion` ya se gestiona por otro
  medio, como el resto de features premium existentes).
- Endpoint de búsqueda de inventario en base de datos (`pg_trgm`) — el cruce por texto exacto
  en cliente es suficiente para el volumen actual de inventario por farmacia; si el matching
  por igualdad resulta insuficiente en la práctica, se revisita como mejora futura.
- Enviar el récipe validado de vuelta al paciente ("botón enviar al paciente" de la propuesta
  original pegada) — requiere un canal paciente↔farmacia que hoy no existe (el paciente no
  tiene cuenta ni sesión). Fuera de alcance de este ciclo.
- Guardar la imagen del récipe para auditoría/trazabilidad legal — implica retención de datos
  con sus propias obligaciones; no se diseña aquí.
- TTS ("leer en voz alta") del lado paciente — no pedido para este ciclo, el escáner de paciente
  no cambia en esta spec.

## 7. Riesgos y dependencias

- **`NVIDIA_API_KEY` no configurada todavía** (verificado hoy: no aparece en `.env.example` ni
  evidencia de que esté en Vercel). Sin ella, el fallback de `ia_orchestrator` es un no-op
  seguro — el modo farmacéutico funciona igual, solo sin respaldo ante fallo de Gemini. No
  bloquea esta spec, pero conviene configurarla antes de depender del modo farmacéutico en
  producción con volumen real.
- Depende de que `nivel_suscripcion` esté siendo asignado correctamente hoy en producción para
  al menos una farmacia de prueba (para poder probar el gating premium end-to-end).
- Depende del merge de PR #5 (`fallback-ia-nvidia`) — **ya mergeado a `main`** el 2026-08-05
  como parte de esta misma sesión.
