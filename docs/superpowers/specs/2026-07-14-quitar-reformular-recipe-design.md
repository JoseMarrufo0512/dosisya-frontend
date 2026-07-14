# Feature: Quitar/Reformular medicamentos del escáner de récipe

> Diseño aprobado el 2026-07-14. Complementa `receta-ia-y-carrito.md` (Flujo 2) y
> `receta-ia-optimizacion-gemini.md`. Alcance: solo frontend (`DosisYa-Frontend`).

## Problema

El escáner de récipe (Gemini Vision) a veces lee mal un medicamento entre varios
correctos (ej. 1 de 4). Hoy, en el estado `results` de `EscanerRecipe.tsx`, la
única acción por medicamento es "Añadir" — no hay forma de descartar un
medicamento mal leído ni de corregir su texto. El usuario que reporta el
problema puede no tener conocimiento médico, así que la corrección debe venir
de lo que **él mismo observa** en el papel de la receta (o reconoce del nombre
real), nunca de que la IA "adivine" la molécula correcta a partir de los
síntomas sugeridos por los otros medicamentos — eso sería una decisión clínica
que solo un médico puede tomar (mismo principio que ya rige `alternativas` en
el backend: "un cambio de molécula lo decide un médico, no la IA").

## Objetivo

1. Poder **quitar** un medicamento detectado antes de añadirlo al carrito.
2. Poder **reformular** (corregir manualmente) el nombre/cantidad de un
   medicamento mal leído, basado en lo que el usuario ve en la receta física.
3. Dejar explícito, tanto al usuario como al farmacéutico, que el resultado
   es generado por IA y debe verificarse.

## Diseño

### IDs estables (prerequisito técnico)

Hoy `resultados.map((med, idx) => ...)` usa el índice del array como `key`, y
`expandidos: Set<number>` también indexa por posición. Quitar un ítem de en
medio recorre los índices de los siguientes, desalineando qué alternativas
están expandidas para cuál medicamento. Al recibir la respuesta del backend,
cada medicamento recibe un `id` estable (`crypto.randomUUID()`), reemplazando
el índice en el `key` del `<li>` y en `expandidos` (pasa a `Set<string>`).

Tipo local en `recipeIA.ts`:
```ts
export interface MedicamentoRecetaUI extends MedicamentoReceta {
  id: string;
}
```
`analizarRecipe()` sigue devolviendo `MedicamentoReceta[]` tal cual (contrato
del backend intacto); `EscanerRecipe.tsx` mapea a `MedicamentoRecetaUI[]`
(añadiendo el `id`) al guardar `resultados`.

**No confundir con `recipeId(nombre)`:** el helper existente que genera
`recipe-${nombre...}` para verificar si un medicamento ya está en el carrito
(`estaEnLista`) sigue igual, sin tocarse — es un ID derivado del *nombre* para
comparar contra el carrito. El nuevo `id: string` (UUID) es un ID de *sesión
de escaneo*, solo para `key` de React y para saber qué ítem está en modo
edición; no se persiste ni se usa fuera de este componente.

### Nuevo estado en `EscanerRecipe.tsx`

```ts
const [editandoId, setEditandoId] = useState<string | null>(null);
```

Un solo ítem editable a la vez.

### Botones por ítem (estilo A del mockup: iconos compactos)

Junto al botón "Añadir" existente, dos iconos discretos. El archivo ya importa
iconos de `lucide-react` de forma consistente (`Camera`, `ScanLine`,
`CheckCircle2`, etc.) — usar el mismo paquete, sin emoji, para estos botones:
- **Reformular** (icono `Pencil`) — activa modo edición para ese ítem: el
  nombre/cantidad se reemplazan por `<input>`s con botones "Guardar"/"Cancelar".
- **Quitar** (icono `Trash2`) — filtra el ítem de `resultados` de inmediato,
  sin confirmación (reversible: el usuario puede volver a escanear).

**Guardar reformulación:**
- Actualiza `medicamento` y `cantidad` del ítem con el texto tecleado.
- `medicamento` no puede quedar vacío (mismo mínimo que exige el backend);
  bloquear "Guardar" si está vacío.
- `alternativas` se limpia a `[]` — **no se vuelve a llamar al backend/Gemini**.
  El usuario ya escribió lo que sabe que es correcto; no hay necesidad de
  gastar cuota ni latencia en volver a pedir "alternativas" para un texto que
  no vino de una imagen.
- Sale del modo edición (`editandoId` vuelve a `null`).

**Cancelar:** descarta los cambios del input, sale del modo edición sin tocar
el ítem original.

### Banner de aviso IA

Banner ámbar (mismo lenguaje visual `bg-amber-*`/`text-amber-*` que el estado
`error` existente, que ya usa un icono lucide — `ImageOff` — en vez de emoji),
fijo en la parte superior de la lista, visible siempre que haya medicamentos
detectados (estado `results`). Icono: `AlertTriangle` (lucide-react).

> **Resultado generado por IA.** Puede contener errores — verifica los
> medicamentos antes de continuar. El farmacéutico también debe confirmarlos.

### Nota al farmacéutico (WhatsApp)

`src/lib/whatsapp.ts` → `construirMensajeLista(farmaciaNombre, lista)`:
cada `ItemLista` ya tiene un campo `origen?: OrigenLead` (los ítems del
escáner se marcan `origen: "escaner_recipe"` al añadirse, código ya existente
en `EscanerRecipe.tsx`). La función revisa si **algún** ítem de `lista` tiene
`origen === "escaner_recipe"` — si es así, inserta una línea antes de la
pregunta final del mensaje:

> "⚠️ Algunos productos fueron leídos por IA desde una foto de récipe — por
> favor confirma contra la receta física antes de despachar."

Se aplica **siempre** que haya al menos un ítem del escáner en el pedido, sin
importar si el usuario reformuló algo o no — la IA puede fallar también en lo
que el usuario no notó como raro; el farmacéutico debe poder confirmar todo lo
leído por IA, no solo lo corregido a mano.

## Fuera de alcance (YAGNI)

- Re-consultar alternativas tras reformular (decisión explícita: no).
- Confirmación/deshacer al quitar un ítem (es trivial volver a escanear).
- Cualquier inferencia de la IA sobre qué medicamento "debería ser" a partir
  de síntomas o de los otros medicamentos del récipe — descartado por riesgo
  clínico, ver sección "Problema".
- Cambios en el backend o en el contrato HTTP del endpoint de récipe.

## Verificación

- `npx tsc --noEmit && npm run build` (regla pre-commit del repo).
- Manual en el navegador (mock o backend real): escanear → quitar un ítem →
  confirmar que desaparece; reformular un ítem → confirmar que el texto se
  actualiza y sus alternativas quedan vacías; expandir alternativas de un
  ítem, quitar OTRO ítem, confirmar que el expandido no se desalinea (prueba
  directa del arreglo de IDs estables); armar un pedido con un ítem de
  `origen: "escaner_recipe"` y confirmar que el mensaje de WhatsApp incluye la
  nota al farmacéutico.
