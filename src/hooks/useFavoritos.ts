import { useCallback, useSyncExternalStore } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Favoritos — store global con persistencia en localStorage.
//
// Mismo patrón que useListaMedica: cada TarjetaResultado consulta y alterna
// favoritos, así que todas las instancias deben re-renderizar en sincronía.
// useState + localStorage no comparte estado entre instancias en la misma
// pestaña (y podría pisarse al escribir); un store con useSyncExternalStore sí.
//
// Sin login (B2C cero fricción): los favoritos viven solo en el dispositivo.
// Clave = `${farmaciaId}:${medicamentoId}` — un resultado concreto, no el
// principio activo (el mismo medicamento en otra farmacia es otro favorito).
// ─────────────────────────────────────────────────────────────────────────────

const STORAGE_KEY = "dosisya:favoritos:v1";
const VACIO: string[] = [];

let claves: string[] = VACIO;
let inicializado = false;
const listeners = new Set<() => void>();

function leerStorage(): string[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return VACIO;
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as string[]) : VACIO;
  } catch {
    return VACIO;
  }
}

function persistir() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(claves));
  } catch {
    /* cuota llena o modo privado: los favoritos siguen vivos en memoria */
  }
}

function emitir() {
  for (const listener of listeners) listener();
}

function asegurarInicializado() {
  if (inicializado || typeof window === "undefined") return;
  inicializado = true;
  claves = leerStorage();
  // Sincronización entre pestañas (el evento "storage" solo dispara en OTRAS).
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY) {
      claves = leerStorage();
      emitir();
    }
  });
}

function setClaves(next: string[]) {
  claves = next;
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
  return claves;
};

const getServerSnapshot = () => VACIO;

export function claveFavorito(farmaciaId: string, medicamentoId: string) {
  return `${farmaciaId}:${medicamentoId}`;
}

/** Alterna el favorito. Usable también fuera de React. */
export function alternarFavorito(farmaciaId: string, medicamentoId: string) {
  const clave = claveFavorito(farmaciaId, medicamentoId);
  setClaves(claves.includes(clave) ? claves.filter((c) => c !== clave) : [clave, ...claves]);
}

export function useFavoritos() {
  const favoritos = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const esFavorito = useCallback(
    (farmaciaId: string, medicamentoId: string) =>
      favoritos.includes(claveFavorito(farmaciaId, medicamentoId)),
    [favoritos],
  );

  return {
    favoritos,
    totalFavoritos: favoritos.length,
    esFavorito,
    alternar: alternarFavorito,
  };
}
