# Auditoría de Seguridad — DosisYa (solo lectura)

> **Fecha:** 2026-10-17 · **Alcance:** frontend + lectura de backend + verificación
> live de Supabase prod (`bhqvijerlvdnbdgpbish`, `ACTIVE_HEALTHY`).
> **Sin cambios aplicados.** Las únicas consultas a la BD fueron `SELECT` de solo
> lectura a `information_schema` y los advisors de Supabase — no se tocaron datos ni esquema.
>
> Cada hallazgo va marcado como **[CONFIRMADO]** (verificado contra código o la BD)
> o **[A VERIFICAR]** (depende de config de Vercel no inspeccionable desde el repo).

## Resumen ejecutivo

El frontend está bien aislado (sin `supabase-js`, sin secretos en el bundle, CORS y SQL
correctos). El riesgo grave **no está en el frontend**: está en la postura de la base de
datos (RLS) y en la robustez del anti-fraude del lead facturable, ambos del lado
backend/Supabase. El hallazgo **C-01 es crítico y trivial de remediar**, y debe cerrarse
**antes de afiliar cualquier farmacia que pague** (encaja con la regla de lanzamiento de
`operacion-produccion.md`).

## Estado de remediación (actualizado 2026-10-17)

| ID | Severidad | Estado | Dónde se arregla |
|----|-----------|--------|------------------|
| C-01 | 🔴 Crítico | ✅ Remediado (RLS + REVOKE) | Supabase (migración) |
| A-01 | 🟠 Alto | ⬜ Abierto | Backend (código/config) |
| M-01 | 🟡 Medio | 🟨 Implementado + verificado en preview (CSP report-only, headers OK, app sana) · pend. commit/prod y promover CSP a bloqueante | Frontend (`vercel.json`) + backend |
| M-02 | 🟡 Medio | ✅ Remediado (invoker + REVOKE) | Supabase (migración) |
| M-03 | 🟡 Medio | ⬜ Abierto | Backend (código) |
| M-04 | 🟡 Medio | ⬜ Abierto | Supabase (índice único) |
| B-01 | 🟢 Bajo | ✅ Remediado (`search_path`) | Supabase (migración) |
| B-02/B-03/B-04 | 🟢 Bajo | ⬜ Abierto (ruido PostGIS / shadcn) | Supabase / N/A |

**Residual del advisor tras la remediación:** solo WARN no accionables sin ownership —
extensiones PostGIS en `public` (B-02) y `st_estimatedextent` (B-03), ambas de `supabase_admin`;
y `spatial_ref_sys` (tabla de sistema de PostGIS, falso-positivo conocido de Supabase). Ningún
ERROR accionable pendiente.

---

## 🔴 CRÍTICO

### C-01 · RLS deshabilitado + rol `anon` con permiso total sobre 7 tablas sensibles [CONFIRMADO]

> **✅ REMEDIADO el 2026-10-17** (migración `c01_enable_rls_revoke_sensitive_tables`). Se aplicó
> `ENABLE ROW LEVEL SECURITY` (deny-all sin política) + `REVOKE ALL FROM anon, authenticated` a
> las 8 tablas (las 7 de abajo + `principios_activos_dispensacion`). Verificado: `rls_on=true` y
> grants de anon/authenticated en cero; el advisor `rls_disabled_in_public` ya solo reporta
> `spatial_ref_sys` (tabla de sistema de PostGIS, ruido conocido). El backend no se afecta
> (conecta como `postgres`, owner → ignora RLS). Descripción original del hallazgo abajo.

**Dónde:** Supabase prod, schema `public`. Advisor `rls_disabled_in_public` (nivel **ERROR**)
+ grants verificados en `information_schema.role_table_grants`.

El rol `anon` (y `authenticated`) tiene **`SELECT, INSERT, UPDATE, DELETE, TRUNCATE`** y
**RLS está apagado** en:

| Tabla | Columnas sensibles | Qué permite el acceso anónimo |
|---|---|---|
| `farmacias_auth` | `correo`, **`password_hash`** | Leer hashes para crackear offline; o directamente `UPDATE password_hash`/`activo` → toma de control del panel B2B |
| `facturas` | `leads_facturables`, `total_usd`, `estado`, `fecha_pago` | Leer ingresos de toda la red; `UPDATE estado='pagada'` o `TRUNCATE` → destruir el registro de lo que se cobra |
| `pacientes` | `telefono`, `nombre` | Exfiltración de PII de todos los pacientes |
| `pacientes_otp` | `codigo_hash`, `telefono` | Leer/borrar OTPs; manipular el flujo de login |
| `leads_parciales` | `nombre_farmacia`, `rif`, `whatsapp`, `ip_origen` | PII de farmacias prospecto |
| `consentimientos_recipe` | `farmacia_id`, `ip_origen` | Alterar/borrar el libro de consentimientos (dato de salud, riesgo legal) |
| `webhook_errors` | `payload_enviado` | Leer payloads de errores |

**Impacto:** la anon key de Supabase es **pública por diseño** (es un JWT pensado para
compartirse; RLS es el único control real). Cualquiera que la obtenga puede, vía la REST API
de PostgREST (`https://bhqvijerlvdnbdgpbish.supabase.co/rest/v1/<tabla>`), **leer, modificar,
borrar o truncar** estas tablas sin tocar FastAPI. Es simultáneamente: (a) brecha de PII /
datos de salud, (b) exposición de credenciales B2B, (c) **destrucción o falsificación de la
facturación** — el activo monetizable del negocio.

**Atenuante parcial [CONFIRMADO]:** el frontend **no** usa `supabase-js` ni incluye la anon
key en el bundle, así que no está publicada en el JS del sitio. Esto reduce el descubrimiento,
**no** la vulnerabilidad: confiar en que "nadie la tiene" es seguridad por oscuridad. Nota: las
tablas del buscador (`farmacias`, `inventario_*`, `leads_interacciones`) sí tienen RLS activo
sin política = cerradas a PostgREST. La inconsistencia es que las tablas nuevas (login
paciente, facturación, auth B2B) nunca recibieron RLS.

**Fix propuesto:**
1. `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;` en las 7 tablas (sin política → deny-all a
   anon/authenticated, igual que las tablas del buscador; el backend sigue entrando por
   conexión directa asyncpg, que bypasa RLS).
2. Además `REVOKE ALL ON ... FROM anon, authenticated;` para defensa en profundidad.
3. Rotar la anon key si hay sospecha de que circuló (Lovable, historial git, deploys viejos).
4. Rotar el `password_hash` de las farmacias existentes por precaución y revisar logs de
   Supabase (`/rest/v1/`) por lecturas anómalas.

> Misma raíz y mismo fix, pero **dos vectores de pérdida distintos**: fuga de datos **y**
> destrucción de facturación / account-takeover.

---

## 🟠 ALTO

### A-01 · Anti-fraude del lead facturable apoyado en una IP spoofeable [CONFIRMADO en código / efecto neto A VERIFICAR]

> **Propuesta de remediación detallada (sin aplicar):** `a01-antifraude-leads-propuesta.md`
> (Fase 0 diagnóstico de cabeceras · Fase 1 IP confiable + Upstash · Fase 2 token de búsqueda
> firmado, que además cierra M-03).

**Dónde:** `DosisYa-Backend/src/dosisya/limiter.py` (`client_ip`), `routers/leads.py:183,209`,
`repository.py:104-131`.

El endpoint `POST /api/v1/leads/` es anónimo (por diseño "cero fricción") y acepta
`farmacia_id`, `tipo_interaccion` y `origen` **elegidos por el cliente**. Las únicas defensas
son el rate-limit (`5/minute`) y el dedup de 60s, y **ambos se llavean por `ip_origen`**, que
sale de `X-Forwarded-For` tomando **la primera entrada** (`forwarded.split(",")[0]`). Como el
backend es alcanzable directamente en `proyecto-dosis-ya.vercel.app`, un atacante que lo llame
directo puede enviar su propia `X-Forwarded-For`: rotando ese valor en cada request **cambia la
llave de rate-limit y de dedup en cada intento** → fabricación ilimitada de leads contra
cualquier `farmacia_id`.

**Impacto:** inflado de la métrica exactamente facturable. Corrompe la confianza del cobro: una
farmacia recibe factura inflada, o un competidor sabotea a otra.

**Agravante [A VERIFICAR]:** `limiter.py` usa `storage_uri="memory://"` por defecto. En Vercel
serverless cada instancia tiene su propio contador, así que **si `RATELIMIT_STORAGE_URI`
(Redis/Upstash) no está configurada en el entorno del backend, el rate-limit es prácticamente
inefectivo** aun sin spoofing. → Verificar esa env var en Vercel; si no existe, A-01 sube de
hecho a crítico-operacional.

**Fix propuesto:**
- Verificar cómo Vercel normaliza `X-Forwarded-For` en este proyecto y tomar la IP que inyecta
  el edge (p. ej. `x-real-ip`/`x-vercel-forwarded-for` o la última entrada de confianza), nunca
  un valor arbitrario del cliente.
- Configurar `RATELIMIT_STORAGE_URI` a un store compartido (Upstash).
- Añadir una segunda señal anti-fraude además de IP (token efímero firmado emitido por el SSR en
  la búsqueda, o verificación de `Origin`/referer).

---

## 🟡 MEDIO

### M-01 · Ausencia total de headers de seguridad [CONFIRMADO]

> **🟨 IMPLEMENTADO EN FRONTEND el 2026-10-17 (sin deploy todavía).** Se añadió el bloque
> `headers` en `vercel.json` (scope `/((?!api/).*)`, no toca el proxy de la API):
> `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
> `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (geolocation/camera a
> `self`, resto off), `Strict-Transport-Security`, y la **CSP en `Content-Security-Policy-Report-Only`**
> (no bloquea aún; permite Google Fonts, PostHog y Sentry).
> **Verificado en preview el 2026-10-17** (`dosisya-frontend-gewd7w0r6…vercel.app`): los 6 headers
> se sirven en la portada; el proxy `/api/v1/*` NO recibe CSP (scope correcto) y responde
> `status:success`; portada y `/buscar` renderizan bien (Inter/Google Fonts OK), la tasa y la
> búsqueda de "losartan" (2 resultados) funcionan, y la **consola quedó limpia (sin violaciones de
> CSP report-only)** en el flujo ejercitado.
> **Pendiente:** (1) commitear y llevar a prod; (2) ejercitar en report-only las rutas que faltaron
> (escáner de récipe, panel B2B/súper, y con `VITE_POSTHOG_KEY`/`VITE_SENTRY_DSN` activos) antes de
> promover la CSP de `-Report-Only` a `Content-Security-Policy` bloqueante — idealmente con nonce en
> vez de `'unsafe-inline'` para `script-src`; (3) el backend sigue sin headers propios (opcional).

**Dónde:** `DosisYa-Frontend/vercel.json` (sin bloque `headers`), backend `main.py` (solo CORS).
No hay CSP, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy` ni `Permissions-Policy`.
**Impacto:** sin **CSP**, cualquier XSS se ejecuta sin contención. Los tokens de sesión viven en
`localStorage` (`src/lib/adminAuth.ts:9` `super_token`; `src/lib/pacienteAuth.ts:23`
`paciente_token`) con **JWT de 7 días** (`security.py:102`) → un XSS roba una sesión de
superadmin o paciente válida por una semana. Sin `X-Frame-Options` → clickjacking del panel.
**Fix:** bloque `headers` en `vercel.json` con CSP (empezar en `report-only`),
`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
`Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`. Evaluar mover el
`super_token` a cookie `HttpOnly`+`Secure`+`SameSite`.

### M-02 · Vista `SECURITY DEFINER` expuesta [CONFIRMADO]

> **✅ REMEDIADO el 2026-10-17** (migración `m02_view_invoker_b01_fn_search_path`). Impacto real
> verificado: `anon` tenía `SELECT` sobre la vista → volcado del inventario+precios de toda la red
> vía `/rest/v1/`, evitando el rate-limit del buscador. Fix: `ALTER VIEW ... SET
> (security_invoker = on)` + `REVOKE ALL FROM anon, authenticated`. Advisor `security_definer_view`
> eliminado.

**Dónde:** advisor `security_definer_view` (**ERROR**) → `public.v_inventario_precios_ves`.
**Impacto:** la vista corre con permisos de su creador, saltándose la RLS del que consulta. Si
`anon` puede hacer `SELECT` por PostgREST, puede exponer datos subyacentes.
**Fix:** recrear como `SECURITY INVOKER` (PG 15+) o `REVOKE SELECT ... FROM anon, authenticated`.

### M-03 · El cliente decide si el lead es "premium" (`escaner_recipe`) [CONFIRMADO]
**Dónde:** `src/lib/leads.ts:32` (`OrigenLead`), backend `routers/leads.py:162,219`.
**Impacto:** `escaner_recipe` es el lead premium (más caro) y el backend no valida que hubo un
escaneo real; combinado con A-01, un tercero puede inflar específicamente los leads premium.
**Fix:** derivar `origen` server-side de una señal verificable (id de sesión de escaneo emitido
por `/ia/analizar-recipe`) en vez de confiar en el campo del cliente.

### M-04 · Dedup de leads no atómico [CONFIRMADO]
**Dónde:** `repository.py:99-131` — `WHERE NOT EXISTS` sin índice único (el comentario lo admite).
**Impacto:** dos requests casi simultáneos pueden insertar ambos → doble facturación de un clic.
**Fix:** índice único parcial sobre `(farmacia_id, medicamento_buscado_id, tipo_interaccion,
ip_origen)` con ventana temporal, o `INSERT ... ON CONFLICT DO NOTHING`.

---

## 🟢 BAJO / informativo

- **B-01 · `function_search_path_mutable` [✅ REMEDIADO 2026-10-17]** (advisor WARN):
  `fn_set_updated_at()` y `canon_principio(text)` ahora con `SET search_path = public, pg_temp`
  (migración `m02_view_invoker_b01_fn_search_path`). Advisor eliminado.
- **B-02 · Extensiones en `public` [CONFIRMADO]** (WARN): `postgis`, `pg_trgm`, `citext`,
  `unaccent`. Mover a schema `extensions`. Bajo impacto real.
- **B-03 · `st_estimatedextent` SECURITY DEFINER ejecutable por `anon` [CONFIRMADO]** (WARN):
  función interna de PostGIS; divulgación menor. Revocar EXECUTE a anon.
- **B-04 · `dangerouslySetInnerHTML` [CONFIRMADO, no explotable]** en
  `src/components/ui/chart.tsx:73`: estándar de shadcn, inyecta CSS desde config estática del
  desarrollador (no input de usuario). Vigilar que nunca se alimente de datos externos.
- **B-05 · JWT de 7 días en `localStorage`** — cubierto en M-01.

---

## ✅ Fortalezas verificadas (no "arreglar" lo que ya está bien)

- **Frontend sin `supabase-js`**: toda la API pasa por el proxy mismo-origen FastAPI
  (`src/lib/api.ts:92-95`). No hay queries directas a Supabase con anon key desde el cliente. [CONFIRMADO]
- **Sin secretos en el bundle**: `config.server.ts` es plantilla vacía; solo llegan vars `VITE_`
  públicas por diseño (PostHog, Sentry DSN). `.env*` en `.gitignore`. [CONFIRMADO]
- **CORS correcto en prod**: `main.py:172-181` usa env + regex con `fullmatch`,
  `allow_credentials` desactivado con wildcard, `APP_ENV=production` fijado en `vercel.json` del
  backend. [CONFIRMADO]
- **SQL 100% parametrizado** (`$N`) en todos los routers → inmune a inyección. [CONFIRMADO]
- **OTP bien hecho**: bcrypt, 6 dígitos cripto (`secrets`), máx. 5 intentos, TTL 5 min, cooldown
  60s, anti-enumeración, nunca devuelve el código, logs redactados (`routers/pacientes_auth.py`). [CONFIRMADO]
- **JWT secret exige env en prod**: `security.py:44-52` lanza `RuntimeError` si falta; placeholder
  solo en dev. [CONFIRMADO]
- **`leads_interacciones` append-only** (sin UPDATE/DELETE) y con RLS que lo protege de PostgREST. [CONFIRMADO]

---

## 📊 Tabla de priorización (Impacto × Esfuerzo)

| ID | Hallazgo | Impacto | Esfuerzo | Prioridad |
|----|----------|---------|----------|-----------|
| **C-01** | RLS off + `anon` DML total (PII, credenciales, facturas) | 🔴 Crítico | 🟢 Bajo (ENABLE RLS + REVOKE, minutos) | **#1 — ahora** |
| **A-01** | Anti-fraude por IP spoofeable + rate-limit en memoria | 🟠 Alto | 🟡 Medio (IP confiable + Redis) | **#2** |
| **M-01** | Sin headers de seguridad / CSP; tokens 7d en localStorage | 🟡 Medio | 🟢 Bajo (bloque `headers`) | **#3** |
| **M-02** | Vista `SECURITY DEFINER` expuesta | 🟡 Medio | 🟢 Bajo | #4 |
| **M-03** | `origen` premium decidido por el cliente | 🟡 Medio | 🟡 Medio | #5 |
| **M-04** | Dedup no atómico → doble cobro | 🟡 Medio | 🟢 Bajo (índice único) | #6 |
| **B-01** | `search_path` mutable en funciones | 🟢 Bajo | 🟢 Bajo | #7 |
| **B-02/03/04** | Extensiones en public / PostGIS definer / shadcn innerHTML | 🟢 Bajo | 🟢 Bajo | #8 |

**Orden recomendado:** C-01 primero (trivial, catastrófico, bloqueante de lanzamiento). Luego
A-01 y M-01. El resto es higiene.

## Notas de alcance

- C-01, A-01 y M-02/M-03/M-04 tocan el **backend** y **Supabase**, fuera de este repo. Se
  reportan por su peso para el negocio; su fix requiere autorización expresa sobre
  `DosisYa-Backend` / Supabase (CLAUDE.md §2).
- Evidencia live obtenida vía MCP de Supabase: advisor de seguridad + `information_schema`
  (grants y columnas). Todo de solo lectura.
