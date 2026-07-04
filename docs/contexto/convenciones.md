# Convenciones de código

## Estilo
- **Formato:** Prettier (Frontend) / Black o PEP8 (Backend).
- **Naming:** `camelCase` para variables/funciones TS, `PascalCase` para Componentes React, `snake_case` para Python (FastAPI).
- **Diseño UI:** Estética "Glassmorphism" sutil. Colores de confianza: Blanco, Verde Menta oscuro y Azul Médico.

## Patrones que SÍ usamos
- **Tareas en Segundo Plano (BackgroundTasks):** Llamadas a servicios externos (n8n, Gemini) DEBEN hacerse asíncronamente para no bloquear.
- **Manejo de Errores Silencioso B2B:** Uso de tablas de contingencia (`webhook_errors`) y `ON CONFLICT (UPSERT)`.
- **Mobile-first UI:** Interfaz diseñada para pulgares.
- **Manejo de Estado Global Cero Fricción:** Uso intensivo de `localStorage` en React (vía hooks personalizados) para mantener el carrito de compras (Lista Médica) activo sin necesidad de cuentas de usuario.

## Patrones PROHIBIDOS
- No usar dependencias de Lovable (RudderStack, TanStack config de Lovable, etc.).
- No meter lógica de base de datos o cálculos de distancias (Haversine) en el Frontend.
- No pedir datos excesivos en formularios.
- No implementar el SDK de Google Gemini AI directamente en el Frontend de React (eso expondría la API Key y sobrecargaría el cliente).

## Tests
- Dónde van: Backend (`tests/` o pruebas directas). Frontend: Pruebas de renderizado locales.
- Qué se testea sí o sí: La correcta inserción del "Lead" en la base de datos al enviar el carrito.
