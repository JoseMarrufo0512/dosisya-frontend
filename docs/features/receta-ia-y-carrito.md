# Feature: Escáner de Recetas con IA y Carrito Multi-Producto

## Objetivo
El usuario debe poder buscar múltiples medicamentos a la vez (agregándolos a una lista temporal) o subir una foto de su récipe médico para que la IA extraiga los medicamentos, cantidades y sugiera alternativas por principio activo.

## Flujo 1: El Carrito Multi-Producto (Cero Fricción)
1. En la tarjeta de resultados (`FarmaciaCard`), en lugar de un único botón de WhatsApp, debe haber un botón "Añadir a mi lista" (ícono de pastillero/carrito).
2. El estado del carrito debe guardarse en `localStorage` (sin requerir login del usuario).
3. Debe haber un componente flotante o barra inferior (`CartSummary`) que indique "X medicamentos en tu lista".
4. Al abrir el carrito y hacer clic en "Contactar Farmacia", se disparará el POST a `/api/v1/leads` (enviando el array de IDs de medicamentos) y se abrirá WhatsApp con el mensaje pre-llenado listando todos los productos.

## Flujo 2: Escáner de Récipe (Gemini Vision UI)
1. En la barra de búsqueda principal (`HomeSearchBar`), debe haber un ícono prominente de Cámara / "Escanear Récipe".
2. Al hacer clic, abre la cámara del dispositivo o selector de archivos.
3. **Estado de Carga Crítico:** Al subir la foto, mostrar un overlay interactivo (ej. animación de escaneo láser) con el texto: "La IA está descifrando la letra del médico...".
4. El frontend enviará la imagen en Base64 o FormData a nuestro endpoint de FastAPI (ej. `POST /api/v1/ia/analizar-recipe`).
5. El backend responderá con un JSON de este estilo:
   `[{ "medicamento": "Losartan", "cantidad": "2 cajas", "alternativas": ["Valsartan", "Candesartan"] }]`
6. El frontend tomará este JSON y renderizará la lista de resultados, mostrando insignias visuales claras si un producto es la receta original o una "Alternativa sugerida por IA".

## Reglas y Edge Cases
- **Fallo de la IA:** Si el backend responde que la letra es 100% ilegible, mostrar un estado de error amigable con el botón: "No pudimos leerlo, pero puedes enviar la foto directo a la farmacia por WhatsApp".
- **Lógica de Frontend vs Backend:** Claude Code NO debe implementar la lógica de Gemini (IA) ni el cálculo de alternativas en React. Todo eso lo hace el backend en Python. Claude solo debe maquetar la cámara, el estado de "escaneando", recibir el JSON y pintar los resultados con opción de añadirlos al carrito.
