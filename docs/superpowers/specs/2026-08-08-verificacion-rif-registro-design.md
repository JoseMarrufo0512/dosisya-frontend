# Spec: Verificación en vivo de RIF duplicado en el wizard de registro

**Fecha:** 2026-08-08
**Estado:** aprobado en diseño, pendiente de plan de implementación
**Contexto:** Al depurar un 500 en `POST /api/v1/auth/register` (migración de BD faltante, resuelto por separado), José notó que hoy el wizard de registro (`admin.login.tsx`, `RegisterCard`) no avisa si un RIF ya está registrado hasta el paso 3 final (`POST /api/v1/auth/register` devuelve `409 RIF_TAKEN`). Si alguien se equivoca de RIF en el paso 1, completa los 3 pasos (incluyendo crear su contraseña) antes de enterarse del conflicto. Se pidió una verificación en vivo al llenar el campo RIF.

## 1. Estado actual (verificado antes de diseñar)

- `step1Schema` en `admin.login.tsx` solo valida el **formato** del RIF (`RIF_REGEX`), no su unicidad.
- La única verificación de unicidad real ocurre en el backend, en `POST /api/v1/auth/register` (`auth.py`), que devuelve `409` con `{"error": {"code": "RIF_TAKEN", "message": "..."}}` si el RIF ya existe en `farmacias`.
- No existe ningún endpoint de solo-lectura para consultar disponibilidad de RIF/correo antes del registro final (confirmado con `grep` sobre `routers/auth.py` y `routers/farmacias.py`).
- El auto-save de `POST /api/v1/leads/parcial` al terminar el paso 1 ya tiene un bug conocido y no relacionado (constraint único de WhatsApp devuelve 500) — no se reutiliza ni se toca en este spec.

## 2. Backend — nuevo endpoint `GET /api/v1/auth/rif-disponible`

Nuevo endpoint en `DosisYa-Backend/src/dosisya/routers/auth.py`, junto a `login`/`register`.

- **Método y ruta:** `GET /api/v1/auth/rif-disponible?rif=J-12345678-9`
- **Auth:** público (sin JWT) — se usa antes de que exista una cuenta.
- **Rate limit:** `@limiter.limit("20/minute")` (más generoso que login/register porque el usuario puede editar el campo y perder el foco varias veces).
- **Validación de entrada:** el query param `rif` debe matchear `^[JVEGP]-\d{8}-\d$`; si no, `422`.
- **Query:** `SELECT 1 FROM farmacias WHERE rif = $1 LIMIT 1` (misma tabla y columna que usa `_INSERT_FARMACIA`).
- **Respuesta 200:**
  ```json
  {"data": {"disponible": true}}
  ```
  (`disponible: false` si ya existe una fila con ese RIF)
- **Errores:** `422` formato inválido, `429` rate limit, `500` error interno (mismo patrón que el resto del router).
- **Por qué un endpoint dedicado y no reusar `/leads/parcial`:** ese endpoint tiene otra responsabilidad (crear/actualizar un lead parcial) y ya tiene un bug de constraint único sin resolver; mezclar la verificación de RIF ahí violaría responsabilidad única y heredaría ese bug. Un `GET` de solo lectura es más simple, cacheable por el navegador si hiciera falta, y no muta estado.

## 3. Frontend — estado y flujo en `RegisterCard`

Nuevo estado local en `RegisterCard` (`admin.login.tsx`):

```ts
type RifStatus = "idle" | "checking" | "available" | "taken" | "error";
const [rifStatus, setRifStatus] = useState<RifStatus>("idle");
```

**Disparo de la verificación:**
- `onBlur` del campo RIF (no mientras escribe).
- Solo si el valor actual pasa `RIF_REGEX` (si el formato es inválido, ya se muestra ese error de Zod y no tiene sentido consultar el backend).
- Fetch a `GET /api/v1/auth/rif-disponible?rif=<valor>`.

**Transiciones:**
- Al iniciar el fetch → `rifStatus = "checking"`.
- Respuesta `{disponible: true}` → `rifStatus = "available"`.
- Respuesta `{disponible: false}` → `rifStatus = "taken"`.
- Error de red, `422`, `429` o `500` → `rifStatus = "error"`.
- Cualquier edición del campo RIF después de un blur (`onChange`) → `rifStatus = "idle"` (se debe volver a salir del campo para re-verificar; mismo patrón que ya usa `update()` para limpiar `fieldErrors`).

**Mensajes bajo el campo** (mismo slot que usa `error` en el componente `Field`, mutuamente excluyente con los errores de Zod — si Zod ya marcó error de formato, ese mensaje tiene prioridad y no se dispara el fetch):

| `rifStatus` | Mensaje | Botón "Siguiente" |
|---|---|---|
| `idle` / `available` | (ninguno) | habilitado |
| `checking` | (spinner discreto dentro del campo, sin mensaje) | **deshabilitado** |
| `taken` | "Este RIF ya está registrado." | **deshabilitado** |
| `error` | "No pudimos verificar el RIF. Intenta de nuevo." | **deshabilitado** |

**Guarda adicional en `handleStep1`:** además de deshabilitar el botón, `handleStep1` retorna temprano (sin avanzar de paso) si `rifStatus` es `"checking"` o `"taken"` — defensa en profundidad por si el clic llega antes de que React repinte el botón deshabilitado.

## 4. Fuera de alcance (explícito)

- Verificación en vivo de correo o WhatsApp duplicados (solo se pidió RIF).
- Cambiar el comportamiento del paso 3 (`POST /api/v1/auth/register`) — su chequeo de unicidad server-side sigue siendo la fuente de verdad final; este endpoint es solo feedback temprano en UX.
- Tocar el auto-save de `POST /api/v1/leads/parcial` o su bug de WhatsApp duplicado.
- Debounce mientras escribe — se decidió explícitamente solo `onBlur`.

## 5. Criterios de éxito

1. Al escribir un RIF ya registrado y salir del campo, aparece "Este RIF ya está registrado." y "Siguiente" queda deshabilitado, sin necesidad de llegar al paso 3.
2. Corregir el RIF (editar el campo) limpia el estado; al volver a salir del campo con un RIF libre, "Siguiente" se vuelve a habilitar.
3. Si el endpoint de verificación falla (red caída, 500, 429), el usuario ve "No pudimos verificar el RIF. Intenta de nuevo." y no puede avanzar hasta que el chequeo tenga éxito.
4. El paso 3 sigue teniendo su propio manejo de `409 RIF_TAKEN` intacto, como red de seguridad (por ejemplo si el RIF se registró en el tiempo entre el chequeo y el submit final).
5. `npx tsc --noEmit && npm run build` limpios en frontend; backend con lint/tests propios si aplica.
6. Prueba manual: RIF duplicado real → bloqueo visible → corregir → desbloqueo → completar registro exitoso.
