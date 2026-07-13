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

---

## Track 1b: Genéricos equivalentes (versión backend)

**Inspiración:** "Productos Equivalentes" de Inkafarma.

### Restricción de datos (crítica, verificada)
El catálogo actual tiene **una sola marca por principio activo** (Acetaminofén→
Atamel, Omeprazol→Losec, Losartán→Cozaar, Metformina→Glucophage), cada uno en
3 farmacias. **No hay genéricos ni marcas alternas.** La lógica se construye
correcta, pero solo se "enciende" cuando el catálogo tenga equivalentes. Seed de
demo: `DosisYa-Backend/db/seeds/demo_generico_equivalente.sql`.

### Backend — `routers/medicamentos.py`
`_BUSCAR_MEDICAMENTOS`: se antepone un CTE `principios_coincidentes` que resuelve
los principios activos que matchean el término (por principio o por marca);
luego el `WHERE` devuelve **todos** los productos de esos principios activos
(`im.principio_activo IN (...)`), no solo los que matchean el término. Así, al
buscar una marca (ej. Cozaar) aparece también el genérico del mismo principio
activo. Mismos 6 parámetros, mismas columnas → sin cambios en el mapeo ni en el
router. `score_similitud` sigue midiéndose contra el término, así que la
coincidencia directa ordena primero y los equivalentes después.

### Frontend — `App.tsx` + `TarjetaResultado.tsx`
- `equivMasBaratoPorProducto`: por `medicamento_id`, el precio del equivalente
  más barato = mismo `principio_activo` pero **distinto** `medicamento_id` (el
  mismo producto en otra farmacia NO cuenta; eso es Track 1a).
- Prop `equivalenteDesde`: si un equivalente cuesta menos, la tarjeta muestra la
  nota "Hay un equivalente del mismo principio activo desde $X".
- Pill "Genérico" cuando `marca_comercial` es nula/vacía.

### Verificación
- Backend: `py_compile` OK; **no-regresión** confirmada contra el endpoint en
  vivo (las búsquedas existentes siguen devolviendo lo mismo).
- La aparición de equivalentes NO es demostrable con los datos actuales; requiere
  correr el seed de demo. Limitación reconocida explícitamente.

---

## Track 2: Confianza (señales de licencia + alerta de receta)

**Inspiración:** Cruz Verde ("Vigilado Supersalud"), Amazon Pharmacy (URAC/NABP),
y la señal de legitimidad #1 del research: exigir récipe para controlados.

### Restricción de datos (verificada)
El schema NO tiene campos de receta ni de verificación/licencia. La versión
granular (badge "requiere récipe" por medicamento, licencia por farmacia)
necesita migración + datos que no existen.

### v1 — zero-data (implementada, frontend puro)
- **Aviso de récipe** en resultados: nota "Algunos medicamentos requieren récipe
  médico; la farmacia te lo pedirá". Educacional, sin datos.
- **Sello de confianza** al pie de resultados: "Farmacias afiliadas y verificadas
  por DosisYa" — respaldado por que el backend ya filtra `estado_afiliacion =
  'activa'` (todas las farmacias mostradas están activas).
- Ambos solo aparecen cuando hay resultados. `tsc`+`build` OK.

### v2 — con datos (pendiente, requiere migración)
- `inventario_maestro.requiere_receta BOOLEAN` → badge "Requiere récipe" solo en
  medicamentos controlados.
- `farmacias.verificada BOOLEAN` / nº de licencia sanitaria → badge de farmacia
  verificada diferenciado. Requiere una fuente de verdad de licencias.
- No se implementa como migración dormida sin decisión explícita del usuario.

---

## Track 3: Recordatorio de resurtido (retención)

**Inspiración:** Pastillero Virtual (Farmatodo), RxPass (Amazon), y el "Welcome
Back Hook" del roadmap de DosisYa.

### Alcance v1 (implementada, frontend puro, sin login)
- Hook `useRecordatorios` (localStorage, patrón `useLocalStorage`): `agregar`,
  `eliminar`, `estaActivo`, `vencidos`. Recordatorio = `{ termino, creadoMs,
  proximoMs }`, intervalo default 30 días.
- Chip en resultados: "🔔 Recordarme resurtir en 30 días" (toggle add/quitar
  para el término buscado).
- Banner en el hero: al volver a la app, si algún recordatorio venció, muestra
  "Es hora de resurtir" con chips que re-buscan Y re-arman otro ciclo.
- SSR-safe: los recordatorios dependen de la fecha → se evalúan solo tras montar
  en el cliente (`montado` flag), evitando mismatch de hidratación.

### Verificación
- `tsc`+`build` OK. Lógica de fechas y dedup verificada con test en Node
  (nuevo→no vencido, 31d→vencido, 29d→no, re-agregar mismo término no duplica).

### v2 — con datos/infra (fuera de alcance)
- Entrega por push/WhatsApp cuando la app está cerrada: requiere service worker +
  backend de push o n8n con el teléfono del paciente (rompe "cero fricción" si se
  pide el teléfono). La v1 recuerda "al volver a la app", sin login.
