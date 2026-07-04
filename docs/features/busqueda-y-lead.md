# Feature: Búsqueda Cero Fricción y Captura de Lead

## Objetivo
El usuario entra a la app, busca un medicamento, y al presionar "Contactar por WhatsApp", el sistema registra el Lead en el backend y lo redirige.

## Flujo (Happy Path)
1. Renderizar `HomeSearchBar` centrado.
2. Al tipear y presionar enter, mostrar `SkeletonLoader` (min. 500ms o hasta recibir data).
3. Petición GET a `VITE_API_URL/api/v1/medicamentos/buscar?q=termino`
4. Renderizar lista de `FarmaciaCard`.
5. Al hacer clic en el botón de WhatsApp de una tarjeta:
   - Disparar POST a `VITE_API_URL/api/v1/leads` (asíncrono, sin esperar respuesta para navegar).
   - Abrir enlace `wa.me/numero?text=mensaje` prellenado.

## Edge Cases y Manejo de Errores (Crítico)
- **Estado de Vacío:** Si la API devuelve un array vacío, mostrar mensaje amigable: "No encontramos '[término]' cerca. Intenta usar el principio activo."
- **Fallo de Red:** Si la API da error 500 o falla el fetch, mostrar un diseño de "conexión inestable" con botón de reintentar.
- **Prevención de Spam:** Deshabilitar el botón de WhatsApp por 2 segundos después del primer clic para evitar disparar múltiples `leads` accidentales en el backend.
