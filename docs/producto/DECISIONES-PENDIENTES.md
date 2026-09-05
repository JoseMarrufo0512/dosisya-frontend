# Decisiones pendientes (requieren a José)

> Cada entrada bloquea una tarea de `BACKLOG.md`. No se implementan por iniciativa propia — se documentan aquí y se continúa con la siguiente tarea P0 no bloqueada.

## D-001: Endpoint `GET /api/v1/tasa-actual` no existe en el backend
- **Contexto:** `src/hooks/useTasa.ts` (spec `docs/superpowers/specs/2026-07-26-asistente-ia-flotante-y-paridad-mockup-design.md`) espera este endpoint para mostrar la tasa USD→VES. Hoy no existe en `DosisYa-Backend`; el hook ya degrada bien (`retry:false`, catch silencioso, oculta el chip si falla).
- **Opciones:** (a) implementar el endpoint en el backend (requiere autorización expresa para tocar `DosisYa-Backend`, per `CLAUDE.md` §2); (b) dejarlo bloqueado indefinidamente y ocultar el chip permanentemente; (c) quitar la UI que depende de él.
- **Impacto de no decidir:** ninguno crítico — el frontend no falla, solo no muestra la tasa. No bloquea el MVP.
- **Estado:** abierta.

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
