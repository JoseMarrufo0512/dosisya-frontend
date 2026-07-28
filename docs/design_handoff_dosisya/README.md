# Handoff: DosisYa — App del paciente + Panel B2B

## Overview
DosisYa es un marketplace farmacéutico hiperlocal para Acarigua/Araure (Venezuela). Filosofía "Cero Fricción". Dos superficies:
1. **App del paciente** (móvil, PWA) — buscar medicamento, comparar precios/stock entre farmacias, armar "Lista Médica", contactar por WhatsApp. Sin login obligatorio.
2. **Panel B2B** (desktop + móvil) — panel de farmacia y superadmin. Cobro por lead (clic a WhatsApp).

Economía bi-moneda: todo precio se muestra en **USD** (referencia) y **Bs** (según tasa del día). Tasa de ejemplo: Bs 145,20 / USD.

## About the Design Files
Los archivos de este bundle son **referencias de diseño hechas en HTML** (prototipos que muestran el aspecto y comportamiento esperado), **no** código de producción para copiar tal cual. La tarea es **recrear estos diseños en el entorno del codebase real** usando sus patrones y librerías. El stack objetivo indicado por el equipo: **React 19, TanStack Start/Router (SSR), TailwindCSS 4 (CSS-first, sin config), shadcn/ui + Radix, framer-motion, lucide-react, sonner (toasts), vaul (drawers)**. Los íconos deben ser **lucide-react** (línea). No introducir otra librería de íconos.

Nota técnica: los .dc.html usan un runtime propio (`support.js`) solo para previsualizar; ignóralo al implementar. Toda la lógica está en la clase `Component` (estado + handlers) y el markup en la plantilla.

## Fidelity
**Alta fidelidad (hifi).** Colores, tipografía, espaciado e interacciones son finales. Recrear pixel-perfect con las librerías del codebase. Los datos son de muestra (mock); reemplazar por API real (precios, tasa, stock, distancia, leads).

## Design Tokens
Colores (paleta cerrada):
- `--verde-cruz` #0F4C3A — marca, cabeceras, sidebar B2B, precio USD, botón primario
- `--verde-vivo` #1D9E75 — stock/disponible, acentos positivos, "Ya" del logo
- `--verde-claro` #5FD6A4 — acento sobre verde-cruz (badges, avatar B2B)
- `--whatsapp` #25D366 — EXCLUSIVO del botón/acción WhatsApp
- `--ambar-receta` #B45309 sobre fondo #FFF7ED — avisos "requiere récipe", estados "pendiente/pausada"
- `--rojo` #C1372F sobre #FBE9E7 — destructivo, "crítico", "rechazar"
- Tinta #16181A · suave #6B6F6B · tenue #8A8E8A
- Superficies: papel #FAFAF7 · blanco #FFFFFF · borde #E8E9E5 · fondo suave #F2F3EF
- Estado disponible: texto #157A5B sobre #EAF7F1
Tipografía: **Inter** (respaldo Outfit), pesos 400–800. Cifras siempre `font-variant-numeric: tabular-nums`.
Radios: pills 999px; chips 8–12px; tarjetas 14–20px. Sombras suaves y bajas (ej. `0 1px 2px rgba(22,24,26,.04)`, elevada `0 10px 26px -14px rgba(22,24,26,.28)`).
Espaciado en múltiplos de 4. Targets táctiles ≥44px. Respetar `prefers-reduced-motion`.

---

## Archivo 1 — NavegacionInferior.dc.html (App del paciente, móvil 370×806)

### Screen: Inicio (tab Buscar)
- Header mínimo: botón de cuenta (persona) arriba-izquierda que abre hoja de Login; pill de "Tasa" arriba-derecha.
- Hero centrado: logo **DosisYa** (41px, weight 800; "Dosis" tinta, "Ya" verde-vivo), subtítulo "Encuentra tu medicamento en Acarigua/Araure".
- Buscador (pill blanco, 56px, sombra): lupa + placeholder "¿Qué medicamento necesitas?" (una línea, ellipsis) + botón cámara verde (abre Escáner) + pin rojo de ubicación.
- Búsquedas recientes: fila única con scroll horizontal, chips con ícono reloj (acetaminofen, loratadina, amoxicilina).
- Categorías: chips con emoji, wrap centrado (🤒 Dolor y fiebre, 🤧 Gripe y alergia, ❤️ Tensión, 💊 Antibióticos, 🤢 Estómago, 🩸 Diabetes).
- "📍 Usando tu ubicación actual"; fila de confianza (✅ Farmacias verificadas · 🛵 Delivery local); toggle "Solo con delivery 🛵" (funcional).
- Barra inferior flotante (si hay items): círculo verde-cruz con ícono píldora + badge contador, "N medicamento(s) en tu lista" / "Toca para elegir farmacia", chevron → va a Lista.

### Barra de navegación inferior (el foco del diseño)
- 5 slots: Buscar · Farmacias · **FAB central Escanear récipe** (elevado, verde-cruz, siempre centrado) · Lista Médica (con badge) · Más.
- Micro-interacciones: la píldora del tab activo revela su etiqueta animando `max-width` 0→96px (transición .4s cubic-bezier(.4,0,.2,1)); íconos rebotan al presionar (scale .84, spring cubic-bezier(.34,1.56,.64,1)); hojas suben con `sheetUp`. FAB abre el Escáner.
- "Más" abre hoja con: Recordatorios de resurtido, Comparar precios, Ayuda, y **Asistente IA** (chat). Cada uno abre su propia hoja.

### Pantallas/hoja: Farmacias (mapa + lista), Lista Médica (items con eliminar, total dual USD/Bs, enviar por WhatsApp, estado vacío), Escáner de récipe, Login, Chat IA, Recordatorios, Comparar, Ayuda.

### Animación "empaquetar y volar al carrito"
Al tocar **+** en una tarjeta de resultado: un paquete verde sale de la tarjeta, hace un arco (keyframe `packFly`, 700ms, con punto de control) hasta el ícono de Lista; al llegar, el contador incrementa y el ícono de Lista rebota (scale 1→1.3, spring). Coordenadas calculadas con getBoundingClientRect relativo al stage (compensa escala). Respeta reduced-motion (sin vuelo, solo incrementa + rebota).

### Estado (patient app)
active tab, listaItems[] (id, nombre, farmacia, usd), flyers[] (animación), favoritos, soloDelivery, y flags de apertura de cada hoja. Total: suma usd; Bs = usd × tasa. Formato es-VE (coma decimal, punto de miles).

---

## Archivo 2 — PanelFarmacia.dc.html (Panel B2B, desktop 1240 + móvil 390)

Shell: sidebar verde-cruz (desktop) o barra superior con nav horizontal (móvil), topbar con título, pill de tasa, **switch de rol** (Farmacia/Superadmin) y **switch de dispositivo** (Desktop/Móvil). Estos dos switches son controles de demo — en producción el rol viene de la sesión y el responsive es automático (no botón).

### Rol Farmacia (con login real)
- **Login**: correo + contraseña → "Entrar" pasa a Dashboard. Link "Regístrala" → Registro.
- **Registro/onboarding**: stepper (1 Datos · 2 Ubicación · 3 Verificación), campos nombre comercial, RIF, WhatsApp, dirección, ciudad (Acarigua/Araure), delivery toggle. "Continuar" → Dashboard.
- **Dashboard**: 4 KPIs (Leads mes 128 +12%, Costo por lead $0,35, Inversión $44,80, Conversión 6,4%); tabla "Leads recientes" (hora, medicamento, distancia, estado [Contactado/Pendiente/Perdido], costo); tarjeta Saldo (verde-cruz, "Recargar saldo"); mini-gráfica "Leads por día".
- **Inventario**: tabla (medicamento, precio USD, precio Bs auto, stock [badge verde/ámbar "bajo"/rojo "Agotado"], toggle Disponible por fila, acciones editar/eliminar); buscador + "Agregar medicamento".
- **Configuración**: datos de farmacia, horario, delivery (toggle + radio de cobertura), tasa (segmented Automática BCV / Manual), guardar.
- **Cerrar sesión** (footer sidebar / móvil) → Login.

### Rol Superadmin
- **Aprobaciones**: tarjetas de farmacias pendientes con Aprobar/Rechazar (remueve de la lista; badge de conteo en el nav); estado vacío.
- **Farmacias**: chips de filtro por estado + tabla (farmacia, ciudad, estado [Activa/Pausada/Pendiente], plan, leads mes).
- **Métricas globales**: 4 KPIs, gráfica de ingresos por mes, leads por ciudad (barras).
- **Tasa del día**: tarjeta grande con tasa vigente + fuente (segmented BCV/Paralelo/Manual) + actualizar + historial.
- **Analítica de uso**: KPIs (usuarios activos, búsquedas, sesiones, retención), embudo de conversión (Búsquedas→Resultados→Lista→Clic WhatsApp), más buscados.
- **Reportes**: lista de errores/mejoras con severidad (Crítico/Media/Baja) y estado (Abierto/En estudio/Resuelto).

### Estado (B2B)
role, authed, fScreen/sScreen (pantalla por rol), device, cfgDelivery, tasaAuto, tasaSource, inv[] (con toggle disponible), approvals[] (aprobar/rechazar), tasa=145.20. Precio Bs = usd × tasa (formato es-VE).

## Interactions & Behavior (ambos)
Navegación por tabs/sidebar; toggles con knob animado (spring); hojas bottom-sheet (`sheetUp` .36s cubic-bezier(.2,.82,.2,1) + overlay `fadeIn`); tablas con overflow-x en pantallas angostas; foco visible (`outline:2px solid #1D9E75`); todo respeta `prefers-reduced-motion`.

## State Management / Backend
Reemplazar mocks por API real:
- Paciente: búsqueda de medicamentos (nombre → resultados con farmacia, precio USD, stock, distancia), tasa del día, Lista Médica (local/sin registro), envío a WhatsApp (un mensaje por farmacia), escáner de récipe (IA extrae medicamentos).
- B2B: auth farmacia, inventario CRUD, leads y facturación por lead, aprobaciones de farmacias, tasa del día (BCV/paralelo/manual), analítica de uso, reportes.

## Assets
Sin imágenes propietarias. Íconos = lucide-react (los SVG inline replican paths de lucide). Imagen de producto en tarjetas = placeholder para foto real. Logo DosisYa es tipográfico (Inter 800).

## Files
- `NavegacionInferior.dc.html` — App del paciente (móvil).
- `PanelFarmacia.dc.html` — Panel B2B (desktop + móvil).
- `support.js` — runtime SOLO de previsualización; no implementar.
