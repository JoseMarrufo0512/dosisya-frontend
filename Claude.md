# CLAUDE.md - Proyecto DosisYa

Este archivo es la fuente de verdad para el contexto persistente de Claude Code. Léelo siempre antes de iniciar o planificar cualquier tarea.

## 1. Visión y Negocio
- **Proyecto:** DosisYa, un marketplace farmacéutico hiperlocal (Acarigua/Araure).
- **Modelo B2B:** Cobro por "Leads" (clics hacia WhatsApp de la farmacia). NO cobramos comisiones por venta.
- **Filosofía B2C:** "Cero Fricción". El paciente NO se registra (sin login) para buscar o contactar.
- **Logística:** Descentralizada. La "última milla" la asume la farmacia (motorizados propios o Yummy).
- **IA para Farmacia:** para lectura de recipe y para.

## 2. Arquitectura (Stack Técnico Actual)
- **Frontend (UI):** React + Tailwind CSS. Diseño: "Glassmorphism" sutil.
- **Backend (API):** Python + FastAPI. Desplegado en Vercel. NO TOCAR SIN AUTORIZACIÓN EXPRESA.
- **Base de Datos:** PostgreSQL en Supabase (PostGIS para geolocalización, pg_trgm para búsqueda difusa).
- **Notificaciones B2B:** n8n + OpenWA.

## 3. Reglas Estrictas (Lo que NO debes hacer)
1. **Cero Lovable:** Prohibido usar dependencias o patrones generados por Lovable (ej. RudderStack). Fue descartado.
2. **No bloquees la UI:** Las llamadas que reportan facturación (ej. POST `/api/v1/leads`) deben ser asíncronas y "disparar y olvidar" desde la perspectiva del frontend. Usa Skeleton Loaders.
3. **No inventes rutas de API:** El backend ya existe. Usa la variable `VITE_API_URL` para conectarte a Vercel.

## 4. Estructura de Directorios (Frontend)
- `src/components/`: UI reutilizable (Tarjetas, Botones de WhatsApp).
- `src/pages/`: Pantallas principales (Home, Búsqueda, Portal Farmacias).
- `src/services/`: Clientes de API (`fetch`/`axios`) para comunicarse con FastAPI.
- `docs/contexto/`: Documentos Markdown con la historia y decisiones del proyecto (Leer antes de proponer cambios grandes).
