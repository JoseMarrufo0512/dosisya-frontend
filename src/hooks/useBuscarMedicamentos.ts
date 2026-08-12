import { useCallback, useRef, useState } from "react";
import { buscarMedicamentos, type ResultadoFarmacia } from "@/lib/api";
import { track } from "@/lib/analytics";
import * as Sentry from '@sentry/tanstackstart-react';

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
    radio?: number
  ) => Promise<void>;
}

export function useBuscarMedicamentos(): UseBuscarMedicamentosReturn {
  const [resultados, setResultados] = useState<ResultadoFarmacia[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalResultados, setTotalResultados] = useState(0);
  // Guard de orden: si el usuario dispara otra búsqueda antes de que responda
  // la anterior (ej. ampliar radio 5km→10km), la respuesta vieja no debe
  // pisar el estado de la búsqueda más reciente.
  const idBusquedaRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  const buscar = useCallback(
    async (q: string, lat: number, lng: number, conDelivery = false, radio?: number) => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;
      
      const idBusqueda = ++idBusquedaRef.current;
      setCargando(true);
      setError(null);
      
      try {
        const resp = await buscarMedicamentos({
          q,
          lat,
          lng,
          con_delivery: conDelivery,
          radio,
        }, controller.signal);
        
        if (idBusqueda !== idBusquedaRef.current) return;
        
        if (resp.status === "error" || !resp.data) {
          setError(resp.message || "Error al buscar medicamentos");
          setResultados([]);
          setTotalResultados(0);
        } else {
          setResultados(resp.data.resultados);
          setTotalResultados(resp.data.total);
          track("busqueda_ejecutada", { termino: q, resultados: resp.data.total });
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        if (idBusqueda !== idBusquedaRef.current) return;
        Sentry.captureException(err);
        setError("Error inesperado al buscar medicamentos");
        setResultados([]);
        setTotalResultados(0);
      } finally {
        if (idBusqueda === idBusquedaRef.current) {
          setCargando(false);
        }
      }
    },
    [],
  );

  return { resultados, cargando, error, totalResultados, buscar };
}
