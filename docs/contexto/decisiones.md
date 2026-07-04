# Decisiones tomadas
> Historial de pivotes y arquitectura cerrada. No reabrir estos debates.

## [Julio 2026] · Transición a Carrito y Escáner IA
- **Decisión:** Reemplazar el contacto directo 1-a-1 por un "Carrito de compras" local y añadir un botón para escanear recetas médicas.
- **Por qué:** Los pacientes suelen buscar múltiples medicamentos. Forzarlos a abrir WhatsApp por cada uno generaba fricción. El escáner con Gemini Vision aporta un "Efecto Wow" y resuelve el dolor de no entender la letra del médico.
- **Descartado:** La "Trampa Growth Hacker" de enviar la foto cruda al WhatsApp de la farmacia (dejaba el trabajo manual al farmacéutico).
- **Estado:** Vigente. El Frontend usará `localStorage` para la lista y el Backend procesará la IA.

## [Junio 2026] · Lovable Descartado
- **Decisión:** Abandonar Lovable como plataforma No-Code y generar código con Claude Fable 5.
- **Por qué:** Dependencias basura, problemas de CORS y bloqueos.
- **Estado:** Vigente.

## [Mayo 2026] · Monetización B2B vía Leads
- **Decisión:** Cobrar a farmacias por clic/intención de compra, no porcentaje de venta.
- **Estado:** Vigente.

## [Mayo 2026] · Cero Fricción B2C (No Login)
- **Decisión:** El paciente no crea cuenta.
- **Estado:** Vigente.
