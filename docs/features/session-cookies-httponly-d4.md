# D4 — Session JWT en cookie HttpOnly (propuesta)

> Estado: **PROPUESTA, no implementado.** Requiere cambios coordinados en el
> backend (`DosisYa-Backend`, repo aparte → autorización expresa, CLAUDE.md §2)
> y en el frontend. Parte del delta de seguridad; ver auditoría
> `docs/contexto/auditoria-seguridad-2026-10.md` y la memoria
> `auditoria-seguridad-rls-2026-10`. Redactado 2026-10-25 tras cerrar D1 (CSP
> bloqueante), D2 (Dependabot) y D3 (escaneo de historial git).

## Por qué

El JWT de sesión (7 días) vive hoy en `localStorage` → cualquier XSS puede
leerlo y robar la sesión del panel B2B o del superadmin. D1 (CSP bloqueante con
nonce) ya redujo el vector de XSS; mover el token a una cookie **HttpOnly** es
defensa en profundidad: JS no la puede leer, así que ni una inyección de script
la exfiltra.

Prioridad honesta: **defensa en profundidad, no urgente.** La BD ya está
blindada por C-01/RLS y D1 cortó el vector de script. Hacer deliberadamente.

## Encaje con el proxy mismo-origen (clave)

El navegador llama a `/api/v1/*` **mismo-origen** (ruta relativa) y Vercel
reescribe al backend server-side (`vercel.json`). Por tanto un `Set-Cookie` del
backend, al pasar por el rewrite, **se atribuye al dominio del frontend** → la
cookie se auto-envía en cada `/api/v1/*`, con `SameSite=Lax` + `Secure` +
`HttpOnly`, sin necesidad de cross-site ni `SameSite=None`.

⚠️ **A verificar en un preview:** que el rewrite de Vercel reenvía la cabecera
`Set-Cookie` del backend al navegador.

## Contrato actual (verificado 2026-10-25)

- `JWT_TTL_DAYS` = **7** por defecto, HS256 — `DosisYa-Backend/src/dosisya/security.py:102`.
- `verify_token` lee **solo** `Authorization: Bearer` — `security.py:136`.
  Lo usan: dashboard farmacia (`farmacias.py`), `admin_super.py`, `pacientes_auth.py`.
- Login:
  - `POST /api/v1/auth/login` → `{data:{farmacia_id, auth_token, nombre_farmacia}}`
  - `POST /api/v1/auth/admin/login` → `{data:{auth_token, rol, email, usuario_id}}`
  - `POST /api/v1/auth/register` → también devuelve `auth_token`.
- Frontend: guarda el token en `localStorage` (`auth_token` / `super_token`) y
  lo manda como `Authorization: Bearer` (`src/lib/adminApi.ts:73`,
  `src/lib/dashboardFarmacia.ts:83`, `src/lib/adminAuth.ts`).
- CORS `allow_headers` ya incluye `Authorization` y `X-Requested-With` —
  `main.py:178`.

## Cambios backend (PROPUESTA — autorización expresa)

1. **Login** (`/auth/login`, `/auth/admin/login`, `/auth/register`): añadir a la
   respuesta `Set-Cookie: auth_token=<jwt>; HttpOnly; Secure; SameSite=Lax;
   Path=/; Max-Age=<JWT_TTL_DAYS*86400>`.
2. **`verify_token`**: leer el token también de `request.cookies.get("auth_token")`.
   Cookie preferida; Bearer como **fallback durante la transición**.
3. **Nuevo `POST /auth/logout`**: expira la cookie (`Set-Cookie: auth_token=;
   Max-Age=0; Path=/`). Hoy no existe: el logout es solo `localStorage.clear()`
   del cliente, que no puede borrar una cookie HttpOnly.
4. **CSRF (riesgo nuevo principal):** al auto-enviarse la cookie, los endpoints
   que mutan quedan expuestos a CSRF (el Bearer header era CSRF-proof porque un
   atacante no lo puede poner cross-site). Mitigación: `SameSite=Lax` cubre la
   mayoría; defensa en profundidad = exigir un header custom (`X-Requested-With`,
   ya en el CORS) o token double-submit en los endpoints de escritura.

## Cambios frontend (se implementan cuando el backend esté listo)

1. Dejar de guardar `auth_token`/`super_token` en `localStorage`; conservar solo
   lo **no sensible** (`farmacia_id`, `nombre_farmacia`, `super_rol`,
   `super_email`) para UI y el heurístico del guard.
2. Quitar `Authorization: Bearer` de `adminApi.adminFetch` y
   `dashboardFarmacia`; confiar en la cookie (`credentials: 'same-origin'`
   explícito + header CSRF si se adopta esa vía).
3. Guards: el marcador no sensible decide el redirect optimista; la enforcement
   real sigue siendo el **401→login** (ya implementado).
4. Logout: llamar `POST /auth/logout` y limpiar el marcador local.

## Migración (sin tumbar sesiones vivas)

Backend lee cookie **y** Bearer durante la transición. Aun así, los usuarios ya
logueados (8 farmacias + 1 superadmin) tienen token en `localStorage` pero no
cookie: cuando el frontend deje de mandar Bearer → **re-login una vez**. Con 9
usuarios es trivial, pero es una decisión consciente.

## Verificación (preview, Playwright)

- Login setea la cookie con los flags correctos (`HttpOnly`, `Secure`,
  `SameSite=Lax`).
- `document.cookie` **no** la ve.
- Requests autenticados funcionan sin Bearer (solo con la cookie).
- 401 (cookie ausente/expirada) redirige a login.
- `POST /auth/logout` borra la cookie.
- Un POST estilo cross-site sin el header custom / sin SameSite se rechaza.
- Adblocker activo + `/api/v1/*` 200 (lección CLAUDE.md: portada 200 ≠ SSR sano).

## Riesgos

- **CSRF** (el principal nuevo) — mitigar con SameSite=Lax + header custom.
- **Re-login único** de los usuarios actuales.
- **SSR**: hoy los paneles autenticados se renderizan client-side, así que la
  cookie HttpOnly no hace falta en SSR. Si en el futuro se hiciera data-fetching
  autenticado en SSR, habría que reenviar la cookie al backend desde el servidor.
- Confirmar que el rewrite de Vercel reenvía `Set-Cookie`.
