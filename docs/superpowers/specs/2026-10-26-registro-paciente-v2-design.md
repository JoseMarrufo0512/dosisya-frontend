# Diseño — Registro de paciente v2 (formulario + Google, retirar OTP WhatsApp)

**Fecha:** 2026-10-26
**Repos:** DosisYa-Frontend (UI) y DosisYa-Backend (migración + endpoints). José autorizó
expresamente tocar el backend para esta feature; la configuración de Google Cloud y los secretos
los aporta él.
**Reemplaza:** el login Fase 1 por OTP de WhatsApp (`docs/.../2026-10-14-login-opcional-paciente-fase1`).
**Ticket:** `docs/features/registro-paciente-v2.md`.

## Objetivo

Dar al paciente una cuenta real que permita a DosisYa **notificarlo, acercarse y fidelizarlo**, y
construir una **base de pacientes**. La cuenta sustituye el OTP de WhatsApp por:
registro con **formulario completo** (correo + contraseña) y **registro/login con Google**.

## No-objetivos (features aparte)

- Enviar notificaciones (WhatsApp / correo / push): v2 solo **capta** los datos que las habilitarán.
- Verificación del correo (enlace/código): mejora posterior, no bloqueante del MVP.
- Bloquear la búsqueda tras login: la cuenta es **opcional**; buscar y contactar siguen sin fricción.

## Decisiones cerradas con José

| Tema | Decisión |
|---|---|
| Campos | nombre, apellido, correo, teléfono, **documento (obligatorio)**, género (opcional) |
| Auth no-Google | **correo + contraseña** (bcrypt) |
| Auth social | **Google** (Google Identity Services, ID token verificado en backend) |
| OTP WhatsApp | **se retira** (frontend) y se **deprecan** los endpoints OTP (backend) |
| Cuenta | **opcional**; la búsqueda NO se bloquea; se conserva "Seguir sin cuenta" |
| Verificación de correo | fuera de alcance (posterior) |

## Arquitectura y flujos

Todos los flujos terminan emitiendo un **JWT HS256** (patrón `dosisya.security.create_jwt_token`,
rol `paciente`, 7 días) + **cookie HttpOnly** (`set_auth_cookie`, igual que el auth de farmacia D4).
El `auth_token` también vuelve en el body durante la transición (mismo patrón que farmacia).

1. **Registro por correo:** formulario con todos los campos + contraseña → `POST /paciente/registro`
   → crea fila `pacientes` → sesión.
2. **Login por correo:** `POST /paciente/login` (correo + contraseña) → sesión.
3. **Google (cuenta ya existe):** botón Google → ID token → `POST /paciente/google` → si el
   `google_sub` ya está en BD → sesión completa.
4. **Google (primera vez):** `POST /paciente/google` no encuentra el `google_sub` → responde
   `perfil_incompleto` + un **token de pre-registro** de vida corta (rol `paciente_preregistro`,
   solo sirve para completar) + prefill `{nombre, correo}` que da Google → el frontend muestra
   **"Completa tu perfil"** (teléfono + documento + género) → `POST /paciente/google/completar`
   (auth: token de pre-registro) → crea la fila con todos los campos → sesión completa.

   > Se usa un token de pre-registro en vez de crear una fila a medias, para **no romper** el
   > `telefono NOT NULL` existente ni dejar pacientes sin documento. La fila se crea solo cuando el
   > perfil está completo.

## Datos — migración 015 (DosisYa-Backend)

`db/migrations/015_pacientes_registro_v2.sql`. La tabla `pacientes` hoy es
`id, telefono (UNIQUE NOT NULL), nombre, creado_en, ultimo_acceso`.

```sql
BEGIN;

ALTER TABLE pacientes
  ADD COLUMN IF NOT EXISTS apellido      TEXT,
  ADD COLUMN IF NOT EXISTS correo        TEXT,
  ADD COLUMN IF NOT EXISTS documento     TEXT,
  ADD COLUMN IF NOT EXISTS genero        TEXT,
  ADD COLUMN IF NOT EXISTS password_hash TEXT,   -- NULL si la cuenta es solo-Google
  ADD COLUMN IF NOT EXISTS google_sub    TEXT;    -- id estable de la cuenta Google (claim "sub")

-- Unicidad case-insensitive del correo y única de documento/google; parciales para
-- no chocar con filas legacy (Fase 1) que solo tienen telefono.
CREATE UNIQUE INDEX IF NOT EXISTS uq_pacientes_correo
  ON pacientes (lower(correo))  WHERE correo    IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_pacientes_documento
  ON pacientes (documento)      WHERE documento IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_pacientes_google
  ON pacientes (google_sub)     WHERE google_sub IS NOT NULL;

ALTER TABLE pacientes
  ADD CONSTRAINT chk_pacientes_genero
  CHECK (genero IS NULL OR genero IN ('femenino','masculino','no_binario','no_especifica'));

-- OTP de Fase 1: se deja de usar. Se puede dropear aquí o en limpieza posterior.
-- DROP TABLE IF EXISTS pacientes_otp;

COMMIT;
```

- Las columnas nuevas quedan **nullable en la BD**; la obligatoriedad (documento, correo, teléfono,
  contraseña) se exige en la **API** al registrar. Esto evita romper las filas Fase 1 (datos de
  prueba pre-lanzamiento) y permite cuentas solo-Google sin contraseña.
- `telefono` sigue `UNIQUE NOT NULL`. La fila solo se crea cuando hay teléfono (registro por correo
  trae todo; Google crea la fila en el paso "completar").
- **RLS / PII:** `documento` es PII sensible. La tabla `pacientes` debe tener RLS habilitado y sin
  acceso anónimo (coherente con la auditoría RLS de oct-2026). Verificar en la migración/advisors.

## Backend — endpoints (DosisYa-Backend, `routers/pacientes_auth.py`)

Reutilizan `dosisya.security` (`create_jwt_token`, `set_auth_cookie`, `clear_auth_cookie`) y
`bcrypt`. Validación con Pydantic. Conflictos devuelven **409** con un `code` claro (patrón
`_conflict_response` del auth de farmacia).

| Método | Ruta | Body | Respuesta |
|---|---|---|---|
| POST | `/api/v1/paciente/registro` | nombre, apellido, correo, telefono, documento, genero?, password | 201 sesión / 409 `correo_en_uso`\|`documento_en_uso`\|`telefono_en_uso` / 422 |
| POST | `/api/v1/paciente/login` | correo, password | 200 sesión / 401 `credenciales_invalidas` |
| POST | `/api/v1/paciente/google` | id_token | 200 sesión (si `google_sub` existe) / 200 `{perfil_incompleto:true, preregistro_token, prefill:{nombre,correo}}` / 401 `google_token_invalido` |
| POST | `/api/v1/paciente/google/completar` | telefono, documento, genero? (auth: preregistro_token) | 201 sesión / 409 dup / 401 token inválido |
| GET | `/api/v1/paciente/me` | — (auth) | 200 perfil (ya existe; ampliar campos) |
| PATCH | `/api/v1/paciente/me` | nombre?, apellido?, genero? (auth) | 200 perfil |
| ~~POST~~ | ~~`/auth/solicitar-codigo`~~, ~~`/auth/verificar-codigo`~~ | — | **DEPRECADOS**: eliminar o devolver 410 Gone |

- **Contraseña:** mínimo 8 caracteres (Pydantic). Hash con `bcrypt.hashpw`; verificación
  `bcrypt.checkpw` (bytes UTF-8, como el auth de farmacia).
- **Sesión (perfil que vuelve):** `paciente_id, auth_token, nombre, apellido, correo, telefono,
  documento, genero`.
- **Rate limiting** en `login`, `registro` y `google` contra fuerza bruta (reusar el limiter del
  backend si está disponible; ver memoria sobre el estado del bundling de redis en prod).
- **Token de pre-registro:** JWT de vida corta (p. ej. 15 min), claim `rol="paciente_preregistro"`
  + `google_sub`, `correo`, `nombre`. El endpoint `completar` lo exige y lo distingue de una sesión
  real; ninguna ruta de sesión normal lo acepta.

## Google OAuth — enfoque

**Google Identity Services (GIS)** en el frontend produce un **ID token** (JWT). El backend lo
**verifica** contra las claves públicas de Google. Enfoque elegido sobre el flujo de código de
autorización (con redirect + client secret) por ser más simple y no requerir manejar el secret para
verificar ID tokens.

- **Backend:** añadir dependencia `google-auth`; verificar con
  `google.oauth2.id_token.verify_oauth2_token(token, google.auth.transport.requests.Request(), CLIENT_ID)`.
  Alternativa sin dependencia nueva: `GET https://oauth2.googleapis.com/tokeninfo?id_token=...` con
  el `httpx` existente (menos robusto; preferir `google-auth`). De la verificación se toman `sub`
  (→ `google_sub`), `email`, `name`.
- **Env vars:** `GOOGLE_OAUTH_CLIENT_ID` (backend) y `VITE_GOOGLE_CLIENT_ID` (frontend) — **mismo**
  Client ID. **José aporta:** crear el OAuth Client ID (tipo "Web") en Google Cloud, con los
  orígenes autorizados (dominios de dev/preview/prod) y cargar las env vars en Vercel.
- **CSP:** permitir los dominios de GIS (`https://accounts.google.com/gsi/`) en `script-src`,
  `connect-src` y `frame-src` de `src/lib/csp.ts`. **Validar en preview** (la CSP no se prueba en
  build local; ver lección CSP del CLAUDE.md).

## Frontend — cambios (DosisYa-Frontend)

- **`src/components/paciente/HojaLoginPaciente.tsx`:** reescribir. Pasos/pestañas:
  "Crear cuenta" (formulario completo con React Hook Form + Zod), "Iniciar sesión"
  (correo + contraseña), botón **"Continuar con Google"** (GIS), y paso **"Completa tu perfil"**
  (teléfono + documento + género) tras Google-primera-vez. Conservar **"Seguir sin cuenta"**.
- **`src/lib/pacienteApi.ts`:** nuevas funciones `registro()`, `login()`, `googleLogin(idToken)`,
  `completarPerfilGoogle()`, y `actualizarPerfil()`; **eliminar** `solicitarCodigo` y
  `verificarCodigo`. Esquemas Zod de respuesta ampliados.
- **`src/lib/pacienteAuth.ts`:** `PacientePerfil` gana `apellido, correo, documento, genero`.
  Manejo de token/cookie espejo del auth de farmacia (cookie HttpOnly del backend + perfil en
  localStorage para la UI).
- **GIS script:** cargar `https://accounts.google.com/gsi/client` solo cuando se abre la hoja de
  login (no en SSR). Leer `VITE_GOOGLE_CLIENT_ID`.
- **`src/App.tsx`:** sigue invocando `HojaLoginPaciente` (sin cambio de contrato de apertura).

## Legales

La Política de Privacidad §4 ("Si creas una cuenta de paciente") ya describe nombre, apellido,
correo, documento, teléfono, género y datos de Google — se escribió anticipando esta feature. Al
salir v2 a producción: **solo verificar consistencia** y, junto con la revisión legal, retirar el
banner "Borrador" (según los 3 gates del PR #53). Términos §2 ya menciona la cuenta opcional.

## Decomisión del OTP

- Frontend: borrar el flujo OTP de `HojaLoginPaciente` y las llamadas OTP de `pacienteApi`.
- Backend: eliminar (o devolver 410) `solicitar-codigo`/`verificar-codigo`; dejar de usar el
  webhook n8n de OTP (`N8N_OTP_WEBHOOK_URL`); `pacientes_otp` se dropea en la 015 o en limpieza.

## Seguridad

- Contraseñas: bcrypt, nunca en claro ni en logs. Política mínima 8 caracteres.
- JWT HS256 firmado; cookie HttpOnly (mitiga XSS robando el token).
- 409 en conflictos de unicidad sin filtrar si el correo "existe" más de lo necesario (mensaje
  genérico razonable). Rate limiting en los endpoints de auth.
- `documento` es PII: RLS en `pacientes`, sin lectura anónima; correr advisors de Supabase.
- Verificar el ID token de Google del lado servidor (nunca confiar en el cliente): `aud` == Client
  ID, `iss` == accounts.google.com, firma válida, no expirado.

## Secuenciación de deploy

1. Aplicar **migración 015** a Supabase (antes del código, o los endpoints fallan).
2. Env vars `GOOGLE_OAUTH_CLIENT_ID` (backend) y `VITE_GOOGLE_CLIENT_ID` (frontend) en Vercel.
3. Desplegar backend (endpoints nuevos + google-auth).
4. Desplegar frontend (UI nueva, retiro de OTP) + CSP con dominios de Google; **validar en preview**
   que Google funciona y que `/api/v1/paciente/*` responde 200 (con adblocker activo, por el proxy).

## Verificación

- Backend: tests de pytest para registro/login/google/completar (éxito, 409 dup, 401 credenciales,
  ID token inválido). Ejecutar la suite (ver memoria: main del backend arrastra tests rojos por
  orden; no agregar regresiones nuevas).
- Frontend: `npx tsc --noEmit && npm run build`. Usar el skill `contrato-api` al escribir las
  llamadas. Prueba manual de los 4 flujos en preview.

## Pendiente de aportar/decidir por José

- Crear el **OAuth Client ID** en Google Cloud y cargar las env vars (bloqueante para el flujo
  Google).
- ¿"Tipo de persona" (natural/jurídica) del formulario Farmatodo? → se **descarta** para paciente
  salvo que digas lo contrario.
- Política de contraseña (se asume mínimo 8 caracteres si no indicas otra).

## Fuera de alcance (confirmado)

- Notificaciones (canal y envío), verificación de correo, "olvidé mi contraseña" (se puede añadir
  en una fase inmediata posterior; no bloquea el MVP de registro/login).
