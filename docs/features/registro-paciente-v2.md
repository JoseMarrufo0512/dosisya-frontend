# Registro de paciente v2 — formulario completo + Google, retirar OTP WhatsApp

**Estado:** Pendiente (no implementar aún). Capturado el 2026-10-26 a pedido de José.
**Prioridad relativa:** después de dejar listos los textos legales (T&C + Privacidad), de los que esta feature depende (la casilla de aceptación los enlaza).

## Qué se quiere

Reemplazar el login/registro actual del paciente (teléfono → código OTP por WhatsApp)
por un **registro con formulario completo** y **registro/inicio de sesión con Google**.
El registro sigue siendo **opcional** — "Seguir sin cuenta" se conserva (filosofía Cero Fricción).

### Campos del formulario (según referencia de Farmatodo que trajo José)

- Nombre
- Apellido
- Correo electrónico
- Tipo de persona (la referencia muestra "NATURAL" → natural / jurídica, confirmar si aplica a DosisYa)
- Número de documento (cédula / RIF)
- Número de teléfono (indicativo VEN +58)
- Género (Femenino / Masculino / No binario / No especifica) — tratar como **opcional**
- Casilla: "Acepto y autorizo los Términos y Condiciones, la Política de Privacidad
  y la Política de Tratamiento de Datos Personales de DosisYa." → enlaza a `/terminos` y `/privacidad`.

### Registro / inicio de sesión con Google (OAuth)

- Botón "Continuar con Google" como alternativa al formulario.
- Decidir qué datos de Google se piden (nombre, correo, foto) y qué se persiste.

## Qué se retira

- **Login por WhatsApp (OTP):** flujo teléfono → código de 6 dígitos de
  `src/components/paciente/HojaLoginPaciente.tsx`.
- Cliente: `src/lib/pacienteApi.ts` (`solicitarCodigo`, `verificarCodigo`) y la parte OTP de
  `src/lib/pacienteAuth.ts`.
- Backend (repo separado, requiere autorización): endpoints
  `POST /api/v1/paciente/auth/solicitar-codigo` y `/verificar-codigo`, y el webhook n8n de OTP
  (`N8N_OTP_WEBHOOK_URL`). Evaluar si se eliminan o se conservan para otro uso.

## Dependencias y riesgos

- **Backend primero:** nuevos endpoints de registro/login (formulario + Google OAuth), cliente
  OAuth de Google, y migración de la tabla de pacientes (nuevas columnas: apellido, correo,
  documento, género; el teléfono deja de ser el identificador único de login).
- **Datos más sensibles:** el documento de identidad y el género son datos personales más
  sensibles que el solo teléfono. La **Política de Privacidad debe cubrirlos** (qué se capta,
  para qué, conservación, derechos) antes de activar este registro, y la sección "Si creas una
  cuenta de paciente" debe describir también los datos recibidos de Google.
- **Mayoría de edad:** el registro debe reforzar el requisito de ser mayor de edad (ver T&C).
- **Secuenciación con los legales:** no publicar una Política de Privacidad que describa estos
  campos antes de que el registro v2 realmente los capte (o mantener los legales en borrador
  hasta que v2 salga a producción).

## Pendiente de decidir con José

- ¿"Tipo de persona" (natural/jurídica) aplica a un paciente, o es residuo del modelo Farmatodo?
- ¿El correo se verifica (link/código) o se confía en Google?
- ¿Qué proveedor de envío de correo (si hay verificación por correo)?
