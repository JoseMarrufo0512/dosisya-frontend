# Flujo de Trabajo (DosisYa)

Este documento centraliza el estándar de desarrollo para evitar el caos entre repositorios, asegurar la calidad de la experiencia del paciente y mantener ambientes aislados.

## 1. Reglas de Control de Versiones (Git)

- **Nunca** dejes cambios "sueltos" sin registrar.
- Usa **Conventional Commits**:
  - `feat: [módulo] descripción` para nuevas características.
  - `fix: [módulo] descripción` para correcciones de bugs.
  - `refactor: [módulo] descripción` para mejoras de código sin cambio funcional.
  - `chore: descripción` para tareas de mantenimiento (ej. actualizar dependencias).
- **Ramas:** Todo desarrollo debe ocurrir en una rama separada (`feat/...`, `fix/...`) y nunca directamente en `main`.

## 2. Coordinación de Entornos (Local vs Producción)

Trabajamos con dos repositorios (`DosisYa-Frontend` y `DosisYa-Backend`).

- **Base de Datos (Supabase):**
  - Usa el proyecto local o la rama de Staging para desarrollar. 
  - Jamás apuntes tu frontend local a la base de datos de Producción.
- **Claves de IA (Gemini):**
  - **Desarrollo:** Genera una clave gratuita en *Google AI Studio* exclusiva para tu entorno local. Inyéctala en el `.env.local` del backend.
  - **Producción:** Las variables de Vercel usan la clave de producción (facturada). **NUNCA** coloques la clave de producción en tu entorno local.

## 3. Pruebas de Humo (Checklist Flujo del Paciente)

Antes de hacer un merge a `main`, se DEBE probar el siguiente **Happy Path** (flujo de cero fricción) en el *Preview Deployment* de Vercel:

- [ ] Cargar la app en un navegador móvil (o simulación).
- [ ] Búsqueda difusa (ej. "paracetamol") → Resultados visibles sin errores.
- [ ] Cambio de vista (Lista / Mapa) → Renderizado correcto sin *hydration errors*.
- [ ] Botón "Favorito" (Corazón) → Funciona y persiste al recargar la página.
- [ ] Botón "Escanear Récipe" → Responde la IA de Gemini (verificar que no haya 503).
- [ ] Clic en botón "WhatsApp" (o "Añadir a lista" + "Pedir WhatsApp") → Genera un *Lead* exitoso (201 Created) y abre la URL `wa.me`.
- [ ] **B2B (Farmacia):** Subida de inventario JSON → Barra de progreso avanza → Mensaje de éxito al completar.

## 4. Observabilidad (PostHog y Sentry)

- **Sentry:** Monitorea picos de errores (500s). Las rutas críticas son `/api/v1/busqueda` y `/api/v1/ia/chat`.
- **PostHog:** Disponemos de eventos clave. Usa los Dashboards de PostHog para analizar:
  - Tasa de conversión de `busqueda_realizada` -> `whatsapp_click`.
  - Abandono del flujo de IA (escaneos fallidos).
