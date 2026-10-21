# Decisiones pendientes (requieren a José)

> Cada entrada bloquea una tarea de `BACKLOG.md`. No se implementan por iniciativa propia — se documentan aquí y se continúa con la siguiente tarea P0 no bloqueada.

## D-001: Endpoint `GET /api/v1/tasa-actual` no existe en el backend
- **Contexto:** `src/hooks/useTasa.ts` (spec `docs/superpowers/specs/2026-07-26-asistente-ia-flotante-y-paridad-mockup-design.md`) espera este endpoint para mostrar la tasa USD→VES.
- **Estado:** ✅ **resuelta — el endpoint ya existe y funciona.** Verificado 2026-09-05 contra producción real: `curl https://proyecto-dosis-ya.vercel.app/api/v1/tasa-actual` → `200 {"status":"success","message":"Tasa vigente","data":{"tasa":36.5,...}}`. El chip "Tasa Bs 36,50/$" se ve correctamente en `/buscar` (desktop y móvil) en `https://dosisya-frontend.vercel.app`. Se implementó en algún punto entre el spec (2026-07-26) y hoy sin que se actualizara este documento. No requiere ninguna acción.

## D-002: Auth de paciente por teléfono no existe en el backend
- **Contexto:** `src/components/paciente/HojaLoginPaciente.tsx` tiene un botón "Continuar con teléfono" que hoy solo muestra un toast ("Pronto podrás..."). No hay auth de paciente en `DosisYa-Backend` (solo farmacia/superadmin), y por diseño (Cero Fricción, `CLAUDE.md` §1) el login de paciente es opcional y está fuera del MVP.
- **Opciones:** (a) mantener el placeholder tal cual hasta que haya un caso de negocio real para cuentas de paciente; (b) quitar el botón si genera expectativa falsa en usuarios reales.
- **Impacto de no decidir:** bajo — es un flujo opcional, no bloquea ningún flujo obligatorio del MVP.
- **Estado:** abierta.

## D-003: Copy legal definitivo de soporte/privacidad/términos
- **Contexto:** `src/routes/privacidad.tsx` y `src/routes/terminos.tsx` incluyen literalmente el texto "el soporte actual en la app es un placeholder de desarrollo" en la sección de contacto/soporte.
- **Opciones:** (a) José redacta o aprueba el copy real (canal de soporte, datos de contacto, políticas reales); (b) delegar la redacción a Claude con una revisión legal humana antes de publicar.
- **Impacto de no decidir:** riesgo de imagen/legal si se lanza a producción con placeholders visibles a usuarios reales — recomendado resolver antes del lanzamiento, aunque no bloquea el desarrollo de otros flujos.
- **Estado:** abierta.

## D-004: No hay forma segura de probar los flujos 7-10 del MVP sin tocar datos reales
- **Contexto:** Durante B-002 (verificación manual end-to-end, 2026-09-05) se confirmó que no existe entorno de staging: el único backend disponible habla con la base de datos real de producción (Supabase), y el único `.env` con credenciales de BD completas en `DosisYa-Backend` es `.env.vercel.prod`. Verificar de verdad los flujos 7 (enviar Lista Médica por WhatsApp), 8 (lead correcto), 9 (panel de farmacia) y 10 (panel súper-admin) requiere: crear un lead facturable real contra una farmacia real, o iniciar sesión en el panel de una farmacia/súper-admin real. No hay credenciales de una cuenta de prueba/demo documentadas en el repo (aunque sí existen farmacias `DEMO` sembradas en la BD — "Farmacia DEMO Acarigua Llano Mall", "Farmacia DEMO Acarigua Centro", "Farmacia DEMO Araure Centro" — no se encontraron sus credenciales de login).
- **Opciones:** (a) José comparte credenciales de una de las farmacias DEMO (o crea una nueva farmacia de prueba) para que estos flujos se puedan probar sin afectar farmacias reales; (b) José define una ventana de mantenimiento y autoriza explícitamente una prueba puntual contra producción, asumiendo que generará un lead/registro real de prueba; (c) se deja este alcance de B-002 sin cerrar hasta que exista un entorno de staging real.
- **Impacto de no decidir:** B-002 queda parcialmente verificado (flujos 1-6 confirmados contra producción real; 7-10 sin verificar). No bloquea el MVP por sí solo, pero significa que "los 10 flujos verificados juntos" de la Definition of Done en `VISION-MVP.md` sigue sin cumplirse del todo.
- **Estado:** abierta.
