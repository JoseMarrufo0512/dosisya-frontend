import { useCallback, useEffect, useState } from "react";

export function useLocalStorage<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === "undefined") return initialValue;
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* ignore quota */
    }
  }, [key, value]);

  const remove = useCallback(() => {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
    setValue(initialValue);
  }, [key, initialValue]);

  return [value, setValue, remove] as const;
}

const BUSQUEDAS_KEY = "busquedasRecientes";
const MAX_BUSQUEDAS = 5;

export function useBusquedasRecientes() {
  const [busquedas, setBusquedas, clear] = useLocalStorage<string[]>(
    BUSQUEDAS_KEY,
    [],
  );

  const agregar = useCallback(
    (termino: string) => {
      const t = termino.trim();
      if (!t) return;
      setBusquedas((prev) => {
        const sinDuplicado = prev.filter(
          (x) => x.toLowerCase() !== t.toLowerCase(),
        );
        return [t, ...sinDuplicado].slice(0, MAX_BUSQUEDAS);
      });
    },
    [setBusquedas],
  );

  return { busquedas, agregar, limpiar: clear };
}
