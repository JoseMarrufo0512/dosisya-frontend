# Diseño — Panel Súper Admin (v1)

**Fecha:** 2026-07-14
**Estado:** Aprobado (brainstorming) — pendiente de plan de implementación
**Alcance:** Primer sub-proyecto del "súper admin". Los siguientes (si aplican) tendrán su propio spec.

## 1. Contexto y problema

DosisYa no tiene forma de que el operador (el equipo DosisYa) gestione la red de
farmacias. Hoy toda farmacia que se registra queda **activa** de inmediato y
aparece en las búsquedas sin control; no hay panel para aprobar, suspender,
corregir datos ni ver cuánto debe cada farmacia por CPC.

El schema ya anticipa el rol: existe la tabla `usuarios` (con `rol_usuario_enum`
= `superadmin | admin_farmacia | operador`) y una fila superadmin sembrada
(`admin@dosisya.com`, hash placeholder). El JWT ya se parametriza por rol
(`create_jwt_token(sub, rol, ...)`) y la autorización por recurso ya contempla
`rol == "superadmin"`. Pero **ningún código usa `usuarios`** todavía y no hay
endpoints ni frontend de gestión.

## 2. Objetivo (v1)

Un panel aislado donde el operador se autentica como `superadmin` y puede:

1. **Ver todas las farmacias** (con filtro por estado).
2. **Aprobar** farmacias pendientes y **suspender / reactivar / rechazar** cualquiera.
3. **Editar** los datos de cualquier farmacia.
4. Ver una **tabla de facturación**: leads del mes y deuda estimada por farmacia,
   con totales de red.

**No-objetivos (v1):** gestión de otros operadores/roles, edición de tarifas CPC,
histórico de facturación por meses anteriores, exportaciones. Fuera de alcance.

## 3. Arquitectura (Enfoque A — namespace aislado)

Namespace propio en frontend (`super.*`) + router backend dedicado. Cero cambios
al login de farmacias (`farmacias_auth`) ni a `admin.dashboard.tsx`.

| Pieza | Responsabilidad | Depende de |
|---|---|---|
| `usuarios` (tabla, ya existe) | Credenciales + rol del superadmin | — |
| `POST /api/v1/auth/admin/login` (en `auth.py`) | Validar contra `usuarios` (rol=superadmin, activo), emitir JWT rol=superadmin | `usuarios`, `create_jwt_token` |
| `routers/admin_super.py` (nuevo) | Endpoints de gestión (listar, cambiar estado) | `verify_token` (exige superadmin), BD |
| `PATCH /api/v1/farmacias/{id}` (ya existe) | Editar datos de cualquier farmacia | ya soporta `rol=superadmin` |
| `super.login.tsx` + `super.dashboard.tsx` (frontend nuevo) | Login + panel (secciones Farmacias y Facturación) | endpoints `/admin/*` |
| Guard de rol (`src/lib/adminAuth.ts`) | Bloquear panel si no hay JWT superadmin | localStorage/JWT |

**Autorización:** `verify_token` devuelve `{sub, rol}`. Los `/admin/*` rechazan con
**403** cualquier token con `rol != "superadmin"`. Para el superadmin `sub` =
`usuario_id` (no una farmacia); los endpoints `/admin/*` no asumen que `sub` sea
farmacia, así que no hay conflicto con el flujo B2B.

## 4. Datos y cambios de schema (gate de aprobación)

### 4.1 Nuevo estado `pendiente`
```sql
-- Migración aparte (ALTER TYPE ... ADD VALUE no corre en transacción con otros cambios)
ALTER TYPE estado_afiliacion_enum ADD VALUE 'pendiente';
```
Enum resultante: `pendiente`, `activa`, `inactiva`.

### 4.2 Máquina de estados

| Desde | Acción | Hasta | Efecto en búsqueda pública |
|---|---|---|---|
| `pendiente` | Aprobar | `activa` | empieza a aparecer |
| `activa` | Suspender | `inactiva` | deja de aparecer |
| `inactiva` | Reactivar | `activa` | vuelve a aparecer |
| `pendiente` | Rechazar | `inactiva` | nunca apareció |

El superadmin puede cualquier transición (target-estado, no acción); el frontend
muestra los botones correctos según el estado actual.

### 4.3 Registro entra `pendiente`
- `auth.py:137`: cambiar el literal `'activa'` → `'pendiente'` en el `INSERT INTO farmacias`.
- UX: el paso final del wizard de registro (`admin.login.tsx`, `RegisterCard`)
  cambia de "llevándote a tu panel" a un mensaje de "afiliación recibida, te
  activaremos pronto". El login le sigue funcionando; solo no aparece en
  búsquedas hasta aprobación.

### 4.4 Búsqueda pública — sin cambios
`medicamentos.py:111` y `repository.py:238` ya filtran `WHERE f.estado_afiliacion = 'activa'`.
Como `pendiente`/`inactiva` no son `'activa'`, ya quedan excluidas.

### 4.5 Farmacias existentes
La migración solo añade el valor al enum; **no reescribe filas**. Las farmacias
activas de hoy siguen activas. Solo las nuevas entran `pendiente`.

### 4.6 Contraseña del superadmin
La fila sembrada tiene hash placeholder. Script `scripts/set_superadmin_password.py`
(backend) que genera un bcrypt real y hace el `UPDATE usuarios SET password_hash=…
WHERE email='admin@dosisya.com'`. El operador lo corre una vez con la contraseña
elegida. No se hardcodea contraseña en el schema.

Sin tablas nuevas: se reusa `usuarios` (auth) y `farmacias` (gestión). Facturación
se calcula on-the-fly.

## 5. Endpoints backend

Todos bajo `verify_token` que exige `rol == "superadmin"` (403 si no). Envoltorio
`RespuestaEstructurada` (`{status, message, data}`).

### 5.1 `POST /api/v1/auth/admin/login` (en `auth.py`)
- Body: `{ "correo": string, "password": string }` — se usa `correo` por
  consistencia con el login de farmacia; mapea a la columna `usuarios.email`.
- Valida `usuarios` donde `rol='superadmin'` y `activo=true`; bcrypt check.
- 200 → `data: { auth_token, rol: "superadmin", email, usuario_id }`.
- 401 credenciales inválidas o usuario inactivo (genérico, sin revelar si el correo existe).
- Emite `create_jwt_token(usuario_id, rol="superadmin", nombre_farmacia="")`.

### 5.2 `GET /api/v1/admin/farmacias` (endpoint único: gestión + facturación)
- Query opcional: `?estado=pendiente|activa|inactiva` — filtra **solo la lista
  `farmacias`**. Los `totales` se calculan **siempre sobre toda la red**,
  independientes del filtro (para facturación no deben cambiar al filtrar).
- Una sola query: `farmacias LEFT JOIN leads_interacciones` (leads del mes actual)
  con `GROUP BY` por farmacia. Orden: `pendiente` primero, luego `created_at DESC`.
- 200 → `data`:
  ```json
  {
    "farmacias": [{
      "id", "nombre", "whatsapp", "sector", "punto_referencia",
      "estado_afiliacion", "nivel_suscripcion", "created_at",
      "leads_mes", "deuda_usd"
    }],
    "totales": { "total_farmacias", "pendientes", "leads_mes_red", "deuda_red_usd" }
  }
  ```
- `deuda_usd = leads_mes * TARIFA_BASE_CPC_USD` (0.10).

### 5.3 `PATCH /api/v1/admin/farmacias/{id}/estado`
- Body: `{ "estado_afiliacion": "activa" | "inactiva" | "pendiente" }` (validado contra el enum).
- `UPDATE farmacias SET estado_afiliacion=$2, updated_at=now() WHERE id=$1 RETURNING …`.
- 200 → farmacia actualizada · 404 si no existe · 422 estado inválido · 400 UUID inválido.

### 5.4 Editar farmacia
Reusa `PATCH /api/v1/farmacias/{id}` (ya superadmin-aware). Cero código nuevo.

## 6. Frontend

**Rutas nuevas (file-based, espejo de `admin.*`):**
- `src/routes/super.login.tsx` — login del superadmin. Reusa `Field`/`Button`/`ErrorBox`.
  Guarda `auth_token` + `rol` en localStorage; navega a `/super/dashboard`.
- `src/routes/super.dashboard.tsx` — shell con sidebar de 2 secciones: **Farmacias** y **Facturación**.

**Guard de rol:** `src/lib/adminAuth.ts` lee JWT/localStorage; si no hay token o
`rol !== "superadmin"`, redirige a `/super/login`. Se ejecuta en el
`beforeLoad`/`useEffect` del dashboard (mismo patrón que hoy usa `admin.dashboard.tsx`).

**Componentes de dominio (`src/components/super/`):**
- `TablaFarmacias.tsx` — tabla con filtro por estado; badge de estado y botones
  contextuales: `pendiente`→[Aprobar][Rechazar], `activa`→[Suspender][Editar],
  `inactiva`→[Reactivar][Editar].
- `EditarFarmaciaDrawer.tsx` — drawer (vaul) que reusa el form de Configuración
  para editar cualquier farmacia vía el `PATCH` existente.
- `TablaFacturacion.tsx` — tabla por farmacia (leads_mes, deuda_usd) + fila de totales arriba.

**Estado/datos:** TanStack Query — `useQuery` para `GET /admin/farmacias`,
`useMutation` para cambio de estado y edición, con `invalidateQueries` para
refrescar. Skeleton loaders mientras carga (no bloquear la UI). Toasts con `sonner`.

**Una sola request:** el panel hace **un** fetch sin filtro (toda la red) que
alimenta ambas secciones. El filtro por estado de la sección Farmacias se aplica
**client-side** sobre ese dataset (escala Acarigua/Araure — pocos registros), así
los `totales` de facturación quedan siempre globales. El query param `?estado`
del endpoint queda disponible para uso directo/curl y tests, pero el frontend v1
no lo usa.

**Sin tocar** `admin.login.tsx` (salvo el mensaje final del wizard, 4.3) ni `admin.dashboard.tsx`.

## 7. Manejo de errores

**Backend:**
- Login superadmin: 401 genérico; `activo=false` → 401.
- `/admin/*` con rol `admin_farmacia` → 403 (token válido, rol no autoriza). Token ausente/expirado → 401.
- `PATCH .../estado`: estado fuera del enum → 422; farmacia inexistente → 404; UUID inválido → 400.
- Errores de BD → 500 genérico + `logger.error` (nunca filtrar SQL).

**Frontend:**
- Guard: sin token o rol distinto → redirige a `/super/login`.
- 401/403 en cualquier request → limpiar localStorage + a login ("Tu sesión expiró").
- Mutaciones fallidas → toast de error + refetch (la tabla no queda en estado falso).

## 8. Testing

**Backend (pytest, patrón `test_farmacias_config.py` con BD mockeada):**
1. Login superadmin OK → 200 + `rol=superadmin`.
2. Login password errónea / usuario inactivo → 401.
3. `GET /admin/farmacias` con token superadmin → 200 y forma correcta (farmacias + totales).
4. `GET /admin/farmacias` con token de farmacia → 403.
5. `PATCH .../estado` `pendiente→activa` → 200; estado inválido → 422.
6. Deuda = `leads_mes * 0.10` (verifica el agregado).
7. Registro nuevo entra `pendiente` (test del cambio en `auth.py`).

**Frontend:** verificación con el preview del flujo login→panel→aprobar→facturación;
`npx tsc --noEmit && npm run build` antes de cerrar.

**End-to-end manual (operador):** correr la migración del enum + el script de
contraseña en Supabase, y probar el ciclo completo con una farmacia de prueba.

## 9. Riesgos y notas

- **`ALTER TYPE ADD VALUE`** debe ir en su propia migración/transacción.
- **Despliegue:** los cambios de backend (enum, login, endpoints, registro
  `pendiente`) deben desplegarse a Vercel; el gate de aprobación cambia el
  comportamiento de registro en producción — coordinar con el frontend.
- **Contrato:** `sub` del JWT superadmin = `usuario_id`, no `farmacia_id`. Documentar
  para evitar futuros bugs de "una farmacia no puede ver otra".
- **Regla del proyecto:** el backend es fuente de verdad; verificar cada endpoint
  contra `models.py` / `schema.sql` al implementar (skill `contrato-api`).
