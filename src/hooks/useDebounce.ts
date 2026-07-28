import { useEffect, useState } from "react";

/**
 * Devuelve una versión "retrasada" de `value` que solo se actualiza cuando el
 * valor deja de cambiar durante `delay` ms. Útil para buscar mientras se
 * escribe sin disparar una petición por cada tecla.
 *
 * El timer se reinicia en cada cambio de `value`; al desmontar se limpia.
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);

  return debounced;
}
