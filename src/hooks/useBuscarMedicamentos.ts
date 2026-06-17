import { useCallback, useState } from "react";
import { buscarMedicamentos, type ResultadoFarmacia } from "@/lib/api";

export interface UseBuscarMedicamentosReturn {
  resultados: ResultadoFarmacia[];
  cargando: boolean;
  error: string | null;
  totalResultados: number;
  buscar: (
    q: string,
    lat: number,
    lng: number,
    conDelivery?: boolean,
  ) => Promise<void>;
}

export function useBuscarMedicamentos(): UseBuscarMedicamentosReturn {
  const [resultados, setResultados] = useState<ResultadoFarmacia[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalResultados, setTotalResultados] = useState(0);

  const buscar = useCallback(
    async (q: string, lat: number, lng: number, conDelivery = false) => {
      setCargando(true);
      setError(null);
      const resp = await buscarMedicamentos({
        q,
        lat,
        lng,
        con_delivery: conDelivery,
      });
      if (resp.status === "error" || !resp.data) {
        setError(resp.message || "Error al buscar medicamentos");
        setResultados([]);
        setTotalResultados(0);
      } else {
        setResultados(resp.data.resultados);
        setTotalResultados(resp.data.total);
      }
      setCargando(false);
    },
    [],
  );

  return { resultados, cargando, error, totalResultados, buscar };
}
