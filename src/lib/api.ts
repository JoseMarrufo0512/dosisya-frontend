// Cliente HTTP base de DosisYa
export const API_BASE =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ??
  "https://proyecto-dosis-ya.vercel.app";

export type ApiResponse<T> = {
  status: "success" | "error";
  message: string;
  data: T | null;
};

export type Resultado = {
  farmacia_id: string;
  farmacia_nombre: string;
  direccion: string;
  telefono_whatsapp: string;
  nivel_suscripcion: "premium" | "gratuita";
  tiene_delivery: boolean;
  medicamento_id: string;
  principio_activo: string;
  marca_comercial: string | null;
  presentacion: string;
  precio_usd: number;
  precio_ves: number;
  stock_disponible: boolean;
  distancia_metros: number;
  score_similitud: number;
};

export type BusquedaData = { total: number; resultados: Resultado[] };

export type Coords = { lat: number; lon: number };

export async function buscarMedicamentos(
  q: string,
  coords: Coords,
  radio: number,
  conDelivery: boolean,
): Promise<BusquedaData> {
  const params = new URLSearchParams({
    q,
    lat: String(coords.lat),
    lon: String(coords.lon),
    radio: String(radio),
    con_delivery: String(conDelivery),
  });
  const res = await fetch(`${API_BASE}/api/v1/medicamentos/buscar?${params}`);
  const json: ApiResponse<BusquedaData> = await res.json();
  if (json.status === "error" || !json.data) {
    throw new Error(json.message || `HTTP ${res.status}`);
  }
  return json.data;
}
