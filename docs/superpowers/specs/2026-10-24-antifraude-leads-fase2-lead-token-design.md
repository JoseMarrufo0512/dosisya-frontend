# Diseño — Fase 2 anti-fraude de leads · permiso firmado (`lead_token`) + M-03

> **Estado:** DISEÑO APROBADO (José, 2026-10-24). Próximo paso: plan de implementación.
> **Origen:** hallazgo A-01 Fase 2 + M-03 de `docs/contexto/auditoria-seguridad-2026-10.md`
> y `docs/contexto/a01-antifraude-leads-propuesta.md` §4.
> **Precede:** Fase 0+1 + M-04 ya en producción (ver `[[antifraude-leads-a01-m04-2026-10]]`,
> backend PR #19 mergeado 2026-10-24). Esta fase es un cambio de contrato **coordinado
> backend+frontend**.
> **Autorización backend:** tocar `DosisYa-Backend` requiere OK expreso (CLAUDE.md §2).
> José lo concede para esta fase al aprobar el diseño; se re-confirma al ejecutar el plan.

---

## 1 · Intención y porqué

El lead facturable (`POST /api/v1/leads/`) es anónimo y hoy el cliente declara el `origen`
(incluido el premium `escaner_recipe`). Dos problemas:

- **M-03 (confirmado):** el cliente puede declararse premium (`origen:"escaner_recipe"`,
  `src/components/EscanerRecipe.tsx:152,169` → `src/lib/leads.ts:96`) sin que el backend lo
  verifique → sobre-facturación fabricable.
- **A-01 Fase 2 (estructural):** nada ata el lead a una interacción real previa; la IP
  (endurecida en Fase 1) es una señal débil (CGNAT móvil agrupa/rota usuarios — observado
  empíricamente: la IP del celular de prueba rotó 186→74).

El fix estructural: un **permiso efímero firmado por el backend** (`lead_token`) que se emite
en los endpoints que ya preceden a todo lead (búsqueda, detalle, scanner) y se adjunta al
generar el lead. El backend **deriva el origen del token firmado**, no del cliente.

## 2 · Restricción de negocio INNEGOCIABLE (gobierna todo el diseño)

**Los leads son el ingreso. El peor resultado NO es dejar pasar un fraude teórico, sino
tumbar un lead legítimo** (plata que se deja de cobrar). No hay fraude activo: esto es
blindaje preventivo. Consecuencia de diseño, decidida con José:

> **El `lead_token` NUNCA rechaza un lead.** Solo (a) deriva el `origen` server-side y
> (b) deja una señal anti-fraude loggeada. Un lead sin token / con token inválido se
> **registra igual**, con `origen=busqueda` (base, no premium).

## 3 · Goals / Non-goals / Anti-goals

**Goals**
- Cerrar M-03: el `origen` premium (`escaner_recipe`) sale de un token firmado por el
  backend, nunca del cliente.
- Encarecer la fabricación de leads: para un lead premium hay que pasar por el scanner
  real; para cualquier lead, por una búsqueda/detalle real.
- Observabilidad: medir qué fracción de leads llega con token válido, por fuente.

**Non-goals**
- Rechazar leads sin token (Fase C) — fuera de alcance; solo se consideraría con cobertura
  ~100 % y OK explícito posterior.
- Cambiar el flujo B2C "cero fricción" visible para el paciente.

**Anti-goals (haría fracasar la fase aunque funcione técnicamente)**
- Perder **un solo** lead legítimo por un candado nuevo.
- Introducir carga operativa que José deba vigilar a diario.
- Atar el token a la IP (CGNAT móvil → rechazos de legítimos).

## 4 · Mapa del flujo actual (código real, contrato verificado con skill `contrato-api`)

Endpoints que **ya** preceden a todo lead (candidatos a emitir el token; públicos, sin auth):
- `GET /api/v1/medicamentos/buscar` — `DosisYa-Backend/src/dosisya/routers/medicamentos.py:175`.
  Devuelve `RespuestaEstructurada.data{total, resultados[]}`; `data` es dict libre → cabe
  `lead_token` **sin tocar BD**.
- `GET /api/v1/medicamentos/{medicamento_id}/farmacias/{farmacia_id}` — `medicamentos.py:329`.
  Alimenta el deep-link `src/routes/producto.$farmaciaId.$medicamentoId.tsx:45` (fetch en
  loader; SSR con URL absoluta vía `.server()`).
- `POST /api/v1/ia/analizar-recipe` — `DosisYa-Backend/src/dosisya/routers/ia.py:91`. Único
  sitio legítimo del origen premium.

Sitios que generan el lead (adjuntarían el token):
- Búsqueda: `src/components/ComparadorPanel.tsx:42`, `src/components/TarjetaResultado.tsx:109,120`.
- Deep-link: `src/routes/producto.$farmaciaId.$medicamentoId.tsx:119`.
- Scanner: `src/components/EscanerRecipe.tsx:152,169` (**M-03 vive aquí**).
- Lista médica (fan-out): `src/components/lista/ListaMedicaDrawer.tsx:63`,
  `src/components/lista/SelectorFarmacia.tsx:126` → `src/lib/leadsLista.ts:39`.

Punto único de envío: `src/lib/leads.ts:83` `postLead()` → `POST /api/v1/leads/` (trailing
slash). Hoy manda `origen` desde el cliente (`leads.ts:96`). Backend:
`DosisYa-Backend/src/dosisya/routers/leads.py`, modelo `models.py:396` `LeadInteraccionBase`
(`origen: OrigenLead|None`, `models.py:414`), enum `busqueda|lista_medica|escaner_recipe`
(`models.py:79`, `db/schema.sql:49`).

Frontend vs backend: **emitir y verificar** el token = backend; **guardar y adjuntar** = frontend.

## 5 · Diseño del permiso firmado

**Formato:** `base64url(payload_json) + "." + base64url(HMAC_SHA256(payload_json, JWT_SECRET_KEY))`.
Sin librería JWT, stateless, **sin tabla nueva**. (Se reusa `JWT_SECRET_KEY`, ya presente y
estable en el backend para la auth de pacientes.)

**Payload:**
```json
{ "v": 1, "iat": <epoch_s>, "exp": <epoch_s>, "origen": "busqueda|escaner_recipe", "scope": "buscar|detalle|recipe" }
```
- `origen`: `escaner_recipe` SOLO lo emite `analizar-recipe`; `buscar`/`detalle` emiten
  `busqueda`. `lista_medica` no se firma (es un agrupador de ítems de orígenes mixtos; ver §6).
- `scope`: de qué endpoint salió (diagnóstico/telemetría).

**Verificación en `/leads/` (la lógica entera, gobernada por §2):**

Decisión (mía, builder-check): **solo el origen premium (`escaner_recipe`) se gatea por el
token.** `busqueda` y `lista_medica` son el **mismo escalón de cobro (base)** — degradar uno
al otro no cambia el ingreso y perdería telemetría, así que se respetan tal cual los manda el
cliente.
1. El cliente NO pide premium (`busqueda`/`lista_medica`) → se respeta el `origen` del
   cliente. El lead se registra.
2. El cliente pide `escaner_recipe`:
   - token válido con `origen=escaner_recipe` → **premium**.
   - token ausente / firma inválida / `exp` vencido / token no-premium → **se degrada a
     `busqueda` (base). El lead se registra. Nunca se rechaza.**

(En Fase A/`shadow`: nunca se cambia el `origen` efectivo; solo se loguea el que se *habría*
derivado, para medir cobertura antes de activar la degradación.)

**Viaje:**
- `buscar`/`detalle`/`analizar-recipe` devuelven `data.lead_token`.
- Frontend lo guarda **junto al resultado**: en memoria para búsqueda/detalle; en
  `localStorage` **junto a los ítems** de la lista médica (`useListaMedica`) para que un ítem
  persistido conserve su token.
- Se adjunta como campo opcional `lead_token` en el body de `postLead` (`leads.ts`).

**TTL propuesto: 24 h** (no 10 min). La lista médica persiste y el paciente contacta días
después; con "no perder leads", ventana larga. Como además **no rechazamos**, el TTL es solo
una señal blanda (acota replay de un token robado, nada más).

**Descartado por el apetito de riesgo:** single-use nonce (rompe el fan-out: una búsqueda →
contactar N farmacias = N leads) y atar a IP (CGNAT móvil → rechazos de legítimos).

**Supuestos:** (a) `JWT_SECRET_KEY` existe y es estable; (b) añadir `lead_token` a `data` es
aditivo y no rompe clientes viejos; (c) `postLead` admite un campo extra opcional; (d) el
proxy mismo-origen pasa el token igual que cualquier otro campo JSON.

## 6 · Modos de falla (cómo se perdería un lead legítimo) y mitigación

Con "nunca rechaza", la **única** forma de perder un lead por esta fase es activar rechazo
duro (Fase C, fuera de alcance). Inventario:

| Camino | Prob. | Impacto si se rechazara | Mitigación |
|---|---|---|---|
| Deep-link sin búsqueda previa | Media | lead perdido | el endpoint de detalle emite token ✅ |
| Lista médica persistida (token viejo/ausente) | **Alta** | lead perdido | TTL 24 h + re-emitir al abrir el drawer + **nunca rechazar**; `lista_medica` no se gatea (mismo escalón de cobro que `busqueda`, ver §5) → sin impacto de ingreso aunque falte token |
| Adblocker/proxy bloquea el mint | Baja-media | sin token | **nunca rechazar**; Sentry ya reporta leads perdidos (`src/lib/leads.ts:61`) |
| Fallo de red en el mint | Baja | sin token | **nunca rechazar** |
| SSR (deep-link) | Baja | — | token viaja por el loader ✅ |
| Fan-out multi-producto / multi-origen | Media | — | token reusable (no single-use) + degradar origen, no rechazar |
| TTL vencido / clock skew | Baja | — | TTL 24 h + fail-open |

## 7 · Despliegue por fases (red de contención)

Todo detrás de un flag de entorno **`LEAD_TOKEN_MODE ∈ {off, shadow, derive}`** (backend).

- **Fase 0 — emitir (aditivo, cero cambio de comportamiento).** Los 3 endpoints devuelven
  `lead_token`; el frontend lo guarda y lo adjunta. Backward-compatible total. `LEAD_TOKEN_MODE=off`.
- **Fase A — observar sin bloquear (`shadow`).** El backend verifica el token en `/leads/` y
  **loguea** `{token_present, valid, origen_del_token, origen_del_cliente}` SIN cambiar el
  `origen` efectivo. **Métrica:** % de leads con token válido por fuente
  (search/detalle/scanner/lista/deep-link).
- **Fase B — M-03, derivar origen (`derive`).** El backend fija `origen` desde el token;
  ausente/inválido → `busqueda`. **Nunca pierde un lead.**
  **Criterio numérico A→B:** ≥ 98 % de los leads `escaner_recipe` actuales llevan token
  premium válido durante **2 semanas corridas** y **cero** señales de pérdida nueva en Sentry.
- **Fase C — rechazar leads sin token. FUERA DE ALCANCE.** Solo con cobertura ~100 % y OK
  explícito posterior; recomendación: **no hacerla**.

**Rollback:** `LEAD_TOKEN_MODE=off` revierte al instante. Sin migración de datos. Los endpoints
pueden seguir emitiendo token (inerte) sin efecto.

## 8 · Trade-offs y recomendación

**Recomendado: Fases 0 → A → B, detenerse en B.** Cierra M-03 por completo y encarece el
fraude, con **cero riesgo** de perder un lead. El "atar lead a búsqueda" se vuelve **señal
observada**, no bloqueo — precio honesto de "no perder un lead jamás".

**Fuera de alcance de Fase 2:** Fase C (rechazo duro), single-use nonce, atar token a IP.

## 9 · Qué se deja al plan (decisiones de implementación)

- Módulo backend del token (firmar/verificar): dónde vive (`src/dosisya/lead_token.py`
  nuevo) y su API interna.
- Forma exacta de persistir el token en `useListaMedica`/`localStorage` junto a cada ítem.
- Cómo el frontend asocia el token de una búsqueda a los clics de esa tarjeta (estado en
  `useBuscarMedicamentos`/vista de resultados).
- Formato exacto del log de Fase A (campos, nivel) y cómo José lee la métrica
  (¿Sentry? ¿query a logs de Vercel? ¿contador simple?) — debe ser **cero-ops** o casi.
- Tests: firma/verificación (vencido, firma mala, origen degradado), y que un lead sin token
  siga registrándose en los tres modos.

## 10 · Impacto por repo

- **Backend** (requiere OK de José al ejecutar): `lead_token.py` nuevo; emitir token en
  `routers/medicamentos.py` (buscar + detalle) y `routers/ia.py` (premium); verificar/derivar
  en `routers/leads.py`; leer `LEAD_TOKEN_MODE`. Sin cambios de BD ni de enum.
- **Frontend:** `src/lib/api.ts` (tipos de respuesta con `lead_token`), `src/lib/leads.ts` +
  `leadsLista.ts` (adjuntar token), `useBuscarMedicamentos`/vista de resultados y
  `useListaMedica` (guardar token), `producto.$farmaciaId.$medicamentoId.tsx` (token del
  detalle), `EscanerRecipe.tsx` (token premium del scanner).
