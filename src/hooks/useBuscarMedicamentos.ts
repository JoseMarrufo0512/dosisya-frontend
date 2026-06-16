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
      const resp = await buscarMedicamentos({
        q: term,
        lat: coords.lat,
        lng: coords.lng,
        radio,
        con_delivery: conDelivery,
      });
      if (resp.status === "error" || !resp.data) {
        setError(resp.message || "Error desconocido");
        setView("error");
        return;
      }
      setResults(resp.data.resultados);
      setView(resp.data.total === 0 ? "empty" : "results");
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
