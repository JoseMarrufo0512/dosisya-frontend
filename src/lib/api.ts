// Cliente HTTP base de DosisYa
export interface ResultadoFarmacia {
  farmacia_id: string;
  farmacia_nombre: string;
  direccion: string;
  whatsapp: string;
  nivel_suscripcion: "premium" | "gratuita";
  es_premium: boolean;
  tiene_delivery: boolean;
  lat: number;
  lng: number;
  medicamento_id: string;
  medicamento_nombre: string;
  marca_comercial: string | null;
  presentacion: string;
  precio_usd: number;
  precio_ves: number;
  stock_disponible: boolean;
  distancia_m: number;
  score_similitud: number;
}

export interface RespuestaAPI {
  status: "success" | "error";
  message: string;
  data: { total: number; resultados: ResultadoFarmacia[] } | null;
}

export interface ParamsBusqueda {
  q: string;
  lat: number;
  lng: number;
  radio?: number;
  con_delivery?: boolean;
}

export const API_BASE =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "";

export async function buscarMedicamentos(
  params: ParamsBusqueda,
): Promise<RespuestaAPI> {
  try {
    const qs = new URLSearchParams({
      q: params.q,
      lat: String(params.lat),
      lng: String(params.lng),
      ...(params.radio !== undefined ? { radio: String(params.radio) } : {}),
      ...(params.con_delivery !== undefined
        ? { con_delivery: String(params.con_delivery) }
        : {}),
    });
    const res = await fetch(
      `${API_BASE}/api/v1/medicamentos/buscar?${qs.toString()}`,
    );
    const json = (await res.json()) as RespuestaAPI;
    return json;
  } catch {
    return { status: "error", message: "Error de red", data: null };
  }
}
