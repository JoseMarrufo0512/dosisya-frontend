# Sistema de diseño (verde-cruz)

## En una frase
Una sola identidad visual en toda la app: paleta **verde-cruz** + tipografía **Inter**, con un único set de tokens y el verde de WhatsApp reservado solo para su acción. (Migración completada 2026-07-26; reemplaza el "Azul Médico / Glassmorphism" anterior.)

## Fuente única de tokens
- **Paleta canónica:** `src/styles/dosisya-ui.css` → `:root`. Los valores de color viven aquí **una sola vez** (`--verde-cruz`, `--verde-vivo`, `--verde-claro`, `--whatsapp`, `--ambar-receta`/`--ambar-fondo`, `--rojo`/`--rojo-fondo`, `--tinta`/`--tinta-suave`/`--tinta-tenue`, `--papel`/`--blanco`/`--borde`/`--fondo-suave`, `--disp-text`/`--disp-fondo`). Cambiar un color = editar **una línea**.
- **Mapeo shadcn → marca:** `src/styles.css` → `:root` conecta los tokens de shadcn a la paleta (`--primary: var(--verde-cruz)`, `--foreground: var(--tinta)`, …). Por eso `bg-primary`, `text-foreground`, `border-border`, etc. son verde-cruz en toda la app **por defecto**, incluidos los portales de vaul/Radix montados en `<body>`.
- Ambas hojas se cargan global en `src/routes/__root.tsx` (`appCss` y luego `dosisya-ui.css`).

## Tipografía
- **Inter** en toda la app (pesos 400–800), cargada global en `__root.tsx` y aplicada en `body` (`styles.css`).
- `.dosisya-ui` fija la familia para superficies con la identidad handoff (panel B2B) y expone utilidades `.dy-num` (cifras tabulares) y `.dy-foco`/`.dy-foco-in` (anillo de foco verde-vivo).
- La pantalla del paciente usa `.busqueda-root` (en `styles/tokens.css`) solo para superficie/color + utilidades propias; ya **no** define paleta ni una fuente distinta.

## Reglas de color
- **WhatsApp** (`#25D366`) es **exclusivo** de botones/acciones de WhatsApp; va hardcodeado (`bg-[#25D366]`), no como token de marca, para que no lo re-tematice nada.
- Precio USD y elementos de marca → `--verde-cruz`. Disponible → `--verde-vivo`/`--disp-*`. Récipe/pendiente → `--ambar-*`. Destructivo/agotado → `--rojo`.
- Prohibido reintroducir el azul viejo (`#0a2463`) o el verde menta (`#3ddc97`).

## Cómo aplicar en componentes nuevos
- Componentes de shadcn: usar sus clases (`bg-primary`, `text-foreground`, …) → ya salen verde.
- Componentes del panel (identidad handoff): envolver en `.dosisya-ui` y usar `var(--dy-*)` o los canónicos `var(--verde-cruz)`; cifras con `.dy-num`.
- No inventar hex sueltos: referenciar siempre un token.

## Superficies migradas
App paciente (`/`, `/busqueda`), panel B2B (cromo + Inicio/Inventario/Facturación/Configuración/Soporte), Login/Registro B2B y Súper Admin (login + dashboard). No queda azul de marca en ninguna.
