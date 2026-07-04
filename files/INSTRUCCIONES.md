# Fase 1 — Lista Médica (carrito multi-producto) · DosisYa

Verificado con TypeScript en modo estricto usando las mismas versiones de tus
dependencias (React 19, vaul, sonner, framer-motion, lucide-react). Cero
dependencias nuevas y cero cambios de backend.

## Qué contiene

```
src/
├── App.tsx                                ← REEMPLAZA tu archivo actual
├── hooks/
│   └── useListaMedica.ts                  ← NUEVO
├── lib/
│   ├── whatsapp.ts                        ← NUEVO
│   └── leadsLista.ts                      ← NUEVO
└── components/
    ├── TarjetaResultado.tsx               ← REEMPLAZA tu archivo actual
    └── lista/
        ├── CartSummary.tsx                ← NUEVO
        ├── ListaMedicaDrawer.tsx          ← NUEVO
        └── SelectorFarmacia.tsx           ← NUEVO
```

## Cómo integrarlo

**Antes de nada: haz commit de tu proyecto** (o una copia de seguridad),
porque dos archivos se reemplazan.

- **Opción A (recomendada):** descomprime `dosisya-fase1.zip` en la raíz del
  proyecto. Respeta las rutas y sobreescribe `App.tsx` y `TarjetaResultado.tsx`.
- **Opción B:** copia cada archivo manualmente a la ruta indicada arriba.

Luego `npm run dev` y listo — no hay nada más que configurar.

## ⚠️ La única verificación obligatoria

El lead multi-producto se envía a `POST /api/v1/leads` con este cuerpo:

```json
{ "farmacia_id": 123, "tipo_accion": "clic_whatsapp", "medicamento_ids": [1, 2, 3] }
```

Haz **una** prueba de contacto y revisa en Supabase que el lead se insertó.
Si tu backend espera otro nombre para el array, se cambia en **un solo
lugar**: `src/lib/leadsLista.ts` (está marcado con ⚠️). Esto importa porque el
envío es "fire-and-forget": si el campo está mal, los leads se pierden en
silencio y eso es facturación perdida.

## Prueba en 7 pasos

1. `npm run dev` y abre la app.
2. Busca "Losartán" → toca **Añadir a mi lista**. El botón cambia a
   "✓ En tu lista · 1" y aparece la barra flotante abajo.
3. Añade 2–3 medicamentos más con otras búsquedas (tocar de nuevo suma cantidad).
4. **Refresca la página** → la lista sigue ahí (persistencia en localStorage).
5. Abre la barra → edita cantidades con − / +, elimina uno y toca **Deshacer**
   en el toast (tienes 5 segundos).
6. **Elegir farmacia y contactar** → verás farmacias ordenadas por cobertura
   ("Tiene X de Y de tu lista") con distancia, total estimado en USD y qué les
   falta. La mejor opción viene resaltada.
7. **Contactar por WhatsApp** → se abre el chat con la lista numerada y el
   lead queda registrado (verifica en Supabase la primera vez).

## Qué NO se tocó

- Backend: cero cambios. La cobertura reutiliza `/api/v1/medicamentos/buscar`
  (una consulta por medicamento, en paralelo).
- `src/lib/api.ts` y `src/lib/leads.ts`: intactos.
- Las otras tres acciones CPC de la tarjeta (Ver mapa, Guardar info,
  Compartir): intactas, siguen facturando igual.
- Rutas de admin: intactas.

## Detalles que ya quedaron resueltos por ti

- **SSR-safe** (TanStack Start): la lista usa `useSyncExternalStore`, sin
  errores de hidratación.
- **keepalive** en el lead: la petición sobrevive a la navegación a WhatsApp.
  Sin esto, el navegador mataba el fetch al abrir wa.me y el lead se perdía.
- **Anti-spam**: el botón de contacto se bloquea 2 segundos tras el clic (spec).
- **Sin lead al añadir**: añadir a la lista no factura; solo contactar factura.
- Sincronización entre pestañas, cantidades 1–99, estados de carga/vacío/error
  en el selector, targets táctiles de 44px+ y textos accesibles.

## Nota de diseño

El botón "Añadir a mi lista" usa el azul primario (`--primary`) y el verde
WhatsApp ahora vive solo en el botón de contacto del selector — así el color
verde siempre significa "hablar con la farmacia".

## Siguiente fase

Fase 2 — Escáner IA de récipes: overlay con animación láser y mensajes
progresivos, resultados editables con badges "Receta original" / "Alternativa
sugerida por IA", y fallback de foto directa. El escáner deposita sus
resultados en esta misma lista, por eso la lista va primero.
