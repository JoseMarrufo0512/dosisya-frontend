import { useCallback, useMemo, useSyncExternalStore } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Lista Médica — store global con persistencia en localStorage.
//
// ¿Por qué un store y no useLocalStorage? Porque la lista se consume desde
// varios componentes a la vez (TarjetaResultado, CartSummary, el drawer) y
// todos deben re-renderizar en sincronía; useState + localStorage no comparte
// estado entre instancias en la misma pestaña.
//
// SSR (TanStack Start): useSyncExternalStore usa getServerSnapshot en el
// servidor Y durante la hidratación, así que nunca hay mismatch. localStorage
// solo se toca en el cliente.
// ─────────────────────────────────────────────────────────────────────────────

export interface ItemLista {
  medicamentoId: string | number;
  nombre: string;
  presentacion: string;
  marcaComercial?: string | null;
  /** Precio de referencia (USD) visto al añadir. Puede variar por farmacia. */
  precioRefUsd?: number;
  cantidad: number;
  agregadoEn: number;
}

const STORAGE_KEY = "dosisya:lista-medica:v1";
const LISTA_VACIA: ItemLista[] = [];

let items: ItemLista[] = LISTA_VACIA;
let inicializado = false;
const listeners = new Set<() => void>();

function leerStorage(): ItemLista[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return LISTA_VACIA;
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ItemLista[]) : LISTA_VACIA;
  } catch {
    return LISTA_VACIA;
  }
}

function persistir() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    /* cuota llena o modo privado: la lista sigue viva en memoria */
  }
}

function emitir() {
  for (const listener of listeners) listener();
}

function asegurarInicializado() {
  if (inicializado || typeof window === "undefined") return;
  inicializado = true;
  items = leerStorage();
  // Sincronización entre pestañas (el evento "storage" solo dispara en OTRAS pestañas)
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY) {
      items = leerStorage();
      emitir();
    }
  });
}

function setItems(next: ItemLista[]) {
  items = next;
  persistir();
  emitir();
}

function subscribe(listener: () => void) {
  asegurarInicializado();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = () => {
  asegurarInicializado();
  return items;
};

const getServerSnapshot = () => LISTA_VACIA;

// ── Acciones (usables también fuera de React) ───────────────────────────────

const mismoId = (a: ItemLista["medicamentoId"], b: ItemLista["medicamentoId"]) =>
  String(a) === String(b);

export function agregarItem(
  nuevo: Omit<ItemLista, "cantidad" | "agregadoEn"> & { cantidad?: number },
): ItemLista {
  const existente = items.find((i) => mismoId(i.medicamentoId, nuevo.medicamentoId));
  if (existente) {
    const actualizado: ItemLista = {
      ...existente,
      cantidad: Math.min(99, existente.cantidad + (nuevo.cantidad ?? 1)),
    };
    setItems(items.map((i) => (mismoId(i.medicamentoId, nuevo.medicamentoId) ? actualizado : i)));
    return actualizado;
  }
  const item: ItemLista = { ...nuevo, cantidad: nuevo.cantidad ?? 1, agregadoEn: Date.now() };
  setItems([...items, item]);
  return item;
}

/** Devuelve el item quitado y su posición, para poder deshacer. */
export function quitarItem(
  medicamentoId: ItemLista["medicamentoId"],
): { item: ItemLista; indice: number } | null {
  const indice = items.findIndex((i) => mismoId(i.medicamentoId, medicamentoId));
  if (indice === -1) return null;
  const item = items[indice];
  setItems(items.filter((_, i) => i !== indice));
  return { item, indice };
}

export function restaurarItem(item: ItemLista, indice: number) {
  if (items.some((i) => mismoId(i.medicamentoId, item.medicamentoId))) return;
  const copia = [...items];
  copia.splice(Math.min(indice, copia.length), 0, item);
  setItems(copia);
}

export function cambiarCantidad(medicamentoId: ItemLista["medicamentoId"], delta: number) {
  setItems(
    items.map((i) =>
      mismoId(i.medicamentoId, medicamentoId)
        ? { ...i, cantidad: Math.min(99, Math.max(1, i.cantidad + delta)) }
        : i,
    ),
  );
}

export function vaciarLista() {
  setItems(LISTA_VACIA);
}

// ── Hook ────────────────────────────────────────────────────────────────────

export function useListaMedica() {
  const lista = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const estaEnLista = useCallback(
    (medicamentoId: ItemLista["medicamentoId"]) =>
      lista.find((i) => mismoId(i.medicamentoId, medicamentoId)) ?? null,
    [lista],
  );

  const totalUnidades = useMemo(() => lista.reduce((acc, i) => acc + i.cantidad, 0), [lista]);

  return {
    lista,
    /** Medicamentos distintos (lo que muestra el CartSummary). */
    totalDistintos: lista.length,
    totalUnidades,
    estaEnLista,
    agregar: agregarItem,
    quitar: quitarItem,
    restaurar: restaurarItem,
    cambiarCantidad,
    vaciar: vaciarLista,
  };
}
