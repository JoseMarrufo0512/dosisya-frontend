import { useCallback, useMemo, useSyncExternalStore } from "react";
import type { OrigenLead } from "@/lib/leads";

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
  /** Por dónde entró el item. Ausente en items previos a la feature (= lista_medica). */
  origen?: OrigenLead;
  /**
   * Farmacia de la tarjeta desde la que se añadió. Ausente en items del
   * escáner de récipe (no hay farmacia todavía) y en items guardados antes
   * de esta feature.
   */
  farmaciaId?: string;
  farmaciaNombre?: string;
  farmaciaWhatsapp?: string | null;
}

/** Clave de identidad de un item: mismo medicamento en la MISMA farmacia. */
export function claveItem(item: Pick<ItemLista, "farmaciaId" | "medicamentoId">): string {
  return `${item.farmaciaId ?? "sin-farmacia"}-${item.medicamentoId}`;
}

/**
 * Si todos los ítems de la lista vienen de la MISMA farmacia (con datos de
 * contacto completos), la devuelve — permite saltar el selector de farmacia
 * e ir directo a WhatsApp. Lista vacía, farmacias mixtas, o ítems sin
 * farmacia (récipe IA) → null.
 */
export function farmaciaUnicaDeLista(
  lista: ItemLista[],
): { id: string; nombre: string; whatsapp: string } | null {
  if (lista.length === 0) return null;
  const { farmaciaId, farmaciaNombre, farmaciaWhatsapp } = lista[0];
  if (!farmaciaId || !farmaciaNombre || !farmaciaWhatsapp) return null;
  const mismaFarmacia = lista.every((i) => i.farmaciaId === farmaciaId);
  if (!mismaFarmacia) return null;
  return { id: farmaciaId, nombre: farmaciaNombre, whatsapp: farmaciaWhatsapp };
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

export function agregarItem(
  nuevo: Omit<ItemLista, "cantidad" | "agregadoEn"> & { cantidad?: number },
): ItemLista {
  const clave = claveItem(nuevo);
  const existente = items.find((i) => claveItem(i) === clave);
  if (existente) {
    const actualizado: ItemLista = {
      ...existente,
      cantidad: Math.min(99, existente.cantidad + (nuevo.cantidad ?? 1)),
    };
    setItems(items.map((i) => (claveItem(i) === clave ? actualizado : i)));
    return actualizado;
  }
  const item: ItemLista = { ...nuevo, cantidad: nuevo.cantidad ?? 1, agregadoEn: Date.now() };
  setItems([...items, item]);
  return item;
}

/** Devuelve el item quitado y su posición, para poder deshacer. */
export function quitarItem(
  farmaciaId: ItemLista["farmaciaId"],
  medicamentoId: ItemLista["medicamentoId"],
): { item: ItemLista; indice: number } | null {
  const clave = claveItem({ farmaciaId, medicamentoId });
  const indice = items.findIndex((i) => claveItem(i) === clave);
  if (indice === -1) return null;
  const item = items[indice];
  setItems(items.filter((_, i) => i !== indice));
  return { item, indice };
}

export function restaurarItem(item: ItemLista, indice: number) {
  if (items.some((i) => claveItem(i) === claveItem(item))) return;
  const copia = [...items];
  copia.splice(Math.min(indice, copia.length), 0, item);
  setItems(copia);
}

export function cambiarCantidad(
  farmaciaId: ItemLista["farmaciaId"],
  medicamentoId: ItemLista["medicamentoId"],
  delta: number,
) {
  const clave = claveItem({ farmaciaId, medicamentoId });
  setItems(
    items.map((i) =>
      claveItem(i) === clave
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
    (farmaciaId: ItemLista["farmaciaId"], medicamentoId: ItemLista["medicamentoId"]) => {
      const clave = claveItem({ farmaciaId, medicamentoId });
      return lista.find((i) => claveItem(i) === clave) ?? null;
    },
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
