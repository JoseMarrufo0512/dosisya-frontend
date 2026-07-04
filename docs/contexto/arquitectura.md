# Arquitectura

## En una frase
DosisYa es un marketplace farmacéutico hiperlocal B2B/B2C para Acarigua/Araure que conecta pacientes con farmacias mediante búsqueda geoespacial, carrito multi-producto y escáner de recetas con IA, monetizando la intención de compra (leads) hacia WhatsApp.

## Stack
- **Lenguaje / runtime:** Python (Backend) / TypeScript & Node.js (Frontend)
- **Framework principal:** FastAPI (Backend) / React + Tailwind CSS (Frontend)
- **Base de datos:** Supabase (PostgreSQL + PostGIS para distancias + pg_trgm para fuzzy search)
- **Servicios externos:** n8n + OpenWA (Automatización de WhatsApp), Google AI Studio / Gemini (Normalizador de catálogos y Escáner de Recetas Vision)
- **Hosting:** Vercel (Serverless para Backend y Frontend)

## Mapa de carpetas
- `DosisYa-Backend/src/dosisya/` → Lógica core del backend (FastAPI, rutas, modelos Pydantic, integración con Gemini Vision).
- `DosisYa-Backend/db/` → Esquemas DDL (`schema.sql`) y scripts de población.
- `DosisYa-Frontend/` → Código de la UI en React. Separado en su propio repo.
- `DosisYa-Frontend/docs/contexto/` → Reglas globales y memoria del proyecto.
- `DosisYa-Frontend/docs/features/` → Tickets y especificaciones de funcionalidades individuales.

## Flujo de datos
1. El paciente busca un medicamento (o sube foto de receta) sin login en el Frontend.
2. El Frontend llama a los endpoints de FastAPI (`/api/v1/medicamentos/buscar` o `/api/v1/ia/analizar-recipe`).
3. El usuario añade resultados a su carrito temporal (`localStorage`).
4. El usuario hace clic en "Contactar Farmacia" desde el carrito.
5. El Frontend dispara un POST a `/api/v1/leads` (FastAPI) enviando el array de productos, que guarda la métrica y lanza una `BackgroundTask` hacia n8n.
6. El usuario es redirigido a WhatsApp con un mensaje pre-llenado con su lista completa.

## Lo que NO existe (y no hay que crear)
- No hay pasarela de pagos B2C en la app.
- No hay sistema de registro ni login para pacientes (Cero Fricción).
- No hay módulo interno de gestión de delivery (se delega a la farmacia o Yummy).
- No hay ORM pesado en el backend.
- La IA (Gemini) no se ejecuta en el Frontend, el Frontend solo envía la imagen al Backend.
