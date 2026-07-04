# Glosario y entidades

## Términos del dominio
- **Lead (Interacción):** Métrica de monetización. Ocurre al hacer clic en "Contactar Farmacia" enviando la lista.
- **Cero Fricción:** El paciente no debe encontrar obstáculos (ej. sin login).
- **Normalizador / Escáner IA:** Scripts en el backend usando Google AI Studio (Gemini). El Normalizador limpia catálogos B2B. El Escáner IA descifra recetas subidas por pacientes en el B2C.
- **Lista Médica (Carrito):** Array de medicamentos guardado temporalmente en el navegador del paciente usando `localStorage`.

## Entidades principales
- **Farmacia (`farmacias`):** Cliente B2B.
- **Medicamento (`catalogo_maestro` / `inventario`):** Producto.
- **Lead (`leads`):** Registro de facturación. Ahora puede estar asociado a múltiples medicamentos en una sola interacción.
