import { useCallback, useState } from "react";
import { buscarMedicamentos, type Coords, type Resultado } from "@/lib/api";

export type SearchView = "idle" | "loading" | "results" | "empty" | "error";

export function useBuscarMedicamentos() {
  const [view, setView] = useState<SearchView>("idle");
  const [results, setResults] = useState<Resultado[]>([]);
  const [error, setError] = useState("");

  const search = useCallback(
    async (q: string, coords: Coords, radio: number, conDelivery: boolean) => {
      const term = q.trim();
      if (term.length < 2) {
        setError("Escribe al menos 2 caracteres.");
        setView("error");
        return;
      }
      setView("loading");
      setError("");
      try {
        const data = await buscarMedicamentos(term, coords, radio, conDelivery);
        setResults(data.resultados);
        setView(data.total === 0 ? "empty" : "results");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error desconocido");
        setView("error");
      }
    },
    [],
  );

  const reset = useCallback(() => {
    setView("idle");
    setResults([]);
    setError("");
  }, []);

  return { view, results, error, search, reset };
}
