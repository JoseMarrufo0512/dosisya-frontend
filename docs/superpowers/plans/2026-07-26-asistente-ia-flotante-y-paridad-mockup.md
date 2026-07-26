# Asistente IA flotante + paridad con el mockup — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cerrar la paridad entre `NavegacionInferior.dc.html` y la app real del paciente: burbuja IA flotante y arrastrable, botón atrás del teléfono para todos los overlays, chip de tasa (frontend listo), placeholder de mapa en Farmacias y eliminación de la ruta demo `/busqueda`.

**Architecture:** App React 19 + TanStack Start (SSR). Los overlays ya son componentes controlados (`open`/`onOpenChange`) cuyo estado vive en `App.tsx`; el back-dismiss se orquesta desde ahí con un hook nuevo que empuja/consume entradas de `history`. El chat IA se extrae a un componente compartido y sube su estado a `App` para que la burbuja flotante y la hoja "Más" abran la misma instancia. El chip de tasa consume un endpoint aún inexistente con degradación elegante (oculto si no responde).

**Tech Stack:** React 19, TanStack Router/Start, TanStack Query 5, framer-motion 12, vaul 1.1, lucide-react, TypeScript, TailwindCSS 4 + tokens verde-cruz.

## Global Constraints

- Verificación obligatoria antes de cada commit: `npx tsc --noEmit && npm run build` (CLAUDE.md §6). No hay runner de tests unitarios en el proyecto; la verificación es type-check + build + preview manual.
- `src/routeTree.gen.ts` es **auto-generado**: nunca editarlo a mano (lo regenera `vite dev`/`vite build`).
- No tocar el backend (`DosisYa-Backend`) sin autorización expresa (CLAUDE.md §4.3). El endpoint de tasa queda como solicitud redactada en el spec.
- Colores solo vía tokens (`var(--verde-cruz)`, etc.); WhatsApp `#25D366` hardcodeado y exclusivo. No reintroducir azul `#0a2463` ni verde menta `#3ddc97` (`docs/contexto/sistema-de-diseno.md`).
- Todo acceso a `window`/`localStorage`/`history` debe ser client-only (guardas `typeof window === "undefined"` o patrón `montado`) por el SSR de TanStack Start.
- Trabajar en la rama `feat/asistente-ia-flotante-paridad` (ya creada, con el spec comiteado).
- Spec de referencia: `docs/superpowers/specs/2026-07-26-asistente-ia-flotante-y-paridad-mockup-design.md`.

---

## File Structure

**Nuevos:**
- `src/hooks/useBackDismiss.ts` — hook: botón atrás cierra un overlay controlado.
- `src/hooks/useTasa.ts` — hook: tasa vigente vía TanStack Query, con degradación a `null`.
- `src/components/paciente/_hojaBase.tsx` — primitivos compartidos `HojaBase` + `Asa` (extraídos de `MenuMasPaciente`).
- `src/components/paciente/HojaChatIA.tsx` — hoja del Asistente IA (extraída de `MenuMasPaciente`).
- `src/components/paciente/BurbujaAsistenteIA.tsx` — burbuja flotante arrastrable.

**Modificados:**
- `src/components/paciente/MenuMasPaciente.tsx` — usa `_hojaBase`; quita el chat interno; nuevo prop `onAbrirChatIA`; back-dismiss de sub-hojas.
- `src/App.tsx` — estado `chatIAAbierto`; monta burbuja + chat; chip de tasa; placeholder de mapa; back-dismiss de todos los overlays.
- `src/components/HeroBusqueda.tsx` — chip de tasa en el header (nuevo prop `tasa`).

**Eliminados:**
- `src/routes/busqueda.tsx`
- `src/components/busqueda/` (carpeta completa)

---

## Task 1: Consolidar y eliminar la ruta demo `/busqueda`

Islote verificado: solo `src/routes/busqueda.tsx` importa `src/components/busqueda/*`, y nada enlaza a `/busqueda`. Se elimina para dejar la app real como única implementación.

**Files:**
- Delete: `src/routes/busqueda.tsx`
- Delete: `src/components/busqueda/` (BarraBusqueda, BloquePrecio, CabeceraTasa, EstadoVacio, NavegacionInferior, SkeletonResultado, TarjetaMedicamento)
- Regenerado por el build: `src/routeTree.gen.ts`

**Interfaces:**
- Consumes: nada.
- Produces: nada (solo elimina).

- [ ] **Step 1: Confirmar el aislamiento antes de borrar**

Run:
```bash
grep -rn "components/busqueda\|routes/busqueda\|\"/busqueda\"\|to=\"/busqueda" src --include=*.ts --include=*.tsx | grep -v "src/components/busqueda/" | grep -v "src/routes/busqueda.tsx" | grep -v routeTree.gen.ts
```
Expected: **sin salida** (nadie externo los usa). Si aparece algo, detenerse y revisar.

- [ ] **Step 2: Eliminar la ruta y los componentes demo**

Run:
```bash
git rm src/routes/busqueda.tsx
git rm -r src/components/busqueda
```

- [ ] **Step 3: Regenerar el route tree y verificar**

Run:
```bash
npx tsc --noEmit && npm run build
```
Expected: PASS. El build regenera `src/routeTree.gen.ts` sin la ruta `/busqueda`. Si `tsc` se queja de que `routeTree.gen.ts` aún referencia `busqueda`, correr `npm run dev` unos segundos (o el build) para regenerarlo y volver a verificar.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor(busqueda): eliminar ruta demo /busqueda duplicada

El islote src/components/busqueda/* + routes/busqueda.tsx usaba datos mock
y no lo importaba ni enlazaba nada de la app real. Se elimina para dejar
App.tsx como única implementación de la pantalla de búsqueda.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Hook `useBackDismiss` + cablearlo en los overlays existentes

El botón atrás del teléfono debe cerrar el overlay abierto en vez de salir de la app.

**Files:**
- Create: `src/hooks/useBackDismiss.ts`
- Modify: `src/App.tsx` (overlays: `listaAbierta`, `escanerAbierto`, `comparadorAbierto`, `loginAbierto`, `masAbierto`)
- Modify: `src/components/paciente/MenuMasPaciente.tsx` (sub-hojas: estado `sub`)

**Interfaces:**
- Consumes: nada.
- Produces: `useBackDismiss(open: boolean, onClose: () => void): void`

- [ ] **Step 1: Crear el hook**

Create `src/hooks/useBackDismiss.ts`:
```ts
import { useEffect, useRef } from "react";

/**
 * Hace que el botón "atrás" del navegador/teléfono cierre un overlay controlado
 * en vez de navegar fuera de la app.
 *
 * Al pasar `open` de false→true empuja una entrada "trampa" en el history. Si el
 * usuario presiona atrás (popstate) estando abierto, se llama `onClose`. Si el
 * overlay se cierra por otra vía (botón X, backdrop, tecla Esc), se consume la
 * entrada trampa con history.back() para no dejar basura en el historial.
 *
 * Con varios overlays apilados, cada instancia empuja su propia entrada, así que
 * "atrás" cierra el de más arriba primero (comportamiento tipo pila, como nativo).
 */
export function useBackDismiss(open: boolean, onClose: () => void) {
  const pushedRef = useRef(false);
  // onClose siempre fresco sin re-suscribir el listener en cada render.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (open && !pushedRef.current) {
      window.history.pushState({ dosisyaOverlay: true }, "");
      pushedRef.current = true;

      const onPop = () => {
        // El usuario presionó atrás: la entrada trampa ya fue consumida.
        pushedRef.current = false;
        onCloseRef.current();
      };
      window.addEventListener("popstate", onPop);
      return () => window.removeEventListener("popstate", onPop);
    }

    if (!open && pushedRef.current) {
      // Cierre programático (X / backdrop / Esc): consumimos nuestra trampa.
      pushedRef.current = false;
      window.history.back();
    }
  }, [open]);
}
```

- [ ] **Step 2: Cablear el hook en `App.tsx`**

En `src/App.tsx`, agregar el import junto a los otros hooks:
```ts
import { useBackDismiss } from "./hooks/useBackDismiss";
```
Y, después de las declaraciones de estado de los overlays (tras la línea `const [loginAbierto, setLoginAbierto] = useState(false);`), agregar una llamada por overlay:
```ts
  // Botón atrás del teléfono → cierra el overlay abierto (uno por capa).
  useBackDismiss(listaAbierta, () => setListaAbierta(false));
  useBackDismiss(escanerAbierto, () => setEscanerAbierto(false));
  useBackDismiss(comparadorAbierto, () => setComparadorAbierto(false));
  useBackDismiss(loginAbierto, () => setLoginAbierto(false));
  useBackDismiss(masAbierto, () => setMasAbierto(false));
```

- [ ] **Step 3: Cablear el hook en las sub-hojas de `MenuMasPaciente.tsx`**

En `src/components/paciente/MenuMasPaciente.tsx`, agregar el import:
```ts
import { useBackDismiss } from "@/hooks/useBackDismiss";
```
Dentro del componente `MenuMasPaciente`, tras `const [sub, setSub] = useState<SubHoja>(null);`, agregar:
```ts
  // Botón atrás cierra la sub-hoja abierta (Recordatorios/Comparar/Ayuda).
  useBackDismiss(sub !== null, () => setSub(null));
```

- [ ] **Step 4: Verificar**

Run:
```bash
npx tsc --noEmit && npm run build
```
Expected: PASS.

Verificación manual (preview): abrir la hoja "Más" y presionar el botón atrás del navegador → la hoja se cierra y la app **no** navega fuera. Repetir con Lista, Escáner y Login.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useBackDismiss.ts src/App.tsx src/components/paciente/MenuMasPaciente.tsx
git commit -m "feat(nav): botón atrás del teléfono cierra los overlays

Nuevo hook useBackDismiss: empuja una entrada trampa en history al abrir y
la consume al cerrar. Cableado en Lista, Escáner, Comparar, Login, hoja Más
y sus sub-hojas, para que 'atrás' cierre la capa superior como app nativa.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Extraer `HojaBase`/`Asa` y `HojaChatIA`; subir el estado del chat a `App`

Prepara el chat para abrirse tanto desde "Más" como desde la burbuja flotante, con una sola instancia controlada por `App`.

**Files:**
- Create: `src/components/paciente/_hojaBase.tsx`
- Create: `src/components/paciente/HojaChatIA.tsx`
- Modify: `src/components/paciente/MenuMasPaciente.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `useBackDismiss` (Task 2).
- Produces:
  - `HojaBase({ open, onClose, titulo?, tituloNodo?, children }): JSX.Element` y `Asa(): JSX.Element` desde `_hojaBase.tsx`.
  - `HojaChatIA({ open, onClose }: { open: boolean; onClose: () => void }): JSX.Element` desde `HojaChatIA.tsx`.
  - `MenuMasPaciente` gana prop `onAbrirChatIA: () => void` y **pierde** el sub-estado `"ia"`.

- [ ] **Step 1: Crear `_hojaBase.tsx` con los primitivos compartidos**

Create `src/components/paciente/_hojaBase.tsx` (copiar VERBATIM las funciones `HojaBase` y `Asa` que hoy están en `MenuMasPaciente.tsx`, exportándolas):
```tsx
/*
 * Primitivos compartidos de las hojas del paciente (bottom-sheets vaul).
 * Extraídos de MenuMasPaciente para reutilizarlos en HojaChatIA y la burbuja IA.
 */
import { Drawer } from "vaul";
import { X } from "lucide-react";

export function HojaBase({
  open,
  onClose,
  titulo,
  tituloNodo,
  children,
}: {
  open: boolean;
  onClose: () => void;
  titulo?: string;
  tituloNodo?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Drawer.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <Drawer.Content
          className="dosisya-ui fixed inset-x-0 bottom-0 z-50 mx-auto flex max-w-md flex-col rounded-t-3xl outline-none"
          style={{ background: "var(--papel)", padding: "10px 18px 24px" }}
          aria-describedby={undefined}
        >
          <Asa />
          <div className="flex items-center justify-between">
            {tituloNodo ?? (
              <Drawer.Title style={{ fontSize: 17, fontWeight: 500, color: "var(--tinta)", letterSpacing: "-0.02em" }}>
                {titulo}
              </Drawer.Title>
            )}
            {tituloNodo && <Drawer.Title className="sr-only">{titulo ?? "Detalle"}</Drawer.Title>}
            <button
              type="button"
              aria-label="Cerrar"
              onClick={onClose}
              className="dy-foco flex h-[34px] w-[34px] items-center justify-center rounded-[11px]"
              style={{ background: "var(--fondo-suave)", border: 0, color: "var(--tinta-suave)" }}
            >
              <X className="h-[18px] w-[18px]" aria-hidden="true" />
            </button>
          </div>
          {children}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

export function Asa() {
  return (
    <div
      aria-hidden="true"
      style={{ width: 38, height: 4, borderRadius: 999, background: "#d8dad3", margin: "2px auto 14px" }}
    />
  );
}
```

- [ ] **Step 2: Crear `HojaChatIA.tsx`**

Create `src/components/paciente/HojaChatIA.tsx` (mover VERBATIM la lógica de la función `HojaChatIA` + `Mensaje` + `CHAT_SEED` que hoy están en `MenuMasPaciente.tsx`, importando `HojaBase` de `_hojaBase` y añadiendo back-dismiss):
```tsx
/*
 * HojaChatIA — hoja del Asistente IA (bottom-sheet). UI lista; la respuesta real
 * necesita un endpoint de chat en el backend (aún no existe). Se abre desde la
 * hoja "Más" y desde la burbuja flotante (misma instancia, controlada por App).
 */
import { useState } from "react";
import { Sparkles, Send } from "lucide-react";
import { HojaBase } from "./_hojaBase";
import { useBackDismiss } from "@/hooks/useBackDismiss";

type Mensaje = { de: "ia" | "yo"; texto: string };

const CHAT_SEED: Mensaje[] = [
  { de: "ia", texto: "Hola, soy tu asistente. Pregúntame por dosis, usos o alternativas de un medicamento." },
];

export function HojaChatIA({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [mensajes, setMensajes] = useState<Mensaje[]>(CHAT_SEED);
  const [texto, setTexto] = useState("");

  useBackDismiss(open, onClose);

  const enviar = () => {
    const t = texto.trim();
    if (!t) return;
    setMensajes((m) => [
      ...m,
      { de: "yo", texto: t },
      { de: "ia", texto: "Función en desarrollo — pronto podré responder tus dudas sobre este medicamento." },
    ]);
    setTexto("");
  };

  return (
    <HojaBase
      open={open}
      onClose={onClose}
      titulo="Asistente IA"
      tituloNodo={
        <span className="flex items-center gap-2" style={{ fontSize: 17, fontWeight: 500, color: "var(--tinta)", letterSpacing: "-0.02em" }}>
          <span className="flex h-[30px] w-[30px] items-center justify-center rounded-[9px]" style={{ background: "var(--verde-cruz)", color: "var(--papel)" }}>
            <Sparkles className="h-[17px] w-[17px]" aria-hidden="true" />
          </span>
          Asistente IA
        </span>
      }
    >
      <div className="flex flex-col gap-2.5" style={{ marginTop: 14, maxHeight: "46dvh", overflowY: "auto" }}>
        {mensajes.map((m, i) => (
          <div
            key={i}
            style={
              m.de === "ia"
                ? { alignSelf: "flex-start", maxWidth: "82%", background: "var(--blanco)", border: "1px solid var(--borde)", borderRadius: "16px 16px 16px 5px", padding: "11px 13px", fontSize: 13, color: "var(--tinta)", lineHeight: 1.45 }
                : { alignSelf: "flex-end", maxWidth: "82%", background: "var(--verde-cruz)", color: "#eaf3ef", borderRadius: "16px 16px 5px 16px", padding: "11px 13px", fontSize: 13, lineHeight: 1.45 }
            }
          >
            {m.texto}
          </div>
        ))}
      </div>
      <div
        className="flex items-center gap-2"
        style={{ background: "var(--blanco)", border: "1px solid var(--borde)", borderRadius: 14, padding: "0 6px 0 14px", height: 48, marginTop: 14 }}
      >
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && enviar()}
          placeholder="Escribe tu pregunta…"
          aria-label="Escribe tu pregunta al asistente"
          className="flex-1"
          style={{ border: 0, outline: "none", background: "transparent", fontSize: 13.5, color: "var(--tinta)" }}
        />
        <button
          type="button"
          aria-label="Enviar"
          onClick={enviar}
          className="dy-foco flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]"
          style={{ background: "var(--verde-cruz)", color: "var(--papel)", border: 0 }}
        >
          <Send className="h-[18px] w-[18px]" aria-hidden="true" />
        </button>
      </div>
    </HojaBase>
  );
}
```

- [ ] **Step 3: Adaptar `MenuMasPaciente.tsx` — quitar el chat, usar `_hojaBase`, nuevo prop**

En `src/components/paciente/MenuMasPaciente.tsx`:

1. Cambiar la firma para recibir `onAbrirChatIA`:
```tsx
export function MenuMasPaciente({
  open,
  onOpenChange,
  onAbrirChatIA,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onAbrirChatIA: () => void;
}) {
```
2. Cambiar el tipo `SubHoja` a `"recordatorios" | "comparar" | "ayuda" | null` (quitar `"ia"`).
3. Eliminar del archivo las definiciones locales de `HojaChatIA`, `Mensaje`, `CHAT_SEED`, `HojaBase` y `Asa` (ahora viven en `HojaChatIA.tsx` y `_hojaBase.tsx`). Reemplazar sus usos importando:
```tsx
import { HojaBase, Asa } from "./_hojaBase";
```
   (verificar que las sub-hojas `HojaRecordatorios`, `HojaComparar`, `HojaAyuda` y la lista de menú siguen usando `HojaBase`/`Asa` importados).
4. El ítem "Asistente IA" ya no abre una sub-hoja; llama al prop. Reemplazar su `onClick`:
```tsx
            <ItemMenu
              icono={Sparkles}
              titulo="Asistente IA"
              sub="Pregunta sobre dosis, usos y alternativas"
              destacado
              onClick={() => {
                onOpenChange(false);
                onAbrirChatIA();
              }}
            />
```
5. Eliminar la línea `<HojaChatIA open={sub === "ia"} onClose={() => setSub(null)} />`.
6. Limpiar imports de lucide-react que ya no se usen aquí (`Send`, `MessageCircle` sigue usándose en Ayuda; `Sparkles` sigue usándose en el ítem destacado — dejar los que queden en uso, quitar los huérfanos que marque el linter).

- [ ] **Step 4: Montar el chat en `App.tsx` y conectar "Más"**

En `src/App.tsx`:

1. Import:
```ts
import { HojaChatIA } from "@/components/paciente/HojaChatIA";
```
2. Nuevo estado, junto a `loginAbierto`:
```ts
  const [chatIAAbierto, setChatIAAbierto] = useState(false);
```
3. Back-dismiss para el chat (junto a los otros del Task 2):
```ts
  useBackDismiss(chatIAAbierto, () => setChatIAAbierto(false));
```
4. Pasar el prop a `MenuMasPaciente` y montar la hoja. Reemplazar la línea actual:
```tsx
      <MenuMasPaciente open={masAbierto} onOpenChange={setMasAbierto} />
```
por:
```tsx
      <MenuMasPaciente
        open={masAbierto}
        onOpenChange={setMasAbierto}
        onAbrirChatIA={() => setChatIAAbierto(true)}
      />
      <HojaChatIA open={chatIAAbierto} onClose={() => setChatIAAbierto(false)} />
```

- [ ] **Step 5: Verificar**

Run:
```bash
npx tsc --noEmit && npm run build
```
Expected: PASS.

Verificación manual (preview): abrir "Más" → tocar "Asistente IA" → se abre el chat; escribir y enviar muestra el mensaje seed de respuesta; botón atrás cierra el chat.

- [ ] **Step 6: Commit**

```bash
git add src/components/paciente/_hojaBase.tsx src/components/paciente/HojaChatIA.tsx src/components/paciente/MenuMasPaciente.tsx src/App.tsx
git commit -m "refactor(paciente): extraer HojaChatIA y subir su estado a App

HojaBase/Asa pasan a _hojaBase.tsx (compartidos). El chat IA se extrae a
HojaChatIA.tsx con back-dismiss propio y su estado sube a App, para que la
hoja 'Más' y (siguiente task) la burbuja flotante abran la misma instancia.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Burbuja flotante del Asistente IA (arrastrable, posición recordada)

Burbuja verde siempre visible, movible a cualquier parte, que abre el chat de `App`.

**Files:**
- Create: `src/components/paciente/BurbujaAsistenteIA.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `useLocalStorage<T>(key, initial): readonly [T, setter, remove]` (`src/hooks/useLocalStorage.ts`); estado `chatIAAbierto`/`setChatIAAbierto` de `App` (Task 3).
- Produces: `BurbujaAsistenteIA({ visible: boolean; onAbrir: () => void }): JSX.Element | null`

- [ ] **Step 1: Crear la burbuja**

Create `src/components/paciente/BurbujaAsistenteIA.tsx`:
```tsx
/*
 * BurbujaAsistenteIA — burbuja flotante y arrastrable del Asistente IA.
 * Montada una vez en App, visible en toda la app. Posición inicial abajo-derecha;
 * el usuario la mueve a donde quiera y se recuerda en localStorage. Se oculta
 * mientras el chat está abierto. Distingue tap (abre) de arrastre (mueve).
 */
import { useEffect, useRef, useState } from "react";
import { motion, useMotionValue, useReducedMotion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { useLocalStorage } from "@/hooks/useLocalStorage";

const SIZE = 58;
const MARGIN = 16;
const NAV_GAP = 96; // deja libre la nav inferior + barra de Lista

type Pos = { x: number; y: number };

export function BurbujaAsistenteIA({
  visible,
  onAbrir,
}: {
  visible: boolean;
  onAbrir: () => void;
}) {
  const reduce = useReducedMotion();
  const [pos, setPos] = useLocalStorage<Pos | null>("dosisya:burbujaIA:pos", null);
  const [montado, setMontado] = useState(false);
  const dragMovedRef = useRef(false);
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const clamp = (p: Pos): Pos => ({
    x: Math.min(Math.max(MARGIN, p.x), window.innerWidth - SIZE - MARGIN),
    y: Math.min(Math.max(MARGIN, p.y), window.innerHeight - SIZE - MARGIN),
  });

  const posPorDefecto = (): Pos => ({
    x: window.innerWidth - SIZE - MARGIN,
    y: window.innerHeight - SIZE - MARGIN - NAV_GAP,
  });

  // Restaurar posición al montar (client-only: usa window).
  useEffect(() => {
    const start = clamp(pos ?? posPorDefecto());
    x.set(start.x);
    y.set(start.y);
    setMontado(true);
    // solo al montar
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-encajar al viewport en resize/rotación.
  useEffect(() => {
    if (!montado) return;
    const onResize = () => {
      const p = clamp({ x: x.get(), y: y.get() });
      x.set(p.x);
      y.set(p.y);
      setPos(p);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [montado]);

  if (!montado || !visible) return null;

  return (
    <motion.button
      type="button"
      aria-label="Abrir asistente IA"
      drag
      dragMomentum={false}
      dragElastic={0}
      dragConstraints={{
        left: MARGIN,
        top: MARGIN,
        right: window.innerWidth - SIZE - MARGIN,
        bottom: window.innerHeight - SIZE - MARGIN,
      }}
      style={{
        position: "fixed",
        left: 0,
        top: 0,
        x,
        y,
        width: SIZE,
        height: SIZE,
        borderRadius: 19,
        background: "var(--verde-cruz)",
        color: "var(--papel)",
        border: 0,
        boxShadow: "0 10px 22px -8px rgba(15,76,58,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 45,
        cursor: "grab",
        touchAction: "none",
      }}
      whileTap={reduce ? undefined : { scale: 0.92 }}
      onPointerDown={() => {
        dragMovedRef.current = false;
      }}
      onDragStart={() => {
        dragMovedRef.current = true;
      }}
      onDragEnd={() => {
        const p = clamp({ x: x.get(), y: y.get() });
        x.set(p.x);
        y.set(p.y);
        setPos(p);
      }}
      onClick={() => {
        // Si acabó de arrastrarse, tragarse este click y no abrir.
        if (dragMovedRef.current) {
          dragMovedRef.current = false;
          return;
        }
        onAbrir();
      }}
    >
      <Sparkles className="h-6 w-6" strokeWidth={1.7} aria-hidden="true" />
    </motion.button>
  );
}
```

- [ ] **Step 2: Montar la burbuja en `App.tsx`**

En `src/App.tsx`:
1. Import:
```ts
import { BurbujaAsistenteIA } from "@/components/paciente/BurbujaAsistenteIA";
```
2. Montar la burbuja (colocarla junto a `<HojaChatIA .../>`), visible solo cuando el chat está cerrado:
```tsx
      <BurbujaAsistenteIA visible={!chatIAAbierto} onAbrir={() => setChatIAAbierto(true)} />
```

- [ ] **Step 3: Verificar**

Run:
```bash
npx tsc --noEmit && npm run build
```
Expected: PASS.

Verificación manual (preview): la burbuja aparece abajo-derecha en Buscar y Farmacias; un tap abre el chat; arrastrarla la mueve; al recargar mantiene la posición; mientras el chat está abierto la burbuja no se ve.

- [ ] **Step 4: Commit**

```bash
git add src/components/paciente/BurbujaAsistenteIA.tsx src/App.tsx
git commit -m "feat(paciente): burbuja flotante y arrastrable del Asistente IA

Burbuja global montada en App: posición inicial abajo-derecha, movible a
cualquier parte y recordada en localStorage, re-encajada al viewport en
resize. Tap abre el chat; arrastre solo mueve. Oculta mientras el chat abre.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Hook `useTasa` + chip de tasa en el header del inicio

Muestra la tasa vigente (dato real del backend) con degradación elegante: si el endpoint no existe aún, el chip no se renderiza.

**Files:**
- Create: `src/hooks/useTasa.ts`
- Modify: `src/components/HeroBusqueda.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `API_BASE` (`src/lib/api.ts`); `useQuery` (`@tanstack/react-query`, ya provisto por el router).
- Produces:
  - `useTasa(): { tasa: number; fecha: string } | null`
  - `HeroBusqueda` gana prop `tasa?: number | null`.

- [ ] **Step 1: Crear el hook**

Create `src/hooks/useTasa.ts`:
```ts
import { useQuery } from "@tanstack/react-query";
import { API_BASE } from "@/lib/api";

export interface TasaActual {
  /** Tasa USD → VES vigente (ej. 145.2) */
  tasa: number;
  /** Timestamp ISO de la tasa aplicada */
  fecha: string;
}

/**
 * Contrato pendiente en backend (ver spec 2026-07-26): GET /api/v1/tasa-actual
 *   200 { status, message, data: { tasa: number, fecha: string } }
 * Mientras el endpoint no exista, cualquier fallo devuelve null → el chip se oculta.
 */
async function fetchTasa(): Promise<TasaActual | null> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/tasa-actual`);
    if (!res.ok) return null;
    const json = await res.json();
    const data = json?.data;
    if (!data || typeof data.tasa !== "number") return null;
    return { tasa: data.tasa, fecha: String(data.fecha ?? "") };
  } catch {
    return null;
  }
}

export function useTasa(): TasaActual | null {
  const { data } = useQuery({
    queryKey: ["tasa-actual"],
    queryFn: fetchTasa,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  return data ?? null;
}
```

- [ ] **Step 2: Agregar el chip a `HeroBusqueda.tsx`**

En `src/components/HeroBusqueda.tsx`:
1. Añadir al inicio del archivo un formateador (junto a los imports):
```ts
const nfTasa = new Intl.NumberFormat("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
```
2. Añadir `tasa` a la interfaz `HeroBusquedaProps`:
```ts
  /** Tasa USD→VES vigente para el chip del header; null la oculta. */
  tasa?: number | null;
```
3. Añadir `tasa` a los parámetros desestructurados del componente.
4. Dentro del `div` raíz, junto al botón de login (después del bloque `{onAbrirCuenta && (…)}`), agregar el chip en la esquina superior derecha:
```tsx
      {tasa != null && (
        <div
          className="absolute right-4 top-4 flex items-center gap-1.5 rounded-full px-2.5 py-1.5"
          style={{ background: "#f2f3ef", border: "1px solid var(--borde)" }}
        >
          <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--verde-vivo)" }} />
          <span style={{ fontSize: 11, color: "var(--tinta-suave)" }}>Tasa</span>
          <span className="dy-num" style={{ fontSize: 11, fontWeight: 600, color: "var(--tinta)" }}>
            Bs {nfTasa.format(tasa)}/$
          </span>
        </div>
      )}
```

- [ ] **Step 3: Conectar en `App.tsx`**

En `src/App.tsx`:
1. Import:
```ts
import { useTasa } from "./hooks/useTasa";
```
2. Dentro de `App`, junto a los otros hooks:
```ts
  const tasa = useTasa();
```
3. Pasar el prop en el JSX de `vistaHero` (`<HeroBusqueda … />`):
```tsx
      tasa={tasa?.tasa ?? null}
```

- [ ] **Step 4: Verificar**

Run:
```bash
npx tsc --noEmit && npm run build
```
Expected: PASS.

Verificación manual (preview): sin endpoint, el chip **no** aparece y nada se rompe (comportamiento actual intacto). Para comprobar el render, simular temporalmente la respuesta (o pasar `tasa={145.2}` en el JSX) → aparece "Tasa Bs 145,20/$" arriba a la derecha; revertir la simulación antes de commitear.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useTasa.ts src/components/HeroBusqueda.tsx src/App.tsx
git commit -m "feat(busqueda): chip de tasa en el inicio (backend pendiente)

useTasa consume GET /api/v1/tasa-actual (contrato redactado en el spec) vía
TanStack Query con degradación a null. HeroBusqueda muestra el chip en el
header solo si hay dato real; sin endpoint el chip se oculta, nada se rompe.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Placeholder de mapa en la vista Farmacias

Replica la caja de mapa del mockup encima de la lista de farmacias cercanas. Placeholder visual, no mapa real.

**Files:**
- Modify: `src/App.tsx` (`vistaFarmacias`)

**Interfaces:**
- Consumes: nada nuevo (usa `MapPin` de lucide-react, ya importado en `App.tsx`).
- Produces: nada.

- [ ] **Step 1: Insertar la caja de mapa**

En `src/App.tsx`, dentro de `vistaFarmacias`, justo después del `<p>` del subtítulo (`{farmaciasCercanas.length > 0 ? … : …}`) y antes del bloque condicional de la lista/estado vacío, insertar:
```tsx
        {/* Placeholder de mapa (handoff): superficie visual, no un mapa real. */}
        <div
          aria-hidden="true"
          style={{
            position: "relative",
            height: 196,
            marginTop: 16,
            borderRadius: 18,
            border: "1px solid var(--borde)",
            overflow: "hidden",
            background:
              "repeating-linear-gradient(45deg,#f2f3ef,#f2f3ef 11px,#ecefe9 11px,#ecefe9 22px)",
          }}
        >
          <span style={{ position: "absolute", left: 64, top: 56, color: "var(--verde-cruz)" }}>
            <MapPin className="h-[30px] w-[30px]" strokeWidth={1.4} />
          </span>
          <span style={{ position: "absolute", right: 70, top: 96, color: "var(--verde-vivo)" }}>
            <MapPin className="h-[26px] w-[26px]" strokeWidth={1.4} />
          </span>
          <span
            className="dy-num"
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: "translate(-50%,-50%)",
              fontFamily: "ui-monospace,Menlo,monospace",
              fontSize: 11,
              color: "var(--tinta-tenue)",
              background: "rgba(250,250,247,0.82)",
              padding: "5px 9px",
              borderRadius: 7,
            }}
          >
            mapa · farmacias cercanas
          </span>
        </div>
```

- [ ] **Step 2: Verificar**

Run:
```bash
npx tsc --noEmit && npm run build
```
Expected: PASS.

Verificación manual (preview): ir a la pestaña Farmacias → aparece la caja rayada con dos pines y la etiqueta "mapa · farmacias cercanas" sobre la lista (o sobre el estado vacío).

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat(farmacias): placeholder de mapa sobre la lista

Replica la caja de mapa del handoff (rayas + pines + etiqueta) en la vista
Farmacias. Placeholder visual, no un mapa real (fuera de alcance).

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review (resultado)

**Cobertura del spec:**
- Pieza 1 (IA flotante + arrastrable) → Tasks 3 y 4. ✅
- Pieza 2 (back-dismiss todos los overlays) → Task 2 (existentes) + Task 3 (chat). ✅
- Pieza 3 (chip de tasa + contrato backend) → Task 5. ✅
- Pieza 4 (placeholder de mapa) → Task 6. ✅
- Pieza 5 (consolidar `/busqueda`) → Task 1. ✅

**Placeholders:** ninguno — cada paso trae código/comandos concretos.

**Consistencia de tipos:** `useBackDismiss(open, onClose)`, `useTasa(): TasaActual | null`, `HojaChatIA({open,onClose})`, `HojaBase`/`Asa` desde `_hojaBase`, `MenuMasPaciente` con `onAbrirChatIA`, `BurbujaAsistenteIA({visible,onAbrir})`, `HeroBusqueda` con `tasa?: number | null` — nombres usados igual entre tasks.

**Nota de orden:** Task 3 debe ir antes de Task 4 (la burbuja usa `chatIAAbierto` de App). Task 2 antes de Task 3 (el chat reutiliza `useBackDismiss`). El resto es independiente.
