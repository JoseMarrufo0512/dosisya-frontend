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

// ── Recordatorios de resurtido ──────────────────────────────────────────────
// Para pacientes crónicos: recuerdan volver a buscar un medicamento tras N días.
// Sin login: viven en localStorage, se revisan al abrir la app. La entrega por
// push/WhatsApp (cuando la app está cerrada) es v2 y depende de n8n.

export interface Recordatorio {
  termino: string;
  creadoMs: number;
  proximoMs: number;
}

const RECORDATORIOS_KEY = "recordatoriosResurtido";
const DIAS_DEFAULT = 30;
const MS_POR_DIA = 24 * 60 * 60 * 1000;

export function useRecordatorios() {
  const [recordatorios, setRecordatorios, clear] = useLocalStorage<Recordatorio[]>(
    RECORDATORIOS_KEY,
    [],
  );

  const agregar = useCallback(
    (termino: string, dias: number = DIAS_DEFAULT) => {
      const t = termino.trim();
      if (!t) return;
      const ahora = Date.now();
      setRecordatorios((prev) => {
        const sinDuplicado = prev.filter(
          (r) => r.termino.toLowerCase() !== t.toLowerCase(),
        );
        return [
          { termino: t, creadoMs: ahora, proximoMs: ahora + dias * MS_POR_DIA },
          ...sinDuplicado,
        ];
      });
    },
    [setRecordatorios],
  );

  const eliminar = useCallback(
    (termino: string) => {
      const t = termino.trim().toLowerCase();
      setRecordatorios((prev) => prev.filter((r) => r.termino.toLowerCase() !== t));
    },
    [setRecordatorios],
  );

  const estaActivo = useCallback(
    (termino: string) =>
      recordatorios.some((r) => r.termino.toLowerCase() === termino.trim().toLowerCase()),
    [recordatorios],
  );

  const vencidos = useCallback(
    (ahora: number = Date.now()) => recordatorios.filter((r) => r.proximoMs <= ahora),
    [recordatorios],
  );

  return { recordatorios, agregar, eliminar, estaActivo, vencidos, limpiar: clear };
}
