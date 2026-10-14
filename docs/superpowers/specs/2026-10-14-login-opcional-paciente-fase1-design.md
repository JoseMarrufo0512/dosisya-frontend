# Login opcional del paciente — Fase 1: Identidad

**Fecha:** 2026-10-14
**Estado:** Aprobado (diseño)
**Alcance:** Solo paciente. Farmacia/superadmin quedan sin cambios.
**Repos afectados:** `DosisYa-Frontend` y `DosisYa-Backend`.

## Contexto y motivación

Hoy el paciente no tiene cuenta (filosofía "Cero Fricción" de CLAUDE.md). Existe
`src/components/paciente/HojaLoginPaciente.tsx` como placeholder: el botón
"Continuar con teléfono" solo muestra un toast y "Seguir sin cuenta" es el camino
primario. El backend solo tiene auth B2B (`farmacias_auth`, `usuarios`) con bcrypt +
JWT HS256; no expone nada de paciente.

El objetivo de producto es que el paciente pueda, **opcionalmente**, iniciar sesión
para a futuro: guardar su Lista Médica entre dispositivos, ver su historial de
búsquedas/contactos, y guardar recetas escaneadas. Esas tres funciones requieren
almacenar datos del paciente ligados a una identidad, cosa que el backend no tiene.

El trabajo completo son **cuatro subsistemas** (identidad, Lista Médica en nube,
historial, recetas), y 2–4 dependen de 1. Por eso se descompone en fases. **Este
spec cubre solo la Fase 1 (Identidad).** Las fases 2–4 tendrán su propio ciclo
spec → plan → implementación.

El login es **opcional y no bloqueante** en todo momento: buscar y armar la Lista
Médica siguen sin requerir cuenta ("Cero Fricción" intacto).

## Método de autenticación

Teléfono + código OTP de 6 dígitos enviado por **WhatsApp**, reutilizando el pipeline
n8n + OpenWA que ya existe para notificaciones B2B. Sin contraseña. Elegido por
afinidad con el mercado (Acarigua/Araure, todo por WhatsApp), coincidencia con el
placeholder actual y mínima fricción.

Se reutiliza el esquema de auth existente del backend (bcrypt + JWT HS256,
`dosisya.security.verify_token`, `dosisya.limiter`) en vez de introducir Supabase Auth
u otro esquema.

## Decisiones cerradas (puntos abiertos resueltos)

1. **Claim de nombre en el JWT:** se generaliza el claim a `nombre` (neutro), y el
   firmador emite también `nombre_farmacia` como alias durante una release para no
   romper a los consumidores B2B existentes. Seguimiento: eliminar el alias después.
2. **Entrega del OTP:** el backend hace `POST` a un webhook de n8n
   (`N8N_OTP_WEBHOOK_URL`) con `{telefono, codigo}`; n8n reenvía por OpenWA. No se
   maneja la sesión de WhatsApp dentro de FastAPI.
3. **Captura de nombre para usuario nuevo:** campo opcional y saltable "¿Cómo te
   llamamos?" solo cuando `es_nuevo === true`.
4. **Parámetros del OTP:** 6 dígitos / TTL 5 minutos / máx 5 intentos de verificación
   / cooldown de 60s entre solicitudes.

## Backend (`DosisYa-Backend`)

### Modelo de datos — migración `014_pacientes_auth.sql`

Sigue la convención de migraciones numeradas. Aplicarla a Supabase prod es un paso de
deploy manual (vía Supabase MCP), coherente con cómo se aplicaron las migraciones 008
y 013.

**Tabla `pacientes`:**
- `id uuid primary key default gen_random_uuid()`
- `telefono text unique not null` — formato E.164, p.ej. `+584141234567`
- `nombre text null` — nombre para mostrar, opcional, fijable después
- `creado_en timestamptz not null default now()`
- `ultimo_acceso timestamptz null`

**Tabla `pacientes_otp`:**
- `id uuid primary key default gen_random_uuid()`
- `telefono text not null`
- `codigo_hash text not null` — bcrypt del código de 6 dígitos (nunca en claro)
- `expira_en timestamptz not null` — `now() + interval '5 minutes'`
- `intentos smallint not null default 0` — contador de verificaciones fallidas (máx 5)
- `consumido_en timestamptz null`
- `creado_en timestamptz not null default now()`
- Índice por `telefono`.

Separada de `pacientes` para emitir códigos a teléfonos sin cuenta: el primer
`verificar-codigo` exitoso crea el paciente (upsert).

### Endpoints — router `routers/pacientes_auth.py`, prefijo `/api/v1/paciente`

**`POST /paciente/auth/solicitar-codigo`**
- Body: `{ "telefono": string }`
- Normaliza el teléfono a E.164. Rate-limit por IP **y** por teléfono; cooldown de 60s
  (rechaza si existe un OTP para ese teléfono creado hace < 60s). Limpia OTPs
  previos (consumidos/expirados) del mismo teléfono.
- Genera código de 6 dígitos, guarda `codigo_hash` (bcrypt) + `expira_en` (now + 5min).
- Dispara envío: `POST` fire-and-forget a `N8N_OTP_WEBHOOK_URL` con `{telefono, codigo}`,
  timeout corto. Si falla, registra en `webhook_errors` y **aun así responde 200**.
- **Respuesta siempre `{ "status": "success" }` con 200**, exista o no el teléfono
  (anti-enumeración). Excepto 429 por rate-limit/cooldown.

**`POST /paciente/auth/verificar-codigo`**
- Body: `{ "telefono": string, "codigo": string }`
- Busca el OTP más reciente del teléfono que esté no consumido y no expirado, con
  `intentos < 5`. Compara con bcrypt.
- Éxito: marca `consumido_en`, hace upsert en `pacientes` (crea si no existe →
  `es_nuevo: true`; si existe → actualiza `ultimo_acceso`, `es_nuevo: false`), emite JWT
  `rol:"paciente"`, `sub: paciente_id`, claim `nombre`.
  - Respuesta: `{ "data": { "paciente_id", "auth_token", "telefono", "nombre", "es_nuevo" } }`
- Fallo (código incorrecto/expirado/sin OTP vigente): incrementa `intentos`, responde
  `401` genérico (`{"error":{"code":"OTP_INVALIDO","message":"Código incorrecto o vencido"}}`).
  Agotados los 5 intentos, el OTP queda inutilizable y debe solicitarse uno nuevo.

**`GET /paciente/me`** (protegido con `verify_token`, exige `rol == "paciente"`)
- Devuelve `{ "data": { "paciente_id", "telefono", "nombre" } }`. Permite al frontend
  validar un token guardado al cargar.

**`PATCH /paciente/me`** (protegido)
- Body: `{ "nombre": string }`. Fija/actualiza el nombre del paciente. Devuelve el
  perfil actualizado.

### JWT

Se generaliza `dosisya.security.create_jwt_token` para emitir el claim `nombre`
(nombre para mostrar) manteniendo `nombre_farmacia` como alias temporal. El token del
paciente lleva `sub = paciente_id`, `rol = "paciente"`, `nombre`, `iat`, `exp` (TTL 7
días, igual que B2B). `verify_token` no cambia; los endpoints de paciente validan
`token_data["rol"] == "paciente"`.

### Seguridad

- Código hasheado con bcrypt; nunca se almacena ni se loguea en claro.
- TTL 5 min, máx 5 intentos de verificación, cooldown de 60s entre solicitudes.
- Rate-limit por IP (`client_ip`) y por teléfono vía `dosisya.limiter`.
- Respuestas genéricas en solicitar-codigo y en fallo de verificar (anti-enumeración).
- Teléfono normalizado a E.164 antes de cualquier consulta.
- SQL con parámetros posicionales `$N`.

## Frontend (`DosisYa-Frontend`)

### `src/lib/pacienteAuth.ts` (espejo de `adminAuth.ts`)
Sesión en `localStorage`, con guardas `typeof window === "undefined"`:
- `guardarSesionPaciente(r)`, `getPacienteToken()`, `esPacienteLogueado()`,
  `getPacientePerfil()` (`{telefono, nombre}`), `cerrarSesionPaciente()`.
- Claves: `paciente_token`, `paciente_perfil`.

### `src/lib/pacienteApi.ts` (espejo de `adminApi.ts`)
- `solicitarCodigo(telefono)`, `verificarCodigo(telefono, codigo)`, `obtenerPerfil()`,
  `actualizarNombre(nombre)`.
- Usa `API_BASE` y header `Authorization: Bearer <token>` en llamadas protegidas.
- Respuestas validadas con Zod; errores mapeados a mensajes amistosos.

### `HojaLoginPaciente.tsx` — flujo real de 2 pasos (mismo Drawer de vaul)
- **Paso 1 — teléfono:** input con prefijo `+58`. "Continuar con teléfono" →
  `solicitarCodigo` → avanza a paso 2. "Seguir sin cuenta" se conserva como salida
  siempre disponible.
- **Paso 2 — código:** input de 6 dígitos. "Verificar" → `verificarCodigo` → guarda
  sesión, cierra Drawer, toast de bienvenida. Link "Reenviar" con contador de 60s;
  botón "atrás" a paso 1.
- **Nombre opcional (solo `es_nuevo`):** campo saltable "¿Cómo te llamamos?" que llama a
  `actualizarNombre`; se puede omitir.
- Nada bloquea buscar ni la Lista Médica en ningún paso.

### `usePacienteSesion` (hook)
- Expone `{ logueado, perfil, cerrarSesion }` para el punto de cuenta en `App.tsx`
  (`onAbrirCuenta`), que mostrará el nombre y ofrecerá "Cerrar sesión".
- Al cargar la app, si hay token lo valida con `GET /paciente/me`; ante 401 limpia la
  sesión en silencio.

### Sin sincronía en Fase 1
La Fase 1 **no** toca `useListaMedica` ni `useFavoritos`: la Lista Médica sigue en
`localStorage`. El login persiste la identidad; la sincronía en nube llega en fases 2–4.

## Flujo de datos (login)
Tap "Iniciar sesión" → Drawer → teléfono → FE `solicitarCodigo` → BE guarda OTP
hasheado + `POST` webhook n8n → n8n → OpenWA → WhatsApp → paciente escribe código →
FE `verificarCodigo` → BE verifica + upsert `pacientes` + JWT → FE guarda sesión →
header muestra el nombre.

## Manejo de errores
- **Envío falla:** respuesta 200 genérica igual (anti-enumeración), error en
  `webhook_errors`. El usuario puede "Reenviar". Trade-off aceptado para el MVP: si el
  webhook está caído el usuario espera un código que no llega; mitigado con reenvío.
- **Código malo/vencido:** 401 genérico + contador de intentos; a los 5, pedir uno nuevo.
- **Rate-limit / cooldown:** 429 → mensaje amistoso ("Espera un momento").
- **Red:** toasts (sonner), nunca bloquea la UI.

## Testing
- **Backend (pytest):** normalizar teléfono; emitir OTP (guarda hash, TTL correcto);
  verify feliz (crea paciente, devuelve token, `es_nuevo`); código incorrecto
  (`intentos++`); OTP expirado; máx intentos agotados; anti-enumeración (misma forma de
  respuesta exista o no el teléfono); rate-limit/cooldown. Mock del webhook n8n.
- **Frontend (vitest):** `pacienteAuth` (round-trip en storage, guardas SSR);
  `pacienteApi` (parseo de respuestas y mapeo de errores), al estilo de
  `leads.test.ts` / `adminApi.test.ts`; test de transiciones del Drawer si es viable.
- **E2E/manual:** con un teléfono real y el flujo n8n configurado en un deploy preview.

## Dependencias externas / pasos de deploy
- Crear el flujo n8n: webhook (recibe `{telefono, codigo}`) → enviar texto por OpenWA.
- Configurar env `N8N_OTP_WEBHOOK_URL` en el backend (Vercel).
- Aplicar la migración `014_pacientes_auth.sql` a Supabase prod (vía Supabase MCP).

## Fuera de alcance (Fase 1)
- Sincronía en nube de Lista Médica, historial y recetas (fases 2–4).
- Borrado de cuenta / flujos de privacidad.
- Cambio de número de teléfono.
- Cerrar sesión en todos los dispositivos / gestión multi-sesión.

## Roadmap posterior (esbozo)
- **Fase 2 — Lista Médica en la nube:** tablas de lista del paciente, endpoints
  CRUD protegidos, sincronía `useListaMedica` ↔ servidor con merge al iniciar sesión.
- **Fase 3 — Historial:** persistir búsquedas y contactos a WhatsApp del paciente
  logueado; pantalla de historial.
- **Fase 4 — Recetas guardadas:** persistir recetas escaneadas con IA ligadas al
  paciente, reutilizables sin volver a subir la foto.
