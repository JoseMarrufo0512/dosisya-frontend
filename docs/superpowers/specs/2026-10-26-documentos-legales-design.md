# Diseño — Términos de uso y Política de privacidad de DosisYa

**Fecha:** 2026-10-26
**Alcance:** completar y dejar listos (en borrador gated) los dos documentos legales de DosisYa
reescribiendo `src/routes/terminos.tsx` y `src/routes/privacidad.tsx`. El "tratamiento de datos"
vive como secciones **dentro** de Privacidad (no es un documento aparte).

## Objetivo

Partir de los borradores actuales (que ya son fieles al modelo real de DosisYa) e inyectarles el
andamiaje legal estándar que les falta, tomándolo de los ejemplos de **plataforma/sitio web**
(Terminos y Condiciones 1 = Farmatodo/Locatel, 4 = Farmacia SaaS). Se descarta todo el material de
**e-commerce** de los ejemplos (compra, pago, envío, devoluciones, reembolsos), porque DosisYa no
vende, no cobra al paciente y no entrega.

## Insumos acordados con José

| Tema | Decisión |
|---|---|
| Estructura | 2 documentos (tratamiento de datos dentro de Privacidad) |
| Identidad legal | `[COMPLETAR]` — no definida aún; jurisdicción se redacta genérica |
| Contacto oficial | WhatsApp **+58 424-592-8624** + correo **soporte@dosisya.com** |
| Conservación | Leads/interacciones **12 meses**; datos de farmacia **mientras la cuenta esté activa + 6 meses** |
| Alcance geográfico | **Venezuela** (sin nombrar Acarigua/Araure ni "hiperlocal" — eso queda solo para publicidad) |
| Registro de paciente | Describir el **registro v2** (formulario completo + Google), no el OTP-WhatsApp actual (ver `docs/features/registro-paciente-v2.md`) |
| Terceros | No nombrar a Yummy; usar "servicios de delivery de terceros" genérico |
| Ley aplicable | Redacción calcada de los modelos: "leyes de la República Bolivariana de Venezuela" + sumisión a tribunales competentes; domicilio legal `[COMPLETAR: ciudad]` |
| Estado | Ambos quedan como **"Borrador — pendiente de revisión por abogado / no publicar"**; se publican junto con el registro v2 |

## Estructura final — Términos de uso

1. **Qué es DosisYa** *(conservar, ajustar)* — directorio/buscador en Venezuela; no es farmacia,
   no vende, no cobra al paciente, no procesa pagos. (Quitar "Acarigua y Araure".)
2. **Aceptación y quién puede usar DosisYa** *(nueva)* — al usar DosisYa aceptas estos términos;
   debes ser mayor de edad; puedes usarlo **sin cuenta** o **registrarte opcionalmente**.
3. **Enfoque geográfico** *(nueva, de T1/T4)* — servicio diseñado para Venezuela; el acceso desde
   el exterior es bajo responsabilidad del usuario y ciertas funciones pueden no estar disponibles.
4. **Uso por parte del paciente** *(conservar)* — gratis, sin registro obligatorio; disponibilidad
   y precio son referenciales y los reporta cada farmacia; la compra/pago/entrega ocurren fuera de
   DosisYa, directamente con la farmacia (motorizado propio o delivery de terceros, sin nombrar Yummy).
5. **Escáner de récipe y Asistente IA** *(conservar + fusionar "advertencia de salud" de T1/T4)* —
   apoyo informativo con IA (Google Gemini); no diagnostica ni prescribe; consultar a un profesional.
6. **Uso aceptable / conducta prohibida** *(nueva, de T1/T4)* — prohibido: scraping/extracción masiva,
   fraude de clics o interacciones artificiales, spam, vulnerar la seguridad, uso ilícito o que dañe
   a terceros o a la plataforma.
7. **Uso por parte de la farmacia** *(conservar)* — afiliación con aprobación previa; modelo
   costo-por-lead (no comisión por venta); la farmacia responde por su inventario, precios y atención.
8. **Propiedad intelectual y marcas** *(nueva, de T1/T4)* — la marca "DosisYa", el software y los
   contenidos del sitio son de DosisYa / sus titulares; no se otorga licencia para reutilizarlos.
9. **Enlaces y servicios de terceros** *(nueva)* — DosisYa enlaza a WhatsApp, mapas y servicios de
   delivery de terceros; no controla ni responde por esos servicios ni por su contenido.
10. **Límite de responsabilidad** *(conservar + reforzar con exoneración de T1/T4)* — DosisYa es un
    intermediario tecnológico; el servicio se ofrece "tal cual"; no responde por errores de inventario,
    precios, demoras de entrega ni el estado de los productos entregados por la farmacia.
11. **Privacidad** *(nueva, breve)* — el tratamiento de datos se rige por la Política de Privacidad
    (enlace a `/privacidad`).
12. **Ley aplicable y jurisdicción** *(nueva, calcada de modelos)* — leyes de la República
    Bolivariana de Venezuela; sumisión a los tribunales competentes; domicilio legal `[COMPLETAR: ciudad]`.
13. **Disposiciones finales** *(nueva, boilerplate de T1/T4)* — nulidad parcial (si una cláusula es
    inválida, el resto sigue vigente) y no renuncia de derechos.
14. **Cambios a estos términos** *(conservar)*.
15. **Contacto** *(llenar)* — WhatsApp +58 424-592-8624 y soporte@dosisya.com.

## Estructura final — Política de privacidad

1. **Cómo usas DosisYa: con o sin cuenta** *(reescribir §1 actual)* — buscar, armar la Lista Médica
   y contactar farmacias no requiere cuenta (Cero Fricción); el registro es **opcional**.
2. **Qué guarda tu propio dispositivo** *(conservar)* — Lista Médica, favoritos y recordatorios viven
   en localStorage del navegador; DosisYa no los recibe en sus servidores.
3. **Qué recibimos cuando contactas a una farmacia** *(conservar)* — interacción (farmacia,
   medicamento si aplica, tipo, fecha/hora), IP y user-agent; para facturar el lead y detectar fraude.
   La conversación de WhatsApp es directa entre paciente y farmacia. La ubicación se usa solo para
   calcular cercanía en el momento, no se guarda asociada a identidad. Analítica de uso anónima.
4. **Si creas una cuenta de paciente** *(nueva — describe el registro v2)* — si te registras
   guardamos los datos que nos proporcionas: nombre, apellido, correo electrónico, número de documento,
   teléfono y, opcionalmente, género; o los datos básicos de tu cuenta de **Google** si te registras con
   Google (nombre, correo). Los usamos para crear y autenticar tu cuenta, recordarte entre dispositivos
   y guardar tu Lista Médica. Puedes cerrar sesión o pedir la eliminación por soporte@dosisya.com.
   *(Nota de implementación: esta sección describe el registro v2 aún no desplegado; no publicar hasta
   que v2 esté en producción.)*
5. **Escáner de récipe y Asistente IA** *(conservar)* — la foto se procesa en memoria y se envía a
   Google Gemini; no se almacena. Los mensajes al Asistente van a Gemini; no se guarda el historial.
6. **Si eres farmacia (panel B2B)** *(conservar)* — datos de registro (correo, nombre, RIF, WhatsApp,
   sector/punto de referencia, contraseña cifrada); para autenticar, mostrar leads y facturar.
7. **Con quién compartimos datos** *(conservar + ajustar)* — subencargados: Google Gemini (récipe/IA),
   Google (registro/login con Google), Supabase (BD), Vercel (hosting), Sentry (errores, puede incluir
   IP), PostHog (analítica anónima), n8n (notificación del lead a la farmacia por WhatsApp).
   No vendemos datos con fines publicitarios. (Sin nombrar Yummy. El registro v2 no usa código
   por WhatsApp: autentica por correo/Google.)
8. **Cuánto tiempo conservamos los datos** *(llenar)* — interacciones/leads: 12 meses; datos de la
   cuenta de farmacia: mientras la cuenta esté activa y hasta 6 meses después de darse de baja; datos
   de cuenta de paciente: hasta que pidas su eliminación.
9. **Seguridad de la información** *(nueva, de los ejemplos)* — medidas razonables; contraseñas
   cifradas; ninguna transmisión por Internet es 100% segura, no se garantiza seguridad absoluta.
10. **Cookies y tecnologías similares** *(nueva, honesta)* — DosisYa no usa cookies de rastreo
    publicitario para el paciente; usa almacenamiento local (localStorage) y analítica de uso anónima.
11. **Menores de edad** *(nueva, de los ejemplos)* — servicio dirigido a mayores de edad; no se
    recopila intencionalmente información de menores.
12. **Tus derechos** *(reescribir — ahora el paciente registrado sí tiene perfil)* — si tienes cuenta
    (paciente o farmacia) puedes pedir acceder, corregir o eliminar tus datos por soporte@dosisya.com;
    sin cuenta, las interacciones quedan asociadas a la farmacia, no a una identidad tuya.
13. **Cambios a esta política** *(conservar)*.
14. **Contacto** *(llenar)* — WhatsApp +58 424-592-8624 y soporte@dosisya.com.

## Qué se descarta de los ejemplos (y por qué)

- Compra, métodos de pago, cupones, impuestos, envío/entrega, devoluciones, reembolsos, garantía,
  derecho de retracto (Terminos 2/3, Privacidad 1/2): DosisYa no vende ni cobra al paciente ni entrega.
- Cuenta tipo e-commerce con historial de compras y tarjetas (Privacidad 1/2): no aplica.
- Inicio de sesión con Facebook (Privacidad 2): DosisYa usará Google, no Facebook.
- Domicilio legal fijo en una ciudad concreta (Caracas/Maracaibo de los ejemplos): queda `[COMPLETAR]`.

## Placeholders que quedan explícitos (`[COMPLETAR]`)

- Identidad legal del operador (nombre, RIF) en ambos documentos.
- Ciudad del domicilio legal en Términos §12.

## Dependencias y secuenciación

- La sección de cuenta de paciente describe el **registro v2** (`docs/features/registro-paciente-v2.md`),
  aún no implementado. Ambos documentos **se mantienen en borrador** y **no se publican** hasta que v2
  esté en producción y un abogado los revise.
- La casilla de aceptación del registro v2 enlazará a `/terminos` y `/privacidad`.

## Verificación

- `npx tsc --noEmit && npm run build` (obligatorio antes de commit, por CLAUDE.md §6).
- Confirmar que ambas rutas renderizan sin romper el `LegalLayout`/`Seccion` existentes.

## Fuera de alcance

- Implementar el registro v2 (ticket aparte).
- Crear una ruta `/tratamiento-datos` (el tratamiento va dentro de Privacidad).
- Tocar el backend.
