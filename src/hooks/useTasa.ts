import { useQuery } from "@tanstack/react-query";
import { API_BASE } from "@/lib/api";

export interface TasaActual {
  /** Tasa USD → VES vigente (ej. 145.2) */
  tasa: number;
  /** Timestamp ISO de la tasa aplicada */
  fecha: string;
}

/**
 * Contrato pendiente en backend (ver spec 2026-07-26): GET /api/v1/tasa-actual
 *   200 { status, message, data: { tasa: number, fecha: string } }
 * Mientras el endpoint no exista, cualquier fallo devuelve null → el chip se oculta.
 */
async function fetchTasa(): Promise<TasaActual | null> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/tasa-actual`);
    if (!res.ok) return null;
    const json = await res.json();
    const data = json?.data;
    if (!data || typeof data.tasa !== "number") return null;
    return { tasa: data.tasa, fecha: String(data.fecha ?? "") };
  } catch {
    return null;
  }
}

export function useTasa(): TasaActual | null {
  const { data } = useQuery({
    queryKey: ["tasa-actual"],
    queryFn: fetchTasa,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  return data ?? null;
}
