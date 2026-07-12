# Diseño: Mejoras inspiradas en research de farmacias online

> Fecha: 2026-07-12 · Origen: investigación comparativa de 12 plataformas
> (San Pablo, Farmatodo, Cruz Verde, Inkafarma, DocMorris, Amazon Pharmacy,
> Rappi, Farmalisto, PromoFarma, GoodRx, 1mg, PharmEasy).

## Filtro de encaje con DosisYa

Solo se incorporan ideas compatibles con la filosofía del producto: agregador
de leads CPC, cero fricción, sin login del paciente, contacto por WhatsApp, no
vende ni hace logística. **Descartadas:** super-app con labs/teleconsulta
(rompe el modelo de leads), puntos de lealtad (requieren login), pickup /
logística (DosisYa no la hace).

## Tracks (en orden de implementación)

1. **🏷️ Ahorro** — Destacar precio más bajo (este spec) + Genéricos equivalentes.
2. **🛡️ Confianza** — Señales de licencia/verificación + alerta de receta.
3. **🔔 Retención** — Recordatorio de resurtido.

Cada track/feature se implementa y verifica por separado.

---

## Track 1a: Destacar el precio más bajo

**Inspiración:** GoodRx (comparador de precios) + el hecho de que DosisYa ya
muestra varias farmacias con precio para un mismo medicamento.

### Restricción de negocio (crítica)
El backend ordena los resultados por proximidad + boost premium; las farmacias
premium pagan por ese ranking. **No se debe reordenar la lista por defecto**, o
se sabotea la monetización. La señal de "más económico" debe ser independiente
del orden.

### Alcance
- 100% frontend. Usa `ResultadoFarmacia.precio_usd` que ya viene en la búsqueda.
- Cero cambios de backend, cero dependencias nuevas.

### Componentes
1. `src/App.tsx`
   - Estado `orden: "relevancia" | "precio"` (default `"relevancia"`).
   - `useMemo` `resultadosOrdenados`: en `"precio"` copia y ordena ascendente por
     `precio_usd`; en `"relevancia"` deja el orden del backend intacto.
   - Índice `idxMasEconomico` = posición del `precio_usd` mínimo dentro de
     `resultadosOrdenados`; solo se calcula si hay ≥2 resultados.
   - Toggle de orden (segmented control) arriba de la lista, visible solo con ≥2
     resultados.
   - Pasa `esMasEconomico={i === idxMasEconomico}` a cada tarjeta.
2. `src/components/TarjetaResultado.tsx`
   - Prop opcional `esMasEconomico?: boolean`.
   - Cuando es `true`: badge "💰 Más económico" junto al precio; borde/realce
     sutil en la tarjeta.

### Estados y bordes
- 0–1 resultados: sin toggle, sin badge (comparar no tiene sentido).
- Empates en precio mínimo: se marca el primero.
- El toggle solo reordena del lado del cliente; recargar/re-buscar vuelve a
  `"relevancia"`.

### Verificación
- `npx tsc --noEmit` + `npm run build` limpios.
- Con ≥2 resultados: el badge aparece en el de menor precio; el toggle "Precio ↑"
  reordena y "Relevancia" restaura el orden del backend.

### Fuera de alcance (YAGNI)
- Orden por distancia (el dato existe pero no es parte de esta feature).
- Comparación por presentación normalizada (v1 compara `precio_usd` absoluto).
